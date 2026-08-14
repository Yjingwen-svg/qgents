import { http, HttpResponse, type PathParams } from 'msw'
import type { AgentDetail, UpdateAgentPayload } from '@/types'
import { createAgentFixtures, supportedAgentRoles } from './fixtures'

const stores = new Map<string, AgentDetail[]>()
const value = (params: PathParams, key: string): string => typeof params[key] === 'string' ? params[key] : ''
const response = <T,>(data: T, status = 200) => HttpResponse.json({ data, requestId: 'mock-agent-request' }, { status })
const error = (status: 403 | 404 | 409 | 422, code: string) => HttpResponse.json({ error: { code, message: code, details: [] }, requestId: 'mock-agent-request' }, { status })
const store = (teamId: string): AgentDetail[] => stores.get(teamId) ?? (() => { const agents = createAgentFixtures(); stores.set(teamId, agents); return agents })()
const body = (request: Request): Promise<Record<string, unknown>> => request.json().then((data: unknown) => data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {})
const nonEmpty = (input: unknown): input is string => typeof input === 'string' && input.trim().length > 0
export const resetAgentStores = (): void => stores.clear()

export const agentHandlers = [
  http.get('*/api/teams/:teamId/agents', ({ params, request }) => {
    if (new URL(request.url).searchParams.get('scenario') === 'FORBIDDEN') return error(403, 'TEAM_MEMBER_REQUIRED')
    const data = store(value(params, 'teamId')).map(({ prompt: _prompt, ...agent }) => agent)
    return HttpResponse.json({ data, page: { nextCursor: null, hasMore: false }, requestId: 'mock-agent-request' })
  }),
  http.get('*/api/teams/:teamId/agents/:agentId', ({ params }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); return agent ? response(agent) : error(404, 'AGENT_NOT_FOUND') }),
  http.post('*/api/teams/:teamId/agents', async ({ params, request }) => {
    const input = await body(request)
    if (!nonEmpty(input.name) || !nonEmpty(input.prompt) || !Array.isArray(input.capabilities) || input.capabilities.length === 0 || !supportedAgentRoles.includes(input.role as AgentDetail['role'])) return error(422, 'VALIDATION_FAILED')
    const agent: AgentDetail = { id: `agent-created-${Date.now()}`, name: input.name.trim(), avatar: typeof input.avatar === 'string' ? input.avatar : null, role: input.role as AgentDetail['role'], capabilities: input.capabilities.filter(nonEmpty), visibility: 'PRIVATE', status: 'ACTIVE', createdBy: 'demo-user', prompt: input.prompt }
    store(value(params, 'teamId')).push(agent); return response(agent, 201)
  }),
  http.patch('*/api/teams/:teamId/agents/:agentId', async ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (agent.visibility === 'SYSTEM') return error(403, 'AGENT_EDIT_FORBIDDEN'); const input = await body(request) as UpdateAgentPayload; if (nonEmpty(input.name)) agent.name = input.name.trim(); if (typeof input.avatar === 'string') agent.avatar = input.avatar || null; if (input.role && supportedAgentRoles.includes(input.role)) agent.role = input.role; if (Array.isArray(input.capabilities)) agent.capabilities = input.capabilities.filter(nonEmpty); if (typeof input.prompt === 'string') agent.prompt = input.prompt; return response(agent) }),
  http.post('*/api/teams/:teamId/agents/:agentId/publish', ({ params, request }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (new URL(request.url).searchParams.get('error') === 'CONFLICT') return error(409, 'INVALID_AGENT_STATE'); if (agent.status !== 'ACTIVE' || agent.visibility !== 'PRIVATE') return error(422, 'AGENT_NOT_PUBLISHABLE'); agent.visibility = 'TEAM'; return response(agent, 202) }),
  http.post('*/api/teams/:teamId/agents/:agentId/unpublish', ({ params }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (agent.status !== 'ACTIVE' || agent.visibility !== 'TEAM') return error(422, 'AGENT_NOT_UNPUBLISHABLE'); agent.visibility = 'PRIVATE'; return response(agent, 202) }),
  http.post('*/api/teams/:teamId/agents/:agentId/archive', ({ params }) => { const agent = store(value(params, 'teamId')).find((item) => item.id === value(params, 'agentId')); if (!agent) return error(404, 'AGENT_NOT_FOUND'); if (agent.status === 'ARCHIVED' || agent.visibility === 'SYSTEM') return error(422, 'AGENT_NOT_ARCHIVABLE'); agent.status = 'ARCHIVED'; return response(agent, 202) }),
]
