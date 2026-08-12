import { describe, expect, it } from 'vitest'
import { parseProjectTaskEvent } from './eventParser'

describe('project SSE event parsing', () => {
  it('parses supported events and preserves the event id', () => {
    const event = parseProjectTaskEvent({
      id: 'evt-1',
      event: 'task-run.step.progress',
      data: JSON.stringify({ projectId: 'project-1', taskRunId: 'task-1', sequence: 2 }),
    })

    expect(event).toEqual({
      id: 'evt-1',
      type: 'task-run.step.progress',
      payload: { projectId: 'project-1', taskRunId: 'task-1', sequence: 2 },
    })
  })

  it.each(['message.created', 'group.updated', 'test-run.updated', ''])('ignores %s', (eventType) => {
    expect(parseProjectTaskEvent({
      id: 'evt-ignored',
      event: eventType,
      data: JSON.stringify({ projectId: 'project-1' }),
    })).toBeNull()
  })

  it('ignores malformed payloads without treating them as domain events', () => {
    expect(parseProjectTaskEvent({ id: 'evt-2', event: 'task-run.updated', data: '{' })).toBeNull()
    expect(parseProjectTaskEvent({
      id: 'evt-3',
      event: 'task-run.updated',
      data: JSON.stringify({ taskRunId: 'task-1' }),
    })).toBeNull()
  })
})
