import { useEffect, useMemo } from 'react'
import { Alert, Button, Descriptions, Empty, Select, Space, Spin, Tag, Typography } from 'antd'
import { ApiError } from '@/api'
import {
  useExecutionContext,
  useInfiniteTaskRunLogs,
  useInfiniteTaskRunSteps,
  useInfiniteTaskRuns,
  useInputRequests,
  useTaskRun,
} from '@/hooks'
import type {
  CursorPage,
  ExecutionContext,
  InputRequest,
  TaskRun,
  TaskRunLog,
  WorkPackage,
} from '@/types'
import styles from './TaskDetailPage.module.scss'

const { Text, Title } = Typography
const PAGE_SIZE = 20
const DETAIL_PAGE_SIZE = 40
export interface WorkPackageQuery {
  data?: WorkPackage
  error?: Error | null
  isError: boolean
  isLoading: boolean
}

interface TaskExecutionPanelProps {
  projectId: string
  runId?: string
  run?: { id: string; projectId: string; workPackageIds: string[] }
  runQuery: { isLoading: boolean; isError: boolean; error: Error | null }
  workPackageQueries: WorkPackageQuery[]
  requestedWorkPackageId?: string
  requestedTaskRunId?: string
  onWorkPackageChange: (workPackageId: string) => void
  onTaskRunChange: (taskRunId?: string) => void
}

export function TaskExecutionPanel({
  projectId,
  runId,
  run,
  runQuery,
  workPackageQueries,
  requestedWorkPackageId,
  requestedTaskRunId,
  onWorkPackageChange,
  onTaskRunChange,
}: TaskExecutionPanelProps) {
  const workPackageIds = run?.workPackageIds ?? []
  const workPackages = useMemo(
    () => workPackageQueries.flatMap((query) => query.data ? [query.data] : []),
    [workPackageQueries],
  )
  const workPackagesLoading = workPackageQueries.some((query) => query.isLoading)
  const workPackagesLoaded = workPackageQueries.length === workPackageIds.length && !workPackagesLoading
  const firstWorkPackage = workPackages[0]
  const requestedWorkPackage = workPackages.find(
    (workPackage) => workPackage.id === requestedWorkPackageId,
  )
  const requestedWorkPackageBelongsToRun = requestedWorkPackageId
    ? workPackageIds.includes(requestedWorkPackageId)
    : true
  const selectedWorkPackage = requestedWorkPackageBelongsToRun
    ? requestedWorkPackage ?? firstWorkPackage
    : firstWorkPackage
  const workPackageUrlNeedsFallback = Boolean(
    requestedWorkPackageId &&
      workPackagesLoaded &&
      firstWorkPackage &&
      (!requestedWorkPackageBelongsToRun || !requestedWorkPackage),
  )

  useEffect(() => {
    if (!run || !workPackagesLoaded) return
    if (!requestedWorkPackageId && firstWorkPackage) {
      onWorkPackageChange(firstWorkPackage.id)
      return
    }
    if (workPackageUrlNeedsFallback && firstWorkPackage) {
      onWorkPackageChange(firstWorkPackage.id)
    }
  }, [
    firstWorkPackage,
    onWorkPackageChange,
    requestedWorkPackageId,
    run,
    workPackageUrlNeedsFallback,
    workPackagesLoaded,
  ])

  const taskRunsQuery = useInfiniteTaskRuns(projectId, selectedWorkPackage?.id ?? '', {
    limit: PAGE_SIZE,
  })
  const taskRuns = useMemo(
    () => flattenPages(taskRunsQuery.data?.pages),
    [taskRunsQuery.data],
  )
  const requestedTaskRun = taskRuns.find((taskRun) => taskRun.id === requestedTaskRunId)
  const taskRunListLoaded = Boolean(taskRunsQuery.data) && !taskRunsQuery.isFetching
  const displayedTaskRunId = requestedTaskRunId
    ? requestedTaskRun?.id
    : taskRuns[0]?.id
  const selectedTaskRunId = requestedTaskRunId ? requestedTaskRun?.id : undefined

  useEffect(() => {
    if (!selectedWorkPackage || !taskRunListLoaded) return
    if (!requestedTaskRunId && taskRuns[0]) {
      onTaskRunChange(taskRuns[0].id)
      return
    }
    if (requestedTaskRunId && !requestedTaskRun) {
      onTaskRunChange(undefined)
    }
  }, [
    onTaskRunChange,
    requestedTaskRun,
    requestedTaskRunId,
    selectedWorkPackage,
    taskRunListLoaded,
    taskRuns,
  ])

  const taskRunQuery = useTaskRun(projectId, selectedTaskRunId ?? '')
  const taskRunStatus = taskRunQuery.data?.status
  const needsInputRequest = taskRunStatus === 'WAITING_INPUT' ||
    taskRunStatus === 'WAITING_APPROVAL' ||
    taskRunStatus === 'BLOCKED'
  const inputRequestsQuery = useInputRequests(
    projectId,
    needsInputRequest ? selectedTaskRunId ?? '' : '',
    { limit: DETAIL_PAGE_SIZE },
  )
  const stepsQuery = useInfiniteTaskRunSteps(projectId, selectedTaskRunId ?? '', {
    limit: DETAIL_PAGE_SIZE,
  })
  const logsQuery = useInfiniteTaskRunLogs(projectId, selectedTaskRunId ?? '', {
    limit: DETAIL_PAGE_SIZE,
  })
  const executionContextQuery = useExecutionContext(projectId, selectedTaskRunId ?? '')

  if (!runId) return <PanelState description="请选择任务" />
  if (!run) {
    if (runQuery.isLoading) return <PanelState description="正在加载任务详情" loading />
    if (runQuery.isError) return <QueryError error={runQuery.error} resource="任务详情" />
    return <PanelState description="暂无任务详情" />
  }

  return (
    <div className={styles.executionPanel}>
      <div className={styles.executionHeader}>
        <div>
          <Title level={5}>执行记录</Title>
          <Text type="secondary">WorkPackage → TaskRun → Steps / Logs</Text>
        </div>
        {runQuery.isError ? <Tag color="warning">任务摘要刷新失败</Tag> : null}
      </div>

      <section className={styles.executionSection} aria-labelledby="execution-work-package-title">
        <div className={styles.executionSectionHeading}>
          <Title id="execution-work-package-title" level={5}>工作包</Title>
          <Text type="secondary">{workPackages.length} 项</Text>
        </div>
        {workPackagesLoading && workPackages.length === 0 ? <Spin size="small" /> : null}
        {!workPackagesLoading && workPackageIds.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作包" />
        ) : null}
        {!workPackagesLoading && workPackageIds.length > 0 && workPackages.length === 0 ? (
          <QueryError
            error={workPackageQueries.find((query) => query.error)?.error ?? null}
            resource="工作包"
          />
        ) : null}
        {selectedWorkPackage ? (
          <>
            <Select
              aria-label="工作包"
              className={styles.executionSelect}
              value={selectedWorkPackage.id}
              onChange={(value) => onWorkPackageChange(value)}
              options={workPackages.map((workPackage) => ({
                value: workPackage.id,
                label: `${workPackage.title} · ${statusLabel(workPackage.status)}`,
              }))}
            />
            <div className={styles.workPackageSummary}>
              <Text strong>{selectedWorkPackage.title}</Text>
              <Space size={6} wrap>
                <Tag>{statusLabel(selectedWorkPackage.status)}</Tag>
                <Text type="secondary">{selectedWorkPackage.repositoryId}</Text>
              </Space>
              <Text type="secondary">
                {selectedWorkPackage.baseRef} → {selectedWorkPackage.headRef}
              </Text>
            </div>
          </>
        ) : null}
        {requestedWorkPackageId && workPackageUrlNeedsFallback ? (
          <Alert
            className={styles.executionAlert}
            type="warning"
            showIcon
            title="URL 中的工作包不可见，已回退到当前任务的第一个工作包"
          />
        ) : null}
      </section>

      <section className={styles.executionSection} aria-labelledby="execution-task-run-title">
        <div className={styles.executionSectionHeading}>
          <Title id="execution-task-run-title" level={5}>TaskRun</Title>
          <Text type="secondary">{taskRuns.length} 项</Text>
        </div>
        <TaskRunList
          query={taskRunsQuery}
          taskRuns={taskRuns}
          selectedTaskRunId={displayedTaskRunId}
          onSelect={onTaskRunChange}
        />
      </section>

      {requestedTaskRunId && !requestedTaskRun && taskRunListLoaded ? (
        <Alert
          className={styles.executionAlert}
          type="warning"
          showIcon
          title="URL 中的 TaskRun 不属于当前工作包，未加载后续执行数据"
        />
      ) : null}

      {selectedTaskRunId ? (
        <>
          <TaskRunDetail query={taskRunQuery} />
          <InputRequestsReadOnly query={inputRequestsQuery} />
          <StepsSection query={stepsQuery} />
          <LogsSection query={logsQuery} />
          <ExecutionContextSection query={executionContextQuery} />
        </>
      ) : null}
    </div>
  )
}

function TaskRunList({
  query,
  taskRuns,
  selectedTaskRunId,
  onSelect,
}: {
  query: ReturnType<typeof useInfiniteTaskRuns>
  taskRuns: TaskRun[]
  selectedTaskRunId?: string
  onSelect: (taskRunId: string) => void
}) {
  if (query.isLoading) return <PanelState description="正在加载 TaskRun" loading />
  if (query.isError) return <QueryError error={query.error} resource="TaskRun 列表" />
  if (taskRuns.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前工作包暂无执行记录" />
  }

  return (
    <>
      <div className={styles.taskRunList} aria-label="TaskRun 列表">
        {taskRuns.map((taskRun) => (
          <button
            key={taskRun.id}
            type="button"
            className={`${styles.taskRunItem} ${taskRun.id === selectedTaskRunId ? styles.taskRunItemSelected : ''}`}
            aria-pressed={taskRun.id === selectedTaskRunId}
            onClick={() => onSelect(taskRun.id)}
          >
            <span className={styles.taskRunItemHeader}>
              <Text strong ellipsis={{ tooltip: taskRun.id }}>{taskRun.id}</Text>
              <Tag color={statusColor(taskRun.status)}>{statusLabel(taskRun.status)}</Tag>
            </span>
            <span className={styles.taskRunItemMeta}>
              子任务：{taskRun.subtaskTitle ?? taskRun.subtaskId}
            </span>
            <span className={styles.taskRunItemMeta}>
              节点：{taskRun.agentNode ?? '待接口字段'} / {taskRun.agentRole ?? '待接口字段'}
            </span>
            <span className={styles.taskRunItemMeta}>
              开始：{formatDateTime(taskRun.startedAt ?? taskRun.createdAt)}
            </span>
            <span className={styles.taskRunItemMeta}>
              结束：{formatDateTime(taskRun.finishedAt ?? (isTerminalTaskRun(taskRun) ? taskRun.updatedAt : null))}
              {' · '}耗时：{formatDuration(taskRun.durationMs ?? calculateDuration(taskRun.startedAt, taskRun.finishedAt))}
            </span>
            {taskRun.artifactSummary ? (
              <span className={styles.taskRunItemMeta}>产物：{taskRun.artifactSummary}</span>
            ) : null}
            {taskRun.errorSummary ? (
              <span className={styles.retryLine}>错误：{taskRun.errorSummary}</span>
            ) : null}
            {taskRun.retryOfTaskRunId ? (
              <span className={styles.retryLine}>重试来源：{taskRun.retryOfTaskRunId}</span>
            ) : null}
          </button>
        ))}
      </div>
      {query.hasNextPage ? (
        <div className={styles.executionLoadMore}>
          <Button
            size="small"
            onClick={() => void query.fetchNextPage()}
            loading={query.isFetchingNextPage}
          >
            加载更多 TaskRun
          </Button>
        </div>
      ) : null}
    </>
  )
}

function TaskRunDetail({ query }: { query: ReturnType<typeof useTaskRun> }) {
  if (query.isLoading) return <PanelState description="正在加载 TaskRun 详情" loading />
  if (query.isError) return <QueryError error={query.error} resource="TaskRun 详情" />
  if (!query.data) return <PanelState description="暂无 TaskRun 详情" />

  const taskRun = query.data
  const needsAttention = taskRun.status === 'WAITING_INPUT' ||
    taskRun.status === 'WAITING_APPROVAL' ||
    taskRun.status === 'BLOCKED'

  return (
    <section className={styles.executionSection} aria-labelledby="execution-task-run-detail-title">
      <div className={styles.executionSectionHeading}>
        <Title id="execution-task-run-detail-title" level={5}>运行详情</Title>
        <Tag color={statusColor(taskRun.status)}>{statusLabel(taskRun.status)}</Tag>
      </div>
      {needsAttention ? (
        <Alert
          className={styles.executionAlert}
          type="warning"
          showIcon
          title={`${statusLabel(taskRun.status)}：当前任务记录为只读状态`}
        />
      ) : null}
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="TaskRun ID">{taskRun.id}</Descriptions.Item>
        <Descriptions.Item label="关联 Subtask">{taskRun.subtaskTitle ?? taskRun.subtaskId}</Descriptions.Item>
        <Descriptions.Item label="当前节点">
          {taskRun.agentNode ?? '暂无节点'} / {taskRun.agentRole ?? '暂无 Agent'}
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">{formatDateTime(taskRun.startedAt ?? taskRun.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {formatDateTime(taskRun.finishedAt ?? (isTerminalTaskRun(taskRun) ? taskRun.updatedAt : null))}
        </Descriptions.Item>
        <Descriptions.Item label="持续时间">
          {formatDuration(taskRun.durationMs ?? calculateDuration(taskRun.startedAt, taskRun.finishedAt))}
        </Descriptions.Item>
        <Descriptions.Item label="重试来源">{taskRun.retryOfTaskRunId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="产物摘要">{taskRun.artifactSummary ?? '暂无接口字段'}</Descriptions.Item>
        <Descriptions.Item label="错误摘要">{taskRun.errorSummary ?? '—'}</Descriptions.Item>
      </Descriptions>
    </section>
  )
}

function StepsSection({
  query,
}: {
  query: ReturnType<typeof useInfiniteTaskRunSteps>
}) {
  const steps = flattenPages(query.data?.pages)
  return (
    <section className={styles.executionSection} aria-labelledby="execution-steps-title">
      <div className={styles.executionSectionHeading}>
        <Title id="execution-steps-title" level={5}>Steps</Title>
        <Text type="secondary">{steps.length} 项</Text>
      </div>
      {query.isLoading ? <PanelState description="正在加载 Steps" loading /> : null}
      {query.isError ? <QueryError error={query.error} resource="Steps" /> : null}
      {!query.isLoading && !query.isError && steps.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无步骤记录" />
      ) : null}
      {steps.length > 0 ? (
        <div className={styles.stepList}>
          {steps.map((step) => (
            <div className={styles.stepItem} key={step.id}>
              <div className={styles.stepItemHeader}>
                <Text strong>{step.node}</Text>
                <Tag color={stepStatusColor(step.status)}>{step.status}</Tag>
              </div>
              <Text type="secondary">开始：{formatDateTime(step.startedAt)}</Text>
              <Text type="secondary">结束：{formatDateTime(step.finishedAt)}</Text>
              <Text type="secondary">耗时：{formatDuration(step.durationMs)}</Text>
              {step.errorCode ? <Text type="danger">错误码：{step.errorCode}</Text> : null}
            </div>
          ))}
        </div>
      ) : null}
      {query.hasNextPage ? (
        <div className={styles.executionLoadMore}>
          <Button size="small" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
            加载更多 Steps
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function LogsSection({
  query,
}: {
  query: ReturnType<typeof useInfiniteTaskRunLogs>
}) {
  const logs = flattenPages(query.data?.pages)
  return (
    <section className={styles.executionSection} aria-labelledby="execution-logs-title">
      <div className={styles.executionSectionHeading}>
        <Title id="execution-logs-title" level={5}>Logs</Title>
        <Text type="secondary">{logs.length} 条</Text>
      </div>
      {query.isLoading ? <PanelState description="正在加载日志" loading /> : null}
      {query.isError ? <QueryError error={query.error} resource="日志" /> : null}
      {!query.isLoading && !query.isError && logs.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
      ) : null}
      {logs.length > 0 ? (
        <div className={styles.logList} aria-label="执行日志">
          {logs.map((log) => <LogLine key={log.id} log={log} />)}
        </div>
      ) : null}
      {query.hasNextPage ? (
        <div className={styles.executionLoadMore}>
          <Button size="small" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
            加载更多日志
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function LogLine({ log }: { log: TaskRunLog }) {
  return (
    <div className={styles.logLine}>
      <span className={styles.logTimestamp}>{formatDateTime(log.timestamp)}</span>
      <Tag color={logLevelColor(log.level)}>{log.level}</Tag>
      <span>{log.node ?? '—'}</span>
      <span className={styles.logContent}>{log.content}</span>
    </div>
  )
}

function ExecutionContextSection({
  query,
}: {
  query: ReturnType<typeof useExecutionContext>
}) {
  return (
    <section className={styles.executionSection} aria-labelledby="execution-context-title">
      <div className={styles.executionSectionHeading}>
        <Title id="execution-context-title" level={5}>Execution Context</Title>
        <Text type="secondary">只读</Text>
      </div>
      {query.isLoading ? <PanelState description="正在加载执行上下文" loading /> : null}
      {query.isError ? <QueryError error={query.error} resource="Execution Context" /> : null}
      {!query.isLoading && !query.isError && !query.data ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行上下文" />
      ) : null}
      {query.data ? <ExecutionContextDetails context={query.data} /> : null}
    </section>
  )
}

function ExecutionContextDetails({ context }: { context: ExecutionContext }) {
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="workspaceId">{context.workspaceId}</Descriptions.Item>
      <Descriptions.Item label="sandboxStatus">{context.sandboxStatus}</Descriptions.Item>
      <Descriptions.Item label="repositoryId">{context.repositoryId}</Descriptions.Item>
      <Descriptions.Item label="baseRef">{context.baseRef}</Descriptions.Item>
      <Descriptions.Item label="headRef">{context.headRef}</Descriptions.Item>
      <Descriptions.Item label="开始时间">{formatDateTime(context.startedAt)}</Descriptions.Item>
      <Descriptions.Item label="过期时间">{formatDateTime(context.expiresAt)}</Descriptions.Item>
    </Descriptions>
  )
}

function InputRequestsReadOnly({
  query,
}: {
  query: ReturnType<typeof useInputRequests>
}) {
  if (!query.data && !query.isLoading && !query.isError) return null
  const requests = query.data?.data ?? []
  return (
    <section className={styles.executionSection} aria-labelledby="execution-input-title">
      <div className={styles.executionSectionHeading}>
        <Title id="execution-input-title" level={5}>Input Request</Title>
        <Text type="secondary">只读提示</Text>
      </div>
      {query.isLoading ? <PanelState description="正在加载输入请求" loading /> : null}
      {query.isError ? <QueryError error={query.error} resource="Input Request" /> : null}
      {!query.isLoading && !query.isError && requests.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无输入请求" />
      ) : null}
      {requests.map((request) => <InputRequestItem key={request.id} request={request} />)}
    </section>
  )
}

function InputRequestItem({ request }: { request: InputRequest }) {
  return (
    <div className={styles.inputRequestItem}>
      <Space size={6} wrap>
        <Tag>{request.kind}</Tag>
        <Tag color={request.status === 'PENDING' ? 'warning' : 'default'}>{request.status}</Tag>
      </Space>
      <Text className={styles.inputPrompt}>{request.prompt}</Text>
      {request.options ? (
        <Space size={[4, 4]} wrap>
          {request.options.map((option) => <Tag key={option.value}>{option.label}</Tag>)}
        </Space>
      ) : null}
      <Text type="secondary">创建时间：{formatDateTime(request.createdAt)}</Text>
      <Text type="secondary">当前请求为只读记录</Text>
    </div>
  )
}

function PanelState({ description, loading = false }: { description: string; loading?: boolean }) {
  if (loading) return <div className={styles.panelState}><Spin description={description} /></div>
  return <Empty className={styles.executionEmpty} image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
}

function QueryError({ error, resource }: { error: Error | null; resource: string }) {
  const status = error instanceof ApiError ? error.status : undefined
  const title = status === 403
    ? `暂无权限查看${resource}`
    : status === 404
      ? `${resource}不存在或不可见`
      : `${resource}加载失败`
  return <Alert className={styles.executionAlert} type={status === 403 ? 'warning' : 'error'} showIcon title={title} />
}

function flattenPages<T>(pages: Array<CursorPage<T>> | undefined): T[] {
  return pages?.flatMap((page) => page.data) ?? []
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PLANNING: '规划中',
    READY: '就绪',
    RUNNING: '执行中',
    PAUSED: '已暂停',
    SUCCEEDED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消',
    CANCELLING: '取消中',
    QUEUED: '排队中',
    WAITING_INPUT: '等待输入',
    WAITING_APPROVAL: '等待审批',
    BLOCKED: '已阻塞',
    PENDING: '待执行',
    PASSED: '通过',
    SKIPPED: '已跳过',
  }
  return labels[status] ?? status
}

function statusColor(status: string): string {
  if (status === 'SUCCEEDED' || status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'WAITING_INPUT' || status === 'WAITING_APPROVAL' || status === 'BLOCKED') return 'warning'
  return 'processing'
}

function stepStatusColor(status: string): string {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'error'
  if (status === 'SKIPPED') return 'default'
  return 'processing'
}

function logLevelColor(level: string): string {
  if (level === 'ERROR') return 'error'
  if (level === 'WARN') return 'warning'
  if (level === 'DEBUG') return 'default'
  return 'processing'
}

function isTerminalTaskRun(taskRun: TaskRun): boolean {
  return taskRun.status === 'SUCCEEDED' || taskRun.status === 'FAILED' || taskRun.status === 'CANCELLED'
}

function calculateDuration(startedAt?: string | null, finishedAt?: string | null): number | null {
  if (!startedAt || !finishedAt) return null
  const duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  return Number.isFinite(duration) && duration >= 0 ? duration : null
}

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return '—'
  if (durationMs < 1_000) return `${durationMs} ms`
  return `${(durationMs / 1_000).toFixed(1)} s`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
