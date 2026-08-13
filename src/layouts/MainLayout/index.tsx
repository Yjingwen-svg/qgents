import { Outlet, useLocation } from 'react-router-dom'
import { Layout } from 'antd'
import { Banner } from './Banner'
import { PersonalCenter } from './PersonalCenter'
import { PATHS } from '@/routes/paths'

const { Content } = Layout

/**
 * 主应用布局：Ant Design Layout + Banner + 内容区 + 个人中心 Drawer
 * PersonalCenterProvider 已在 AppProviders 中挂载，此处不再重复包裹
 */
export function MainLayout() {
  const location = useLocation()
  const isChat = location.pathname.startsWith(PATHS.CHAT)
  const isProject = location.pathname.startsWith('/app/projects/')

  return (
    <Layout className="qg-full-height" style={{ minHeight: '100%', background: 'var(--qg-navy)' }}>
      <Banner />
      <Content
        className={isChat || isProject ? 'qg-content-flush' : undefined}
        style={{
          flex: 1,
          overflow: 'auto',
          minWidth: 0,
          padding: isChat || isProject ? 0 : 24,
        }}
      >
        <Outlet />
      </Content>
      <PersonalCenter />
    </Layout>
  )
}
