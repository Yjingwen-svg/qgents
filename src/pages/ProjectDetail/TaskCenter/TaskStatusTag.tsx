import { Tag } from 'antd'
import type { OrchestrationRunStatus } from '@/types'
import { ORCHESTRATION_STATUS_META } from './taskCenterConfig'

export function TaskStatusTag({ status }: { status: OrchestrationRunStatus }) {
  const meta = ORCHESTRATION_STATUS_META[status]

  return (
    <Tag
      variant="filled"
      style={{
        marginInlineEnd: 0,
        color: meta.color,
        background: meta.background,
        fontWeight: 600,
      }}
    >
      {meta.label}
    </Tag>
  )
}
