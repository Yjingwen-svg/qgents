export interface ApiResponse<T> {
  data: T
  requestId: string
}

export interface CursorPage<T> {
  data: T[]
  page: {
    nextCursor: string | null
    hasMore: boolean
  }
  requestId: string
}

export interface ApiErrorDetail {
  field: string
  reason: string
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details: ApiErrorDetail[]
  }
  requestId: string
}

export type OrchestrationRunStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'RUNNING'
  | 'WAITING_INPUT'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'FAILED'
  | 'SUCCEEDED'
  | 'CANCELLING'
  | 'CANCELLED'

export type WorkPackageStatus =
  | 'PLANNING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'CANCELLING'

export type SubtaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED'

export type TaskRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_INPUT'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'FAILED'
  | 'SUCCEEDED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'SKIPPED'

export type TaskRunStepStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'CANCELLED'

/** FE-API-004: 后端尚未在 v1.1.1 明确输入请求的完整状态枚举。 */
export type InputRequestStatus = 'PENDING' | 'ANSWERED' | 'APPROVED' | 'REJECTED'
export type InputRequestKind = 'INPUT' | 'APPROVAL'

/** FE-API-005: 后端尚未在 v1.1.1 明确 sandboxStatus 的完整枚举。 */
export type SandboxStatus = 'CREATING' | 'READY' | 'RUNNING' | 'STOPPED' | 'EXPIRED' | 'FAILED'

export type DeliverableStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED'

export type AgentNodeRole =
  | 'ORCHESTRATOR'
  | 'PLANNER'
  | 'DEVELOPER'
  | 'TESTER'
  | 'REVIEWER'
  | 'GENERAL'

export type StartMode = 'AUTO' | 'MANUAL'

/** FE-API-006/007 临时 Mock 展示契约：后端正式字段确认后再收敛。 */
export type DeliveryType = 'SERVICE_API' | 'WEB_PAGE' | 'SHARED_SDK' | 'DOCUMENT'

export type TaskParticipantRole = 'OWNER' | 'DEVELOPER' | 'AGENT'

export interface TaskParticipant {
  id: string
  name: string
  role: TaskParticipantRole
}

export interface TaskCenterSummary {
  requirementGroupName: string
  deliveryType: DeliveryType
  description: string
  executionTarget: string
  targetRepositoryId: string | null
  targetRef: string | null
  taskCount: number
  progressPercent: number
  statusCounts: {
    running: number
    pending: number
    completed: number
  }
  acceptanceCriteria: string[]
  participants: TaskParticipant[]
  agentName: string
}

export interface TaskDetailSummary {
  priorityLabel: string
  currentStage: string
  requirementDiscussion: string
  decisionRecord: string
  skillMemorySummary: string
  /** FE-API-007 临时 Mock 展示字段：详情页开发上下文。 */
  workspaceId: string
  sandboxId: string
}

export interface TaskExecutionPreviewStep {
  id: string
  label: string
  node: AgentNodeRole
  status: TaskRunStepStatus
  startedAt: string | null
  finishedAt: string | null
}

export type TaskExecutionStageStatus = 'COMPLETED' | 'RUNNING' | 'PENDING' | 'FAILED'

export interface TaskExecutionStage {
  id: string
  title: string
  node: AgentNodeRole
  status: TaskExecutionStageStatus
  steps: TaskExecutionPreviewStep[]
  startedAt: string | null
  finishedAt: string | null
}

export interface TaskExecutionPreview {
  latestTaskRunId: string | null
  latestTaskRunStatus: TaskRunStatus | null
  currentNode: AgentNodeRole | null
  recentSteps: TaskExecutionPreviewStep[]
  stages: TaskExecutionStage[]
  errorSummary: string | null
  blockedSummary: string | null
}

export interface OrchestrationRun {
  id: string
  projectId: string
  groupId: string
  instruction: string
  workflowId: string
  startMode: StartMode
  status: OrchestrationRunStatus
  createdBy: string
  workPackageIds: string[]
  createdAt: string
  updatedAt: string
  /** FE-API-006/007/008：仅由当前 Mock 提供的原型展示摘要。 */
  taskCenterSummary?: TaskCenterSummary
  taskDetailSummary?: TaskDetailSummary
  executionPreview?: TaskExecutionPreview
}

export interface WorkPackage {
  id: string
  projectId: string
  orchestrationRunId: string
  groupId: string
  repositoryId: string
  baseRef: string
  headRef: string
  title: string
  description: string
  priority: number
  testsetIds: string[]
  startMode: StartMode
  status: WorkPackageStatus
  subtaskIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Subtask {
  id: string
  projectId: string
  orchestrationRunId: string
  workPackageId: string
  title: string
  role: AgentNodeRole
  agentId: string
  status: SubtaskStatus
  dependsOnSubtaskIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TaskRun {
  id: string
  projectId: string
  orchestrationRunId: string
  workPackageId: string
  subtaskId: string
  status: TaskRunStatus
  retryOfTaskRunId: string | null
  /** FE-API-008 临时字段：后端正式响应确认后再收敛命名与可选性。 */
  subtaskTitle?: string | null
  agentNode?: AgentNodeRole | null
  agentRole?: string | null
  /** FE-API-WORKFLOW-001：工作流只读页临时展示字段，待后端补充正式关联 DTO。 */
  agentId?: string | null
  skillNames?: string[]
  testsetNames?: string[]
  currentStep?: string | null
  waitingMessage?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
  artifactSummary?: string | null
  errorSummary?: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskRunStep {
  id: string
  projectId: string
  taskRunId: string
  node: AgentNodeRole
  status: TaskRunStepStatus
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  errorCode: string | null
}

export type TaskRunLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface TaskRunLog {
  id: string
  projectId: string
  taskRunId: string
  sequence: number
  /** FE-API-008：日志节点字段仍待后端确认。 */
  node?: AgentNodeRole | null
  level: TaskRunLogLevel
  content: string
  timestamp: string
}

export interface InputRequestOption {
  value: string
  label: string
}

export interface InputRequest {
  id: string
  projectId: string
  taskRunId: string
  kind: InputRequestKind
  status: InputRequestStatus
  prompt: string
  options: InputRequestOption[] | null
  createdAt: string
  resolvedAt: string | null
}

export interface ExecutionContext {
  id: string
  projectId: string
  taskRunId: string
  workspaceId: string
  sandboxStatus: SandboxStatus
  repositoryId: string
  baseRef: string
  headRef: string
  startedAt: string | null
  expiresAt: string | null
}

export interface CursorPageFilters {
  cursor?: string
  limit?: number
}

export type DeliverableType = 'CODE' | 'DOCUMENT' | 'TEST_REPORT'

export interface Deliverable {
  id: string
  projectId: string
  workPackageId: string
  taskRunId: string
  title: string
  type: DeliverableType
  version: number
  status: DeliverableStatus
  repositoryId: string | null
  sourceRef: string | null
  diffId: string | null
  mergeRequestId: string | null
  rejectionReason: string | null
  /** FE-API-007 临时 Mock 摘要字段，正式接口需确认结构化交付引用。 */
  summary?: string | null
  createdAt: string
  updatedAt: string
}

export interface OrchestrationRunFilters extends CursorPageFilters {
  groupId?: string
  status?: OrchestrationRunStatus
  createdBy?: string
}

export interface WorkPackageFilters extends CursorPageFilters {
  groupId?: string
  status?: WorkPackageStatus
  repositoryId?: string
}

export interface TaskRunFilters extends CursorPageFilters {
  status?: TaskRunStatus
}

export interface CreateOrchestrationRunInput {
  groupId: string
  instruction: string
  workflowId: 'system-default-code-delivery'
  startMode: StartMode
  testsetIds?: string[]
}

export interface UpdateWorkPackageInput {
  title?: string
  description?: string
  priority?: number
  testsetIds?: string[]
  startMode?: StartMode
}

export interface InputRequestAnswer {
  answer: { value: string }
}

export interface DecisionInput {
  reason: string
}

export interface RejectDeliverableInput {
  reason: string
}
