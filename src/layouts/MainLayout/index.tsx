import { Outlet } from 'react-router-dom'
import { Banner } from './Banner'
import './MainLayout.css'

/**
 * 主应用布局：顶部 Banner + 内容区
 * 团队相关页面挂在此壳下
 */
export function MainLayout() {
  return (
    <div className="qg-main-layout">
      <Banner />
      <main className="qg-main-layout__content">
        <Outlet />
      </main>
    </div>
  )
}
