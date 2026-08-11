import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Menu, Button, Badge, Avatar, Space, Typography, theme } from 'antd'
import {
  HomeOutlined,
  MessageOutlined,
  BellOutlined,
  GithubOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { PATHS } from '@/routes/paths'

const { Header } = Layout
const { Text } = Typography

/**
 * 顶部 Banner（主应用全局）—— Ant Design Layout.Header
 */
export function Banner() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { openPersonalCenter } = usePersonalCenter()
  const name = user?.displayName ?? '用户'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  const selectedKey = location.pathname.startsWith(PATHS.CHAT)
    ? 'chat'
    : location.pathname.startsWith(PATHS.MY_TEAMS) ||
        location.pathname.startsWith('/app/teams') ||
        location.pathname.startsWith('/app/projects')
      ? 'teams'
      : ''

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: `1px solid ${token.colorBorder}`,
        height: 56,
        lineHeight: '56px',
      }}
    >
      <Space size="large" align="center">
        <NavLink to={PATHS.MY_TEAMS} aria-label="Qgents 首页">
          <Space size={8}>
            <Avatar
              size={28}
              style={{ background: token.colorPrimary, color: '#0d1117', fontWeight: 700 }}
            >
              Q
            </Avatar>
            <Text strong style={{ color: token.colorPrimary, fontSize: 18 }}>
              gents
            </Text>
          </Space>
        </NavLink>

        <Menu
          mode="horizontal"
          selectedKeys={selectedKey ? [selectedKey] : []}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent' }}
          onClick={({ key }) => {
            if (key === 'teams') navigate(PATHS.MY_TEAMS)
            if (key === 'chat') navigate(PATHS.CHAT)
          }}
          items={[
            { key: 'teams', icon: <HomeOutlined />, label: '团队首页' },
            { key: 'chat', icon: <MessageOutlined />, label: '项目群聊' },
          ]}
        />
      </Space>

      <Space size={4} align="center">
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} aria-label="通知" />
        </Badge>

        <NavLink to={PATHS.GITHUB_INTEGRATION} aria-label="GitHub 集成" title="GitHub 集成">
          <Button
            type="text"
            icon={<GithubOutlined />}
            aria-label="GitHub 集成"
            style={
              location.pathname === PATHS.GITHUB_INTEGRATION
                ? { color: token.colorPrimary }
                : undefined
            }
          />
        </NavLink>

        <Button type="text" onClick={openPersonalCenter} aria-label="打开个人中心">
          <Space size={8}>
            <Text>{name}</Text>
            <Avatar style={{ background: '#f97316' }}>{avatarChar}</Avatar>
          </Space>
        </Button>
      </Space>
    </Header>
  )
}
