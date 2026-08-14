import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkflowViewerPage } from './WorkflowViewerPage'
import type { Task, TaskRunSummary, TaskStep } from '@/types/task-model'

const useInfiniteTasksMock = vi.hoisted(() => vi.fn())
const useTaskMock = vi.hoisted(() => vi.fn())
const useTaskStepsMock = vi.hoisted(() => vi.fn())
const useTaskRunsMock = vi.hoisted(() => vi.fn())
const useAgentsMock = vi.hoisted(() => vi.fn())
const useAgentMock = vi.hoisted(() => vi.fn())
const useAgentSkillBindingsMock = vi.hoisted(() => vi.fn())
const projectGetByIdMock = vi.hoisted(() => vi.fn())
const agentGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/task-model', () => ({ useInfiniteTasks: useInfiniteTasksMock, useTask: useTaskMock, useTaskSteps: useTaskStepsMock, useTaskRuns: useTaskRunsMock }))
vi.mock('@/hooks/agents', () => ({ useAgents: useAgentsMock, useAgent: useAgentMock, useAgentSkillBindings: useAgentSkillBindingsMock }))
vi.mock('@/api', () => ({ projectApi: { getById: projectGetByIdMock }, agentApi: { get: agentGetMock } }))

const task: Task = {
  id: 'task-1', displayCode: 'T-1', projectId: 'project-1', title: '登录流程', requirementSummary: '实现登录流程', status: 'RUNNING', deliveryMode: 'DIFF_FIRST', requirementGroup: { id: 'group-1', name: 'Login', status: 'ACTIVE' }, createdByUser: { id: 'user-1', displayName: 'User', avatarUrl: null }, repositories: [], executionSummary: { totalSteps: 0, pendingSteps: 0, runningSteps: 1, waitingSteps: 0, blockedSteps: 0, succeededSteps: 0, failedSteps: 0, currentStage: 'DEVELOPER', currentStageTitle: 'Developer', requiresUserAction: false }, attention: null, createdAt: '2026-08-12T08:00:00Z', updatedAt: '2026-08-12T08:01:00Z', requirement: '实现登录流程', acceptanceCriteria: [], workspace: null, capabilities: { canCancel: true, canReplacePendingStepAgent: false, canConfirmDiffReview: false, canRejectDiffReview: false, canRetryDelivery: false }, artifactSummary: { total: 0, byType: {} }, diffReviewSummary: { available: false, reviewStatus: null, deliveryStatus: null, repositoryCount: 0, filesChanged: 0, additions: 0, deletions: 0 }, sourceMessage: null, triggerMessageId: null,
}
const steps: TaskStep[] = [
  { id: 'step-a', taskId: task.id, sequenceNo: 1, title: 'Planner', description: null, role: 'PLANNER', agent: { id: 'agent-1', name: 'Agent', role: 'PLANNER', avatarUrl: null, status: 'ACTIVE' }, repository: null, dependencies: [], status: 'SUCCEEDED', acceptanceNotes: '规划完成', latestRun: null, runCount: 1, startedAt: null, finishedAt: null, createdAt: '2026-08-12T08:00:00Z', updatedAt: '2026-08-12T08:01:00Z' },
  { id: 'step-b', taskId: task.id, sequenceNo: 2, title: 'Developer', description: null, role: 'DEVELOPER', agent: { id: 'agent-1', name: 'Agent', role: 'DEVELOPER', avatarUrl: null, status: 'ACTIVE' }, repository: null, dependencies: ['step-a'], status: 'RUNNING', acceptanceNotes: null, latestRun: null, runCount: 1, startedAt: null, finishedAt: null, createdAt: '2026-08-12T08:00:00Z', updatedAt: '2026-08-12T08:01:00Z' },
  { id: 'step-c', taskId: task.id, sequenceNo: 3, title: 'Tester', description: null, role: 'TESTER', agent: null, repository: null, dependencies: ['step-a'], status: 'PENDING', acceptanceNotes: null, latestRun: null, runCount: 0, startedAt: null, finishedAt: null, createdAt: '2026-08-12T08:00:00Z', updatedAt: '2026-08-12T08:01:00Z' },
]
const runs: TaskRunSummary[] = [
  { id: 'run-old', taskId: task.id, taskStepId: 'step-a', taskStepTitle: 'Planner', agent: null, role: 'PLANNER', status: 'FAILED', retryOfTaskRunId: null, statusSummary: null, statusReason: null, startedAt: '2026-08-12T08:00:00Z', finishedAt: '2026-08-12T08:01:00Z', durationMs: 1, artifactSummary: { total: 0, diffCount: 0 }, createdAt: '2026-08-12T08:00:00Z', updatedAt: '2026-08-12T08:01:00Z' },
  { id: 'run-new', taskId: task.id, taskStepId: 'step-a', taskStepTitle: 'Planner', agent: null, role: 'PLANNER', status: 'SUCCEEDED', retryOfTaskRunId: 'run-old', statusSummary: null, statusReason: null, startedAt: '2026-08-12T08:02:00Z', finishedAt: '2026-08-12T08:03:00Z', durationMs: 1, artifactSummary: { total: 0, diffCount: 0 }, createdAt: '2026-08-12T08:02:00Z', updatedAt: '2026-08-12T08:03:00Z' },
  { id: 'run-dev', taskId: task.id, taskStepId: 'step-b', taskStepTitle: 'Developer', agent: null, role: 'DEVELOPER', status: 'RUNNING', retryOfTaskRunId: null, statusSummary: null, statusReason: null, startedAt: '2026-08-12T08:02:00Z', finishedAt: null, durationMs: null, artifactSummary: { total: 0, diffCount: 0 }, createdAt: '2026-08-12T08:02:00Z', updatedAt: '2026-08-12T08:03:00Z' },
]

function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }

function renderPage(path = '/app/projects/project-1/workflow?taskId=task-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/workflow" element={<WorkflowViewerPage />} /></Routes><LocationProbe /></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  projectGetByIdMock.mockResolvedValue({ id: 'project-1', teamId: 'team-1', name: '项目' })
  agentGetMock.mockResolvedValue({ id: 'agent-1', name: '执行 Agent', skillBindings: [{ skillId: 'skill-1', name: 'TypeScript', scope: 'PROJECT' }] })
  useInfiniteTasksMock.mockReturnValue({ data: { pages: [{ data: [task] }] }, isPending: false, isLoading: false, isError: false, error: null })
  useTaskMock.mockReturnValue({ data: task, isPending: false, isError: false, error: null })
  useTaskStepsMock.mockReturnValue({ data: { data: steps }, isPending: false, isError: false, error: null })
  useTaskRunsMock.mockReturnValue({ data: { data: runs }, isPending: false, isError: false, error: null })
  useAgentsMock.mockReturnValue({ data: { data: [{ id: 'agent-1', name: '执行 Agent' }] }, isPending: false, isError: false, error: null })
  useAgentMock.mockReturnValue({ data: { id: 'agent-1', name: '执行 Agent' }, isPending: false, isError: false })
  useAgentSkillBindingsMock.mockReturnValue({ data: { agentId: 'agent-1', skillIds: ['skill-1'], skills: [{ id: 'skill-1', name: 'TypeScript', visibility: 'PROJECT_SHARED', status: 'PUBLISHED' }], updatedAt: '2026-08-13T00:00:00Z' }, isError: false })
})

describe('WorkflowViewerPage', () => {
  it('uses taskId URL and builds nodes from TaskSteps', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('PLANNER').length).toBeGreaterThan(0))
    expect(screen.getAllByText('DEVELOPER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TESTER').length).toBeGreaterThan(0)
    expect(screen.getByTestId('location')).toHaveTextContent('taskId=task-1')
    expect(screen.queryByText('门禁汇总')).not.toBeInTheDocument()
  })

  it('associates latest and historical runs by taskStepId', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('2 次运行')).toBeInTheDocument())
    expect(screen.getAllByRole('button').some((button) => button.textContent?.includes('run-new'))).toBe(true)
    expect(screen.getAllByRole('button').some((button) => button.textContent?.includes('run-old'))).toBe(true)
    expect(screen.getByText('2 次运行')).toBeInTheDocument()
  })

  it('shows empty guidance without a selected task', async () => {
    useTaskMock.mockReturnValue({ data: undefined, isPending: false, isError: false, error: null })
    renderPage('/app/projects/project-1/workflow')
    await waitFor(() => expect(screen.getByText('请选择一个任务查看实际执行计划')).toBeInTheDocument())
  })

  it('shows invalid task safely', async () => {
    useTaskMock.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('404') })
    renderPage('/app/projects/project-1/workflow?taskId=missing')
    await waitFor(() => expect(screen.getByText('任务不存在或当前用户无权访问。')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '清除选择' })).toBeInTheDocument()
  })

  it('clears an invalid taskId without leaving the workflow page', async () => {
    const user = userEvent.setup()
    useTaskMock.mockReturnValue({ data: undefined, isPending: false, isLoading: false, isError: true, error: new Error('404') })
    renderPage('/app/projects/project-1/workflow?taskId=missing')

    await user.click(await screen.findByRole('button', { name: '清除选择' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-1/workflow')
    expect(screen.getByText('请选择一个任务查看实际执行计划')).toBeInTheDocument()
  })

  it('does not report a missing task while the Task list is loading', () => {
    useInfiniteTasksMock.mockReturnValue({ data: undefined, isPending: true, isLoading: true, isError: false, error: null, fetchStatus: 'fetching' })
    useTaskMock.mockReturnValue({ data: undefined, isPending: true, isLoading: true, isError: false, error: null })
    renderPage('/app/projects/project-1/workflow?taskId=missing')

    expect(screen.queryByText('任务不存在或当前用户无权访问。')).not.toBeInTheDocument()
  })

  it('keeps task content when agent query fails', async () => {
    useAgentsMock.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('403') })
    renderPage()
    await waitFor(() => expect(screen.getByText('Agent 摘要加载失败，仍显示 Agent ID。')).toBeInTheDocument())
    expect(screen.getByText('DEVELOPER')).toBeInTheDocument()
  })

  it('keeps the topology when Skill binding lookup fails', async () => {
    useAgentSkillBindingsMock.mockReturnValue({ data: undefined, isError: true })
    renderPage()
    await waitFor(() => expect(screen.getByText('Skill 模块尚未接入')).toBeInTheDocument())
    expect(screen.getByText('DEVELOPER')).toBeInTheDocument()
  })
})
