import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { useTaskNoCodeChangeStore } from '@/store/taskNoCodeChangeStore'
import type { DiffListItem, DiffReviewBatch, Task, TaskModelPage, TaskRunDetail, TaskRunSummary, TaskStep } from '@/types/task-model'

const useTaskMock = vi.hoisted(() => vi.fn())
const useTaskDiagnosticsMock = vi.hoisted(() => vi.fn())
const useTaskStepsMock = vi.hoisted(() => vi.fn())
const useTaskRunsMock = vi.hoisted(() => vi.fn())
const useCancelTaskMock = vi.hoisted(() => vi.fn())
const useDiffsMock = vi.hoisted(() => vi.fn())
const useTaskArtifactsMock = vi.hoisted(() => vi.fn())
const useTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useConfirmTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useRejectTaskDiffReviewMock = vi.hoisted(() => vi.fn())
const useRetryTaskDiffReviewDeliveryMock = vi.hoisted(() => vi.fn())
const useTaskRunMock = vi.hoisted(() => vi.fn())
const useInfiniteTaskRunLogsMock = vi.hoisted(() => vi.fn())
const useTaskRunDiagnosticsMock = vi.hoisted(() => vi.fn())
const useTaskRunExecutionContextMock = vi.hoisted(() => vi.fn())
const useTaskRunInputRequestsMock = vi.hoisted(() => vi.fn())
const useRetryTaskRunModelMock = vi.hoisted(() => vi.fn())
const useCancelTaskRunModelMock = vi.hoisted(() => vi.fn())
const useReplyTaskRunInputRequestMock = vi.hoisted(() => vi.fn())
const useApproveTaskRunInputRequestMock = vi.hoisted(() => vi.fn())
const useRejectTaskRunInputRequestMock = vi.hoisted(() => vi.fn())
const useWorkspaceDiffPreviewMock = vi.hoisted(() => vi.fn())
const useWorkspaceDiffPreviewFilesMock = vi.hoisted(() => vi.fn())

const usePreflightMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/task-model', () => ({
  useTask: useTaskMock,
  useTaskDiagnostics: useTaskDiagnosticsMock,
  useTaskSteps: useTaskStepsMock,
  useTaskRuns: useTaskRunsMock,
  useCancelTask: useCancelTaskMock,
  useDiffs: useDiffsMock,
  useTaskArtifacts: useTaskArtifactsMock,
  useTaskDiffReview: useTaskDiffReviewMock,
  useConfirmTaskDiffReview: useConfirmTaskDiffReviewMock,
  useRejectTaskDiffReview: useRejectTaskDiffReviewMock,
  useRetryTaskDiffReviewDelivery: useRetryTaskDiffReviewDeliveryMock,
  useTaskRun: useTaskRunMock,
  useInfiniteTaskRunLogs: useInfiniteTaskRunLogsMock,
  useTaskRunDiagnostics: useTaskRunDiagnosticsMock,
  useTaskRunExecutionContext: useTaskRunExecutionContextMock,
  useTaskRunInputRequests: useTaskRunInputRequestsMock,
  useRetryTaskRunModel: useRetryTaskRunModelMock,
  useCancelTaskRunModel: useCancelTaskRunModelMock,
  useReplyTaskRunInputRequest: useReplyTaskRunInputRequestMock,
  useApproveTaskRunInputRequest: useApproveTaskRunInputRequestMock,
  useRejectTaskRunInputRequest: useRejectTaskRunInputRequestMock,
}))

vi.mock('@/hooks/qualityGate', () => ({
  usePreflight: usePreflightMock,
}))
vi.mock('@/hooks/workspaceDiffPreview', () => ({
  useWorkspaceDiffPreview: useWorkspaceDiffPreviewMock,
  useWorkspaceDiffPreviewFiles: useWorkspaceDiffPreviewFilesMock,
}))

import TaskDetailPage from './TaskDetailPage'

const task: Task = {
  id: 'task-1', displayCode: 'T-1', projectId: 'project-test', title: '登录任务', requirementSummary: '实现登录功能', status: 'RUNNING', deliveryMode: 'DIFF_FIRST', deliveryReason: null,
  requirementGroup: { id: 'group-1', name: '登录功能', status: 'ACTIVE' }, createdByUser: { id: 'user-1', displayName: 'User', avatarUrl: null },
  repositories: [{ repositoryId: 'repo-1', name: 'Web 前端', fullName: 'mock/web', provider: 'GITHUB', defaultBranch: 'main', baseRef: 'main', baseCommit: 'base-1', sourceBranch: 'feat/login', headCommit: 'head-1' }],
  executionSummary: { totalSteps: 1, pendingSteps: 0, runningSteps: 1, waitingSteps: 0, blockedSteps: 0, succeededSteps: 0, failedSteps: 0, currentStage: 'DEVELOPER', currentStageTitle: '开发实现', requiresUserAction: false },
  attention: null, statusReason: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z', requirement: '实现登录页面与接口校验，完成后提交可审查的代码变更。', acceptanceCriteria: [], workspace: null,
  capabilities: { canCancel: true, canReplacePendingStepAgent: false, canConfirmDiffReview: false, canRejectDiffReview: false, canRetryDelivery: false }, artifactSummary: { total: 0, byType: {} },
  diffReviewSummary: { available: false, reviewStatus: null, deliveryStatus: null, repositoryCount: 0, filesChanged: 0, additions: 0, deletions: 0 }, sourceMessage: null, triggerMessageId: null,
}
const run: TaskRunDetail = { id: 'run-1', taskId: task.id, taskStepId: 'step-1', taskStepTitle: '开发登录接口', agent: null, role: 'DEVELOPER', status: 'RUNNING', retryOfTaskRunId: null, statusSummary: '正在修改 API', statusReason: null, startedAt: '2026-08-11T08:00:00Z', finishedAt: null, durationMs: 1000, artifactSummary: { total: 0, diffCount: 0 }, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z', steps: [] }
const step: TaskStep = { id: 'step-1', taskId: task.id, sequenceNo: 1, title: '开发登录接口', description: null, role: 'DEVELOPER', agent: { id: 'agent-1', name: '开发 Agent', role: 'DEVELOPER', avatarUrl: null, status: 'ACTIVE' }, repository: { repositoryId: 'repo-1', name: 'Web 前端', sourceBranch: 'feat/login' }, dependencies: [], status: 'RUNNING', acceptanceNotes: '覆盖登录场景', latestRun: { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, durationMs: run.durationMs }, runCount: 1, startedAt: run.startedAt, finishedAt: run.finishedAt, createdAt: run.createdAt, updatedAt: run.updatedAt }

function page<T>(data: T[]): TaskModelPage<T> { return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' } }
function renderPage(path = '/app/projects/project-test/tasks/task-1') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/tasks/:taskId" element={<><TaskDetailPage /><LocationProbe /></>} /></Routes></MemoryRouter>) }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
const idleMutation = { mutate: vi.fn(), error: null, isPending: false }
const idleQuery = { data: undefined, error: null, isError: false, isLoading: false, refetch: vi.fn() }

beforeEach(() => {
  useTaskNoCodeChangeStore.getState().clearAllCompletedWithoutCode()
  useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch: vi.fn() })
  useTaskDiagnosticsMock.mockReturnValue({ ...idleQuery, data: { taskId: task.id, status: task.status, stage: 'CODING', failure: null, latestFailedRun: null } })
  useTaskStepsMock.mockReturnValue({ data: page([step]), error: null, isError: false, isLoading: false })
  useTaskRunsMock.mockReturnValue({ data: page<TaskRunSummary>([run]), error: null, isError: false, isLoading: false })
  useCancelTaskMock.mockReturnValue(idleMutation)
  useDiffsMock.mockReturnValue({ data: page<DiffListItem>([]), error: null, isError: false, isLoading: false })
  useTaskArtifactsMock.mockReturnValue({ data: [], error: null, isError: false, isLoading: false })
  useTaskDiffReviewMock.mockReturnValue(idleQuery)
  useConfirmTaskDiffReviewMock.mockReturnValue(idleMutation)
  useRejectTaskDiffReviewMock.mockReturnValue(idleMutation)
  useRetryTaskDiffReviewDeliveryMock.mockReturnValue(idleMutation)
  useTaskRunMock.mockReturnValue({ ...idleQuery, data: run })
  useInfiniteTaskRunLogsMock.mockReturnValue({ data: { pages: [{ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req-1' }], pageParams: [undefined] }, error: null, isError: false, isLoading: false, isFetching: false, isFetchingNextPage: false, hasNextPage: false, isFetchNextPageError: false, refetch: vi.fn(), fetchNextPage: vi.fn() })
  useTaskRunDiagnosticsMock.mockReturnValue({ ...idleQuery, data: { taskRunId: run.id, taskId: run.taskId, status: run.status, stage: 'CODING', failure: null, workerExecutions: [] } })
  usePreflightMock.mockReturnValue({ data: undefined, error: null, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() })
  useTaskRunExecutionContextMock.mockReturnValue(idleQuery)
  useTaskRunInputRequestsMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false })
  useRetryTaskRunModelMock.mockReturnValue(idleMutation)
  useCancelTaskRunModelMock.mockReturnValue(idleMutation)
  useReplyTaskRunInputRequestMock.mockReturnValue(idleMutation)
  useApproveTaskRunInputRequestMock.mockReturnValue(idleMutation)
  useRejectTaskRunInputRequestMock.mockReturnValue(idleMutation)
  useWorkspaceDiffPreviewMock.mockReturnValue({ data: { kind: 'unavailable', reason: 'NOT_FOUND', message: 'Preview 尚未生成' }, isLoading: false, isError: false, refetch: vi.fn() })
  useWorkspaceDiffPreviewFilesMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
})

describe('TaskDetailPage workbench', () => {
  it('renders recent executions, delivery and the embedded run inspector without legacy rows or Tabs', () => {
    renderPage()
    expect(screen.getByTestId('task-summary')).toBeInTheDocument()
    expect(screen.getByTestId('execution-flow-row')).toBeInTheDocument()
    expect(screen.getByTestId('recent-execution-panel')).toBeInTheDocument()
    expect(screen.getByTestId('delivery-panel')).toBeInTheDocument()
    expect(screen.getByTestId('run-inspector-panel')).toBeInTheDocument()
    expect(within(screen.getByTestId('delivery-panel')).getByTestId('workspace-diff-preview-card')).toBeInTheDocument()
    expect(screen.queryByTestId('mission-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('requirement-context-row')).not.toBeInTheDocument()
    expect(screen.queryByTestId('output-delivery-row')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses skeleton cards while the planner is generating task steps', () => {
    useTaskMock.mockReturnValue({ data: { ...task, status: 'PLANNING', executionSummary: { ...task.executionSummary, totalSteps: 0, runningSteps: 0, currentStage: null, currentStageTitle: '规划中' } }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useTaskStepsMock.mockReturnValue({ data: page<TaskStep>([]), error: null, isError: false, isLoading: false })
    renderPage()
    expect(screen.queryByText('规划 Agent 正在生成执行方案')).not.toBeInTheDocument()
    expect(screen.queryByTestId('execution-flow-empty')).not.toBeInTheDocument()
    expect(screen.queryByTestId('current-execution-card')).not.toBeInTheDocument()
    // Three skeleton step cards are rendered
    expect(screen.getAllByTestId('planning-step-card').length).toBe(3)
  })

  it('selects an embedded single-run inspector and preserves the run id in the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: '查看最新运行' }))
    expect(screen.getByTestId('run-inspector-panel')).toBeInTheDocument()
    expect(within(screen.getByTestId('run-inspector-panel')).getByText('开发登录接口')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('runId=run-1')
  })

  it('clears the default latest-run selection from blank recent-execution space and synchronizes the inspector', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(within(screen.getByTestId('run-inspector-panel')).getByText('开发登录接口')).toBeInTheDocument()
    await user.click(screen.getByTestId('recent-execution-blank'))
    expect(within(screen.getByTestId('run-inspector-panel')).getByText('选择一条执行记录查看详情')).toBeInTheDocument()
    expect(screen.getByTestId('location')).not.toHaveTextContent('runId=')
  })

  it('keeps task-level acceptance information in the right inspector and keeps the source context conditional', () => {
    useTaskMock.mockReturnValue({ data: { ...task, acceptanceCriteria: [{ id: 'criterion-1', title: '登录接口可用', description: null, status: 'SATISFIED' }] }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    const inspector = screen.getByTestId('run-inspector-panel')
    expect(within(inspector).getByText('验收信息 1/1')).toBeInTheDocument()
    expect(within(inspector).getByText('登录接口可用')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看原始讨论' })).not.toBeInTheDocument()
  })

  it('keeps a requirement excerpt in the header information row without the legacy source jump link', () => {
    renderPage()
    expect(screen.getByText('需求说明')).toBeInTheDocument()
    expect(screen.getByText('实现登录页面与接口校验，完成后提交可审查的代码变更。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看完整需求' })).not.toBeInTheDocument()
  })

  it('renders workspace preview in the code-workspace position while the task is running without a formal Diff', () => {
    useWorkspaceDiffPreviewMock.mockReturnValue({ data: { kind: 'available', preview: { projectId: task.projectId, taskId: task.id, taskRunId: run.id, workspaceId: 'workspace-1', revision: 2, baseCommit: 'base-1', workingTreeHash: 'sha256:preview', filesChanged: 2, additions: 8, deletions: 3, patch: 'diff --git a/a.txt b/a.txt', createdAt: run.createdAt } }, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    const deliveryPanel = screen.getByTestId('delivery-panel')
    expect(within(deliveryPanel).getByTestId('workspace-diff-preview-summary')).toHaveTextContent('实时预览：2 个文件 · +8 / -3 · revision 2')
    expect(within(screen.getByTestId('recent-execution-panel')).queryByTestId('workspace-diff-preview-card')).not.toBeInTheDocument()
    expect(within(deliveryPanel).queryByTestId('code-delivery-card')).not.toBeInTheDocument()
    expect(screen.getByText('产物 0 · Diff 0')).toBeInTheDocument()
  })

  it('marks added and deleted workspace preview lines with dedicated code-diff styles', async () => {
    const user = userEvent.setup()
    useWorkspaceDiffPreviewMock.mockReturnValue({ data: { kind: 'available', preview: { projectId: task.projectId, taskId: task.id, taskRunId: run.id, workspaceId: 'workspace-1', revision: 2, baseCommit: 'base-1', workingTreeHash: 'sha256:preview', filesChanged: 1, additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old line\n+new line', createdAt: run.createdAt } }, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    await user.click(screen.getByText('查看实时 Diff'))
    expect(screen.getByTestId('workspace-diff-preview-patch')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-diff-line-workspaceDiffPreviewPatchDeleted')).toHaveTextContent('-old line')
    expect(screen.getByTestId('workspace-diff-line-workspaceDiffPreviewPatchAdded')).toHaveTextContent('+new line')
  })

  it('keeps the workspace preview visible after execution failure for diagnosis', () => {
    useTaskMock.mockReturnValue({ data: { ...task, status: 'FAILED' }, isLoading: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(within(screen.getByTestId('delivery-panel')).getByTestId('workspace-diff-preview-card')).toBeInTheDocument()
    expect(screen.queryByTestId('code-delivery-card')).not.toBeInTheDocument()
  })

  it('shows one task-level action notice and keeps failure details in the selected run', () => {
    const failedRun = { ...run, status: 'FAILED' as const, statusReason: { code: 'EXECUTION_FAILED' as const, failureCode: 'PATCH_FAILED', title: '执行失败', summary: '补丁无法应用', retryable: true, occurredAt: run.updatedAt } }
    useTaskMock.mockReturnValue({ data: { ...task, status: 'FAILED', statusReason: { code: 'STARTUP_FAILED', title: '任务启动失败', summary: '不应重复显示', retryable: true }, attention: { kind: 'EXECUTION_FAILED', title: '执行失败', summary: '补丁无法应用', taskRunId: failedRun.id, inputRequestId: null, diffReviewBatchId: null, repositoryId: null } }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useTaskDiagnosticsMock.mockReturnValue({ ...idleQuery, data: { taskId: task.id, status: 'FAILED', stage: 'CODING', failure: failedRun.statusReason, latestFailedRun: { taskRunId: failedRun.id, taskStepId: step.id, taskStepTitle: step.title, status: 'FAILED', startedAt: run.startedAt, finishedAt: run.updatedAt } } })
    useTaskRunMock.mockReturnValue({ ...idleQuery, data: failedRun })
    useTaskRunDiagnosticsMock.mockReturnValue({ ...idleQuery, data: { taskRunId: failedRun.id, taskId: task.id, status: 'FAILED', stage: 'CODING', failure: failedRun.statusReason, workerExecutions: [] } })
    renderPage()
    expect(screen.getByTestId('task-attention-banner')).toBeInTheDocument()
    expect(screen.queryByText('任务启动失败')).not.toBeInTheDocument()
    expect(screen.queryByText('任务失败：PATCH_FAILED')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('run-inspector-panel')).getByText('PATCH_FAILED')).toBeInTheDocument()
    expect(within(screen.getByTestId('run-inspector-panel')).getByText('执行失败：补丁无法应用')).toBeInTheDocument()
  })

  it('keeps delivery confirmation actions in the delivery panel', async () => {
    const user = userEvent.setup()
    const batch: DiffReviewBatch = { id: 'batch-1', taskId: task.id, reviewStatus: 'PENDING_CONFIRMATION', confirmationSource: 'USER', deliveryStatus: 'NOT_STARTED', aggregateHash: 'hash', reviewReason: null, diffs: [], repositoryDeliveries: [] }
    useTaskMock.mockReturnValue({ data: { ...task, status: 'WAITING_DIFF_CONFIRMATION', capabilities: { ...task.capabilities, canConfirmDiffReview: true, canRejectDiffReview: true } }, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useTaskDiffReviewMock.mockReturnValue({ data: batch, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('button', { name: '确认交付' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '拒绝交付' }))
    expect(screen.getByRole('button', { name: '拒绝交付' })).toBeDisabled()
  })

  it('isolates run record errors without hiding delivery or the inspector', () => {
    useTaskRunsMock.mockReturnValue({ data: undefined, error: new Error('runs failed'), isError: true, isLoading: false })
    renderPage()
    expect(screen.getByText('执行记录加载失败')).toBeInTheDocument()
    expect(screen.getByTestId('run-inspector-panel')).toBeInTheDocument()
    expect(within(screen.getByTestId('delivery-panel')).getByTestId('workspace-diff-preview-card')).toBeInTheDocument()
  })

  it('restores repository-level code change details in the main delivery area', () => {
    const diff: DiffListItem = { id: 'diff-1', projectId: task.projectId, taskId: task.id, taskRunId: run.id, taskStepId: step.id, requirementGroupId: 'group-1', workspaceId: 'workspace-1', repositoryId: 'repo-1', baseCommit: 'base-1', sourceBranch: 'feat/login', headCommit: 'head-1', status: 'PENDING_REVIEW', changeStats: { files: 2, additions: 12, deletions: 3 }, createdAt: run.createdAt }
    useTaskMock.mockReturnValue({ data: { ...task, status: 'WAITING_DIFF_CONFIRMATION' }, isLoading: false, isError: false, error: null, refetch: vi.fn() })
    useDiffsMock.mockReturnValue({ data: page([diff]), error: null, isError: false, isLoading: false })
    renderPage()
    const card = screen.getByTestId('code-change-card')
    expect(screen.getByTestId('code-delivery-card')).toContainElement(card)
    expect(within(card).getByText('Web 前端')).toBeInTheDocument()
    expect(within(card).getByText('2 files · +12 / -3')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: '查看 Diff' })).toBeInTheDocument()
  })

  it('does not crash when an incomplete real response omits optional display fields', () => {
    const incompleteTask = { ...task, requirement: undefined, repositories: undefined, acceptanceCriteria: undefined, executionSummary: undefined, capabilities: undefined, sourceMessage: undefined } as unknown as Task
    useTaskMock.mockReturnValue({ data: incompleteTask, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByTestId('task-summary')).toBeInTheDocument()
    expect(screen.getByTestId('recent-execution-panel')).toBeInTheDocument()
    expect(screen.getByTestId('delivery-panel')).toBeInTheDocument()
  })

  it('refreshes the task after a cancellation conflict', async () => {
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

  it('renders branch-missing startup failure with repository context and retry entry', () => {
    const failedTask: Task = {
      ...task,
      status: 'FAILED',
      repositories: [
        { repositoryId: 'repo-1', name: 'test01', fullName: 'CloudPlayerBaby/test01', provider: 'GITHUB', defaultBranch: 'main', baseRef: 'develop', baseCommit: null, sourceBranch: '', headCommit: null },
      ],
    }
    useTaskMock.mockReturnValue({ data: failedTask, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useTaskDiagnosticsMock.mockReturnValue({
      ...idleQuery,
      data: {
        taskId: task.id,
        status: 'FAILED',
        stage: 'PLANNING',
        failure: {
          code: 'STARTUP_FAILED',
          failureCode: 'GIT_BRANCH_NOT_FOUND',
          title: '任务执行失败',
          summary: '仓库 CloudPlayerBaby/test01 不存在基线分支 develop，请在项目仓库配置中选择真实存在的分支后重试',
          retryable: true,
          occurredAt: task.createdAt,
        },
        latestFailedRun: null,
      },
    })
    renderPage()
    expect(screen.getByText('任务无法启动')).toBeInTheDocument()
    expect(screen.getByText('仓库：CloudPlayerBaby/test01')).toBeInTheDocument()
    expect(screen.getByText('基线分支：develop')).toBeInTheDocument()
    expect(screen.getByText('请修改基线分支后重新发起任务。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新发起任务' })).toBeInTheDocument()
  })
})
