import { Link } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import './MyTeamsPage.css'

/**
 * 我的团队列表
 * TODO[后端联调]: teamApi.listMine()；成员管理、邀请码展示
 */
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
            创建团队
          </Link>
        </div>
      </div>

      {/* 空状态：联调后有数据则渲染团队卡片列表 */}
      <div className="my-teams__empty">
        <p>暂无团队数据（框架阶段）</p>
        <p className="my-teams__hint">
          点击「创建团队」进入创建表单；创建成功后在此展示团队卡片，并进入项目隔离（Skill / Memory / 群聊 / 任务）。
        </p>
      </div>
    </div>
  )
}
