import { http, HttpResponse, type PathParams } from 'msw'
import type { AgentDetail, CreateAgentPayload, UpdateAgentPayload } from '@/types'
import { createAgentFixtures, projectSkillFixtures, supportedAgentRoles } from './fixtures'

const stores = new Map<string, AgentDetail[]>()
const value = (params: PathParams, name: string): string => typeof params[name] === 'string' ? params[name] : ''
const response = <T,>(data: T, status = 200) => HttpResponse.json({ data, requestId: 'mock-agent-request' }, { status })
const error = (status: 403 | 404 | 409 | 422, code: string, message: string) => HttpResponse.json({ error: { code, message, details: [] }, requestId: 'mock-agent-request' }, { status })
function store(teamId: string): AgentDetail[] { const existing = stores.get(teamId); if (existing) return existing; const created = createAgentFixtures(teamId); stores.set(teamId, created); return created }
function body(request: Request): Promise<Record<string, unknown>> { return request.json().then((input: unknown) => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}) }
function nonEmpty(valueToCheck: unknown): valueToCheck is string { return typeof valueToCheck === 'string' && valueToCheck.trim().length > 0 }
function updateAgent(agent: AgentDetail, input: CreateAgentPayload | UpdateAgentPayload): void { if (nonEmpty(input.name)) agent.name = input.name.trim(); if (typeof input.avatar === 'string') agent.avatar = input.avatar || null; if (input.role && supportedAgentRoles.includes(input.role)) agent.role = input.role; if (Array.isArray(input.capabilities)) agent.capabilities = input.capabilities.filter(nonEmpty); if (typeof input.prompt === 'string' && agent.permissions.canViewPrivateConfig) agent.prompt = input.prompt }

export function resetAgentStores(): void { stores.clear() }

export const agentHandlers = [
  http.get('*/api/projects/:projectId', ({ params }) => response({ id: value(params, 'projectId'), teamId: 'team-demo', name: '登录系统项目' })),
  http.get('*/api/projects/:projectId/skills', () => response(projectSkillFixtures)),
  http.get('*/api/teams/:teamId/agents', ({ params, request }) => {
    const teamId = value(params, 'teamId'); const list = store(teamId); const scenario = new URL(request.url).searchParams.get('scenario');
    if (scenario === 'FORBIDDEN') return error(403, 'TEAM_MEMBER_REQUIRED', '无权访问 Agent 团队')
    const summaries = list.map(({ prompt: _prompt, config: _config, skillBindings: _skillBindings, ...summary }) => summary)
    const responseData = scenario === 'ALT'
      ? summaries.map((summary, index) => index === 0 ? { ...summary, name: `${summary.name}（替代响应）` } : summary)
      : summaries
    return HttpResponse.json({ data: responseData, page: { nextCursor: null, hasMore: false }, requestId: 'mock-agent-request' })
  }),
  http.get('*/api/teams/:teamId/agents/:agentId', ({ params }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); return agent ? response(agent) : error(404, 'AGENT_NOT_FOUND', 'Agent 不存在或当前不可见') }),
  http.post('*/api/teams/:teamId/agents', async ({ params, request }) => {
    const teamId = value(params, 'teamId'); const input = await body(request); if (new URL(request.url).searchParams.get('error') === 'FORBIDDEN') return error(403, 'AGENT_CREATE_FORBIDDEN', '无权创建 Agent');
    if (!nonEmpty(input.name) || !nonEmpty(input.prompt) || !Array.isArray(input.capabilities) || input.capabilities.length === 0) return error(422, 'VALIDATION_FAILED', '名称、能力和 Prompt 必填'); if (!supportedAgentRoles.includes(input.role as AgentDetail['role'])) return error(422, 'INVALID_AGENT_ROLE', 'Agent role 不合法');
    const payload = input as unknown as CreateAgentPayload; const agent: AgentDetail = { id: `agent-created-${Date.now()}`, teamId, name: payload.name.trim(), avatar: payload.avatar ?? null, role: payload.role, capabilities: payload.capabilities.filter(nonEmpty), description: payload.capabilities.join(' / '), visibility: 'PRIVATE', availability: 'IDLE', createdBy: 'demo-user', permissions: { canEdit: true, canPublish: true, canUnpublish: true, canArchive: true, canBindSkills: true, canViewPrivateConfig: true }, prompt: payload.prompt, config: {}, presentation: { concurrencyLimit: null, requirementUsage: null, workflowUsage: null, skillScope: 'UNKNOWN', memoryScope: 'UNKNOWN', assignmentDetails: [], runningTasks: [], runRecords: [] }, skillBindings: [] }; store(teamId).push(agent); return response(agent, 201)
  }),
  http.patch('*/api/teams/:teamId/agents/:agentId', async ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND', 'Agent 不存在'); if (!agent.permissions.canEdit) return error(403, 'AGENT_EDIT_FORBIDDEN', '无权编辑该 Agent'); const input = await body(request) as unknown as UpdateAgentPayload; updateAgent(agent, input); return response(agent) }),
  ...(['publish', 'unpublish', 'archive'] as const).map((action) => http.post(`*/api/teams/:teamId/agents/:agentId/${action}`, ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND', 'Agent 不存在'); if (new URL(request.url).searchParams.get('error') === 'CONFLICT') return error(409, 'INVALID_AGENT_STATE', 'Agent 状态已变化'); if (!agent.permissions.canEdit) return error(403, 'AGENT_ACTION_FORBIDDEN', '无权执行该操作'); if (action === 'publish') agent.visibility = 'TEAM_SHARED'; if (action === 'unpublish') agent.visibility = 'PRIVATE'; if (action === 'archive') agent.availability = 'ARCHIVED'; return response(agent, 202) })),
  http.put('*/api/projects/:projectId/agent-skill-bindings/:agentId', async ({ params, request }) => { const input = await body(request); const agent = [...stores.values()].flat().find((item) => item.id === value(params, 'agentId')) ?? store('team-demo').find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND', 'Agent 不存在'); if (!agent.permissions.canBindSkills) return error(403, 'AGENT_SKILL_BIND_FORBIDDEN', '无权绑定 Skill'); if (!Array.isArray(input.skillIds) || !input.skillIds.every(nonEmpty)) return error(422, 'VALIDATION_FAILED', 'skillIds 必须是 ID 数组'); agent.skillBindings = projectSkillFixtures.filter((skill) => (input.skillIds as unknown[]).includes(skill.id) && skill.available).map((skill) => ({ skillId: skill.id, name: skill.name, scope: skill.scope })); return response(agent) }),
]
