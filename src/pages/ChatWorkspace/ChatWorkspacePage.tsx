/**
 * 项目群聊工作台 —— 仅外壳
 *
 * 布局：左侧会话列表 | 右侧（顶栏 + 空白消息区 + 底部输入）
 * TODO[业务填充]:
 * - 会话列表数据：chatApi.listSessions / 置顶 / 搜索
 * - 消息流：文本、@、代码块、Diff 卡片、任务状态卡片
 * - 发送消息 / 附件 / 一键应用 Patch
 * - 「进入任务详情」跳转任务看板
 */
import './ChatWorkspacePage.css'
import { Link } from 'react-router-dom'
import { PATHS } from '@/routes/paths'

/** 左侧列表用的静态占位（外壳示意，联调后删除） */
const PINNED_SESSIONS = [
  {
    id: '1',
    title: '电商后台重构项目',
    preview: 'Agent 已完成接口文档生成',
    time: '12:30',
    color: '#3b82f6',
    active: true,
  },
]

const RECENT_SESSIONS = [
  {
    id: '2',
    title: '移动端 H5 适配',
    preview: '你: 帮我看一下兼容性…',
    time: '昨天',
    color: '#22c55e',
  },
  {
    id: '3',
    title: 'CRM 数据迁移',
    preview: '张工: 今晚一起 review',
    time: '上周',
    color: '#f97316',
  },
]

export function ChatWorkspacePage() {
  return (
    <div className="chat-shell">
      {/* ===== 左侧：会话列表外壳 ===== */}
      <aside className="chat-shell__sessions" aria-label="会话列表">
        <div className="chat-shell__sessions-toolbar">
          <label className="chat-shell__search">
            <SearchIcon />
            <input type="search" placeholder="搜索会话" disabled />
          </label>
          {/* TODO: 新建会话 / 项目 */}
          <button type="button" className="chat-shell__add" aria-label="新建会话" disabled>
            <PlusIcon />
          </button>
        </div>

        <div className="chat-shell__section">
          <h3 className="chat-shell__section-title">置顶会话</h3>
          <ul className="chat-shell__list">
            {PINNED_SESSIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`chat-shell__item${s.active ? ' is-active' : ''}`}
                  disabled
                >
                  <span
                    className="chat-shell__avatar"
                    style={{ background: s.color }}
                    aria-hidden
                  >
                    <PeopleIcon />
                  </span>
                  <span className="chat-shell__item-body">
                    <span className="chat-shell__item-top">
                      <span className="chat-shell__item-title">{s.title}</span>
                      <time>{s.time}</time>
                    </span>
                    <span className="chat-shell__item-preview">{s.preview}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="chat-shell__section">
          <h3 className="chat-shell__section-title">最近会话</h3>
          <ul className="chat-shell__list">
            {RECENT_SESSIONS.map((s) => (
              <li key={s.id}>
                <button type="button" className="chat-shell__item" disabled>
                  <span
                    className="chat-shell__avatar"
                    style={{ background: s.color }}
                    aria-hidden
                  >
                    <PeopleIcon />
                  </span>
                  <span className="chat-shell__item-body">
                    <span className="chat-shell__item-top">
                      <span className="chat-shell__item-title">{s.title}</span>
                      <time>{s.time}</time>
                    </span>
                    <span className="chat-shell__item-preview">{s.preview}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ===== 右侧：聊天面板外壳 ===== */}
      <section className="chat-shell__panel">
        {/* 会话顶栏 */}
        <header className="chat-shell__header">
          <div className="chat-shell__header-info">
            <h1>电商后台重构项目</h1>
            <p>
              {/* TODO: 真实成员 + Agent 列表 */}
              成员：你、张工、AI开发助手、代码审查Agent
            </p>
          </div>

          <div className="chat-shell__header-actions">
            <button type="button" className="chat-shell__icon-btn" aria-label="更多" disabled>
              <MoreIcon />
            </button>

            {/* 原顶栏网格图标位 → 进入项目详情 */}
            <Link
              to={PATHS.projectDetail('demo-project')}
              className="chat-shell__primary-btn"
            >
              进入项目详情
            </Link>
          </div>
        </header>

        {/*
          消息区：按需求留空，后续在此渲染消息气泡、
          代码块、Diff 卡片、任务状态卡片等
        */}
        <div className="chat-shell__messages" aria-label="消息区域（待填充）" />

        {/* 底部输入外壳 */}
        <footer className="chat-shell__composer">
          <div className="chat-shell__composer-tools">
            <div className="chat-shell__composer-left">
              <button type="button" className="chat-shell__icon-btn" aria-label="表情" disabled>
                <EmojiIcon />
              </button>
              <button type="button" className="chat-shell__icon-btn" aria-label="附件" disabled>
                <ClipIcon />
              </button>
              <button type="button" className="chat-shell__icon-btn" aria-label="图片" disabled>
                <ImageIcon />
              </button>
              <button type="button" className="chat-shell__icon-btn" aria-label="代码块" disabled>
                <CodeIcon />
              </button>
            </div>
            <button type="button" className="chat-shell__mention" disabled>
              @ 提及
            </button>
          </div>

          <div className="chat-shell__composer-row">
            <textarea
              placeholder="输入消息, Shift+Enter换行..."
              rows={1}
              disabled
              aria-label="消息输入"
            />
            <button type="button" className="chat-shell__send" aria-label="发送" disabled>
              <SendIcon />
            </button>
          </div>
        </footer>
      </section>
    </div>
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="3" stroke="#fff" strokeWidth="1.6" />
      <path d="M3.5 18c.7-2.6 2.5-4 5.5-4s4.8 1.4 5.5 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="10" r="2.2" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}

function EmojiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M9 14.5c1 1.2 2 1.8 3 1.8s2-.6 3-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ClipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 12.5l6.5-6.5a3 3 0 1 1 4.2 4.2L9.5 19.4a4.5 4.5 0 0 1-6.4-6.4L13 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 16l4.5-4 3.5 3 3-2.5 5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 8L5 12l4 4M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11.5L20 4l-6.5 16-2.2-6.3L4 11.5z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
