import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import type { Task, TaskArtifact, TaskModelPage, TaskRunSummary, TaskStep } from '@/types/task-model'

const useTaskMock = vi.hoisted(() => vi.fn())
const useTaskStepsMock = vi.hoisted(() => vi.fn())
const useTaskRunsMock = vi.hoisted(() => vi.fn())
const useCancelTaskMock = vi.hoisted(() => vi.fn())
const useDiffsMock = vi.hoisted(() => vi.fn())
const useTaskArtifactsMock = vi.hoisted(() => vi.fn())
const useTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useConfirmTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useRejectTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useRetryTaskDiffReviewDeliveryMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/task-model', () => ({ useTask: useTaskMock, useTaskSteps: useTaskStepsMock, useTaskRuns: useTaskRunsMock, useCancelTask: useCancelTaskMock, useDiffs: useDiffsMock, useTaskArtifacts: useTaskArtifactsMock, useTaskDiffReview: useTaskDiffReviewMock, useConfirmTaskDiffReview: useConfirmTaskDiffReviewMock, useRejectTaskDiffReview: useRejectTaskDiffReviewMock, useRetryTaskDiffReviewDelivery: useRetryTaskDiffReviewDeliveryMock }))

import { TaskDetailPage } from './TaskDetailPage'

const task: Task = { id: 'task-1', displayCode: 'T-1', projectId: 'project-test', title: '登录任务', requirementSummary: '实现登录功能', status: 'RUNNING', deliveryMode: 'DIFF_FIRST', requirementGroup: { id: 'group-1', name: 'Login', status: 'ACTIVE' }, createdByUser: { id: 'user-1', displayName: 'User', avatarUrl: null }, repositories: [{ repositoryId: 'repo-1', name: 'Repo', fullName: 'mock/repo', provider: 'GITHUB', defaultBranch: 'main', baseRef: 'main', baseCommit: 'base-1', sourceBranch: 'main', headCommit: 'head-1' }], executionSummary: { totalSteps: 1, pendingSteps: 0, runningSteps: 1, waitingSteps: 0, blockedSteps: 0, succeededSteps: 0, failedSteps: 0, currentStage: 'DEVELOPER', currentStageTitle: 'Developer', requiresUserAction: false }, attention: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z', requirement: '实现登录功能', acceptanceCriteria: [], workspace: null, capabilities: { canCancel: true, canReplacePendingStepAgent: false, canConfirmDiffReview: false, canRejectDiffReview: false, canRetryDelivery: false }, artifactSummary: { total: 0, byType: {} }, diffReviewSummary: { available: false, reviewStatus: null, deliveryStatus: null, repositoryCount: 0, filesChanged: 0, additions: 0, deletions: 0 }, sourceMessage: null, triggerMessageId: null }
const step: TaskStep = { id: 'step-1', taskId: 'task-1', sequenceNo: 1, title: 'Developer', description: null, role: 'DEVELOPER', agent: { id: 'agent-1', name: 'Agent One', role: 'DEVELOPER', avatarUrl: null, status: 'ACTIVE' }, repository: { repositoryId: 'repo-1', name: 'Repo', sourceBranch: 'main' }, dependencies: [], status: 'RUNNING', acceptanceNotes: '覆盖登录场景', latestRun: null, runCount: 1, startedAt: null, finishedAt: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
const run: TaskRunSummary = { id: 'run-1', taskId: 'task-1', taskStepId: 'step-1', taskStepTitle: 'Developer', agent: null, role: 'DEVELOPER', status: 'RUNNING', retryOfTaskRunId: null, statusSummary: null, statusReason: null, startedAt: '2026-08-11T08:00:00Z', finishedAt: null, durationMs: null, artifactSummary: { total: 0, diffCount: 0 }, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
function page<T>(data: T[]): TaskModelPage<T> { return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' } }
function renderPage(path = '/app/projects/project-test/tasks/task-1') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/tasks/:taskId" element={<><TaskDetailPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/tasks/:taskId/executions/:taskRunId" element={<div>execution-route</div>} /></Routes></MemoryRouter>) }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
beforeEach(() => { useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch: vi.fn() }); useTaskStepsMock.mockReturnValue({ data: page([step]), error: null, isError: false, isLoading: false }); useTaskRunsMock.mockReturnValue({ data: page([run]), error: null, isError: false, isLoading: false }); useCancelTaskMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false }); useDiffsMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false }); useTaskArtifactsMock.mockReturnValue({ data: [], error: null, isError: false, isLoading: false }); useTaskDiffReviewMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false, refetch: vi.fn() }); useConfirmTaskDiffReviewMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false }); useRejectTaskDiffReviewMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false }); useRetryTaskDiffReviewDeliveryMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false }) })

describe('TaskDetailPage', () => {
  it('loads Task, steps and task runs without legacy resources', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '登录任务' })).toBeInTheDocument()
    expect(screen.getByText('T-1')).toBeInTheDocument()
    expect(screen.getAllByText('实现登录功能').length).toBeGreaterThan(0)
    expect(screen.getByText(/Agent：Agent One/)).toBeInTheDocument()
    expect(screen.getByText('查看最新 TaskRun：run-1')).toBeInTheDocument()
    expect(useTaskMock).toHaveBeenCalledWith('project-test', 'task-1')
    expect(useTaskStepsMock).toHaveBeenCalledWith('project-test', 'task-1', { limit: 100 })
    expect(useTaskRunsMock).toHaveBeenCalledWith('project-test', 'task-1', { limit: 100 })
  })

  it('renders the artifact timeline safely and keeps PLAN unlinked', () => {
    const artifacts: TaskArtifact[] = [
      { id: 'artifact-coding', taskId: 'task-1', taskRunId: 'run-1', taskStepId: 'step-1', sequenceNo: 2, artifactType: 'CODING', title: '代码编写', description: null, status: 'SUCCEEDED', summary: { title: 'Implemented', files: 2 }, resources: [], createdAt: '2026-08-11T08:01:00Z' },
      { id: 'artifact-plan', taskId: 'task-1', taskRunId: null, taskStepId: null, sequenceNo: 1, artifactType: 'PLAN', title: '计划', description: null, status: null, summary: { approved: true }, resources: [], createdAt: '2026-08-11T08:00:00Z' },
    ]
    useTaskArtifactsMock.mockReturnValue({ data: artifacts, error: null, isError: false, isLoading: false })
    renderPage()
    expect(screen.getByText('计划')).toBeInTheDocument()
    expect(screen.getByText('代码编写')).toBeInTheDocument()
    expect(screen.getByText('该产物未关联 TaskRun')).toBeInTheDocument()
    expect(screen.getByText('title：Implemented')).toBeInTheDocument()
  })

  it('routes the latest run by taskStepId and does not route an unrun step', async () => {
    const user = userEvent.setup(); renderPage(); await user.click(screen.getByText('查看最新 TaskRun：run-1')); expect(screen.getByText('execution-route')).toBeInTheDocument()
    useTaskRunsMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false })
    renderPage('/app/projects/project-test/tasks/task-1')
    expect(screen.getByText('尚未运行')).toBeInTheDocument()
  })

  it('cancels Task through the new mutation and refreshes after conflict', async () => {
    const user = userEvent.setup(); const refetch = vi.fn(); const mutate = vi.fn((_id: string, options: { onError: (error: Error) => void }) => options.onError(new ApiError('conflict', 409))); useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch }); useCancelTaskMock.mockReturnValue({ mutate, error: new ApiError('conflict', 409), isPending: false }); vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage(); await user.click(screen.getByRole('button', { name: '取消任务' })); await waitFor(() => expect(mutate).toHaveBeenCalledWith('task-1', expect.any(Object))); expect(refetch).toHaveBeenCalled()
  })

  it('keeps a task from another project out of the page', () => { useTaskMock.mockReturnValue({ data: { ...task, projectId: 'other-project' }, error: null, isError: false, isLoading: false }); renderPage(); expect(screen.getByText('任务不存在或不可见')).toBeInTheDocument() })
})
