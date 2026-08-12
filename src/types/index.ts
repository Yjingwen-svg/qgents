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
  MessageContentType,
  MessageSenderType,
  TextMessageContent,
  CodeMessageContent,
  SendMessagePayload,
  CreateGroupPayload,
  Page,
} from './group'
export type { Agent, AgentRoleTag } from './agent'
export type { Task, TaskStatus } from './task'
export type {
  GithubInstallation,
  GithubInstallationRedirect,
  GithubAuthorizedRepository,
  ProjectBoundRepository,
  BindProjectRepositoryPayload,
} from './github'
