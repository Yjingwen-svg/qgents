import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Spin } from 'antd'
import { PROJECT_NAV } from '@/routes/paths'
import { projectApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { MemoryPage as MemoryPageImpl } from './MemoryPage'

/**
 * 项目详情其它导航子页的统一占位壳
 * TODO: 各同学按模块拆成独立页面并实现业务
 */
export function ProjectSectionPage({
  section,
  title,
  todos,
}: {
  section: string
  title: string
  todos?: string[]
}) {
  const { projectId } = useParams<{ projectId: string }>()
  const nav = PROJECT_NAV.find((n) => n.path === section)

  return (
    <div className="pd-section">
      <header className="pd-section__header">
        <h1>{title || nav?.label || section}</h1>
        <p>
          projectId: <code>{projectId ?? '—'}</code>
        </p>
      </header>
      <div className="pd-section__body">
        <p className="pd-section__hint">页面框架占位，业务内容待填充。</p>
        {todos && todos.length > 0 ? (
          <ul className="pd-section__todo">
            {todos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

/** ──── 项目概览 —— A 负责 ──── */
export function OverviewPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })

  if (isLoading) {
    return (
      <div className="pd-section">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="pd-section">
        <EmptyState icon="🔍" title="项目未找到" />
      </div>
    )
  }

  return (
    <div className="pd-section">
      <header className="pd-section__header">
        <h1>{project.name}</h1>
        <p>{project.description || '暂无简介'}</p>
      </header>

      <div className="pd-section__body">
        {/* 基础统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="仓库" value={String(project.repositoryCount ?? 0)} />
          <StatCard label="我的角色" value={project.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'} />
          <StatCard label="项目 ID" value={project.id} mono />
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>快捷入口</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <QuickLink label="需求群聊" desc="查看项目总群和需求群" to={`/app/projects/${projectId}/req-chat`} />
          <QuickLink label="任务中心" desc="查看任务与执行状态" to={`/app/projects/${projectId}/tasks`} />
          <QuickLink label="代码 & MR" desc="分支、Diff、MR 审查" to={`/app/projects/${projectId}/code`} />
          <QuickLink label="项目成员" desc="管理成员与权限" to={`/app/projects/${projectId}/members`} />
        </div>
      </div>
    </div>
  )
}

/** 统计数字卡片 */
function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: mono ? 14 : 22, fontWeight: 700, color: '#e2e8f0', fontFamily: mono ? 'monospace' : undefined }}>
        {value}
      </div>
    </div>
  )
}

/** 快捷入口卡片 */
function QuickLink({ label, desc, to }: { label: string; desc: string; to: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: '12px 16px',
        background: 'rgba(13,155,138,0.08)',
        borderRadius: 8,
        border: '1px solid rgba(13,155,138,0.15)',
        textDecoration: 'none',
        color: '#e2e8f0',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(13,155,138,0.14)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(13,155,138,0.08)' }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{desc}</div>
    </Link>
  )
}

/** 各子页薄封装 —— 方便路由表直接挂载 */
export function TasksPage() {
  return <ProjectSectionPage section="tasks" title="任务中心" todos={['TODO: B - 任务看板列与状态卡片']} />
}

export function WorkflowPage() {
  return <ProjectSectionPage section="workflow" title="工作流编排" todos={['TODO: B - Planner → Developer → Tester → Reviewer 画布']} />
}

export function AgentsPage() {
  return <ProjectSectionPage section="agents" title="Agent 团队" todos={['TODO: B - Agent 身份卡与团队管理']} />
}

export function SkillsPage() {
  return <ProjectSectionPage section="skills" title="共享 Skill" todos={['TODO: B - Skill 创建/审核/发布']} />
}

export function MemoryPage() {
  return <MemoryPageImpl />
}

export function CodePage() {
  return <ProjectSectionPage section="code" title="代码与 Branch" todos={['TODO: C - 仓库绑定 / 分支列表 / Diff']} />
}

export function TestsetPage() {
  return <ProjectSectionPage section="testset" title="Testset" todos={['TODO: C - Testset 管理与执行']} />
}

export function MembersPage() {
  return <ProjectSectionPage section="members" title="项目成员" todos={['TODO: C - 成员列表、角色、邀请/移除']} />
}

export function SettingsPage() {
  return <ProjectSectionPage section="settings" title="项目设置" todos={['TODO: C - 项目设置与质量门禁']} />
}
