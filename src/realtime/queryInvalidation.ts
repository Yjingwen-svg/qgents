import type { QueryKey } from '@tanstack/react-query'
import { deliveryCenterKeys, queryClient, taskModelQueryKeys } from '@/query'
import type { ProjectTaskEvent, ProjectTaskEventPayload } from './eventParser'

export const TASK_MODEL_QUERY_ROOTS = (projectId: string): readonly QueryKey[] => [
  taskModelQueryKeys.tasks.all(projectId),
  taskModelQueryKeys.taskRuns.root(projectId),
  taskModelQueryKeys.diffs.all(projectId),
  taskModelQueryKeys.taskArtifacts.root(projectId),
  taskModelQueryKeys.taskDiffReview.root(projectId),
  deliveryCenterKeys.all(projectId),
]

function stringId(payload: ProjectTaskEventPayload, name: string): string | null {
  const value = payload[name]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function addKey(keys: QueryKey[], key: QueryKey | null): void {
  if (!key) return
  if (!keys.some((candidate) => JSON.stringify(candidate) === JSON.stringify(key))) keys.push(key)
}

export function queryKeysForProjectTaskEvent(
  projectId: string,
  event: ProjectTaskEvent,
): readonly QueryKey[] {
  if (event.payload.projectId !== projectId) return []

  const payload = event.payload
  const taskId = stringId(payload, 'taskId')
  const taskStepId = stringId(payload, 'taskStepId')
  const taskRunId = stringId(payload, 'taskRunId')
  const diffId = stringId(payload, 'diffId')
  const artifactId = stringId(payload, 'artifactId')
  const resourceType = stringId(payload, 'resourceType')
  const resourceId = stringId(payload, 'resourceId')
  const keys: QueryKey[] = []

  const addDeliveryQueries = (): void => {
    addKey(keys, deliveryCenterKeys.all(projectId))
    if (resourceType === 'MEMORY') addKey(keys, ['memories', projectId])
    if (resourceType === 'SKILL') addKey(keys, ['skills', projectId])
  }

  switch (event.type) {
    case 'task.updated':
      if (!taskId) return []
      addKey(keys, taskModelQueryKeys.tasks.all(projectId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      break
    case 'task-step.updated':
      if (!taskId || !taskStepId) return []
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.taskSteps.all(projectId, taskId))
      addKey(keys, taskModelQueryKeys.taskRuns.all(projectId, taskId))
      break
    case 'task-run.updated':
      if (!taskId || !taskRunId) return []
      addKey(keys, taskModelQueryKeys.taskRuns.detail(projectId, taskRunId))
      addKey(keys, taskModelQueryKeys.taskRuns.all(projectId, taskId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      break
    case 'task-run.step.progress':
      if (!taskRunId || !stringId(payload, 'stepId')) return []
      addKey(keys, taskModelQueryKeys.taskRuns.detail(projectId, taskRunId))
      break
    case 'input-required':
    case 'approval-required':
      if (!taskId || !taskRunId || !stringId(payload, 'inputRequestId')) return []
      addKey(keys, taskModelQueryKeys.taskRuns.detail(projectId, taskRunId))
      addKey(keys, taskModelQueryKeys.taskRuns.inputRequests.all(projectId, taskRunId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      break
    case 'diff.created':
      if (!taskId || !diffId) return []
      addKey(keys, taskModelQueryKeys.diffs.all(projectId))
      addKey(keys, taskModelQueryKeys.diffs.detail(projectId, diffId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.taskDiffReview.detail(projectId, taskId))
      if (taskRunId) {
        addKey(keys, taskModelQueryKeys.taskRuns.detail(projectId, taskRunId))
        addKey(keys, taskModelQueryKeys.taskRuns.all(projectId, taskId))
      }
      addKey(keys, deliveryCenterKeys.all(projectId))
      break
    case 'task.artifact.created':
      if (!taskId || !artifactId) return []
      addKey(keys, taskModelQueryKeys.taskArtifacts.all(projectId, taskId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      if (taskRunId) addKey(keys, taskModelQueryKeys.taskRuns.detail(projectId, taskRunId))
      break
    case 'task-run.artifact.created':
      if (!taskId || !taskRunId || !artifactId) return []
      addKey(keys, taskModelQueryKeys.taskArtifacts.all(projectId, taskId))
      addKey(keys, taskModelQueryKeys.taskRuns.detail(projectId, taskRunId))
      break
    case 'diff-review.created':
    case 'task.awaiting-diff-confirmation':
    case 'diff-review.confirmed':
    case 'diff-review.rejected':
    case 'task.diff-review.failed':
      if (!taskId) return []
      addKey(keys, taskModelQueryKeys.tasks.all(projectId))
      addKey(keys, taskModelQueryKeys.taskDiffReview.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      addDeliveryQueries()
      break
    case 'diff-review.skipped':
      if (!taskId) return []
      addKey(keys, taskModelQueryKeys.tasks.all(projectId))
      addKey(keys, taskModelQueryKeys.taskDiffReview.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      addDeliveryQueries()
      break
    case 'delivery.repository.updated':
      if (!taskId || !diffId) return []
      addKey(keys, taskModelQueryKeys.tasks.all(projectId))
      addKey(keys, taskModelQueryKeys.taskDiffReview.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.diffs.detail(projectId, diffId))
      addDeliveryQueries()
      break
    case 'delivery.completed':
    case 'delivery.failed':
      if (!taskId) return []
      addKey(keys, taskModelQueryKeys.tasks.all(projectId))
      addKey(keys, taskModelQueryKeys.taskDiffReview.detail(projectId, taskId))
      addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      addDeliveryQueries()
      break
    case 'merge-request.updated':
      addDeliveryQueries()
      if (taskId) {
        addKey(keys, taskModelQueryKeys.tasks.all(projectId))
        addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
        addKey(keys, taskModelQueryKeys.taskDiffReview.detail(projectId, taskId))
      }
      break
    case 'memory.submit-review':
    case 'memory.approved':
    case 'memory.rejected':
    case 'memory.archived':
    case 'skill.submit-review':
    case 'skill.published':
    case 'skill.rejected':
    case 'skill.archived':
      if (!resourceId || !resourceType) return []
      addDeliveryQueries()
      if (taskId) {
        addKey(keys, taskModelQueryKeys.tasks.all(projectId))
        addKey(keys, taskModelQueryKeys.tasks.detail(projectId, taskId))
      }
      break
  }

  return keys
}

export function invalidateProjectTaskEvent(projectId: string, event: ProjectTaskEvent): void {
  for (const queryKey of queryKeysForProjectTaskEvent(projectId, event)) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

export function invalidateProjectTaskModel(projectId: string): void {
  for (const queryKey of TASK_MODEL_QUERY_ROOTS(projectId)) {
    void queryClient.invalidateQueries({ queryKey })
  }
}
