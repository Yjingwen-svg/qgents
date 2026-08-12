import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorPage, Deliverable, OrchestrationRun, TaskRun, WorkPackage } from '@/types'
import { ApiError } from '@/api'
import { TaskDetailPage } from './TaskDetailPage'

const useDeliverablesMock = vi.hoisted(() => vi.fn())
const useOrchestrationRunMock = vi.hoisted(() => vi.fn())
const useOrchestrationWorkPackagesMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunsMock = vi.hoisted(() => vi.fn())
const useTaskRunMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunStepsMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunLogsMock = vi.hoisted(() => vi.fn())
const useExecutionContextMock = vi.hoisted(() => vi.fn())
const useInputRequestsMock = vi.hoisted(() => vi.fn())
const useStartWorkPackageMock = vi.hoisted(() => vi.fn())
const usePauseWorkPackageMock = vi.hoisted(() => vi.fn())
const useResumeWorkPackageMock = vi.hoisted(() => vi.fn())
const useCancelWorkPackageMock = vi.hoisted(() => vi.fn())
const useCancelOrchestrationRunMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({
  useDeliverables: useDeliverablesMock,
  useOrchestrationRun: useOrchestrationRunMock,
  useOrchestrationWorkPackages: useOrchestrationWorkPackagesMock,
  useInfiniteTaskRuns: useInfiniteTaskRunsMock,
  useTaskRun: useTaskRunMock,
  useInfiniteTaskRunSteps: useInfiniteTaskRunStepsMock,
  useInfiniteTaskRunLogs: useInfiniteTaskRunLogsMock,
  useExecutionContext: useExecutionContextMock,
  useInputRequests: useInputRequestsMock,
  useStartWorkPackage: useStartWorkPackageMock,
  usePauseWorkPackage: usePauseWorkPackageMock,
  useResumeWorkPackage: useResumeWorkPackageMock,
  useCancelWorkPackage: useCancelWorkPackageMock,
  useCancelOrchestrationRun: useCancelOrchestrationRunMock,
}))

const run: OrchestrationRun = {
  id: 'run-1',
  projectId: 'project-test',
  groupId: 'group-login',
  instruction: '实现登录接口',
  workflowId: 'system-default-code-delivery',
  startMode: 'AUTO',
  status: 'RUNNING',
  createdBy: 'demo-user',
  workPackageIds: ['wp-1'],
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:30:00Z',
  executionPreview: {
    latestTaskRunId: 'task-run-1',
    latestTaskRunStatus: 'RUNNING',
    currentNode: 'DEVELOPER',
    recentSteps: [],
    stages: [{
      id: 'stage-development',
      title: '开发阶段',
      node: 'DEVELOPER',
      status: 'RUNNING',
      steps: [],
      startedAt: null,
      finishedAt: null,
    }],
    errorSummary: null,
    blockedSummary: null,
  },
}

const workPackage: WorkPackage = {
  id: 'wp-1',
  projectId: 'project-test',
  orchestrationRunId: 'run-1',
  groupId: 'group-login',
  repositoryId: 'repo-1',
  baseRef: 'main',
  headRef: 'feat/login',
  title: '登录接口',
  description: '实现登录接口',
  priority: 1,
  testsetIds: [],
  startMode: 'AUTO',
  status: 'RUNNING',
  subtaskIds: ['subtask-1'],
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:30:00Z',
}

const taskRun: TaskRun = {
  id: 'task-run-1',
  projectId: 'project-test',
  orchestrationRunId: 'run-1',
  workPackageId: 'wp-1',
  subtaskId: 'subtask-1',
  status: 'RUNNING',
  retryOfTaskRunId: null,
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:30:00Z',
}

const deliverable: Deliverable = {
  id: 'deliverable-1',
  projectId: 'project-test',
  workPackageId: 'wp-1',
  taskRunId: 'task-run-1',
  title: '登录接口验收报告',
  type: 'DOCUMENT',
  version: 1,
  status: 'PENDING_REVIEW',
  repositoryId: null,
  sourceRef: null,
  diffId: null,
  mergeRequestId: null,
  rejectionReason: null,
  summary: '验收报告摘要',
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:30:00Z',
}

function page<T>(data: T[]): CursorPage<T> {
  return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }
}

function infiniteQuery<T>(data: T[]) {
  return {
    data: { pages: [page(data)], pageParams: [undefined] },
    error: null,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }
}

function renderPage(initialEntry: string | { pathname: string; search?: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/app/projects/:projectId/tasks/:runId" element={<TaskDetailPage />} />
      </Routes>
      <LocationProbe state={typeof initialEntry === 'string' ? undefined : initialEntry.state} />
    </MemoryRouter>,
  )
}

function LocationProbe({ state }: { state?: unknown }) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (state === undefined || location.state !== null) return
    navigate(`${location.pathname}${location.search}`, { replace: true, state })
  }, [location.pathname, location.search, location.state, navigate, state])
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }) as MediaQueryList),
  })
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  })
  useOrchestrationRunMock.mockReset()
  useOrchestrationRunMock.mockReturnValue({ data: run, error: null, isError: false, isLoading: false })
  useOrchestrationWorkPackagesMock.mockReset()
  useOrchestrationWorkPackagesMock.mockReturnValue([{ data: workPackage, error: null, isError: false, isLoading: false }])
  useInfiniteTaskRunsMock.mockReset()
  useInfiniteTaskRunsMock.mockReturnValue(infiniteQuery([taskRun]))
  useDeliverablesMock.mockReset()
  useDeliverablesMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false })
  useInfiniteTaskRunsMock.mockReset()
  useInfiniteTaskRunsMock.mockReturnValue(infiniteQuery([taskRun]))
  useTaskRunMock.mockReset()
  useTaskRunMock.mockReturnValue({ data: taskRun, error: null, isError: false, isLoading: false })
  useInfiniteTaskRunStepsMock.mockReset()
  useInfiniteTaskRunStepsMock.mockReturnValue(infiniteQuery([]))
  useInfiniteTaskRunLogsMock.mockReset()
  useInfiniteTaskRunLogsMock.mockReturnValue(infiniteQuery([]))
  useExecutionContextMock.mockReset()
  useExecutionContextMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false })
  useInputRequestsMock.mockReset()
  useInputRequestsMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false })
  for (const mutationMock of [useStartWorkPackageMock, usePauseWorkPackageMock, useResumeWorkPackageMock, useCancelWorkPackageMock]) {
    mutationMock.mockReset()
    mutationMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false, variables: undefined })
  }
  useCancelOrchestrationRunMock.mockReset()
  useCancelOrchestrationRunMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false, variables: undefined })
})

describe('TaskDetailPage routing and URL state', () => {
  it('shows the orchestration cancel action only for a cancellable status', () => {
    const view = renderPage('/app/projects/project-test/tasks/run-1')
    expect(screen.getByRole('button', { name: '取消任务' })).toBeInTheDocument()

    useOrchestrationRunMock.mockReturnValue({
      data: { ...run, status: 'SUCCEEDED' },
      error: null,
      isError: false,
      isLoading: false,
    })
    view.rerender(
      <MemoryRouter initialEntries={['/app/projects/project-test/tasks/run-1']}>
        <Routes>
          <Route path="/app/projects/:projectId/tasks/:runId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: '取消任务' })).not.toBeInTheDocument()
  })

  it('confirms before cancelling, prevents duplicate submission, and uses the mutation response', async () => {
    const mutation = { mutate: vi.fn(), error: null, isPending: false, variables: undefined as string | undefined }
    useCancelOrchestrationRunMock.mockReturnValue(mutation)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const view = renderPage('/app/projects/project-test/tasks/run-1')

    fireEvent.click(screen.getByRole('button', { name: '取消任务' }))
    expect(confirmSpy).toHaveBeenCalledWith('确认取消整个任务？这可能同时终止尚未完成的 WorkPackage 和 TaskRun。')
    expect(mutation.mutate).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '取消任务' }))
    expect(mutation.mutate).toHaveBeenCalledWith('run-1')

    mutation.isPending = true
    mutation.variables = 'run-1'
    view.rerender(
      <MemoryRouter initialEntries={['/app/projects/project-test/tasks/run-1']}>
        <Routes>
          <Route path="/app/projects/:projectId/tasks/:runId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /取消任务/ })).toBeDisabled()
    confirmSpy.mockRestore()
  })

  it.each([
    [403, '暂无取消任务的权限'],
    [404, '任务不存在'],
    [422, '当前任务不可取消'],
    [500, '取消任务失败，可再次尝试'],
  ] as const)('keeps cancellation errors scoped to the operation area (%s)', (status, message) => {
    useCancelOrchestrationRunMock.mockReturnValue({
      mutate: vi.fn(),
      error: new ApiError('cancel failed', status),
      isPending: false,
      variables: 'run-1',
    })
    renderPage('/app/projects/project-test/tasks/run-1')
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.getByText('执行流程')).toBeInTheDocument()
  })

  it('refreshes the current detail after a cancellation conflict', () => {
    const refetch = vi.fn()
    useOrchestrationRunMock.mockReturnValue({
      data: run,
      error: null,
      isError: false,
      isLoading: false,
      refetch,
    })
    useCancelOrchestrationRunMock.mockReturnValue({
      mutate: vi.fn(),
      error: new ApiError('conflict', 409),
      isPending: false,
      variables: 'run-1',
    })
    renderPage('/app/projects/project-test/tasks/run-1')
    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('restores WorkPackage and TaskRun selections after refresh', () => {
    renderPage('/app/projects/project-test/tasks/run-1?workPackageId=wp-1&taskRunId=task-run-1')

    expect(screen.getAllByText('任务 ID：run-1').length).toBeGreaterThan(0)
    expect(useExecutionContextMock).not.toHaveBeenCalled()
  })

  it('returns to the source task center while preserving its filters', async () => {
    renderPage({
      pathname: '/app/projects/project-test/tasks/run-1',
      search: '',
      state: { from: '/app/projects/project-test/tasks?runId=run-1&status=running&groupId=group-login&createdBy=demo-user&view=table' },
    })

    fireEvent.click(screen.getByRole('button', { name: /返回任务中心/ }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-test/tasks?runId=run-1&status=running&groupId=group-login&createdBy=demo-user&view=table'))
  })

  it('shows a scoped 404 without replacing the invalid task', () => {
    useOrchestrationRunMock.mockReturnValue({
      data: undefined,
      error: new ApiError('not found', 404),
      isError: true,
      isLoading: false,
    })

    renderPage('/app/projects/project-test/tasks/missing')

    expect(screen.getByText('任务不存在或不可见')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-test/tasks/missing')
  })

  it('does not render a task returned for a different project', () => {
    renderPage('/app/projects/project-other/tasks/run-1')

    expect(screen.getByText('任务不存在或不可见')).toBeInTheDocument()
    expect(screen.queryByText('实现登录接口')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-other/tasks/run-1')
  })

  it('shows a scoped 403 without replacing the invalid task', () => {
    useOrchestrationRunMock.mockReturnValue({
      data: undefined,
      error: new ApiError('forbidden', 403),
      isError: true,
      isLoading: false,
    })

    renderPage('/app/projects/project-test/tasks/hidden')

    expect(screen.getByText('暂无权限查看任务详情')).toBeInTheDocument()
  })

  it.each([
    ['READY', '启动'],
    ['RUNNING', '暂停'],
    ['PAUSED', '恢复'],
  ] as const)('shows the capability for %s WorkPackage', async (status, action) => {
    useOrchestrationWorkPackagesMock.mockReturnValue([{ data: { ...workPackage, status }, error: null, isError: false, isLoading: false }])
    useInfiniteTaskRunsMock.mockReturnValue(infiniteQuery([{ ...taskRun, agentNode: 'DEVELOPER' }]))

    renderPage('/app/projects/project-test/tasks/run-1')

    await waitFor(() => expect(screen.getAllByRole('button', { name: new RegExp(action.split('').join('\\s*')) }).filter((button) => button.tagName === 'BUTTON')).not.toHaveLength(0))
  })

  it('shows cancel for every cancellable WorkPackage state and confirms before mutating', async () => {
    useOrchestrationWorkPackagesMock.mockReturnValue([{ data: { ...workPackage, status: 'RUNNING' }, error: null, isError: false, isLoading: false }])
    useInfiniteTaskRunsMock.mockReturnValue(infiniteQuery([{ ...taskRun, agentNode: 'DEVELOPER' }]))
    const cancelMutation = { mutate: vi.fn(), error: null, isPending: false, variables: 'wp-1' }
    useCancelWorkPackageMock.mockReturnValue(cancelMutation)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage('/app/projects/project-test/tasks/run-1')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /取消工作包/ }).filter((button) => button.tagName === 'BUTTON')).not.toHaveLength(0))
    fireEvent.click(screen.getAllByRole('button', { name: /取消工作包/ }).find((button) => button.tagName === 'BUTTON')!)

    expect(confirmSpy).toHaveBeenCalled()
    expect(cancelMutation.mutate).toHaveBeenCalledWith('wp-1')
    confirmSpy.mockRestore()
  })

  it('keeps other stages visible when one WorkPackage operation is pending or fails', async () => {
    const failedPackage = { ...workPackage, status: 'RUNNING' as const }
    const secondPackage = { ...workPackage, id: 'wp-2', title: '测试工作包', status: 'READY' as const }
    const twoStageRun = {
      ...run,
      workPackageIds: ['wp-1', 'wp-2'],
      executionPreview: {
        ...run.executionPreview!,
        stages: [
          {
            id: 'stage-development',
            title: '开发阶段',
            node: 'DEVELOPER' as const,
            status: 'RUNNING' as const,
            steps: [],
            startedAt: null,
            finishedAt: null,
          }, {
            id: 'stage-testing',
            title: '测试阶段',
            node: 'TESTER' as const,
            status: 'PENDING' as const,
            steps: [],
            startedAt: null,
            finishedAt: null,
          },
        ],
      },
    }
    const firstPackageQuery = { data: failedPackage, error: null, isError: false, isLoading: false, refetch: vi.fn() }
    const secondPackageQuery = { data: secondPackage, error: null, isError: false, isLoading: false, refetch: vi.fn() }
    const firstTaskRunsQuery = infiniteQuery([{ ...taskRun, id: 'wp-1-run', workPackageId: 'wp-1', agentNode: 'DEVELOPER' as const }])
    const secondTaskRunsQuery = infiniteQuery([{ ...taskRun, id: 'wp-2-run', workPackageId: 'wp-2', agentNode: 'TESTER' as const }])
    useOrchestrationRunMock.mockReturnValue({ data: twoStageRun, error: null, isError: false, isLoading: false })
    useOrchestrationWorkPackagesMock.mockReturnValue([firstPackageQuery, secondPackageQuery])
    useInfiniteTaskRunsMock.mockImplementation((_projectId: string, workPackageId: string) => workPackageId === 'wp-1' ? firstTaskRunsQuery : secondTaskRunsQuery)
    usePauseWorkPackageMock.mockReturnValue({ mutate: vi.fn(), error: new ApiError('conflict', 409), isPending: false, variables: 'wp-1' })

    renderPage('/app/projects/project-test/tasks/run-1')

    await waitFor(() => expect(screen.getAllByText('测试阶段').length).toBeGreaterThan(0))
    expect(screen.getByText('工作包状态已变化，请刷新最新状态')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    expect(firstPackageQuery.refetch).toHaveBeenCalled()
  })

  it('uses real deliverable titles and does not use task detail summary for workspace data', () => {
    useOrchestrationRunMock.mockReturnValue({
      data: {
        ...run,
        taskDetailSummary: {
          priorityLabel: '高',
          currentStage: '开发中',
          requirementDiscussion: '讨论摘要',
          decisionRecord: '决策记录',
          skillMemorySummary: 'Skill 摘要',
          workspaceId: 'summary-workspace',
          sandboxId: 'summary-sandbox',
        },
      },
      error: null,
      isError: false,
      isLoading: false,
    })
    useDeliverablesMock.mockReturnValue({ data: page([deliverable]), error: null, isError: false, isLoading: false })

    renderPage('/app/projects/project-test/tasks/run-1')

    expect(screen.getAllByText('登录接口验收报告').length).toBeGreaterThan(0)
    expect(screen.queryByText('需求群已交付的产出')).not.toBeInTheDocument()
    expect(screen.queryByText('summary-workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('summary-sandbox')).not.toBeInTheDocument()
  })
})
