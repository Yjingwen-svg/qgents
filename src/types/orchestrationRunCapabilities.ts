import type { OrchestrationRunStatus } from './task-domain'

const CANCELLABLE_ORCHESTRATION_RUN_STATUSES: readonly OrchestrationRunStatus[] = [
  'QUEUED',
  'PLANNING',
  'RUNNING',
  'WAITING_INPUT',
  'WAITING_APPROVAL',
  'BLOCKED',
]

/** FE-API: the backend has not yet listed the complete cancelability matrix. */
export function canCancelOrchestrationRun(status: OrchestrationRunStatus): boolean {
  return CANCELLABLE_ORCHESTRATION_RUN_STATUSES.includes(status)
}
