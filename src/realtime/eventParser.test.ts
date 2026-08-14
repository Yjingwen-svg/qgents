import { describe, expect, it } from 'vitest'
import { parseProjectTaskEvent, PROJECT_TASK_EVENT_TYPES } from './eventParser'

describe('project SSE event parsing', () => {
  it.each(PROJECT_TASK_EVENT_TYPES)('parses the new event %s', (eventType) => {
    const ids = eventType === 'task-run.step.progress'
      ? { taskId: 'task-1', stepId: 'step-1', taskRunId: 'run-1' }
      : eventType === 'task.updated'
        ? { taskId: 'task-1' }
        : eventType === 'task-step.updated'
          ? { taskId: 'task-1', taskStepId: 'step-1' }
          : eventType === 'task-run.updated'
            ? { taskId: 'task-1', taskStepId: 'step-1', taskRunId: 'run-1' }
            : eventType === 'diff.created'
              ? { taskId: 'task-1', diffId: 'diff-1' }
              : { taskId: 'task-1', taskStepId: 'step-1', taskRunId: 'run-1', inputRequestId: 'input-1' }
    const event = parseProjectTaskEvent({
      id: 'evt-new',
      event: eventType,
      data: JSON.stringify({ projectId: 'project-1', ...ids }),
    })
    expect(event?.type).toBe(eventType)
  })

  it('parses supported events and preserves the event id', () => {
    const event = parseProjectTaskEvent({
      id: 'evt-1',
      event: 'task-run.step.progress',
      data: JSON.stringify({ projectId: 'project-1', taskId: 'task-1', taskRunId: 'run-1', stepId: 'step-1', sequence: 2 }),
    })

    expect(event).toEqual({
      id: 'evt-1',
      type: 'task-run.step.progress',
      payload: { projectId: 'project-1', taskId: 'task-1', taskRunId: 'run-1', stepId: 'step-1', sequence: 2 },
    })
  })

  it.each([
    'orchestration-run.updated',
    'work-package.updated',
    'task-run.input-required',
    'task-run.approval-required',
    'message.created',
    'group.updated',
    'test-run.updated',
    'dry-run.updated',
    'merge-request.updated',
    '',
  ])('ignores retired or unrelated event %s', (eventType) => {
    expect(parseProjectTaskEvent({
      id: 'evt-ignored',
      event: eventType,
      data: JSON.stringify({ projectId: 'project-1' }),
    })).toBeNull()
  })

  it('ignores malformed payloads without treating them as domain events', () => {
    expect(parseProjectTaskEvent({ id: 'evt-2', event: 'task.updated', data: '{' })).toBeNull()
    expect(parseProjectTaskEvent({
      id: 'evt-3',
      event: 'task.updated',
      data: JSON.stringify({ taskRunId: 'task-1' }),
    })).toBeNull()
  })

  it('does not silently accept taskStepId for the progress event schema', () => {
    expect(parseProjectTaskEvent({ id: 'evt-conflict', event: 'task-run.step.progress', data: JSON.stringify({ projectId: 'project-1', taskId: 'task-1', taskRunId: 'run-1', taskStepId: 'step-1' }) })).toBeNull()
  })
})
