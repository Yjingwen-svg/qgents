import type { EventSourceMessage } from '@microsoft/fetch-event-source'

export const PROJECT_TASK_EVENT_TYPES = [
  'message.created',
  'group.created',
  'group.updated',
  'group.archived',
  'group.member.updated',
  'task.updated',
  'task-step.updated',
  'task-run.updated',
  'task-run.step.progress',
  'input-required',
  'approval-required',
  'diff.created',
  'task.artifact.created',
  'task-run.artifact.created',
  'diff-review.created',
  'task.awaiting-diff-confirmation',
  'diff-review.confirmed',
  'diff-review.rejected',
  'diff-review.skipped',
  'delivery.repository.updated',
  'delivery.started',
  'delivery.completed',
  'delivery.failed',
  'task.diff-review.failed',
  'merge-request.updated',
  'memory.submit-review',
  'memory.approved',
  'memory.rejected',
  'memory.archived',
  'skill.submit-review',
  'skill.published',
  'skill.rejected',
  'skill.archived',
  'test-run.updated',
  'dry-run.updated',
  'preflight.updated',
] as const

export type ProjectTaskEventType = (typeof PROJECT_TASK_EVENT_TYPES)[number]

export interface ProjectTaskEventPayload {
  projectId: string
  [key: string]: unknown
}

export interface ProjectTaskEvent {
  id: string | null
  type: ProjectTaskEventType
  payload: ProjectTaskEventPayload
}

function isProjectTaskEventType(value: string): value is ProjectTaskEventType {
  return (PROJECT_TASK_EVENT_TYPES as readonly string[]).includes(value)
}

function isPayload(value: unknown): value is ProjectTaskEventPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const projectId = (value as Record<string, unknown>).projectId
  return typeof projectId === 'string' && projectId.length > 0
}

function hasRequiredIds(type: ProjectTaskEventType, payload: ProjectTaskEventPayload): boolean {
  const required: Record<ProjectTaskEventType, readonly string[]> = {
    'message.created': ['groupId', 'messageId'],
    'group.created': ['groupId'],
    'group.updated': ['groupId'],
    'group.archived': ['groupId'],
    'group.member.updated': ['groupId'],
    'task.updated': ['taskId'],
    'task-step.updated': ['taskId', 'taskStepId'],
    'task-run.updated': ['taskId', 'taskStepId', 'taskRunId'],
    'task-run.step.progress': ['taskId', 'stepId', 'taskRunId'],
    'input-required': ['taskId', 'taskStepId', 'taskRunId', 'inputRequestId'],
    'approval-required': ['taskId', 'taskStepId', 'taskRunId', 'inputRequestId'],
    'diff.created': ['taskId', 'diffId'],
    'task.artifact.created': ['taskId', 'artifactId', 'artifactType'],
    'task-run.artifact.created': ['taskId', 'taskRunId', 'taskStepId', 'artifactId', 'artifactType'],
    'diff-review.created': ['taskId', 'reviewBatchId', 'reviewStatus', 'aggregateHash'],
    'task.awaiting-diff-confirmation': ['taskId', 'reviewBatchId'],
    'diff-review.confirmed': ['taskId', 'reviewBatchId'],
    'diff-review.rejected': ['taskId', 'reviewBatchId'],
    'diff-review.skipped': ['taskId', 'reason'],
    'delivery.repository.updated': ['taskId', 'diffId', 'deliveryStatus'],
    'delivery.started': ['taskId', 'reviewBatchId', 'deliveryMode', 'operationId'],
    'delivery.completed': ['taskId', 'reviewBatchId', 'deliveryStatus'],
    'delivery.failed': ['taskId', 'reviewBatchId', 'deliveryStatus'],
    'task.diff-review.failed': ['taskId', 'reason'],
    'merge-request.updated': ['mergeRequestId'],
    'memory.submit-review': ['resourceId', 'updatedAt'],
    'memory.approved': ['resourceId', 'updatedAt'],
    'memory.rejected': ['resourceId', 'updatedAt'],
    'memory.archived': ['resourceId', 'updatedAt'],
    'skill.submit-review': ['resourceId', 'updatedAt'],
    'skill.published': ['resourceId', 'updatedAt'],
    'skill.rejected': ['resourceId', 'updatedAt'],
    'skill.archived': ['resourceId', 'updatedAt'],
    'test-run.updated': ['testRunId'],
    'dry-run.updated': ['dryRunId'],
    'preflight.updated': ['taskId', 'repositoryId', 'targetBranch'],
  }
  const stringsValid = required[type].every((key) => typeof payload[key] === 'string' && (payload[key] as string).length > 0)
  if (!stringsValid) return false
  if (type.startsWith('memory.')) {
    return payload.resourceType === 'MEMORY' && payload.eventVersion === 1
  }
  if (type.startsWith('skill.')) {
    return payload.resourceType === 'SKILL' && payload.eventVersion === 1
  }
  if (type === 'merge-request.updated') {
    return typeof payload.number === 'number' && Number.isInteger(payload.number) && typeof payload.status === 'string' && (typeof payload.webUrl === 'string' || payload.webUrl === null)
  }
  if (type === 'task.diff-review.failed') {
    return typeof payload.reviewBatchId === 'string' && payload.reviewBatchId.length > 0
  }
  if (type === 'delivery.started') {
    return payload.deliveryMode === 'DIFF_FIRST' || payload.deliveryMode === 'MR_FIRST'
  }
  if (type === 'task.artifact.created' || type === 'task-run.artifact.created') {
    return typeof payload.sequenceNo === 'number' && Number.isInteger(payload.sequenceNo) && payload.sequenceNo >= 0
  }
  return true
}

export function parseProjectTaskEvent(message: Pick<EventSourceMessage, 'id' | 'event' | 'data'>): ProjectTaskEvent | null {
  const eventType = message.event.trim()
  const data = message.data.trim()
  if (!eventType || !data || !isProjectTaskEventType(eventType)) return null

  try {
    const payload: unknown = JSON.parse(data)
    if (!isPayload(payload) || !hasRequiredIds(eventType, payload)) return null
    return {
      id: message.id.trim() || null,
      type: eventType,
      payload,
    }
  } catch {
    return null
  }
}
