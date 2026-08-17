import { useQuery } from '@tanstack/react-query'
import { Typography, Tag } from 'antd'
import {
  CheckCircleFilled,
  SyncOutlined,
  ClockCircleOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons'
import { groupApi, mergeRequestsApi, tasksApi } from '@/api'
import type { TaskListItem, TaskStatus } from '@/types/task-model'

const { Text } = Typography

/** 需求群进度（由该群关联任务状态派生） */
type GroupProgressKey = 'done' | 'running' | 'todo' | 'failed'

const RUNNING_STATUSES: TaskStatus[] = [
  'PLANNING',
  'PENDING',
  'RUNNING',
  'WAITING_DIFF_CONFIRMATION',
  'DELIVERING',
]
const FAILED_STATUSES: TaskStatus[] = ['FAILED', 'DELIVERY_FAILED', 'CANCELLED', 'CANCELLING']

const PROGRESS_META: Record<
  GroupProgressKey,
  { icon: React.ReactNode; label: string; color: string }
> = {
  done: { icon: <CheckCircleFilled style={{ color: '#16a34a' }} />, label: '已完成', color: '#16a34a' },
  running: { icon: <SyncOutlined spin style={{ color: '#2563eb' }} />, label: '执行中', color: '#2563eb' },
  todo: { icon: <ClockCircleOutlined style={{ color: '#9ca3af' }} />, label: '待开始', color: '#9ca3af' },
  failed: { icon: <ExclamationCircleFilled style={{ color: '#dc2626' }} />, label: '异常', color: '#dc2626' },
}

const TASK_STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  PLANNING: { label: '规划中', color: 'default' },
  PENDING: { label: '待执行', color: 'default' },
  RUNNING: { label: '执行中', color: 'blue' },
  WAITING_DIFF_CONFIRMATION: { label: '待确认', color: 'orange' },
  DELIVERING: { label: '交付中', color: 'blue' },
  DELIVERY_FAILED: { label: '交付失败', color: 'red' },
  SUCCEEDED: { label: '已完成', color: 'green' },
  FAILED: { label: '失败', color: 'red' },
  CANCELLING: { label: '取消中', color: 'default' },
  CANCELLED: { label: '已取消', color: 'default' },
}

/** 按群上关联任务的优先级，派生需求群进度 */
function groupProgress(tasks: TaskListItem[], groupId: string): GroupProgressKey {
  const ts = tasks.filter((t) => t.requirementGroup?.id === groupId)
  if (ts.length === 0) return 'todo'
  if (ts.some((t) => RUNNING_STATUSES.includes(t.status))) return 'running'
  if (ts.some((t) => t.status === 'SUCCEEDED')) return 'done'
  if (ts.some((t) => FAILED_STATUSES.includes(t.status))) return 'failed'
  return 'todo'
}

/**
 * 项目动态面板 —— 群聊页右侧第三栏
 * 需求群进度（真实接口）+ 任务动态（真实接口）+ MR 待处理（真实接口）
 */
export function ProjectActivityPanel({ projectId }: { projectId: string }) {
  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const requirementGroups = groups.filter((g) => g.type === 'REQUIREMENT')

  const { data: taskPage } = useQuery({
    queryKey: ['tasks', projectId, 'list'],
    queryFn: () => tasksApi.list(projectId),
    enabled: !!projectId,
  })
  const tasks = taskPage?.data ?? []

  const { data: mrPage } = useQuery({
    queryKey: ['merge-requests', projectId, 'open'],
    queryFn: () => mergeRequestsApi.list(projectId, { status: 'OPEN' }),
    enabled: !!projectId,
  })
  const mrs = mrPage?.data ?? []

  return (
    <aside className="pd-activity" aria-label="项目动态">
      {/* 📋 需求群进度 */}
      <section className="pd-activity__section">
        <h3 className="pd-activity__title">📋 需求群进度</h3>
        {requirementGroups.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂无需求群
          </Text>
        ) : (
          <ul className="pd-activity__list">
            {requirementGroups.map((g) => {
              const meta = PROGRESS_META[groupProgress(tasks, g.id)]
              return (
                <li key={g.id} className="pd-activity__row">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {meta.icon}
                    <span style={{ fontSize: 13 }}>{g.title}</span>
                  </span>
                  <span style={{ color: meta.color, fontSize: 12 }}>{meta.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ✅ 任务动态 */}
      <section className="pd-activity__section">
        <h3 className="pd-activity__title">✅ 任务动态</h3>
        {tasks.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂无任务
          </Text>
        ) : (
          <ul className="pd-activity__list">
            {tasks.slice(0, 8).map((t) => {
              const meta = TASK_STATUS_META[t.status]
              return (
                <li key={t.id} className="pd-activity__row">
                  <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                    {t.title}
                  </span>
                  <Tag color={meta.color} style={{ margin: 0, fontSize: 11 }}>
                    {meta.label}
                  </Tag>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 🔀 MR 待处理 */}
      <section className="pd-activity__section">
        <h3 className="pd-activity__title">🔀 MR 待处理</h3>
        {mrs.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂无待处理 MR
          </Text>
        ) : (
          <ul className="pd-activity__list">
            {mrs.slice(0, 8).map((mr) => (
              <li key={mr.id} className="pd-activity__row">
                <span
                  style={{
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 150,
                  }}
                >
                  #{mr.number} {mr.title || 'MR'}
                </span>
                <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                  待处理
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
