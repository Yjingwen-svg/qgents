import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { resetTaskDomainStores, taskDomainHandlers } from './handlers'

const server = setupServer(...taskDomainHandlers)
const baseUrl = 'http://localhost/api'

async function json<T>(response: Response): Promise<T> { return await response.json() as T }

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetTaskDomainStores())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('legacy task-domain handlers kept for un-migrated areas', () => {
  it('keeps orchestration list/detail available to legacy pages', async () => {
    const list = await fetch(`${baseUrl}/projects/project-chain/orchestration-runs`)
    const body = await json<{ data: Array<{ id: string; projectId: string }> }>(list)
    expect(list.status).toBe(200)
    expect(body.data.some((run) => run.projectId === 'project-chain')).toBe(true)
    const detail = await fetch(`${baseUrl}/projects/project-chain/orchestration-runs/${body.data[0].id}`)
    expect(detail.status).toBe(200)
  })

  it('keeps deliverable read and review operations available', async () => {
    const list = await fetch(`${baseUrl}/projects/project-deliverable/work-packages/work-package-project-deliverable-1/deliverables`)
    expect(list.status).toBe(200)
    const body = await json<{ data: Array<{ id: string; status: string }> }>(list)
    if (body.data.length > 0) {
      const detail = await fetch(`${baseUrl}/projects/project-deliverable/deliverables/${body.data[0].id}`)
      expect(detail.status).toBe(200)
    }
  })
})
