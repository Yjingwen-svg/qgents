import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import type { ExecutionContext, InputRequest, Task, TaskModelPage, TaskRunDetail, TaskRunLog, TaskRunStep, TaskStep } from '@/types/task-model'

const useTaskMock = vi.hoisted(() => vi.fn()); const useTaskRunMock = vi.hoisted(() => vi.fn()); const useTaskStepsMock = vi.hoisted(() => vi.fn()); const useLogsMock = vi.hoisted(() => vi.fn()); const useContextMock = vi.hoisted(() => vi.fn()); const useRequestsMock = vi.hoisted(() => vi.fn()); const useRetryMock = vi.hoisted(() => vi.fn()); const useCancelMock = vi.hoisted(() => vi.fn()); const useReplyMock = vi.hoisted(() => vi.fn()); const useApproveMock = vi.hoisted(() => vi.fn()); const useRejectMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/task-model', () => ({ useTask: useTaskMock, useTaskRun: useTaskRunMock, useTaskSteps: useTaskStepsMock, useTaskRunLogs: useLogsMock, useTaskRunExecutionContext: useContextMock, useTaskRunInputRequests: useRequestsMock, useRetryTaskRunModel: useRetryMock, useCancelTaskRunModel: useCancelMock, useReplyTaskRunInputRequest: useReplyMock, useApproveTaskRunInputRequest: useApproveMock, useRejectTaskRunInputRequest: useRejectMock }))

import { TaskRunDetailPage } from './TaskRunDetailPage'

const task: Task = { id: 'task-1', displayCode: 'T-1', projectId: 'project-test', title: '执行任务', requirementSummary: '需求', status: 'RUNNING', deliveryMode: 'DIFF_FIRST', requirementGroup: { id: 'group-1', name: 'Group', status: 'ACTIVE' }, createdByUser: { id: 'user-1', displayName: 'User', avatarUrl: null }, repositories: [], executionSummary: { totalSteps: 1, pendingSteps: 0, runningSteps: 1, waitingSteps: 0, blockedSteps: 0, succeededSteps: 0, failedSteps: 0, currentStage: 'DEVELOPER', currentStageTitle: 'Developer', requiresUserAction: false }, attention: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z', requirement: '需求', acceptanceCriteria: [], workspace: null, capabilities: { canCancel: true, canReplacePendingStepAgent: false, canConfirmDiffReview: false, canRejectDiffReview: false, canRetryDelivery: false }, artifactSummary: { total: 0, byType: {} }, diffReviewSummary: { available: false, reviewStatus: null, deliveryStatus: null, repositoryCount: 0, filesChanged: 0, additions: 0, deletions: 0 }, sourceMessage: null, triggerMessageId: null }
const step: TaskStep = { id: 'step-1', taskId: 'task-1', sequenceNo: 1, title: '正式步骤标题', description: null, role: 'DEVELOPER', agent: { id: 'agent-1', name: 'Agent', role: 'DEVELOPER', avatarUrl: null, status: 'ACTIVE' }, repository: { repositoryId: 'repo-1', name: 'Repo', sourceBranch: 'feature/login' }, dependencies: [], status: 'RUNNING', acceptanceNotes: null, latestRun: null, runCount: 1, startedAt: null, finishedAt: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
const runStep: TaskRunStep = { node: 'checkout', status: 'PASSED', startedAt: '2026-08-11T08:01:00Z', finishedAt: '2026-08-11T08:01:02Z', durationMs: 2000 }
const run: TaskRunDetail = { id: 'run-1234567890', taskId: 'task-1', taskStepId: 'step-1', taskStepTitle: '登录实现', agent: { id: 'agent-1', name: 'Agent', role: 'DEVELOPER', avatarUrl: null }, role: 'DEVELOPER', status: 'SUCCEEDED', retryOfTaskRunId: 'run-parent', statusSummary: '执行完成', statusReason: null, startedAt: '2026-08-11T08:00:00Z', finishedAt: '2026-08-11T08:02:00Z', durationMs: 120000, artifactSummary: { total: 2, diffCount: 1 }, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z', steps: [runStep] }
const context: ExecutionContext = { workspaceId: 'workspace-1', sandboxStatus: 'READY', repositoryId: 'repo-1', baseRef: 'main', headRef: 'feature/login', startedAt: run.startedAt, expiresAt: '2026-08-11T10:00:00Z' }

function page<T>(data: T[], hasMore = false): TaskModelPage<T> { return { data, page: { nextCursor: hasMore ? 'cursor-2' : null, hasMore }, requestId: 'request-1' } }
function renderPage(path = '/app/projects/project-test/tasks/task-1/executions/run-1234567890') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/tasks/:taskId/executions/:taskRunId" element={<><TaskRunDetailPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/tasks/:taskId" element={<div>task-detail-route</div>} /><Route path="/app/projects/:projectId/diffs" element={<LocationProbe />} /></Routes></MemoryRouter>) }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }

beforeEach(() => {
  useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false })
  useTaskRunMock.mockReturnValue({ data: run, error: null, isError: false, isLoading: false, refetch: vi.fn() })
  useTaskStepsMock.mockReturnValue({ data: page([step]), error: null, isError: false, isLoading: false })
  useLogsMock.mockReturnValue({ data: page<TaskRunLog>([]), error: null, isError: false, isLoading: false, isFetching: false })
  useContextMock.mockReturnValue({ data: context, error: null, isError: false, isLoading: false })
  useRequestsMock.mockReturnValue({ data: page<InputRequest>([]), error: null, isError: false, isLoading: false, refetch: vi.fn() })
  const mutation = { mutate: vi.fn(), error: null, isPending: false }
  useRetryMock.mockReturnValue(mutation); useCancelMock.mockReturnValue(mutation); useReplyMock.mockReturnValue(mutation); useApproveMock.mockReturnValue(mutation); useRejectMock.mockReturnValue(mutation)
})

describe('TaskRunDetailPage execution observability workspace', () => {
  it('prefers taskStepTitle and formats summary metadata', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '登录实现' })).toBeInTheDocument()
    expect(screen.getByText('2 分 0 秒')).toBeInTheDocument()
    expect(within(screen.getByTestId('run-summary-header')).getByText('run-parent')).toBeInTheDocument()
    expect(screen.getByTestId('run-step-timeline')).toBeInTheDocument()
    expect(useTaskRunMock).toHaveBeenCalledWith('project-test', 'run-1234567890')
  })

  it('falls back to TaskStep title and then role label', () => {
    useTaskRunMock.mockReturnValue({ data: { ...run, taskStepTitle: '' }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('heading', { name: '正式步骤标题' })).toBeInTheDocument()
    useTaskRunMock.mockReturnValue({ data: { ...run, taskStepTitle: '', taskStepId: 'missing' }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('heading', { name: '开发者' })).toBeInTheDocument()
  })

  it('renders formal TaskRun steps only and keeps empty steps compact', () => {
    renderPage()
    expect(screen.getByText('checkout')).toBeInTheDocument()
    expect(screen.queryByText('正式步骤标题')).not.toBeInTheDocument()
    useTaskRunMock.mockReturnValue({ data: { ...run, steps: [] }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('当前执行器未返回内部步骤')).toBeInTheDocument()
  })

  it('renders formal log fields without inferring a level from content and supports cursor loading', async () => {
    const user = userEvent.setup()
    const logs: TaskRunLog[] = [{ id: 'log-1', sequence: 1, node: 'worker', content: '[ERROR] formal content', timestamp: '2026-08-11T08:01:00Z' }]
    useLogsMock.mockReturnValue({ data: page(logs, true), error: null, isError: false, isLoading: false, isFetching: false })
    renderPage()
    expect(screen.getByText('[ERROR] formal content')).toBeInTheDocument()
    expect(screen.queryByTestId('log-level')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '加载更多日志' }))
    expect(useLogsMock).toHaveBeenCalledWith('project-test', 'run-1234567890', { limit: 100, cursor: 'cursor-2' })
  })

  it('isolates log, context and request errors', () => {
    useLogsMock.mockReturnValue({ data: undefined, error: new ApiError('logs', 500), isError: true, isLoading: false, isFetching: false })
    useContextMock.mockReturnValue({ data: undefined, error: new ApiError('context', 500), isError: true, isLoading: false })
    useRequestsMock.mockReturnValue({ data: undefined, error: new ApiError('requests', 500), isError: true, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('Logs加载失败')).toBeInTheDocument()
    expect(screen.getByText('Execution Context加载失败')).toBeInTheDocument()
    expect(screen.getByText('Input Requests加载失败')).toBeInTheDocument()
    expect(screen.getByText('执行完成')).toBeInTheDocument()
  })

  it('renders Input and Approval request operations only when requests exist', async () => {
    const user = userEvent.setup()
    const requests: InputRequest[] = [{ id: 'input-1', taskRunId: run.id, kind: 'INPUT', status: 'PENDING', prompt: '请输入版本号', createdAt: run.createdAt }, { id: 'approval-1', taskRunId: run.id, kind: 'APPROVAL', status: 'PENDING', prompt: '批准继续', createdAt: run.createdAt }]
    useRequestsMock.mockReturnValue({ data: page(requests), error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    const panel = screen.getByTestId('pending-input-requests')
    expect(within(panel).getByText('请输入版本号')).toBeInTheDocument()
    expect(within(panel).getByText('批准继续')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /回\s*复/ })).toBeDisabled()
    await user.type(within(panel).getByPlaceholderText('输入回复'), '1.0.0')
    expect(within(panel).getByRole('button', { name: /回\s*复/ })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: /批\s*准/ })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: /拒\s*绝/ })).toBeDisabled()
  })

  it('keeps answered requests read-only and hides the card for an empty result', () => {
    const answered: InputRequest = { id: 'input-1', taskRunId: run.id, kind: 'INPUT', status: 'ANSWERED', prompt: '已回答', createdAt: run.createdAt }
    useRequestsMock.mockReturnValue({ data: page([answered]), error: null, isError: false, isLoading: false, refetch: vi.fn() })
    const firstRender = renderPage()
    expect(screen.getByText('已处理，当前为只读结果')).toBeInTheDocument()
    firstRender.unmount()
    useRequestsMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.queryByTestId('pending-input-requests')).not.toBeInTheDocument()
  })

  it('renders context status and real task-level Diff navigation without fabricating diffId', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByTestId('execution-context-card')).toHaveTextContent('workspace-1')
    expect(screen.getByTestId('run-result-card')).toHaveTextContent('1 个')
    await user.click(screen.getByRole('button', { name: /查看任务 Diff/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-test/diffs?taskId=task-1')
    expect(screen.queryByText('diff-1')).not.toBeInTheDocument()
  })

  it('preserves retry, cancel and TaskRun ownership validation', async () => {
    const user = userEvent.setup()
    const next = { ...run, id: 'run-2', status: 'QUEUED' as const, retryOfTaskRunId: run.id }
    useTaskRunMock.mockReturnValue({ data: { ...run, status: 'FAILED' as const }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    const mutate = vi.fn((_id: string, options: { onSuccess: (value: TaskRunDetail) => void }) => options.onSuccess(next))
    useRetryMock.mockReturnValue({ mutate, error: null, isPending: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await user.click(screen.getByRole('button', { name: /重\s*试/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('executions/run-2')
    useTaskRunMock.mockReturnValue({ data: { ...run, taskId: 'task-other' }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('TaskRun 不属于当前任务或不可见')).toBeInTheDocument()
  })
})
