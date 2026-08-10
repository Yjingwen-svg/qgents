import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import './WelcomePage.css'

/**
 * 登录后、尚未加入任何团队时的引导页（原型图 3）
 * 入口：创建团队 / 加入已有团队
 */
export function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="welcome-page">
      <header className="welcome-page__header">
        <h1>欢迎来到 Qgents</h1>
        <p>你还未加入任何团队，请选择创建或加入团队</p>
      </header>

      <div className="welcome-page__cards">
        <article className="welcome-card welcome-card--create">
          <div className="welcome-card__icon welcome-card__icon--blue" aria-hidden>
            <PlusIcon />
          </div>
          <h2>创建团队</h2>
          <p>自建工作室，生成邀请码，通过 Github 邮箱邀请成员协作</p>
          <button
            type="button"
            className="welcome-card__btn welcome-card__btn--blue"
            onClick={() => navigate(PATHS.CREATE_TEAM)}
          >
            立即创建
          </button>
        </article>

        <article className="welcome-card welcome-card--join">
          <div className="welcome-card__icon welcome-card__icon--green" aria-hidden>
            <JoinIcon />
          </div>
          <h2>加入已有团队</h2>
          <p>填写邀请码加入，或处理别人发送给你的团队邀请</p>
          <button
            type="button"
            className="welcome-card__btn welcome-card__btn--green"
            onClick={() => navigate(PATHS.JOIN_TEAM)}
          >
            加入团队
          </button>
        </article>
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function JoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 8H7a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h3"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 8l4 4-4 4M18 12H10"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
