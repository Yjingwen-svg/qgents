import { Link, useNavigate } from 'react-router-dom'
import {
  Drawer,
  Avatar,
  Typography,
  Input,
  Button,
  Space,
  Divider,
  List,
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
import { PATHS } from '@/routes/paths'

const { Title, Text } = Typography

/** 列表占位数据 —— 仅撑起 UI 结构，联调后删除 */
const DEMO_TEAM_TREE = [
  {
    id: 'team-xinghe',
    name: '星河工作室',
    projects: [
      { id: 'proj-qgents', name: 'Qgents', role: 'Maintainer' },
      { id: 'proj-pet', name: '宠影记', role: 'Developer' },
    ],
  },
  {
    id: 'team-gdut',
    name: '广工创新团队',
    projects: [
      { id: 'proj-ai', name: 'AI 决策系统', role: 'Developer' },
      { id: 'proj-campus', name: '校园助手', role: 'Developer' },
    ],
  },
  {
    id: 'team-lab',
    name: '个人实验室',
    projects: [] as { id: string; name: string; role: string }[],
  },
]

const DEFAULT_TEAM_FOR_CREATE_PROJECT = 'team-xinghe'

/**
 * 个人中心 —— Ant Design Drawer
 * 明确不包含「当前空间」「账号设置」
 */
export function PersonalCenter() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { user, logout } = useAuth()
  const { open, closePersonalCenter } = usePersonalCenter()

  const name = user?.displayName ?? '用户'
  const email = user?.email ?? '—'
  const avatarChar = user?.avatarChar ?? name.slice(0, 1)

  function handleLogout() {
    logout()
    closePersonalCenter()
    navigate(PATHS.LOGIN, { replace: true })
  }

  function handleNav(to: string) {
    closePersonalCenter()
    navigate(to)
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

      <Input.Search placeholder="搜索团队或项目" disabled style={{ marginBottom: 16 }} />

      <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16 }}>
        {DEMO_TEAM_TREE.map((team) => (
          <div key={team.id} style={{ marginBottom: 12 }}>
            <Space size={6} style={{ marginBottom: 6 }}>
              <TeamOutlined style={{ color: token.colorTextSecondary }} />
              <Text strong>{team.name}</Text>
            </Space>
            {team.projects.length > 0 && (
              <List
                size="small"
                dataSource={team.projects}
                renderItem={(p) => (
                  <List.Item style={{ padding: '4px 0 4px 20px', border: 'none' }}>
                    <Button
                      type="link"
                      style={{ padding: 0, height: 'auto' }}
                      onClick={() => handleNav(PATHS.projectReqChat(p.id, 'login'))}
                    >
                      <Space>
                        <span>{p.name}</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {p.role}
                        </Text>
                      </Space>
                    </Button>
                  </List.Item>
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      <Space orientation="vertical" style={{ width: '100%' }} size={8}>
        <Link to={PATHS.CREATE_TEAM} onClick={closePersonalCenter}>
          <Button block icon={<FileAddOutlined />}>
            创建团队
          </Button>
        </Link>
        <Link to={PATHS.createProject(DEFAULT_TEAM_FOR_CREATE_PROJECT)} onClick={closePersonalCenter}>
          <Button block icon={<FolderAddOutlined />}>
            创建项目
          </Button>
        </Link>
        <Button block danger icon={<LogoutOutlined />} onClick={handleLogout}>
          退出登录
        </Button>
      </Space>
    </Drawer>
  )
}
