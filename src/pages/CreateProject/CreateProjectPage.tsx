import { type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { projectApi } from '@/api'
import './CreateProjectPage.css'

/**
 * 创建项目页（框架）
 *
 * 入口：
 * 1. 个人中心 →「创建项目」
 * 2. 团队详情（查看详情）→「创建项目」
 *
 * TODO[后端联调]:
 * - projectApi.create({ teamId, name, gitRepoUrl, autoCreateRepo })
 * - 创建成功后跳转项目详情 PATHS.projectReqChat(projectId)
 * 当前不实现表单提交业务，仅保留路由与壳
 */
export function CreateProjectPage() {
  const { teamId = 'demo-team' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO: await projectApi.create(...)
    void projectApi
    // 框架阶段：提交后回到团队详情，便于继续联调
    navigate(PATHS.teamDetail(teamId))
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
        {/* TODO: 项目名称、简介、绑定 Git / 自动新建仓库 */}
        <label className="create-project__field">
          <span>项目名称 *</span>
          <input placeholder="例如：Qgents Web" disabled />
        </label>

        <label className="create-project__field">
          <span>项目简介</span>
          <textarea placeholder="描述项目用途（待实现）" rows={3} disabled />
        </label>

        <label className="create-project__field">
          <span>Git 仓库</span>
          <input placeholder="已有仓库 URL，或留空由平台自动创建（待实现）" disabled />
        </label>

        <div className="create-project__actions">
          <Link to={PATHS.teamDetail(teamId)} className="create-project__btn create-project__btn--ghost">
            取消
          </Link>
          {/* 框架阶段按钮可点，仅走路由回跳，不写真实创建逻辑 */}
          <button type="submit" className="create-project__btn create-project__btn--primary">
            创建项目
          </button>
        </div>
      </form>
    </div>
  )
}
