import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout, Button, Input, Space, Typography, theme, Empty, Image, Tag } from 'antd'
import {
  SendOutlined,
  ThunderboltOutlined,
  FileOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { groupApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { TaskTriggerModal } from '@/components/task-domain'
import { PATHS } from '@/routes/paths'
import type {
  Message,
  GroupMember,
  TextMessageContent,
  CodeMessageContent,
  ImageMessageContent,
  FileMessageContent,
  QuoteMessageContent,
  DiffMessageContent,
  TaskStatusMessageContent,
} from '@/types'

const { Text } = Typography

/**
 * 群聊聊天面板 —— 消息列表（含时间分隔线）+ @提及 + 发送 + 发起任务入口。
 * 供项目详情（RequirementChatPage）与「项目群聊」工作台（ChatWorkspacePage）复用。
 */
export function ChatPanel({ projectId, groupId }: { projectId: string; groupId: string }) {
  const { token } = theme.useToken()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [triggerOpen, setTriggerOpen] = useState(false)
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
  const currentUserId = user?.id
  const userMembers = members.filter((m) => m.memberType === 'USER')
  const agentMembers = members.filter((m) => m.memberType === 'AGENT')
  // 过滤掉自己的用户（Agent 保留，因为没有"自己"）
  const otherUserMembers = userMembers.filter((m) => m.id !== currentUserId)

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
        {/* @Agent 发起任务入口 —— 打开 B 的 TaskTriggerModal */}
        <Button
          type="primary"
          ghost
          icon={<ThunderboltOutlined />}
          onClick={() => setTriggerOpen(true)}
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
            {messages.flatMap((m, i) => {
              const prev = i > 0 ? messages[i - 1] : null
              const nodes: React.ReactNode[] = []
              if (shouldShowTimeDivider(prev?.createdAt ?? null, m.createdAt)) {
                nodes.push(
                  <div key={`divider-${m.id}`} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>
                      {formatTimeDivider(m.createdAt)}
                    </Text>
                  </div>,
                )
              }
              nodes.push(
                <MessageBubble
                  key={m.id}
                  message={m}
                  isSelf={m.senderId === user?.id}
                  projectId={projectId}
                />,
              )
              return nodes
            })}
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
            {otherUserMembers.length > 0 && (
              <MentionGroup label="成员" members={otherUserMembers} onPick={pickMention} />
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

      {/* @Agent 发起任务弹窗（B 的 TaskTriggerModal） */}
      <TaskTriggerModal
        open={triggerOpen}
        projectId={projectId}
        groupId={groupId}
        initialInstruction=""
        onClose={() => setTriggerOpen(false)}
      />
    </Layout>
  )
}

/** 判断是否需要在相邻两条消息之间插入时间分隔线 */
function shouldShowTimeDivider(prevIso: string | null, currIso: string): boolean {
  if (!prevIso) return true
  const prev = new Date(prevIso).getTime()
  const curr = new Date(currIso).getTime()
  if (Number.isNaN(prev) || Number.isNaN(curr)) return false
  if (curr - prev > 5 * 60 * 1000) return true
  const pd = new Date(prev)
  const cd = new Date(curr)
  return (
    pd.getFullYear() !== cd.getFullYear() ||
    pd.getMonth() !== cd.getMonth() ||
    pd.getDate() !== cd.getDate()
  )
}

/** 时间分隔线文案：今天 HH:mm / 昨天 HH:mm / M月D日 HH:mm */
function formatTimeDivider(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return hhmm
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `昨天 ${hhmm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm}`
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

/** 单条消息气泡 —— 区分 USER / AGENT / SYSTEM，按类型渲染 IMAGE/FILE/QUOTE/DIFF/TASK_STATUS */
function MessageBubble({
  message,
  isSelf,
  projectId,
}: {
  message: Message
  isSelf: boolean
  projectId: string
}) {
  const { token } = theme.useToken()

  // SYSTEM 消息居中弱化展示
  if (message.senderType === 'SYSTEM') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {renderContent(message, projectId)}
        </Text>
      </div>
    )
  }

  const alignSelf = isSelf ? 'flex-end' : 'flex-start'
  const bubbleBg = isSelf ? token.colorPrimary : token.colorBgContainer
  const bubbleColor = isSelf ? '#fff' : token.colorText
  const bubbleBorder = isSelf ? 'none' : `1px solid ${token.colorBorder}`
  const isCode = message.type === 'CODE'
  // 图片消息：气泡不设 padding/背景，直接展示图片本体
  const isImage = message.type === 'IMAGE'

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
          padding: isImage ? 0 : '8px 12px',
          borderRadius: 10,
          background: isImage ? 'transparent' : isCode ? (isSelf ? token.colorPrimary : '#1e293b') : bubbleBg,
          color: isCode && !isSelf ? '#e6edf3' : bubbleColor,
          border: isImage ? 'none' : isCode ? 'none' : bubbleBorder,
          whiteSpace: isCode ? 'pre-wrap' : 'normal',
          wordBreak: 'break-word',
          fontFamily: isCode ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          fontSize: isCode ? 13 : undefined,
          overflow: 'hidden',
        }}
      >
        {renderContent(message, projectId)}
      </div>
    </div>
  )
}

/** 按消息类型渲染 content */
function renderContent(message: Message, projectId: string): React.ReactNode {
  switch (message.type) {
    case 'CODE': {
      const c = message.content as CodeMessageContent
      return c.code ?? ''
    }
    case 'IMAGE': {
      const c = message.content as ImageMessageContent
      return (
        <Image
          src={c.url}
          width={c.width ?? '100%'}
          height={c.height}
          style={{ borderRadius: 10, display: 'block' }}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect width='100%25' height='100%25' fill='%231c2128'/%3E%3C/svg%3E"
        />
      )
    }
    case 'FILE': {
      const c = message.content as FileMessageContent
      return (
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}
        >
          <FileOutlined style={{ fontSize: 24, color: '#3b82f6' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{c.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatFileSize(c.size)}
            </Text>
          </div>
        </a>
      )
    }
    case 'QUOTE': {
      const c = message.content as QuoteMessageContent
      return (
        <div
          style={{
            borderLeft: '3px solid #3b82f6',
            paddingLeft: 10,
            marginBottom: 6,
            opacity: 0.85,
          }}
        >
          {c.quotedSenderName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {c.quotedSenderName}
            </Text>
          )}
          <div style={{ fontSize: 13 }}>{c.quotedText}</div>
        </div>
      )
    }
    case 'DIFF': {
      const c = message.content as DiffMessageContent
      return (
        <Link
          to={PATHS.projectDiff(projectId, c.diffId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'inherit',
            textDecoration: 'none',
            padding: '8px 10px',
            border: '1px solid',
            borderColor: 'rgba(59, 130, 246, 0.35)',
            borderRadius: 8,
            background: 'rgba(59, 130, 246, 0.06)',
          }}
        >
          <BranchesOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title ?? '代码交付'}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {c.additions != null || c.deletions != null ? (
                <>
                  <span style={{ color: '#16a34a' }}>+{c.additions ?? 0}</span>{' '}
                  <span style={{ color: '#dc2626' }}>-{c.deletions ?? 0}</span>
                </>
              ) : (
                '点击查看 Diff'
              )}
            </Text>
          </div>
        </Link>
      )
    }
    case 'TASK_STATUS': {
      const c = message.content as TaskStatusMessageContent
      return (
        <Link
          to={PATHS.projectTaskDetail(projectId, c.taskId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'inherit',
            textDecoration: 'none',
            padding: '8px 10px',
            border: '1px solid',
            borderColor: 'rgba(13, 155, 138, 0.35)',
            borderRadius: 8,
            background: 'rgba(13, 155, 138, 0.06)',
          }}
        >
          <CheckCircleOutlined style={{ fontSize: 18, color: '#0d9b8a' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {c.node ? `${c.node} · ` : ''}任务状态更新
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {c.message ?? c.status}
            </Text>
          </div>
          <Tag color={taskStatusColor(c.status)} style={{ margin: 0 }}>
            {c.status}
          </Tag>
        </Link>
      )
    }
    default: {
      const c = message.content as TextMessageContent
      return c.text ?? ''
    }
  }
}

/** 文件大小格式化（字节 → 可读） */
function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** 任务状态 → 卡片 tag 颜色 */
function taskStatusColor(status: string): string {
  const s = status.toUpperCase()
  if (s === 'SUCCEEDED' || s === 'COMPLETED') return 'green'
  if (s === 'FAILED' || s === 'CANCELLED') return 'red'
  if (s === 'RUNNING' || s === 'IN_PROGRESS') return 'blue'
  return 'default'
}
