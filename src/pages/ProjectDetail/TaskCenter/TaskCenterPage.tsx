import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Result,
  Segmented,
  Space,
  Spin,
  theme,
  Typography,
  type ThemeConfig,
} from 'antd'
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useInfiniteOrchestrationRuns } from '@/hooks'
import type { OrchestrationRun } from '@/types'
import { TaskContextPanel } from './TaskContextPanel'
import { TaskFilters } from './TaskFilters'
import { TaskList } from './TaskList'
import {
  TASK_CENTER_STATUS_GROUPS,
  type TaskCenterPanel,
  type TaskCenterStatusFilter,
  type TaskCenterView,
} from './taskCenterConfig'
import { getTaskCenterPresentation } from './taskCenterPresentation'
import styles from './TaskCenterPage.module.scss'

const { Title, Text } = Typography
const PAGE_SIZE = 20

const taskCenterTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#0d9b9b',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorText: '#12213d',
    colorTextSecondary: '#6d7d95',
    colorBorder: '#e4eaf2',
    colorFillAlter: '#f7f9fc',
    borderRadius: 8,
  },
}

export function TaskCenterPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<TaskCenterView>('board')
  const previousProjectId = useRef(projectId)

  const status = parseStatusFilter(searchParams.get('status'))
  const createdBy = searchParams.get('createdBy') ?? undefined
  const groupId = searchParams.get('groupId') ?? undefined
  const requestedRunId = searchParams.get('runId')?.trim() || undefined
  const panel = parsePanel(searchParams.get('panel'))
  const projectChanged = previousProjectId.current !== projectId
  const projectScopedRunId = projectChanged ? undefined : requestedRunId
  const query = useInfiniteOrchestrationRuns(projectId, {
    createdBy,
    groupId,
    limit: PAGE_SIZE,
  })

  const loadedRuns = useMemo(() => {
    const seen = new Map<string, OrchestrationRun>()
    query.data?.pages.flatMap((page) => page.data).forEach((run) => seen.set(run.id, run))
    return [...seen.values()]
  }, [query.data])

  const visibleRuns = useMemo(
    () =>
      loadedRuns.filter((run) => {
        if (status === 'all') return true
        return TASK_CENTER_STATUS_GROUPS[status].has(run.status)
      }),
    [loadedRuns, status],
  )
  const hasServerItems = query.data?.pages.some((page) => page.data.length > 0) ?? false
  const isUnfiltered = status === 'all' && !createdBy && !groupId
  const selectedRunId = projectScopedRunId ?? visibleRuns[0]?.id
  const selectedRun = visibleRuns.find((run) => run.id === selectedRunId)

  useEffect(() => {
    if (previousProjectId.current === projectId) return
    previousProjectId.current = projectId
    if (!requestedRunId) return
    const next = new URLSearchParams(searchParams)
    next.delete('runId')
    setSearchParams(next, { replace: true })
  }, [projectId, requestedRunId, searchParams, setSearchParams])

  const groupOptions = useMemo(
    () =>
      uniqueOptions(
        loadedRuns.map((run) => ({
          label: getTaskCenterPresentation(run).groupLabel,
          value: run.groupId,
        })),
      ),
    [loadedRuns],
  )

  function updateFilter(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function handleReset() {
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    next.delete('createdBy')
    next.delete('groupId')
    setSearchParams(next, { replace: true })
  }

  function handleSelectRun(runId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('runId', runId)
    setSearchParams(next, { replace: true })
  }

  function handlePanelChange(nextPanel: TaskCenterPanel) {
    const next = new URLSearchParams(searchParams)
    next.set('panel', nextPanel)
    setSearchParams(next, { replace: true })
  }

  return (
    <ConfigProvider theme={taskCenterTheme}>
      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.header}>
            <Title level={2} className={styles.title}>
              任务中心 <Text type="secondary">（按需求分组）</Text>
            </Title>
            <Space>
              {query.isFetching && !query.isLoading ? <Spin size="small" /> : null}
              <Button className={styles.contextButton}>返回需求群上下文</Button>
            </Space>
          </header>

          <TaskFilters
            status={status}
            groupId={groupId}
            groupOptions={groupOptions}
            onStatusChange={(value) => updateFilter('status', value === 'all' ? undefined : value)}
            onGroupChange={(value) => updateFilter('groupId', value)}
            onReset={handleReset}
          />

          <div className={styles.listHeading}>
            <Space>
              <Text strong>任务列表</Text>
              <Text type="secondary">{visibleRuns.length} 项</Text>
            </Space>
            <Segmented<TaskCenterView>
              aria-label="任务视图"
              value={view}
              onChange={setView}
              options={[
                { value: 'board', label: '看板', icon: <AppstoreOutlined /> },
                { value: 'table', label: '表格', icon: <UnorderedListOutlined /> },
              ]}
            />
          </div>

          <TaskCenterContent
            query={query}
            runs={visibleRuns}
            view={view}
            selectedRunId={selectedRun?.id}
            hasServerItems={hasServerItems}
            isUnfiltered={isUnfiltered}
            onSelectRun={handleSelectRun}
            onRetry={() => void query.refetch()}
          />

          {!query.isLoading && query.hasNextPage ? (
            <div className={styles.loadMore}>
              <Button onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                加载更多
              </Button>
            </div>
          ) : null}
        </main>
        <TaskContextPanel
          projectId={projectId}
          runId={selectedRunId}
          summaryRun={selectedRun}
          panel={panel}
          onPanelChange={handlePanelChange}
        />
      </div>
    </ConfigProvider>
  )
}

interface TaskCenterContentProps {
  query: ReturnType<typeof useInfiniteOrchestrationRuns>
  runs: OrchestrationRun[]
  view: TaskCenterView
  selectedRunId?: string
  hasServerItems: boolean
  isUnfiltered: boolean
  onSelectRun: (runId: string) => void
  onRetry: () => void
}

function TaskCenterContent({
  query,
  runs,
  view,
  selectedRunId,
  hasServerItems,
  isUnfiltered,
  onSelectRun,
  onRetry,
}: TaskCenterContentProps) {
  if (query.isLoading) {
    return (
      <div className={styles.state} role="status">
        <Spin description="正在加载任务" />
      </div>
    )
  }

  const isInitialError = query.isError && !query.data

  if (isInitialError) {
    const isForbidden = query.error instanceof ApiError && query.error.status === 403
    return (
      <Result
        className={styles.result}
        status={isForbidden ? '403' : 'error'}
        title={isForbidden ? '暂无权限查看任务' : '任务加载失败'}
        subTitle={isForbidden ? '请联系项目管理员开通访问权限。' : '请稍后重试，或检查项目访问权限。'}
        extra={<Button onClick={onRetry}>重新加载</Button>}
      />
    )
  }

  if (runs.length === 0) {
    return (
      <div className={styles.state}>
        <Empty
          className={styles.empty}
          description={!hasServerItems && isUnfiltered ? '项目暂无任务' : '当前已加载任务中暂无匹配项'}
        />
      </div>
    )
  }

  return (
    <>
      {query.isFetchNextPageError ? (
        <Alert
          type="error"
          showIcon
          title="下一页任务加载失败，已保留当前任务"
          action={<Button size="small" onClick={() => void query.fetchNextPage()}>重试</Button>}
          className={styles.pageError}
        />
      ) : null}
      <TaskList
        runs={runs}
        view={view}
        selectedRunId={selectedRunId}
        onSelectRun={onSelectRun}
      />
    </>
  )
}

function parseStatusFilter(value: string | null): TaskCenterStatusFilter {
  if (value === 'running' || value === 'waiting' || value === 'completed' || value === 'failed') {
    return value
  }
  return 'all'
}

function parsePanel(value: string | null): TaskCenterPanel {
  if (value === 'context' || value === 'detail' || value === 'executions') return value
  return 'context'
}

function uniqueOptions(options: Array<{ label: string; value: string }>) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
}
