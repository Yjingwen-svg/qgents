import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deliveryCenterApi } from '@/api/deliveryCenter'
import { resetDeliveryCenterStore } from './store'
import { deliveryCenterHandlers } from './handlers'

const server = setupServer(...deliveryCenterHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  server.resetHandlers()
  resetDeliveryCenterStore()
})

describe('Delivery Center aggregate mock', () => {
  it('serves all three discriminated item types and full-dataset summary', async () => {
    const response = await deliveryCenterApi.list('project-delivery-center', { limit: 2 })
    expect(response.data).toHaveLength(2)
    expect(new Set(response.data.map((item) => item.resourceType))).toEqual(new Set(['MEMORY']))
    expect(response.page.hasMore).toBe(true)
    const summary = await deliveryCenterApi.summary('project-delivery-center')
    expect(summary.total).toBe(9)
    expect(summary.countsByType).toEqual({ CODE: 4, MEMORY: 3, SKILL: 2 })
  })

  it('serves delivery demo data for projects exposed by the application mock', async () => {
    const response = await deliveryCenterApi.list('proj-001')
    expect(response.data.length).toBeGreaterThan(0)
    expect(response.data.every((item) => item.projectId === 'proj-001')).toBe(true)
  })

  it('covers filters, null source/group fields, multi-repository code and server capabilities', async () => {
    const code = await deliveryCenterApi.list('project-delivery-center', { type: 'CODE', repositoryId: 'repo-docs' })
    expect(code.data).toHaveLength(1)
    expect(code.data[0]?.resourceType).toBe('CODE')
    if (code.data[0]?.resourceType === 'CODE') expect(code.data[0].repositories).toHaveLength(2)
    const noGroup = await deliveryCenterApi.list('project-delivery-center', { type: 'SKILL' })
    expect(noGroup.data[0]?.requirementGroup).toBeNull()
    expect(noGroup.data[0]?.source.taskId).toBeNull()
    const member = await deliveryCenterApi.list('project-no-approval')
    expect(member.data[0]?.capabilities.canApprove).toBe(false)
    expect(member.data[0]?.capabilities.disabledReasons.canApprove).toBeTruthy()
  })

  it('supports empty lists and distinguishes 403, 404, 409 and 422', async () => {
    expect((await deliveryCenterApi.list('project-empty')).data).toEqual([])
    await expect(deliveryCenterApi.list('project-delivery-forbidden')).rejects.toMatchObject({ status: 403 })
    await expect(deliveryCenterApi.list('project-delivery-missing')).rejects.toMatchObject({ status: 404 })
    await expect(deliveryCenterApi.list('project-delivery-center', { limit: 1, cursor: '0' })).resolves.toHaveProperty('requestId')
    await expect(deliveryCenterApi.list('project-delivery-center', { limit: 0 })).rejects.toMatchObject({ status: 422 })
    await expect(fetch('/api/projects/project-delivery-center/delivery-items?scenario=CONFLICT')).resolves.toHaveProperty('status', 409)
  })
})
