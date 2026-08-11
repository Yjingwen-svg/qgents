import type { DeliverableStatus, TaskRunStatus, WorkPackageStatus } from '@/types'

export type WorkPackageAction = 'start' | 'pause' | 'resume' | 'cancel'

export class InvalidStateTransitionError extends Error {
  readonly code = 'INVALID_STATE_TRANSITION'
  readonly status = 409

  constructor(resource: string, current: string, action: string) {
    super(`${resource} cannot ${action} from ${current}`)
    this.name = 'InvalidStateTransitionError'
  }
}

export function transitionWorkPackageStatus(
  status: WorkPackageStatus,
  action: WorkPackageAction,
): WorkPackageStatus {
  if (action === 'start' && status === 'READY') return 'RUNNING'
  if (action === 'pause' && status === 'RUNNING') return 'PAUSED'
  if (action === 'resume' && status === 'PAUSED') return 'RUNNING'
  if (action === 'cancel' && (status === 'PLANNING' || status === 'READY')) return 'CANCELLED'
  if (action === 'cancel' && (status === 'RUNNING' || status === 'PAUSED')) return 'CANCELLING'
  throw new InvalidStateTransitionError('WorkPackage', status, action)
}

export function transitionTaskRunCancel(status: TaskRunStatus): TaskRunStatus {
  if (status === 'QUEUED' || status === 'RUNNING' || status === 'WAITING_INPUT' || status === 'WAITING_APPROVAL') {
    return 'CANCELLING'
  }
  throw new InvalidStateTransitionError('TaskRun', status, 'cancel')
}

export function canRetryTaskRun(status: TaskRunStatus): boolean {
  return status === 'FAILED' || status === 'CANCELLED' || status === 'BLOCKED'
}

export function transitionDeliverableStatus(
  status: DeliverableStatus,
  action: 'accept' | 'reject',
): DeliverableStatus {
  if (status === 'PENDING_REVIEW') return action === 'accept' ? 'ACCEPTED' : 'REJECTED'
  throw new InvalidStateTransitionError('Deliverable', status, action)
}
