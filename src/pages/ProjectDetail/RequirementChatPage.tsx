import { useParams } from 'react-router-dom'
import { Layout, Button, Input, Space, Typography, theme } from 'antd'
import {
  PlusOutlined,
  MoreOutlined,
  PaperClipOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { getRequirement } from './requirements'

const { Title, Text } = Typography

/**
 * 需求群聊 IM —— Ant Design 布局外壳
 */
export function RequirementChatPage() {
  const { token } = theme.useToken()
  const { projectId, reqId } = useParams<{ projectId: string; reqId: string }>()
  const req = getRequirement(reqId)

  return (
    <Layout style={{ height: '100%', background: token.colorBgBase }}>
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
            <Text type="success">#</Text> {req.title}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            需求群聊 · {req.ref}
            {projectId ? ` · project:${projectId}` : null}
          </Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} disabled>
            触发任务
          </Button>
          <Button type="text" icon={<MoreOutlined />} disabled />
        </Space>
      </div>

      <Layout.Content
        style={{ flex: 1, background: token.colorBgBase }}
        aria-label={`对话内容-${req.id}（待填充）`}
      />

      <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${token.colorBorder}` }}>
        <Space style={{ marginBottom: 8 }}>
          <Button size="small" disabled>
            @
          </Button>
          <Button type="text" icon={<PaperClipOutlined />} disabled size="small" />
          <Button type="text" icon={<CodeOutlined />} disabled size="small" />
        </Space>
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            placeholder={`在「${req.title}」需求群发送消息，@Agent 可派发任务…`}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled
            style={{ flex: 1 }}
          />
          <Button type="primary" disabled>
            发送
          </Button>
        </Space.Compact>
      </div>
    </Layout>
  )
}
