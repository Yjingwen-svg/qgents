export type TaskStatus =
  | 'PLANNING'
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_DIFF_CONFIRMATION'
  | 'WAITING_PREFLIGHT'
  | 'DIFF_REJECTED'
  | 'DELIVERING'
  | 'DELIVERY_FAILED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLING'
  | 'CANCELLED'

export type TaskStepStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED'

export type TaskRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'WAITING_INPUT'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'CANCELLING'
  | 'CANCELLED'

export type TaskRunStepStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'CANCELLED'

export type TaskStepRole = 'ORCHESTRATOR' | 'PLANNER' | 'DEVELOPER' | 'TESTER' | 'REVIEWER'

export type InputRequestKind = 'INPUT' | 'APPROVAL'
export type InputRequestStatus = 'PENDING' | 'ANSWERED' | 'APPROVED' | 'REJECTED'
export type SandboxStatus = 'CREATING' | 'READY' | 'RUNNING' | 'STOPPED' | 'EXPIRED' | 'FAILED'

export type DiffStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED'

export type TaskArtifactType = 'PLAN' | 'CODING' | 'TESTING' | 'REVIEWING'
export type DiffReviewStatus = 'PENDING_CONFIRMATION' | 'ACCEPTED' | 'REJECTED'
export type DiffReviewDeliveryStatus = 'NOT_STARTED' | 'DELIVERING' | 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'FAILED'
export type TaskDeliveryMode = 'DIFF_FIRST' | 'MR_FIRST'
export type DiffReviewConfirmationSource = 'USER' | 'SYSTEM'

export interface TaskRequirementGroupSummary { id: string; name: string; status: string }
export interface TaskUserSummary { id: string; displayName: string; avatarUrl: string | null }
export interface TaskRepositorySummary { repositoryId: string; name: string; fullName: string; provider: string; defaultBranch: string; baseRef: string; baseCommit: string; sourceBranch: string; headCommit: string | null }
export interface TaskExecutionSummary { totalSteps: number; pendingSteps: number; runningSteps: number; waitingSteps: number; blockedSteps: number; succeededSteps: number; failedSteps: number; currentStage: TaskStepRole | null; currentStageTitle: string | null; requiresUserAction: boolean }
export type TaskAttentionKind = 'INPUT_REQUIRED' | 'APPROVAL_REQUIRED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'DIFF_CONFIRMATION_REQUIRED' | 'DELIVERY_FAILED'
export interface TaskAttention {
  kind: TaskAttentionKind
  title: string
  summary: string | null
  taskRunId: string | null
  inputRequestId: string | null
  diffReviewBatchId: string | null
  repositoryId: string | null
  createdAt: string | null
}

export interface TaskListItem {
  id: string
  displayCode: string
  projectId: string
  title: string
  requirementSummary: string
  status: TaskStatus
  /** null until the server has materialized the plan and selected a delivery mode. */
  deliveryMode: TaskDeliveryMode | null
  /** Server-generated explanation of the selected delivery mode; never client input. */
  deliveryReason: string | null
  requirementGroup: TaskRequirementGroupSummary | null
  createdByUser: TaskUserSummary | null
  /** Bound repository ids; used when a detail response omits repository summaries. */
  repositoryIds?: string[]
  repositories: TaskRepositorySummary[]
  executionSummary: TaskExecutionSummary
  attention: TaskAttention | null
  /** Task 级别的状态原因。仅在任务尚未创建 TaskRun（启动失败等）时出现。 */
  statusReason: TaskStatusReason | null
  createdAt: string
  updatedAt: string
}

export interface TaskAcceptanceCriterion { id: string; title: string; description: string | null; status: 'PENDING' | 'SATISFIED' | 'UNSATISFIED' | 'NOT_APPLICABLE' }
export interface TaskWorkspace { id: string; status: string; repositories: TaskRepositorySummary[] }
export interface TaskCapabilities { canCancel: boolean; canCancelDisabledReason?: string | null; canReplacePendingStepAgent: boolean; canReplacePendingStepAgentDisabledReason?: string | null; canConfirmDiffReview: boolean; canConfirmDiffReviewDisabledReason?: string | null; canRejectDiffReview: boolean; canRejectDiffReviewDisabledReason?: string | null; canRetryDelivery: boolean; canRetryDeliveryDisabledReason?: string | null }
export interface TaskArtifactSummary { total: number; byType: Partial<Record<TaskArtifactType, number>> }
export interface TaskDiffReviewSummary { available: boolean; /** Representative Diff ID only; null when the batch has none. */ diffId?: string | null; reviewStatus: DiffReviewStatus | null; deliveryStatus: DiffReviewDeliveryStatus | null; repositoryCount: number; filesChanged: number; additions: number; deletions: number }
export interface TaskSourceMessage { id: string; sender: TaskUserSummary; textExcerpt: string; createdAt: string }
export interface Task extends TaskListItem { requirement: string; acceptanceCriteria: TaskAcceptanceCriterion[]; workspace: TaskWorkspace | null; capabilities: TaskCapabilities; artifactSummary: TaskArtifactSummary; diffReviewSummary: TaskDiffReviewSummary; sourceMessage: TaskSourceMessage | null; triggerMessageId: string | null }

export interface TaskArtifact {
  id: string
  taskId: string
  taskRunId: string | null
  taskStepId: string | null
  sequenceNo: number
  artifactType: TaskArtifactType
  title: string
  description: string | null
  status: 'SUCCEEDED' | 'FAILED' | null
  summary: Record<string, unknown>
  resources: Array<{ resourceType: string; resourceId: string; title: string }>
  createdAt: string
}

export interface TaskCreateInput {
  requirementGroupId: string
  title: string
  requirement: string
  repositoryIds: string[]
  baseRef: string
  /** Explicit user preference. Omit to let the planner/server decide. */
  deliveryMode?: TaskDeliveryMode
  workspaceId?: string
  continuationOfTaskId?: string
}

export interface TaskListFilters {
  groupId?: string
  status?: TaskStatus
  createdBy?: string
  repositoryId?: string
  keyword?: string
  cursor?: string
  limit?: number
}

export interface PageFilters {
  cursor?: string
  limit?: number
}

export interface TaskModelPage<T> {
  data: T[]
  page: {
    nextCursor: string | null
    hasMore: boolean
  }
  requestId: string
}

export interface TaskStepAgentSummary { id: string; name: string; role: TaskStepRole; avatarUrl: string | null; status: string }
export interface TaskStepRepositorySummary { repositoryId: string; name: string; sourceBranch: string }
export interface TaskStepLatestRun { id: string; status: TaskRunStatus; startedAt: string | null; finishedAt: string | null; durationMs: number | null }
export interface TaskStep { id: string; taskId: string; sequenceNo: number; title: string; description: string | null; role: TaskStepRole; agent: TaskStepAgentSummary | null; repository: TaskStepRepositorySummary | null; dependencies: string[]; status: TaskStepStatus; acceptanceNotes: string | null; latestRun: TaskStepLatestRun | null; runCount: number; startedAt: string | null; finishedAt: string | null; createdAt: string; updatedAt: string }

export interface TaskStepCreateInput {
  role: TaskStepRole
  agentId?: string
  repositoryId?: string
  baseRef?: string
  dependencies?: string[]
  testsetIds?: string[]
  acceptanceNotes?: string
}

export interface ReplaceTaskStepAgentInput {
  agentId: string
}

export interface TaskRunAgentSummary { id: string; name: string; role: TaskStepRole; avatarUrl: string | null }
export interface TaskRunStatusReason { code: 'INPUT_REQUIRED' | 'APPROVAL_REQUIRED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'CANCELLED'; title: string; summary: string; retryable: boolean; occurredAt: string }
export interface TaskRunArtifactSummary { total: number; diffCount: number }
export interface TaskRunSummary { id: string; taskId: string; taskStepId: string; taskStepTitle: string; agent: TaskRunAgentSummary | null; role: TaskStepRole; status: TaskRunStatus; retryOfTaskRunId: string | null; statusSummary: string | null; statusReason: TaskRunStatusReason | null; startedAt: string | null; finishedAt: string | null; durationMs: number | null; artifactSummary: TaskRunArtifactSummary; createdAt: string; updatedAt: string }

export interface TaskRunStep {
  node: string
  status: TaskRunStepStatus
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  errorCode?: string | null
}

export interface TaskRunDetail extends TaskRunSummary { steps?: TaskRunStep[] }

export type TaskRun = TaskRunSummary | TaskRunDetail

export interface TaskRunListFilters {
  status?: TaskRunStatus
  cursor?: string
  limit?: number
}

export interface TaskRunLog {
  id: string
  sequence: number
  node: string
  content: string
  timestamp: string
  /** 日志类型：EXECUTION=Agent/Worker执行日志；SYSTEM=TaskRun生命周期日志；TERMINAL=终态摘要（不展示为普通日志） */
  entryType: 'EXECUTION' | 'SYSTEM' | 'TERMINAL'
}

/**
 * Task 级别的状态原因，仅在任务尚未创建 TaskRun（启动失败等）时出现。
 * 与 TaskRunStatusReason（运行级原因）不同。
 */
export interface TaskStatusReason {
  code: string
  title: string
  summary: string
  retryable: boolean
  occurredAt: string
}

export interface ExecutionContext {
  workspaceId: string
  sandboxStatus: SandboxStatus
  /** null for runs that do not operate on a repository. */
  repositoryId: string | null
  baseRef: string
  headRef: string
  startedAt: string | null
  expiresAt: string | null
}

export interface InputRequestOption {
  value: string
  label: string
}

export interface InputRequest {
  id: string
  taskRunId: string
  kind: InputRequestKind
  status: InputRequestStatus
  prompt: string
  options?: InputRequestOption[]
  createdAt: string
}

export interface InputRequestAnswer {
  answer: { value: string }
}

export interface InputRequestDecision {
  reason: string
}

export interface DiffChangeStats {
  files: number
  additions: number
  deletions: number
}

export interface DiffListItem {
  id: string
  projectId: string
  taskId: string
  taskRunId: string | null
  taskStepId: string | null
  requirementGroupId: string
  workspaceId: string
  repositoryId: string
  baseCommit: string
  sourceBranch: string
  headCommit?: string | null
  status: DiffStatus
  changeStats: DiffChangeStats
  createdAt: string
}

export interface DiffDetail extends DiffListItem {
  workingTreeHash: string | null
  snapshotKey: string | null
  reviewedBy: string | null
  reviewReason: string | null
  reviewedAt: string | null
  updatedAt: string
}

export type DiffFileStatus = 'ADDED' | 'MODIFIED' | 'DELETED'
export type DiffLineKind = 'CONTEXT' | 'ADD' | 'DEL'

export interface DiffLine {
  kind: DiffLineKind
  oldLine: number | null
  newLine: number | null
  text: string
}

export interface DiffHunk {
  id: string
  header: string
  lines: DiffLine[]
}

/** GET /diffs/{diffId}/files：DiffFileResponse。hunks 本轮可能为空。 */
export interface DiffFile {
  id: string
  sequence: number
  path: string
  changeType: DiffFileStatus
  /** 与 changeType 相同，页面继续用 status 画 A/M/D */
  status: DiffFileStatus
  additions: number
  deletions: number
  binary: boolean
  hunks: DiffHunk[]
}

export interface DiffComment {
  id: string
  diffId?: string | null
  path: string | null
  side: string | null
  line: number | null
  hunkId: string | null
  commitSha?: string | null
  body: string
  authorUserId?: string | null
  authorName?: string | null
  createdAt?: string | null
}

export interface DiffListFilters {
  taskId?: string
  cursor?: string
  limit?: number
}

export interface DiffCommentInput {
  path?: string
  side?: string
  line?: number
  hunkId?: string
  body: string
}

export interface DiffRejectInput {
  reason: string
}

/** POST /projects/{projectId}/merge-requests */
export interface MergeRequestCreateInput {
  taskId: string
  repositoryId: string
  targetBranch: string
  title: string
}

/** POST /merge-requests/{id}/cq-approvals 与 cq-rejections */
export interface MergeRequestCqInput {
  reason: string
}

export type MergeRequestStatus = 'OPEN' | 'MERGED' | 'CLOSED' | 'PENDING_CREATE'

export interface MergeRequestListFilters {
  repositoryId?: string
  groupId?: string
  status?: MergeRequestStatus
  cursor?: string
  limit?: number
}

/** GET/POST /projects/{projectId}/merge-requests */
export interface MergeRequestSummary {
  id: string
  repositoryId: string
  groupIds: string[]
  provider: string
  number: number
  title?: string | null
  description?: string | null
  sourceBranch: string
  targetBranch: string
  status: MergeRequestStatus
  headCommit: string | null
  webUrl?: string | null
  taskId?: string | null
  qualityGate?: { status: string; requiredChecks: string[] }
  /**
   * 区分 MR 创建来源：
   *  - MANUAL：用户从流程图「创建 MR」节点或手动触发创建
   *  - SYSTEM：后端 MrFirstAutomationService 自动创建（CQ+1 通过后自动）
   *  - UNKNOWN：后端版本尚未回传该字段，前端不显示来源 Tag（兼容旧响应）
   *
   *  后端 MergeRequestSummaryResponse / Entity 后续会同步新增 createMode 字段。
   */
  createMode: 'MANUAL' | 'SYSTEM' | 'UNKNOWN'
}

export type MergeRequestCheckName = 'TESTSET' | 'AI_REVIEW' | 'DRY_RUN' | 'CQ_PLUS_ONE'

/** GET /merge-requests/{id}/checks 扁平数组项 MergeRequestCheckResponse */
export interface MergeRequestCheck {
  id: string
  type: MergeRequestCheckName
  status: 'PENDING' | 'PASSED' | 'FAILED'
  attemptNo?: number | null
  testsetId?: string | null
  testRunId?: string | null
  dryRunId?: string | null
  commitSha?: string | null
  source?: string | null
  startedAt?: string | null
  completedAt?: string | null
  reviewedByUserId?: string | null
  reviewedByName?: string | null
  reviewReason?: string | null
}

/** GET /merge-requests/{id}/reviews 中人工 CQ 决策（文档无固定样例，前端宽松收） */
export type MergeRequestCqDecision = 'APPROVED' | 'REJECTED'

export interface MergeRequestCqReview {
  id: string
  decision: MergeRequestCqDecision
  reviewerName: string
  reason: string | null
  createdAt: string | null
  commitSha: string | null
}

/**
 * GET /merge-requests/{id}/commits（暂定：官方契约尚未冻结该路径与字段）
 * 列表预览用 totalCount + items；相对时间由前端用 committedAt 计算。
 */
export interface MergeRequestCommit {
  sha: string
  message: string
  authorName: string
  authorUserId: string | null
  committedAt: string
}

export interface MergeRequestCommitList {
  totalCount: number
  items: MergeRequestCommit[]
}

export interface DiffReviewBatch {
  id: string
  taskId: string
  reviewStatus: DiffReviewStatus
  /** Read-only authorization source; SYSTEM represents MR_FIRST auto-delivery. */
  confirmationSource: DiffReviewConfirmationSource
  deliveryStatus: DiffReviewDeliveryStatus
  aggregateHash: string
  reviewReason: string | null
  diffs: DiffListItem[]
  repositoryDeliveries: Array<{ repositoryId: string; repositoryName: string; diffId: string; deliveryStatus: 'NOT_STARTED' | 'COMMITTED' | 'MR_CREATED' | 'FAILED'; failureCode: string | null; failureReason: string | null; mergeRequest: { id: string; number: number; title: string; status: string; webUrl: string | null } | null; updatedAt: string }>
}
