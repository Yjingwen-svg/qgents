import { request } from './client'
import type { CreateProjectPayload, Project } from '@/types'

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
 * 项目隔离 API
 * Skill / Memory / 群聊 / 任务均挂在 project 下
 */
export const projectApi = {
  /**
   * GET /teams/{teamId}/projects
   * 文档：团队成员可访问；Owner 绑定仓库时列出该团队全部项目
   */
  listByTeam(teamId: string) {
    return request<ApiEnvelope<Project[]> | Project[]>(`/teams/${teamId}/projects`).then(unwrapData)
  },

  getById(projectId: string) {
    return request<ApiEnvelope<Project> | Project>(`/projects/${projectId}`).then(unwrapData)
  },

  create(payload: CreateProjectPayload) {
    return request<ApiEnvelope<Project> | Project>('/projects', {
      method: 'POST',
      body: payload,
    }).then(unwrapData)
  },

  /**
   * TODO[后端联调]:
   * - Skill 按项目存取：GET/PUT /projects/:id/skills
   * - Memory 按项目存取：GET/PUT /projects/:id/memories
   * - owner 可编辑共享，member 仅使用（前端按角色禁用编辑入口）
   */
}
