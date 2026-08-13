import { useEffect, useMemo, useRef } from 'react'
import { Alert, Button, ConfigProvider, Empty, Result, Segmented, Space, Spin, theme, Typography, type ThemeConfig } from 'antd'
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useInfiniteTasks } from '@/hooks/task-model'
import type { Task } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { TaskContextPanel } from './TaskContextPanel'
import { TaskFilters } from './TaskFilters'
import { TaskList } from './TaskList'
import { parseTaskCenterPanel, TASK_CENTER_STATUS_OPTIONS, type TaskCenterPanel, type TaskCenterStatusFilter, type TaskCenterView } from './taskCenterConfig'
import styles from './TaskCenterPage.module.scss'

const { Title, Text } = Typography
const PAGE_SIZE = 20
const SEARCH_PARAMS = new Set(['taskId', 'status', 'groupId', 'createdBy', 'view', 'panel'])

const taskCenterTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: { colorPrimary: '#0d9b9b', colorBgBase: '#ffffff', colorBgContainer: '#ffffff', colorBgElevated: '#ffffff', colorText: '#12213d', colorTextSecondary: '#6d7d95', colorBorder: '#e4eaf2', colorFillAlter: '#f7f9fc', borderRadius: 8 },
}

export function TaskCenterPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const previousProjectId = useRef(projectId)
  const status = parseStatus(searchParams.get('status'))
  const groupId = searchParams.get('groupId') ?? undefined
  const createdBy = searchParams.get('createdBy') ?? undefined
  const requestedTaskId = searchParams.get('taskId')?.trim() || undefined
  const view = searchParams.get('view') === 'table' ? 'table' : 'board'
  const panel = parseTaskCenterPanel(searchParams.get('panel'))
  const query = useInfiniteTasks(projectId, { groupId, status: status === 'all' ? undefined : status, createdBy, limit: PAGE_SIZE })

  const tasks = useMemo(() => {
    const seen = new Map<string, Task>()
    query.data?.pages.flatMap((page) => page.data).forEach((task) => seen.set(task.id, task))
    return [...seen.values()]
  }, [query.data])
  const selectedTaskId = requestedTaskId ?? tasks[0]?.id
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const groupOptions = useMemo(() => uniqueOptions(tasks.map((task) => ({ label: task.requirementGroupId || '暂无', value: task.requirementGroupId }))), [tasks])
  const hasServerItems = query.data?.pages.some((page) => page.data.length > 0) ?? false
  const isUnfiltered = status === 'all' && !createdBy && !groupId

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of Array.from(next.keys())) {
      if (!SEARCH_PARAMS.has(key)) { next.delete(key); changed = true }
    }
    if (changed) setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (previousProjectId.current === projectId) return
    previousProjectId.current = projectId
    if (!searchParams.has('taskId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('taskId')
    setSearchParams(next, { replace: true })
  }, [projectId, searchParams, setSearchParams])

  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    for (const key of ['status', 'createdBy', 'groupId']) next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function handlePanelChange(nextPanel: TaskCenterPanel) {
    updateParam('panel', nextPanel === 'context' ? undefined : nextPanel)
  }

  return (
    <ConfigProvider theme={taskCenterTheme}>
      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.header}>
            <Title level={2} className={styles.title}>任务中心 <Text type="secondary">（按需求分组）</Text></Title>
            <Space>
              {query.isFetching && !query.isLoading ? <Spin size="small" /> : null}
              <Button className={styles.contextButton} disabled={!selectedTask} onClick={() => selectedTask ? navigate(PATHS.projectReqChat(projectId, selectedTask.requirementGroupId)) : undefined}>返回需求群上下文</Button>
            </Space>
          </header>
          <TaskFilters
            status={status}
            groupId={groupId}
            createdBy={createdBy}
            groupOptions={groupOptions}
            onStatusChange={(value) => updateParam('status', value === 'all' ? undefined : value)}
            onGroupChange={(value) => updateParam('groupId', value)}
            onCreatedByChange={(value) => updateParam('createdBy', value)}
            onReset={resetFilters}
          />
          <div className={styles.listHeading}>
            <Space><Text strong>任务列表</Text><Text type="secondary">{tasks.length} 项</Text></Space>
            <Segmented<TaskCenterView> aria-label="任务视图" value={view} onChange={(nextView) => updateParam('view', nextView)} options={[{ value: 'board', label: '看板', icon: <AppstoreOutlined /> }, { value: 'table', label: '表格', icon: <UnorderedListOutlined /> }]} />
          </div>
          <TaskCenterContent query={query} tasks={tasks} hasServerItems={hasServerItems} isUnfiltered={isUnfiltered} view={view} selectedTaskId={selectedTaskId} onSelectTask={(taskId) => updateParam('taskId', taskId)} onViewDetails={(taskId) => navigate(PATHS.projectTaskDetail(projectId, taskId), { state: { from: `${PATHS.projectTasks(projectId)}?taskId=${encodeURIComponent(taskId)}` } })} onRetry={() => void query.refetch()} />
          {!query.isLoading && query.hasNextPage ? <div className={styles.loadMore}><Button onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>加载更多</Button></div> : null}
        </main>
        <TaskContextPanel task={selectedTask} taskId={selectedTaskId} panel={panel} onPanelChange={handlePanelChange} />
      </div>
    </ConfigProvider>
  )
}

interface TaskCenterContentProps {
  query: ReturnType<typeof useInfiniteTasks>
  tasks: Task[]
  view: TaskCenterView
  selectedTaskId?: string
  hasServerItems: boolean
  isUnfiltered: boolean
  onSelectTask: (taskId: string) => void
  onViewDetails: (taskId: string) => void
  onRetry: () => void
}

function TaskCenterContent({ query, tasks, view, selectedTaskId, hasServerItems, isUnfiltered, onSelectTask, onViewDetails, onRetry }: TaskCenterContentProps) {
  if (query.isLoading) return <div className={styles.state} role="status"><Spin description="正在加载任务" /></div>
  if (query.isError && !query.data) {
    const forbidden = query.error instanceof ApiError && query.error.status === 403
    return <Result className={styles.result} status={forbidden ? '403' : 'error'} title={forbidden ? '暂无权限查看任务' : '任务加载失败'} subTitle={forbidden ? '请联系项目管理员开通访问权限。' : '请稍后重试。'} extra={<Button onClick={onRetry}>重新加载</Button>} />
  }
  if (tasks.length === 0) return <div className={styles.state}><Empty className={styles.empty} description={!hasServerItems && isUnfiltered ? '项目暂无任务' : '当前筛选暂无匹配任务'} /></div>
  return <>
    {query.isFetchNextPageError ? <Alert type="error" showIcon title="下一页任务加载失败，当前列表已保留" action={<Button size="small" onClick={() => void query.fetchNextPage()}>重试</Button>} className={styles.pageError} /> : null}
    <TaskList tasks={tasks} view={view} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} onViewDetails={onViewDetails} />
  </>
}

function parseStatus(value: string | null): TaskCenterStatusFilter {
  return TASK_CENTER_STATUS_OPTIONS.some((option) => option.value === value) ? value as TaskCenterStatusFilter : 'all'
}

function uniqueOptions(options: Array<{ label: string; value: string }>) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
}
