/** IM 消息类型（P0） */
export type MessageType =
  | 'text'
  | 'mention'
  | 'code'
  | 'image'
  | 'file'
  | 'diff_card'
  | 'task_status_card'

export interface ChatSession {
  id: string
  projectId: string
  /** 群名称；P1 可按 git 分支隔离群聊 */
  name: string
  pinned?: boolean
  lastActiveAt?: string
  unreadCount?: number
}

export interface DiffCardPayload {
  diffId: string
  title: string
  summary?: string
  /** 一键应用 Patch / 展开 Diff 所需标识 */
  patchRef?: string
  mrUrl?: string
}

export interface TaskStatusCardPayload {
  taskId: string
  status: string
  title: string
  progressText?: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  type: MessageType
  senderId: string
  /** 真实用户或 Agent */
  senderKind: 'user' | 'agent'
  content: string
  createdAt: string
  replyToId?: string
  mentionIds?: string[]
  diffCard?: DiffCardPayload
  taskStatusCard?: TaskStatusCardPayload
  /** 附件等扩展字段预留 */
  attachments?: unknown[]
}
