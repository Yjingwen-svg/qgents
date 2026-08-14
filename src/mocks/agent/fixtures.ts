import type { AgentDetail, AgentRole } from '@/types'

export const supportedAgentRoles: readonly AgentRole[] = ['ORCHESTRATOR', 'PLANNER', 'DEVELOPER', 'TESTER', 'REVIEWER', 'GENERAL']

export function createAgentFixtures(): AgentDetail[] {
  return [
    { id: 'agent-system-planner', name: 'Planner Agent', avatar: null, role: 'PLANNER', capabilities: ['任务规划'], visibility: 'SYSTEM', status: 'ACTIVE', createdBy: null },
    { id: 'agent-private-backend', name: 'Backend Developer Agent', avatar: null, role: 'DEVELOPER', capabilities: ['Python', 'SQL', 'API'], visibility: 'PRIVATE', status: 'ACTIVE', createdBy: 'demo-user', prompt: '仅创建者可见的 Prompt' },
    { id: 'agent-team-tester', name: 'Tester Agent', avatar: null, role: 'TESTER', capabilities: ['测试'], visibility: 'TEAM', status: 'ACTIVE', createdBy: 'demo-user' },
    { id: 'agent-archived-reviewer', name: 'Reviewer Agent', avatar: null, role: 'REVIEWER', capabilities: ['审查'], visibility: 'PRIVATE', status: 'ARCHIVED', createdBy: 'demo-user' },
  ]
}
