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
  AgentSkillBindingResponse,
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
export type {
  GithubInstallation,
  GithubInstallationRedirect,
  GithubAuthorizedRepository,
  ProjectBoundRepository,
  BindProjectRepositoryPayload,
} from './github'
export type {
  Task,
  TaskStatus,
  TaskStep,
  TaskStepCreateInput,
  ReplaceTaskStepAgentInput,
  TaskStepStatus,
  TaskStepRole,
  TaskRun,
  TaskRunSummary,
  TaskRunDetail,
  TaskRunStatus,
  TaskRunStep,
  TaskRunStepStatus,
  TaskRunLog,
  ExecutionContext,
  SandboxStatus,
  InputRequest,
  InputRequestOption,
  InputRequestKind,
  InputRequestStatus,
  DiffStatus,
  DiffListItem,
  DiffDetail,
  DiffChangeStats,
  DiffFile,
  DiffComment,
  DiffCommentInput,
  DiffListFilters,
  DiffRejectInput,
  WorkspaceRepository,
  TaskCreateInput,
  TaskListFilters,
  TaskRunListFilters,
  PageFilters,
  TaskModelPage,
  InputRequestAnswer,
  InputRequestDecision,
} from './task-model'
export type { ApiErrorDetail, ApiErrorResponse, ApiResponse, CursorPage } from './api'
