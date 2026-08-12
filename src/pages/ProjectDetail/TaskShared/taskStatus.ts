import type { OrchestrationRunStatus } from '@/types'

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

