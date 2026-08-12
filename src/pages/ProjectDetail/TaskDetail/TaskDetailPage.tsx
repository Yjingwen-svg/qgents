import { useEffect, useMemo } from 'react'
import { Alert, Breadcrumb, Button, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import {
  useDeliverables,
  useExecutionContext,
  useOrchestrationRun,
  useOrchestrationWorkPackages,
} from '@/hooks'
import type { Deliverable, ExecutionContext, OrchestrationRun, TaskExecutionStage, WorkPackage } from '@/types'
import { PATHS } from '@/routes/paths'
import { TaskStatusTag } from '../TaskShared/TaskStatusTag'
import { getTaskPresentation } from '../TaskShared/taskPresentation'
import { ORCHESTRATION_STATUS_META } from '../TaskShared/taskStatus'
import styles from './TaskDetailPage.module.scss'

const { Paragraph, Text, Title } = Typography
const TASK_DETAIL_SEARCH_PARAMS = new Set(['workPackageId', 'taskRunId'])

export function TaskDetailPage() {
  const { projectId = '', runId = '' } = useParams<{ projectId: string; runId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const runQuery = useOrchestrationRun(projectId, runId)
  const run = runQuery.data
  const workPackageIds = run?.workPackageIds ?? []
  const workPackageQueries = useOrchestrationWorkPackages(projectId, workPackageIds)
  const workPackages = useMemo(
    () => workPackageQueries.flatMap((query) => query.data ? [query.data] : []),
    [workPackageQueries],
  )
  const requestedWorkPackageId = searchParams.get('workPackageId')?.trim() || undefined
  const requestedTaskRunId = searchParams.get('taskRunId')?.trim() || undefined
  const executionContextQuery = useExecutionContext(projectId, requestedTaskRunId ?? '')

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of Array.from(next.keys())) {
      if (!TASK_DETAIL_SEARCH_PARAMS.has(key)) {
        next.delete(key)
        changed = true
      }
    }
    if (changed) setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const selectedWorkPackage = workPackages.find((workPackage) => workPackage.id === requestedWorkPackageId) ?? workPackages[0]
  const deliverablesQuery = useDeliverables(projectId, selectedWorkPackage?.id ?? '')
  const deliverables = deliverablesQuery.data?.data ?? []

  function handleBackToCenter() {
    navigate(resolveReturnPath(location.state, projectId, runId))
  }

  if (runQuery.isLoading) return <DetailState loading description="正在加载任务详情" />
  if (runQuery.isError) return <DetailError error={runQuery.error} />
  if (!run) return <DetailState description="任务不存在或不可见" />
  if (run.projectId !== projectId) return <DetailState description="任务不存在或不可见" />

  const presentation = getTaskPresentation(run)

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Breadcrumb
          className={styles.breadcrumb}
          items={[{ title: '星河工作室' }, { title: 'Qgents' }, { title: '任务中心' }, { title: '任务详情' }]}
        />
      </div>

      <div className={styles.contentGrid}>
        <main className={styles.mainContent}>
          <div className={styles.detailToolbar}>
            <Button aria-label="返回任务中心" type="text" icon={<ArrowLeftOutlined />} onClick={handleBackToCenter}>任务详情</Button>
            <div className={styles.topBarActions}>
              <Button onClick={() => navigate(PATHS.projectReqChat(projectId, run.groupId))}>返回需求群</Button>
              {deliverables.length > 0 ? <Button type="primary">查看交付</Button> : null}
            </div>
          </div>
          <header className={styles.taskHeader}>
            <div className={styles.detailTitleRow}>
              <Title level={2} className={styles.title}>
                <Text className={styles.summaryId}>任务 ID：{run.id}</Text>
                {run.instruction}
              </Title>
              <TaskStatusTag status={run.status} />
            </div>
            <div className={styles.summaryMeta}>
              <SummaryItem label="所属需求群" value={presentation.groupLabel} />
              <SummaryItem label="状态" value={statusLabel(run.status)} />
              <SummaryItem label="优先级" value={run.taskDetailSummary?.priorityLabel ?? '—'} />
              <SummaryItem label="当前执行阶段" value={run.taskDetailSummary?.currentStage ?? run.status} />
              <SummaryItem label="发起人" value={presentation.creatorLabel} />
              <SummaryItem label="创建时间" value={formatDateTime(run.createdAt)} />
              <SummaryItem label="更新时间" value={formatDateTime(run.updatedAt)} />
            </div>
          </header>
          <ExecutionFlow stages={run.executionPreview?.stages ?? []} />
          <SharedContext run={run} deliverables={deliverables} />
          <DevelopmentContext workPackage={selectedWorkPackage} context={executionContextQuery.data} summary={run.taskDetailSummary} />
          <DeliverablesSummary query={deliverablesQuery} deliverables={deliverables} />
        </main>

        <aside className={styles.sideContent}>
          <SourcePanel run={run} workPackage={selectedWorkPackage} context={executionContextQuery.data} />
          <ExecutionChecklist stages={run.executionPreview?.stages ?? []} workPackages={workPackages} />
          <RoleReviewPanel run={run} />
          <NotePanel />
          <div className={styles.sideTaskId}>任务 ID：{run.id}</div>
        </aside>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className={styles.summaryMetaItem}><Text className={styles.label}>{label}</Text><Text className={styles.value}>{value}</Text></div>
}

function ExecutionFlow({ stages }: { stages: NonNullable<OrchestrationRun['executionPreview']>['stages'] }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}><Title level={4}>执行流程</Title></div>
      {stages.length === 0 ? <div className={styles.emptyCard}>暂无执行流程</div> : (
        <div className={styles.flowGrid}>
          {stages.slice(0, 4).map((stage) => <ExecutionStageCard key={stage.id} stage={stage} />)}
        </div>
      )}
    </section>
  )
}

function ExecutionStageCard({ stage }: { stage: NonNullable<OrchestrationRun['executionPreview']>['stages'][number] }) {
  return (
    <div className={`${styles.flowCard} ${stage.status === 'RUNNING' ? styles.flowCardCurrent : ''}`}>
      <div className={styles.flowCardHeading}>
        <div className={styles.flowIcon}>{stage.node}</div>
        <Text className={styles.flowTitle}>{stage.title}</Text>
      </div>
      <div className={styles.flowStepList}>
        {stage.steps.slice(0, 4).map((step) => (
          <div className={styles.flowStep} key={step.id}>
            <Text>{step.label}</Text>
            <Text className={styles.flowStepStatus}>{stepStatusLabel(step.status)}</Text>
          </div>
        ))}
      </div>
      <div className={styles.flowFooter}>
        <Tag color={stageStatusColor(stage.status)}>{stageStatusLabel(stage.status)}</Tag>
        <Text type="secondary">{formatDateTime(stage.finishedAt ?? stage.startedAt)}</Text>
      </div>
    </div>
  )
}

function SharedContext({
  run,
  deliverables,
}: {
  run: OrchestrationRun
  deliverables: Deliverable[]
}) {
  const summary = run.taskDetailSummary
  return (
    <section className={`${styles.section} ${styles.compactSection}`}>
      <div className={styles.sectionHeading}><Title level={4}>共享上下文</Title></div>
      <div className={styles.contextGrid}>
        <InfoCard label="需求群讨论" value={summary?.requirementDiscussion ?? '暂无讨论摘要'} icon="▣" action />
        <InfoCard label="决策记录" value={summary?.decisionRecord ?? '暂无决策记录'} action />
        <InfoCard label="已交付物" value={deliverables.length > 0 ? '需求群已交付的产出' : '暂无已交付物'} action />
        <InfoCard label="项目 Skill / Memory" value={summary?.skillMemorySummary ?? '暂无关联摘要'} action />
      </div>
    </section>
  )
}

function DevelopmentContext({
  workPackage,
  context,
  summary,
}: {
  workPackage?: WorkPackage
  context?: ExecutionContext
  summary?: OrchestrationRun['taskDetailSummary']
}) {
  return (
    <section className={`${styles.section} ${styles.compactSection}`}>
      <div className={styles.sectionHeading}><Title level={4}>开发上下文</Title><Text type="secondary">只读</Text></div>
      {!workPackage ? <div className={styles.emptyCard}>当前暂无开发上下文</div> : (
        <div className={styles.developmentGrid}>
          <InfoCard label="目标仓库" value={context?.repositoryId ?? workPackage.repositoryId} />
          <InfoCard label="基础分支" value={context?.baseRef ?? workPackage.baseRef} />
          <InfoCard label="工作分支" value={context?.headRef ?? workPackage.headRef} />
          <InfoCard label="Workspace" value={context?.workspaceId ?? summary?.workspaceId ?? '暂无 Workspace'} />
          <InfoCard label="Sandbox" value={context?.sandboxStatus ?? summary?.sandboxId ?? '暂无 Sandbox 状态'} />
        </div>
      )}
    </section>
  )
}

function DeliverablesSummary({ query, deliverables }: { query: ReturnType<typeof useDeliverables>; deliverables: Deliverable[] }) {
  return (
    <section className={`${styles.section} ${styles.compactSection}`}>
      <div className={styles.sectionHeading}><Title level={4}>交付产出</Title><Text type="secondary">仅展示摘要</Text></div>
      {query.isLoading ? <Spin /> : null}
      {query.isError ? <Alert type="warning" showIcon title="交付产出暂时无法加载" /> : null}
      {!query.isLoading && !query.isError && deliverables.length === 0 ? <div className={styles.emptyCard}>当前暂无交付产出</div> : null}
      <div className={styles.deliverableGrid}>
        {deliverables.map((deliverable) => (
          <div className={styles.deliverableCard} key={deliverable.id}>
            <Text strong><FileTextOutlined /> {deliverable.title}</Text>
            <Space wrap><Tag>{deliverableTypeLabel(deliverable.type)}</Tag><Tag color={deliverable.status === 'ACCEPTED' ? 'success' : 'processing'}>{deliverable.status}</Tag></Space>
            <Text type="secondary">{deliverable.summary ?? '暂无摘要'} · 版本 {deliverable.version}</Text>
          </div>
        ))}
      </div>
    </section>
  )
}

function InfoCard({ label, value, icon, action = false }: { label: string; value: string; icon?: string; action?: boolean }) {
  return <div className={styles.infoCard}>{icon ? <span className={styles.infoIcon}>{icon}</span> : null}<Text className={styles.label}>{label}</Text><Text className={styles.value}>{value}</Text>{action ? <Text className={styles.infoAction}>查看</Text> : null}</div>
}

function SourcePanel({ run, workPackage, context }: { run: OrchestrationRun; workPackage?: WorkPackage; context?: ExecutionContext }) {
  const presentation = getTaskPresentation(run)
  return (
    <div className={styles.sideCard}>
      <div className={styles.sideHeader}><Title level={5}>来源信息</Title></div>
      <Text className={styles.label}>需求描述</Text>
      <Paragraph className={styles.sideDescription}>{run.instruction}</Paragraph>
      <Text className={styles.label}>所属需求群</Text>
      <Text className={styles.value}>{presentation.groupLabel}</Text>
      <Text className={styles.label}>发起人</Text>
      <Text className={styles.value}>{presentation.creatorLabel}</Text>
      <Text className={styles.label}>当前 Workspace/Sandbox</Text>
      <Text type="secondary">{context ? `${context.workspaceId} · ${context.sandboxStatus}` : run.taskDetailSummary ? `${run.taskDetailSummary.workspaceId} · ${run.taskDetailSummary.sandboxId}` : workPackage ? `${workPackage.repositoryId} · ${workPackage.baseRef} → ${workPackage.headRef}` : '暂无来源摘要'}</Text>
    </div>
  )
}

function RoleReviewPanel({ run }: { run: OrchestrationRun }) {
  const participants = run.taskCenterSummary?.participants ?? []
  return (
    <div className={styles.sideCard}>
      <div className={styles.sideHeader}><Title level={5}>角色与审核流程</Title></div>
      <Text className={styles.label}>所有者</Text>
      <Text className={styles.value}>{participants.find((participant) => participant.role === 'OWNER')?.name ?? '暂无所有者'}</Text>
      <Text className={styles.label}>执行 Agent</Text>
      <Text className={styles.value}>{run.taskCenterSummary?.agentName ?? participants.find((participant) => participant.role === 'AGENT')?.name ?? '暂无 Agent'}</Text>
      <Text className={styles.label}>当前参与者</Text>
      <Text type="secondary">{participants.map((participant) => participant.name).join('、') || '暂无参与者摘要'}</Text>
    </div>
  )
}

function NotePanel() {
  return <div className={styles.noteCard}><Title level={5}>说明</Title><Text type="secondary">此页面集中展示任务来源、执行流程、开发上下文和交付摘要。</Text></div>
}

function ExecutionChecklist({ stages, workPackages }: { stages: TaskExecutionStage[]; workPackages: WorkPackage[] }) {
  const items = stages.length > 0
    ? stages.map((stage) => ({ id: stage.id, label: stage.title, status: stage.status }))
    : workPackages.map((workPackage) => ({ id: workPackage.id, label: workPackage.title, status: workPackage.status }))
  return (
    <div className={styles.sideCard}>
      <div className={styles.sideHeader}><Title level={5}>执行清单</Title><Text type="secondary">只读</Text></div>
      {items.length === 0 ? <div className={styles.emptyCard}>暂无可用检查项</div> : (
        <div className={styles.checklist}>
          {items.map((item) => (
            <div className={styles.checklistItem} key={item.id}>
              <Text className={styles.checklistLabel}>{item.label}</Text>
              {item.status === 'COMPLETED' || item.status === 'SUCCEEDED' ? <CheckCircleOutlined style={{ color: '#059669' }} /> : <ClockCircleOutlined style={{ color: '#2563eb' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailState({ description, loading = false }: { description: string; loading?: boolean }) {
  if (loading) return <div className={styles.page}><div className={styles.panelState}><Spin description={description} /></div></div>
  return <div className={styles.page}><Result status="404" title={description} subTitle="任务详情未自动替换为其他任务。" /></div>
}

function DetailError({ error }: { error: Error | null }) {
  const status = error instanceof ApiError ? error.status : undefined
  return (
    <div className={styles.page}>
      <Result
        status={status === 403 ? '403' : status === 404 ? '404' : 'error'}
        title={status === 403 ? '暂无权限查看任务详情' : status === 404 ? '任务不存在或不可见' : '任务详情加载失败'}
        subTitle="任务详情未自动替换为其他任务。"
      />
    </div>
  )
}

function resolveReturnPath(state: unknown, projectId: string, runId: string): string {
  const defaultPath = `${PATHS.projectTasks(projectId)}?runId=${encodeURIComponent(runId)}`
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return defaultPath
  return state.from.startsWith(PATHS.projectTasks(projectId)) ? state.from : defaultPath
}

function statusLabel(status: OrchestrationRun['status']): string {
  return ORCHESTRATION_STATUS_META[status].label
}

function stageStatusLabel(status: string): string {
  if (status === 'COMPLETED') return '已完成'
  if (status === 'RUNNING') return '进行中'
  if (status === 'FAILED') return '失败'
  return '待执行'
}

function stageStatusColor(status: string): string {
  if (status === 'COMPLETED') return 'success'
  if (status === 'RUNNING') return 'processing'
  if (status === 'FAILED') return 'error'
  return 'default'
}

function stepStatusLabel(status: string): string {
  if (status === 'PASSED') return '已完成'
  if (status === 'RUNNING') return '进行中'
  if (status === 'FAILED') return '失败'
  return '待执行'
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function deliverableTypeLabel(type: Deliverable['type']): string {
  if (type === 'CODE') return 'Diff / 代码变更'
  if (type === 'TEST_REPORT') return '测试报告'
  return '文档 / API 契约'
}
