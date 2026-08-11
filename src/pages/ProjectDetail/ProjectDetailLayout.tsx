import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Layout, Menu, Typography, Badge, theme } from 'antd'
import type { MenuProps } from 'antd'
import {
  HomeOutlined,
  MessageOutlined,
  UnorderedListOutlined,
  ApartmentOutlined,
  RobotOutlined,
  StarOutlined,
  DatabaseOutlined,
  CodeOutlined,
  ExperimentOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { PATHS, PROJECT_NAV } from '@/routes/paths'
import { PROJECT_REQUIREMENTS } from './requirements'
import './ProjectDetailLayout.scss'

const { Sider, Content } = Layout
const { Text } = Typography

const NAV_ICONS: Record<string, React.ReactNode> = {
  overview: <HomeOutlined />,
  'req-chat': <MessageOutlined />,
  tasks: <UnorderedListOutlined />,
  workflow: <ApartmentOutlined />,
  agents: <RobotOutlined />,
  skills: <StarOutlined />,
  memory: <DatabaseOutlined />,
  code: <CodeOutlined />,
  testset: <ExperimentOutlined />,
  members: <TeamOutlined />,
  settings: <SettingOutlined />,
}

export function ProjectDetailLayout() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { projectId = 'demo-project', reqId } = useParams<{ projectId: string; reqId?: string }>()
  const location = useLocation()
  const onReqChat = location.pathname.includes('/req-chat')
  const projectName = resolveProjectName(projectId)

  const navItems: MenuProps['items'] = PROJECT_NAV.map((item) => ({
    key: item.path,
    icon: NAV_ICONS[item.path],
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {item.label}
        {'badge' in item && item.badge != null ? (
          <Badge count={item.badge} size="small" />
        ) : null}
      </span>
    ),
  }))

  const selectedNavKey =
    PROJECT_NAV.find((item) => {
      if (item.path === 'req-chat') return onReqChat
      return location.pathname.includes(`/projects/${projectId}/${item.path}`)
    })?.path ?? 'overview'

  function handleNavClick({ key }: { key: string }) {
    const item = PROJECT_NAV.find((n) => n.path === key)
    if (item) navigate(item.to(projectId))
  }

  return (
    <Layout style={{ height: 'calc(100vh - 56px)', background: token.colorBgBase }}>
      <Sider
        width={240}
        theme="dark"
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '16px 16px 8px' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            当前项目
          </Text>
          <div>
            <Text strong ellipsis title={projectName}>
              {projectName}
            </Text>
          </div>
        </div>

        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedNavKey]}
          items={navItems}
          onClick={handleNavClick}
          style={{ background: 'transparent', border: 'none' }}
        />

        <div style={{ padding: '8px 12px 16px' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8, paddingLeft: 4 }}>
            需求
          </Text>

          {/* 需求列表不用 Menu：多行 label + NavLink 会导致选中高亮块错位 */}
          <div className="pd-req-list">
            {PROJECT_REQUIREMENTS.map((r) => (
              <NavLink
                key={r.id}
                to={PATHS.projectReqChat(projectId, r.id)}
                className={() =>
                  `pd-req-item${onReqChat && reqId === r.id ? ' is-active' : ''}`
                }
              >
                <span className="pd-req-item__title"># {r.title}</span>
                <span className="pd-req-item__ref">{r.ref}</span>
              </NavLink>
            ))}
          </div>

          <div
            style={{
              margin: '8px 4px 0',
              padding: '10px 12px',
              border: `1px dashed ${token.colorBorder}`,
              borderRadius: 8,
              textAlign: 'center',
              color: token.colorTextSecondary,
              fontSize: 12,
            }}
          >
            + 新建需求群
          </div>
        </div>
      </Sider>

      <Content style={{ overflow: 'auto', background: token.colorBgBase }}>
        <Outlet />
      </Content>
    </Layout>
  )
}

function resolveProjectName(projectId: string) {
  const DEMO_NAMES: Record<string, string> = {
    'demo-project': '电商后台重构项目',
    'proj-qgents': 'Qgents',
    'proj-pet': '宠影记',
    'proj-ai': 'AI 决策系统',
    'proj-campus': '校园助手',
  }
  return DEMO_NAMES[projectId] ?? projectId
}
