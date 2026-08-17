import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Alert, Button, ConfigProvider, Empty, Result, Segmented, Space, Spin, theme, Typography, type ThemeConfig } from 'antd'
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useInfiniteTasks } from '@/hooks/task-model'
import type { TaskListItem } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { TaskFilters } from './TaskFilters'
import { TaskList } from './TaskList'
import { TASK_CENTER_STATUS_OPTIONS, type TaskCenterStatusFilter, type TaskCenterView } from './taskCenterConfig'
import { taskRepositories } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

const { Title, Text } = Typography
const PAGE_SIZE = 20
const DEFAULT_VISIBLE_TASKS = 8
const TASK_CARD_WIDTH = 285
const MIN_TASK_CARD_GAP = 16
const SEARCH_PARAMS = new Set(['status', 'groupId', 'createdBy', 'repositoryId', 'view'])

const taskCenterTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: { colorPrimary: '#0d9b9b', colorBgBase: '#ffffff', colorBgContainer: '#ffffff', colorBgElevated: '#ffffff', colorText: '#12213d', colorTextSecondary: '#6d7d95', colorBorder: '#e4eaf2', colorFillAlter: '#f7f9fc', borderRadius: 8 },
}

export default function TaskCenterPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const status = parseStatus(searchParams.get('status'))
  const groupId = searchParams.get('groupId') ?? undefined
  const createdBy = searchParams.get('createdBy') ?? undefined
  const repositoryId = searchParams.get('repositoryId') ?? undefined
  const legacyTaskId = searchParams.get('taskId')?.trim() || undefined
  const view = searchParams.get('view') === 'table' ? 'table' : 'board'
  const query = useInfiniteTasks(projectId, { groupId, status: status === 'all' ? undefined : status, createdBy, repositoryId, limit: PAGE_SIZE })
  const mainRef = useRef<HTMLElement>(null)
  const { visibleTaskCount, cardGap } = useTaskBoardLayout(mainRef)
  const [currentPage, setCurrentPage] = useState(1)

  const tasks = useMemo(() => {
    const seen = new Map<string, TaskListItem>()
    query.data?.pages.flatMap((page) => page.data).forEach((task) => seen.set(task.id, task))
    return [...seen.values()]
  }, [query.data])
  const groupOptions = useMemo(() => uniqueOptions(tasks.map((task) => ({ label: task.requirementGroup?.name || '暂无', value: task.requirementGroup?.id ?? '' }))), [tasks])
  const repositoryOptions = useMemo(() => uniqueOptions(tasks.flatMap((task) => taskRepositories(task).map((repository) => ({ label: repository.name, value: repository.repositoryId })))), [tasks])
  const createdByOptions = useMemo(() => uniqueOptions(tasks.flatMap((task) => task.createdByUser ? [{ label: task.createdByUser.displayName, value: task.createdByUser.id }] : [])), [tasks])
  const hasServerItems = query.data?.pages.some((page) => page.data.length > 0) ?? false
  const isUnfiltered = status === 'all' && !createdBy && !groupId && !repositoryId
  const pageStart = (currentPage - 1) * visibleTaskCount
  const visibleTasks = tasks.slice(pageStart, pageStart + visibleTaskCount)
  const hasPreviousPage = currentPage > 1
  const hasLoadedNextPage = pageStart + visibleTaskCount < tasks.length
  const hasNextPage = hasLoadedNextPage || query.hasNextPage

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of Array.from(next.keys())) {
      if (key === 'taskId') continue
      if (!SEARCH_PARAMS.has(key)) { next.delete(key); changed = true }
    }
    if (legacyTaskId) {
      next.delete('taskId')
      const search = next.toString()
      const from = `${PATHS.projectTasks(projectId)}${search ? `?${search}` : ''}`
      navigate(`${PATHS.projectTaskDetail(projectId, legacyTaskId)}${search ? `?${search}` : ''}`, { replace: true, state: { from } })
      return
    }
    if (changed) setSearchParams(next, { replace: true })
  }, [legacyTaskId, navigate, projectId, searchParams, setSearchParams])

  useEffect(() => {
    setCurrentPage(1)
  }, [groupId, status, createdBy, repositoryId, visibleTaskCount])

  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    for (const key of ['status', 'createdBy', 'groupId', 'repositoryId']) next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function viewTask(taskId: string) {
    const search = searchParams.toString()
    const from = `${PATHS.projectTasks(projectId)}${search ? `?${search}` : ''}`
    navigate(`${PATHS.projectTaskDetail(projectId, taskId)}${search ? `?${search}` : ''}`, { state: { from } })
  }

  async function showNextPage() {
    if (hasLoadedNextPage) {
      setCurrentPage((page) => page + 1)
      return
    }
    if (!query.hasNextPage || query.isFetchingNextPage) return
    try {
      await query.fetchNextPage()
      setCurrentPage((page) => page + 1)
    } catch {
      // The existing inline next-page error keeps the current page visible.
    }
  }

  return (
    <ConfigProvider theme={taskCenterTheme}>
      <div className={styles.page}>
        <main ref={mainRef} className={styles.main} style={{ '--task-card-gap': `${cardGap}px` } as CSSProperties}>
          <header className={styles.header}>
            <Title level={2} className={styles.title}>任务中心 <Text type="secondary">（按需求分组）</Text></Title>
            {query.isFetching && !query.isLoading ? <Spin size="small" /> : null}
          </header>
          <TaskFilters status={status} groupId={groupId} repositoryId={repositoryId} createdBy={createdBy} groupOptions={groupOptions} repositoryOptions={repositoryOptions} createdByOptions={createdByOptions} onStatusChange={(value) => updateParam('status', value === 'all' ? undefined : value)} onGroupChange={(value) => updateParam('groupId', value)} onRepositoryChange={(value) => updateParam('repositoryId', value)} onCreatedByChange={(value) => updateParam('createdBy', value)} onReset={resetFilters} />
          <div className={styles.listHeading}><Space><Text strong>任务列表</Text><Text type="secondary">{tasks.length} 项</Text></Space><Segmented<TaskCenterView> aria-label="任务视图" value={view} onChange={(nextView) => updateParam('view', nextView)} options={[{ value: 'board', label: '看板', icon: <AppstoreOutlined /> }, { value: 'table', label: '表格', icon: <UnorderedListOutlined /> }]} /></div>
          <TaskCenterContent query={query} tasks={visibleTasks} hasServerItems={hasServerItems} isUnfiltered={isUnfiltered} view={view} onViewDetails={viewTask} onRetry={() => void query.refetch()} />
          {!query.isLoading && tasks.length > 0 ? <nav className={styles.pagination} aria-label="任务列表分页"><Button disabled={!hasPreviousPage} onClick={() => setCurrentPage((page) => page - 1)}>上一页</Button><Text type="secondary">第 {currentPage} 页</Text><Button disabled={!hasNextPage} loading={query.isFetchingNextPage} onClick={() => void showNextPage()}>下一页</Button></nav> : null}
          {!query.isLoading && query.hasNextPage ? <div className={styles.loadMore}><Button onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>加载更多</Button></div> : null}
        </main>
      </div>
    </ConfigProvider>
  )
}

interface TaskCenterContentProps {
  query: ReturnType<typeof useInfiniteTasks>
  tasks: TaskListItem[]
  view: TaskCenterView
  hasServerItems: boolean
  isUnfiltered: boolean
  onViewDetails: (taskId: string) => void
  onRetry: () => void
}

function TaskCenterContent({ query, tasks, view, hasServerItems, isUnfiltered, onViewDetails, onRetry }: TaskCenterContentProps) {
  if (query.isLoading) return <div className={styles.state} role="status"><Spin description="正在加载任务" /></div>
  if (query.isError && !query.data) {
    const forbidden = query.error instanceof ApiError && query.error.status === 403
    return <Result className={styles.result} status={forbidden ? '403' : 'error'} title={forbidden ? '暂无权限查看任务' : '任务加载失败'} subTitle={forbidden ? '请联系项目管理员开通访问权限。' : '请稍后重试。'} extra={<Button onClick={onRetry}>重新加载</Button>} />
  }
  if (tasks.length === 0) return <div className={styles.state}><Empty className={styles.empty} description={!hasServerItems && isUnfiltered ? '项目暂无任务' : '当前筛选暂无匹配任务'} /></div>
  return <>{query.isFetchNextPageError ? <Alert type="error" showIcon title="下一页任务加载失败，当前列表已保留" action={<Button size="small" onClick={onRetry}>重试</Button>} className={styles.pageError} /> : null}<TaskList tasks={tasks} view={view} onViewDetails={onViewDetails} /></>
}

function parseStatus(value: string | null): TaskCenterStatusFilter {
  return TASK_CENTER_STATUS_OPTIONS.some((option) => option.value === value) ? value as TaskCenterStatusFilter : 'all'
}

function uniqueOptions(options: Array<{ label: string; value: string }>) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
}

function useTaskBoardLayout(mainRef: RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState({ visibleTaskCount: DEFAULT_VISIBLE_TASKS, cardGap: MIN_TASK_CARD_GAP })

  useEffect(() => {
    const element = mainRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const update = () => {
      const width = element.clientWidth
      const contentWidth = Math.max(width - 64, 1)
      const columns = Math.max(1, Math.floor((contentWidth + MIN_TASK_CARD_GAP) / (TASK_CARD_WIDTH + MIN_TASK_CARD_GAP)))
      const cardGap = columns > 1 ? Math.max(MIN_TASK_CARD_GAP, (contentWidth - columns * TASK_CARD_WIDTH) / (columns - 1)) : MIN_TASK_CARD_GAP
      setLayout({ visibleTaskCount: columns * 2, cardGap })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mainRef])

  return layout
}
