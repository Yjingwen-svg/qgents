import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { Typography, Button, Card, Space } from 'antd'
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'

const { Title, Paragraph, Text } = Typography

export function TeamDetailPage() {
  const { teamId = 'demo-team' } = useParams<{ teamId: string }>()

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
          </Paragraph>
        </div>
        <Link to={PATHS.createProject(teamId)}>
          <Button type="primary" icon={<PlusOutlined />}>
            创建项目
          </Button>
        </Link>
      </Space>

      <Card>
        <Paragraph>团队详情内容区（框架占位）</Paragraph>
        <Paragraph type="secondary">后续在此展示项目列表、成员等；创建项目请用右上角按钮。</Paragraph>
      </Card>
    </div>
  )
}
