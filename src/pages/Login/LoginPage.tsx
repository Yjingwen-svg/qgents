import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Row,
  Col,
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Checkbox,
  Divider,
  Typography,
  Space,
  theme,
} from 'antd'
import {
  MessageOutlined,
  RobotOutlined,
  CodeOutlined,
  GithubOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { authApi } from '@/api'

const { Title, Paragraph, Text } = Typography

type AuthTab = 'login' | 'register'

/**
 * 登录 / 注册页 —— Ant Design Form + Card
 */
export function LoginPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { loginDemo, hasTeam } = useAuth()
  const [tab, setTab] = useState<AuthTab>('login')
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  async function handleSubmit(values: { email?: string; password?: string; remember?: boolean }) {
    setSubmitting(true)
    try {
      void authApi
      void values.remember
      loginDemo({ email: values.email || undefined })
      navigate(hasTeam ? PATHS.MY_TEAMS : PATHS.WELCOME, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  function handleGithubLogin() {
    loginDemo({ displayName: 'GitHub 用户', avatarChar: 'G' })
    navigate(PATHS.WELCOME, { replace: true })
  }

  const features = [
    {
      icon: <MessageOutlined />,
      title: '项目群聊驱动任务',
      desc: '讨论在项目群，@Agent 发起任务，进度实时透明',
    },
    {
      icon: <RobotOutlined />,
      title: '多 Agent 协同执行',
      desc: '多 Agent 协作分工，高效完成复杂任务',
    },
    {
      icon: <CodeOutlined />,
      title: 'Diff 与 MR 可审查交付',
      desc: '以 Diff 形式交付，支持 MR 审查，变更可追溯',
    },
  ]

  return (
    <Row style={{ minHeight: '100vh' }}>
      <Col
        xs={0}
        lg={12}
        style={{
          background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorBgBase} 100%)`,
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Space size={8} style={{ marginBottom: 32 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: token.colorPrimary,
              color: token.colorBgBase,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            Q
          </span>
          <Text strong style={{ color: token.colorPrimary, fontSize: 22 }}>
            gents
          </Text>
        </Space>

        <Title level={2} style={{ marginBottom: 32 }}>
          团队与 Agent, 在同一个项目现场协作
        </Title>

        <Space direction="vertical" size={20} style={{ marginBottom: 40 }}>
          {features.map((f) => (
            <Space key={f.title} align="start" size={12}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: token.colorBgElevated,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorPrimary,
                }}
              >
                {f.icon}
              </span>
              <div>
                <Text strong>{f.title}</Text>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {f.desc}
                </Paragraph>
              </div>
            </Space>
          ))}
        </Space>
      </Col>

      <Col xs={24} lg={12} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 420 }} bordered={false}>
          <Title level={3} style={{ marginTop: 0 }}>
            登录 Qgents
          </Title>
          <Paragraph type="secondary">使用个人账号进入你的团队</Paragraph>

          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as AuthTab)}
            items={[
              { key: 'login', label: '登录' },
              { key: 'register', label: '注册' },
            ]}
            style={{ marginBottom: 16 }}
          />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="email" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="邮箱地址" autoComplete="email" />
            </Form.Item>

            <Form.Item name="password">
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </Form.Item>

            {tab === 'login' && (
              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Form.Item name="remember" valuePropName="checked" noStyle initialValue>
                    <Checkbox>保持登录</Checkbox>
                  </Form.Item>
                  <Button type="link" style={{ padding: 0 }}>
                    忘记密码
                  </Button>
                </Space>
              </Form.Item>
            )}

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                {tab === 'login' ? '登录' : '注册'}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>或</Divider>

          <Button block icon={<GithubOutlined />} onClick={handleGithubLogin}>
            使用 GitHub 登录
          </Button>

          <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
            {tab === 'login' ? (
              <>
                还没有账号？{' '}
                <Button type="link" style={{ padding: 0 }} onClick={() => setTab('register')}>
                  立即注册
                </Button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <Button type="link" style={{ padding: 0 }} onClick={() => setTab('login')}>
                  去登录
                </Button>
              </>
            )}
          </Paragraph>

          <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 8, marginBottom: 0, fontSize: 12 }}>
            登录后可选择或创建团队
          </Paragraph>
        </Card>
      </Col>
    </Row>
  )
}
