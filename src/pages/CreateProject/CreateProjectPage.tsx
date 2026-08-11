import { Link, useNavigate, useParams } from 'react-router-dom'
import { Typography, Button, Card, Form, Input, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import { projectApi } from '@/api'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

export function CreateProjectPage() {
  const { teamId = 'demo-team' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  function handleSubmit() {
    void projectApi
    navigate(PATHS.teamDetail(teamId))
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link to={PATHS.teamDetail(teamId)}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回团队详情
        </Button>
      </Link>

      <Title level={2}>创建项目</Title>
      <Paragraph type="secondary">
        所属团队 teamId: <Text code>{teamId}</Text>
      </Paragraph>

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="项目名称 *" name="name">
            <Input placeholder="例如：Qgents Web" disabled />
          </Form.Item>
          <Form.Item label="项目简介" name="description">
            <TextArea placeholder="描述项目用途（待实现）" rows={3} disabled />
          </Form.Item>
          <Form.Item label="Git 仓库" name="gitRepo">
            <Input placeholder="已有仓库 URL，或留空由平台自动创建（待实现）" disabled />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Link to={PATHS.teamDetail(teamId)}>
                <Button>取消</Button>
              </Link>
              <Button type="primary" htmlType="submit">
                创建项目
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
