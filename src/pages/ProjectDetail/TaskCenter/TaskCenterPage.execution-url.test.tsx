import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorPage, OrchestrationRun } from '@/types'
import { TaskCenterPage } from './TaskCenterPage'

const useInfiniteOrchestrationRunsMock = vi.hoisted(() => vi.fn())
const useOrchestrationRunMock = vi.hoisted(() => vi.fn())
const useOrchestrationWorkPackagesMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({
  useInfiniteOrchestrationRuns: useInfiniteOrchestrationRunsMock,
  useOrchestrationRun: useOrchestrationRunMock,
  useOrchestrationWorkPackages: useOrchestrationWorkPackagesMock,
}))

interface ExecutionPanelMockProps {
  requestedWorkPackageId?: string
  requestedTaskRunId?: string
  onWorkPackageChange: (workPackageId: string) => void
  onTaskRunChange: (taskRunId?: string) => void
}

vi.mock('./TaskExecutionPanel', () => ({
  TaskExecutionPanel: ({
    requestedWorkPackageId,
    requestedTaskRunId,
    onWorkPackageChange,
    onTaskRunChange,
  }: ExecutionPanelMockProps) => (
    <div>
      <output data-testid="execution-url-state">
        {requestedWorkPackageId ?? 'no-work-package'}:{requestedTaskRunId ?? 'no-task-run'}
      </output>
      <button type="button" onClick={() => onWorkPackageChange('wp-2')}>切换工作包</button>
      <button type="button" onClick={() => onTaskRunChange('task-run-2')}>切换 TaskRun</button>
    </div>
  ),
}))

const run: OrchestrationRun = {
  id: 'run-1',
  projectId: 'project-test',
  groupId: 'group-1',
  instruction: '实现登录接口',
  workflowId: 'workflow-1',
  startMode: 'AUTO',
  status: 'RUNNING',
  createdBy: 'demo-user',
  workPackageIds: ['wp-1', 'wp-2'],
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:30:00Z',
}

function page<T>(data: T[]): CursorPage<T> {
  return {
    data,
    page: { nextCursor: null, hasMore: false },
    requestId: 'request-1',
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/projects/project-test/tasks?runId=run-1&panel=executions&workPackageId=wp-1&taskRunId=task-run-1']}>
      <Routes>
        <Route path="/app/projects/:projectId/tasks" element={<><TaskCenterPage /><SearchProbe /></>} />
      </Routes>
    </MemoryRouter>
  )
}

function SearchProbe() {
  const location = useLocation()
  return <output data-testid="location-search">{location.search}</output>
}

beforeEach(() => {
  useInfiniteOrchestrationRunsMock.mockReturnValue({
    data: { pages: [page([run])], pageParams: [undefined] },
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    hasNextPage: false,
    refetch: vi.fn(),
  })
  useOrchestrationRunMock.mockReturnValue({
    data: run,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
  })
  useOrchestrationWorkPackagesMock.mockReturnValue([])
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

describe('TaskCenterPage execution URL state', () => {
  it('restores workPackageId/taskRunId and clears taskRunId when switching WorkPackage', async () => {
    renderPage()

    expect(screen.getByTestId('execution-url-state')).toHaveTextContent('wp-1:task-run-1')
    screen.getByRole('button', { name: '切换工作包' }).click()

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('workPackageId=wp-2')
      expect(screen.getByTestId('location-search')).not.toHaveTextContent('taskRunId=')
    })

    screen.getByRole('button', { name: '切换 TaskRun' }).click()
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('taskRunId=task-run-2'))
  })
})
