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

  it('normalizes the asynchronous auto-trigger message response without inventing a Task', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'message-1', groupId: 'group-1', type: 'TEXT', content: { text: 'Hello' }, senderType: 'USER', createdAt: '2026-08-16T00:00:00Z' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    await expect(groupApi.sendMessage('project-1', 'group-1', {
      type: 'TEXT', content: { text: 'Hello' }, mentions: [{ type: 'AGENT', id: 'agent-1' }], clientMessageId: 'cmsg-2',
    })).resolves.toMatchObject({ message: { id: 'message-1' }, task: null })
  })

  it('calls the explicit trigger endpoint with the required title derived from the message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'task-1' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    await expect(groupApi.triggerTask('project-1', 'group-1', 'message-1', {
      title: 'Implement login',
      requirement: 'Implement login',
      repositoryIds: ['project-repository-1'],
      baseRef: 'main',
    })).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/groups/group-1/messages/message-1/trigger-task',
      expect.objectContaining({ method: 'POST', body: '{"title":"Implement login","requirement":"Implement login","repositoryIds":["project-repository-1"],"baseRef":"main"}' }),
    )
  })
})
