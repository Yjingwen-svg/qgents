import type { TaskRunStatus, TaskStepStatus } from '@/types/task-model'

export type WorkflowDisplayStatus =
  | 'NOT_STARTED'
  | 'PLANNING'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_INPUT'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED'

export const workflowStatusLabels: Record<WorkflowDisplayStatus, string> = {
  NOT_STARTED: '未开始',
  PLANNING: '规划中',
  QUEUED: '排队中',
  RUNNING: '执行中',
  WAITING_INPUT: '等待输入',
  WAITING_APPROVAL: '等待审批',
  COMPLETED: '已完成',
  FAILED: '已失败',
  CANCELLED: '已取消',
  SKIPPED: '已跳过',
}

export function mapTaskStepStatus(status: TaskStepStatus | null | undefined): WorkflowDisplayStatus {
  switch (status) {
    case 'PENDING': return 'NOT_STARTED'
    case 'RUNNING': return 'RUNNING'
    case 'SUCCEEDED': return 'COMPLETED'
    case 'FAILED': return 'FAILED'
    case 'SKIPPED': return 'SKIPPED'
    default: return 'NOT_STARTED'
  }
}

export function mapTaskRunStatus(status: TaskRunStatus | null | undefined): WorkflowDisplayStatus {
  switch (status) {
    case 'QUEUED': return 'QUEUED'
    case 'RUNNING': return 'RUNNING'
    case 'WAITING_INPUT': return 'WAITING_INPUT'
    case 'WAITING_APPROVAL': return 'WAITING_APPROVAL'
    case 'SUCCEEDED': return 'COMPLETED'
    case 'FAILED':
    case 'BLOCKED': return 'FAILED'
    case 'CANCELLING':
    case 'CANCELLED': return 'CANCELLED'
    default: return 'NOT_STARTED'
  }
}
