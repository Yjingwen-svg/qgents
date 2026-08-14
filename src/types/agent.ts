import type { TaskRunStatus } from './task-model'

export type AgentRole = 'ORCHESTRATOR' | 'PLANNER' | 'DEVELOPER' | 'TESTER' | 'REVIEWER' | 'GENERAL'
export type AgentVisibility = 'PRIVATE' | 'TEAM' | 'SYSTEM'
export type AgentStatus = 'ACTIVE' | 'ARCHIVED'
export type AgentDetailTab = 'overview' | 'assignments' | 'config' | 'capabilities' | 'runs'
export type AgentRuntimeStatus = 'IDLE' | 'RUNNING'

export interface AgentAssignmentUsage {
  assignedCount: number
  assignableCount: number
}

export interface AgentRuntimeSummary {
  status: AgentRuntimeStatus
  activeRunCount: number
  concurrencyLimit: number
  assignmentUsage: {
    requirementGroups: AgentAssignmentUsage
    workflows: AgentAssignmentUsage
  }
}

export interface AgentSummary {
  id: string
  name: string
  avatar: string | null
  role: AgentRole
  capabilities: string[]
  visibility: AgentVisibility
  status: AgentStatus
  createdBy: string | null
  description: string | null
  runtime: AgentRuntimeSummary
  skillAccessScope?: string
  memoryAccessScope?: string
}

export interface AgentDetail extends AgentSummary {
  prompt?: string | null
  tools?: string[]
  memoryAccess?: string[]
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

export type AgentAssignmentType = 'REQUIREMENT_GROUP' | 'WORKFLOW'

export interface AgentAssignmentSummary {
  type: AgentAssignmentType
  resourceId: string
  resourceName: string
  status: string
}

export interface AgentTaskRunSummary {
  id: string
  projectId: string
  taskId: string
  taskStepId: string
  agentId: string
  role: AgentRole
  status: TaskRunStatus
  retryOfTaskRunId: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  task: { id: string; displayId: string | null; title: string }
  taskStep: { id: string; title: string; role: string }
  requirementGroup: { id: string; name: string }
  repository: { id: string; displayName: string } | null
  statusReason: { code: string | null; summary: string } | null
}

export interface CreateAgentPayload {
  name: string
  avatar?: string
  role: AgentRole
  capabilities: string[]
  prompt: string
}

export type UpdateAgentPayload = Partial<CreateAgentPayload>
