import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AgentDetail } from '@/types'
import { agentHandlers, resetAgentStores } from './handlers'

const server = setupServer(...agentHandlers)
const baseUrl = 'http://localhost/api'
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => resetAgentStores())
const json = async <T,>(response: Response): Promise<T> => response.json() as Promise<T>

describe('Agent team MSW API', () => {
  it('returns only the current user DTOs without Prompt', async () => {
    const result = await json<{ data: Array<Record<string, unknown>>; page: { nextCursor: string | null; hasMore: boolean }; requestId: string }>(await fetch(`${baseUrl}/teams/team-a/agents`))
    expect(result.data[0]).toMatchObject({ id: 'agent-private-backend', createdBy: 'user-001', visibility: 'PRIVATE', status: 'ACTIVE', runtime: { status: 'RUNNING', activeRunCount: 1, concurrencyLimit: 3 } })
    expect(result.data.every((agent) => agent.createdBy === 'user-001')).toBe(true)
    expect(result.data.every((agent) => agent.prompt === undefined && agent.availability === undefined && agent.permissions === undefined)).toBe(true)
    expect(result.page).toEqual({ nextCursor: null, hasMore: false })
    expect(result.requestId).toBeTruthy()
  })
  it('handles every supplied teamId without relying on a fixed fixture ID', async () => {
    const [first, second] = await Promise.all([
      fetch(`${baseUrl}/teams/team-a/agents`),
      fetch(`${baseUrl}/teams/team-b/agents`),
    ])
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
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
  it('keeps assignment counts aligned and paginates project Agent TaskRuns', async () => {
    const assignmentResponse = await fetch(`${baseUrl}/projects/demo-project/agents/agent-private-backend/assignments?type=REQUIREMENT_GROUP&limit=1`)
    await expect(assignmentResponse.json()).resolves.toMatchObject({ data: [{ resourceId: 'group-demo-project-requirements' }], page: { nextCursor: '1', hasMore: true } })
    const assignmentPageTwo = await fetch(`${baseUrl}/projects/demo-project/agents/agent-private-backend/assignments?type=REQUIREMENT_GROUP&cursor=1&limit=1`)
    await expect(assignmentPageTwo.json()).resolves.toMatchObject({ data: [{ resourceId: 'group-demo-project-security' }], page: { nextCursor: null, hasMore: false } })
    const runsResponse = await fetch(`${baseUrl}/projects/demo-project/task-runs?agentId=agent-private-backend&limit=1`)
    const runs = await json<{ data: Array<{ id: string; projectId: string; agentId: string; statusReason: unknown }>; page: { nextCursor: string | null; hasMore: boolean } }>(runsResponse)
    expect(runs.data).toHaveLength(1)
    expect(runs.data[0]).toMatchObject({ projectId: 'demo-project', agentId: 'agent-private-backend' })
    expect(runs.data[0]?.statusReason).toBeNull()
    expect(runs.page).toEqual({ nextCursor: '1', hasMore: true })
    const otherProject = await fetch(`${baseUrl}/teams/team-a/agents?projectId=other-project`)
    const otherProjectData = await json<{ data: Array<{ runtime: { activeRunCount: number; assignmentUsage: { requirementGroups: { assignedCount: number } } } }> }>(otherProject)
    expect(otherProjectData.data[0]?.runtime).toMatchObject({ activeRunCount: 0, assignmentUsage: { requirementGroups: { assignedCount: 0 } } })
  })

  it('filters TaskRuns by status and keeps statusReason redacted to the summary contract', async () => {
    const response = await fetch(`${baseUrl}/projects/demo-project/task-runs?agentId=agent-private-backend&status=FAILED`)
    const result = await json<{ data: Array<{ status: string; statusReason: Record<string, unknown> | null }> }>(response)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ status: 'FAILED', statusReason: { code: 'MOCK_TEST_FAILED' } })
    expect(Object.keys(result.data[0]?.statusReason ?? {}).sort()).toEqual(['code', 'summary'])
    expect(JSON.stringify(result.data)).not.toMatch(/stack|prompt|credential|host|path|log/i)
  })

  it('derives runtime status and active count from the project TaskRun relation', async () => {
    const [agentsResponse, runsResponse] = await Promise.all([
      fetch(`${baseUrl}/teams/team-a/agents?projectId=demo-project`),
      fetch(`${baseUrl}/projects/demo-project/task-runs?agentId=agent-private-backend`),
    ])
    const agents = await json<{ data: Array<Pick<AgentDetail, 'id' | 'runtime'>> }>(agentsResponse)
    const runs = await json<{ data: Array<{ status: string }> }>(runsResponse)
    const active = runs.data.filter((run) => ['QUEUED', 'RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED', 'CANCELLING'].includes(run.status)).length
    const backend = agents.data.find((item) => item.id === 'agent-private-backend')
    expect(backend?.runtime.activeRunCount).toBe(active)
    expect(backend?.runtime.activeRunCount).toBeLessThanOrEqual(backend?.runtime.concurrencyLimit ?? 0)
    expect(backend?.runtime.status).toBe(active > 0 ? 'RUNNING' : 'IDLE')
    const tester = agents.data.find((item) => item.id === 'agent-team-tester')
    expect(tester?.runtime).toMatchObject({ status: 'IDLE', activeRunCount: 0 })
    const assignments = await json<{ data: Array<unknown> }>(await fetch(`${baseUrl}/projects/demo-project/agents/agent-private-backend/assignments?type=REQUIREMENT_GROUP`))
    expect(backend?.runtime.assignmentUsage.requirementGroups.assignedCount).toBe(assignments.data.length)
    const workflows = await json<{ data: Array<unknown> }>(await fetch(`${baseUrl}/projects/demo-project/agents/agent-private-backend/assignments?type=WORKFLOW`))
    expect(backend?.runtime.assignmentUsage.workflows.assignedCount).toBe(workflows.data.length)
  })
})
