import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Drawer,
  Avatar,
  Typography,
  Button,
  Space,
  Divider,
  theme,
} from 'antd'
import {
  TeamOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { useCurrentTeamId } from '@/store/appUiStore'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { teamApi, projectApi } from '@/api'
import { PATHS } from '@/routes/paths'
import type { Team } from '@/types'

const { Title, Text } = Typography

/**
 * 个人中心 —— Ant Design Drawer
 * 明确不包含「当前空间」「账号设置」
 */
export function PersonalCenter() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { open, closePersonalCenter } = usePersonalCenter()
  const currentTeamId = useCurrentTeamId()
  const [createOpen, setCreateOpen] = useState(false)

  // 真实团队列表（替换原 DEMO_TEAM_TREE 假数据）
  const { data: teams = [] } = useQuery({
    queryKey: ['teams', 'mine'],
    queryFn: teamApi.listMine,
  })

  const name = user?.displayName ?? '用户'
  const email = user?.email ?? '—'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  async function handleLogout() {
    await logout()
    closePersonalCenter()
    navigate(PATHS.LOGIN, { replace: true })
  }

  function handleNav(to: string) {
    closePersonalCenter()
    navigate(to)
  }

  function handleCreateProject() {
    // 未进入任何团队时，先回到团队列表选团队
    if (!currentTeamId) {
      closePersonalCenter()
      navigate(PATHS.MY_TEAMS)
      return
    }
    setCreateOpen(true)
  }

  return (
    <Drawer
      title="个人中心"
      placement="right"
      size={360}
      open={open}
      onClose={closePersonalCenter}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Space align="start" size={12} style={{ marginBottom: 20 }}>
        <Avatar size={48} style={{ background: '#f97316' }}>
          {avatarChar}
        </Avatar>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {name}
          </Title>
          <Text type="secondary">{email}</Text>
        </div>
      </Space>

      <Divider style={{ margin: '16px 0' }} />

      <Title level={5} style={{ marginBottom: 12 }}>
        切换团队或项目
      </Title>

      <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16 }}>
        {teams.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂无团队
          </Text>
        ) : (
          teams.map((team) => <TeamProjectGroup key={team.id} team={team} onNav={handleNav} />)
        )}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      <Space orientation="vertical" style={{ width: '100%' }} size={8}>
        <Link to={PATHS.CREATE_TEAM} onClick={closePersonalCenter}>
          <Button block icon={<FileAddOutlined />}>
            创建团队
          </Button>
        </Link>
        <Button block icon={<FolderAddOutlined />} onClick={handleCreateProject}>
          创建项目
        </Button>
        <Button block danger icon={<LogoutOutlined />} onClick={handleLogout}>
          退出登录
        </Button>
      </Space>

      {currentTeamId && (
        <CreateProjectModal
          teamId={currentTeamId}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </Drawer>
  )
}

/** 团队 + 其下项目列表（真实接口，替换假数据） */
function TeamProjectGroup({
  team,
  onNav,
}: {
  team: Team
  onNav: (to: string) => void
}) {
  const { token } = theme.useToken()
  const { data: projects = [] } = useQuery({
    queryKey: ['teams', team.id, 'projects'],
    queryFn: () => projectApi.listByTeam(team.id),
    enabled: !!team.id,
  })

  return (
    <div style={{ marginBottom: 12 }}>
      <Button
        type="link"
        style={{ padding: 0, height: 'auto', marginBottom: 6 }}
        onClick={() => onNav(PATHS.teamDetail(team.id, team.role === 'TEAM_OWNER'))}
      >
        <Space size={6}>
          <TeamOutlined style={{ color: token.colorTextSecondary }} />
          <Text strong>{team.name}</Text>
        </Space>
      </Button>
      {projects.length > 0 ? (
        projects.map((p) => (
          <div key={p.id} style={{ padding: '4px 0 4px 20px' }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => onNav(PATHS.projectDetail(p.id))}
            >
              <Space>
                <span>{p.name}</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {p.role === 'PROJECT_ADMIN' ? 'Maintainer' : 'Developer'}
                </Text>
              </Space>
            </Button>
          </div>
        ))
      ) : (
        <Text type="secondary" style={{ fontSize: 12, paddingLeft: 20, display: 'block' }}>
          暂无项目
        </Text>
      )}
    </div>
  )
}
