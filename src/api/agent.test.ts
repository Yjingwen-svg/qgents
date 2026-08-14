import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentApi } from './agent'

afterEach(() => vi.restoreAllMocks())

describe('agentApi', () => {
  it('unwraps the Agent list envelope exactly once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'agent-one', name: 'Agent One' }],
      page: { nextCursor: null, hasMore: false },
      requestId: 'request-one',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(agentApi.list('team-one')).resolves.toEqual({
      data: [{ id: 'agent-one', name: 'Agent One' }],
      page: { nextCursor: null, hasMore: false },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/teams/team-one/agents', expect.any(Object))
  })

  it('uses the project Agent TaskRun filter through the shared client', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [],
      page: { nextCursor: null, hasMore: false },
      requestId: 'request-two',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(agentApi.taskRuns('project-one', { agentId: 'agent-one', status: 'FAILED', cursor: '1', limit: 10 })).resolves.toMatchObject({ data: [], page: { nextCursor: null, hasMore: false } })
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-one/task-runs?agentId=agent-one&status=FAILED&cursor=1&limit=10', expect.any(Object))
  })
})
