import { request, requestPage } from './client'
import type {
  Group,
  GroupMember,
  MarkReadResult,
  Message,
  SendMessageResult,
  SendMessagePayload,
  CreateGroupPayload,
  TaskTriggerRequest,
} from '@/types'

/** 群聊 API —— 对齐接口文档 v1.1.8 §7 */
export const groupApi = {
  listByProject(projectId: string) {
    return request<Group[]>(`/projects/${projectId}/groups`)
  },
  /** 主群聚合（§五）：一次返回当前用户全部可见项目主群，替代 teams→projects→groups 三层串联查询 */
  listMainGroups() {
    return request<Group[]>('/chat/main-groups')
  },
  /** 标记群已读（§三 进群全读）：后端推进已读游标到群最新消息；写操作由 client 自动带 Idempotency-Key */
  markRead(projectId: string, groupId: string) {
    return request<MarkReadResult>(`/projects/${projectId}/groups/${groupId}/read`, { method: 'POST' })
  },
  create(projectId: string, payload: CreateGroupPayload) {
    return request<Group>(`/projects/${projectId}/groups`, { method: 'POST', body: payload })
  },
  getById(projectId: string, groupId: string) {
    return request<Group>(`/projects/${projectId}/groups/${groupId}`)
  },
  listMembers(projectId: string, groupId: string) {
    return request<GroupMember[]>(`/projects/${projectId}/groups/${groupId}/members`)
  },
  /** POST /projects/{projectId}/groups/{groupId}/archive — 归档需求群（创建者或 Project Admin） */
  archive(projectId: string, groupId: string) {
    return request<void>(`/projects/${projectId}/groups/${groupId}/archive`, { method: 'POST' })
  },
  /** 游标拉取消息 —— 返回 data + page 结构 */
  listMessages(projectId: string, groupId: string, cursor?: string, limit = 30) {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    params.set('limit', String(limit))
    return requestPage<Message>(
      `/projects/${projectId}/groups/${groupId}/messages?${params.toString()}`,
    )
  },
  sendMessage(projectId: string, groupId: string, payload: SendMessagePayload) {
    return request<Message | SendMessageResult>(`/projects/${projectId}/groups/${groupId}/messages`, {
      method: 'POST',
      body: payload,
      headers: { 'Idempotency-Key': payload.clientMessageId },
    }).then((response): SendMessageResult => {
      if ('message' in response) return response
      return { message: response, task: null }
    })
  },
  /** 显式触发任务（§7；续作引用时不得传 repositoryIds，否则 409 WORKSPACE_CONTINUATION_REPOSITORIES_FORBIDDEN） */
  async triggerTask(projectId: string, groupId: string, messageId: string, input: TaskTriggerRequest): Promise<void> {
    await request<unknown>(
      `/projects/${projectId}/groups/${groupId}/messages/${messageId}/trigger-task`,
      { method: 'POST', body: input },
    )
  },
}
