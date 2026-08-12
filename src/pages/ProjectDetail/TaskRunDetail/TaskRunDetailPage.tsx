import { Alert, Breadcrumb, Button, Descriptions, Result, Spin, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useCancelTaskRun, useOrchestrationRun, useOrchestrationWorkPackages, useRetryTaskRun, useTaskRun } from '@/hooks'
import { canCancelTaskRun, canRetryTaskRun } from '@/types'
import type { TaskRun } from '@/types'
import { PATHS } from '@/routes/paths'
import { TaskExecutionPanel } from '../TaskDetail/TaskExecutionPanel'
import styles from './TaskRunDetailPage.module.scss'

const { Text, Title } = Typography

export function TaskRunDetailPage() {
  const { projectId = '', runId = '', taskRunId = '' } = useParams<{
    projectId: string
    runId: string
    taskRunId: string
  }>()
  const navigate = useNavigate()
  const location = useLocation()
  const runQuery = useOrchestrationRun(projectId, runId)
  const taskRunQuery = useTaskRun(projectId, taskRunId)
  const workPackageQueries = useOrchestrationWorkPackages(projectId, runQuery.data?.workPackageIds ?? [])
  const workPackages = workPackageQueries.flatMap((query) => query.data ? [query.data] : [])
  const taskRun = taskRunQuery.data
  const selectedWorkPackage = workPackages.find((workPackage) => workPackage.id === taskRun?.workPackageId)
  const retryMutation = useRetryTaskRun(projectId)
  const cancelMutation = useCancelTaskRun(projectId)
  const isMutating = retryMutation.isPending || cancelMutation.isPending

  function handleBack() {
    navigate(resolveReturnPath(location.state, projectId, runId))
  }

  function handleTaskRunChange(nextTaskRunId?: string) {
    if (!nextTaskRunId) return
    navigate(PATHS.projectTaskRunDetail(projectId, runId, nextTaskRunId), { state: { from: location.state && typeof location.state === 'object' && 'from' in location.state ? location.state.from : undefined } })
  }

  function handleRetry() {
    if (!taskRun || !window.confirm('确认重试该执行记录？原执行记录将保留。')) return
    retryMutation.mutate(taskRun.id, {
      onSuccess: (nextTaskRun) => handleTaskRunChange(nextTaskRun.id),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) void taskRunQuery.refetch()
      },
    })
  }

  function handleCancel() {
    if (!taskRun || !window.confirm('确认取消该执行记录？任务只会在安全检查点停止。')) return
    cancelMutation.mutate(taskRun.id, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) void taskRunQuery.refetch()
      },
    })
  }

  if (runQuery.isLoading || taskRunQuery.isLoading) return <PageState loading description="正在加载执行详情" />
  if (runQuery.isError) return <PageError error={runQuery.error} resource="任务详情" />
  if (taskRunQuery.isError) return <PageError error={taskRunQuery.error} resource="TaskRun" />
  if (!runQuery.data || runQuery.data.projectId !== projectId) return <PageState description="任务不存在或不可见" />
  if (!taskRun || !isTaskRunInRun(taskRun, runQuery.data.workPackageIds, projectId, runId)) return <PageState description="TaskRun 不属于当前任务或不可见" />
  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ title: '任务中心' }, { title: '任务详情' }, { title: '执行详情' }]} />
      <div className={styles.toolbar}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>返回任务详情</Button>
      </div>
      <header className={styles.header}>
        <div>
          <Text type="secondary">所属阶段</Text>
          <Title level={2}>{taskRun.subtaskTitle ?? taskRun.subtaskId}</Title>
        </div>
        <Space orientation="vertical" align="end">
          <Tag>{taskRun.status}</Tag>
          <TaskRunActions
            taskRun={taskRun}
            isMutating={isMutating}
            retryPending={retryMutation.isPending}
            cancelPending={cancelMutation.isPending}
            retryError={retryMutation.error}
            cancelError={cancelMutation.error}
            onRefresh={() => void taskRunQuery.refetch()}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        </Space>
      </header>
      <section className={styles.summary} aria-label="所属阶段和 WorkPackage 摘要">
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
          <Descriptions.Item label="WorkPackage">{selectedWorkPackage?.title ?? taskRun.workPackageId}</Descriptions.Item>
          <Descriptions.Item label="仓库">{selectedWorkPackage?.repositoryId ?? '暂无'}</Descriptions.Item>
          <Descriptions.Item label="分支">{selectedWorkPackage ? `${selectedWorkPackage.baseRef} → ${selectedWorkPackage.headRef}` : '暂无'}</Descriptions.Item>
          <Descriptions.Item label="TaskRun">{taskRun.id}</Descriptions.Item>
        </Descriptions>
      </section>
      <TaskExecutionPanel
        projectId={projectId}
        runId={runId}
        run={runQuery.data}
        runQuery={runQuery}
        workPackageQueries={workPackageQueries}
        requestedWorkPackageId={selectedWorkPackage?.id}
        requestedTaskRunId={taskRunId}
        requestedTaskRun={taskRun}
        showWorkPackageSelector={false}
        operationPending={isMutating}
        onTaskRunChange={handleTaskRunChange}
      />
    </div>
  )
}

function TaskRunActions({
  taskRun,
  isMutating,
  retryPending,
  cancelPending,
  retryError,
  cancelError,
  onRefresh,
  onRetry,
  onCancel,
}: {
  taskRun: TaskRun
  isMutating: boolean
  retryPending: boolean
  cancelPending: boolean
  retryError: Error | null
  cancelError: Error | null
  onRefresh: () => void
  onRetry: () => void
  onCancel: () => void
}) {
  const canRetry = canRetryTaskRun(taskRun.status)
  const canCancel = canCancelTaskRun(taskRun.status)
  const operationError = retryError ?? cancelError

  return (
    <div className={styles.actions} aria-label="TaskRun 操作">
      <Space>
        {canRetry ? <Button onClick={onRetry} loading={retryPending} disabled={isMutating}>重试</Button> : null}
        {canCancel ? <Button danger onClick={onCancel} loading={cancelPending} disabled={isMutating}>取消</Button> : null}
      </Space>
      {operationError ? <TaskRunOperationError error={operationError} onRefresh={onRefresh} /> : null}
    </div>
  )
}

function TaskRunOperationError({ error, onRefresh }: { error: Error; onRefresh: () => void }) {
  const status = error instanceof ApiError ? error.status : undefined
  const title = status === 403
    ? '暂无操作权限'
    : status === 404
      ? 'TaskRun 不存在或不可见'
      : status === 409
        ? 'TaskRun 状态已变化，请刷新最新状态后重试'
        : status === 422
          ? '请求不合法，请检查后重试'
          : '操作失败，可再次尝试'
  return <Alert type="error" showIcon title={title} action={status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} />
}

function isTaskRunInRun(taskRun: TaskRun, workPackageIds: string[], projectId: string, runId: string): boolean {
  return taskRun.projectId === projectId && taskRun.orchestrationRunId === runId && workPackageIds.includes(taskRun.workPackageId)
}

function resolveReturnPath(state: unknown, projectId: string, runId: string): string {
  const defaultPath = PATHS.projectTaskDetail(projectId, runId)
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return defaultPath
  return state.from.startsWith(PATHS.projectTaskDetail(projectId, runId)) || state.from.startsWith(PATHS.projectTasks(projectId))
    ? state.from
    : defaultPath
}

function PageState({ description, loading = false }: { description: string; loading?: boolean }) {
  return <div className={styles.state}>{loading ? <Spin description={description} /> : <Result status="404" title={description} />}</div>
}

function PageError({ error, resource }: { error: Error | null; resource: string }) {
  const status = error instanceof ApiError ? error.status : undefined
  return (
    <div className={styles.state}>
      <Result
        status={status === 403 ? '403' : status === 404 ? '404' : 'error'}
        title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`}
        subTitle="当前 URL 未自动替换为其他执行记录"
      />
    </div>
  )
}
