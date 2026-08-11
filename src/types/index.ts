/**
 * 全局类型定义入口
 * 后端联调时：字段名尽量与 Java DTO 保持一致，避免前后端命名漂移
 */

export type { User, AuthTokens, LoginPayload, RegisterPayload } from './auth'
export type { Team, TeamRole, TeamMember, CreateTeamPayload, JoinTeamPayload } from './team'
export type { Project, CreateProjectPayload } from './project'
export type { Agent, AgentRoleTag } from './agent'
export type {
  ChatSession,
  ChatMessage,
  MessageType,
  TaskStatusCardPayload,
  DiffCardPayload,
} from './message'
export type { Task, TaskStatus } from './task'
export type {
  AgentNodeRole,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiResponse,
  CursorPage,
  CreateOrchestrationRunInput,
  CursorPageFilters,
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
  UpdateWorkPackageInput,
  WorkPackage,
  WorkPackageFilters,
  WorkPackageStatus,
} from './task-domain'
