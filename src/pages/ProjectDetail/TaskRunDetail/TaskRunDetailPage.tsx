/* oxlint-disable eslint(no-unreachable) */
import { useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, Card, Descriptions, Empty, Input, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import {
  useApproveTaskRunInputRequest,
  useCancelTaskRunModel,
  useRejectTaskRunInputRequest,
  useReplyTaskRunInputRequest,
  useRetryTaskRunModel,
  useTask,
  useTaskRun,
  useTaskRunExecutionContext,
  useTaskRunInputRequests,
  useTaskRunLogs,
  useTaskSteps,
} from '@/hooks/task-model'
import type { InputRequest, TaskRunDetail, TaskRunStep } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { canPerformInputRequestAction, isInputRequestReadOnly, type InputRequestAction } from '@/utils/inputRequestActions'
import styles from './TaskRunDetailPage.module.scss'

const { Text, Title } = Typography

export function TaskRunDetailPage() {
  const { projectId = '', taskId = '', taskRunId = '' } = useParams<{ projectId: string; taskId: string; taskRunId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const taskQuery = useTask(projectId, taskId)
  const runQuery = useTaskRun(projectId, taskRunId)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const logsQuery = useTaskRunLogs(projectId, taskRunId, { limit: 100 })
  const contextQuery = useTaskRunExecutionContext(projectId, taskRunId)
  const inputRequestsQuery = useTaskRunInputRequests(projectId, taskRunId, { limit: 100 })
  const retryMutation = useRetryTaskRunModel(projectId)
  const cancelMutation = useCancelTaskRunModel(projectId)
  const taskRun = runQuery.data
  const taskStep = useMemo(() => taskRun && stepsQuery.data?.data.find((step) => step.id === taskRun.taskStepId), [stepsQuery.data, taskRun])
  const runSteps = taskRun?.steps ?? []

  if (taskQuery.isLoading || runQuery.isLoading) return <PageState loading description="正在加载执行详情" />
  if (taskQuery.isError) return <PageError error={taskQuery.error} resource="任务" />
  if (runQuery.isError) return <PageError error={runQuery.error} resource="TaskRun" />
  if (!taskQuery.data || taskQuery.data.id !== taskId || taskQuery.data.projectId !== projectId) return <PageState description="任务不存在或不可见" />
  if (!taskRun || taskRun.taskId !== taskId) return <PageState description="TaskRun 不属于当前任务或不可见" />
  const currentTaskRun = taskRun

  function back() { navigate(resolveReturnPath(location.state, projectId, taskId)) }
  function retry() {
    if (!window.confirm('确认重试此执行记录？原运行将保留。')) return
    retryMutation.mutate(currentTaskRun.id, { onSuccess: (next) => navigate(PATHS.projectTaskRunDetail(projectId, taskId, next.id), { state: { from: location.state && typeof location.state === 'object' && 'from' in location.state ? location.state.from : undefined } }), onError: (error) => { if (error instanceof ApiError && error.status === 409) void runQuery.refetch() } })
  }
  function cancel() {
    if (!window.confirm('确认取消此执行记录？')) return
    cancelMutation.mutate(currentTaskRun.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) void runQuery.refetch() } })
  }

  return <div className={styles.page}>
    <Breadcrumb items={[{ title: '任务中心' }, { title: taskQuery.data.title }, { title: '执行详情' }]} />
    <div className={styles.toolbar}><Button type="text" icon={<ArrowLeftOutlined />} onClick={back}>返回任务详情</Button></div>
    <header className={styles.header}><div><Text type="secondary">TaskStep：{taskRun.taskStepId}</Text><Title level={2}>{taskStep?.role ?? taskRun.role}</Title></div><Space direction="vertical" align="end"><Tag>{taskRun.status}</Tag><TaskRunActions taskRun={taskRun} retry={retry} cancel={cancel} retryPending={retryMutation.isPending} cancelPending={cancelMutation.isPending} retryError={retryMutation.error} cancelError={cancelMutation.error} onRefresh={() => void runQuery.refetch()} /></Space></header>
    <Card className={styles.summary}><Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small"><Descriptions.Item label="TaskRun">{taskRun.id}</Descriptions.Item><Descriptions.Item label="角色">{taskRun.role}</Descriptions.Item><Descriptions.Item label="Agent">{display(taskRun.agent?.name)}</Descriptions.Item><Descriptions.Item label="状态原因">{display(taskRun.statusReason?.summary)}</Descriptions.Item><Descriptions.Item label="耗时">{duration(taskRun.durationMs)}</Descriptions.Item><Descriptions.Item label="开始">{display(taskRun.startedAt)}</Descriptions.Item><Descriptions.Item label="结束">{display(taskRun.finishedAt)}</Descriptions.Item><Descriptions.Item label="Diff 数量">{taskRun.artifactSummary.diffCount}</Descriptions.Item></Descriptions></Card>
    <div className={styles.content}>
      <TaskRunStepsSection steps={runSteps} />
      <TaskStepSection step={taskStep} query={stepsQuery} />
      <LogsSection query={logsQuery} />
      <ContextSection query={contextQuery} />
      <InputRequestsSection projectId={projectId} taskRunId={taskRun.id} query={inputRequestsQuery} />
      <TaskRunDiffSummary projectId={projectId} taskId={taskId} taskRun={taskRun} />
    </div>
  </div>
}

function TaskRunDiffSummary({ projectId, taskId, taskRun }: { projectId: string; taskId: string; taskRun: TaskRunDetail }) {
  const navigate = useNavigate()
  const count = taskRun.artifactSummary.diffCount
  return <Card title="Diff"><Space direction="vertical"><Text>Diff 数量：{count}</Text>{count > 0 ? <Button onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(taskId)}`)}>查看该任务 Diff</Button> : <Empty description="暂无可查看 Diff" />}</Space></Card>
}

function TaskRunActions({ taskRun, retry, cancel, retryPending, cancelPending, retryError, cancelError, onRefresh }: { taskRun: TaskRunDetail; retry: () => void; cancel: () => void; retryPending: boolean; cancelPending: boolean; retryError: Error | null; cancelError: Error | null; onRefresh: () => void }) {
  const canRetry = taskRun.status === 'FAILED' || taskRun.status === 'CANCELLED' || taskRun.status === 'BLOCKED'
  const canCancel = ['QUEUED', 'RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED', 'CANCELLING'].includes(taskRun.status)
  const error = retryError ?? cancelError
  return <div className={styles.actions}><Space>{canRetry ? <Button onClick={retry} loading={retryPending} disabled={retryPending || cancelPending}>重试</Button> : null}{canCancel ? <Button danger onClick={cancel} loading={cancelPending} disabled={retryPending || cancelPending}>取消</Button> : null}</Space>{error ? <Alert type="error" showIcon title={error instanceof ApiError && error.status === 409 ? '状态已变化，请刷新' : '操作失败'} action={error instanceof ApiError && error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} /> : null}</div>
}

function TaskStepSection({ step, query }: { step?: import('@/types/task-model').TaskStep; query: ReturnType<typeof useTaskSteps> }) {
  if (query.isLoading) return <Card title="TaskStep"><Spin /></Card>
  if (query.isError) return <Card title="TaskStep"><SectionError resource="TaskStep" error={query.error} /></Card>
  return <Card title="关联 TaskStep">{step ? <Space direction="vertical"><Text>角色：{step.role}</Text><Text>Agent：{display(step.agent?.name)}</Text><Text>依赖：{step.dependencies.length ? step.dependencies.join(', ') : '暂无'}</Text><Text>仓库：{display(step.repository?.name)}</Text><Text>状态：{step.status}</Text><Text>验收说明：{display(step.acceptanceNotes)}</Text></Space> : <Empty description="关联 TaskStep 不存在" />}</Card>
}

function TaskRunStepsSection({ steps }: { steps: TaskRunStep[] }) {
  return <Card title="执行步骤">{steps.length === 0 ? <Empty description="暂无执行步骤" /> : <Space direction="vertical">{steps.map((step) => <div key={`${step.node}-${step.startedAt ?? 'pending'}`}><Text strong>{step.node}</Text><Text> · {step.status} · {duration(step.durationMs)} · {display(step.errorCode)}</Text></div>)}</Space>}</Card>
}

function LogsSection({ query }: { query: ReturnType<typeof useTaskRunLogs> }) { if (query.isLoading) return <Card title="Logs"><Spin /></Card>; if (query.isError) return <Card title="Logs"><SectionError resource="Logs" error={query.error} /></Card>; const logs = query.data?.data ?? []; return <Card title="Logs">{logs.length === 0 ? <Empty description="暂无日志" /> : <Space direction="vertical">{logs.map((log) => <Text key={log.id}>[{log.node}] {log.content}</Text>)}</Space>}</Card> }
function ContextSection({ query }: { query: ReturnType<typeof useTaskRunExecutionContext> }) { if (query.isLoading) return <Card title="Execution Context"><Spin /></Card>; if (query.isError) return <Card title="Execution Context"><SectionError resource="Execution Context" error={query.error} /></Card>; const context = query.data; return <Card title="Execution Context">{context ? <Descriptions column={1} size="small"><Descriptions.Item label="Workspace">{context.workspaceId}</Descriptions.Item><Descriptions.Item label="Sandbox">{context.sandboxStatus}</Descriptions.Item><Descriptions.Item label="Repository">{context.repositoryId}</Descriptions.Item><Descriptions.Item label="Base ref">{context.baseRef}</Descriptions.Item><Descriptions.Item label="Head ref">{context.headRef}</Descriptions.Item></Descriptions> : <Empty description="暂无执行上下文" />}</Card> }

function InputRequestsSection({ projectId, taskRunId, query }: { projectId: string; taskRunId: string; query: ReturnType<typeof useTaskRunInputRequests> }) {
  const reply = useReplyTaskRunInputRequest(projectId, taskRunId); const approve = useApproveTaskRunInputRequest(projectId, taskRunId); const reject = useRejectTaskRunInputRequest(projectId, taskRunId); const requests = query.data?.data ?? []
  if (query.isLoading) return <Card title="Input Requests"><Spin /></Card>; if (query.isError) return <Card title="Input Requests"><SectionError resource="Input Requests" error={query.error} /></Card>; return <Card title="Input Requests">{requests.length === 0 ? <Empty description="暂无 Input Request" /> : <Space direction="vertical" style={{ width: '100%' }}>{requests.map((request) => <InputRequestItem key={request.id} request={request} reply={reply} approve={approve} reject={reject} />)}</Space>}</Card>
}

function InputRequestItem({ request, reply, approve, reject }: { request: InputRequest; reply: ReturnType<typeof useReplyTaskRunInputRequest>; approve: ReturnType<typeof useApproveTaskRunInputRequest>; reject: ReturnType<typeof useRejectTaskRunInputRequest> }) {
  const [answer, setAnswer] = useState('')
  const [failedAction, setFailedAction] = useState<InputRequestAction | null>(null)
  const isReadOnly = isInputRequestReadOnly(request.status)
  const pending = reply.isPending || approve.isPending || reject.isPending
  const runAction = (action: InputRequestAction): void => {
    setFailedAction(null)
    const onError = () => setFailedAction(action)
    if (action === 'reply') {
      reply.mutate({ requestId: request.id, input: { answer: { value: answer } } }, { onError })
      return
    }
    const input = { reason: action === 'approve' ? 'approved in task run detail' : 'rejected in task run detail' }
    if (action === 'approve') approve.mutate({ requestId: request.id, input }, { onError })
    else reject.mutate({ requestId: request.id, input }, { onError })
  }
  return <Card size="small" title={request.kind}><Text>{request.prompt}</Text>{isReadOnly ? <Text type="secondary"> 已处理，只读</Text> : null}<Space wrap>{canPerformInputRequestAction(request, 'reply') ? <><Input placeholder="回复内容" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={pending} /><Button loading={reply.isPending} disabled={pending} onClick={() => runAction('reply')}>回复</Button></> : null}{canPerformInputRequestAction(request, 'approve') ? <Button loading={approve.isPending} disabled={pending} onClick={() => runAction('approve')}>批准</Button> : null}{canPerformInputRequestAction(request, 'reject') ? <Button danger loading={reject.isPending} disabled={pending} onClick={() => runAction('reject')}>拒绝</Button> : null}</Space>{failedAction ? <Alert type="error" showIcon message={`${failedAction} 操作失败`} /> : null}</Card>
  return <Card size="small" title={request.kind}><Text>{request.prompt}</Text><Space wrap><Input placeholder="回复内容" id={`reply-${request.id}`} disabled={request.status !== 'PENDING'} /><Button disabled={request.status !== 'PENDING'} onClick={() => { const input = document.getElementById(`reply-${request.id}`); reply.mutate({ requestId: request.id, input: { answer: { value: input instanceof HTMLInputElement ? input.value : '' } } }) }}>回复</Button><Button disabled={request.status !== 'PENDING'} onClick={() => approve.mutate({ requestId: request.id, input: { reason: 'approved in task run detail' } })}>批准</Button><Button danger disabled={request.status !== 'PENDING'} onClick={() => reject.mutate({ requestId: request.id, input: { reason: 'rejected in task run detail' } })}>拒绝</Button></Space></Card>
}

function display(value: string | number | null | undefined): string { return value === null || value === undefined || value === '' ? '暂无' : String(value) }
function duration(value: number | null | undefined): string { return value === null || value === undefined ? '暂无' : `${value} ms` }
function resolveReturnPath(state: unknown, projectId: string, taskId: string): string { const fallback = PATHS.projectTaskDetail(projectId, taskId); return state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith(fallback) ? state.from : fallback }
function PageState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.state}>{loading ? <Spin description={description} /> : <Result status="404" title={description} />}</div> }
function PageError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.state}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon title={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
