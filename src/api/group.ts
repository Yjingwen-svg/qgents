import { request, requestPage } from './client'
import type {
  Group,
  GroupMember,
  Message,
  SendMessageResult,
  SendMessagePayload,
  CreateGroupPayload,
} from '@/types'

/** 群聊 API —— 对齐接口文档 v1.1.8 §7 */
export const groupApi = {
  listByProject(projectId: string) {
    return request<Group[]>(`/projects/${projectId}/groups`)
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
}
