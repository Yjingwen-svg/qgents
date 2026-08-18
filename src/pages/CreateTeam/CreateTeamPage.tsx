import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import './CreateTeamPage.css'

/**
 * 创建新团队 —— 对齐接口文档 §5.1 / §28.3（团队头像）
 *
 * §28.3 头像流程：创建页选图预览 → POST /teams 创建（无 teamId 无法先传）→
 * 用返回的 teamId 走 credential → OSS PUT → confirm 拿 avatarUrl →
 * PATCH /teams/{teamId} 回写 → 跳转团队详情。
 * 头像上传失败不阻断团队创建（提示后继续跳转）。
 */
export default function CreateTeamPage() {
  const navigate = useNavigate()
  const { setHasTeam } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 选图：本地预览（上传在创建成功后按 §28.3 执行） */
  function pickAvatar(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('仅支持图片文件')
      return
    }
    setError(null)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)

    let teamId = ''
    try {
      const team = await teamApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      teamId = team.id
      setHasTeam(true)

      // §28.3：创建成功后再上传头像并回写；失败不阻断跳转
      if (avatarFile) {
        try {
          const avatarUrl = await teamApi.uploadAvatar(teamId, avatarFile)
          if (avatarUrl) await teamApi.update(teamId, { avatarUrl })
        } catch (avatarError) {
          // 头像失败不阻断：提示后继续跳转
          setError(
            `团队已创建，但头像上传失败：${avatarError instanceof Error ? avatarError.message : '请稍后到团队设置重试'}`,
          )
        }
      }

      navigate(PATHS.teamDetail(teamId, true), { replace: true })
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
        {/* 团队头像（§28.3：选图本地预览，创建成功后上传并回写） */}
        <div className="create-team__avatar-row">
          <button
            type="button"
            className="create-team__avatar-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="上传团队头像"
          >
            {avatarPreview ? (
              <img className="create-team__avatar-preview" src={avatarPreview} alt="团队头像预览" />
            ) : (
              <CameraIcon />
            )}
            <span>{avatarPreview ? '更换头像' : '上传头像'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => pickAvatar(event.target.files?.[0])}
          />
          <p className="create-team__hint">支持 JPG / PNG，建议 200×200 方形图片</p>
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
          <input value="创建后自动生成" disabled readOnly />
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
