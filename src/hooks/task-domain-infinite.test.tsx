import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorPage, OrchestrationRun, WorkPackage } from '@/types'

const orchestrationListMock = vi.hoisted(() => vi.fn())
const orchestrationCreateMock = vi.hoisted(() => vi.fn())
const workPackageGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  ApiError: class ApiError extends Error {},
  deliverablesApi: {},
  orchestrationApi: { list: orchestrationListMock, create: orchestrationCreateMock },
  taskRunsApi: {},
  workPackagesApi: { get: workPackageGetMock },
}))

import { queryClient, queryKeys } from '@/query'
import { useCreateOrchestrationRun, useInfiniteOrchestrationRuns, useOrchestrationWorkPackages } from './task-domain'

const run = (id: string): OrchestrationRun => ({
  id,
  projectId: 'project-test',
  groupId: 'group-test',
  instruction: id,
  workflowId: 'workflow-test',
  startMode: 'AUTO',
  status: 'RUNNING',
  createdBy: 'demo-user',
  workPackageIds: [],
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:00:00Z',
})

const response = (
  data: OrchestrationRun[],
  nextCursor: string | null,
  hasMore: boolean,
): CursorPage<OrchestrationRun> => ({
  data,
  page: { nextCursor, hasMore },
  requestId: 'request-test',
})

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  orchestrationListMock.mockReset()
  orchestrationCreateMock.mockReset()
  workPackageGetMock.mockReset()
  queryClient.clear()
})

const workPackage = (id: string): WorkPackage => ({
  id,
  projectId: 'project-test',
  orchestrationRunId: 'run-1',
  groupId: 'group-test',
  repositoryId: 'repository-test',
  baseRef: 'main',
  headRef: 'feature/test',
  title: id,
  description: 'description',
  priority: 1,
  testsetIds: [],
  startMode: 'AUTO',
  status: 'READY',
  subtaskIds: [],
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:00:00Z',
})

describe('useInfiniteOrchestrationRuns', () => {
  it('uses nextCursor for the next page and exposes pages without duplicate merging', async () => {
    orchestrationListMock
      .mockResolvedValueOnce(response([run('run-1')], 'cursor-2', true))
      .mockResolvedValueOnce(response([run('run-2')], null, false))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(
      () => useInfiniteOrchestrationRuns('project-test', { limit: 2 }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(true)
    expect(orchestrationListMock).toHaveBeenNthCalledWith(1, 'project-test', {
      limit: 2,
      cursor: undefined,
    })

    await act(async () => {
      await result.current.fetchNextPage()
    })

    expect(orchestrationListMock).toHaveBeenNthCalledWith(2, 'project-test', {
      limit: 2,
      cursor: 'cursor-2',
    })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('uses a new query key when project filters change', async () => {
    orchestrationListMock
      .mockResolvedValueOnce(response([run('run-1')], null, false))
      .mockResolvedValueOnce(response([run('run-2')], null, false))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result, rerender } = renderHook(
      ({ groupId }: { groupId: string }) =>
        useInfiniteOrchestrationRuns('project-test', { groupId, limit: 2 }),
      { initialProps: { groupId: 'group-one' }, wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ groupId: 'group-two' })
    await waitFor(() => expect(orchestrationListMock).toHaveBeenCalledTimes(2))

    expect(orchestrationListMock).toHaveBeenLastCalledWith('project-test', {
      groupId: 'group-two',
      limit: 2,
      cursor: undefined,
    })
  })

  it('loads unique work package details through project-scoped queries', async () => {
    workPackageGetMock.mockImplementation(async (_projectId: string, workPackageId: string) => workPackage(workPackageId))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(
      () => useOrchestrationWorkPackages('project-test', ['work-package-1', 'work-package-1']),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current[0]?.isSuccess).toBe(true))
    expect(workPackageGetMock).toHaveBeenCalledTimes(1)
    expect(workPackageGetMock).toHaveBeenCalledWith('project-test', 'work-package-1')
  })
})

describe('useCreateOrchestrationRun', () => {
  it('writes the created run to detail cache and invalidates project task queries', async () => {
    orchestrationCreateMock.mockResolvedValue(run('created-run'))
    const query = queryClient.getQueryCache().build(queryClient, {
      queryKey: queryKeys.orchestrationRuns.list('project-test', {}),
      queryFn: async () => response([], null, false),
    })
    query.setData(response([], null, false))
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useCreateOrchestrationRun('project-test'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        groupId: 'group-test',
        instruction: 'created instruction',
        workflowId: 'system-default-code-delivery',
        startMode: 'AUTO',
      })
    })

    expect(queryClient.getQueryData(queryKeys.orchestrationRuns.detail('project-test', 'created-run'))).toEqual(run('created-run'))
    expect(queryClient.getQueryState(queryKeys.orchestrationRuns.list('project-test', {}))?.isInvalidated).toBe(true)
  })
})
