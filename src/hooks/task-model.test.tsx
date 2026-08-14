import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, TaskRunDetail } from '@/types/task-model'

const taskCreateMock = vi.hoisted(() => vi.fn())
const taskCancelMock = vi.hoisted(() => vi.fn())
const taskRunRetryMock = vi.hoisted(() => vi.fn())
const diffAcceptMock = vi.hoisted(() => vi.fn())
const taskRunGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/taskModel', () => ({
  diffsApi: { accept: diffAcceptMock },
  tasksApi: { create: taskCreateMock, cancel: taskCancelMock },
  taskRunsApi: { get: taskRunGetMock, retry: taskRunRetryMock },
}))

import { queryClient, taskModelQueryKeys } from '@/query'
import {
  useAcceptDiff,
  useCancelTask,
  useCreateTask,
  useRetryTaskRunModel,
  useTaskRun,
} from './task-model'

const task: Task = {
  id: 'task-1',
  projectId: 'project-1',
  requirementGroupId: 'group-1',
  triggerMessageId: 'message-1',
  title: 'Implement login',
  requirement: 'Support login',
  status: 'RUNNING',
  deliveryMode: 'DIFF_FIRST',
  workspaceId: 'workspace-1',
  workspaceStatus: 'READY',
  continuationOfTaskId: null,
  repositoryIds: ['repo-1'],
  repositories: [],
  createdBy: 'user-1',
  createdAt: '2026-08-12T00:00:00Z',
  updatedAt: '2026-08-12T00:00:00Z',
}

const taskRun: TaskRunDetail = {
  id: 'run-2',
  projectId: 'project-1',
  taskId: 'task-1',
  taskStepId: 'step-1',
  agentId: 'agent-1',
  role: 'DEVELOPER',
  status: 'QUEUED',
  retryOfTaskRunId: 'run-1',
  artifactSummary: { diffs: { count: 0, byStatus: {} } },
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  createdAt: '2026-08-12T00:00:00Z',
  updatedAt: '2026-08-12T00:00:00Z',
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  taskCreateMock.mockReset()
  taskCancelMock.mockReset()
  taskRunRetryMock.mockReset()
  diffAcceptMock.mockReset()
  taskRunGetMock.mockReset()
  queryClient.clear()
})

describe('new task model hooks', () => {
  it('writes a created Task and invalidates the project Task list', async () => {
    taskCreateMock.mockResolvedValue(task)
    const list = queryClient.getQueryCache().build(queryClient, {
      queryKey: taskModelQueryKeys.tasks.list('project-1', {}),
      queryFn: async () => ({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' }),
    })
    list.setData({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })

    const { result } = renderHook(() => useCreateTask('project-1'), { wrapper: wrapper(queryClient) })
    await act(async () => {
      await result.current.mutateAsync({
        requirementGroupId: 'group-1',
        title: 'Implement login',
        requirement: 'Support login',
        repositoryIds: ['repo-1'],
        baseRef: 'main',
      })
    })

    expect(queryClient.getQueryData(taskModelQueryKeys.tasks.detail('project-1', 'task-1'))).toEqual(task)
    expect(queryClient.getQueryState(taskModelQueryKeys.tasks.list('project-1', {}))?.isInvalidated).toBe(true)
  })

  it('invalidates Task and TaskRun queries when cancelling a Task', async () => {
    taskCancelMock.mockResolvedValue({ ...task, status: 'CANCELLED' })
    const taskList = queryClient.getQueryCache().build(queryClient, {
      queryKey: taskModelQueryKeys.tasks.list('project-1', {}),
      queryFn: async () => ({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' }),
    })
    taskList.setData({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })
    const { result } = renderHook(() => useCancelTask('project-1'), { wrapper: wrapper(queryClient) })
    await act(async () => { await result.current.mutateAsync('task-1') })
    expect(queryClient.getQueryState(taskModelQueryKeys.tasks.list('project-1', {}))?.isInvalidated).toBe(true)
  })

  it('stores a server-created retry run and invalidates the original run', async () => {
    taskRunRetryMock.mockResolvedValue(taskRun)
    const { result } = renderHook(() => useRetryTaskRunModel('project-1'), { wrapper: wrapper(queryClient) })
    await act(async () => { await result.current.mutateAsync('run-1') })
    expect(queryClient.getQueryData(taskModelQueryKeys.taskRuns.detail('project-1', 'run-2'))).toEqual(taskRun)
  })

  it('stores accepted Diff details and refreshes the Diff list', async () => {
    const diff = {
      id: 'diff-1',
      projectId: 'project-1',
      taskId: 'task-1',
      taskRunId: null,
      taskStepId: null,
      requirementGroupId: 'group-1',
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      baseCommit: 'abc',
      sourceBranch: 'feature/login',
      headCommit: null,
      status: 'ACCEPTED' as const,
      changeStats: { files: 1, additions: 1, deletions: 0 },
      createdAt: '2026-08-12T00:00:00Z',
      workingTreeHash: null,
      snapshotKey: null,
      reviewedBy: null,
      reviewReason: null,
      reviewedAt: null,
      updatedAt: '2026-08-12T00:00:00Z',
    }
    diffAcceptMock.mockResolvedValue(diff)
    const list = queryClient.getQueryCache().build(queryClient, {
      queryKey: taskModelQueryKeys.diffs.list('project-1', {}),
      queryFn: async () => ({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' }),
    })
    list.setData({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })
    const { result } = renderHook(() => useAcceptDiff('project-1'), { wrapper: wrapper(queryClient) })
    await act(async () => { await result.current.mutateAsync('diff-1') })
    expect(queryClient.getQueryData(taskModelQueryKeys.diffs.detail('project-1', 'diff-1'))).toEqual(diff)
    expect(queryClient.getQueryState(taskModelQueryKeys.diffs.list('project-1', {}))?.isInvalidated).toBe(true)
  })

  it('accepts a TaskRun detail without steps', async () => {
    const { steps: _steps, ...detailWithoutSteps } = taskRun
    taskRunGetMock.mockResolvedValue(detailWithoutSteps)
    const { result } = renderHook(() => useTaskRun('project-1', 'run-2'), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.steps).toBeUndefined()
  })
})
