import type { TaskRunStatus } from './task-domain'

const RETRYABLE_TASK_RUN_STATUSES: readonly TaskRunStatus[] = ['FAILED', 'CANCELLED', 'BLOCKED']
const CANCELLABLE_TASK_RUN_STATUSES: readonly TaskRunStatus[] = [
  'QUEUED',
  'RUNNING',
  'WAITING_INPUT',
  'WAITING_APPROVAL',
]

export function canRetryTaskRun(status: TaskRunStatus): boolean {
  return RETRYABLE_TASK_RUN_STATUSES.includes(status)
}

export function canCancelTaskRun(status: TaskRunStatus): boolean {
  return CANCELLABLE_TASK_RUN_STATUSES.includes(status)
}
