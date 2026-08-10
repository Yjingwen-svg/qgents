import { Link } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import './MyTeamsPage.css'

/**
 * 我的团队列表（框架）
 *
 * - 「查看详情」→ 团队详情页（内含创建项目入口）
 * - 「+ 创建团队」→ 创建团队路由
 *
 * TODO[后端联调]: teamApi.listMine() 区分「我创建的 / 我参与的」
 */

/** 占位卡片 —— 仅用于打通「查看详情」路由，联调后替换 */
const DEMO_OWNED = [
  {
    id: 'team-xinghe',
    name: '星河工作室',
    role: 'Maintainer',
    letter: 'X',
    color: '#3b82f6',
    members: 5,
  },
]

const DEMO_JOINED = [
  {
    id: 'team-pet',
    name: '宠影记',
    role: 'Developer',
    letter: 'P',
    color: '#8b5cf6',
    members: 8,
  },
  {
    id: 'team-ai',
    name: 'AI 决策系统',
    role: 'Reviewer',
    letter: 'A',
    color: '#14b8a6',
    members: 6,
  },
]

export function MyTeamsPage() {
  return (
    <div className="my-teams">
      <div className="my-teams__header">
        <div>
          <h1>我的团队</h1>
          <p>管理你加入的团队，或创建 / 加入新团队</p>
        </div>
        <div className="my-teams__actions">
          <Link to={PATHS.JOIN_TEAM} className="my-teams__btn my-teams__btn--ghost">
            加入团队
          </Link>
          <Link to={PATHS.CREATE_TEAM} className="my-teams__btn my-teams__btn--primary">
            + 创建团队
          </Link>
        </div>
      </div>

      <section className="my-teams__section">
        <h2>我创建的团队</h2>
        <div className="my-teams__grid">
          {DEMO_OWNED.map((t) => (
            <article key={t.id} className="my-teams__card">
              <div className="my-teams__card-top">
                <span className="my-teams__logo" style={{ background: t.color }}>
                  {t.letter}
                </span>
                <span className="my-teams__role">{t.role}</span>
              </div>
              <h3>{t.name}</h3>
              <p className="my-teams__meta">{t.members} 位成员</p>
              {/* 查看详情 → 团队详情（可创建项目） */}
              <Link to={PATHS.teamDetail(t.id)} className="my-teams__detail">
                查看详情
              </Link>
            </article>
          ))}

          <Link to={PATHS.CREATE_TEAM} className="my-teams__card my-teams__card--create">
            <span aria-hidden>+</span>
            新建团队
          </Link>
        </div>
      </section>

      <section className="my-teams__section">
        <h2>我参与的团队</h2>
        <div className="my-teams__grid">
          {DEMO_JOINED.map((t) => (
            <article key={t.id} className="my-teams__card">
              <div className="my-teams__card-top">
                <span className="my-teams__logo" style={{ background: t.color }}>
                  {t.letter}
                </span>
                <span className="my-teams__role">{t.role}</span>
              </div>
              <h3>{t.name}</h3>
              <p className="my-teams__meta">{t.members} 位成员</p>
              <Link to={PATHS.teamDetail(t.id)} className="my-teams__detail">
                查看详情
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
