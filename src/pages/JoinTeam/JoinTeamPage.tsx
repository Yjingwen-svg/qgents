import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'
import './JoinTeamPage.css'

/**
 * 加入已有团队（框架页）
 * TODO[后端联调]: teamApi.join({ inviteCode })；展示待处理邀请列表
 */
export function JoinTeamPage() {
  const navigate = useNavigate()
  const { setHasTeam } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setSubmitting(true)
    try {
      // await teamApi.join({ inviteCode: inviteCode.trim() })
      void teamApi
      setHasTeam(true)
      navigate(PATHS.MY_TEAMS, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="join-team">
      <Link to={PATHS.MY_TEAMS} className="join-team__back">
        ← 返回我的团队
      </Link>
      <h1>加入已有团队</h1>
      <p className="join-team__desc">填写邀请码加入，或处理别人发送给你的团队邀请</p>

      <form className="join-team__card" onSubmit={handleSubmit}>
        <label>
          <span>邀请码</span>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="粘贴团队邀请码"
            required
          />
        </label>
        <button type="submit" disabled={submitting || !inviteCode.trim()}>
          加入团队
        </button>
      </form>

      {/* TODO: 待处理邀请列表（邮件邀请 / 站内邀请） */}
      <section className="join-team__pending">
        <h2>待处理邀请</h2>
        <p className="join-team__placeholder">暂无待处理邀请（接口联调后在此渲染）</p>
      </section>
    </div>
  )
}
