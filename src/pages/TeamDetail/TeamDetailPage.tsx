import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Typography, Button, Card, Space } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, GithubOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'

const { Title, Paragraph, Text } = Typography

/**
 * 团队详情
 *
 * 「GitHub 集成」入口：仅从「我创建的团队 → 查看详情」进入时展示（?as=owner）
 * 点击后跳转原 Banner 小猫图标对应页面：/app/integrations/github?teamId=...
 */
export function TeamDetailPage() {
  const { teamId = 'demo-team' } = useParams<{ teamId: string }>()
  const [searchParams] = useSearchParams()
  /** 来自「我创建的团队」时为 true；联调后改为接口返回的 TEAM_OWNER 角色判断 */
  const isTeamOwner = searchParams.get('as') === 'owner'

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link to={PATHS.MY_TEAMS}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回我的团队
        </Button>
      </Link>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 24 }} align="start">
        <div>
          <Title level={2} style={{ marginTop: 0 }}>
            团队详情
          </Title>
          <Paragraph type="secondary">
            teamId: <Text code>{teamId}</Text>
            {!isTeamOwner ? (
              <>
                {' · '}
                <Text type="secondary">参与成员视图</Text>
              </>
            ) : null}
          </Paragraph>
        </div>

        <Space>
          {/* 仅 Owner：GitHub 图标 +「github集成」文字 → 集成页 */}
          {isTeamOwner ? (
            <Link to={PATHS.githubIntegration(teamId)}>
              <Button icon={<GithubOutlined />}>github集成</Button>
            </Link>
          ) : null}

          <Link to={PATHS.createProject(teamId)}>
            <Button type="primary" icon={<PlusOutlined />}>
              创建项目
            </Button>
          </Link>
        </Space>
      </Space>

      <Card>
        <Paragraph>团队详情内容区（框架占位）</Paragraph>
        <Paragraph type="secondary">后续在此展示项目列表、成员等；创建项目请用右上角按钮。</Paragraph>
      </Card>
    </div>
  )
}
