import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'
import './CreateTeamPage.css'

/**
 * 创建新团队（原型图 4）
 * 位于 MainLayout 内（顶部 Banner）
 * TODO[后端联调]:
 * - 头像上传接口
 * - teamApi.create / teamApi.invite
 */
export function CreateTeamPage() {
  const navigate = useNavigate()
  const { setHasTeam } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteRole, setInviteRole] = useState('Developer')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      // TODO[后端联调]:
      // const team = await teamApi.create({
      //   name: name.trim(),
      //   description,
      //   inviteEmails: inviteEmails.split('\n').map(s => s.trim()).filter(Boolean),
      //   inviteRole,
      // })
      void teamApi
      void inviteRole
      setHasTeam(true)
      navigate(PATHS.MY_TEAMS, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  function handleSendInvite() {
    // TODO[后端联调]: 创建前可先缓存邀请列表；创建后调 teamApi.invite
    // 框架阶段仅占位
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
        {/* 头像 */}
        <div className="create-team__avatar-row">
          <button type="button" className="create-team__avatar-btn" aria-label="上传头像">
            <CameraIcon />
            <span>上传头像</span>
          </button>
          <p className="create-team__hint">支持 JPG / PNG，建议 200*200 方形图片</p>
        </div>

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
            value=""
            placeholder="创建完成自动生成日期"
            disabled
            readOnly
          />
        </label>

        <div className="create-team__field">
          <span className="create-team__label">邀请初始成员 (Github 邮箱)</span>
          <textarea
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder="填入对方邮箱，一行一个；发送邮件邀请加入"
            rows={4}
          />
          <div className="create-team__invite-row">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              aria-label="邀请角色"
            >
              {/* 后端角色枚举对齐后可扩展 owner / member / developer 等 */}
              <option value="Developer">Developer</option>
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button type="button" className="create-team__invite-btn" onClick={handleSendInvite}>
              发送邀请
            </button>
          </div>
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
            创建团队
          </button>
        </div>
      </form>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
