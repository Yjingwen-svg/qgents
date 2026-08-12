import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout, Button, Input, Space, Typography, theme, Empty } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { groupApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import type { Message, TextMessageContent, CodeMessageContent } from '@/types'
import './ProjectDetailLayout.scss'

const { Text } = Typography

/**
 * 需求群聊 IM —— 消息列表 + 发送
 *
 * 本轮范围：文本（TEXT）与代码块（CODE）消息渲染，支持发送文本。
 * 图片/文件/Diff/任务状态卡片渲染留待后续批次。
 */
export function RequirementChatPage() {
  const { token } = theme.useToken()
  const { projectId = '', groupId = '' } = useParams<{ projectId: string; groupId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const group = groups.find((g) => g.id === groupId)

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['groups', projectId, groupId, 'messages'],
    queryFn: () => groupApi.listMessages(projectId, groupId),
    enabled: !!projectId && !!groupId,
  })
  const messages = page?.data ?? []

  // 新消息自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    try {
      await groupApi.sendMessage(projectId, groupId, {
        type: 'TEXT',
        content: { text },
        clientMessageId: `cmsg_${Date.now()}`,
      })
      setDraft('')
      // 发送成功后重新拉取消息列表
      await queryClient.invalidateQueries({
        queryKey: ['groups', projectId, groupId, 'messages'],
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Layout style={{ height: '100%', background: token.colorBgBase }}>
      {/* 顶部：群标题 */}
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
          <Text strong style={{ fontSize: 16 }}>
            <Text type="success">#</Text> {group?.title ?? '群聊'}
          </Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {group?.type === 'PROJECT_MAIN' ? '项目总群' : '需求群'}
              {group?.memberCount ? ` · ${group.memberCount} 人` : ''}
            </Text>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <Layout.Content
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          background: token.colorBgBase,
        }}
        aria-label="对话内容"
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">加载中…</Text>
          </div>
        ) : isError ? (
          <Empty description="消息加载失败" />
        ) : messages.length === 0 ? (
          <Empty description="还没有消息，来说点什么吧" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} isSelf={m.senderId === user?.id} />
            ))}
          </div>
        )}
      </Layout.Content>

      {/* 底部输入区 */}
      <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${token.colorBorder}` }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            placeholder="输入消息，回车发送…"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={!draft.trim()}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </Layout>
  )
}

/** 单条消息气泡 —— 区分 USER / AGENT / SYSTEM */
function MessageBubble({ message, isSelf }: { message: Message; isSelf: boolean }) {
  const { token } = theme.useToken()

  // SYSTEM 消息居中弱化展示
  if (message.senderType === 'SYSTEM') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {renderContent(message)}
        </Text>
      </div>
    )
  }

  const alignSelf = isSelf ? 'flex-end' : 'flex-start'
  const bubbleBg = isSelf ? token.colorPrimary : token.colorBgContainer
  const bubbleColor = isSelf ? '#fff' : token.colorText
  const bubbleBorder = isSelf ? 'none' : `1px solid ${token.colorBorder}`
  const isCode = message.type === 'CODE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: alignSelf, maxWidth: '78%', alignSelf }}>
      <div style={{ marginBottom: 2, fontSize: 12 }}>
        <Text type="secondary">
          {message.senderType === 'AGENT' ? '🤖 ' : ''}
          {message.senderName ?? (message.senderType === 'AGENT' ? 'Agent' : '成员')}
        </Text>
      </div>
      <div
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          background: isCode ? (isSelf ? token.colorPrimary : '#1e293b') : bubbleBg,
          color: isCode && !isSelf ? '#e6edf3' : bubbleColor,
          border: isCode ? 'none' : bubbleBorder,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: isCode ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          fontSize: isCode ? 13 : undefined,
        }}
      >
        {renderContent(message)}
      </div>
    </div>
  )
}

/** 按消息类型渲染 content */
function renderContent(message: Message): string {
  if (message.type === 'CODE') {
    const c = message.content as CodeMessageContent
    return c.code ?? ''
  }
  const c = message.content as TextMessageContent
  return c.text ?? ''
}
