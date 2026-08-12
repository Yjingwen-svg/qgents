import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorPage, OrchestrationRun, TaskRun, WorkPackage } from '@/types'
import { ApiError } from '@/api'
import { TaskRunDetailPage } from './TaskRunDetailPage'

const useOrchestrationRunMock = vi.hoisted(() => vi.fn())
const useOrchestrationWorkPackagesMock = vi.hoisted(() => vi.fn())
const useTaskRunMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunsMock = vi.hoisted(() => vi.fn())
const useTaskRunStepsMock = vi.hoisted(() => vi.fn())
const useTaskRunLogsMock = vi.hoisted(() => vi.fn())
const useExecutionContextMock = vi.hoisted(() => vi.fn())
const useInputRequestsMock = vi.hoisted(() => vi.fn())
const useReplyInputRequestMock = vi.hoisted(() => vi.fn())
const useApproveInputRequestMock = vi.hoisted(() => vi.fn())
const useRejectInputRequestMock = vi.hoisted(() => vi.fn())
const useRetryTaskRunMock = vi.hoisted(() => vi.fn())
const useCancelTaskRunMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({
  useOrchestrationRun: useOrchestrationRunMock,
  useOrchestrationWorkPackages: useOrchestrationWorkPackagesMock,
  useTaskRun: useTaskRunMock,
  useInfiniteTaskRuns: useInfiniteTaskRunsMock,
  useInfiniteTaskRunSteps: useTaskRunStepsMock,
  useInfiniteTaskRunLogs: useTaskRunLogsMock,
  useExecutionContext: useExecutionContextMock,
  useInputRequests: useInputRequestsMock,
  useReplyInputRequest: useReplyInputRequestMock,
  useApproveInputRequest: useApproveInputRequestMock,
  useRejectInputRequest: useRejectInputRequestMock,
  useRetryTaskRun: useRetryTaskRunMock,
  useCancelTaskRun: useCancelTaskRunMock,
}))

const run: OrchestrationRun = {
  id: 'run-1', projectId: 'project-test', groupId: 'group-1', instruction: '登录任务',
  workflowId: 'workflow-1', startMode: 'AUTO', status: 'RUNNING', createdBy: 'user-1',
  workPackageIds: ['wp-1'], createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z',
}
const workPackage: WorkPackage = {
  id: 'wp-1', projectId: 'project-test', orchestrationRunId: 'run-1', groupId: 'group-1',
  repositoryId: 'repo-1', baseRef: 'main', headRef: 'feat/login', title: '开发登录', description: '开发登录',
  priority: 1, testsetIds: [], startMode: 'AUTO', status: 'RUNNING', subtaskIds: ['subtask-1'],
  createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z',
}
const taskRun: TaskRun = {
  id: 'task-run-1', projectId: 'project-test', orchestrationRunId: 'run-1', workPackageId: 'wp-1',
  subtaskId: 'subtask-1', subtaskTitle: '开发步骤', status: 'WAITING_INPUT', retryOfTaskRunId: null,
  createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z',
}

function page<T>(data: T[]): CursorPage<T> {
  return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }
}

function infiniteQuery<T>(data: T[]) {
  return { data: { pages: [page(data)], pageParams: [undefined] }, error: null, isError: false, isFetching: false, isFetchingNextPage: false, isLoading: false, hasNextPage: false, fetchNextPage: vi.fn() }
}

function renderPage(path = '/app/projects/project-test/tasks/run-1/executions/task-run-1') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/tasks/:runId/executions/:taskRunId" element={<TaskRunDetailPage />} /><Route path="/app/projects/:projectId/tasks/:runId" element={<div>任务详情页</div>} /></Routes><LocationProbe /></MemoryRouter>)
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
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
  useOrchestrationRunMock.mockReturnValue({ data: run, error: null, isError: false, isLoading: false })
  useOrchestrationWorkPackagesMock.mockReturnValue([{ data: workPackage, error: null, isError: false, isLoading: false }])
  useTaskRunMock.mockReturnValue({ data: taskRun, error: null, isError: false, isLoading: false })
  useInfiniteTaskRunsMock.mockReturnValue(infiniteQuery([taskRun]))
  useTaskRunStepsMock.mockReturnValue(infiniteQuery([]))
  useTaskRunLogsMock.mockReturnValue(infiniteQuery([]))
  useExecutionContextMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false })
  useInputRequestsMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false })
  const mutation = { mutate: vi.fn(), error: null, isPending: false }
  useReplyInputRequestMock.mockReturnValue(mutation)
  useApproveInputRequestMock.mockReturnValue(mutation)
  useRejectInputRequestMock.mockReturnValue(mutation)
  useRetryTaskRunMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
  useCancelTaskRunMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
})

describe('TaskRunDetailPage', () => {
  it('restores taskRunId and loads the single execution', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '开发步骤' })).toBeInTheDocument()
    expect(useTaskRunMock).toHaveBeenCalledWith('project-test', 'task-run-1')
  })

  it('returns to task detail', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /返回任务详情/ }))
    await waitFor(() => expect(screen.getByText('任务详情页')).toBeInTheDocument())
  })

  it.each([403, 404])('shows scoped %s for invalid execution', (status) => {
    useTaskRunMock.mockReturnValue({ data: undefined, error: new ApiError('failure', status), isError: true, isLoading: false })
    renderPage('/app/projects/project-test/tasks/run-1/executions/invalid')
    expect(screen.getByText(status === 403 ? '暂无权限查看TaskRun' : 'TaskRun不存在或不可见')).toBeInTheDocument()
  })

  it('does not replace a taskRun from another task', () => {
    useTaskRunMock.mockReturnValue({ data: { ...taskRun, orchestrationRunId: 'run-other' }, error: null, isError: false, isLoading: false })
    renderPage()
    expect(screen.getByText('TaskRun 不属于当前任务或不可见')).toBeInTheDocument()
  })

  it('shows retry for a retryable state and navigates to the server-created TaskRun', async () => {
    const failedTaskRun = { ...taskRun, status: 'FAILED' as const }
    const nextTaskRun = { ...failedTaskRun, id: 'task-run-2', status: 'QUEUED' as const, retryOfTaskRunId: failedTaskRun.id }
    useTaskRunMock.mockReturnValue({ data: failedTaskRun, error: null, isError: false, isLoading: false })
    const retryMutation = { mutate: vi.fn((_id: string, options: { onSuccess: (next: TaskRun) => void }) => options.onSuccess(nextTaskRun)), error: null, isPending: false }
    useRetryTaskRunMock.mockReturnValue(retryMutation)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))

    expect(retryMutation.mutate).toHaveBeenCalledWith('task-run-1', expect.any(Object))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('executions/task-run-2'))
    expect(confirmSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('does not show retry or cancel for a completed TaskRun', () => {
    useTaskRunMock.mockReturnValue({ data: { ...taskRun, status: 'SUCCEEDED' as const }, error: null, isError: false, isLoading: false })

    renderPage()

    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()
  })

  it('cancels a running TaskRun and keeps execution sections visible while mutating', () => {
    const cancelMutation = { mutate: vi.fn(), error: null, isPending: true }
    useCancelTaskRunMock.mockReturnValue(cancelMutation)
    useTaskRunStepsMock.mockReturnValue(infiniteQuery([{ id: 'step-1', projectId: 'project-test', taskRunId: 'task-run-1', node: 'DEVELOPER', status: 'RUNNING', startedAt: null, finishedAt: null, durationMs: null, errorCode: null }]))

    renderPage()

    expect(screen.getByRole('button', { name: /取\s*消/ })).toBeDisabled()
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('Execution Context')).toBeInTheDocument()
  })

  it('refreshes the current TaskRun after a conflict', async () => {
    const refetch = vi.fn()
    useTaskRunMock.mockReturnValue({ data: { ...taskRun, status: 'FAILED' as const }, error: null, isError: false, isLoading: false, refetch })
    useRetryTaskRunMock.mockReturnValue({
      mutate: vi.fn((_id: string, options: { onError: (error: ApiError) => void }) => options.onError(new ApiError('conflict', 409))),
      error: new ApiError('conflict', 409),
      isPending: false,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
    fireEvent.click(screen.getByRole('button', { name: /刷\s*新/ }))

    await waitFor(() => expect(refetch).toHaveBeenCalled())
    expect(screen.getByText('Steps')).toBeInTheDocument()
  })
})
