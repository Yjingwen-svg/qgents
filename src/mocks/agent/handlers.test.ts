import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { agentHandlers, resetAgentStores } from './handlers'

const server = setupServer(...agentHandlers)
const baseUrl = 'http://localhost/api'

async function json<T>(response: Response): Promise<T> { return (await response.json()) as T }

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetAgentStores())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Agent team MSW API', () => {
  it('returns different Agent content for different team responses and hides private prompt in the list', async () => {
    const first = await json<{ data: Array<{ id: string; name: string; prompt?: string }> }>(await fetch(`${baseUrl}/teams/team-a/agents`))
    const second = await json<{ data: Array<{ id: string; name: string; prompt?: string }> }>(await fetch(`${baseUrl}/teams/team-b/agents?scenario=ALT`))
    expect(first.data.map((agent) => agent.name)).not.toEqual(second.data.map((agent) => agent.name))
    expect(first.data.every((agent) => agent.prompt === undefined)).toBe(true)
    expect(first.data.some((agent) => agent.id === 'agent-private-backend')).toBe(true)
  })

  it('creates, edits, publishes, unpublishes and archives a private Agent', async () => {
    const created = await json<{ data: { id: string; visibility: string; name: string } }>(await fetch(`${baseUrl}/teams/team-life/agents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'create-agent' }, body: JSON.stringify({ name: 'New Agent', role: 'GENERAL', capabilities: ['docs'], prompt: 'private prompt' }),
    }))
    expect(created.data.visibility).toBe('PRIVATE')
    const edited = await json<{ data: { name: string } }>(await fetch(`${baseUrl}/teams/team-life/agents/${created.data.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'edit-agent' }, body: JSON.stringify({ name: 'Edited Agent' }),
    }))
    expect(edited.data.name).toBe('Edited Agent')
    const published = await json<{ data: { visibility: string } }>(await fetch(`${baseUrl}/teams/team-life/agents/${created.data.id}/publish`, { method: 'POST', headers: { 'Idempotency-Key': 'publish-agent' } }))
    expect(published.data.visibility).toBe('TEAM_SHARED')
    const unpublished = await json<{ data: { visibility: string } }>(await fetch(`${baseUrl}/teams/team-life/agents/${created.data.id}/unpublish`, { method: 'POST', headers: { 'Idempotency-Key': 'unpublish-agent' } }))
    expect(unpublished.data.visibility).toBe('PRIVATE')
    const archived = await json<{ data: { availability: string } }>(await fetch(`${baseUrl}/teams/team-life/agents/${created.data.id}/archive`, { method: 'POST', headers: { 'Idempotency-Key': 'archive-agent' } }))
    expect(archived.data.availability).toBe('ARCHIVED')
  })

  it('protects private details and validates permissions, missing resources, conflicts and input', async () => {
    const list = await json<{ data: Array<{ id: string }> }>(await fetch(`${baseUrl}/teams/team-errors/agents`))
    const otherAgent = list.data.find((agent) => agent.id === 'agent-shared-frontend')
    const privateDetail = await json<{ data: { prompt?: string } }>(await fetch(`${baseUrl}/teams/team-errors/agents/agent-private-backend`))
    expect(privateDetail.data.prompt).toBeDefined()
    const forbiddenEdit = await fetch(`${baseUrl}/teams/team-errors/agents/${otherAgent?.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'nope' }) })
    expect(forbiddenEdit.status).toBe(403)
    expect((await fetch(`${baseUrl}/teams/team-errors/agents/missing`)).status).toBe(404)
    expect((await fetch(`${baseUrl}/teams/team-errors/agents/agent-private-backend/publish?error=CONFLICT`, { method: 'POST' })).status).toBe(409)
    expect((await fetch(`${baseUrl}/teams/team-errors/agents`, { method: 'POST', body: JSON.stringify({ name: '' }) })).status).toBe(422)
    expect((await fetch(`${baseUrl}/teams/team-errors/agents?scenario=FORBIDDEN`)).status).toBe(403)
  })

  it('supports the confirmed Skill binding GET/PUT contract without an idempotency key', async () => {
    const before = await json<{ data: { agentId: string; skillIds: string[] } }>(await fetch(`${baseUrl}/projects/project-skill/agent-skill-bindings/agent-private-backend`))
    expect(before.data.agentId).toBe('agent-private-backend')
    const response = await fetch(`${baseUrl}/projects/project-skill/agent-skill-bindings/agent-private-backend`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillIds: ['skill-api'] }) })
    const result = await json<{ data: { agentId: string; skillIds: string[]; skills: Array<{ id: string }>; updatedAt: string } }>(response)
    expect(result.data).toMatchObject({ agentId: 'agent-private-backend', skillIds: ['skill-api'] })
    expect(result.data.skills[0]?.id).toBe('skill-api')
    expect(result.data.updatedAt).toBeTruthy()
    const empty = await fetch(`${baseUrl}/projects/project-skill/agent-skill-bindings/agent-private-backend`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillIds: [] }) })
    expect((await json<{ data: { skillIds: string[] } }>(empty)).data.skillIds).toEqual([])
    const duplicate = await fetch(`${baseUrl}/projects/project-skill/agent-skill-bindings/agent-private-backend`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillIds: ['skill-api', 'skill-api'] }) })
    expect(duplicate.status).toBe(409)
  })
})
