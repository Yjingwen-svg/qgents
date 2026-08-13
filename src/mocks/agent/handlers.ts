import { http, HttpResponse, type PathParams } from 'msw'
import type { AgentDetail, AgentSkillBindingResponse, CreateAgentPayload, UpdateAgentPayload } from '@/types'
import { createAgentFixtures, projectSkillFixtures, supportedAgentRoles } from './fixtures'

const stores = new Map<string, AgentDetail[]>()

const value = (params: PathParams, name: string): string => typeof params[name] === 'string' ? params[name] : ''
const response = <T,>(data: T, status = 200) => HttpResponse.json({ data, requestId: 'mock-agent-request' }, { status })
const error = (status: 403 | 404 | 409 | 422, code: string, message: string) =>
  HttpResponse.json({ error: { code, message, details: [] }, requestId: 'mock-agent-request' }, { status })

function store(teamId: string): AgentDetail[] {
  const existing = stores.get(teamId)
  if (existing) return existing
  const created = createAgentFixtures(teamId)
  stores.set(teamId, created)
  return created
}

function body(request: Request): Promise<Record<string, unknown>> {
  return request.json().then((input: unknown) =>
    input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {},
  )
}

function nonEmpty(valueToCheck: unknown): valueToCheck is string {
  return typeof valueToCheck === 'string' && valueToCheck.trim().length > 0
}

function updateAgent(agent: AgentDetail, input: CreateAgentPayload | UpdateAgentPayload): void {
  if (nonEmpty(input.name)) agent.name = input.name.trim()
  if (typeof input.avatar === 'string') agent.avatar = input.avatar || null
  if (input.role && supportedAgentRoles.includes(input.role)) agent.role = input.role
  if (Array.isArray(input.capabilities)) agent.capabilities = input.capabilities.filter(nonEmpty)
  if (typeof input.prompt === 'string' && agent.permissions.canViewPrivateConfig) agent.prompt = input.prompt
}

function findAgent(agentId: string): AgentDetail | undefined {
  const existing = [...stores.values()].flat().find((agent) => agent.id === agentId)
  return existing ?? store('team-demo').find((agent) => agent.id === agentId)
}

function bindingResponse(agent: AgentDetail): AgentSkillBindingResponse {
  const bindings = agent.skillBindings ?? []
  return {
    agentId: agent.id,
    skillIds: bindings.map((skill) => skill.skillId),
    skills: bindings.map((skill) => ({ id: skill.skillId, name: skill.name, visibility: skill.scope, status: 'PUBLISHED' })),
    updatedAt: '2026-08-13T00:00:00.000Z',
  }
}

export function resetAgentStores(): void {
  stores.clear()
}

export const agentHandlers = [
  http.get('*/api/projects/:projectId', ({ params }) =>
    response({ id: value(params, 'projectId'), teamId: 'team-demo', name: 'Demo Project' })),
  http.get('*/api/projects/:projectId/skills', () => response(projectSkillFixtures)),
  http.get('*/api/teams/:teamId/agents', ({ params, request }) => {
    const list = store(value(params, 'teamId'))
    const scenario = new URL(request.url).searchParams.get('scenario')
    if (scenario === 'FORBIDDEN') return error(403, 'TEAM_MEMBER_REQUIRED', 'Agent access forbidden')
    const summaries = list.map(({ prompt: _prompt, config: _config, skillBindings: _skillBindings, ...summary }) => summary)
    const data = scenario === 'ALT'
      ? summaries.map((summary, index) => index === 0 ? { ...summary, name: `${summary.name} (alternate)` } : summary)
      : summaries
    return HttpResponse.json({ data, page: { nextCursor: null, hasMore: false }, requestId: 'mock-agent-request' })
  }),
  http.get('*/api/teams/:teamId/agents/:agentId', ({ params }) => {
    const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId'))
    return agent ? response(agent) : error(404, 'AGENT_NOT_FOUND', 'Agent not found')
  }),
  http.post('*/api/teams/:teamId/agents', async ({ params, request }) => {
    const teamId = value(params, 'teamId')
    const input = await body(request)
    if (new URL(request.url).searchParams.get('error') === 'FORBIDDEN') return error(403, 'AGENT_CREATE_FORBIDDEN', 'Agent creation forbidden')
    if (!nonEmpty(input.name) || !nonEmpty(input.prompt) || !Array.isArray(input.capabilities) || input.capabilities.length === 0) {
      return error(422, 'VALIDATION_FAILED', 'Name, capabilities and prompt are required')
    }
    if (!supportedAgentRoles.includes(input.role as AgentDetail['role'])) return error(422, 'INVALID_AGENT_ROLE', 'Invalid Agent role')
    const payload = input as unknown as CreateAgentPayload
    const agent: AgentDetail = {
      id: `agent-created-${Date.now()}`,
      teamId,
      name: payload.name.trim(),
      avatar: payload.avatar ?? null,
      role: payload.role,
      capabilities: payload.capabilities.filter(nonEmpty),
      description: payload.capabilities.join(' / '),
      visibility: 'PRIVATE',
      availability: 'IDLE',
      createdBy: 'demo-user',
      permissions: { canEdit: true, canPublish: true, canUnpublish: true, canArchive: true, canBindSkills: true, canViewPrivateConfig: true },
      prompt: payload.prompt,
      config: {},
      presentation: { concurrencyLimit: null, requirementUsage: null, workflowUsage: null, skillScope: 'UNKNOWN', memoryScope: 'UNKNOWN', assignmentDetails: [], runningTasks: [], runRecords: [] },
      skillBindings: [],
    }
    store(teamId).push(agent)
    return response(agent, 201)
  }),
  http.patch('*/api/teams/:teamId/agents/:agentId', async ({ params, request }) => {
    const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId'))
    if (!agent) return error(404, 'AGENT_NOT_FOUND', 'Agent not found')
    if (!agent.permissions.canEdit) return error(403, 'AGENT_EDIT_FORBIDDEN', 'Agent edit forbidden')
    updateAgent(agent, await body(request) as unknown as UpdateAgentPayload)
    return response(agent)
  }),
  ...(['publish', 'unpublish', 'archive'] as const).map((action) =>
    http.post(`*/api/teams/:teamId/agents/:agentId/${action}`, ({ params, request }) => {
      const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId'))
      if (!agent) return error(404, 'AGENT_NOT_FOUND', 'Agent not found')
      if (new URL(request.url).searchParams.get('error') === 'CONFLICT') return error(409, 'INVALID_AGENT_STATE', 'Agent state conflict')
      if (!agent.permissions.canEdit) return error(403, 'AGENT_ACTION_FORBIDDEN', 'Agent action forbidden')
      if (action === 'publish') agent.visibility = 'TEAM_SHARED'
      if (action === 'unpublish') agent.visibility = 'PRIVATE'
      if (action === 'archive') agent.availability = 'ARCHIVED'
      return response(agent, 202)
    })),
  http.get('*/api/projects/:projectId/agent-skill-bindings/:agentId', ({ params }) => {
    const agent = findAgent(value(params, 'agentId'))
    return agent ? response(bindingResponse(agent)) : error(404, 'AGENT_NOT_FOUND', 'Agent not found')
  }),
  http.put('*/api/projects/:projectId/agent-skill-bindings/:agentId', async ({ params, request }) => {
    const agent = findAgent(value(params, 'agentId'))
    if (!agent) return error(404, 'AGENT_NOT_FOUND', 'Agent not found')
    if (!agent.permissions.canBindSkills) return error(403, 'AGENT_BINDING_FORBIDDEN', 'Skill binding forbidden')
    const input = await body(request)
    if (!Array.isArray(input.skillIds) || !input.skillIds.every(nonEmpty)) return error(422, 'SKILL_NOT_IN_PROJECT', 'skillIds must be an array of IDs')
    const skillIds = input.skillIds as string[]
    if (new Set(skillIds).size !== skillIds.length) return error(409, 'AGENT_SKILL_DUPLICATE', 'Duplicate skill ID')
    const skills = projectSkillFixtures.filter((skill) => skillIds.includes(skill.id) && skill.available)
    if (skills.length !== skillIds.length) return error(422, 'SKILL_NOT_BINDABLE', 'Skill cannot be bound')
    agent.skillBindings = skills.map((skill) => ({ skillId: skill.id, name: skill.name, scope: skill.scope }))
    return response(bindingResponse(agent))
  }),
]
