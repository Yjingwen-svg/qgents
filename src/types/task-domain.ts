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
  workflowId?: string
  startMode?: StartMode
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
