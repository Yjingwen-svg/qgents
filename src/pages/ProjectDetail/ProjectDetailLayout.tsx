import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { PATHS, PROJECT_NAV } from '@/routes/paths'
import { PROJECT_REQUIREMENTS } from './requirements'
import './ProjectDetailPage.css'

/**
 * 项目详情布局：固定左侧导航，右侧为子路由 Outlet
 *
 * 左侧「需求」列表：每一项对应独立路由
 *   /app/projects/:projectId/req-chat/:reqId
 */
export function ProjectDetailLayout() {
  const { projectId = 'demo-project', reqId } = useParams<{
    projectId: string
    reqId?: string
  }>()
  const location = useLocation()
  const onReqChat = location.pathname.includes('/req-chat')
  const activeReqId = reqId

  /**
   * 当前项目名称（从项目群聊进入后展示在导航上方）
   * TODO[后端联调]: GET /projects/:id → name
   */
  const projectName = resolveProjectName(projectId)

  return (
    <div className="pd">
      <aside className="pd-nav" aria-label="项目导航">
        {/* 当前项目名 —— 位于导航列表上方 */}
        <div className="pd-nav__project">
          <span className="pd-nav__project-label">当前项目</span>
          <strong className="pd-nav__project-name" title={projectName}>
            {projectName}
          </strong>
        </div>

        <nav className="pd-nav__menu">
          {PROJECT_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.to(projectId)}
              className={({ isActive }) => {
                // 需求群聊：任意 /req-chat/* 都高亮该导航项
                const active =
                  item.path === 'req-chat'
                    ? onReqChat
                    : isActive
                return `pd-nav__item${active ? ' is-active' : ''}`
              }}
            >
              <NavIcon id={item.path} />
              <span className="pd-nav__label">{item.label}</span>
              {'badge' in item && item.badge != null ? (
                <span className="pd-nav__badge">{item.badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {/* —— 需求列表 —— */}
        <div className="pd-nav__branches">
          <div className="pd-nav__branches-head">
            <span>需求</span>
          </div>
          <ul className="pd-nav__branch-list">
            {PROJECT_REQUIREMENTS.map((r) => (
              <li key={r.id}>
                {/*
                  每个功能需求独立路由，例如：
                  /app/projects/demo-project/req-chat/login  → 登录功能 IM
                  /app/projects/demo-project/req-chat/pay    → 支付回调 IM
                */}
                <NavLink
                  to={PATHS.projectReqChat(projectId, r.id)}
                  className={() =>
                    `pd-nav__branch${onReqChat && activeReqId === r.id ? ' is-active' : ''}`
                  }
                >
                  <span className="pd-nav__branch-hash">#</span>
                  <span className="pd-nav__branch-text">
                    <span className="pd-nav__branch-title">{r.title}</span>
                    <span className="pd-nav__branch-ref">{r.ref}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>

          {/*
            新建需求群 —— 仅 UI 占位，暂不挂路由
            TODO: 后续接「创建需求群」页面 / 弹窗
          */}
          <div className="pd-nav__new-branch-chat" aria-hidden>
            + 新建需求群
          </div>
        </div>
      </aside>

      <div className="pd-main">
        <Outlet />
      </div>
    </div>
  )
}

function resolveProjectName(projectId: string) {
  // 框架阶段占位映射；联调后删除，改用接口返回的 name
  const DEMO_NAMES: Record<string, string> = {
    'demo-project': '电商后台重构项目',
    'proj-qgents': 'Qgents',
    'proj-pet': '宠影记',
    'proj-ai': 'AI 决策系统',
    'proj-campus': '校园助手',
  }
  return DEMO_NAMES[projectId] ?? projectId
}

function NavIcon({ id }: { id: string }) {
  const paths: Record<string, string> = {
    overview: 'M4 10.5L12 4l8 6.5V20H4V10.5z',
    'req-chat':
      'M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6z',
    tasks: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    workflow: 'M4 7h6v4H4V7zm10 0h6v4h-6V7zM9 11v3h6v3',
    agents:
      'M9 8a3 3 0 1 0 0-0.01M17 9a2.5 2.5 0 1 0 0-0.01M3.5 19c.8-3 2.8-4.5 5.5-4.5S14 16 14.5 19M14.5 14.5c1.6-.4 3.2.2 4.5 1.8',
    skills: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z',
    memory: 'M6 5h12v14H6V5zm3 4h6M9 12h6M9 15h4',
    code: 'M9 7L4 12l5 5M15 7l5 5-5 5',
    testset: 'M9 4h6l1 3h4v13H4V7h4l1-3zm3 6v6m0 0l-2-2m2 2l2-2',
    members:
      'M9 8a3 3 0 1 0 0-.01M16.5 9a2.2 2.2 0 1 0 0-.01M4 19c.8-3 2.6-4.5 5-4.5s4.2 1.5 5 4.5M14 14.5c1.4-.3 2.8.3 4 1.7',
    settings:
      'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6',
  }

  return (
    <svg className="pd-nav__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={paths[id] ?? paths.overview}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
