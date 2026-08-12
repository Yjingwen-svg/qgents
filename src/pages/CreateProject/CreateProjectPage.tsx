import { Link, useNavigate, useParams } from 'react-router-dom'
import { Typography, Button, Card, Form, Input, Space } from 'antd'
import { ArrowLeftOutlined, GithubOutlined } from '@ant-design/icons'
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

          {/* 原「Git 仓库」URL 输入已移除；改为跳转团队已授权仓库列表 */}
          <Form.Item label="GitHub 仓库">
            <Button
              icon={<GithubOutlined />}
              onClick={() => navigate(PATHS.teamAuthorizedRepos(teamId))}
            >
              绑定github仓库
            </Button>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              将跳转到该团队已授权的所有 GitHub 仓库列表（含默认分支、同步状态、授权账号）
            </Paragraph>
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
