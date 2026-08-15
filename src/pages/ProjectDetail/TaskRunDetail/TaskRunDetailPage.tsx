import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Breadcrumb, Button, Card, Input, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CodeOutlined, CopyOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useApproveTaskRunInputRequest, useCancelTaskRunModel, useRejectTaskRunInputRequest, useReplyTaskRunInputRequest, useRetryTaskRunModel, useTask, useTaskRun, useTaskRunExecutionContext, useTaskRunInputRequests, useTaskRunLogs, useTaskSteps } from '@/hooks/task-model'
import type { InputRequest, TaskRunDetail, TaskRunLog, TaskRunStep } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { isInputRequestReadOnly, type InputRequestAction } from '@/utils/inputRequestActions'
import styles from './TaskRunDetailPage.module.scss'

const { Text, Title } = Typography

export function TaskRunDetailPage() {
  const { projectId = '', taskId = '', taskRunId = '' } = useParams<{ projectId: string; taskId: string; taskRunId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const taskQuery = useTask(projectId, taskId)
  const runQuery = useTaskRun(projectId, taskRunId)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const [logCursor, setLogCursor] = useState<string | undefined>()
  const [logEntries, setLogEntries] = useState<TaskRunLog[]>([])
  const logsQuery = useTaskRunLogs(projectId, taskRunId, { limit: 100, cursor: logCursor })
  const contextQuery = useTaskRunExecutionContext(projectId, taskRunId)
  const inputRequestsQuery = useTaskRunInputRequests(projectId, taskRunId, { limit: 100 })
  const retryMutation = useRetryTaskRunModel(projectId)
  const cancelMutation = useCancelTaskRunModel(projectId)
  const taskRun = runQuery.data
  const taskStep = useMemo(() => taskRun && stepsQuery.data?.data.find((step) => step.id === taskRun.taskStepId), [stepsQuery.data, taskRun])

  useEffect(() => {
    setLogCursor(undefined)
    setLogEntries([])
  }, [taskRunId])

  useEffect(() => {
    const incoming = logsQuery.data?.data
    if (!incoming) return
    setLogEntries((previous) => {
      if (!logCursor) return incoming
      const merged = new Map(previous.map((log) => [log.id, log]))
      incoming.forEach((log) => merged.set(log.id, log))
      return [...merged.values()]
    })
  }, [logCursor, logsQuery.data])

  if (taskQuery.isLoading || runQuery.isLoading) return <PageState loading description="正在加载执行详情" />
  if (taskQuery.isError) return <PageError error={taskQuery.error} resource="任务" />
  if (runQuery.isError) return <PageError error={runQuery.error} resource="TaskRun" />
  if (!taskQuery.data || taskQuery.data.id !== taskId || taskQuery.data.projectId !== projectId) return <PageState description="任务不存在或不可见" />
  if (!taskRun || taskRun.taskId !== taskId) return <PageState description="TaskRun 不属于当前任务或不可见" />
  const currentTaskRun = taskRun

  function back() {
    navigate(resolveReturnPath(location.state, projectId, taskId))
  }

  function retry() {
    if (!window.confirm('确认重试此执行记录？原运行将保留。')) return
    retryMutation.mutate(currentTaskRun.id, {
      onSuccess: (next) => navigate(PATHS.projectTaskRunDetail(projectId, taskId, next.id), { state: { from: location.state && typeof location.state === 'object' && 'from' in location.state ? location.state.from : undefined } }),
      onError: (error) => { if (error instanceof ApiError && error.status === 409) void runQuery.refetch() },
    })
  }

  function cancel() {
    if (!window.confirm('确认取消此执行记录？')) return
    cancelMutation.mutate(currentTaskRun.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) void runQuery.refetch() } })
  }

  function locate(id: string) {
    const target = document.getElementById(id)
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const pendingRequests = inputRequestsQuery.data?.data.filter((request) => request.status === 'PENDING') ?? []
  return (
    <div className={styles.page}>
      <div className={styles.topBar}><Breadcrumb items={[{ title: '任务中心' }, { title: taskQuery.data.title }, { title: '执行详情' }]} /></div>
       <RunSummaryHeader taskRun={currentTaskRun} taskStep={taskStep} onBack={back} onRetry={retry} onCancel={cancel} retryPending={retryMutation.isPending} cancelPending={cancelMutation.isPending} />
      <RunAttentionBanner taskRun={currentTaskRun} pendingRequest={pendingRequests[0]} onLocate={locate} onRetry={retry} />
      <main className={styles.workspace}>
        <div className={styles.mainColumn}>
          <RunStepTimeline steps={currentTaskRun.steps ?? []} />
          <RunLogConsole query={logsQuery} entries={logEntries} onLoadMore={() => { const nextCursor = logsQuery.data?.page.nextCursor; if (nextCursor) setLogCursor(nextCursor) }} />
        </div>
        <aside className={styles.aside}>
          <PendingInputRequests projectId={projectId} taskRunId={currentTaskRun.id} query={inputRequestsQuery} onRefresh={() => void inputRequestsQuery.refetch()} />
          <ExecutionContextCard query={contextQuery} />
          <RunResultCard projectId={projectId} taskId={taskId} taskRun={currentTaskRun} />
        </aside>
      </main>
    </div>
  )
}

function RunSummaryHeader({ taskRun, taskStep, onBack, onRetry, onCancel, retryPending, cancelPending }: { taskRun: TaskRunDetail; taskStep?: import('@/types/task-model').TaskStep; onBack: () => void; onRetry: () => void; onCancel: () => void; retryPending: boolean; cancelPending: boolean }) {
  const title = taskRun.taskStepTitle || taskStep?.title || roleLabel(taskRun.role) || shortId(taskRun.id)
  const canRetry = taskRun.status === 'FAILED' || taskRun.status === 'CANCELLED' || taskRun.status === 'BLOCKED'
  const canCancel = ['QUEUED', 'RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED', 'CANCELLING'].includes(taskRun.status)
  return (
    <header className={styles.summaryHeader} data-testid="run-summary-header">
      <div className={styles.summaryPrimary}><Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={onBack}>返回任务详情</Button><Text className={styles.runId}>{shortId(taskRun.id)}</Text><Title level={2} className={styles.runTitle}>{title}</Title><Button type="text" size="small" icon={<CopyOutlined />} aria-label="复制 TaskRun ID" title="复制 TaskRun ID" onClick={() => void navigator.clipboard?.writeText(taskRun.id)} /><Tag>{taskRun.status}</Tag><div className={styles.summaryActions}>{canRetry ? <Button size="small" onClick={onRetry} loading={retryPending} disabled={retryPending || cancelPending}>重试</Button> : null}{canCancel ? <Button size="small" danger onClick={onCancel} loading={cancelPending} disabled={retryPending || cancelPending}>取消</Button> : null}</div></div>
      <div className={styles.summaryMeta}><MetaItem label="Agent" value={taskRun.agent?.name} /><MetaItem label="角色" value={roleLabel(taskRun.role)} /><MetaItem label="仓库" value={taskStep?.repository?.name} /><MetaItem label="开始" value={formatDate(taskRun.startedAt)} /><MetaItem label="结束" value={formatDate(taskRun.finishedAt)} /><MetaItem label="耗时" value={formatDuration(taskRun.durationMs)} />{taskRun.retryOfTaskRunId ? <MetaItem label="重试自" value={shortId(taskRun.retryOfTaskRunId)} /> : null}</div>
    </header>
  )
}

function RunAttentionBanner({ taskRun, pendingRequest, onLocate, onRetry }: { taskRun: TaskRunDetail; pendingRequest?: InputRequest; onLocate: (id: string) => void; onRetry: () => void }) {
  const reason = taskRun.statusReason
  const waiting = taskRun.status === 'WAITING_INPUT' || taskRun.status === 'WAITING_APPROVAL'
  const visible = Boolean(reason || pendingRequest || waiting || taskRun.status === 'FAILED' || taskRun.status === 'BLOCKED')
  if (!visible) return null
  const title = reason?.title ?? (pendingRequest ? '待处理请求' : taskRun.status === 'FAILED' ? '运行失败' : taskRun.status === 'BLOCKED' ? '运行受阻' : '等待用户操作')
  const summary = reason?.summary ?? pendingRequest?.prompt ?? (taskRun.status === 'FAILED' ? '可查看日志或重试本次运行。' : taskRun.status === 'BLOCKED' ? '请查看日志和执行状态。' : '请在右侧完成待处理操作。')
  const action = pendingRequest ? <Button size="small" onClick={() => onLocate('pending-input-requests')}>处理请求</Button> : taskRun.status === 'FAILED' || taskRun.status === 'BLOCKED' ? <Space><Button size="small" onClick={() => onLocate('run-log-console')}>查看日志</Button>{reason?.retryable ? <Button size="small" onClick={onRetry}>重试</Button> : null}</Space> : <Button size="small" onClick={() => onLocate('pending-input-requests')}>定位处理区</Button>
  return <section className={styles.attentionBanner} data-testid="run-attention-banner"><Alert type="warning" showIcon title={<span>{title}{reason?.retryable ? <Tag color="green">可重试</Tag> : null}</span>} description={<span>{summary}{reason?.occurredAt ? ` · ${formatDate(reason.occurredAt)}` : ''}</span>} action={action} /></section>
}

function RunStepTimeline({ steps }: { steps: TaskRunStep[] }) {
  return <section className={styles.timelineSection} data-testid="run-step-timeline"><SectionHeading title="执行轨迹" meta={steps.length > 0 ? `${steps.length} 个内部步骤` : undefined} />{steps.length === 0 ? <InlineState text="当前执行器未返回内部步骤" /> : <div className={styles.timelineScroller}><div className={styles.timelineGrid}>{steps.map((step, index) => <article className={styles.timelineStep} key={`${step.node}-${step.startedAt ?? index}`}><div className={styles.timelineStepHeading}><span className={styles.timelineIndex}>{index + 1}</span><Text strong>{step.node}</Text><Tag>{step.status}</Tag></div><Text type="secondary">{formatDate(step.startedAt)} → {formatDate(step.finishedAt)}</Text><Text type="secondary">耗时 {formatDuration(step.durationMs)}</Text><Text type={step.errorCode ? 'danger' : 'secondary'} ellipsis>{step.errorCode ? `错误：${step.errorCode}` : `结果：${step.status}`}</Text></article>)}</div></div>}</section>
}

function RunLogConsole({ query, entries, onLoadMore }: { query: ReturnType<typeof useTaskRunLogs>; entries: TaskRunLog[]; onLoadMore: () => void }) {
  const consoleRef = useRef<HTMLDivElement>(null)
  const canLoadMore = Boolean(query.data?.page.hasMore && query.data.page.nextCursor)
  return <section className={styles.logSection} id="run-log-console" data-testid="run-log-console"><SectionHeading title="运行日志" meta={query.isFetching && !query.isLoading ? '刷新中' : undefined} />{query.isLoading ? <div className={styles.logState}><Spin /></div> : query.isError ? <SectionError resource="Logs" error={query.error} /> : entries.length === 0 ? <InlineState text="暂无日志" /> : <div className={styles.logPanel} ref={consoleRef}><div className={styles.logRows}>{entries.map((log) => <div className={styles.logRow} key={log.id}><span className={styles.logSequence}>{log.sequence}</span><time>{formatDate(log.timestamp)}</time><span className={styles.logNode}>{log.node}</span><code>{log.content}</code></div>)}</div>{canLoadMore ? <Button size="small" onClick={onLoadMore} loading={query.isFetching}>加载更多日志</Button> : null}</div>}</section>
}

function PendingInputRequests({ projectId, taskRunId, query, onRefresh }: { projectId: string; taskRunId: string; query: ReturnType<typeof useTaskRunInputRequests>; onRefresh: () => void }) {
  if (query.isLoading) return null
  if (query.isError) return <section className={styles.sideCard} id="pending-input-requests" data-testid="pending-input-requests"><SectionHeading title="待处理请求" /><SectionError resource="Input Requests" error={query.error} /></section>
  const requests = query.data?.data ?? []
  if (requests.length === 0) return null
  return <section className={styles.sideCard} id="pending-input-requests" data-testid="pending-input-requests"><SectionHeading title="待处理请求" meta={`${requests.filter((request) => request.status === 'PENDING').length} 个待处理`} /><div className={styles.requestList}>{requests.map((request) => <InputRequestCard key={request.id} projectId={projectId} taskRunId={taskRunId} request={request} onRefresh={onRefresh} />)}</div></section>
}

function InputRequestCard({ projectId, taskRunId, request, onRefresh }: { projectId: string; taskRunId: string; request: InputRequest; onRefresh: () => void }) {
  const reply = useReplyTaskRunInputRequest(projectId, taskRunId)
  const approve = useApproveTaskRunInputRequest(projectId, taskRunId)
  const reject = useRejectTaskRunInputRequest(projectId, taskRunId)
  const [answer, setAnswer] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [failedAction, setFailedAction] = useState<InputRequestAction | null>(null)
  const pending = reply.isPending || approve.isPending || reject.isPending
  const error = reply.error ?? approve.error ?? reject.error
  const readOnly = isInputRequestReadOnly(request.status)
  function onError(action: InputRequestAction) { setFailedAction(action) }
  function sendReply() { const value = answer.trim(); if (!value) return; reply.mutate({ requestId: request.id, input: { answer: { value } } }, { onError: () => onError('reply') }) }
  function approveRequest() { approve.mutate({ requestId: request.id, input: { reason: 'approved in task run detail' } }, { onError: () => onError('approve') }) }
  function rejectRequest() { const reason = rejectReason.trim(); if (!reason) return; reject.mutate({ requestId: request.id, input: { reason } }, { onError: () => onError('reject') }) }
  return <Card size="small" className={styles.requestCard} title={<span>{request.kind} <Tag>{request.status}</Tag></span>}><Text>{request.prompt}</Text>{readOnly ? <Text type="secondary">已处理，当前为只读结果</Text> : request.kind === 'INPUT' ? <div className={styles.requestForm}><Input.TextArea value={answer} rows={2} placeholder="输入回复" disabled={pending} onChange={(event) => setAnswer(event.target.value)} /><Button type="primary" onClick={sendReply} loading={reply.isPending} disabled={pending || !answer.trim()}>回复</Button></div> : <div className={styles.requestForm}><Text type="secondary">请确认是否允许继续执行。</Text><Button type="primary" onClick={approveRequest} loading={approve.isPending} disabled={pending}>批准</Button><Input.TextArea value={rejectReason} rows={2} placeholder="拒绝原因（必填）" disabled={pending} onChange={(event) => setRejectReason(event.target.value)} /><Button danger onClick={rejectRequest} loading={reject.isPending} disabled={pending || !rejectReason.trim()}>拒绝</Button></div>}{failedAction ? <Alert type="error" showIcon title={`${failedAction} 操作失败`} action={error instanceof ApiError && error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} /> : null}</Card>
}

function ExecutionContextCard({ query }: { query: ReturnType<typeof useTaskRunExecutionContext> }) {
  if (query.isLoading) return <section className={styles.sideCard} data-testid="execution-context-card"><SectionHeading title="执行环境" /><InlineState loading /></section>
  if (query.isError) return <section className={styles.sideCard} data-testid="execution-context-card"><SectionHeading title="执行环境" /><SectionError resource="Execution Context" error={query.error} /></section>
  const context = query.data
  if (!context) return <section className={styles.sideCard} data-testid="execution-context-card"><SectionHeading title="执行环境" /><InlineState text="暂无执行环境摘要" /></section>
  const abnormal = context.sandboxStatus !== 'READY' && context.sandboxStatus !== 'RUNNING'
  return <section className={`${styles.sideCard} ${abnormal ? styles.sideCardWarning : ''}`} data-testid="execution-context-card"><SectionHeading title="执行环境" /><div className={styles.contextGrid}><MetaItem label="Workspace" value={context.workspaceId} /><MetaItem label="Sandbox" value={context.sandboxStatus} /><MetaItem label="Repository" value={context.repositoryId} /><MetaItem label="Ref" value={`${context.baseRef} → ${context.headRef}`} /><MetaItem label="开始" value={formatDate(context.startedAt)} /><MetaItem label="到期" value={formatDate(context.expiresAt)} /></div></section>
}

function RunResultCard({ projectId, taskId, taskRun }: { projectId: string; taskId: string; taskRun: TaskRunDetail }) {
  const navigate = useNavigate()
  const hasOutput = taskRun.artifactSummary.total > 0 || taskRun.artifactSummary.diffCount > 0
  return <section className={styles.sideCard} data-testid="run-result-card"><SectionHeading title="运行结果" /><div className={styles.resultGrid}><MetaItem label="状态摘要" value={taskRun.statusSummary} /><MetaItem label="产物" value={`${taskRun.artifactSummary.total} 个`} /><MetaItem label="Diff" value={`${taskRun.artifactSummary.diffCount} 个`} />{taskRun.retryOfTaskRunId ? <MetaItem label="重试自" value={shortId(taskRun.retryOfTaskRunId)} /> : null}</div>{taskRun.artifactSummary.diffCount > 0 ? <Button type="link" size="small" icon={<CodeOutlined />} onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(taskId)}`)}>查看任务 Diff</Button> : null}{!hasOutput ? <Text type="secondary" className={styles.compactEmpty}>本次运行暂无产出</Text> : null}</section>
}

function SectionHeading({ title, meta }: { title: string; meta?: string }) { return <div className={styles.sectionHeading}><Title level={4}>{title}</Title>{meta ? <Text type="secondary">{meta}</Text> : null}</div> }
function MetaItem({ label, value }: { label: string; value: string | null | undefined }) { return <div className={styles.metaItem}><Text type="secondary">{label}</Text><Text ellipsis>{display(value)}</Text></div> }
function InlineState({ loading = false, text }: { loading?: boolean; text?: string }) { return <div className={styles.inlineState}>{loading ? <Spin size="small" /> : null}<Text type="secondary">{text ?? '正在加载'}</Text></div> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon title={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
function PageState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.state}>{loading ? <Spin /> : <Result status="404" title={description} />}</div> }
function PageError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.state}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function roleLabel(role: string | null | undefined): string { const labels: Record<string, string> = { ORCHESTRATOR: '编排器', PLANNER: '规划器', DEVELOPER: '开发者', TESTER: '测试器', REVIEWER: '审查者' }; return role ? labels[role] ?? role : '暂无' }
function shortId(value: string | null | undefined): string { if (!value) return '暂无'; return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value }
function display(value: string | number | null | undefined): string { return value === null || value === undefined || value === '' ? '暂无' : String(value) }
function formatDate(value: string | null | undefined): string { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '暂无' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function formatDuration(value: number | null | undefined): string { if (value === null || value === undefined) return '暂无'; if (value < 1000) return `${value} 毫秒`; const seconds = value / 1000; if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} 秒`; const minutes = Math.floor(seconds / 60); const remainder = Math.round(seconds % 60); return `${minutes} 分 ${remainder} 秒` }
function resolveReturnPath(state: unknown, projectId: string, taskId: string): string { const fallback = PATHS.projectTaskDetail(projectId, taskId); return state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith(fallback) ? state.from : fallback }
