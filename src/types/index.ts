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
  MeResponse,
} from './auth'
export type {
  Team,
  TeamRole,
  TeamMember,
  TeamInvitation,
  CreateTeamPayload,
  CreateInvitationPayload,
  AcceptInvitationResponse,
} from './team'
export type { Project, ProjectMember, CreateProjectPayload } from './project'
export type {
  Group,
  GroupMember,
  Message,
  MessageSummary,
  MessageContentType,
  MessageSenderType,
  TextMessageContent,
  CodeMessageContent,
  SendMessagePayload,
  CreateGroupPayload,
  Page,
} from './group'
export type { Agent, AgentRoleTag } from './agent'
export type {
  Task,
  TaskStatus,
  TaskStep,
  TaskStepStatus,
  TaskRun,
  TaskRunStatus,
  TaskRepository,
  WorkflowRole,
  CreateTaskPayload,
} from './task'
export type { Notification, NotificationKind } from './notification'
export type {
  Memory,
  MemoryStatus,
  MemorySourceType,
  MemorySourceRef,
  MemoryActor,
  CreateMemoryPayload,
  GenerateMemoryDraftPayload,
} from './memory'
export type {
  GithubInstallation,
  GithubInstallationRedirect,
  GithubAuthorizedRepository,
  ProjectBoundRepository,
  BindProjectRepositoryPayload,
} from './github'
