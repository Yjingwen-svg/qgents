import { NavLink, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { PATHS, PROJECT_NAV } from '@/routes/paths'
import './ProjectDetailPage.css'

/** 分支列表占位 —— 联调后改为接口数据 */
const BRANCHES = [
  { id: 'login', title: '登录功能', ref: 'feat/login' },
  { id: 'pay', title: '支付回调', ref: 'feat/payment-hook' },
  { id: 'dashboard', title: '数据看板', ref: 'feat/dashboard' },
]

/**
 * 项目详情布局：固定左侧导航，右侧为子路由 Outlet
 * 每个导航项对应独立路由，便于多人分模块填充
 */
export function ProjectDetailLayout() {
  const { projectId = 'demo-project' } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const onBranchChat = location.pathname.includes('/branch-chat')
  const activeBranch = searchParams.get('branch') ?? 'login'

  return (
    <div className="pd">
      <aside className="pd-nav" aria-label="项目导航">
        <nav className="pd-nav__menu">
          {PROJECT_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.to(projectId)}
              className={({ isActive }) =>
                `pd-nav__item${isActive ? ' is-active' : ''}`
              }
            >
              <NavIcon id={item.path} />
              <span className="pd-nav__label">{item.label}</span>
              {'badge' in item && item.badge != null ? (
                <span className="pd-nav__badge">{item.badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="pd-nav__branches">
          <div className="pd-nav__branches-head">
            <span>分支</span>
            <button type="button" className="pd-nav__branches-add" aria-label="新建分支" disabled>
              +
            </button>
          </div>
          <ul className="pd-nav__branch-list">
            {BRANCHES.map((b) => (
              <li key={b.id}>
                <NavLink
                  to={`${PATHS.projectBranchChat(projectId)}?branch=${b.id}`}
                  className={() =>
                    `pd-nav__branch${onBranchChat && activeBranch === b.id ? ' is-active' : ''}`
                  }
                >
                  <span className="pd-nav__branch-hash">#</span>
                  <span className="pd-nav__branch-text">
                    <span className="pd-nav__branch-title">{b.title}</span>
                    <span className="pd-nav__branch-ref">{b.ref}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
          <button type="button" className="pd-nav__new-branch-chat" disabled>
            + 新建分支群
          </button>
        </div>
      </aside>

      <div className="pd-main">
        <Outlet />
      </div>
    </div>
  )
}

function NavIcon({ id }: { id: string }) {
  const paths: Record<string, string> = {
    overview: 'M4 10.5L12 4l8 6.5V20H4V10.5z',
    'branch-chat':
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
