import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorPage, OrchestrationRun, TaskRun, WorkPackage } from '@/types'
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
})

describe('TaskDetailPage routing and URL state', () => {
  it('restores WorkPackage and TaskRun selections after refresh', () => {
    renderPage('/app/projects/project-test/tasks/run-1?workPackageId=wp-1&taskRunId=task-run-1')

    expect(screen.getAllByText('任务 ID：run-1').length).toBeGreaterThan(0)
    expect(useExecutionContextMock).toHaveBeenCalledWith('project-test', 'task-run-1')
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
})
