import { Link, useParams } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import './ProjectDetailPage.css'

/**
 * 项目详情页（框架占位）
 * 从 IM 顶栏「进入项目详情」跳转至此
 * TODO: 项目信息、成员、Skill/Memory、绑定仓库、任务摘要等
 */
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="project-detail">
      <Link to={PATHS.CHAT} className="project-detail__back">
        ← 返回项目群聊
      </Link>
      <h1>项目详情</h1>
      <p className="project-detail__meta">
        projectId: <code>{projectId ?? '—'}</code>
      </p>
      <p className="project-detail__hint">
        页面框架占位，后续在此填充项目信息、成员、仓库绑定、Skill / Memory 等内容。
      </p>
    </div>
  )
}
