import { describe, expect, it } from 'vitest'
import { parseProjectTaskEvent, PROJECT_TASK_EVENT_TYPES } from './eventParser'

/** 为每个事件类型构造满足 hasRequiredIds 的最小合法 payload */
function buildEventPayload(type: string): Record<string, unknown> {
  switch (type) {
    case 'merge-request.updated':
      return { mergeRequestId: 'mr-1', number: 10, status: 'OPEN', webUrl: null }
    case 'task-run.step.progress':
      return { taskId: 'task-1', stepId: 'step-1', taskRunId: 'run-1' }
    case 'task.updated':
      return { taskId: 'task-1' }
    case 'task-step.updated':
      return { taskId: 'task-1', taskStepId: 'step-1' }
    case 'task-run.updated':
      return { taskId: 'task-1', taskStepId: 'step-1', taskRunId: 'run-1' }
    case 'diff.created':
      return { taskId: 'task-1', diffId: 'diff-1' }
    case 'task.artifact.created':
      return { taskId: 'task-1', artifactId: 'artifact-1', sequenceNo: 1, artifactType: 'PLAN' }
    case 'task-run.artifact.created':
      return { taskId: 'task-1', taskStepId: 'step-1', taskRunId: 'run-1', artifactId: 'artifact-1', sequenceNo: 2, artifactType: 'CODING' }
    case 'diff-review.created':
      return { taskId: 'task-1', reviewBatchId: 'batch-1', reviewStatus: 'PENDING_CONFIRMATION', aggregateHash: 'hash-1' }
    case 'task.awaiting-diff-confirmation':
    case 'diff-review.confirmed':
    case 'diff-review.rejected':
      return { taskId: 'task-1', reviewBatchId: 'batch-1' }
    case 'diff-review.skipped':
      return { taskId: 'task-1', reason: 'FINAL_DIFF_EMPTY' }
    case 'delivery.repository.updated':
      return { taskId: 'task-1', diffId: 'diff-1', deliveryStatus: 'DELIVERED' }
    case 'delivery.completed':
    case 'delivery.failed':
      return { taskId: 'task-1', reviewBatchId: 'batch-1', deliveryStatus: 'DELIVERED' }
    case 'task.diff-review.failed':
      return { taskId: 'task-1', reviewBatchId: 'batch-1', reason: 'delivery failed' }
    case 'input-required':
    case 'approval-required':
      return { taskId: 'task-1', taskStepId: 'step-1', taskRunId: 'run-1', inputRequestId: 'input-1' }
    case 'test-run.updated':
      return { testRunId: 'testrun-1' }
    case 'dry-run.updated':
      return { dryRunId: 'dryrun-1' }
    case 'message.created':
      return { groupId: 'group-1', messageId: 'msg-1' }
    case 'group.created':
    case 'group.updated':
    case 'group.archived':
    case 'group.member.updated':
      return { groupId: 'group-1' }
    default:
      if (type.startsWith('memory.')) return { resourceType: 'MEMORY', resourceId: 'memory-1', eventVersion: 1, updatedAt: '2026-08-15T00:00:00Z' }
      if (type.startsWith('skill.')) return { resourceType: 'SKILL', resourceId: 'skill-1', eventVersion: 1, updatedAt: '2026-08-15T00:00:00Z' }
      return {}
  }
}

describe('project SSE event parsing', () => {
  it.each(PROJECT_TASK_EVENT_TYPES)('parses the new event %s', (eventType) => {
    const event = parseProjectTaskEvent({
      id: 'evt-new',
      event: eventType,
      data: JSON.stringify({ projectId: 'project-1', ...buildEventPayload(eventType) }),
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
    'chat.message.created',
    'member.joined',
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
