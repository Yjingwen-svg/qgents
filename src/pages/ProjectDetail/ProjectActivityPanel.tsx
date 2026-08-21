import { useQuery } from '@tanstack/react-query'
import { Typography, Tag } from 'antd'
import {
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ExclamationCircleFilled,
  SyncOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { groupApi, mergeRequestsApi, tasksApi } from '@/api'
import { taskModelQueryKeys } from '@/query'
import type { TaskListItem, TaskStatus } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { useProjectTaskPollingInterval } from '@/realtime/useProjectTaskDomainEvents'

const { Text } = Typography

/** 需求群进度（由该群关联任务状态派生） */
type GroupProgressKey = 'done' | 'running' | 'todo' | 'failed'

const RUNNING_STATUSES: TaskStatus[] = [
  'PLANNING',
  'PENDING',
  'RUNNING',
  'WAITING_DIFF_CONFIRMATION',
  'WAITING_PREFLIGHT',
  'DELIVERING',
]
const FAILED_STATUSES: TaskStatus[] = ['FAILED', 'DELIVERY_FAILED', 'DIFF_REJECTED', 'CANCELLED', 'CANCELLING']

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
  WAITING_PREFLIGHT: { label: '预检中', color: 'gold' },
  DIFF_REJECTED: { label: 'Diff 已拒绝', color: 'red' },
  DELIVERING: { label: '交付中', color: 'blue' },
  DELIVERY_FAILED: { label: '交付失败', color: 'red' },
  SUCCEEDED: { label: '已完成', color: 'green' },
  FAILED: { label: '失败', color: 'red' },
  CANCELLING: { label: '取消中', color: 'default' },
  CANCELLED: { label: '已取消', color: 'default' },
}

/** 未知任务状态兜底：后端新增状态未同步时，不崩溃、原样展示 */
const UNKNOWN_TASK_STATUS_META = { label: '未知', color: 'default' }

/** 按群上关联任务的优先级，派生需求群进度 */
function groupProgress(tasks: TaskListItem[], groupId: string): GroupProgressKey {
  const ts = tasks.filter((t) => t.requirementGroup?.id === groupId)
  if (ts.length === 0) return 'todo'
  if (ts.some((t) => FAILED_STATUSES.includes(t.status))) return 'failed'
  if (ts.some((t) => RUNNING_STATUSES.includes(t.status))) return 'running'
  if (ts.some((t) => t.status === 'SUCCEEDED')) return 'done'
  return 'todo'
}

/**
 * 项目动态面板 —— 群聊页右侧第三栏
 * 需求群进度（真实接口）+ 任务动态（真实接口）+ MR 待处理（真实接口）
 */
export function ProjectActivityPanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const taskPollingInterval = useProjectTaskPollingInterval(projectId, 5_000)
  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const requirementGroups = groups.filter((g) => g.type === 'REQUIREMENT')

  const { data: taskPage } = useQuery({
    // 必须用 taskModelQueryKeys 前缀（['qgents','projects',projectId,'tasks',...]），
    // SSE 事件失效与任务 mutation 都 invalidate 该前缀；孤儿 key 会导致数据永远不刷新
    queryKey: taskModelQueryKeys.tasks.list(projectId, { limit: 100 }),
    queryFn: () => tasksApi.list(projectId, { limit: 100 }),
    enabled: !!projectId,
    refetchInterval: taskPollingInterval,
  })
  const tasks = taskPage?.data ?? []

  const { data: mrPage } = useQuery({
    queryKey: taskModelQueryKeys.mergeRequests.list(projectId, { status: 'OPEN' }),
    queryFn: () => mergeRequestsApi.list(projectId, { status: 'OPEN' }),
    enabled: !!projectId,
  })
  const mrs = mrPage?.data ?? []

  const hasActivity = requirementGroups.length > 0 || tasks.length > 0 || mrs.length > 0

  return (
    <aside className="pd-activity" aria-label="项目动态">
      <div className="pd-activity__header">
        <div>
          <h2 className="pd-activity__heading">项目动态</h2>
          <Text type="secondary" className="pd-activity__subtitle">实时查看项目进展</Text>
        </div>
      </div>

      {!hasActivity ? <div className="pd-activity__empty">完成需求群或任务后，相关进展会显示在这里</div> : null}

      {requirementGroups.length > 0 ? (
        <section className="pd-activity__section">
          <h3 className="pd-activity__title"><ApartmentOutlined /> 需求群进度</h3>
          <ul className="pd-activity__list">
            {requirementGroups.map((g) => {
              const meta = PROGRESS_META[groupProgress(tasks, g.id)]
              return (
                <li key={g.id} className="pd-activity__row">
                  <span className="pd-activity__row-label">
                    {meta.icon}
                    <span className="pd-activity__row-text">{g.title}</span>
                  </span>
                  <span className="pd-activity__status" style={{ color: meta.color }}>{meta.label}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section className="pd-activity__section">
          <h3 className="pd-activity__title"><CheckSquareOutlined /> 任务动态</h3>
          <ul className="pd-activity__list">
            {tasks.slice(0, 8).map((t) => {
              const meta = TASK_STATUS_META[t.status] ?? UNKNOWN_TASK_STATUS_META
              const batchId = t.attention?.diffReviewBatchId
              return (
                <li key={t.id} className="pd-activity__row">
                  <button
                    type="button"
                    className="pd-activity__row-button"
                    title="查看任务详情"
                    onClick={() => navigate(PATHS.projectTaskDetail(projectId, t.id) + (batchId ? `?diffReviewBatchId=${encodeURIComponent(batchId)}` : ''))}
                  >
                    <span className="pd-activity__row-text">{t.title}</span>
                    <Tag color={meta.color} className="pd-activity__tag">{meta.label}</Tag>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {mrs.length > 0 ? (
        <section className="pd-activity__section">
          <h3 className="pd-activity__title"><BranchesOutlined /> 待处理 MR</h3>
          <ul className="pd-activity__list">
            {mrs.slice(0, 8).map((mr) => (
              <li key={mr.id} className="pd-activity__row">
                <button type="button" className="pd-activity__row-button" title="查看 MR 详情" onClick={() => navigate(PATHS.projectCodeMr(projectId, mr.id))}>
                  <span className="pd-activity__row-text">#{mr.number} {mr.title || 'MR'}</span>
                  <Tag color="orange" className="pd-activity__tag">待处理</Tag>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}
