import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TaskCenterPage } from './TaskCenterPage'
import { resetTaskDomainStores, taskDomainHandlers } from '@/mocks/task-domain/handlers'

const server = setupServer(...taskDomainHandlers)
const projectId = 'project-browser'
const runId = `orchestration-${projectId}-1`
const workPackageId = `work-package-${projectId}-1`
const taskRunId = `${workPackageId}-subtask-planner-run-1`

function renderPage(search: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/app/projects/${projectId}/tasks${search}`]}>
        <Routes>
          <Route path="/app/projects/:projectId/tasks" element={<TaskCenterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openExecutionPanel() {
  await waitFor(() => expect(screen.getByRole('tab', { name: '执行记录' })).toBeInTheDocument())
  const tab = screen.getByRole('tab', { name: '执行记录' })
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab)
  await waitFor(() => expect(screen.getByRole('heading', { name: '执行记录' })).toBeInTheDocument())
}

function mockBrowserApis() {
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
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetTaskDomainStores()
  mockBrowserApis()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('TaskCenterPage execution regressions', () => {
  it('keeps the task list when Logs fails and isolates the error to Logs', async () => {
    server.use(
      http.get('*/api/projects/:projectId/task-runs/:taskRunId/logs', () =>
        HttpResponse.json(
          { error: { code: 'MOCK_LOG_FAILURE', message: 'logs failed', details: [] }, requestId: 'request-error' },
          { status: 500 },
        ),
      ),
    )

    renderPage(`?runId=${runId}&panel=executions&workPackageId=${workPackageId}&taskRunId=${taskRunId}`)

    await waitFor(() => expect(screen.getByText('实现邮箱登录并补充 API 测试')).toBeInTheDocument())
    await openExecutionPanel()
    await waitFor(() => expect(screen.getByText('日志加载失败')).toBeInTheDocument())
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.queryByText('任务加载失败')).not.toBeInTheDocument()
  })

  it('keeps TaskRun detail and Logs when Steps fails', async () => {
    server.use(
      http.get('*/api/projects/:projectId/task-runs/:taskRunId/steps', () =>
        HttpResponse.json(
          { error: { code: 'MOCK_STEPS_FAILURE', message: 'steps failed', details: [] }, requestId: 'request-error' },
          { status: 500 },
        ),
      ),
    )

    renderPage(`?runId=${runId}&panel=executions&workPackageId=${workPackageId}&taskRunId=${taskRunId}`)

    await waitFor(() => expect(screen.getByText('TaskRun ID')).toBeInTheDocument())
    await openExecutionPanel()
    expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Steps加载失败')).toBeInTheDocument())
    expect(screen.queryByText('任务加载失败')).not.toBeInTheDocument()
  })

  it('does not request child resources before a TaskRun is selected', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    renderPage(`?runId=${runId}&panel=executions&workPackageId=${workPackageId}`)

    await waitFor(() => expect(screen.getByText('执行记录')).toBeInTheDocument())
    await openExecutionPanel()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const childRequests = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => /task-runs\/[^/?]+\/(steps|logs|execution-context|input-requests)/.test(url))
    expect(childRequests).toHaveLength(0)
    fetchSpy.mockRestore()
  })

  it('keeps the task list when TaskRun list fails and shows a local execution error', async () => {
    server.use(
      http.get('*/api/projects/:projectId/work-packages/:workPackageId/task-runs', () =>
        HttpResponse.json(
          { error: { code: 'MOCK_TASK_RUN_FAILURE', message: 'task runs failed', details: [] }, requestId: 'request-error' },
          { status: 500 },
        ),
      ),
    )

    renderPage(`?runId=${runId}&panel=executions&workPackageId=${workPackageId}`)

    await waitFor(() => expect(screen.getByText('实现邮箱登录并补充 API 测试')).toBeInTheDocument())
    await openExecutionPanel()
    await waitFor(() => expect(screen.getByText('TaskRun 列表加载失败')).toBeInTheDocument())
    expect(screen.queryByText('任务加载失败')).not.toBeInTheDocument()
  })

  it('returns the default orchestration mock data through the normal API chain', async () => {
    renderPage('')

    await waitFor(() => expect(screen.getAllByText('实现邮箱登录并补充 API 测试').length).toBeGreaterThan(0))
    expect(screen.queryByText('任务加载失败')).not.toBeInTheDocument()
  })
})
