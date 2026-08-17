export type GroupType = 'PROJECT_MAIN' | 'REQUIREMENT'
export type GroupStatus = 'ACTIVE' | 'ARCHIVED'
export type GroupMemberType = 'USER' | 'AGENT'
export type MessageSenderType = 'USER' | 'AGENT' | 'SYSTEM'
export type MessageContentType =
  | 'TEXT'
  | 'CODE'
  | 'IMAGE'
  | 'FILE'
  | 'DIFF'
  | 'TASK_STATUS'
  | 'SYSTEM'
  | 'QUOTE'

/** 列表分页元信息 —— 对齐接口文档 v1.1.8 §2「列表分页」 */
export interface Page<T> {
  data: T[]
  page: {
    nextCursor: string | null
    hasMore: boolean
  }
}

/** 最新消息摘要（会话列表展示用，对齐分工安排「会话列表」GroupListItem.latestMessage） */
export interface MessageSummary {
  senderName?: string
  text: string
  /** 最新消息类型（§7：TEXT/CODE/IMAGE/FILE/SYSTEM/QUOTE/DIFF/TASK_STATUS），用于无文本类型的摘要占位 */
  type?: MessageContentType
}

export interface Group {
  id: string
  projectId: string
  type: GroupType
  title: string
  description?: string
  status: GroupStatus
  /** 创建者 userId（后端 DTO 补充，用于归档权限判断） */
  createdBy?: string
  memberCount?: number
  latestActivityAt?: string
  latestMessage?: MessageSummary
  unreadCount?: number
  isPinned?: boolean
  isArchived?: boolean
}

export interface GroupMember {
  id: string
  displayName: string
  memberType: GroupMemberType
  avatarUrl?: string
}

/** TEXT 消息内容 */
export interface TextMessageContent {
  text: string
}

/** CODE 消息内容 */
export interface CodeMessageContent {
  code: string
  language?: string
}

/** IMAGE 消息内容 */
export interface ImageMessageContent {
  url: string
  width?: number
  height?: number
}

/** FILE 消息内容 */
export interface FileMessageContent {
  url: string
  name: string
  size: number
  mimeType: string
}

/** QUOTE 引用消息内容 */
export interface QuoteMessageContent {
  quotedMessageId: string
  quotedText: string
  quotedSenderName?: string
}

/** DIFF 交付卡片内容 */
export interface DiffMessageContent {
  diffId: string
  title?: string
  additions?: number
  deletions?: number
}

/** TASK_STATUS 任务状态卡片内容 */
export interface TaskStatusMessageContent {
  taskId: string
  status: string
  node?: string
  message?: string
}

/** SYSTEM 系统消息内容 */
export interface SystemMessageContent {
  text: string
}

export interface Message {
  id: string
  groupId: string
  type: MessageContentType
  content: unknown
  senderType: MessageSenderType
  senderId?: string
  /** 发送者显示名（后端联调字段名以 DTO 为准，此处 mock 渲染用） */
  senderName?: string
  sequence?: number
  createdAt: string
  replyToId?: string | null
}

export interface SendMessagePayload {
  type: MessageContentType
  content: unknown
  mentions?: Mention[]
  replyToId?: string | null
  clientMessageId: string
}

/** @ 提及 —— 对象数组，type 区分 USER / AGENT（接口文档 v1.9.3 §7） */
export type MentionType = 'USER' | 'AGENT'
export interface Mention {
  type: MentionType
  id: string
}

export interface MessageTaskSummary {
  id: string
  displayCode: string
  status: string
  missingFields: string[]
}

export interface SendMessageResult {
  message: Message
  task: MessageTaskSummary | null
}

/** 显式触发任务请求体（§7 从消息触发任务）—— 续作引用时不得传 repositoryIds */
export interface TaskTriggerRequest {
  title: string
  requirement?: string
  repositoryIds?: string[]
  baseRef?: string
  deliveryMode?: 'DIFF_FIRST' | 'MR_FIRST'
}

export interface CreateGroupPayload {
  title: string
  description?: string
  repositoryIds?: string[]
  type?: 'REQUIREMENT'
}
