import { afterEach, describe, expect, it, vi } from 'vitest'
import { groupApi } from './group'

afterEach(() => vi.restoreAllMocks())

describe('groupApi.sendMessage', () => {
  it('preserves the atomic message and quick Task result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        message: { id: 'message-1', groupId: 'group-1', type: 'TEXT', content: { text: 'Implement login' }, senderType: 'USER', createdAt: '2026-08-16T00:00:00Z' },
        task: { id: 'task-1', displayCode: 'T-1024', status: 'PLANNING', missingFields: ['repositoryIds', 'baseRef'] },
      },
      requestId: 'request-1',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    await expect(groupApi.sendMessage('project-1', 'group-1', {
      type: 'TEXT',
      content: { text: 'Implement login' },
      mentions: [{ type: 'AGENT', id: 'agent-1' }],
      clientMessageId: 'cmsg-1',
    })).resolves.toMatchObject({
      message: { id: 'message-1' },
      task: { id: 'task-1', missingFields: ['repositoryIds', 'baseRef'] },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-1/groups/group-1/messages', expect.objectContaining({ method: 'POST' }))
  })

  it('normalizes the pre-upgrade message-only response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'message-1', groupId: 'group-1', type: 'TEXT', content: { text: 'Hello' }, senderType: 'USER', createdAt: '2026-08-16T00:00:00Z' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    await expect(groupApi.sendMessage('project-1', 'group-1', {
      type: 'TEXT', content: { text: 'Hello' }, clientMessageId: 'cmsg-2',
    })).resolves.toMatchObject({ message: { id: 'message-1' }, task: null })
  })
})
