import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout, Button, Input, Space, Typography, theme, Empty } from 'antd'
import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { groupApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import type {
  Message,
  GroupMember,
  TextMessageContent,
  CodeMessageContent,
} from '@/types'
import './ProjectDetailLayout.scss'

const { Text } = Typography

/**
 * 需求群聊 IM —— 消息列表 + @提及 + 发送
 *
 * 本轮范围：文本（TEXT）与代码块（CODE）消息渲染、@成员/@Agent、发起任务入口。
 * 图片/文件/Diff/任务状态卡片渲染留待后续批次。
 */
export function RequirementChatPage() {
  const { token } = theme.useToken()
  const { projectId = '', groupId = '' } = useParams<{ projectId: string; groupId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const group = groups.find((g) => g.id === groupId)

  // 群成员（项目成员 + Agent），用于 @提及
  const { data: members = [] } = useQuery({
    queryKey: ['groups', projectId, groupId, 'members'],
    queryFn: () => groupApi.listMembers(projectId, groupId),
    enabled: !!projectId && !!groupId,
  })
  const userMembers = members.filter((m) => m.memberType === 'USER')
  const agentMembers = members.filter((m) => m.memberType === 'AGENT')

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

  // 输入框以 @ 结尾时弹出成员面板
  const mentionOpen = draft.endsWith('@')

  function pickMention(member: GroupMember) {
    setDraft((prev) => prev + `${member.displayName} `)
    setMentionIds((prev) => [...prev, member.id])
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    try {
      await groupApi.sendMessage(projectId, groupId, {
        type: 'TEXT',
        content: { text },
        mentions: mentionIds.length > 0 ? mentionIds : undefined,
        clientMessageId: `cmsg_${Date.now()}`,
      })
      setDraft('')
      setMentionIds([])
      await queryClient.invalidateQueries({
        queryKey: ['groups', projectId, groupId, 'messages'],
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Layout style={{ height: '100%', background: token.colorBgBase }}>
      {/* 顶部：群标题 + 发起任务入口 */}
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
        {/* @Agent 发起任务入口 —— 跳转到 B 的任务流程（当前为占位页） */}
        <Button
          type="primary"
          ghost
          icon={<ThunderboltOutlined />}
          onClick={() => navigate(PATHS.projectTasks(projectId))}
        >
          发起任务
        </Button>
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
      <div style={{ position: 'relative', padding: '12px 20px 16px', borderTop: `1px solid ${token.colorBorder}` }}>
        {/* @ 提及成员面板 */}
        {mentionOpen && members.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 20,
              right: 20,
              marginBottom: 8,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              maxHeight: 240,
              overflowY: 'auto',
              padding: 6,
              zIndex: 10,
            }}
          >
            {agentMembers.length > 0 && (
              <MentionGroup label="Agent" members={agentMembers} onPick={pickMention} />
            )}
            {userMembers.length > 0 && (
              <MentionGroup label="成员" members={userMembers} onPick={pickMention} />
            )}
          </div>
        )}

        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            placeholder="输入消息，@ 可提及成员或 Agent，回车发送…"
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

/** @ 提及面板分组 */
function MentionGroup({
  label,
  members,
  onPick,
}: {
  label: string
  members: GroupMember[]
  onPick: (m: GroupMember) => void
}) {
  const { token } = theme.useToken()
  return (
    <div style={{ marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 11, padding: '4px 8px', display: 'block' }}>
        {label}
      </Text>
      {members.map((m) => (
        <div
          key={m.id}
          onClick={() => onPick(m)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 8px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.background = token.colorFillSecondary
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
        >
          <Text style={{ fontSize: 13 }}>
            {m.memberType === 'AGENT' ? '🤖 ' : ''}
            {m.displayName}
          </Text>
        </div>
      ))}
    </div>
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
