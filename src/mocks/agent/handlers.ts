import { http, HttpResponse, type PathParams } from 'msw'
import type { AgentDetail, AgentSkillBindingResponse, UpdateAgentPayload } from '@/types'
import { MOCK_CURRENT_USER } from '../currentUser'
import { createAgentFixtures, createAgentTaskRunFixtures, getAgentAssignments, supportedAgentRoles } from './fixtures'

const stores = new Map<string, AgentDetail[]>()
const currentUserId = MOCK_CURRENT_USER.id
const value = (params: PathParams, key: string): string => typeof params[key] === 'string' ? params[key] : ''
const response = <T,>(data: T, status = 200) => HttpResponse.json({ data, requestId: 'mock-agent-request' }, { status })
const error = (status: 403 | 404 | 409 | 422, code: string) => HttpResponse.json({ error: { code, message: code, details: [] }, requestId: 'mock-agent-request' }, { status })
const store = (teamId: string): AgentDetail[] => stores.get(teamId) ?? (() => { const agents = createAgentFixtures(); stores.set(teamId, agents); return agents })()
const projectAgent = (agent: AgentDetail, projectId: string): AgentDetail => {
  if (projectId === 'demo-project') return agent
  return { ...agent, runtime: { ...agent.runtime, status: 'IDLE', activeRunCount: 0, assignmentUsage: { requirementGroups: { assignedCount: 0, assignableCount: 0 }, workflows: { assignedCount: 0, assignableCount: 0 } } } }
}
const body = (request: Request): Promise<Record<string, unknown>> => request.json().then((data: unknown) => data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {})
const nonEmpty = (input: unknown): input is string => typeof input === 'string' && input.trim().length > 0
const page = <T,>(items: T[], request: Request): Response => {
  const search = new URL(request.url).searchParams
  const rawLimit = Number(search.get('limit') ?? '30')
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30
  const rawCursor = Number(search.get('cursor') ?? '0')
  const start = Number.isInteger(rawCursor) && rawCursor >= 0 ? rawCursor : 0
  const data = items.slice(start, start + limit)
  const nextStart = start + data.length
  return HttpResponse.json({ data, page: { nextCursor: nextStart < items.length ? String(nextStart) : null, hasMore: nextStart < items.length }, requestId: 'mock-agent-request' })
}
export const resetAgentStores = (): void => stores.clear()

export const agentHandlers = [
  http.get('*/api/teams/:teamId/agents', ({ params, request }) => {
    if (new URL(request.url).searchParams.get('scenario') === 'FORBIDDEN') return error(403, 'TEAM_MEMBER_REQUIRED')
    if (new URL(request.url).searchParams.get('scenario') === 'EMPTY') return HttpResponse.json({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'mock-agent-request' })
    const projectId = new URL(request.url).searchParams.get('projectId') ?? 'demo-project'
    const data = store(value(params, 'teamId')).filter((agent) => agent.createdBy === currentUserId).map((agent) => projectAgent(agent, projectId)).map(({ prompt: _prompt, ...agent }) => agent)
    return page(data, request)
  }),
  http.get('*/api/teams/:teamId/agents/:agentId', ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId') && item.createdBy === currentUserId); const projectId = new URL(request.url).searchParams.get('projectId') ?? 'demo-project'; return agent ? response(projectAgent(agent, projectId)) : error(404, 'AGENT_NOT_FOUND') }),
  http.post('*/api/teams/:teamId/agents', async ({ params, request }) => {
    const input = await body(request)
    if (!nonEmpty(input.name) || !nonEmpty(input.prompt) || !Array.isArray(input.capabilities) || input.capabilities.length === 0 || !supportedAgentRoles.includes(input.role as AgentDetail['role'])) return error(422, 'VALIDATION_FAILED')
    const agent: AgentDetail = { id: `agent-created-${Date.now()}`, name: input.name.trim(), avatar: typeof input.avatar === 'string' ? input.avatar : null, role: input.role as AgentDetail['role'], capabilities: input.capabilities.filter(nonEmpty), visibility: 'PRIVATE', status: 'ACTIVE', createdBy: currentUserId, description: null, skillAccessScope: 'PROJECT', memoryAccessScope: 'PROJECT', runtime: { status: 'IDLE', activeRunCount: 0, concurrencyLimit: null, assignmentUsage: { requirementGroups: { assignedCount: 0, assignableCount: 0 }, workflows: { assignedCount: 0, assignableCount: 0 } } }, prompt: input.prompt, tools: [], memoryAccess: [] }
    store(value(params, 'teamId')).push(agent); return response(agent, 201)
  }),
  http.patch('*/api/teams/:teamId/agents/:agentId', async ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId') && item.createdBy === currentUserId); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (agent.visibility === 'SYSTEM') return error(403, 'AGENT_EDIT_FORBIDDEN'); const input = await body(request) as UpdateAgentPayload; if (nonEmpty(input.name)) agent.name = input.name.trim(); if (typeof input.avatar === 'string') agent.avatar = input.avatar || null; if (input.role && supportedAgentRoles.includes(input.role)) agent.role = input.role; if (Array.isArray(input.capabilities)) agent.capabilities = input.capabilities.filter(nonEmpty); if (typeof input.prompt === 'string') agent.prompt = input.prompt; return response(agent) }),
  http.post('*/api/teams/:teamId/agents/:agentId/publish', ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (new URL(request.url).searchParams.get('error') === 'CONFLICT') return error(409, 'INVALID_AGENT_STATE'); if (agent.status !== 'ACTIVE' || agent.visibility !== 'PRIVATE') return error(422, 'AGENT_NOT_PUBLISHABLE'); agent.visibility = 'TEAM'; return response(agent, 202) }),
  http.post('*/api/teams/:teamId/agents/:agentId/unpublish', ({ params }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (agent.status !== 'ACTIVE' || agent.visibility !== 'TEAM') return error(422, 'AGENT_NOT_UNPUBLISHABLE'); agent.visibility = 'PRIVATE'; return response(agent, 202) }),
  http.post('*/api/teams/:teamId/agents/:agentId/archive', ({ params }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (agent.status === 'ARCHIVED' || agent.visibility === 'SYSTEM') return error(422, 'AGENT_NOT_ARCHIVABLE'); agent.status = 'ARCHIVED'; return response(agent, 202) }),
  http.get('*/api/projects/:projectId/agent-skill-bindings/:agentId', ({ params }) => {
    const agent = store('team-owned-001').find((item) => item.id === value(params, 'agentId') && item.createdBy === currentUserId)
    if (!agent) return error(404, 'AGENT_NOT_FOUND')
    const data: AgentSkillBindingResponse = { agentId: agent.id, skillIds: agent.id === 'agent-private-backend' ? ['skill-typescript', 'skill-api'] : [], skills: agent.id === 'agent-private-backend' ? [{ id: 'skill-typescript', name: 'TypeScript', visibility: 'PROJECT_SHARED', status: 'PUBLISHED' }, { id: 'skill-api', name: 'API 设计', visibility: 'PROJECT_SHARED', status: 'PUBLISHED' }] : [], updatedAt: '2026-08-13T00:00:00Z' }
    return response(data)
  }),
  http.get('*/api/projects/:projectId/agents/:agentId/assignments', ({ params, request }) => {
    const type = new URL(request.url).searchParams.get('type')
    if (type !== 'REQUIREMENT_GROUP' && type !== 'WORKFLOW') return error(422, 'INVALID_ASSIGNMENT_TYPE')
    const agent = store('team-owned-001').find((item) => item.id === value(params, 'agentId') && item.createdBy === currentUserId)
    if (!agent) return error(404, 'AGENT_NOT_FOUND')
    return page(value(params, 'projectId') === 'demo-project' ? getAgentAssignments(agent.id, type) : [], request)
  }),
  http.get('*/api/projects/:projectId/task-runs', ({ params, request }) => {
    const projectId = value(params, 'projectId')
    const search = new URL(request.url).searchParams
    const agentId = search.get('agentId')
    if (!agentId) return error(422, 'AGENT_ID_REQUIRED')
    const currentAgentIds = store('team-owned-001').filter((agent) => agent.createdBy === currentUserId).map((agent) => agent.id)
    const data = createAgentTaskRunFixtures().filter((run) => currentAgentIds.includes(run.agentId) && run.projectId === projectId && run.agentId === agentId).filter((run) => !search.get('status') || run.status === search.get('status')).sort((left, right) => Date.parse(right.startedAt ?? right.createdAt) - Date.parse(left.startedAt ?? left.createdAt))
    return page(data, request)
  }),
]
