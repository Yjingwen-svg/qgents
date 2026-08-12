import type { WorkPackageStatus } from './task-domain'

export type WorkPackageAction = 'start' | 'pause' | 'resume' | 'cancel'

const WORK_PACKAGE_ACTION_STATUSES: Record<WorkPackageAction, readonly WorkPackageStatus[]> = {
  start: ['READY'],
  pause: ['RUNNING'],
  resume: ['PAUSED'],
  cancel: ['PLANNING', 'READY', 'RUNNING', 'PAUSED'],
}

export function canWorkPackageAction(status: WorkPackageStatus, action: WorkPackageAction): boolean {
  return WORK_PACKAGE_ACTION_STATUSES[action].includes(status)
}
