import { Tag } from 'antd'
import type { TaskStatus } from '@/types/task-model'

const STATUS_META: Record<TaskStatus, { color: string; label: string }> = {
  PLANNING: { color: 'blue', label: '规划中' },
  PENDING: { color: 'gold', label: '待处理' },
  RUNNING: { color: 'processing', label: '运行中' },
  WAITING_DIFF_CONFIRMATION: { color: 'gold', label: '等待 Diff 确认' },
  DELIVERING: { color: 'processing', label: '交付中' },
  DELIVERY_FAILED: { color: 'error', label: '交付失败' },
  SUCCEEDED: { color: 'success', label: '已完成' },
  FAILED: { color: 'error', label: '失败' },
  CANCELLING: { color: 'warning', label: '取消中' },
  CANCELLED: { color: 'default', label: '已取消' },
}

export function TaskModelStatusTag({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status]
  return <Tag color={meta.color}>{meta.label}</Tag>
}
