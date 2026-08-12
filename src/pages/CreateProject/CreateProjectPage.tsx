import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GithubOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import { projectApi } from '@/api'
import './CreateProjectPage.css'

/**
 * 创建项目页 —— 对齐接口文档 v1.1.4 §5.2
 *
 * POST /teams/{teamId}/projects
 * 入口：团队详情页 →「创建项目」、个人中心 →「创建项目」
 *
 * GitHub 仓库：不填 URL；点「绑定github仓库」跳转团队已授权仓库列表再绑定
 */
export function CreateProjectPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

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
      const project = await projectApi.create({
        teamId,
        name: name.trim(),
        description: description.trim() || undefined,
      })
      // 创建成功后跳转到项目需求群聊
      navigate(PATHS.projectReqChat(project.id, 'login'), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="create-project">
      <Link to={PATHS.teamDetail(teamId)} className="create-project__back">
        ← 返回团队详情
      </Link>

      <h1>创建项目</h1>
      <p className="create-project__meta">
        所属团队 teamId: <code>{teamId}</code>
      </p>

      <form className="create-project__card" onSubmit={handleSubmit}>
        {error && (
          <div className="create-project__error" role="alert">
            {error}
          </div>
        )}

        <label className="create-project__field">
          <span>项目名称 *</span>
          <input
            placeholder="例如：Qgents Web"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="create-project__field">
          <span>项目简介</span>
          <textarea
            placeholder="描述项目用途与协作方向"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>

        {/* 原「Git 仓库」URL 输入已移除；改为跳转团队已授权仓库列表 */}
        <div className="create-project__field">
          <span>GitHub 仓库</span>
          <button
            type="button"
            className="create-project__btn create-project__btn--ghost"
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => navigate(PATHS.teamAuthorizedRepos(teamId))}
          >
            <GithubOutlined />
            绑定github仓库
          </button>
          <p className="create-project__hint" style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
            将跳转到该团队已授权的所有 GitHub 仓库列表（含默认分支、同步状态、授权账号）
          </p>
        </div>

        <div className="create-project__actions">
          <Link
            to={PATHS.teamDetail(teamId)}
            className="create-project__btn create-project__btn--ghost"
          >
            取消
          </Link>
          <button
            type="submit"
            className="create-project__btn create-project__btn--primary"
            disabled={submitting || !name.trim()}
          >
            {submitting ? '创建中…' : '创建项目'}
          </button>
        </div>
      </form>
    </div>
  )
}
