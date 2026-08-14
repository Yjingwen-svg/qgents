import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { agentHandlers, resetAgentStores } from './handlers'

const server = setupServer(...agentHandlers)
const baseUrl = 'http://localhost/api'
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => resetAgentStores())
const json = async <T,>(response: Response): Promise<T> => response.json() as Promise<T>

describe('Agent team MSW API', () => {
  it('returns documented list DTOs without Prompt', async () => {
    const result = await json<{ data: Array<Record<string, unknown>> }>(await fetch(`${baseUrl}/teams/team-a/agents`))
    expect(result.data[0]).toMatchObject({ visibility: 'SYSTEM', status: 'ACTIVE' })
    expect(result.data.every((agent) => agent.prompt === undefined && agent.availability === undefined && agent.permissions === undefined)).toBe(true)
  })
  it('creates, publishes, unpublishes and archives using formal status and visibility', async () => {
    const created = await json<{ data: { id: string; visibility: string; status: string } }>(await fetch(`${baseUrl}/teams/team-a/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New', role: 'DEVELOPER', capabilities: ['API'], prompt: 'private' }) }))
    expect(created.data).toMatchObject({ visibility: 'PRIVATE', status: 'ACTIVE' })
    const published = await json<{ data: { visibility: string } }>(await fetch(`${baseUrl}/teams/team-a/agents/${created.data.id}/publish`, { method: 'POST' })); expect(published.data.visibility).toBe('TEAM')
    const unpublished = await json<{ data: { visibility: string } }>(await fetch(`${baseUrl}/teams/team-a/agents/${created.data.id}/unpublish`, { method: 'POST' })); expect(unpublished.data.visibility).toBe('PRIVATE')
    const archived = await json<{ data: { status: string } }>(await fetch(`${baseUrl}/teams/team-a/agents/${created.data.id}/archive`, { method: 'POST' })); expect(archived.data.status).toBe('ARCHIVED')
  })
  it('returns documented error classes', async () => {
    expect((await fetch(`${baseUrl}/teams/team-a/agents/missing`)).status).toBe(404)
    expect((await fetch(`${baseUrl}/teams/team-a/agents?scenario=FORBIDDEN`)).status).toBe(403)
    expect((await fetch(`${baseUrl}/teams/team-a/agents/agent-private-backend/publish?error=CONFLICT`, { method: 'POST' })).status).toBe(409)
    expect((await fetch(`${baseUrl}/teams/team-a/agents/agent-system-planner/archive`, { method: 'POST' })).status).toBe(422)
  })
})
