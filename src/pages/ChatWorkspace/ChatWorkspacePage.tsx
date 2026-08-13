import { Link } from 'react-router-dom'
import { Layout, Input, Button, List, Avatar, Typography, Space, Badge, theme } from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  TeamOutlined,
  MoreOutlined,
  SmileOutlined,
  PaperClipOutlined,
  PictureOutlined,
  CodeOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import { useAppUiStore } from '@/store/appUiStore'

const { Sider, Content } = Layout
const { Title, Text } = Typography

const PINNED_SESSIONS = [
  {
    id: '1',
    title: '电商后台重构项目',
    preview: 'Agent 已完成接口文档生成',
    time: '12:30',
    color: '#3b82f6',
    active: true,
  },
]

const RECENT_SESSIONS = [
  {
    id: '2',
    title: '移动端 H5 适配',
    preview: '你: 帮我看一下兼容性…',
    time: '昨天',
    color: '#22c55e',
  },
  {
    id: '3',
    title: 'CRM 数据迁移',
    preview: '张工: 今晚一起 review',
    time: '上周',
    color: '#f97316',
  },
]

function SessionItem({
  session,
}: {
  session: (typeof PINNED_SESSIONS)[0] | (typeof RECENT_SESSIONS)[0]
}) {
  const active = 'active' in session && session.active

  return (
    <List.Item
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        background: active ? 'rgba(34, 197, 94, 0.12)' : undefined,
        borderRadius: 8,
        border: 'none',
      }}
    >
      <List.Item.Meta
        avatar={
          <Avatar style={{ background: session.color }} icon={<TeamOutlined />} size={36} />
        }
        title={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong ellipsis style={{ maxWidth: 140 }}>
              {session.title}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {session.time}
            </Text>
          </Space>
        }
        description={
          <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
            {session.preview}
          </Text>
        }
      />
    </List.Item>
  )
}

/**
 * 项目群聊工作台 —— Ant Design Layout + List
 */
export function ChatWorkspacePage() {
  const { token } = theme.useToken()
  const openProjectDetailNav = useAppUiStore((s) => s.openProjectDetailNav)

  /** 演示用项目 id；联调后改为当前会话对应的真实 projectId */
  const demoProjectId = 'demo-project'

  return (
    <Layout style={{ height: 'calc(100vh - 56px)', background: token.colorBgBase }}>
      <Sider
        width={280}
        theme="dark"
        style={{
          borderRight: `1px solid ${token.colorBorder}`,
          background: token.colorBgContainer,
          overflow: 'auto',
        }}
      >
        <div style={{ padding: 12 }}>
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input prefix={<SearchOutlined />} placeholder="搜索会话" disabled style={{ flex: 1 }} />
            <Button icon={<PlusOutlined />} disabled />
          </Space.Compact>

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            置顶会话
          </Text>
          <List
            dataSource={PINNED_SESSIONS}
            renderItem={(s) => <SessionItem key={s.id} session={s} />}
            split={false}
            style={{ marginBottom: 16 }}
          />

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            最近会话
          </Text>
          <List
            dataSource={RECENT_SESSIONS}
            renderItem={(s) => <SessionItem key={s.id} session={s} />}
            split={false}
          />
        </div>
      </Sider>

      <Layout style={{ background: token.colorBgBase }}>
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${token.colorBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <Title level={5} style={{ margin: 0 }}>
              电商后台重构项目
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              成员：你、张工、AI开发助手、代码审查Agent
            </Text>
          </div>
          <Space>
            <Button type="text" icon={<MoreOutlined />} disabled />
            <Link
              to={PATHS.projectReqChat(demoProjectId, 'login')}
              onClick={() => openProjectDetailNav(demoProjectId)}
            >
              <Button type="primary">进入项目详情</Button>
            </Link>
          </Space>
        </div>

        <Content
          style={{ flex: 1, background: token.colorBgBase }}
          aria-label="消息区域（待填充）"
        />

        <div
          style={{
            padding: '12px 20px 16px',
            borderTop: `1px solid ${token.colorBorder}`,
          }}
        >
          <Space style={{ marginBottom: 8 }}>
            <Button type="text" icon={<SmileOutlined />} disabled size="small" />
            <Button type="text" icon={<PaperClipOutlined />} disabled size="small" />
            <Button type="text" icon={<PictureOutlined />} disabled size="small" />
            <Button type="text" icon={<CodeOutlined />} disabled size="small" />
            <Badge count="@">
              <Button size="small" disabled>
                提及
              </Button>
            </Badge>
          </Space>
          <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea
              placeholder="输入消息, Shift+Enter换行..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled
              style={{ flex: 1 }}
            />
            <Button type="primary" icon={<SendOutlined />} disabled />
          </Space.Compact>
        </div>
      </Layout>
    </Layout>
  )
}
