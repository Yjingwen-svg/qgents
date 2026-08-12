import { Link } from 'react-router-dom'
import { Typography, Button, Card, Tag, Row, Col, Avatar, Space, theme } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'

const { Title, Paragraph, Text } = Typography

const DEMO_OWNED = [
  {
    id: 'team-xinghe',
    name: '星河工作室',
    role: 'Maintainer',
    letter: 'X',
    color: '#3b82f6',
    members: 5,
  },
]

const DEMO_JOINED = [
  {
    id: 'team-pet',
    name: '宠影记',
    role: 'Developer',
    letter: 'P',
    color: '#8b5cf6',
    members: 8,
  },
  {
    id: 'team-ai',
    name: 'AI 决策系统',
    role: 'Reviewer',
    letter: 'A',
    color: '#14b8a6',
    members: 6,
  },
]

function TeamCard({
  team,
  asOwner,
}: {
  team: (typeof DEMO_OWNED)[0]
  /** 仅「我创建的团队」为 true → 详情页展示 GitHub 授权 */
  asOwner: boolean
}) {
  const { token } = theme.useToken()

  return (
    <Card hoverable>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Avatar style={{ background: team.color }}>{team.letter}</Avatar>
        <Tag>{team.role}</Tag>
      </Space>
      <Title level={5} style={{ marginTop: 0 }}>
        {team.name}
      </Title>
      <Text type="secondary">{team.members} 位成员</Text>
      <div style={{ marginTop: 12 }}>
        <Link to={PATHS.teamDetail(team.id, asOwner)}>
          <Button type="link" style={{ padding: 0, color: token.colorPrimary }}>
            查看详情
          </Button>
        </Link>
      </div>
    </Card>
  )
}

/**
 * 我的团队 —— Ant Design Card 网格
 */
export function MyTeamsPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Space
        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap' }}
        align="start"
      >
        <div>
          <Title level={2} style={{ marginTop: 0 }}>
            我的团队
          </Title>
          <Paragraph type="secondary">管理你加入的团队，或创建 / 加入新团队</Paragraph>
        </div>
        <Space>
          <Link to={PATHS.JOIN_TEAM}>
            <Button>加入团队</Button>
          </Link>
          <Link to={PATHS.CREATE_TEAM}>
            <Button type="primary" icon={<PlusOutlined />}>
              创建团队
            </Button>
          </Link>
        </Space>
      </Space>

      <Title level={4}>我创建的团队</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {DEMO_OWNED.map((t) => (
          <Col xs={24} sm={12} md={8} key={t.id}>
            <TeamCard team={t} asOwner />
          </Col>
        ))}
        <Col xs={24} sm={12} md={8}>
          <Link to={PATHS.CREATE_TEAM}>
            <Card
              hoverable
              style={{
                height: '100%',
                minHeight: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderStyle: 'dashed',
              }}
            >
              <Space direction="vertical" align="center">
                <PlusOutlined style={{ fontSize: 24 }} />
                <Text>新建团队</Text>
              </Space>
            </Card>
          </Link>
        </Col>
      </Row>

      <Title level={4}>我参与的团队</Title>
      <Row gutter={[16, 16]}>
        {DEMO_JOINED.map((t) => (
          <Col xs={24} sm={12} md={8} key={t.id}>
            <TeamCard team={t} asOwner={false} />
          </Col>
        ))}
      </Row>
    </div>
  )
}
