/**
 * 全局类型定义入口
 * 后端联调时：字段名尽量与 Java DTO 保持一致，避免前后端命名漂移
 */

export type {
  User,
  LoginPayload,
  RegisterPayload,
  AuthResponse,
  RefreshResponse,
} from './auth'
export type {
  Team,
  TeamRole,
  TeamMember,
  CreateTeamPayload,
  CreateInvitationPayload,
  TeamInvitation,
  AcceptInvitationResponse,
} from './team'
export type { Project, ProjectRole, ProjectMember, CreateProjectPayload } from './project'
export type {
  Agent,
  AgentAvailability,
  AgentDetail,
  AgentDetailTab,
  AgentPermissions,
  AgentPresentation,
  AgentRole,
  AgentRoleTag,
  AgentRunRecord,
  AgentSkillBinding,
  AgentSummary,
  AgentVisibility,
  CreateAgentPayload,
  ProjectSkillOption,
  UpdateAgentPayload,
} from './agent'
export type {
  ChatSession,
  ChatMessage,
  MessageType,
  TaskStatusCardPayload,
  DiffCardPayload,
} from './message'
export type { Task, TaskStatus } from './task'
export type {
  GithubInstallation,
  GithubInstallationRedirect,
  GithubAuthorizedRepository,
  ProjectBoundRepository,
  BindProjectRepositoryPayload,
} from './github'
export type {
  AgentNodeRole,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiResponse,
  CursorPage,
  CreateOrchestrationRunInput,
  CursorPageFilters,
  DeliveryType,
  DecisionInput,
  Deliverable,
  DeliverableStatus,
  DeliverableType,
  ExecutionContext,
  InputRequest,
  InputRequestAnswer,
  InputRequestKind,
  InputRequestOption,
  InputRequestStatus,
  OrchestrationRun,
  OrchestrationRunFilters,
  OrchestrationRunStatus,
  RejectDeliverableInput,
  SandboxStatus,
  StartMode,
  Subtask,
  SubtaskStatus,
  TaskRun,
  TaskRunFilters,
  TaskRunLog,
  TaskRunLogLevel,
  TaskRunStatus,
  TaskRunStep,
  TaskRunStepStatus,
  TaskCenterSummary,
  TaskDetailSummary,
  TaskExecutionPreview,
  TaskExecutionPreviewStep,
  TaskExecutionStage,
  TaskExecutionStageStatus,
  TaskParticipant,
  TaskParticipantRole,
  UpdateWorkPackageInput,
  WorkPackage,
  WorkPackageFilters,
  WorkPackageStatus,
} from './task-domain'
export { canCancelTaskRun, canRetryTaskRun } from './taskRunCapabilities'
export { canCancelOrchestrationRun } from './orchestrationRunCapabilities'
export { canWorkPackageAction } from './workPackageCapabilities'
export type { WorkPackageAction } from './workPackageCapabilities'
