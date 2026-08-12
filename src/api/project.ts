import { request } from './client'
import type { CreateProjectPayload, Project, ProjectMember } from '@/types'

/** 接口文档统一成功响应外壳 */
interface ApiEnvelope<T> {
  data: T
  requestId?: string
}

function unwrapData<T>(res: ApiEnvelope<T> | T): T {
  if (res !== null && typeof res === 'object' && 'data' in (res as object)) {
    return (res as ApiEnvelope<T>).data
  }
  return res as T
}

/**
 * 项目管理 API —— 对齐接口文档 v1.1.4 §5.2
 */
export const projectApi = {
  /**
   * GET /teams/{teamId}/projects
   * 文档：团队成员可访问；Owner 绑定仓库时列出该团队全部项目
   */
  listByTeam(teamId: string) {
    return request<ApiEnvelope<Project[]> | Project[]>(`/teams/${teamId}/projects`).then(unwrapData)
  },

  /** POST /teams/{teamId}/projects — 创建项目 */
  create(payload: CreateProjectPayload) {
    return request<Project>(`/teams/${payload.teamId}/projects`, {
      method: 'POST',
      body: payload,
    })
  },

  /** GET /projects/{projectId} — 获取项目资料 */
  getById(projectId: string) {
    return request<ApiEnvelope<Project> | Project>(`/projects/${projectId}`).then(unwrapData)
  },

  /** PATCH /projects/{projectId} — 修改项目资料（仅 PROJECT_ADMIN） */
  update(projectId: string, payload: Partial<CreateProjectPayload>) {
    return request<Project>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  /** POST /projects/{projectId}/archive — 归档项目 */
  archive(projectId: string) {
    return request<void>(`/projects/${projectId}/archive`, { method: 'POST' })
  },

  /** POST /projects/{projectId}/restore — 恢复项目 */
  restore(projectId: string) {
    return request<void>(`/projects/${projectId}/restore`, { method: 'POST' })
  },

  /** GET /projects/{projectId}/members — 项目成员与角色 */
  listMembers(projectId: string) {
    return request<ProjectMember[]>(`/projects/${projectId}/members`)
  },

  /** POST /projects/{projectId}/members — 将现有团队成员加入项目 */
  addMember(projectId: string, userId: string) {
    return request<void>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: { userId },
    })
  },

  /** PATCH /projects/{projectId}/members/{userId} — 调整项目成员角色 */
  updateMemberRole(projectId: string, userId: string, role: string) {
    return request<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    })
  },

  /** DELETE /projects/{projectId}/members/{userId} — 从项目移除成员 */
  removeMember(projectId: string, userId: string) {
    return request<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    })
  },
}
