import { useParams } from 'react-router-dom'
import { PROJECT_NAV } from '@/routes/paths'

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

/** 各子页薄封装 —— 方便路由表直接挂载 */
export function OverviewPage() {
  return (
    <ProjectSectionPage
      section="overview"
      title="概览"
      todos={['TODO: 项目摘要、活跃分支、Agent/任务状态卡片']}
    />
  )
}

export function TasksPage() {
  return (
    <ProjectSectionPage
      section="tasks"
      title="任务中心"
      todos={['TODO: 任务看板列与状态卡片', 'TODO: 与群聊任务状态卡片联动']}
    />
  )
}

export function WorkflowPage() {
  return (
    <ProjectSectionPage
      section="workflow"
      title="工作流编排"
      todos={['TODO: Planner → Developer → Tester → Reviewer 编排画布']}
    />
  )
}

export function AgentsPage() {
  return (
    <ProjectSectionPage
      section="agents"
      title="Agent 团队"
      todos={['TODO: Agent 头像/昵称/角色标签', 'TODO: 工具定义与分工（禁止单 Agent 梭哈）']}
    />
  )
}

export function SkillsPage() {
  return (
    <ProjectSectionPage
      section="skills"
      title="共享 Skill"
      todos={['TODO: 按项目存取 Skill', 'TODO: owner 可编辑，member 仅使用']}
    />
  )
}

export function MemoryPage() {
  return (
    <ProjectSectionPage
      section="memory"
      title="共享 Memory"
      todos={['TODO: 按项目存取 Memory', 'TODO: owner 可编辑，member 仅使用']}
    />
  )
}

export function CodePage() {
  return (
    <ProjectSectionPage
      section="code"
      title="代码与 Branch"
      todos={['TODO: 仓库绑定 / 分支列表', 'TODO: Diff 预览、手动创建 MR']}
    />
  )
}

export function TestsetPage() {
  return (
    <ProjectSectionPage
      section="testset"
      title="Testset"
      todos={['TODO: 项目自建 testset', 'TODO: MR 前 dry-run 与 CQ+1']}
    />
  )
}

export function MembersPage() {
  return (
    <ProjectSectionPage
      section="members"
      title="项目成员"
      todos={['TODO: 成员列表、角色、邀请/移除']}
    />
  )
}

export function SettingsPage() {
  return (
    <ProjectSectionPage
      section="settings"
      title="项目设置"
      todos={['TODO: 项目基本信息、Git 绑定、危险操作区']}
    />
  )
}
