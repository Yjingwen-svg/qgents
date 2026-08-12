import type {
  OrchestrationRunStatus,
  TaskRunStatus,
  WorkflowDisplayStatus,
  WorkflowStatusSource,
} from '@/types'

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

export function mapWorkflowStatus(status: WorkflowStatusSource | null | undefined): WorkflowDisplayStatus {
  switch (status) {
    case 'PLANNING': return 'PLANNING'
    case 'QUEUED':
    case 'READY':
    case 'PENDING': return 'QUEUED'
    case 'RUNNING': return 'RUNNING'
    case 'WAITING_INPUT': return 'WAITING_INPUT'
    case 'WAITING_APPROVAL': return 'WAITING_APPROVAL'
    case 'SUCCEEDED': return 'COMPLETED'
    case 'FAILED':
    case 'BLOCKED': return 'FAILED'
    case 'CANCELLING':
    case 'CANCELLED': return 'CANCELLED'
    case 'SKIPPED': return 'SKIPPED'
    case 'PAUSED': return 'WAITING_INPUT'
    default: return 'NOT_STARTED'
  }
}

export function mapRunStatus(status: OrchestrationRunStatus | null | undefined): WorkflowDisplayStatus {
  return mapWorkflowStatus(status)
}

export function mapTaskRunStatus(status: TaskRunStatus | null | undefined): WorkflowDisplayStatus {
  return mapWorkflowStatus(status)
}
