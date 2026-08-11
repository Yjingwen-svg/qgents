import { Link } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Tag,
  Select,
  Space,
  Empty,
  List,
  Alert,
  Popconfirm,
  theme,
} from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'

/**
 * GitHub 集成页 —— Ant Design Card / List / Tag
 * 对应分工 C §1 + 接口文档 §6
 */

type AuthStatus = 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'EXPIRED'
type SyncStatus = 'SYNCED' | 'SYNCING' | 'FAILED'

interface BoundRepositoryRow {
  id: string
  fullName: string
  githubUrl: string
  boundProjectName: string
  boundProjectId: string
  defaultBranch: string
  syncStatus: SyncStatus
  lastSyncedAt?: string
  syncError?: string
}

const { Title, Paragraph, Text } = Typography

const DEMO_AUTH_STATUS: AuthStatus = 'AUTHORIZED'

const DEMO_INSTALLATION = {
  accountLogin: 'Yjingwen-svg',
  installedAt: '2026-08-01T08:00:00Z',
}

const DEMO_BOUND_REPOS: BoundRepositoryRow[] = [
  {
    id: 'repo-1',
    fullName: 'Yjingwen-svg/qgents-web',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-web',
    boundProjectName: 'Qgents Web',
    boundProjectId: 'proj-qgents',
    defaultBranch: 'main',
    syncStatus: 'SYNCED',
    lastSyncedAt: '2026-08-10T12:30:00Z',
  },
  {
    id: 'repo-2',
    fullName: 'Yjingwen-svg/qgents-server',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-server',
    boundProjectName: 'Qgents 后端',
    boundProjectId: 'proj-server',
    defaultBranch: 'main',
    syncStatus: 'SYNCING',
    lastSyncedAt: '2026-08-10T12:00:00Z',
  },
  {
    id: 'repo-3',
    fullName: 'star-river/pet-app',
    githubUrl: 'https://github.com/star-river/pet-app',
    boundProjectName: '宠影记',
    boundProjectId: 'proj-pet',
    defaultBranch: 'develop',
    syncStatus: 'FAILED',
    lastSyncedAt: '2026-08-09T18:00:00Z',
    syncError: 'GitHub API rate limit exceeded',
  },
]

function authStatusTag(status: AuthStatus) {
  switch (status) {
    case 'AUTHORIZED':
      return <Tag color="success">已授权</Tag>
    case 'NOT_AUTHORIZED':
      return <Tag>未授权</Tag>
    case 'EXPIRED':
      return <Tag color="error">授权已过期</Tag>
  }
}

function syncStatusTag(status: SyncStatus) {
  switch (status) {
    case 'SYNCED':
      return <Tag color="success">已同步</Tag>
    case 'SYNCING':
      return <Tag color="processing">同步中</Tag>
    case 'FAILED':
      return <Tag color="error">同步失败</Tag>
  }
}

export function GitHubIntegrationPage() {
  const { token } = theme.useToken()

  function handleInstallApp() {
    // TODO[后端联调]: POST /teams/{teamId}/integrations/github/installations
  }

  function handleReauthorize() {
    // TODO[后端联调]
  }

  function handleRefreshSync(_repoId: string) {
    // TODO[后端联调]
  }

  function handleChangeDefaultBranch(_repoId: string, _branch: string) {
    // TODO[后端联调]: PATCH defaultBranch
  }

  function handleUnbind(_repoId: string) {
    // TODO[后端联调]: DELETE 解绑
  }

  function handleBindNewRepo() {
    // TODO[后端联调]: 绑定弹窗
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginTop: 0 }}>
          GitHub 集成
        </Title>
        <Paragraph type="secondary">
          团队级 GitHub App 授权与项目仓库绑定。代码操作由服务端受控执行，前端不持有 Git 凭据。
        </Paragraph>
      </header>

      <Card title="GitHub App 安装" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space>
            <Text type="secondary">授权状态</Text>
            {authStatusTag(DEMO_AUTH_STATUS)}
          </Space>

          {DEMO_AUTH_STATUS === 'AUTHORIZED' && (
            <Text type="secondary">
              已安装至账号 <Text strong>{DEMO_INSTALLATION.accountLogin}</Text>
            </Text>
          )}

          {DEMO_AUTH_STATUS === 'EXPIRED' && (
            <Alert type="error" message="授权已过期，请重新授权以继续同步仓库。" showIcon />
          )}

          {DEMO_AUTH_STATUS === 'NOT_AUTHORIZED' ? (
            <Button type="primary" onClick={handleInstallApp}>
              安装 GitHub App
            </Button>
          ) : DEMO_AUTH_STATUS === 'EXPIRED' ? (
            <Button type="primary" onClick={handleReauthorize}>
              重新授权
            </Button>
          ) : (
            <Button onClick={handleInstallApp}>管理 GitHub App 安装</Button>
          )}
        </Space>
      </Card>

      <Card
        title="已授权仓库"
        extra={
          <Button type="primary" size="small" onClick={handleBindNewRepo}>
            绑定仓库到项目
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        {DEMO_BOUND_REPOS.length === 0 ? (
          <Empty description="暂无已绑定仓库">
            <Paragraph type="secondary">安装 GitHub App 后，可将授权仓库绑定到项目。</Paragraph>
          </Empty>
        ) : (
          <List
            dataSource={DEMO_BOUND_REPOS}
            renderItem={(repo) => (
              <List.Item
                key={repo.id}
                style={{
                  display: 'block',
                  padding: '16px 0',
                  borderBottom: `1px solid ${token.colorBorder}`,
                }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                  <div style={{ flex: 1 }}>
                    <Space>
                      <Text strong>{repo.fullName}</Text>
                      <a href={repo.githubUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="text" size="small" icon={<LinkOutlined />} title="在 GitHub 打开" />
                      </a>
                    </Space>

                    <div style={{ marginTop: 8 }}>
                      <Space wrap>
                        <Text type="secondary">
                          绑定项目：
                          <Link to={PATHS.projectDetail(repo.boundProjectId)}>{repo.boundProjectName}</Link>
                        </Text>
                        {syncStatusTag(repo.syncStatus)}
                      </Space>
                    </div>

                    {repo.syncStatus === 'FAILED' && repo.syncError && (
                      <Alert type="error" message={repo.syncError} style={{ marginTop: 8 }} showIcon />
                    )}

                    {repo.lastSyncedAt && (
                      <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                        上次同步：{repo.lastSyncedAt}
                      </Text>
                    )}
                  </div>

                  <Space direction="vertical" align="end">
                    <Space>
                      <Text type="secondary">默认分支</Text>
                      <Select
                        value={repo.defaultBranch}
                        disabled
                        style={{ width: 120 }}
                        onChange={(v) => handleChangeDefaultBranch(repo.id, v)}
                        options={[
                          { value: 'main', label: 'main' },
                          { value: 'develop', label: 'develop' },
                          { value: 'master', label: 'master' },
                        ]}
                      />
                    </Space>
                    <Space>
                      <Button
                        size="small"
                        onClick={() => handleRefreshSync(repo.id)}
                        loading={repo.syncStatus === 'SYNCING'}
                      >
                        {repo.syncStatus === 'SYNCING' ? '同步中…' : '刷新同步'}
                      </Button>
                      <Popconfirm
                        title="确认解除绑定？"
                        description="仅解除 Qgents 与仓库的关联，不会删除 GitHub 仓库。"
                        onConfirm={() => handleUnbind(repo.id)}
                        okText="解除绑定"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" danger>
                          解除绑定
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title="说明" type="inner">
        <ul style={{ margin: 0, paddingLeft: 20, color: token.colorTextSecondary }}>
          <li>GitHub App 授权为<strong>团队级</strong>，绑定仓库为<strong>项目级</strong>（需 PROJECT_ADMIN）。</li>
          <li>解除绑定不会删除 GitHub 仓库，仅解除 Qgents 项目与仓库的关联。</li>
          <li>同步失败时请检查 GitHub App 权限或点击「刷新同步」重试。</li>
          <li>默认分支用于 Agent 创建 MR 时的 targetBranch 等场景。</li>
        </ul>
      </Card>
    </div>
  )
}
