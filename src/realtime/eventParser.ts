import type { EventSourceMessage } from '@microsoft/fetch-event-source'

export const PROJECT_TASK_EVENT_TYPES = [
  'orchestration-run.updated',
  'work-package.updated',
  'task-run.updated',
  'task-run.step.progress',
  'task-run.input-required',
  'task-run.approval-required',
  'deliverable.created',
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

export function parseProjectTaskEvent(message: Pick<EventSourceMessage, 'id' | 'event' | 'data'>): ProjectTaskEvent | null {
  const eventType = message.event.trim()
  const data = message.data.trim()
  if (!eventType || !data || !isProjectTaskEventType(eventType)) return null

  try {
    const payload: unknown = JSON.parse(data)
    if (!isPayload(payload)) return null
    return {
      id: message.id.trim() || null,
      type: eventType,
      payload,
    }
  } catch {
    return null
  }
}
