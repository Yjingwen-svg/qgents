import type { AgentAssignmentSummary, AgentDetail, AgentRole, AgentTaskRunSummary } from '@/types'
import { MOCK_CURRENT_USER } from '../currentUser'

export const supportedAgentRoles: readonly AgentRole[] = ['ORCHESTRATOR', 'PLANNER', 'DEVELOPER', 'TESTER', 'REVIEWER', 'GENERAL']

type AssignmentCapacity = AgentDetail['runtime']['assignmentUsage']

function activeTaskRunStatus(status: AgentTaskRunSummary['status']): boolean {
  return ['QUEUED', 'RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED', 'CANCELLING'].includes(status)
}

function createAgentRuntime(agentId: string, assignableCount: AssignmentCapacity): AgentDetail['runtime'] {
  const activeRunCount = createAgentTaskRunFixtures().filter((run) => run.projectId === 'demo-project' && run.agentId === agentId && activeTaskRunStatus(run.status)).length
  const requirementGroups = getAgentAssignments(agentId, 'REQUIREMENT_GROUP').length
  const workflows = getAgentAssignments(agentId, 'WORKFLOW').length
  return {
    status: activeRunCount > 0 ? 'RUNNING' : 'IDLE',
    activeRunCount,
    concurrencyLimit: null,
    assignmentUsage: {
      requirementGroups: { assignedCount: requirementGroups, assignableCount: assignableCount.requirementGroups.assignableCount },
      workflows: { assignedCount: workflows, assignableCount: assignableCount.workflows.assignableCount },
    },
  }
}

export function createAgentFixtures(): AgentDetail[] {
  return [
    { id: 'agent-system-planner', name: 'Planner Agent', avatar: null, role: 'PLANNER', capabilities: ['任务规划'], visibility: 'SYSTEM', status: 'ACTIVE', createdBy: null, description: '系统内置的任务规划能力。', skillAccessScope: 'PROJECT', memoryAccessScope: 'PROJECT', runtime: createAgentRuntime('agent-system-planner', { requirementGroups: { assignedCount: 0, assignableCount: 0 }, workflows: { assignedCount: 0, assignableCount: 0 } }) },
    { id: 'agent-private-backend', name: 'Backend Developer Agent', avatar: null, role: 'DEVELOPER', capabilities: ['Python', 'SQL', 'API'], visibility: 'PRIVATE', status: 'ACTIVE', createdBy: MOCK_CURRENT_USER.id, description: '负责后端接口与数据层实现。', skillAccessScope: 'PROJECT', memoryAccessScope: 'PROJECT', runtime: createAgentRuntime('agent-private-backend', { requirementGroups: { assignedCount: 0, assignableCount: 3 }, workflows: { assignedCount: 0, assignableCount: 0 } }), prompt: '仅创建者可见的 Prompt', tools: ['代码执行', '测试运行'], memoryAccess: ['当前项目共享 Memory'] },
    { id: 'agent-team-tester', name: 'Tester Agent', avatar: null, role: 'TESTER', capabilities: ['测试'], visibility: 'TEAM', status: 'ACTIVE', createdBy: MOCK_CURRENT_USER.id, description: '负责自动化测试与质量检查。', skillAccessScope: 'PROJECT', memoryAccessScope: 'PROJECT', runtime: createAgentRuntime('agent-team-tester', { requirementGroups: { assignedCount: 0, assignableCount: 2 }, workflows: { assignedCount: 0, assignableCount: 0 } }), tools: [], memoryAccess: ['当前项目共享 Memory'] },
    { id: 'agent-archived-reviewer', name: 'Reviewer Agent', avatar: null, role: 'REVIEWER', capabilities: ['审查'], visibility: 'PRIVATE', status: 'ARCHIVED', createdBy: MOCK_CURRENT_USER.id, description: '已归档的审查 Agent。', skillAccessScope: 'PROJECT', memoryAccessScope: 'PROJECT', runtime: createAgentRuntime('agent-archived-reviewer', { requirementGroups: { assignedCount: 0, assignableCount: 1 }, workflows: { assignedCount: 0, assignableCount: 0 } }) },
    { id: 'agent-other-user', name: 'Other User Agent', avatar: null, role: 'GENERAL', capabilities: ['Other'], visibility: 'PRIVATE', status: 'ACTIVE', createdBy: 'user-002', description: 'Other user fixture for isolation tests.', skillAccessScope: 'PROJECT', memoryAccessScope: 'PROJECT', runtime: createAgentRuntime('agent-other-user', { requirementGroups: { assignedCount: 0, assignableCount: 0 }, workflows: { assignedCount: 0, assignableCount: 0 } }) },
  ]
}

const assignments: Record<string, AgentAssignmentSummary[]> = {
  'agent-private-backend:REQUIREMENT_GROUP': [
    { type: 'REQUIREMENT_GROUP', resourceId: 'group-demo-project-requirements', resourceName: '登录功能', status: 'ACTIVE' },
    { type: 'REQUIREMENT_GROUP', resourceId: 'group-demo-project-security', resourceName: '权限与安全测试', status: 'ACTIVE' },
  ],
}

export function getAgentAssignments(agentId: string, type: AgentAssignmentSummary['type']): AgentAssignmentSummary[] {
  return assignments[`${agentId}:${type}`] ?? []
}

export function createAgentTaskRunFixtures(): AgentTaskRunSummary[] {
  return [
    {
      id: 'run-step-task-demo-project-main-developer',
      projectId: 'demo-project',
      taskId: 'task-demo-project-main',
      taskStepId: 'step-task-demo-project-main-developer',
      agentId: 'agent-private-backend',
      role: 'DEVELOPER',
      status: 'WAITING_INPUT',
      retryOfTaskRunId: null,
      createdAt: '2026-08-14T08:01:00Z',
      startedAt: '2026-08-14T08:02:00Z',
      finishedAt: null,
      durationMs: null,
      task: { id: 'task-demo-project-main', displayCode: 'TASK-001', title: '实现邮箱登录' },
      taskStep: { id: 'step-task-demo-project-main-developer', title: '实现登录接口', role: 'DEVELOPER' },
      requirementGroup: { id: 'group-demo-project-requirements', name: '登录功能' },
      repository: { id: 'repository-demo-project', displayName: 'qgents-web' },
      statusReason: null,
    },
    {
      id: 'run-demo-project-failed',
      projectId: 'demo-project',
      taskId: 'task-demo-project-pending',
      taskStepId: 'step-task-demo-project-pending-developer',
      agentId: 'agent-private-backend',
      role: 'DEVELOPER',
      status: 'FAILED',
      retryOfTaskRunId: null,
      createdAt: '2026-08-13T09:00:00Z',
      startedAt: '2026-08-13T09:01:00Z',
      finishedAt: '2026-08-13T09:06:00Z',
      durationMs: 300000,
      task: { id: 'task-demo-project-pending', displayCode: 'TASK-002', title: '补充支付回调' },
      taskStep: { id: 'step-task-demo-project-pending-developer', title: '实现回调接口', role: 'DEVELOPER' },
      requirementGroup: { id: 'group-demo-project-requirements', name: '支付回调' },
      repository: { id: 'repository-demo-project', displayName: 'qgents-web' },
      statusReason: { code: 'MOCK_TEST_FAILED', summary: '测试未通过，已停止当前执行。' },
    },
  ]
}
