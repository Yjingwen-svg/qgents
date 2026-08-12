/** Agent 角色是调度标识，不是人类 Reviewer 权限角色。 */
export type AgentRole =
  | 'ORCHESTRATOR'
  | 'PLANNER'
  | 'DEVELOPER'
  | 'TESTER'
  | 'REVIEWER'
  | 'GENERAL'

export type AgentRoleTag = string
export type AgentVisibility = 'PRIVATE' | 'TEAM_SHARED' | 'SYSTEM'
export type AgentAvailability = 'RUNNING' | 'IDLE' | 'ARCHIVED'
export type AgentDetailTab = 'overview' | 'assignments' | 'config' | 'capabilities' | 'runs'

/** 正式 Agent 列表可安全返回的摘要。不得包含 prompt、凭据或其他私有配置。 */
export interface AgentSummary {
  id: string
  teamId: string
  name: string
  avatar?: string | null
  role: AgentRole
  capabilities: string[]
  description?: string | null
  visibility: AgentVisibility
  availability: AgentAvailability
  createdBy: string | null
  permissions: AgentPermissions
  /** FE-API-AGENT-001 临时 Mock 展示字段，正式接口需确认。 */
  presentation?: AgentPresentation
}

export interface AgentPermissions {
  canEdit: boolean
  canPublish: boolean
  canUnpublish: boolean
  canArchive: boolean
  canBindSkills: boolean
  canViewPrivateConfig: boolean
}

/** FE-API-AGENT-001：原型所需但 v1.1.1 未定义的 Agent 展示字段。 */
export interface AgentPresentation {
  concurrencyLimit: number | null
  requirementUsage: { used: number; total: number } | null
  workflowUsage: { used: number; total: number } | null
  skillScope: 'PROJECT' | 'TEAM' | 'PRIVATE' | 'UNKNOWN'
  memoryScope: 'PROJECT' | 'TEAM' | 'PRIVATE' | 'UNKNOWN'
  assignmentDetails: string[]
  runningTasks: string[]
  runRecords: AgentRunRecord[]
}

export interface AgentRunRecord {
  id: string
  title: string
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  updatedAt: string
}

export interface AgentDetail extends AgentSummary {
  /** 仅创建者且后端授权时返回；其他成员响应不得包含该字段。 */
  prompt?: string | null
  config?: Record<string, string | number | boolean | null>
  skillBindings?: AgentSkillBinding[]
}

export interface AgentSkillBinding {
  skillId: string
  name: string
  scope: 'PROJECT' | 'TEAM' | 'PRIVATE'
}

/** FE-API-AGENT-002：当前项目可绑定 Skill 的最小展示 DTO。 */
export interface ProjectSkillOption {
  id: string
  name: string
  scope: 'PROJECT' | 'TEAM' | 'PRIVATE'
  available: boolean
}

export interface CreateAgentPayload {
  name: string
  avatar?: string
  role: AgentRole
  capabilities: string[]
  prompt: string
}

export type UpdateAgentPayload = Partial<CreateAgentPayload>

/** 保留旧页面类型出口，供未迁移的基础类型使用。 */
export interface Agent {
  id: string
  projectId: string
  nickname: string
  avatarUrl?: string
  roleTags: AgentRoleTag[]
  toolIds?: string[]
}
