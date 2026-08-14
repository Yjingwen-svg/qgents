export type AgentRole = 'ORCHESTRATOR' | 'PLANNER' | 'DEVELOPER' | 'TESTER' | 'REVIEWER' | 'GENERAL'
export type AgentVisibility = 'PRIVATE' | 'TEAM' | 'SYSTEM'
export type AgentStatus = 'ACTIVE' | 'ARCHIVED'
export type AgentDetailTab = 'overview' | 'assignments' | 'config' | 'capabilities' | 'runs'

export interface AgentSummary {
  id: string
  name: string
  avatar: string | null
  role: AgentRole
  capabilities: string[]
  visibility: AgentVisibility
  status: AgentStatus
  createdBy: string | null
}

export interface AgentDetail extends AgentSummary {
  prompt?: string | null
  /** Project-specific Skill data is consumed by Workflow; Agent Team does not use it. */
  skillBindings?: AgentSkillBinding[]
}

export interface AgentSkillBinding { skillId: string; name: string; scope: 'PROJECT' | 'TEAM' | 'PRIVATE' }
export interface Agent { id: string; projectId: string; nickname: string; avatarUrl?: string; roleTags: string[]; toolIds?: string[] }
export type AgentAvailability = never
export type AgentPermissions = never
export type AgentPresentation = never
export type AgentRoleTag = string
export interface AgentRunRecord { id: string; title: string; status: string; updatedAt: string }
export interface AgentSkillBindingResponse { agentId: string; skillIds: string[]; skills: Array<{ id: string; name: string; visibility: string; status: string }>; updatedAt: string }
export interface ProjectSkillOption { id: string; name: string; scope: 'PROJECT' | 'TEAM' | 'PRIVATE'; available: boolean }

export interface CreateAgentPayload {
  name: string
  avatar?: string
  role: AgentRole
  capabilities: string[]
  prompt: string
}

export type UpdateAgentPayload = Partial<CreateAgentPayload>
