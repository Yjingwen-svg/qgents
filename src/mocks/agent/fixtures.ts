import type { AgentDetail, AgentPresentation, AgentRole, AgentSummary, ProjectSkillOption } from '@/types'

const now = '2026-08-12T00:00:00.000Z'
const presentation = (overrides: Partial<AgentPresentation> = {}): AgentPresentation => ({
  concurrencyLimit: 3,
  requirementUsage: { used: 3, total: 6 },
  workflowUsage: { used: 3, total: 5 },
  skillScope: 'PROJECT',
  memoryScope: 'PROJECT',
  assignmentDetails: ['登录功能需求群 · 2 个任务', '默认交付工作流 · 1 个任务'],
  runningTasks: ['实现登录接口', 'Token 校验逻辑'],
  runRecords: [{ id: 'run-1', title: '登录接口实现', status: 'RUNNING', updatedAt: now }],
  ...overrides,
})

const permissions = (canEdit: boolean): AgentSummary['permissions'] => ({
  canEdit,
  canPublish: canEdit,
  canUnpublish: canEdit,
  canArchive: canEdit,
  canBindSkills: canEdit,
  canViewPrivateConfig: canEdit,
})

export function createAgentFixtures(teamId: string): AgentDetail[] {
  return [
    {
      id: 'agent-system-planner', teamId, name: 'Planner Agent', avatar: null, role: 'PLANNER', capabilities: ['任务规划', '流程编排'], description: '任务规划与拆解、流程编排', visibility: 'SYSTEM', availability: 'RUNNING', createdBy: null, permissions: permissions(false), presentation: presentation({ concurrencyLimit: 2, workflowUsage: { used: 2, total: 4 }, runRecords: [] }), skillBindings: [],
    },
    {
      id: 'agent-private-backend', teamId, name: 'Backend Developer Agent', avatar: null, role: 'DEVELOPER', capabilities: ['Python', 'SQL', 'API'], description: '后端开发能力（Python/SQL/API）', visibility: 'PRIVATE', availability: 'RUNNING', createdBy: 'demo-user', permissions: permissions(true), prompt: '只对创建者可见的后端开发 Prompt', config: { temperature: 0.2, maxTokens: 4096 }, presentation: presentation(), skillBindings: [{ skillId: 'skill-api', name: 'API 规范', scope: 'PROJECT' }],
    },
    {
      id: 'agent-shared-frontend', teamId, name: 'Frontend Developer Agent', avatar: null, role: 'DEVELOPER', capabilities: ['React', 'Vue', 'TypeScript'], description: '前端开发能力（React/Vue/TS）', visibility: 'TEAM_SHARED', availability: 'RUNNING', createdBy: 'other-user', permissions: permissions(false), presentation: presentation({ concurrencyLimit: 3 }), skillBindings: [],
    },
    {
      id: 'agent-idle-tester', teamId, name: 'Tester Agent', avatar: null, role: 'TESTER', capabilities: ['Playwright', '测试设计'], description: '测试设计与执行', visibility: 'TEAM_SHARED', availability: 'IDLE', createdBy: 'other-user', permissions: permissions(false), presentation: presentation({ concurrencyLimit: 2, requirementUsage: { used: 2, total: 6 }, workflowUsage: { used: 2, total: 4 }, runRecords: [] }), skillBindings: [],
    },
    {
      id: 'agent-archived-writer', teamId, name: 'Analyst Writer Agent', avatar: null, role: 'GENERAL', capabilities: ['需求分析', '文档撰写'], description: '需求分析与文档撰写', visibility: 'PRIVATE', availability: 'ARCHIVED', createdBy: 'demo-user', permissions: permissions(true), presentation: presentation({ concurrencyLimit: 2, requirementUsage: null, workflowUsage: null, skillScope: 'UNKNOWN', memoryScope: 'UNKNOWN', assignmentDetails: [], runningTasks: [], runRecords: [] }), skillBindings: [], prompt: 'Archived Agent prompt',
    },
  ]
}

export const projectSkillFixtures: ProjectSkillOption[] = [
  { id: 'skill-api', name: 'API 规范', scope: 'PROJECT', available: true },
  { id: 'skill-test', name: '测试工具', scope: 'PROJECT', available: true },
  { id: 'skill-private', name: '个人 Skill', scope: 'PRIVATE', available: false },
]

export const supportedAgentRoles: AgentRole[] = ['ORCHESTRATOR', 'PLANNER', 'DEVELOPER', 'TESTER', 'REVIEWER', 'GENERAL']
