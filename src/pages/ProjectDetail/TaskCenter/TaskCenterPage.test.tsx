import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorPage, OrchestrationRun } from '@/types'
import { ApiError } from '@/api'
import { TaskCenterPage } from './TaskCenterPage'

const useInfiniteOrchestrationRunsMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({
  useInfiniteOrchestrationRuns: useInfiniteOrchestrationRunsMock,
}))

const baseRun: OrchestrationRun = {
  id: 'run-1',
  projectId: 'project-test',
  groupId: 'group-project-test-login',
  instruction: '实现登录接口',
  workflowId: 'system-default-code-delivery',
  startMode: 'AUTO',
  status: 'RUNNING',
  createdBy: 'demo-user',
  workPackageIds: ['work-package-1'],
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:30:00Z',
}

function page(runs: OrchestrationRun[]): CursorPage<OrchestrationRun> {
  return {
    data: runs,
    page: { nextCursor: null, hasMore: false },
    requestId: 'test-request',
  }
}

function renderPage(initialEntry = '/app/projects/project-test/tasks') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/app/projects/:projectId/tasks"
          element={
            <>
              <TaskCenterPage />
              <SearchProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function SearchProbe() {
  const location = useLocation()
  return <output data-testid="location-search">{location.search}</output>
}

beforeEach(() => {
  useInfiniteOrchestrationRunsMock.mockReset()
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

describe('TaskCenterPage', () => {
  it('shows the loading state', () => {
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isFetching: true,
      isLoading: true,
      refetch: vi.fn(),
    })

    renderPage()

    expect(screen.getByText('正在加载任务')).toBeInTheDocument()
  })

  it('shows an empty state for an empty response', () => {
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: { pages: [page([])], pageParams: [undefined] },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPage()

    expect(screen.getByText('项目暂无任务')).toBeInTheDocument()
  })

  it('shows a permission error without technical details', () => {
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: undefined,
      error: new ApiError('Request failed: 403', 403),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPage()

    expect(screen.getByText('暂无权限查看任务')).toBeInTheDocument()
    expect(screen.queryByText('Request failed: 403')).not.toBeInTheDocument()
  })

  it('renders task cards and groups statuses according to the URL filter', () => {
    const completedRun = { ...baseRun, id: 'run-2', instruction: '完成登录验收', status: 'SUCCEEDED' as const }
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: { pages: [page([baseRun, completedRun])], pageParams: [undefined] },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPage('/app/projects/project-test/tasks?status=running')

    expect(screen.getAllByText('实现登录接口').length).toBeGreaterThan(0)
    expect(screen.queryByText('完成登录验收')).not.toBeInTheDocument()
    expect(screen.getAllByText('执行中').length).toBeGreaterThan(0)
  })

  it('passes the route projectId and URL filters to the query hook', async () => {
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: { pages: [page([baseRun])], pageParams: [undefined] },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPage('/app/projects/project-test/tasks?createdBy=demo-user&groupId=group-project-test-login')

    expect(useInfiniteOrchestrationRunsMock).toHaveBeenCalledWith(
      'project-test',
      expect.objectContaining({
        createdBy: 'demo-user',
        groupId: 'group-project-test-login',
        limit: 20,
      }),
    )

    fireEvent.mouseDown(screen.getByRole('combobox', { name: '状态筛选' }))
    fireEvent.click(await screen.findByText('已完成'))
    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('status=completed')
    })
  })

  it('keeps existing tasks when loading the next page fails', () => {
    const fetchNextPage = vi.fn()
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: { pages: [page([baseRun])], pageParams: [undefined] },
      error: new Error('next page failed'),
      isError: true,
      isFetchNextPageError: true,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      hasNextPage: true,
      fetchNextPage,
      refetch: vi.fn(),
    })

    renderPage()

    expect(screen.getAllByText(baseRun.instruction).length).toBeGreaterThan(0)
    expect(screen.getByText('下一页任务加载失败，已保留当前任务')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('distinguishes a filtered empty result from an empty project', () => {
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: { pages: [page([baseRun])], pageParams: [undefined] },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      hasNextPage: false,
      refetch: vi.fn(),
    })

    renderPage('/app/projects/project-test/tasks?status=completed')

    expect(screen.getByText('当前已加载任务中暂无匹配项')).toBeInTheDocument()
  })

  it('falls back safely for an invalid URL status', () => {
    useInfiniteOrchestrationRunsMock.mockReturnValue({
      data: { pages: [page([baseRun])], pageParams: [undefined] },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      hasNextPage: false,
      refetch: vi.fn(),
    })

    renderPage('/app/projects/project-test/tasks?status=not-a-status')

    expect(screen.getAllByText(baseRun.instruction).length).toBeGreaterThan(0)
  })
})
