import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Typography, Button, Card, Form, Input, Empty } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'

const { Title, Paragraph } = Typography

export function JoinTeamPage() {
  const navigate = useNavigate()
  const { setHasTeam } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  async function handleSubmit(_values: { inviteCode: string }) {
    setSubmitting(true)
    try {
      void teamApi
      setHasTeam(true)
      navigate(PATHS.MY_TEAMS, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Link to={PATHS.MY_TEAMS}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回我的团队
        </Button>
      </Link>

      <Title level={2}>加入已有团队</Title>
      <Paragraph type="secondary">填写邀请码加入，或处理别人发送给你的团队邀请</Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="邀请码"
            name="inviteCode"
            rules={[{ required: true, message: '请输入邀请码' }]}
          >
            <Input placeholder="粘贴团队邀请码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting} block>
              加入团队
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="待处理邀请">
        <Empty description="暂无待处理邀请（接口联调后在此渲染）" />
      </Card>
    </div>
  )
}
