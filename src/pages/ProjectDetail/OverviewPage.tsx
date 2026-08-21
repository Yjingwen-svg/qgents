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
import { githubApi, groupApi, projectApi, tasksApi } from '@/api'
import { PATHS } from '@/routes/paths'
import { queryKeys, taskModelQueryKeys } from '@/query'
import './OverviewPage.css'

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

  // 绑定仓库数：GET /projects/{id} 契约不含 repositoryCount（§6），以已绑定仓库列表实取为准
  const { data: repositories = [] } = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: !!projectId,
  })

  const { data: runningTaskPage } = useQuery({
    // 「运行中任务」与任务中心「运行中」筛选同源：status=RUNNING 由服务端过滤，
    // 计数口径一致；不再把 WAITING_DIFF_CONFIRMATION/DELIVERING 等「等待用户/交付中」
    // 状态误算为运行中。queryKey 必须用 taskModelQueryKeys 前缀
    // （['qgents','projects',projectId,'tasks',...]），SSE 事件失效与任务 mutation
    // 都 invalidate 该前缀；孤儿 key 会导致计数永不刷新。
    queryKey: taskModelQueryKeys.tasks.list(projectId, { status: 'RUNNING', limit: 100 }),
    queryFn: () => tasksApi.list(projectId, { status: 'RUNNING', limit: 100 }),
    enabled: !!projectId,
  })
  const runningTasks = runningTaskPage?.data.length ?? 0

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
        <StatCard icon={<DatabaseOutlined />} tone="teal" label="绑定仓库" value={repositories.length} />
        <StatCard icon={<CommentOutlined />} tone="green" label="需求群" value={activeReqGroups} />
        <StatCard icon={<TeamOutlined />} tone="blue" label="项目成员" value={members.length} />
        <StatCard icon={<RocketOutlined />} tone="orange" label="运行中任务" value={runningTasks} />
      </div>

      <h2 className="ov__section-title">快捷入口</h2>
      <div className="ov__links">
        <QuickLink icon={<MessageOutlined />} label="需求群聊" desc="项目总群与需求群" to={PATHS.projectDetail(projectId)} />
        <QuickLink icon={<ProfileOutlined />} label="任务中心" desc="任务与执行状态" to={PATHS.projectTasks(projectId)} />
        <QuickLink icon={<BranchesOutlined />} label="交付中心" desc="Diff 与 MR 交付" to={PATHS.projectDiffs(projectId)} />
        <QuickLink icon={<CodeOutlined />} label="分支与 Diff 详情" desc="分支与仓库" to={PATHS.projectCode(projectId)} />
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
