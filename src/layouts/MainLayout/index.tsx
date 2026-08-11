import { Outlet } from 'react-router-dom'
import { Banner } from './Banner'
import { PersonalCenter } from './PersonalCenter'
import './MainLayout.css'

/**
 * 主应用布局：顶部 Banner + 内容区 + 个人中心抽屉
 */
export function MainLayout() {
  return (
    <div className="qg-main-layout">
      <Banner />
      <main className="qg-main-layout__content">
        <Outlet />
      </main>
      {/* 点击头像打开；不含「当前空间」「账号设置」 */}
      <PersonalCenter />
    </div>
  )
}
