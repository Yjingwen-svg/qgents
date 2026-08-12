import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import {
  useDeliverables,
  useCancelWorkPackage,
  useInfiniteTaskRuns,
  useOrchestrationRun,
  useOrchestrationWorkPackages,
  usePauseWorkPackage,
  useResumeWorkPackage,
  useStartWorkPackage,
} from '@/hooks'
import { canWorkPackageAction } from '@/types'
import type { Deliverable, OrchestrationRun, TaskExecutionStage, TaskRun, WorkPackage, WorkPackageAction } from '@/types'
import { PATHS } from '@/routes/paths'
import { TaskStatusTag } from '../TaskShared/TaskStatusTag'
import { getTaskPresentation } from '../TaskShared/taskPresentation'
import { ORCHESTRATION_STATUS_META } from '../TaskShared/taskStatus'
import styles from './TaskDetailPage.module.scss'

const { Paragraph, Text, Title } = Typography
export function TaskDetailPage() {
  const { projectId = '', runId = '' } = useParams<{ projectId: string; runId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const runQuery = useOrchestrationRun(projectId, runId)
  const run = runQuery.data
  const workPackageIds = useMemo(() => run?.workPackageIds ?? [], [run?.workPackageIds])
  const workPackageQueries = useOrchestrationWorkPackages(projectId, workPackageIds)
  const workPackages = useMemo(
    () => workPackageQueries.flatMap((query) => query.data ? [query.data] : []),
    [workPackageQueries],
  )
  const refreshWorkPackage = useCallback((workPackageId: string) => {
    const queryIndex = workPackageIds.indexOf(workPackageId)
    const query = queryIndex >= 0 ? workPackageQueries[queryIndex] : undefined
    if (query) void query.refetch()
  }, [workPackageIds, workPackageQueries])
  const selectedWorkPackage = workPackages[0]
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
              <Button
                type="primary"
                onClick={() => navigate(
                  deliverables[0]
                    ? PATHS.projectDeliverable(projectId, deliverables[0].id)
                    : PATHS.projectDeliverables(projectId),
                  { state: { from: `${location.pathname}${location.search}` } },
                )}
              >查看交付</Button>
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
          <ExecutionFlow
            projectId={projectId}
            runId={run.id}
            stages={run.executionPreview?.stages ?? []}
            workPackages={workPackages}
            onRefreshWorkPackage={refreshWorkPackage}
            from={`${location.pathname}${location.search}`}
          />
          <SharedContext run={run} deliverables={deliverables} />
          <DevelopmentContext workPackage={selectedWorkPackage} />
          <DeliverablesSummary query={deliverablesQuery} deliverables={deliverables} projectId={projectId} from={`${location.pathname}${location.search}`} />
        </main>

        <aside className={styles.sideContent}>
          <SourcePanel run={run} />
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

function ExecutionFlow({
  projectId,
  runId,
  stages,
  workPackages,
  onRefreshWorkPackage,
  from,
}: {
  projectId: string
  runId: string
  stages: NonNullable<OrchestrationRun['executionPreview']>['stages']
  workPackages: WorkPackage[]
  onRefreshWorkPackage: (workPackageId: string) => void
  from: string
}) {
  const navigate = useNavigate()
  const [taskRunsByWorkPackage, setTaskRunsByWorkPackage] = useState<Record<string, StageTaskRunQuery>>({})
  const startMutation = useStartWorkPackage(projectId)
  const pauseMutation = usePauseWorkPackage(projectId)
  const resumeMutation = useResumeWorkPackage(projectId)
  const cancelMutation = useCancelWorkPackage(projectId)
  const handleTaskRuns = useCallback((workPackageId: string, result: StageTaskRunQuery) => {
    setTaskRunsByWorkPackage((current) => ({ ...current, [workPackageId]: result }))
  }, [])

  function handleStageClick(taskRunId: string) {
    navigate(PATHS.projectTaskRunDetail(projectId, runId, taskRunId), { state: { from } })
  }

  function handleWorkPackageAction(workPackageId: string, action: WorkPackageAction) {
    if (action === 'pause' && !window.confirm('确认暂停该工作包？')) return
    if (action === 'cancel' && !window.confirm('确认取消该工作包？服务端只会在安全检查点停止。')) return
    const mutation = action === 'start' ? startMutation : action === 'pause' ? pauseMutation : action === 'resume' ? resumeMutation : cancelMutation
    mutation.mutate(workPackageId)
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}><Title level={4}>执行流程</Title></div>
      {stages.length === 0 ? <div className={styles.emptyCard}>暂无执行流程</div> : (
        <div className={styles.flowGrid}>
          {workPackages.map((workPackage) => (
            <WorkPackageTaskRunsProbe
              key={workPackage.id}
              projectId={projectId}
              workPackageId={workPackage.id}
              onResult={handleTaskRuns}
            />
          ))}
          {stages.slice(0, 4).map((stage) => {
            const taskRun = workPackages
              .flatMap((workPackage) => taskRunsByWorkPackage[workPackage.id]?.taskRuns ?? [])
              .filter((candidate) => candidate.agentNode === stage.node)
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
            const taskRunsLoading = workPackages.some((workPackage) => !taskRunsByWorkPackage[workPackage.id])
            const taskRunsError = workPackages.some((workPackage) => taskRunsByWorkPackage[workPackage.id]?.isError)
            const stageWorkPackage = taskRun
              ? workPackages.find((candidate) => candidate.id === taskRun.workPackageId)
              : workPackages.length === 1 ? workPackages[0] : undefined
            return (
              <ExecutionStageCard
                key={stage.id}
                stage={stage}
                taskRun={taskRun}
                isLoading={taskRunsLoading}
                hasError={taskRunsError}
                onClick={taskRun ? () => handleStageClick(taskRun.id) : undefined}
                workPackage={stageWorkPackage}
                operationPending={isWorkPackageMutationPending(stageWorkPackage?.id, startMutation, pauseMutation, resumeMutation, cancelMutation)}
                operationError={getWorkPackageMutationError(stageWorkPackage?.id, startMutation, pauseMutation, resumeMutation, cancelMutation)}
                onWorkPackageAction={handleWorkPackageAction}
                onRefreshWorkPackage={onRefreshWorkPackage}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function ExecutionStageCard({
  stage,
  taskRun,
  isLoading,
  hasError,
  onClick,
  workPackage,
  operationPending,
  operationError,
  onWorkPackageAction,
  onRefreshWorkPackage,
}: {
  stage: NonNullable<OrchestrationRun['executionPreview']>['stages'][number]
  taskRun?: TaskRun
  isLoading: boolean
  hasError: boolean
  onClick?: () => void
  workPackage?: WorkPackage
  operationPending: boolean
  operationError: Error | null
  onWorkPackageAction: (workPackageId: string, action: WorkPackageAction) => void
  onRefreshWorkPackage: (workPackageId: string) => void
}) {
  const content = (
    <>
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
      <Text type="secondary">{isLoading ? '正在查找执行记录' : hasError ? '执行记录暂不可用' : taskRun ? '查看当前执行记录' : '尚未开始'}</Text>
      {workPackage ? <WorkPackageActions workPackage={workPackage} disabled={operationPending} error={operationError} onAction={onWorkPackageAction} onRefresh={onRefreshWorkPackage} /> : null}
    </>
  )

  if (!onClick) return <div className={`${styles.flowCard} ${stage.status === 'RUNNING' ? styles.flowCardCurrent : ''}`}>{content}</div>
  return <div role="button" tabIndex={0} className={`${styles.flowCard} ${styles.flowCardButton} ${stage.status === 'RUNNING' ? styles.flowCardCurrent : ''}`} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick() }}>{content}</div>
}

function WorkPackageActions({
  workPackage,
  disabled,
  error,
  onAction,
  onRefresh,
}: {
  workPackage: WorkPackage
  disabled: boolean
  error: Error | null
  onAction: (workPackageId: string, action: WorkPackageAction) => void
  onRefresh: (workPackageId: string) => void
}) {
  const actions: Array<{ action: WorkPackageAction; label: string; danger?: boolean }> = [
    { action: 'start', label: '启动' },
    { action: 'pause', label: '暂停' },
    { action: 'resume', label: '恢复' },
    { action: 'cancel', label: '取消工作包', danger: true },
  ]
  return (
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Space wrap size={4}>
        {actions.filter(({ action }) => canWorkPackageAction(workPackage.status, action)).map(({ action, label, danger }) => (
          <Button key={action} size="small" danger={danger} disabled={disabled} onClick={() => onAction(workPackage.id, action)}>{label}</Button>
        ))}
      </Space>
      {error ? <WorkPackageOperationError workPackageId={workPackage.id} error={error} onRefresh={onRefresh} /> : null}
    </div>
  )
}

function WorkPackageOperationError({ workPackageId, error, onRefresh }: { workPackageId: string; error: Error; onRefresh: (workPackageId: string) => void }) {
  const status = error instanceof ApiError ? error.status : undefined
  const title = status === 403 ? '暂无工作包操作权限' : status === 404 ? '工作包不存在' : status === 409 ? '工作包状态已变化，请刷新最新状态' : status === 422 ? '请求不合法' : '操作失败，可再次尝试'
  return <Alert className={styles.executionAlert} type="error" showIcon title={title} action={status === 409 ? <Button type="link" size="small" onClick={() => onRefresh(workPackageId)}>刷新</Button> : undefined} />
}

type StageTaskRunQuery = { taskRuns: TaskRun[]; isError: boolean }

function isWorkPackageMutationPending(
  workPackageId: string | undefined,
  ...mutations: Array<{ isPending: boolean; variables?: string }>
): boolean {
  return Boolean(workPackageId && mutations.some((mutation) => mutation.isPending && mutation.variables === workPackageId))
}

function getWorkPackageMutationError(
  workPackageId: string | undefined,
  ...mutations: Array<{ error: Error | null; variables?: string }>
): Error | null {
  return workPackageId ? mutations.find((mutation) => mutation.variables === workPackageId)?.error ?? null : null
}

function WorkPackageTaskRunsProbe({
  projectId,
  workPackageId,
  onResult,
}: {
  projectId: string
  workPackageId: string
  onResult: (workPackageId: string, result: StageTaskRunQuery) => void
}) {
  const query = useInfiniteTaskRuns(projectId, workPackageId, { limit: 20 })
  const taskRuns = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data])

  useEffect(() => {
    if (!query.data && !query.isError) return
    onResult(workPackageId, { taskRuns, isError: query.isError })
  }, [onResult, query.data, query.isError, taskRuns, workPackageId])

  return null
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
        <InfoCard label="已交付物" value={deliverables.length > 0 ? deliverables.map((deliverable) => deliverable.title).join('、') : '暂无已交付物'} action />
        <InfoCard label="项目 Skill / Memory" value={summary?.skillMemorySummary ?? '暂无关联摘要'} action />
      </div>
    </section>
  )
}

function DevelopmentContext({
  workPackage,
}: {
  workPackage?: WorkPackage
}) {
  return (
    <section className={`${styles.section} ${styles.compactSection}`}>
      <div className={styles.sectionHeading}><Title level={4}>开发上下文</Title><Text type="secondary">只读</Text></div>
      {!workPackage ? <div className={styles.emptyCard}>当前暂无开发上下文</div> : (
        <div className={styles.developmentGrid}>
          <InfoCard label="目标仓库" value={workPackage.repositoryId} />
          <InfoCard label="基础分支" value={workPackage.baseRef} />
          <InfoCard label="工作分支" value={workPackage.headRef} />
          <InfoCard label="Workspace" value="暂无" />
          <InfoCard label="Sandbox" value="暂无" />
        </div>
      )}
    </section>
  )
}

function DeliverablesSummary({ query, deliverables, projectId, from }: { query: ReturnType<typeof useDeliverables>; deliverables: Deliverable[]; projectId: string; from: string }) {
  const navigate = useNavigate()
  return (
    <section className={`${styles.section} ${styles.compactSection}`}>
      <div className={styles.sectionHeading}><Title level={4}>交付产出</Title><Text type="secondary">仅展示摘要</Text></div>
      {query.isLoading ? <Spin /> : null}
      {query.isError ? <Alert type="warning" showIcon title="交付产出暂时无法加载" /> : null}
      {!query.isLoading && !query.isError && deliverables.length === 0 ? <div className={styles.emptyCard}>当前暂无交付产出</div> : null}
      <div className={styles.deliverableGrid}>
        {deliverables.map((deliverable) => (
          <div className={styles.deliverableCard} key={deliverable.id} role="button" tabIndex={0} onClick={() => navigate(PATHS.projectDeliverable(projectId, deliverable.id), { state: { from } })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(PATHS.projectDeliverable(projectId, deliverable.id), { state: { from } }) }}>
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

function SourcePanel({ run }: { run: OrchestrationRun }) {
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
      <Text type="secondary">暂无</Text>
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
