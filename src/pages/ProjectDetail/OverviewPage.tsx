import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Spin, Tag } from 'antd'
import {
  DatabaseOutlined,
  CommentOutlined,
  TeamOutlined,
  RocketOutlined,
  MessageOutlined,
  ProfileOutlined,
  BranchesOutlined,
  CodeOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { groupApi, projectApi, tasksApi } from '@/api'
import { PATHS } from '@/routes/paths'
import type { TaskStatus } from '@/types/task-model'
import './OverviewPage.css'

/** 视为「进行中」的任务状态（与群聊动态面板保持一致） */
const RUNNING_STATUSES: TaskStatus[] = [
  'PLANNING',
  'PENDING',
  'RUNNING',
  'WAITING_DIFF_CONFIRMATION',
  'DELIVERING',
]

/** 项目概览 —— 轻量门户：项目信息 + 核心统计 + 快捷入口 */
export function OverviewPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const activeReqGroups = groups.filter((g) => g.type === 'REQUIREMENT' && !g.isArchived).length

  const { data: members = [] } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: !!projectId,
  })

  const { data: taskPage } = useQuery({
    queryKey: ['tasks', projectId, 'list'],
    queryFn: () => tasksApi.list(projectId),
    enabled: !!projectId,
  })
  const runningTasks = (taskPage?.data ?? []).filter((t) =>
    RUNNING_STATUSES.includes(t.status),
  ).length

  if (isLoading) {
    return (
      <div className="ov">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="ov">
        <div className="ov__empty">项目未找到</div>
      </div>
    )
  }

  const isAdmin = project.role === 'PROJECT_ADMIN'

  return (
    <div className="ov">
      <header className="ov__header">
        <div className="ov__heading">
          <h1 className="ov__title">{project.name}</h1>
          <p className="ov__desc">{project.description || '暂无简介'}</p>
        </div>
        <Tag color={isAdmin ? 'cyan' : 'default'} className="ov__role-tag">
          {isAdmin ? 'Admin' : 'Member'}
        </Tag>
      </header>

      <div className="ov__stats">
        <StatCard icon={<DatabaseOutlined />} tone="teal" label="绑定仓库" value={project.repositoryCount ?? 0} />
        <StatCard icon={<CommentOutlined />} tone="green" label="需求群" value={activeReqGroups} />
        <StatCard icon={<TeamOutlined />} tone="blue" label="项目成员" value={members.length} />
        <StatCard icon={<RocketOutlined />} tone="orange" label="进行中任务" value={runningTasks} />
      </div>

      <h2 className="ov__section-title">快捷入口</h2>
      <div className="ov__links">
        <QuickLink icon={<MessageOutlined />} label="需求群聊" desc="项目总群与需求群" to={PATHS.projectDetail(projectId)} />
        <QuickLink icon={<ProfileOutlined />} label="任务中心" desc="任务与执行状态" to={PATHS.projectTasks(projectId)} />
        <QuickLink icon={<BranchesOutlined />} label="交付中心" desc="Diff 与 MR 交付" to={PATHS.projectDiffs(projectId)} />
        <QuickLink icon={<CodeOutlined />} label="代码与 Branch" desc="分支与仓库" to={PATHS.projectCode(projectId)} />
        <QuickLink icon={<UserOutlined />} label="项目成员" desc="成员与权限" to={PATHS.projectMembers(projectId)} />
        <QuickLink icon={<SettingOutlined />} label="项目设置" desc="规则与基本设置" to={PATHS.projectSettings(projectId)} />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode
  tone: 'teal' | 'green' | 'blue' | 'orange'
  label: string
  value: number
}) {
  return (
    <div className={`ov-stat ov-stat--${tone}`}>
      <div className="ov-stat__icon">{icon}</div>
      <div className="ov-stat__body">
        <div className="ov-stat__value">{value}</div>
        <div className="ov-stat__label">{label}</div>
      </div>
    </div>
  )
}

function QuickLink({
  icon,
  label,
  desc,
  to,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  to: string
}) {
  return (
    <Link to={to} className="ov-link">
      <div className="ov-link__icon">{icon}</div>
      <div className="ov-link__body">
        <div className="ov-link__title">{label}</div>
        <div className="ov-link__desc">{desc}</div>
      </div>
    </Link>
  )
}
