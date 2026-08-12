import type { OrchestrationRunStatus } from '@/types'
import { ORCHESTRATION_STATUS_META } from '../TaskShared/taskStatus'

export type TaskCenterStatusFilter = 'all' | 'running' | 'waiting' | 'completed' | 'failed'
export type TaskCenterView = 'board' | 'table'
export type TaskCenterPanel = 'context' | 'detail' | 'executions'

export const TASK_CENTER_PANEL_OPTIONS: Array<{ key: TaskCenterPanel; label: string }> = [
  { key: 'context', label: '需求上下文' },
  { key: 'detail', label: '任务详情' },
  { key: 'executions', label: '执行记录' },
]

export const TASK_CENTER_STATUS_OPTIONS: Array<{ value: TaskCenterStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '执行中' },
  { value: 'waiting', label: '等待处理' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败/已取消' },
]

export const TASK_CENTER_STATUS_GROUPS: Record<Exclude<TaskCenterStatusFilter, 'all'>, ReadonlySet<OrchestrationRunStatus>> = {
  running: new Set(['QUEUED', 'PLANNING', 'RUNNING', 'CANCELLING']),
  waiting: new Set(['WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED']),
  completed: new Set(['SUCCEEDED']),
  failed: new Set(['FAILED', 'CANCELLED']),
}

export { ORCHESTRATION_STATUS_META }

export function getStatusGroup(status: OrchestrationRunStatus): TaskCenterStatusFilter {
  for (const [group, statuses] of Object.entries(TASK_CENTER_STATUS_GROUPS) as Array<[
    Exclude<TaskCenterStatusFilter, 'all'>,
    ReadonlySet<OrchestrationRunStatus>,
  ]>) {
    if (statuses.has(status)) return group
  }
  return 'all'
}

export function parseTaskCenterPanel(value: string | null): TaskCenterPanel {
  if (value === 'detail' || value === 'executions') return value
  return 'context'
}
