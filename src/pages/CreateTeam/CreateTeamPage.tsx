import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import './CreateTeamPage.css'

/**
 * 创建新团队 —— 对齐接口文档 v1.1.4 §5.1
 *
 * POST /teams 创建团队
 * 创建者自动成为 TEAM_OWNER
 * 邀请成员是后续操作（POST /teams/{teamId}/invitations），创建后跳团队详情再操作
 */
export default function CreateTeamPage() {
  const navigate = useNavigate()
  const { setHasTeam } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)

    try {
      const team = await teamApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      setHasTeam(true)
      navigate(PATHS.teamDetail(team.id, true), { replace: true })
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="create-team">
      <div className="create-team__top">
        <Link to={PATHS.MY_TEAMS} className="create-team__back">
          <BackIcon />
          返回我的团队
        </Link>
      </div>

      <h1 className="create-team__title">创建新团队</h1>

      <form className="create-team__card" onSubmit={handleSubmit}>
        {/* 头像 —— 暂为占位，本期不实现上传 */}
        <div className="create-team__avatar-row">
          <button type="button" className="create-team__avatar-btn" disabled aria-label="上传头像（暂未开放）">
            <CameraIcon />
            <span>上传头像</span>
          </button>
          <p className="create-team__hint">支持 JPG / PNG，建议 200×200 方形图片（暂未开放）</p>
        </div>

        {/* —— 错误提示 —— */}
        {error && (
          <div className="create-team__error" role="alert">
            {error}
          </div>
        )}

        <label className="create-team__field">
          <span className="create-team__label">
            团队名称 <em>*</em>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：前端攻坚小组"
            required
          />
        </label>

        <label className="create-team__field">
          <span className="create-team__label">团队简介</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述团队用途、协作方向"
            rows={3}
          />
        </label>

        <label className="create-team__field">
          <span className="create-team__label">团队成立时间</span>
          <input
            value="创建后自动生成"
            disabled
            readOnly
          />
        </label>

        {/* 邀请成员 —— 创建完成后在团队详情页操作，此处仅提示 */}
        <div className="create-team__field">
          <span className="create-team__label">邀请成员</span>
          <p className="create-team__hint" style={{ margin: 0 }}>
            团队创建后，可在团队详情页通过邮箱邀请成员加入
          </p>
        </div>

        <div className="create-team__actions">
          <button
            type="button"
            className="create-team__btn create-team__btn--ghost"
            onClick={() => navigate(PATHS.MY_TEAMS)}
          >
            取消
          </button>
          <button
            type="submit"
            className="create-team__btn create-team__btn--primary"
            disabled={submitting || !name.trim()}
          >
            {submitting ? '创建中…' : '创建团队'}
          </button>
        </div>
      </form>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.8A1 1 0 0 1 10.5 4h3a1 1 0 0 1 .8.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
