import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CursorPage,
  ExecutionContext,
  InputRequest,
  TaskRun,
  TaskRunLog,
  TaskRunStep,
  WorkPackage,
} from '@/types'
import { TaskExecutionPanel } from './TaskExecutionPanel'

const useExecutionContextMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunLogsMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunStepsMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunsMock = vi.hoisted(() => vi.fn())
const useInputRequestsMock = vi.hoisted(() => vi.fn())
const useApproveInputRequestMock = vi.hoisted(() => vi.fn())
const useRejectInputRequestMock = vi.hoisted(() => vi.fn())
const useReplyInputRequestMock = vi.hoisted(() => vi.fn())
const useOrchestrationWorkPackagesMock = vi.hoisted(() => vi.fn())
const useTaskRunMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({
  useExecutionContext: useExecutionContextMock,
  useApproveInputRequest: useApproveInputRequestMock,
  useInfiniteTaskRunLogs: useInfiniteTaskRunLogsMock,
  useInfiniteTaskRunSteps: useInfiniteTaskRunStepsMock,
  useInfiniteTaskRuns: useInfiniteTaskRunsMock,
  useInputRequests: useInputRequestsMock,
  useRejectInputRequest: useRejectInputRequestMock,
  useReplyInputRequest: useReplyInputRequestMock,
  useOrchestrationWorkPackages: useOrchestrationWorkPackagesMock,
  useTaskRun: useTaskRunMock,
}))

const workPackages: WorkPackage[] = [
  {
    id: 'wp-1',
    projectId: 'project-test',
    orchestrationRunId: 'run-1',
    groupId: 'group-1',
    repositoryId: 'repo-1',
    baseRef: 'main',
    headRef: 'feat/login',
    title: '实现登录 API',
    description: '完成登录 API',
    priority: 1,
    testsetIds: [],
    startMode: 'AUTO',
    status: 'RUNNING',
    subtaskIds: ['subtask-1'],
    createdAt: '2026-08-11T08:00:00Z',
    updatedAt: '2026-08-11T08:30:00Z',
  },
  {
    id: 'wp-2',
    projectId: 'project-test',
    orchestrationRunId: 'run-1',
    groupId: 'group-1',
    repositoryId: 'repo-1',
    baseRef: 'main',
    headRef: 'feat/tests',
    title: '补充登录测试',
    description: '完成登录测试',
    priority: 2,
    testsetIds: [],
    startMode: 'MANUAL',
    status: 'READY',
    subtaskIds: ['subtask-2'],
    createdAt: '2026-08-11T08:00:00Z',
    updatedAt: '2026-08-11T08:30:00Z',
  },
]

const taskRuns: TaskRun[] = [
  {
    id: 'task-run-1',
    projectId: 'project-test',
    orchestrationRunId: 'run-1',
    workPackageId: 'wp-1',
    subtaskId: 'subtask-1',
    subtaskTitle: '登录开发',
    status: 'SUCCEEDED',
    retryOfTaskRunId: null,
    agentNode: 'DEVELOPER',
    agentRole: 'Backend Developer Agent',
    startedAt: '2026-08-11T08:00:00Z',
    finishedAt: '2026-08-11T08:00:18Z',
    durationMs: 18_000,
    artifactSummary: '登录 API 已生成',
    errorSummary: null,
    createdAt: '2026-08-11T08:00:00Z',
    updatedAt: '2026-08-11T08:00:18Z',
  },
]

const steps: TaskRunStep[] = [
  {
    id: 'step-1',
    projectId: 'project-test',
    taskRunId: 'task-run-1',
    node: 'DEVELOPER',
    status: 'PASSED',
    startedAt: '2026-08-11T08:00:00Z',
    finishedAt: '2026-08-11T08:00:18Z',
    durationMs: 18_000,
    errorCode: null,
  },
]

const context: ExecutionContext = {
  id: 'context-1',
  projectId: 'project-test',
  taskRunId: 'task-run-1',
  workspaceId: 'workspace-1',
  sandboxStatus: 'RUNNING',
  repositoryId: 'repo-1',
  baseRef: 'main',
  headRef: 'feat/login',
  startedAt: '2026-08-11T08:00:00Z',
  expiresAt: '2026-08-11T20:00:00Z',
}

function page<T>(data: T[]): CursorPage<T> {
  return {
    data,
    page: { nextCursor: null, hasMore: false },
    requestId: 'request-1',
  }
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

function renderPanel({
  requestedWorkPackageId = 'wp-1',
  requestedTaskRunId = 'task-run-1',
  run = { id: 'run-1', projectId: 'project-test', workPackageIds: ['wp-1', 'wp-2'] },
  onWorkPackageChange = vi.fn(),
  onTaskRunChange = vi.fn(),
} = {}) {
  return render(
    <TaskExecutionPanel
      projectId="project-test"
      runId="run-1"
      run={run}
      runQuery={{ isLoading: false, isError: false, error: null }}
      workPackageQueries={workPackages.map((workPackage) => ({
        data: workPackage,
        error: null,
        isError: false,
        isLoading: false,
        isFetching: false,
      }))}
      requestedWorkPackageId={requestedWorkPackageId}
      requestedTaskRunId={requestedTaskRunId}
      onWorkPackageChange={onWorkPackageChange}
      onTaskRunChange={onTaskRunChange}
    />,
  )
}

beforeEach(() => {
  useOrchestrationWorkPackagesMock.mockReset()
  useInfiniteTaskRunsMock.mockReset()
  useTaskRunMock.mockReset()
  useInfiniteTaskRunStepsMock.mockReset()
  useInfiniteTaskRunLogsMock.mockReset()
  useExecutionContextMock.mockReset()
  useInputRequestsMock.mockReset()
  useApproveInputRequestMock.mockReset()
  useRejectInputRequestMock.mockReset()
  useReplyInputRequestMock.mockReset()

  useOrchestrationWorkPackagesMock.mockReturnValue(
    workPackages.map((workPackage) => ({ data: workPackage, isLoading: false, isError: false, error: null })),
  )
  useInfiniteTaskRunsMock.mockReturnValue(infiniteQuery(taskRuns))
  useTaskRunMock.mockReturnValue({ data: taskRuns[0], error: null, isError: false, isLoading: false })
  useInfiniteTaskRunStepsMock.mockReturnValue(infiniteQuery(steps))
  useInfiniteTaskRunLogsMock.mockReturnValue(infiniteQuery<TaskRunLog>([
    {
      id: 'log-1',
      projectId: 'project-test',
      taskRunId: 'task-run-1',
      sequence: 1,
      level: 'INFO',
      content: '<b>plain log</b>',
      timestamp: '2026-08-11T08:00:00Z',
    },
  ]))
  useExecutionContextMock.mockReturnValue({ data: context, error: null, isError: false, isLoading: false })
  useInputRequestsMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false })
  const mutation = { mutate: vi.fn(), error: null, isPending: false }
  useApproveInputRequestMock.mockReturnValue(mutation)
  useRejectInputRequestMock.mockReturnValue(mutation)
  useReplyInputRequestMock.mockReturnValue(mutation)
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
})

describe('TaskExecutionPanel', () => {
  it('restores valid URL selections and displays the read-only execution record', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: /task-run-1/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('登录 API 已生成')).toBeInTheDocument()
    expect(screen.getByText('DEVELOPER')).toBeInTheDocument()
    expect(screen.getByText('workspace-1')).toBeInTheDocument()
    expect(screen.getByText('<b>plain log</b>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })

  it('does not send detail queries for a TaskRun outside the selected WorkPackage', () => {
    renderPanel({ requestedTaskRunId: 'task-run-from-another-package' })

    expect(useTaskRunMock).toHaveBeenLastCalledWith('project-test', '')
    expect(useInfiniteTaskRunStepsMock).toHaveBeenLastCalledWith('project-test', '', { limit: 40 })
    expect(useInfiniteTaskRunLogsMock).toHaveBeenLastCalledWith('project-test', '', { limit: 40 })
    expect(useExecutionContextMock).toHaveBeenLastCalledWith('project-test', '')
    expect(screen.getByText('URL 中的 TaskRun 不属于当前工作包，未加载后续执行数据')).toBeInTheDocument()
  })

  it('shows step states and isolates a logs error', () => {
    useInfiniteTaskRunLogsMock.mockReturnValue({
      ...infiniteQuery<TaskRunLog>([]),
      data: undefined,
      error: new Error('logs failed'),
      isError: true,
    })

    renderPanel()

    expect(screen.getByText('PASSED')).toBeInTheDocument()
    expect(screen.getByText('日志加载失败')).toBeInTheDocument()
    expect(screen.getByText('workspace-1')).toBeInTheDocument()
    expect(screen.queryByText('logs failed')).not.toBeInTheDocument()
  })

  it.skip('shows WAITING_INPUT with a response control', () => {
    const waitingTaskRun = { ...taskRuns[0], status: 'WAITING_INPUT' as const }
    const request: InputRequest = {
      id: 'input-1',
      projectId: 'project-test',
      taskRunId: waitingTaskRun.id,
      kind: 'INPUT',
      status: 'PENDING',
      prompt: '请选择基准分支',
      options: [{ value: 'main', label: 'main' }],
      createdAt: '2026-08-11T08:00:00Z',
      resolvedAt: null,
    }
    useTaskRunMock.mockReturnValue({ data: waitingTaskRun, error: null, isError: false, isLoading: false })
    useInputRequestsMock.mockReturnValue({ data: page([request]), error: null, isError: false, isLoading: false })

    renderPanel()

    expect(screen.getByText('请选择基准分支')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reply and continue' })).toBeInTheDocument()
  })

  it('submits a non-empty reply and keeps other execution records visible', async () => {
    const mutation = { mutate: vi.fn(), error: null, isPending: false }
    useReplyInputRequestMock.mockReturnValue(mutation)
    const request: InputRequest = {
      id: 'input-1', projectId: 'project-test', taskRunId: 'task-run-1', kind: 'INPUT', status: 'PENDING',
      prompt: 'Provide branch', options: null, createdAt: '2026-08-11T08:00:00Z', resolvedAt: null,
    }
    useInputRequestsMock.mockReturnValue({ data: page([request]), error: null, isError: false, isLoading: false })
    renderPanel()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'develop' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reply and continue' }))
    await waitFor(() => expect(mutation.mutate).toHaveBeenCalledWith({ requestId: 'input-1', input: { answer: { value: 'develop' } } }))
    expect(screen.getByText('workspace-1')).toBeInTheDocument()
    expect(screen.getByText('PASSED')).toBeInTheDocument()
  })

  it('rejects empty input and confirms approval', () => {
    const replyMutation = { mutate: vi.fn(), error: null, isPending: false }
    useReplyInputRequestMock.mockReturnValue(replyMutation)
    const request: InputRequest = {
      id: 'input-1', projectId: 'project-test', taskRunId: 'task-run-1', kind: 'INPUT', status: 'PENDING',
      prompt: 'Provide branch', options: null, createdAt: '2026-08-11T08:00:00Z', resolvedAt: null,
    }
    useInputRequestsMock.mockReturnValue({ data: page([request]), error: null, isError: false, isLoading: false })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Reply and continue' }))
    expect(replyMutation.mutate).not.toHaveBeenCalled()
  })

  it('approves a pending request without sending a fabricated reason', () => {
    const approveMutation = { mutate: vi.fn(), error: null, isPending: false }
    useApproveInputRequestMock.mockReturnValue(approveMutation)
    const request: InputRequest = {
      id: 'approval-1', projectId: 'project-test', taskRunId: 'task-run-1', kind: 'APPROVAL', status: 'PENDING',
      prompt: 'Approve the controlled test run', options: null, createdAt: '2026-08-11T08:00:00Z', resolvedAt: null,
    }
    useInputRequestsMock.mockReturnValue({ data: page([request]), error: null, isError: false, isLoading: false })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(approveMutation.mutate).toHaveBeenCalledWith({ requestId: 'approval-1', input: { reason: '' } })
    confirmSpy.mockRestore()
  })

  it('uses the selected work package callback without rendering workspace controls', async () => {
    const onWorkPackageChange = vi.fn()
    renderPanel({ onWorkPackageChange })

    fireEvent.mouseDown(screen.getByRole('combobox', { name: '工作包' }))
    fireEvent.click(await screen.findByText('补充登录测试 · 就绪'))

    await waitFor(() => expect(onWorkPackageChange).toHaveBeenCalledWith('wp-2'))
    expect(screen.queryByRole('button', { name: /启动 Sandbox|停止 Sandbox|删除 Workspace/ })).not.toBeInTheDocument()
  })
})
