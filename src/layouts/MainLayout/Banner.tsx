import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Menu, Button, Badge, Avatar, Space, Typography, theme } from 'antd'
import { HomeOutlined, MessageOutlined, BellOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { useCurrentTeamId } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'

const { Header } = Layout
const { Text } = Typography

/**
 * 顶部 Banner（主应用全局）—— Ant Design Layout.Header
 *
 * 颜色说明：Banner 固定暗色背景，所有文字和图标使用亮色，
 * 不跟随 antd light theme token。
 */
export function Banner() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { openPersonalCenter } = usePersonalCenter()
  const currentTeamId = useCurrentTeamId()
  const name = user?.displayName ?? '用户'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  const selectedKey = location.pathname.startsWith(PATHS.CHAT)
    ? 'chat'
    : location.pathname.startsWith(PATHS.MY_TEAMS) ||
        location.pathname.startsWith('/app/teams') ||
        location.pathname.startsWith('/app/projects')
      ? 'teams'
      : ''

  const LIGHT = 'var(--qg-text-on-dark)'          // #f3f4f6
  const LIGHT_MUTED = 'var(--qg-text-on-dark-secondary)' // #9aa3b5

  return (
    <Header
      className="qg-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: 56,
        lineHeight: '56px',
      }}
    >
      <Space size="large" align="center">
        <NavLink to={PATHS.MY_TEAMS} aria-label="Qgents 首页">
          <Space size={8}>
            <Avatar
              size={28}
              style={{
                background: '#fff',
                color: 'var(--qg-navy)',
                fontWeight: 700,
                boxShadow: '0 0 0 2px var(--qg-mint)',
              }}
            >
              Q
            </Avatar>
            <Text strong style={{ color: 'var(--qg-mint)', fontSize: 18 }}>
              gents
            </Text>
          </Space>
        </NavLink>

        <Menu
          mode="horizontal"
          selectedKeys={selectedKey ? [selectedKey] : []}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: LIGHT_MUTED,
          }}
          onClick={({ key }) => {
            // 「团队首页」：若已进入某个团队则回到该团队详情，否则回到团队列表
            if (key === 'teams') {
              navigate(currentTeamId ? PATHS.teamDetail(currentTeamId) : PATHS.MY_TEAMS)
            }
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
          <Button
            type="text"
            icon={<BellOutlined />}
            aria-label="通知"
            style={{ color: LIGHT }}
          />
        </Badge>

        <Button
          type="text"
          onClick={openPersonalCenter}
          aria-label="打开个人中心"
          style={{ color: LIGHT }}
        >
          <Space size={8}>
            <Text style={{ color: LIGHT }}>{name}</Text>
            <Avatar style={{ background: '#f97316' }}>{avatarChar}</Avatar>
          </Space>
        </Button>
      </Space>
    </Header>
  )
}
