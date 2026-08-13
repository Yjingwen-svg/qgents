import { Alert, Breadcrumb, Button, Card, Empty, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useCancelTask, useTask, useTaskRuns, useTaskSteps } from '@/hooks/task-model'
import type { Task, TaskRunSummary, TaskStep } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { TaskModelStatusTag } from '../TaskCenter/TaskModelStatusTag'
import styles from './TaskDetailPage.module.scss'

const { Paragraph, Text, Title } = Typography

export function TaskDetailPage() {
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const taskQuery = useTask(projectId, taskId)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const runsQuery = useTaskRuns(projectId, taskId, { limit: 100 })
  const cancelMutation = useCancelTask(projectId)
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
        <TaskStepsSection projectId={projectId} taskId={task.id} query={stepsQuery} steps={steps} runsByStep={runsByStep} />
        <TaskRunsSummary query={runsQuery} runs={runs} />
      </main>
    </div>
  )
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

function groupLatestRuns(runs: TaskRunSummary[]): Map<string, TaskRunSummary> {
  const result = new Map<string, TaskRunSummary>()
  for (const run of runs) {
    const current = result.get(run.taskStepId)
    if (!current || run.updatedAt > current.updatedAt) result.set(run.taskStepId, run)
  }
  return result
}

function canCancelTask(status: Task['status']): boolean { return status === 'PLANNING' || status === 'PENDING' || status === 'RUNNING' }
function display(value: string | null | undefined): string { return value?.trim() || '暂无' }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? display(value) : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function SummaryItem({ label, value }: { label: string; value: string }) { return <div className={styles.summaryMetaItem}><Text className={styles.label}>{label}</Text><Text className={styles.value}>{display(value)}</Text></div> }
function CancelError({ error, onRefresh }: { error: Error; onRefresh: () => void }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert className={styles.executionAlert} type="error" showIcon title={status === 409 ? '任务状态已变化，请刷新详情' : '取消任务失败'} action={status === 409 ? <Button type="link" onClick={onRefresh}>刷新</Button> : undefined} /> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon title={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
function DetailState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.page}><div className={styles.panelState}>{loading ? <Spin description={description} /> : <Result status="404" title={description} />}</div></div> }
function DetailError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.page}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function resolveReturnPath(state: unknown, projectId: string, taskId: string): string { const fallback = `${PATHS.projectTasks(projectId)}?taskId=${encodeURIComponent(taskId)}`; return state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith(PATHS.projectTasks(projectId)) ? state.from : fallback }
