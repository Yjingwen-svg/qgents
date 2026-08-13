import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Button, Badge, Avatar, Space, Typography, theme } from 'antd'
import {
  HomeOutlined,
  MessageOutlined,
  BellOutlined,
  ProjectOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { useAppUiStore } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'

const { Header } = Layout
const { Text } = Typography

type BannerTab = {
  key: 'teams' | 'chat' | 'project'
  label: string
  icon: ReactNode
}

/**
 * 顶部 Banner（主应用全局）—— Ant Design Layout.Header
 *
 * 「项目详情」页签：仅在点击「进入项目详情」后动态出现；
 * 与「团队首页」「项目群聊」并排完整显示文字（不用 Menu 溢出「…」）。
 * 点「团队首页」时清除项目详情页签；点「项目群聊」保留页签（方便再切回）。
 */
export function Banner() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { openPersonalCenter } = usePersonalCenter()
  const projectDetailNav = useAppUiStore((s) => s.projectDetailNav)
  const clearProjectDetailNav = useAppUiStore((s) => s.clearProjectDetailNav)
  const name = user?.displayName ?? '用户'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  const onProjectDetailRoute = location.pathname.startsWith('/app/projects/')

  let selectedKey: BannerTab['key'] | '' = ''
  if (projectDetailNav && onProjectDetailRoute) {
    selectedKey = 'project'
  } else if (location.pathname.startsWith(PATHS.CHAT)) {
    selectedKey = 'chat'
  } else if (
    location.pathname.startsWith(PATHS.MY_TEAMS) ||
    location.pathname.startsWith('/app/teams') ||
    location.pathname.startsWith(PATHS.GITHUB_INTEGRATION)
  ) {
    selectedKey = 'teams'
  }

  const tabs: BannerTab[] = [
    { key: 'teams', label: '团队首页', icon: <HomeOutlined /> },
    { key: 'chat', label: '项目群聊', icon: <MessageOutlined /> },
  ]
  if (projectDetailNav) {
    tabs.push({ key: 'project', label: '项目详情', icon: <ProjectOutlined /> })
  }

  function goTab(key: BannerTab['key']) {
    if (key === 'teams') {
      clearProjectDetailNav()
      navigate(PATHS.MY_TEAMS)
      return
    }
    if (key === 'chat') {
      navigate(PATHS.CHAT)
      return
    }
    if (key === 'project' && projectDetailNav) {
      navigate(PATHS.projectReqChat(projectDetailNav.projectId, 'login'))
    }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, minWidth: 0 }}>
        <NavLink
          to={PATHS.MY_TEAMS}
          aria-label="Qgents 首页"
          onClick={() => clearProjectDetailNav()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <Avatar
            size={28}
            style={{ background: token.colorPrimary, color: '#0d1117', fontWeight: 700 }}
          >
            Q
          </Avatar>
          <Text strong style={{ color: token.colorPrimary, fontSize: 18 }}>
            gents
          </Text>
        </NavLink>

        <nav
          aria-label="主导航"
          style={{ display: 'flex', alignItems: 'stretch', gap: 4, height: 56 }}
        >
          {tabs.map((tab) => {
            const active = selectedKey === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => goTab(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: '100%',
                  padding: '0 14px',
                  border: 'none',
                  borderBottom: active
                    ? `2px solid ${token.colorPrimary}`
                    : '2px solid transparent',
                  background: 'transparent',
                  color: active ? token.colorPrimary : token.colorText,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <Space size={4} align="center">
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} aria-label="通知" />
        </Badge>

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
