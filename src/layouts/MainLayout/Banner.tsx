import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { PATHS } from '@/routes/paths'
import './Banner.css'

/**
 * 顶部 Banner（主应用全局）
 * - 团队首页 / 项目群聊
 * - 头像点击 → 打开个人中心抽屉
 */
export function Banner() {
  const { user } = useAuth()
  const { openPersonalCenter } = usePersonalCenter()
  const name = user?.displayName ?? '用户'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  return (
    <header className="qg-banner" role="banner">
      <div className="qg-banner__left">
        <NavLink to={PATHS.MY_TEAMS} className="qg-banner__logo" aria-label="Qgents 首页">
          <span className="qg-banner__logo-mark" aria-hidden>
            Q
          </span>
          <span className="qg-banner__logo-text">gents</span>
        </NavLink>

        <nav className="qg-banner__nav" aria-label="主导航">
          <NavLink
            to={PATHS.MY_TEAMS}
            end
            className={({ isActive }) =>
              `qg-banner__nav-item${isActive ? ' is-active' : ''}`
            }
          >
            <HomeIcon />
            <span>团队首页</span>
          </NavLink>

          <NavLink
            to={PATHS.CHAT}
            className={({ isActive }) =>
              `qg-banner__nav-item${isActive ? ' is-active' : ''}`
            }
          >
            <ChatIcon />
            <span>项目群聊</span>
          </NavLink>
        </nav>
      </div>

      <div className="qg-banner__right">
        <button type="button" className="qg-banner__bell" aria-label="通知">
          <BellIcon />
          <span className="qg-banner__bell-dot" aria-hidden />
        </button>

        {/* 用户区可点击 → 个人中心 */}
        <button
          type="button"
          className="qg-banner__user qg-banner__user--btn"
          onClick={openPersonalCenter}
          aria-label="打开个人中心"
        >
          <span className="qg-banner__username">{name}</span>
          <div className="qg-banner__avatar" aria-hidden>
            {avatarChar}
          </div>
        </button>
      </div>
    </header>
  )
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 1.5 5H4.5S6 12.5 6 9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
