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

export interface Group {
  id: string
  projectId: string
  type: GroupType
  title: string
  description?: string
  status: GroupStatus
  memberCount?: number
  latestActivityAt?: string
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

export interface Message {
  id: string
  groupId: string
  type: MessageContentType
  content: unknown
  senderType: MessageSenderType
  senderId?: string
  sequence?: number
  createdAt: string
  replyToId?: string | null
}

export interface SendMessagePayload {
  type: MessageContentType
  content: unknown
  mentions?: string[]
  replyToId?: string | null
  clientMessageId: string
}

export interface CreateGroupPayload {
  title: string
  description?: string
  repositoryIds?: string[]
  type?: 'REQUIREMENT'
}
