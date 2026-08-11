import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Typography,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Upload,
} from 'antd'
import { ArrowLeftOutlined, CameraOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

export function CreateTeamPage() {
  const navigate = useNavigate()
  const { setHasTeam } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  async function handleSubmit(values: {
    name: string
    description?: string
    inviteEmails?: string
    inviteRole?: string
  }) {
    setSubmitting(true)
    try {
      void teamApi
      void values.inviteRole
      setHasTeam(true)
      navigate(PATHS.MY_TEAMS, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link to={PATHS.MY_TEAMS}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回我的团队
        </Button>
      </Link>

      <Title level={2}>创建新团队</Title>

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="团队头像">
            <Upload listType="picture-card" showUploadList={false} disabled>
              <div>
                <CameraOutlined />
                <div style={{ marginTop: 8 }}>上传头像</div>
              </div>
            </Upload>
            <Text type="secondary">支持 JPG / PNG，建议 200×200 方形图片</Text>
          </Form.Item>

          <Form.Item
            label="团队名称"
            name="name"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input placeholder="例如：前端攻坚小组" />
          </Form.Item>

          <Form.Item label="团队简介" name="description">
            <TextArea placeholder="描述团队用途、协作方向" rows={3} />
          </Form.Item>

          <Form.Item label="团队成立时间">
            <Input placeholder="创建完成自动生成日期" disabled />
          </Form.Item>

          <Form.Item label="邀请初始成员 (Github 邮箱)" name="inviteEmails">
            <TextArea placeholder="填入对方邮箱，一行一个；发送邮件邀请加入" rows={4} />
          </Form.Item>

          <Form.Item label="邀请角色" name="inviteRole" initialValue="Developer">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="inviteRole" noStyle initialValue="Developer">
                <Select
                  style={{ width: '40%' }}
                  options={[
                    { value: 'Developer', label: 'Developer' },
                    { value: 'member', label: 'Member' },
                    { value: 'owner', label: 'Owner' },
                  ]}
                />
              </Form.Item>
              <Button type="default" style={{ width: '60%' }} disabled>
                发送邀请
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button onClick={() => navigate(PATHS.MY_TEAMS)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                创建团队
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Paragraph type="secondary" style={{ marginTop: 16 }}>
        TODO[后端联调]: teamApi.create / teamApi.invite
      </Paragraph>
    </div>
  )
}
