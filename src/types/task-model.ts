export type TaskStatus =
  | 'PLANNING'
  | 'PENDING'
  | 'RUNNING'
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

export interface WorkspaceRepository {
  repositoryId: string
  baseCommit: string
  sourceBranch: string
  headCommit: string | null
}

export interface Task {
  id: string
  projectId: string
  requirementGroupId: string
  triggerMessageId: string
  title: string
  requirement: string
  status: TaskStatus
  workspaceId: string
  workspaceStatus: string
  continuationOfTaskId: string | null
  repositoryIds: string[]
  repositories: WorkspaceRepository[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TaskCreateInput {
  requirementGroupId: string
  title: string
  requirement: string
  repositoryIds: string[]
  baseRef: string
  workspaceId?: string
  continuationOfTaskId?: string
}

export interface TaskListFilters {
  groupId?: string
  status?: TaskStatus
  createdBy?: string
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

export interface TaskStep {
  id: string
  taskId: string
  role: TaskStepRole
  agentId: string | null
  repositoryId: string | null
  baseRef: string | null
  dependencies: string[]
  testsetIds: string[]
  status: TaskStepStatus
  acceptanceNotes: string | null
}

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

export interface TaskRunSummary {
  id: string
  projectId: string
  taskId: string
  taskStepId: string
  agentId: string
  role: TaskStepRole
  status: TaskRunStatus
  retryOfTaskRunId: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskRunStep {
  node: string
  status: TaskRunStepStatus
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  errorCode?: string | null
}

export interface TaskRunDetail extends TaskRunSummary {
  artifactSummary: {
    diffs: {
      count: number
      byStatus: Record<string, number>
    }
  }
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  steps?: TaskRunStep[]
}

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
}

export interface ExecutionContext {
  workspaceId: string
  sandboxStatus: SandboxStatus
  repositoryId: string
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

export interface DiffFile {
  path: string
  side?: string
  line?: number
  hunkId?: string
  body?: string
}

export interface DiffComment {
  id: string
  path: string | null
  side: string | null
  line: number | null
  hunkId: string | null
  body: string
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
