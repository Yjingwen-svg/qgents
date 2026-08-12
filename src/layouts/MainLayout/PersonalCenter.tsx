import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { PATHS } from '@/routes/paths'
import './PersonalCenter.css'

/**
 * 个人中心 —— 右侧滑出抽屉（框架）
 *
 * 包含：
 * - 用户信息
 * - 切换团队或项目（搜索 + 列表壳）
 * - 创建团队 → /app/teams/create
 * - 创建项目 → /app/teams/:teamId/projects/create
 * - 退出登录
 *
 * 明确不包含（按产品要求禁止生成）：
 * - 「当前空间」区块
 * - 「账号设置」入口
 *
 * TODO[后端联调]:
 * - 团队/项目树：teamApi.listMine() + projectApi.listByTeam()
 * - 搜索过滤、切换当前团队/项目上下文
 * - 创建项目时的默认 teamId（当前选中团队）
 */

/** 列表占位数据 —— 仅撑起 UI 结构，联调后删除 */
const DEMO_TEAM_TREE = [
  {
    id: 'team-xinghe',
    name: '星河工作室',
    projects: [
      { id: 'proj-qgents', name: 'Qgents', role: 'Maintainer' },
      { id: 'proj-pet', name: '宠影记', role: 'Developer' },
    ],
  },
  {
    id: 'team-gdut',
    name: '广工创新团队',
    projects: [
      { id: 'proj-ai', name: 'AI 决策系统', role: 'Developer' },
      { id: 'proj-campus', name: '校园助手', role: 'Developer' },
    ],
  },
  {
    id: 'team-lab',
    name: '个人实验室',
    projects: [],
  },
]

/** 个人中心「创建项目」暂用默认团队；联调后改为当前选中团队 */
const DEFAULT_TEAM_FOR_CREATE_PROJECT = 'team-xinghe'

export function PersonalCenter() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { open, closePersonalCenter } = usePersonalCenter()

  const name = user?.displayName ?? '用户'
  const email = user?.email ?? '—'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  async function handleLogout() {
    await logout()
    closePersonalCenter()
    navigate(PATHS.LOGIN, { replace: true })
  }

  function handleNav(to: string) {
    closePersonalCenter()
    navigate(to)
  }

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`pc-overlay${open ? ' is-open' : ''}`}
        onClick={closePersonalCenter}
        aria-hidden={!open}
      />

      <aside
        className={`pc-drawer${open ? ' is-open' : ''}`}
        aria-label="个人中心"
        aria-hidden={!open}
      >
        <header className="pc-drawer__header">
          <h2>个人中心</h2>
          <button
            type="button"
            className="pc-drawer__close"
            onClick={closePersonalCenter}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        {/* —— 用户信息 —— */}
        <section className="pc-user">
          <div className="pc-user__avatar" aria-hidden>
            {avatarChar}
          </div>
          <div className="pc-user__meta">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
        </section>

        {/*
          ★ 禁止生成「当前空间」区块 —— 产品明确要求不要
        */}

        {/* —— 切换团队或项目 —— */}
        <section className="pc-switch">
          <h3 className="pc-section-title">切换团队或项目</h3>

          {/* TODO: 本地过滤 DEMO_TEAM_TREE / 调搜索接口 */}
          <label className="pc-search">
            <SearchIcon />
            <input type="search" placeholder="搜索团队或项目" disabled />
          </label>

          <div className="pc-tree">
            {/* TODO: 渲染真实团队树；点击项目可切到对应项目详情 */}
            {DEMO_TEAM_TREE.map((team) => (
              <div key={team.id} className="pc-tree__team">
                <div className="pc-tree__team-name">
                  <TeamIcon />
                  <span>{team.name}</span>
                </div>
                {team.projects.length > 0 ? (
                  <ul className="pc-tree__projects">
                    {team.projects.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="pc-tree__project"
                          onClick={() => handleNav(PATHS.projectReqChat(p.id, 'login'))}
                        >
                          <span>{p.name}</span>
                          <em>{p.role}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* —— 操作入口（仅保留创建团队 / 创建项目 / 退出） —— */}
        <section className="pc-actions">
          <Link
            to={PATHS.CREATE_TEAM}
            className="pc-actions__item"
            onClick={closePersonalCenter}
          >
            <PlusDocIcon />
            <span>创建团队</span>
          </Link>

          {/*
            创建项目路由挂在团队下；
            团队详情页「查看详情」内也有同入口，见 TeamDetailPage
          */}
          <Link
            to={PATHS.createProject(DEFAULT_TEAM_FOR_CREATE_PROJECT)}
            className="pc-actions__item"
            onClick={closePersonalCenter}
          >
            <PlusFolderIcon />
            <span>创建项目</span>
          </Link>

          {/*
            ★ 禁止生成「账号设置」入口 —— 产品明确要求不要
          */}

          <button type="button" className="pc-actions__item pc-actions__item--danger" onClick={handleLogout}>
            <LogoutIcon />
            <span>退出登录</span>
          </button>
        </section>
      </aside>
    </>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19c.7-2.8 2.5-4.2 5.5-4.2s4.8 1.4 5.5 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusDocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 11v5M9.5 13.5H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function PlusFolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7.5z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 11v5M9.5 13.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 12h10M7 9l-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
