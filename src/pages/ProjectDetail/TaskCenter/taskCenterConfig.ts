import type { OrchestrationRunStatus } from '@/types'

export type TaskCenterStatusFilter = 'all' | 'running' | 'waiting' | 'completed' | 'failed'

export type TaskCenterView = 'board' | 'table'

export type TaskCenterPanel = 'context' | 'detail' | 'executions'

export const TASK_CENTER_STATUS_OPTIONS: Array<{
  value: TaskCenterStatusFilter
  label: string
}> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '执行中' },
  { value: 'waiting', label: '等待处理' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败/已取消' },
]

export const TASK_CENTER_STATUS_GROUPS: Record<
  Exclude<TaskCenterStatusFilter, 'all'>,
  ReadonlySet<OrchestrationRunStatus>
> = {
  running: new Set(['QUEUED', 'PLANNING', 'RUNNING', 'CANCELLING']),
  waiting: new Set(['WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED']),
  completed: new Set(['SUCCEEDED']),
  failed: new Set(['FAILED', 'CANCELLED']),
}

export const ORCHESTRATION_STATUS_META: Record<
  OrchestrationRunStatus,
  { label: string; color: string; background: string }
> = {
  QUEUED: { label: '排队中', color: '#2563eb', background: '#eff6ff' },
  PLANNING: { label: '规划中', color: '#2563eb', background: '#eff6ff' },
  RUNNING: { label: '执行中', color: '#0891b2', background: '#ecfeff' },
  WAITING_INPUT: { label: '等待输入', color: '#d97706', background: '#fffbeb' },
  WAITING_APPROVAL: { label: '等待审批', color: '#d97706', background: '#fffbeb' },
  BLOCKED: { label: '已阻塞', color: '#c2410c', background: '#fff7ed' },
  FAILED: { label: '失败', color: '#dc2626', background: '#fef2f2' },
  SUCCEEDED: { label: '已完成', color: '#059669', background: '#ecfdf5' },
  CANCELLING: { label: '取消中', color: '#d97706', background: '#fffbeb' },
  CANCELLED: { label: '已取消', color: '#64748b', background: '#f8fafc' },
}

export function getStatusGroup(status: OrchestrationRunStatus): TaskCenterStatusFilter {
  for (const [group, statuses] of Object.entries(TASK_CENTER_STATUS_GROUPS) as Array<[
    Exclude<TaskCenterStatusFilter, 'all'>,
    ReadonlySet<OrchestrationRunStatus>,
  ]>) {
    if (statuses.has(status)) return group
  }

  return 'all'
}

