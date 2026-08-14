import { Alert, Breadcrumb, Button, Empty, Form, Input, Result, Space, Spin, Tag, Typography } from 'antd'
import { ApartmentOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, CodeOutlined, DatabaseOutlined, FileTextOutlined, LinkOutlined, NodeIndexOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ApiError } from '@/api'
import { useCancelTask, useConfirmTaskDiffReview, useDiffs, useRejectTaskDiffReview, useRetryTaskDiffReviewDelivery, useTask, useTaskArtifacts, useTaskDiffReview, useTaskRuns, useTaskSteps } from '@/hooks/task-model'
import type { DiffReviewBatch, Task, TaskArtifact, TaskRunSummary, TaskStep } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { TaskModelStatusTag } from '../TaskCenter/TaskModelStatusTag'
import styles from './TaskDetailPage.module.scss'

const { Paragraph, Text, Title } = Typography

export function TaskDetailPage() {
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const taskQuery = useTask(projectId, taskId)
  const artifactsQuery = useTaskArtifacts(projectId, taskId)
  const [reviewRequested, setReviewRequested] = useState(false)
  const reviewEnabled = reviewRequested || isDiffReviewTask(taskQuery.data?.status)
  const diffReviewQuery = useTaskDiffReview(projectId, taskId, reviewEnabled)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const runsQuery = useTaskRuns(projectId, taskId, { limit: 100 })
  const cancelMutation = useCancelTask(projectId)
  const diffsQuery = useDiffs(projectId, { taskId, limit: 100 })
  const steps = stepsQuery.data?.data ?? []
  const runs = runsQuery.data?.data ?? []
  const runsByStep = groupLatestRuns(runs)

  if (taskQuery.isLoading) return <DetailState loading description="正在加载任务详情" />
  if (taskQuery.isError) return <DetailError error={taskQuery.error} resource="任务详情" />
  const task = taskQuery.data
  if (!task || task.projectId !== projectId || task.id !== taskId) return <DetailState description="任务不存在或不可见" />
  const currentTask = task

  function handleBack() { navigate(resolveReturnPath(location.state, projectId, taskId)) }
  function handleCancel() {
    if (!window.confirm('确认取消此任务？服务端将按安全检查点停止执行。')) return
    cancelMutation.mutate(currentTask.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) void taskQuery.refetch() } })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}><Breadcrumb items={[{ title: '任务中心' }, { title: '任务详情' }]} /></div>
      <div className={styles.detailToolbar}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>返回任务中心</Button>
        <Space className={styles.topBarActions} wrap>
          {task.requirementGroup ? <Button onClick={() => navigate(PATHS.projectReqChat(projectId, task.requirementGroup!.id))}>返回需求群</Button> : null}
          <Button type="primary" onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(task.id)}`)}>查看总 Diff</Button>
          {task.capabilities.canCancel ? <Button danger loading={cancelMutation.isPending} disabled={cancelMutation.isPending} onClick={handleCancel}>取消任务</Button> : null}
        </Space>
      </div>
      {cancelMutation.error ? <CancelError error={cancelMutation.error} onRefresh={() => void taskQuery.refetch()} /> : null}
      <main className={styles.contentGrid}>
        <div className={styles.mainContent}>
          <TaskSummaryHeader task={task} />
          <TaskStepsSection projectId={projectId} taskId={task.id} query={stepsQuery} steps={steps} runsByStep={runsByStep} />
          <TaskSharedContext task={task} />
          <WorkspaceCard task={task} />
          <TaskArtifactsSection projectId={projectId} taskId={task.id} query={artifactsQuery} />
          <TaskDiffSummary projectId={projectId} taskId={taskId} query={diffsQuery} />
          <TaskDiffReviewSection projectId={projectId} taskId={task.id} query={diffReviewQuery} enabled={reviewEnabled} onRequest={() => setReviewRequested(true)} onRefresh={() => { void diffReviewQuery.refetch(); void taskQuery.refetch() }} />
        </div>
        <TaskSideContent task={task} steps={steps} />
      </main>
    </div>
  )
}

function TaskSummaryHeader({ task }: { task: Task }) {
  const summary = task.executionSummary
  return <header className={styles.taskHeader}>
    <div className={styles.detailTitleRow}><div className={styles.titleGroup}><Text className={styles.summaryId}>{task.displayCode}</Text><Title level={2} className={styles.title}>{display(task.title)}</Title></div><TaskModelStatusTag status={task.status} /></div>
    <div className={styles.summaryMeta}>
      <SummaryItem label="所属需求群" value={task.requirementGroup?.name} />
      <SummaryItem label="交付模式" value={task.deliveryMode} />
      <SummaryItem label="执行阶段" value={summary.currentStageTitle ?? summary.currentStage} />
      <SummaryItem label="发起人" value={task.createdByUser?.displayName} />
      <SummaryItem label="创建时间" value={formatDate(task.createdAt)} />
      <SummaryItem label="更新时间" value={formatDate(task.updatedAt)} />
    </div>
    {task.attention ? <Alert className={styles.headerAttention} type="warning" showIcon message={task.attention.title} description={task.attention.summary} /> : null}
  </header>
}

function TaskStepsSection({ projectId, taskId, query, steps, runsByStep }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskSteps>; steps: TaskStep[]; runsByStep: Map<string, TaskRunSummary> }) {
  const navigate = useNavigate()
  if (query.isLoading) return <SectionCard title="执行流程"><Spin /></SectionCard>
  if (query.isError) return <SectionCard title="执行流程"><SectionError resource="TaskStep" error={query.error} /></SectionCard>
  if (steps.length === 0) return <SectionCard title="执行流程"><Empty description="暂无 TaskStep" /></SectionCard>
  const ordered = steps.slice().sort((left, right) => left.sequenceNo - right.sequenceNo)
  return <section className={styles.flowSection}><div className={styles.sectionHeading}><Title level={4}>执行流程</Title><Text type="secondary">{ordered.length} 个步骤</Text></div><div className={styles.flowGrid}>{ordered.map((step) => {
    const run = runsByStep.get(step.id)
    return <div className={`${styles.flowCard} ${step.status === 'RUNNING' ? styles.flowCardCurrent : ''}`} key={step.id}>
      <div className={styles.flowCardHeading}><span className={styles.flowIcon}><NodeIndexOutlined /></span><div><Text className={styles.flowSequence}>{step.sequenceNo}</Text><Text strong className={styles.flowTitle}>{display(step.title)}</Text></div><Tag>{step.status}</Tag></div>
      <div className={styles.flowDetails}><Text>角色：{step.role}</Text><Text>Agent：{display(step.agent?.name)}</Text><Text>仓库：{display(step.repository?.name)}{step.repository?.sourceBranch ? ` / ${step.repository.sourceBranch}` : ''}</Text><Text>验收说明：{display(step.acceptanceNotes)}</Text><Text>运行 {step.runCount} 次 · {formatDate(step.startedAt)} - {formatDate(step.finishedAt)}</Text></div>
      {step.dependencies.length > 0 ? <Text type="secondary" className={styles.flowDependency}>依赖：{step.dependencies.join('、')}</Text> : null}
      <div className={styles.flowFooter}>{run ? <Button type="link" onClick={() => navigate(PATHS.projectTaskRunDetail(projectId, taskId, run.id))}>查看最新 TaskRun：{run.id}</Button> : <Text type="secondary">尚未运行</Text>}<ArrowRightOutlined /></div>
    </div>
  })}</div></section>
}

function TaskSharedContext({ task }: { task: Task }) {
  return <section className={styles.section}><div className={styles.sectionHeading}><Title level={4}>共享上下文</Title></div><div className={styles.contextGrid}>
    <InfoCard icon={<FileTextOutlined />} title="完整需求" value={task.requirement} />
    <InfoCard icon={<CheckCircleOutlined />} title="验收标准" value={task.acceptanceCriteria.length > 0 ? task.acceptanceCriteria.map((criterion) => criterion.title).join('、') : '暂无验收标准'} />
    <InfoCard icon={<LinkOutlined />} title="来源消息" value={task.sourceMessage?.textExcerpt ?? '暂无来源消息'} />
    <InfoCard icon={<ApartmentOutlined />} title="Artifact 摘要" value={task.artifactSummary.total > 0 ? `${task.artifactSummary.total} 个产物` : '暂无执行产物'} />
    <InfoCard icon={<CodeOutlined />} title="DiffReview 摘要" value={task.diffReviewSummary.available ? `${task.diffReviewSummary.reviewStatus ?? '暂无'} / ${task.diffReviewSummary.deliveryStatus ?? '暂无'}` : '暂无总 Diff'} />
  </div></section>
}

function TaskSideContent({ task, steps }: { task: Task; steps: TaskStep[] }) {
  const agents = [...new Map(steps.flatMap((step) => step.agent ? [[step.agent.id, step.agent]] : [])).values()]
  const checklist = steps.reduce((result, step) => { const key = step.status === 'SUCCEEDED' ? '已完成' : step.status === 'FAILED' ? '失败' : step.status === 'RUNNING' ? '进行中' : '待处理'; result.set(key, (result.get(key) ?? 0) + 1); return result }, new Map<string, number>())
  return <aside className={styles.sideContent}>
    <div className={styles.sideCard}><div className={styles.sideHeader}><Title level={5}>来源信息</Title></div><Text type="secondary">需求描述</Text><Paragraph className={styles.sideDescription}>{display(task.requirement)}</Paragraph><SummaryItem label="需求群" value={task.requirementGroup?.name} /><SummaryItem label="Workspace" value={task.workspace?.id} /></div>
    <div className={styles.sideCard}><div className={styles.sideHeader}><Title level={5}>执行清单</Title></div>{checklist.size > 0 ? [...checklist.entries()].map(([label, count]) => <div className={styles.checklistItem} key={label}><span className={styles.checklistLabel}>{label}</span><Text strong>{count}</Text></div>) : <Empty description="暂无执行步骤" />}</div>
    <div className={styles.sideCard}><div className={styles.sideHeader}><Title level={5}>参与 Agent</Title></div>{agents.length > 0 ? agents.map((agent) => <div className={styles.agentRow} key={agent.id}><UserOutlined /><span>{agent.name}</span><Tag>{agent.role}</Tag></div>) : <Empty description="暂无 Agent 分配" />}</div>
    <div className={styles.sideCard}><div className={styles.sideHeader}><Title level={5}>当前待处理事项</Title></div>{task.attention ? <Alert type="warning" showIcon message={task.attention.title} description={task.attention.summary} /> : <Text type="secondary">暂无待处理事项</Text>}</div>
    <div className={styles.sideTaskId}>任务 ID：{task.displayCode}</div>
  </aside>
}

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) { return <div className={styles.infoCard}><span className={styles.infoIcon}>{icon}</span><Text strong>{title}</Text><Text type="secondary" className={styles.infoValue}>{display(value)}</Text></div> }

function TaskArtifactsSection({ projectId, taskId, query }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskArtifacts> }) {
  const navigate = useNavigate()
  const artifacts = [...(query.data ?? [])].sort((left, right) => left.sequenceNo - right.sequenceNo)
  if (query.isLoading) return <SectionCard title="交付产出"><Spin /></SectionCard>
  if (query.isError) return <SectionCard title="交付产出"><SectionError resource="执行产物" error={query.error} /></SectionCard>
  if (artifacts.length === 0) return <SectionCard title="交付产出"><Empty description="暂无执行产物" /></SectionCard>
  return <section className={styles.section}><div className={styles.sectionHeading}><Title level={4}>交付产出</Title><Text type="secondary">Artifact 时间线</Text></div><div className={styles.artifactTimeline}>{artifacts.map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} onRun={artifact.taskRunId ? () => navigate(PATHS.projectTaskRunDetail(projectId, taskId, artifact.taskRunId!)) : undefined} />)}</div></section>
}

function ArtifactRow({ artifact, onRun }: { artifact: TaskArtifact; onRun?: () => void }) {
  return <div className={styles.artifactRow}><div className={styles.artifactMarker}>{artifact.sequenceNo}</div><div className={styles.artifactBody}><div className={styles.artifactHeader}><Text strong>{artifact.title}</Text><Tag color={artifact.status === 'SUCCEEDED' ? 'green' : artifact.status === 'FAILED' ? 'red' : undefined}>{artifact.status ?? artifact.artifactType}</Tag></div><Text type="secondary">{display(artifact.description)}</Text>{renderArtifactSummary(artifact.summary)}{artifact.resources.length > 0 ? <Text type="secondary">资源：{artifact.resources.map((resource) => resource.title).join('、')}</Text> : null}{onRun ? <Button type="link" onClick={onRun}>查看关联 TaskRun：{artifact.taskRunId}</Button> : <Text type="secondary">该产物未关联 TaskRun</Text>}</div></div>
}

function renderArtifactSummary(summary: Record<string, unknown>) { const entries = Object.entries(summary).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)); if (entries.length === 0) return <Text type="secondary">暂无摘要字段</Text>; return <div className={styles.artifactSummary}>{entries.map(([key, value]) => <Text key={key}>{key}：{String(value)}</Text>)}</div> }

function TaskDiffReviewSection({ projectId, taskId, query, enabled, onRequest, onRefresh }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskDiffReview>; enabled: boolean; onRequest: () => void; onRefresh: () => void }) {
  if (!enabled) return <SectionCard title="总 Diff 验收"><Button onClick={onRequest}>查看总 Diff 验收</Button></SectionCard>
  if (query.isLoading) return <SectionCard title="总 Diff 验收"><Spin /></SectionCard>
  if (query.isError) { if (errorCode(query.error) === 'DIFF_REVIEW_NOT_FOUND') return <SectionCard title="总 Diff 验收"><Empty description="最终 Diff 尚未生成" /></SectionCard>; return <SectionCard title="总 Diff 验收"><SectionError resource="总 Diff 验收" error={query.error} /></SectionCard> }
  if (!query.data || query.data.taskId !== taskId) return <SectionCard title="总 Diff 验收"><Result status="404" title="总 Diff 批次不存在或不属于当前任务" /></SectionCard>
  return <DiffReviewBatchPanel projectId={projectId} batch={query.data} onRefresh={onRefresh} />
}

function DiffReviewBatchPanel({ projectId, batch, onRefresh }: { projectId: string; batch: DiffReviewBatch; onRefresh: () => void }) {
  const navigate = useNavigate(); const confirm = useConfirmTaskDiffReview(projectId); const reject = useRejectTaskDiffReview(projectId); const retry = useRetryTaskDiffReviewDelivery(projectId); const [reason, setReason] = useState(''); const pending = confirm.isPending || reject.isPending || retry.isPending; const error = confirm.error ?? reject.error ?? retry.error; const canRetry = batch.reviewStatus === 'ACCEPTED' && (batch.deliveryStatus === 'PARTIALLY_DELIVERED' || batch.deliveryStatus === 'FAILED')
  const handleError = (mutationError: Error) => { if (mutationError instanceof ApiError && mutationError.status === 409) onRefresh() }
  return <section className={styles.section}><div className={styles.sectionHeading}><Title level={4}>总 Diff 验收</Title><Tag>{batch.reviewStatus}</Tag></div><div className={styles.reviewSummary}><SummaryItem label="总体交付状态" value={batch.deliveryStatus} /><SummaryItem label="aggregateHash" value={batch.aggregateHash} /><SummaryItem label="验收原因" value={batch.reviewReason} /></div><div className={styles.repositoryDeliveries}>{batch.repositoryDeliveries.length > 0 ? batch.repositoryDeliveries.map((delivery) => <div className={styles.deliveryRow} key={delivery.repositoryId}><div><Text strong>{delivery.repositoryName}</Text><Text type="secondary">{delivery.diffId ? ` · Diff ${delivery.diffId}` : ''}</Text></div><div><Tag color={delivery.deliveryStatus === 'FAILED' ? 'red' : 'green'}>{delivery.deliveryStatus}</Tag>{delivery.failureReason ? <Text type="danger">{delivery.failureReason}</Text> : null}{delivery.mergeRequest?.webUrl ? <a href={delivery.mergeRequest.webUrl} target="_blank" rel="noreferrer">查看 MR</a> : null}</div></div>) : <Text type="secondary">仓库级交付详情尚未提供</Text>}</div>{batch.diffs.length > 0 ? <div className={styles.diffLinks}>{batch.diffs.map((diff) => <Button key={diff.id} type="link" onClick={() => navigate(PATHS.projectDiff(projectId, diff.id))}>查看 Diff 摘要：{diff.id}</Button>)}</div> : <Empty description="批次暂无仓库 Diff 摘要" />}{batch.reviewStatus === 'PENDING_CONFIRMATION' ? <Space direction="vertical" style={{ width: '100%' }}><Button type="primary" loading={confirm.isPending} disabled={pending} onClick={() => { if (window.confirm('确认整个 Diff 批次？')) confirm.mutate(batch.taskId, { onError: handleError }) }}>确认总 Diff</Button><Form onFinish={() => { const trimmed = reason.trim(); if (trimmed) reject.mutate({ taskId: batch.taskId, input: { reason: trimmed } }, { onError: handleError }) }}><Form.Item label="拒绝原因" required><Input.TextArea value={reason} maxLength={4000} onChange={(event) => setReason(event.target.value)} disabled={pending} /></Form.Item><Button danger htmlType="submit" loading={reject.isPending} disabled={pending || !reason.trim()}>拒绝总 Diff</Button></Form></Space> : canRetry ? <Button loading={retry.isPending} disabled={pending} onClick={() => retry.mutate(batch.taskId, { onError: handleError })}>重试交付</Button> : <Text type="secondary">当前批次只读</Text>}{error ? <Alert type="error" showIcon message={diffReviewError(error)} action={error instanceof ApiError && error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} /> : null}</section>
}

function WorkspaceCard({ task }: { task: Task }) {
  return <section className={styles.section}><div className={styles.sectionHeading}><Title level={4}>开发上下文</Title><Text type="secondary">Workspace 与仓库</Text></div><div className={styles.developmentGrid}>{task.workspace ? <InfoCard icon={<DatabaseOutlined />} title="Workspace" value={task.workspace.status} /> : <InfoCard icon={<DatabaseOutlined />} title="Workspace" value="暂无 Workspace 数据" />}{task.repositories.length > 0 ? task.repositories.map((repository) => <InfoCard key={repository.repositoryId} icon={<CodeOutlined />} title={repository.name} value={`${repository.defaultBranch} / base ${repository.baseRef} / ${repository.sourceBranch} / ${repository.baseCommit} → ${display(repository.headCommit)}`} />) : <InfoCard icon={<DatabaseOutlined />} title="仓库" value="暂无仓库数据" />}</div></section>
}

function TaskDiffSummary({ projectId, taskId, query }: { projectId: string; taskId: string; query: ReturnType<typeof useDiffs> }) {
  const navigate = useNavigate(); const diffs = query.data?.data ?? []
  if (query.isLoading) return <SectionCard title="Diff 摘要"><Spin /></SectionCard>
  if (query.isError) return <SectionCard title="Diff 摘要"><SectionError resource="Diff" error={query.error} /></SectionCard>
  return <section className={styles.section}><div className={styles.sectionHeading}><Title level={4}>Diff 摘要</Title><Text type="secondary">{diffs.length} 个 Diff</Text></div>{diffs.length === 0 ? <Empty description="暂无可查看 Diff" /> : <div className={styles.diffLinks}>{diffs.map((diff) => <Button key={diff.id} type="link" onClick={() => navigate(PATHS.projectDiff(projectId, diff.id), { state: { from: PATHS.projectTaskDetail(projectId, taskId) } })}>查看 Diff 摘要：{diff.id}</Button>)}</div>}<Button onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(taskId)}`)}>查看该任务全部 Diff</Button></section>
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.section}><div className={styles.sectionHeading}><Title level={4}>{title}</Title></div>{children}</section> }
function groupLatestRuns(runs: TaskRunSummary[]): Map<string, TaskRunSummary> { const result = new Map<string, TaskRunSummary>(); for (const run of runs) { const current = result.get(run.taskStepId); if (!current || run.updatedAt > current.updatedAt) result.set(run.taskStepId, run) } return result }
function isDiffReviewTask(status: Task['status'] | undefined): boolean { return status === 'WAITING_DIFF_CONFIRMATION' || status === 'DELIVERING' || status === 'DELIVERY_FAILED' }
function errorCode(error: Error | null): string | undefined { if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object' || !('error' in error.body)) return undefined; const bodyError = (error.body as { error?: { code?: unknown } }).error; return typeof bodyError?.code === 'string' ? bodyError.code : undefined }
function diffReviewError(error: Error): string { const code = errorCode(error); if (code === 'DIFF_REVIEW_FORBIDDEN') return '暂无总 Diff 验收权限'; if (code === 'DIFF_REVIEW_NOT_FOUND') return '最终 Diff 尚未生成'; if (code === 'DIFF_REVIEW_NOT_DECIDABLE') return '总 Diff 状态已变化，请刷新后重试'; if (code === 'DIFF_SNAPSHOT_STALE') return 'Diff 快照已变化，请刷新后重试'; if (code === 'DIFF_DELIVERY_NOT_RETRYABLE') return '当前交付状态不可重试'; if (code === 'IDEMPOTENCY_KEY_REUSED') return '请求已处理，请刷新批次状态'; return '总 Diff 操作失败' }
function display(value: string | null | undefined): string { return value?.trim() || '暂无' }
function formatDate(value: string | null | undefined): string { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? display(value) : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) { return <div className={styles.summaryMetaItem}><Text className={styles.label}>{label}</Text><Text className={styles.value}>{display(value)}</Text></div> }
function CancelError({ error, onRefresh }: { error: Error; onRefresh: () => void }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert className={styles.executionAlert} type="error" showIcon message={status === 409 ? '任务状态已变化，请刷新详情' : '取消任务失败'} action={status === 409 ? <Button type="link" onClick={onRefresh}>刷新</Button> : undefined} /> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon message={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
function DetailState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.page}><div className={styles.panelState}>{loading ? <Spin description={description} /> : <Result status="404" title={description} />}</div></div> }
function DetailError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.page}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function resolveReturnPath(state: unknown, projectId: string, taskId: string): string { const fallback = `${PATHS.projectTasks(projectId)}?taskId=${encodeURIComponent(taskId)}`; return state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith(PATHS.projectTasks(projectId)) ? state.from : fallback }
