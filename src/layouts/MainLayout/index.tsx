import { Outlet, useLocation } from 'react-router-dom'
import { Layout } from 'antd'
import { Banner } from './Banner'
import { PersonalCenter } from './PersonalCenter'
import { PersonalCenterProvider } from '@/context/PersonalCenterContext'
import { PATHS } from '@/routes/paths'

const { Content } = Layout

/**
 * 主应用布局：Ant Design Layout + Banner + 内容区 + 个人中心 Drawer
 */
export function MainLayout() {
  const location = useLocation()
  const isChat = location.pathname.startsWith(PATHS.CHAT)
  const isProject = location.pathname.startsWith('/app/projects/')

  return (
    <PersonalCenterProvider>
      <Layout className="qg-full-height" style={{ minHeight: '100%' }}>
        <Banner />
        <Content
          className={isChat || isProject ? 'qg-content-flush' : undefined}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isChat || isProject ? 0 : 24,
          }}
        >
          <Outlet />
        </Content>
        <PersonalCenter />
      </Layout>
    </PersonalCenterProvider>
  )
}
