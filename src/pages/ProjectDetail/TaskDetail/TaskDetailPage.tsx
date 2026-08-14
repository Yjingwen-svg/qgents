import { Alert, Breadcrumb, Button, Card, Empty, Form, Input, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
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

  function handleBack() {
    navigate(resolveReturnPath(location.state, projectId, taskId))
  }

  function handleCancel() {
    if (!window.confirm('确认取消此任务？服务端将按安全检查点停止执行。')) return
    cancelMutation.mutate(currentTask.id, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) void taskQuery.refetch()
      },
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}><Breadcrumb items={[{ title: '任务中心' }, { title: '任务详情' }]} /></div>
      <div className={styles.detailToolbar}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>返回任务中心</Button>
        <Space>
          {canCancelTask(task.status) ? <Button danger loading={cancelMutation.isPending} disabled={cancelMutation.isPending} onClick={handleCancel}>取消任务</Button> : null}
          <Button onClick={() => navigate(PATHS.projectReqChat(projectId, task.requirementGroupId))}>返回需求群</Button>
        </Space>
      </div>
      {cancelMutation.error ? <CancelError error={cancelMutation.error} onRefresh={() => void taskQuery.refetch()} /> : null}
      <main className={styles.mainContent}>
        <header className={styles.taskHeader}>
          <div className={styles.detailTitleRow}><Title level={2} className={styles.title}><Text className={styles.summaryId}>任务 ID：{task.id}</Text>{display(task.title)}</Title><TaskModelStatusTag status={task.status} /></div>
          <div className={styles.summaryMeta}>
            <SummaryItem label="需求群" value={task.requirementGroupId} /><SummaryItem label="状态" value={task.status} /><SummaryItem label="发起人" value={task.createdBy} /><SummaryItem label="创建时间" value={formatDate(task.createdAt)} /><SummaryItem label="更新时间" value={formatDate(task.updatedAt)} />
          </div>
          <Paragraph>{display(task.requirement)}</Paragraph>
        </header>
        <WorkspaceCard task={task} />
        <TaskArtifactsSection projectId={projectId} taskId={task.id} query={artifactsQuery} />
        <TaskStepsSection projectId={projectId} taskId={task.id} query={stepsQuery} steps={steps} runsByStep={runsByStep} />
        <TaskRunsSummary query={runsQuery} runs={runs} />
        <TaskDiffSummary projectId={projectId} taskId={taskId} query={diffsQuery} />
        <TaskDiffReviewSection projectId={projectId} taskId={task.id} query={diffReviewQuery} enabled={reviewEnabled} onRequest={() => setReviewRequested(true)} onRefresh={() => { void diffReviewQuery.refetch(); void taskQuery.refetch() }} />
      </main>
    </div>
  )
}

function TaskArtifactsSection({ projectId, taskId, query }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskArtifacts> }) {
  const navigate = useNavigate()
  const artifacts = [...(query.data ?? [])].sort((left, right) => left.sequenceNo - right.sequenceNo)
  if (query.isLoading) return <Card title="执行产物"><Spin /></Card>
  if (query.isError) return <Card title="执行产物"><SectionError resource="执行产物" error={query.error} /></Card>
  if (artifacts.length === 0) return <Card title="执行产物"><Empty description="暂无执行产物" /></Card>
  return <Card title="执行产物时间线" className={styles.section}><Space direction="vertical" style={{ width: '100%' }}>{artifacts.map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} onRun={artifact.taskRunId ? () => navigate(PATHS.projectTaskRunDetail(projectId, taskId, artifact.taskRunId!)) : undefined} />)}</Space></Card>
}

function ArtifactRow({ artifact, onRun }: { artifact: TaskArtifact; onRun?: () => void }) {
  return <Card size="small" title={`#${artifact.sequenceNo} ${artifact.artifactType}`} extra={<Tag>{artifact.id}</Tag>}>
    <Space direction="vertical" size={3}><Text type="secondary">{formatDate(artifact.createdAt)}</Text>{renderArtifactSummary(artifact.summary)}{onRun ? <Button type="link" onClick={onRun}>查看关联 TaskRun：{artifact.taskRunId}</Button> : <Text type="secondary">该产物未关联 TaskRun</Text>}</Space>
  </Card>
}

function renderArtifactSummary(summary: Record<string, unknown>) {
  const entries = Object.entries(summary).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
  if (entries.length === 0) return <Text type="secondary">暂无摘要字段</Text>
  return <Space direction="vertical" size={0}>{entries.map(([key, value]) => <Text key={key}>{key}：{String(value)}</Text>)}</Space>
}

function TaskDiffReviewSection({ projectId, taskId, query, enabled, onRequest, onRefresh }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskDiffReview>; enabled: boolean; onRequest: () => void; onRefresh: () => void }) {
  if (!enabled) return <Card title="总 Diff 验收"><Button onClick={onRequest}>查看总 Diff 验收</Button></Card>
  if (query.isLoading) return <Card title="总 Diff 验收"><Spin /></Card>
  if (query.isError) {
    if (errorCode(query.error) === 'DIFF_REVIEW_NOT_FOUND') return <Card title="总 Diff 验收"><Empty description="最终 Diff 尚未生成" /></Card>
    return <Card title="总 Diff 验收"><SectionError resource="总 Diff 验收" error={query.error} /></Card>
  }
  if (!query.data || query.data.taskId !== taskId) return <Card title="总 Diff 验收"><Result status="404" title="总 Diff 批次不存在或不属于当前任务" /></Card>
  return <DiffReviewBatchPanel projectId={projectId} batch={query.data} onRefresh={onRefresh} />
}

function DiffReviewBatchPanel({ projectId, batch, onRefresh }: { projectId: string; batch: DiffReviewBatch; onRefresh: () => void }) {
  const navigate = useNavigate()
  const confirm = useConfirmTaskDiffReview(projectId)
  const reject = useRejectTaskDiffReview(projectId)
  const retry = useRetryTaskDiffReviewDelivery(projectId)
  const [reason, setReason] = useState('')
  const pending = confirm.isPending || reject.isPending || retry.isPending
  const error = confirm.error ?? reject.error ?? retry.error
  const canRetry = batch.reviewStatus === 'ACCEPTED' && (batch.deliveryStatus === 'PARTIALLY_DELIVERED' || batch.deliveryStatus === 'FAILED')
  return <Card title="总 Diff 验收" className={styles.section}><Space direction="vertical" style={{ width: '100%' }}>
    <Text>验收状态：{batch.reviewStatus}</Text><Text>总体交付状态：{batch.deliveryStatus}</Text><Text>aggregateHash：{batch.aggregateHash}</Text><Text>验收原因：{display(batch.reviewReason)}</Text>
    {batch.diffs.length === 0 ? <Empty description="批次暂无仓库 Diff 摘要" /> : batch.diffs.map((diff) => <Button key={diff.id} type="link" onClick={() => navigate(PATHS.projectDiff(projectId, diff.id))}>查看 Diff 摘要：{diff.id}</Button>)}
    <Text type="secondary">仓库级交付详情尚未提供</Text>
    {batch.reviewStatus === 'PENDING_CONFIRMATION' ? <Space direction="vertical" style={{ width: '100%' }}><Button type="primary" loading={confirm.isPending} disabled={pending} onClick={() => { if (window.confirm('确认整个 Diff 批次？')) confirm.mutate(batch.taskId, { onError: (mutationError) => { if (mutationError instanceof ApiError && mutationError.status === 409) onRefresh() } }) }}>确认总 Diff</Button><Form onFinish={() => { const trimmed = reason.trim(); if (trimmed) reject.mutate({ taskId: batch.taskId, input: { reason: trimmed } }, { onError: (mutationError) => { if (mutationError instanceof ApiError && mutationError.status === 409) onRefresh() } }) }}><Form.Item label="拒绝原因" required><Input.TextArea value={reason} maxLength={4000} onChange={(event) => setReason(event.target.value)} disabled={pending} /></Form.Item><Button danger htmlType="submit" loading={reject.isPending} disabled={pending || !reason.trim()}>拒绝总 Diff</Button></Form></Space> : canRetry ? <Button loading={retry.isPending} disabled={pending} onClick={() => retry.mutate(batch.taskId, { onError: (mutationError) => { if (mutationError instanceof ApiError && mutationError.status === 409) onRefresh() } })}>重试交付</Button> : <Text type="secondary">当前批次只读</Text>}
    {error ? <Alert type="error" showIcon message={diffReviewError(error)} action={error instanceof ApiError && error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} /> : null}
  </Space></Card>
}

function WorkspaceCard({ task }: { task: Task }) {
  return <Card title="Workspace" className={styles.section}>
    <Space direction="vertical" size={4}><Text>状态：{display(task.workspaceStatus)}</Text><Text>Workspace：{display(task.workspaceId)}</Text>{task.repositories.length === 0 ? <Text type="secondary">仓库：暂无</Text> : task.repositories.map((repository) => <div key={repository.repositoryId}><Text strong>{display(repository.repositoryId)}</Text><Text type="secondary"> · {display(repository.sourceBranch)} · base {display(repository.baseCommit)} · head {display(repository.headCommit)}</Text></div>)}</Space>
  </Card>
}

function TaskStepsSection({ projectId, taskId, query, steps, runsByStep }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskSteps>; steps: TaskStep[]; runsByStep: Map<string, TaskRunSummary> }) {
  const navigate = useNavigate()
  if (query.isLoading) return <Card title="TaskStep"><Spin /></Card>
  if (query.isError) return <Card title="TaskStep"><SectionError resource="TaskStep" error={query.error} /></Card>
  if (steps.length === 0) return <Card title="TaskStep"><Empty description="暂无 TaskStep" /></Card>
  return <Card title="TaskStep" className={styles.section}><Space direction="vertical" style={{ width: '100%' }}>{steps.map((step) => {
    const run = runsByStep.get(step.id)
    return <Card key={step.id} size="small" title={`${step.role} · ${display(step.id)}`} extra={<Tag>{step.status}</Tag>}>
      <Space direction="vertical" size={3}><Text>Agent：{display(step.agentId)}</Text><Text>依赖：{step.dependencies.length ? step.dependencies.join(', ') : '暂无'}</Text><Text>Testset：{step.testsetIds.length ? step.testsetIds.join(', ') : '暂无'}</Text><Text>验收说明：{display(step.acceptanceNotes)}</Text>{run ? <Button type="link" onClick={() => navigate(PATHS.projectTaskRunDetail(projectId, taskId, run.id))}>查看最新 TaskRun：{run.id}</Button> : <Text type="secondary">尚未运行</Text>}</Space>
    </Card>
  })}</Space></Card>
}

function TaskRunsSummary({ query, runs }: { query: ReturnType<typeof useTaskRuns>; runs: TaskRunSummary[] }) {
  if (query.isLoading) return <Card title="TaskRun"><Spin /></Card>
  if (query.isError) return <Card title="TaskRun"><SectionError resource="TaskRun" error={query.error} /></Card>
  if (runs.length === 0) return <Card title="TaskRun"><Empty description="暂无 TaskRun" /></Card>
  return <Card title="TaskRun" className={styles.section}><Space direction="vertical" style={{ width: '100%' }}>{runs.map((run) => <div key={run.id}><Text strong>{run.id}</Text><Text> · {run.role} · {display(run.agentId)} · {run.status} · step {run.taskStepId}</Text></div>)}</Space></Card>
}

function TaskDiffSummary({ projectId, taskId, query }: { projectId: string; taskId: string; query: ReturnType<typeof useDiffs> }) {
  const navigate = useNavigate()
  const diffs = query.data?.data ?? []
  if (query.isLoading) return <Card title="Diff"><Spin /></Card>
  if (query.isError) return <Card title="Diff"><SectionError resource="Diff" error={query.error} /></Card>
  return <Card title="Diff" className={styles.section}><Space direction="vertical"><Text>Diff 数量：{diffs.length}</Text>{diffs.length === 0 ? <Empty description="暂无可查看 Diff" /> : diffs.map((diff) => <Button key={diff.id} type="link" onClick={() => navigate(PATHS.projectDiff(projectId, diff.id), { state: { from: PATHS.projectTaskDetail(projectId, taskId) } })}>查看 Diff 摘要：{diff.id}</Button>)}<Button onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(taskId)}`)}>查看该任务全部 Diff</Button></Space></Card>
}

function groupLatestRuns(runs: TaskRunSummary[]): Map<string, TaskRunSummary> {
  const result = new Map<string, TaskRunSummary>()
  for (const run of runs) {
    const current = result.get(run.taskStepId)
    if (!current || run.updatedAt > current.updatedAt) result.set(run.taskStepId, run)
  }
  return result
}

function canCancelTask(status: Task['status']): boolean { return status === 'PLANNING' || status === 'PENDING' || status === 'RUNNING' }
function isDiffReviewTask(status: Task['status'] | undefined): boolean { return status === 'WAITING_DIFF_CONFIRMATION' || status === 'DELIVERING' || status === 'DELIVERY_FAILED' }
function errorCode(error: Error | null): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object' || !('error' in error.body)) return undefined
  const bodyError = (error.body as { error?: { code?: unknown } }).error
  return typeof bodyError?.code === 'string' ? bodyError.code : undefined
}
function diffReviewError(error: Error): string {
  const code = errorCode(error)
  if (code === 'DIFF_REVIEW_FORBIDDEN') return '暂无总 Diff 验收权限'
  if (code === 'DIFF_REVIEW_NOT_FOUND') return '最终 Diff 尚未生成'
  if (code === 'DIFF_REVIEW_NOT_DECIDABLE') return '总 Diff 状态已变化，请刷新后重试'
  if (code === 'DIFF_SNAPSHOT_STALE') return 'Diff 快照已变化，请刷新后重试'
  if (code === 'DIFF_DELIVERY_NOT_RETRYABLE') return '当前交付状态不可重试'
  if (code === 'IDEMPOTENCY_KEY_REUSED') return '请求已处理，请刷新批次状态'
  return '总 Diff 操作失败'
}
function display(value: string | null | undefined): string { return value?.trim() || '暂无' }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? display(value) : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function SummaryItem({ label, value }: { label: string; value: string }) { return <div className={styles.summaryMetaItem}><Text className={styles.label}>{label}</Text><Text className={styles.value}>{display(value)}</Text></div> }
function CancelError({ error, onRefresh }: { error: Error; onRefresh: () => void }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert className={styles.executionAlert} type="error" showIcon title={status === 409 ? '任务状态已变化，请刷新详情' : '取消任务失败'} action={status === 409 ? <Button type="link" onClick={onRefresh}>刷新</Button> : undefined} /> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon title={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
function DetailState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.page}><div className={styles.panelState}>{loading ? <Spin description={description} /> : <Result status="404" title={description} />}</div></div> }
function DetailError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.page}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function resolveReturnPath(state: unknown, projectId: string, taskId: string): string { const fallback = `${PATHS.projectTasks(projectId)}?taskId=${encodeURIComponent(taskId)}`; return state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith(PATHS.projectTasks(projectId)) ? state.from : fallback }
