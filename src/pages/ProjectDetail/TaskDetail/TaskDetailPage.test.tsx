import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import type { DiffListItem, DiffReviewBatch, Task, TaskArtifact, TaskModelPage, TaskRunSummary, TaskStep } from '@/types/task-model'

const useTaskMock = vi.hoisted(() => vi.fn())
const useTaskStepsMock = vi.hoisted(() => vi.fn())
const useCancelTaskMock = vi.hoisted(() => vi.fn())
const useDiffsMock = vi.hoisted(() => vi.fn())
const useTaskArtifactsMock = vi.hoisted(() => vi.fn())
const useTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useConfirmTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useRejectTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useRetryTaskDiffReviewDeliveryMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/task-model', () => ({ useTask: useTaskMock, useTaskSteps: useTaskStepsMock, useCancelTask: useCancelTaskMock, useDiffs: useDiffsMock, useTaskArtifacts: useTaskArtifactsMock, useTaskDiffReview: useTaskDiffReviewMock, useConfirmTaskDiffReview: useConfirmTaskDiffReviewMock, useRejectTaskDiffReview: useRejectTaskDiffReviewMock, useRetryTaskDiffReviewDelivery: useRetryTaskDiffReviewDeliveryMock }))

import { TaskDetailPage } from './TaskDetailPage'

const task: Task = {
  id: 'task-1', displayCode: 'T-1', projectId: 'project-test', title: '登录任务', requirementSummary: '实现登录功能', status: 'RUNNING', deliveryMode: 'DIFF_FIRST', requirementGroup: { id: 'group-1', name: 'Login', status: 'ACTIVE' }, createdByUser: { id: 'user-1', displayName: 'User', avatarUrl: null }, repositories: [{ repositoryId: 'repo-1', name: 'Repo', fullName: 'mock/repo', provider: 'GITHUB', defaultBranch: 'main', baseRef: 'main', baseCommit: 'base-1', sourceBranch: 'main', headCommit: 'head-1' }], executionSummary: { totalSteps: 1, pendingSteps: 0, runningSteps: 1, waitingSteps: 0, blockedSteps: 0, succeededSteps: 0, failedSteps: 0, currentStage: 'DEVELOPER', currentStageTitle: 'Developer', requiresUserAction: false }, attention: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z', requirement: '实现登录功能', acceptanceCriteria: [], workspace: null, capabilities: { canCancel: true, canReplacePendingStepAgent: false, canConfirmDiffReview: false, canRejectDiffReview: false, canRetryDelivery: false }, artifactSummary: { total: 0, byType: {} }, diffReviewSummary: { available: false, reviewStatus: null, deliveryStatus: null, repositoryCount: 0, filesChanged: 0, additions: 0, deletions: 0 }, sourceMessage: null, triggerMessageId: null,
}
const run: TaskRunSummary = { id: 'run-1', taskId: 'task-1', taskStepId: 'step-1', taskStepTitle: 'Developer', agent: null, role: 'DEVELOPER', status: 'RUNNING', retryOfTaskRunId: null, statusSummary: null, statusReason: null, startedAt: '2026-08-11T08:00:00Z', finishedAt: null, durationMs: null, artifactSummary: { total: 0, diffCount: 0 }, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
const step: TaskStep = { id: 'step-1', taskId: 'task-1', sequenceNo: 1, title: 'Developer', description: null, role: 'DEVELOPER', agent: { id: 'agent-1', name: 'Agent One', role: 'DEVELOPER', avatarUrl: null, status: 'ACTIVE' }, repository: { repositoryId: 'repo-1', name: 'Repo', sourceBranch: 'main' }, dependencies: [], status: 'RUNNING', acceptanceNotes: '覆盖登录场景', latestRun: { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, durationMs: run.durationMs }, runCount: 1, startedAt: run.startedAt, finishedAt: run.finishedAt, createdAt: run.createdAt, updatedAt: run.updatedAt }

function page<T>(data: T[]): TaskModelPage<T> { return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' } }
function pageElement(path = '/app/projects/project-test/tasks/task-1') { return <MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/tasks/:taskId" element={<><TaskDetailPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/tasks/:taskId/executions/:taskRunId" element={<div>execution-route</div>} /></Routes></MemoryRouter> }
function renderPage(path?: string) { return render(pageElement(path)) }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }

beforeEach(() => {
  useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch: vi.fn() })
  useTaskStepsMock.mockReturnValue({ data: page([step]), error: null, isError: false, isLoading: false })
  useCancelTaskMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
  useDiffsMock.mockReturnValue({ data: page<DiffListItem>([]), error: null, isError: false, isLoading: false })
  useTaskArtifactsMock.mockReturnValue({ data: [], error: null, isError: false, isLoading: false })
  useTaskDiffReviewMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false, refetch: vi.fn() })
  useConfirmTaskDiffReviewMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
  useRejectTaskDiffReviewMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
  useRetryTaskDiffReviewDeliveryMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
})

describe('TaskDetailPage final information architecture', () => {
  it('renders three content rows without a sidebar or Tabs', () => {
    renderPage()
    expect(screen.getByTestId('task-summary')).toBeInTheDocument()
    expect(screen.getByTestId('execution-flow-row')).toBeInTheDocument()
    expect(screen.getByTestId('requirement-context-row')).toBeInTheDocument()
    expect(screen.getByTestId('output-delivery-row')).toBeInTheDocument()
    expect(screen.queryByTestId('task-sidebar')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('shows attention only when present and uses a real taskRun association', async () => {
    const user = userEvent.setup()
    const attention = { kind: 'BLOCKED' as const, title: '执行受阻', summary: '查看关联运行', taskRunId: 'run-1', inputRequestId: null, diffReviewBatchId: null, repositoryId: null, createdAt: '2026-08-15T00:00:00Z' } as Task['attention']
    useTaskMock.mockReturnValue({ data: { ...task, attention }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByTestId('task-attention-banner')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看关联运行' }))
    expect(screen.getByText('execution-route')).toBeInTheDocument()
  })

  it('uses an in-page target when attention has no formal run id', async () => {
    const user = userEvent.setup()
    useTaskMock.mockReturnValue({ data: { ...task, attention: { kind: 'DIFF_CONFIRMATION_REQUIRED', title: '待确认', summary: '请确认 Diff', taskRunId: null, inputRequestId: null, diffReviewBatchId: 'batch-1', repositoryId: 'repo-1', createdAt: '2026-08-15T00:00:00Z' } }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    await user.click(screen.getByRole('button', { name: '查看产出与交付' }))
    expect(screen.getByTestId('output-delivery-row')).toBeInTheDocument()
  })

  it('routes the latest TaskStep run to TaskRunDetail and keeps unrun steps compact', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: '查看最新运行' }))
    expect(screen.getByText('execution-route')).toBeInTheDocument()
    useTaskStepsMock.mockReturnValue({ data: page([{ ...step, latestRun: null, runCount: 0 }]), error: null, isError: false, isLoading: false })
    renderPage()
    expect(screen.getByText('尚未运行')).toBeInTheDocument()
  })

  it('keeps source message conditional and shows compact acceptance empty state', () => {
    renderPage()
    expect(screen.getByText('暂无验收标准')).toBeInTheDocument()
    expect(screen.queryByText('来源消息')).not.toBeInTheDocument()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
  })

  it('isolates artifact, diff and diff review errors', () => {
    const diff: DiffListItem = { id: 'diff-1', projectId: task.projectId, taskId: task.id, taskRunId: run.id, taskStepId: step.id, requirementGroupId: 'group-1', workspaceId: 'workspace-1', repositoryId: 'repo-1', baseCommit: 'base-1', sourceBranch: 'main', headCommit: 'head-1', status: 'PENDING_REVIEW', changeStats: { files: 2, additions: 10, deletions: 3 }, createdAt: run.createdAt }
    useTaskMock.mockReturnValue({ data: { ...task, status: 'WAITING_DIFF_CONFIRMATION' }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useTaskArtifactsMock.mockReturnValue({ data: undefined, error: new Error('artifact failed'), isError: true, isLoading: false })
    useDiffsMock.mockReturnValue({ data: page([diff]), error: null, isError: false, isLoading: false })
    useTaskDiffReviewMock.mockReturnValue({ data: undefined, error: new Error('review failed'), isError: true, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('执行产物加载失败')).toBeInTheDocument()
    expect(screen.getByText('代码变更')).toBeInTheDocument()
    expect(screen.getByText('DiffReview加载失败')).toBeInTheDocument()
  })

  it('keeps review mutation validation and status actions in the delivery card', async () => {
    const user = userEvent.setup()
    const batch: DiffReviewBatch = { id: 'batch-1', taskId: task.id, reviewStatus: 'PENDING_CONFIRMATION', deliveryStatus: 'NOT_STARTED', aggregateHash: 'hash', reviewReason: null, diffs: [], repositoryDeliveries: [] }
    useTaskMock.mockReturnValue({ data: { ...task, status: 'WAITING_DIFF_CONFIRMATION', capabilities: { ...task.capabilities, canConfirmDiffReview: true, canRejectDiffReview: true } }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useTaskDiffReviewMock.mockReturnValue({ data: batch, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('button', { name: '确认交付' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '拒绝交付' }))
    expect(screen.getByRole('button', { name: '拒绝交付' })).toBeDisabled()
  })

  it('renders artifact summaries once and keeps multi-repository diff totals in the code card', () => {
    const artifact: TaskArtifact = { id: 'artifact-1', taskId: task.id, taskRunId: run.id, taskStepId: step.id, sequenceNo: 1, artifactType: 'CODING', title: '代码实现', description: '完成登录实现', status: 'SUCCEEDED', summary: {}, resources: [], createdAt: run.createdAt }
    const diff: DiffListItem = { id: 'diff-1', projectId: task.projectId, taskId: task.id, taskRunId: run.id, taskStepId: step.id, requirementGroupId: 'group-1', workspaceId: 'workspace-1', repositoryId: 'repo-1', baseCommit: 'base-1', sourceBranch: 'main', headCommit: 'head-1', status: 'PENDING_REVIEW', changeStats: { files: 2, additions: 10, deletions: 3 }, createdAt: run.createdAt }
    useTaskArtifactsMock.mockReturnValue({ data: [artifact], error: null, isError: false, isLoading: false })
    useDiffsMock.mockReturnValue({ data: page([diff]), error: null, isError: false, isLoading: false })
    renderPage()
    expect(within(screen.getByTestId('artifacts-card')).getByText('代码实现')).toBeInTheDocument()
    expect(within(screen.getByTestId('diff-card')).getByText(/files 2/)).toBeInTheDocument()
    expect(screen.queryByText('需求与环境')).not.toBeInTheDocument()
  })

  it('refreshes after cancellation conflict', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    const mutate = vi.fn((_id: string, options: { onError: (error: Error) => void }) => options.onError(new ApiError('conflict', 409)))
    useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch })
    useCancelTaskMock.mockReturnValue({ mutate, error: new ApiError('conflict', 409), isPending: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await user.click(screen.getByRole('button', { name: '取消任务' }))
    expect(refetch).toHaveBeenCalled()
  })
})
