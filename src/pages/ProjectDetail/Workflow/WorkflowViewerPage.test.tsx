import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSummary, OrchestrationRun, TaskRun, WorkflowRuntimeData, WorkPackage } from '@/types'
import { WorkflowViewerPage } from './WorkflowViewerPage'

const useWorkflowRuntimeMock = vi.hoisted(() => vi.fn())
const useAgentsMock = vi.hoisted(() => vi.fn())
const projectGetByIdMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({
  useWorkflowRuntime: useWorkflowRuntimeMock,
  useAgents: useAgentsMock,
}))

vi.mock('@/api', () => ({
  projectApi: { getById: projectGetByIdMock },
}))

const run: OrchestrationRun = {
  id: 'run-1', projectId: 'project-test', groupId: 'group-1', instruction: '当前登录交付',
  workflowId: 'system-default-code-delivery', startMode: 'AUTO', status: 'RUNNING', createdBy: 'user-1',
  workPackageIds: ['wp-1'], createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z',
}
const workPackage: WorkPackage = {
  id: 'wp-1', projectId: 'project-test', orchestrationRunId: 'run-1', groupId: 'group-1',
  repositoryId: 'repo-1', baseRef: 'main', headRef: 'feat/login', title: '登录交付', description: '交付描述',
  priority: 1, testsetIds: [], startMode: 'AUTO', status: 'RUNNING', subtaskIds: ['subtask-1'],
  createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z',
}
const taskRun: TaskRun = {
  id: 'task-run-1', projectId: 'project-test', orchestrationRunId: 'run-1', workPackageId: 'wp-1',
  subtaskId: 'subtask-1', subtaskTitle: '实现接口', agentNode: 'DEVELOPER', agentRole: 'DEVELOPER', agentId: 'agent-developer',
  status: 'WAITING_INPUT', retryOfTaskRunId: null, skillNames: [], testsetNames: [], currentStep: '等待分支选择',
  waitingMessage: '等待输入', createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z',
}
const agent: AgentSummary = {
  id: 'agent-developer', teamId: 'team-1', name: '当前开发 Agent', avatar: null, role: 'DEVELOPER',
  capabilities: [], description: '开发能力', visibility: 'PRIVATE', availability: 'RUNNING', createdBy: 'user-1',
  permissions: { canEdit: true, canPublish: true, canUnpublish: true, canArchive: true, canBindSkills: true, canViewPrivateConfig: true },
}

function runtime(overrides: Partial<WorkflowRuntimeData> = {}) {
  return {
    runsQuery: { data: { data: [run], page: { nextCursor: null, hasMore: false }, requestId: 'r' }, isError: false, error: null, isPending: false },
    runQuery: { data: run, isError: false, error: null, isPending: false },
    data: { run, workPackages: [workPackage], taskRuns: [taskRun], hasWorkPackageError: false, hasTaskRunError: false, ...overrides },
    isLoading: false,
    error: null,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderPage(path = '/app/projects/project-test/workflow?runId=run-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(['qgents', 'projects', 'project-test'], { id: 'project-test', teamId: 'team-1', name: '项目' })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/projects/:projectId/workflow" element={<WorkflowViewerPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  projectGetByIdMock.mockResolvedValue({ id: 'project-test', teamId: 'team-1', name: '项目' })
  useAgentsMock.mockReturnValue({ data: { data: [agent] }, isPending: false, isError: false, error: null })
  useWorkflowRuntimeMock.mockReturnValue(runtime())
})

describe('WorkflowViewerPage', () => {
  it('renders the centralized default definition and restores runId', async () => {
    renderPage()
    expect(screen.getAllByText('Planner').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Developer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tester').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reviewer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('门禁汇总').length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('runId=run-1'))
  })

  it('shows live task status and agent data from query results', () => {
    renderPage()
    expect(screen.getByText('当前开发 Agent')).toBeInTheDocument()
    expect(screen.getAllByText('等待输入').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('Developer')[0])
    expect(screen.getByText('等待分支选择')).toBeInTheDocument()
  })

  it('enters the related TaskRun execution detail from a node', () => {
    renderPage()
    fireEvent.click(screen.getAllByText('Developer')[0])
    fireEvent.click(screen.getByText('查看单次执行详情'))
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-test/tasks/run-1/executions/task-run-1')
  })

  it('maps a changed TaskRun response to a changed node status', () => {
    useWorkflowRuntimeMock.mockReturnValue(runtime({ taskRuns: [{ ...taskRun, status: 'SUCCEEDED', waitingMessage: null, currentStep: '执行完成' }] }))
    renderPage()
    fireEvent.click(screen.getAllByText('Developer')[0])
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0)
    expect(screen.getByText('执行完成')).toBeInTheDocument()
  })

  it('keeps the definition visible when no run is selected', () => {
    useWorkflowRuntimeMock.mockReturnValue({ ...runtime({ run: null, workPackages: [], taskRuns: [] }), runQuery: { data: null, isError: false, error: null, isPending: false } })
    renderPage('/app/projects/project-test/workflow')
    expect(screen.getByText('选择运行实例后查看节点运行状态')).toBeInTheDocument()
    expect(screen.getAllByText(/标准代码交付流程/).length).toBeGreaterThan(0)
  })

  it('shows an invalid run warning without selecting another run', () => {
    useWorkflowRuntimeMock.mockReturnValue({ ...runtime(), runQuery: { data: null, isError: true, error: new Error('404'), isPending: false } })
    renderPage('/app/projects/project-test/workflow?runId=missing-run')
    expect(screen.getByText(/runId 无效/)).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('runId=missing-run')
  })

  it('shows explicit empty values when optional runtime data is absent', () => {
    useAgentsMock.mockReturnValue({ data: { data: [] }, isPending: false, isError: false, error: null })
    useWorkflowRuntimeMock.mockReturnValue(runtime({ taskRuns: [{ ...taskRun, agentId: null, skillNames: [], testsetNames: [], currentStep: null }] }))
    renderPage()
    expect(screen.getAllByText('暂无 Agent').length).toBeGreaterThan(0)
    expect(screen.getByText('暂无 Skill')).toBeInTheDocument()
    expect(screen.getByText('暂无 Testset')).toBeInTheDocument()
  })

  it('keeps workflow visible for a partial TaskRun query failure', () => {
    useWorkflowRuntimeMock.mockReturnValue(runtime({ hasTaskRunError: true, taskRuns: [] }))
    renderPage()
    expect(screen.getByText(/部分 TaskRun 加载失败/)).toBeInTheDocument()
    expect(screen.getByText('Reviewer')).toBeInTheDocument()
  })
})
