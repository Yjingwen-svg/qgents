import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { waitFor, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskDetailPage } from './TaskDetailPage'
import { resetTaskDomainStores, taskDomainHandlers } from '@/mocks/task-domain/handlers'

const server = setupServer(...taskDomainHandlers)
const projectId = 'project-browser'
const runId = `orchestration-${projectId}-1`
const workPackageId = `work-package-${projectId}-1`
const taskRunId = `${workPackageId}-subtask-planner-run-1`

function renderPage(search = '') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/app/projects/${projectId}/tasks/${runId}${search}`]}>
        <Routes>
          <Route path="/app/projects/:projectId/tasks/:runId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
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

describe('TaskDetailPage visual structure regressions', () => {
  it('renders the prototype order with four execution stages and the right rail', async () => {
    renderPage(`?workPackageId=${workPackageId}&taskRunId=${taskRunId}`)

    await waitFor(() => expect(screen.getByText('执行流程')).toBeInTheDocument())
    expect(screen.getAllByText('需求分析与方案设计').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('接口开发与自测').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('测试与验证').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('交付整理').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('共享上下文')).toBeInTheDocument()
    expect(screen.getByText('开发上下文')).toBeInTheDocument()
    expect(screen.getByText('交付产出')).toBeInTheDocument()
    expect(screen.getByText('角色与审核流程')).toBeInTheDocument()
    expect(screen.getAllByText(`任务 ID：${runId}`)[0].tagName).toBe('SPAN')
  })

  it('does not load deep execution panel resources for the visual detail page', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderPage(`?workPackageId=${workPackageId}`)

    await waitFor(() => expect(screen.getByText('执行流程')).toBeInTheDocument())
    const deepRequests = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => /task-runs\/[^/?]+\/(steps|logs|input-requests)/.test(url))
    expect(deepRequests).toHaveLength(0)
    fetchSpy.mockRestore()
  })

  it('isolates a deliverable loading error without destroying the page structure', async () => {
    server.use(
      http.get('*/api/projects/:projectId/work-packages/:workPackageId/deliverables', () => HttpResponse.json(
        { error: { code: 'MOCK_DELIVERABLE_FAILURE', message: 'deliverables failed', details: [] }, requestId: 'request-error' },
        { status: 500 },
      )),
    )

    renderPage(`?workPackageId=${workPackageId}`)

    await waitFor(() => expect(screen.getByText('交付产出')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('交付产出暂时无法加载')).toBeInTheDocument())
    expect(screen.getByText('执行流程')).toBeInTheDocument()
  })
})
