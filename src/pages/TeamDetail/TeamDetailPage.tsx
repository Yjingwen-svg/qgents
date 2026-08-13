import { useEffect, useState } from 'react'
import {
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  FolderOutlined,
  GithubOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Modal, Space, Spin, message } from 'antd'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { projectApi, teamApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { useAppUiStore } from '@/store/appUiStore'
import { useAuth } from '@/context/AuthContext'
import type { Project, Team, TeamMember, User } from '@/types'
import './TeamDetailPage.css'

type TeamDetailView = 'projects' | 'members'

const projectAccentColors = ['#0d9b8a', '#f59e0b', '#6d5dfc', '#2563eb']

function getProjectInitial(projectName: string) {
  return projectName.trim().slice(0, 2).toUpperCase() || 'Q'
}

function getProjectAccent(index: number) {
  return projectAccentColors[index % projectAccentColors.length]
}

function getRoleLabel(role?: string) {
  if (role === 'TEAM_OWNER') return 'Owner'
  if (role === 'PROJECT_ADMIN') return 'Maintainer'
  return 'Developer'
}

function getRecentActivities(projects: Project[]) {
  return projects.slice(0, 4).map((project, index) => ({
    id: project.id,
    title: index % 2 === 0 ? `进入 ${project.name} 总群` : `${project.name} 项目资料已同步`,
    meta: index % 2 === 0 ? '项目协作入口已就绪' : '项目配置已更新',
    time: index === 0 ? '刚刚' : `${index + 1} 小时前`,
  }))
}

function MemberPreview({ member }: { member: TeamMember }) {
  // 后端成员接口暂未返回 displayName/email，缺失时用 userId 兜底，避免渲染崩溃
  const displayName = member.displayName || member.userId
  const email = member.email || '—'
  return (
    <li className="team-detail__member-row">
      <span className="team-detail__member-avatar" aria-hidden>
        {displayName.slice(0, 1)}
      </span>
      <div className="team-detail__member-copy">
        <strong>{displayName}</strong>
        <span>{email}</span>
      </div>
      <span className="team-detail__member-role">{getRoleLabel(member.role)}</span>
    </li>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const repositoryCount = project.repositoryCount ?? 0
  const accent = getProjectAccent(index)

  return (
    <article className="team-detail__project-card">
      <div className="team-detail__project-icon" style={{ background: accent }}>
        {getProjectInitial(project.name)}
      </div>
      <div className="team-detail__project-body">
        <div className="team-detail__project-heading">
          <h3>{project.name}</h3>
          <span className="team-detail__project-role">{getRoleLabel(project.role)}</span>
        </div>
        <p>{project.description || '暂无项目简介'}</p>
        <div className="team-detail__project-meta">
          <span>
            <TeamOutlined /> 项目成员
          </span>
          <span>
            <RobotOutlined /> Agent 待配置
          </span>
          <span>
            <BranchesOutlined /> {repositoryCount} 个仓库
          </span>
          <span>
            <ClockCircleOutlined /> 协作中
          </span>
        </div>
      </div>
      <Link to={PATHS.projectDetail(project.id)} className="team-detail__enter-project">
        进入项目
      </Link>
    </article>
  )
}

function memberIsCurrentUser(member: TeamMember, user: User | null): boolean {
  if (!user) return false
  if (member.userId && member.userId === user.id) return true
  if (member.email && user.email && member.email.toLowerCase() === user.email.toLowerCase()) {
    return true
  }
  return false
}

function isCurrentUserTeamOwner(
  team: Team | undefined,
  members: TeamMember[],
  user: User | null,
  asOwnerQuery: boolean,
): boolean {
  if (asOwnerQuery) return true
  if (team?.myRole === 'TEAM_OWNER') return true
  const me = members.find((member) => memberIsCurrentUser(member, user))
  if (me) return me.role === 'TEAM_OWNER'
  // 公网 GET /teams/:id 经常不带 myRole；对不上成员时先显示入口，避免 Owner 按钮消失
  return !team?.myRole
}

export function TeamDetailPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState<TeamDetailView>('projects')
  const [createOpen, setCreateOpen] = useState(false)
  const setCurrentTeam = useAppUiStore((state) => state.setCurrentTeam)

  // 进入团队详情即记录当前团队，供顶部「团队首页」按钮回到此团队
  useEffect(() => {
    if (teamId) setCurrentTeam(teamId)
  }, [teamId, setCurrentTeam])

  const {
    data: team,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: !!teamId,
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled: !!teamId,
  })

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: () => projectApi.listByTeam(teamId),
    enabled: !!teamId,
  })

  const isLoading = teamLoading || membersLoading || projectsLoading
  const recentActivities = getRecentActivities(projects)
  const ownerCount = members.filter((member) => member.role === 'TEAM_OWNER').length
  /** Owner 才展示「github集成」：接口 myRole，或「我创建的团队」带入的 as=owner */
  const isTeamOwner = isCurrentUserTeamOwner(
    team,
    members,
    user,
    searchParams.get('as') === 'owner',
  )

  const isOwner = team?.role === 'TEAM_OWNER'

  // 解散团队（仅 TEAM_OWNER 可操作）
  const disbandTeam = useMutation({
    mutationFn: () => teamApi.disband(teamId),
    onSuccess: () => {
      message.success('团队已解散')
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
      navigate(PATHS.MY_TEAMS, { replace: true })
    },
    onError: (err) => {
      message.error(err instanceof Error ? err.message : '解散失败')
    },
  })

  function handleDisband() {
    Modal.confirm({
      title: '解散团队',
      content: `确定要解散「${team?.name}」吗？解散后团队下的所有项目、群聊和成员将不可恢复。`,
      okText: '解散',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => disbandTeam.mutate(),
    })
  }

  if (isLoading) {
    return (
      <div className="team-detail team-detail--centered">
        <Spin size="large" />
      </div>
    )
  }

  if (teamError || !team) {
    return (
      <div className="team-detail team-detail--centered">
        <EmptyState icon="🔎" title="团队未找到" description="该团队不存在，或你暂无访问权限" />
      </div>
    )
  }

  return (
    <div className="team-detail">
      <aside className="team-detail__sidebar" aria-label="团队导航">
        <div className="team-detail__team-card">
          <div className="team-detail__team-logo">{team.name.slice(0, 1)}</div>
          <div>
            <h2>{team.name}</h2>
            <p>{team.description || '团队项目协作空间'}</p>
          </div>
          <span className="team-detail__team-role">{getRoleLabel(team.role)}</span>
        </div>

        <nav className="team-detail__nav">
          <button
            type="button"
            className={`team-detail__nav-item ${activeView === 'projects' ? 'team-detail__nav-item--active' : ''}`}
            onClick={() => setActiveView('projects')}
          >
            <ApartmentOutlined />
            团队首页
          </button>
          <button
            type="button"
            className={`team-detail__nav-item ${activeView === 'projects' ? 'team-detail__nav-item--active-soft' : ''}`}
            onClick={() => setActiveView('projects')}
          >
            <FolderOutlined />
            项目
          </button>
          <button
            type="button"
            className={`team-detail__nav-item ${activeView === 'members' ? 'team-detail__nav-item--active' : ''}`}
            onClick={() => setActiveView('members')}
          >
            <TeamOutlined />
            团队通讯录
          </button>
          <span className="team-detail__nav-item team-detail__nav-item--disabled">
            <SettingOutlined />
            团队设置
          </span>
          {isTeamOwner ? (
            <Link to={PATHS.githubIntegration(teamId)} className="team-detail__nav-item">
              <GithubOutlined />
              GitHub 集成
            </Link>
          ) : null}
        </nav>

        {isOwner && (
          <button
            type="button"
            className="team-detail__nav-item team-detail__nav-item--danger"
            onClick={handleDisband}
          >
            <DeleteOutlined />
            解散团队
          </button>
        )}
      </aside>

      <main className="team-detail__main">
        <section className="team-detail__hero">
          <div>
            <Link to={PATHS.MY_TEAMS} className="team-detail__back">
              返回我的团队
            </Link>
            <h1>{team.name}</h1>
            <p>从个人中心切换团队或项目，进入项目总群继续协作。</p>
          </div>
          <Space>
            {isTeamOwner ? (
              <Link to={PATHS.githubIntegration(teamId)}>
                <Button icon={<GithubOutlined />}>github集成</Button>
              </Link>
            ) : null}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              创建项目
            </Button>
          </Space>
        </section>

        {activeView === 'projects' ? (
          <section className="team-detail__section">
            <div className="team-detail__section-heading">
              <h2>项目</h2>
              <span>{projects.length} 个项目</span>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                icon="📁"
                title="暂无项目"
                description="创建第一个项目后，团队成员就可以进入项目总群开始协作"
              />
            ) : (
              <div className="team-detail__project-list">
                {projects.map((project, index) => (
                  <ProjectCard key={project.id} project={project} index={index} />
                ))}
              </div>
            )}

            <div className="team-detail__notice">
              <CheckCircleFilled />
              <div>
                <strong>项目权限相互隔离：同一成员在不同项目可拥有不同角色。</strong>
                <span>项目的数据、配置、任务、分支组、成员权限等均相互独立，互不影响。</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="team-detail__section">
            <div className="team-detail__section-heading">
              <h2>团队通讯录</h2>
              <span>
                {members.length} 人 · {ownerCount} 位 Owner
              </span>
            </div>

            <div className="team-detail__directory">
              {members.map((member) => (
                <MemberPreview key={member.userId} member={member} />
              ))}
            </div>
          </section>
        )}
      </main>

      <aside className="team-detail__aside">
        <section className="team-detail__panel">
          <div className="team-detail__panel-heading">
            <h2>最近动态</h2>
            <Link to={PATHS.MY_TEAMS}>查看全部</Link>
          </div>
          {recentActivities.length === 0 ? (
            <p className="team-detail__muted">创建项目后会显示团队动态。</p>
          ) : (
            <ul className="team-detail__activity-list">
              {recentActivities.map((activity) => (
                <li key={activity.id} className="team-detail__activity-item">
                  <CheckCircleFilled />
                  <div>
                    <strong>{activity.title}</strong>
                    <span>{activity.meta}</span>
                  </div>
                  <time>{activity.time}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="team-detail__panel">
          <div className="team-detail__panel-heading">
            <h2>待处理的团队邀请</h2>
            <span>0 个</span>
          </div>
          <p className="team-detail__muted">当前接口没有待处理项目邀请列表，这里先保留原型中的信息区位置。</p>
        </section>
      </aside>

      <CreateProjectModal
        teamId={teamId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
