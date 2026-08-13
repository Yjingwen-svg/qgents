import { canCancelTaskRun, canWorkPackageAction } from '@/types'
import type { OrchestrationRunStatus, TaskRunStatus, WorkPackageStatus } from '@/types'
export { canRetryTaskRun } from '@/types'

import type { WorkPackageAction } from '@/types'
export type { WorkPackageAction } from '@/types'

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
  if (!canWorkPackageAction(status, action)) {
    throw new InvalidStateTransitionError('WorkPackage', status, action)
  }
  if (action === 'start') return 'RUNNING'
  if (action === 'pause') return 'PAUSED'
  if (action === 'resume') return 'RUNNING'
  if (status === 'PLANNING' || status === 'READY') return 'CANCELLED'
  if (status === 'RUNNING' || status === 'PAUSED') return 'CANCELLING'
  throw new InvalidStateTransitionError('WorkPackage', status, action)
}

export function transitionTaskRunCancel(status: TaskRunStatus): TaskRunStatus {
  if (canCancelTaskRun(status)) return 'CANCELLING'
  throw new InvalidStateTransitionError('TaskRun', status, 'cancel')
}

export function transitionOrchestrationRunCancel(status: OrchestrationRunStatus): OrchestrationRunStatus {
  if (status === 'RUNNING' || status === 'WAITING_INPUT' || status === 'WAITING_APPROVAL' || status === 'BLOCKED') {
    return 'CANCELLING'
  }
  if (status === 'QUEUED' || status === 'PLANNING') return 'CANCELLED'
  throw new InvalidStateTransitionError('OrchestrationRun', status, 'cancel')
}

export function transitionTaskRunInputRequest(status: TaskRunStatus): TaskRunStatus {
  if (status === 'WAITING_INPUT' || status === 'WAITING_APPROVAL') return 'RUNNING'
  throw new InvalidStateTransitionError('TaskRun', status, 'resume after input request')
}
