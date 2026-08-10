import { Link, useParams } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import './TeamDetailPage.css'

/**
 * 团队详情页（框架）
 *
 * 入口：我的团队 →「查看详情」
 * 本页提供「创建项目」路由跳转（个人中心也有同入口）
 *
 * TODO[后端联调]:
 * - GET /teams/:id 团队信息、成员、项目列表
 * - 邀请成员、角色管理等业务不要在本阶段实现
 */
export function TeamDetailPage() {
  const { teamId = 'demo-team' } = useParams<{ teamId: string }>()

  return (
    <div className="team-detail">
      <Link to={PATHS.MY_TEAMS} className="team-detail__back">
        ← 返回我的团队
      </Link>

      <header className="team-detail__header">
        <div>
          <h1>团队详情</h1>
          <p>
            teamId: <code>{teamId}</code>
          </p>
        </div>

        {/* 创建项目 —— 路由框架入口（要求保留） */}
        <Link to={PATHS.createProject(teamId)} className="team-detail__create-project">
          + 创建项目
        </Link>
      </header>

      {/*
        TODO: 下方填充
        - 团队简介 / 成员列表
        - 项目列表（点击进入项目详情）
        - 邀请码等
        当前阶段仅留壳，不写业务
      */}
      <div className="team-detail__shell">
        <p>团队详情内容区（框架占位）</p>
        <p className="team-detail__hint">后续在此展示项目列表、成员等；创建项目请用右上角按钮。</p>
      </div>
    </div>
  )
}
