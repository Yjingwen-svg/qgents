import { setupServer } from 'msw/node'
import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest'
import { handlers } from './index'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('global project Mock handler', () => {
  it('serves project context for the B project routes', async () => {
    const response = await fetch('/api/projects/demo-project')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'demo-project',
        teamId: 'team-owned-001',
        name: 'Demo Project',
      },
    })

    const projectsResponse = await fetch('/api/teams/team-owned-001/projects')
    expect(projectsResponse.status).toBe(200)
    await expect(projectsResponse.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'demo-project' })]),
    })

    const groupsResponse = await fetch('/api/projects/demo-project/groups')
    expect(groupsResponse.status).toBe(200)
    await expect(groupsResponse.json()).resolves.toEqual({ data: [] })

    const invalidResponse = await fetch('/api/projects/unknown-project')
    expect(invalidResponse.status).toBe(404)
  })
})
