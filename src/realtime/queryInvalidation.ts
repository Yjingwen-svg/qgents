import type { QueryKey } from '@tanstack/react-query'
import { queryClient, queryKeys } from '@/query'
import type { ProjectTaskEvent, ProjectTaskEventPayload } from './eventParser'

export const TASK_DOMAIN_QUERY_ROOTS = (projectId: string): readonly QueryKey[] => [
  queryKeys.orchestrationRuns.all(projectId),
  queryKeys.workPackages.all(projectId),
  queryKeys.taskRuns.all(projectId),
  queryKeys.deliverables.all(projectId),
]

function stringId(payload: ProjectTaskEventPayload, ...names: string[]): string | null {
  for (const name of names) {
    const value = payload[name]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function addKey(keys: QueryKey[], key: QueryKey | null): void {
  if (!key) return
  if (!keys.some((candidate) => JSON.stringify(candidate) === JSON.stringify(key))) keys.push(key)
}

export function queryKeysForProjectTaskEvent(
  projectId: string,
  event: ProjectTaskEvent,
): readonly QueryKey[] {
  const payload = event.payload
  const keys: QueryKey[] = []
  const orchestrationRunId = stringId(payload, 'orchestrationRunId', 'runId')
  const workPackageId = stringId(payload, 'workPackageId')
  const taskRunId = stringId(payload, 'taskRunId')

  switch (event.type) {
    case 'orchestration-run.updated':
      addKey(keys, queryKeys.orchestrationRuns.all(projectId))
      addKey(keys, orchestrationRunId ? queryKeys.orchestrationRuns.detail(projectId, orchestrationRunId) : null)
      break
    case 'work-package.updated':
      addKey(keys, queryKeys.workPackages.all(projectId))
      addKey(keys, workPackageId ? queryKeys.workPackages.detail(projectId, workPackageId) : null)
      addKey(keys, orchestrationRunId ? queryKeys.orchestrationRuns.detail(projectId, orchestrationRunId) : null)
      break
    case 'task-run.updated':
      addKey(keys, queryKeys.taskRuns.all(projectId))
      addKey(keys, taskRunId ? queryKeys.taskRuns.detail(projectId, taskRunId) : null)
      addKey(keys, workPackageId ? queryKeys.workPackages.detail(projectId, workPackageId) : null)
      addKey(keys, orchestrationRunId ? queryKeys.orchestrationRuns.detail(projectId, orchestrationRunId) : null)
      break
    case 'task-run.step.progress':
      if (taskRunId) {
        addKey(keys, queryKeys.taskRuns.detail(projectId, taskRunId))
        addKey(keys, queryKeys.taskRuns.stepsAll(projectId, taskRunId))
      }
      break
    case 'task-run.input-required':
    case 'task-run.approval-required':
      addKey(keys, queryKeys.taskRuns.all(projectId))
      addKey(keys, taskRunId ? queryKeys.taskRuns.detail(projectId, taskRunId) : null)
      addKey(keys, taskRunId ? queryKeys.taskRuns.inputRequests.all(projectId, taskRunId) : null)
      addKey(keys, workPackageId ? queryKeys.workPackages.detail(projectId, workPackageId) : null)
      addKey(keys, orchestrationRunId ? queryKeys.orchestrationRuns.detail(projectId, orchestrationRunId) : null)
      addKey(keys, queryKeys.orchestrationRuns.all(projectId))
      break
    case 'deliverable.created':
      addKey(keys, queryKeys.deliverables.all(projectId))
      addKey(keys, workPackageId ? queryKeys.deliverables.list(projectId, workPackageId) : null)
      addKey(keys, taskRunId ? queryKeys.taskRuns.detail(projectId, taskRunId) : null)
      break
  }

  return keys
}

export function invalidateProjectTaskEvent(projectId: string, event: ProjectTaskEvent): void {
  if (event.payload.projectId !== projectId) return
  for (const queryKey of queryKeysForProjectTaskEvent(projectId, event)) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

export function invalidateProjectTaskDomain(projectId: string): void {
  for (const queryKey of TASK_DOMAIN_QUERY_ROOTS(projectId)) {
    void queryClient.invalidateQueries({ queryKey })
  }
}
