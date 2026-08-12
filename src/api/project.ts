import { request } from './client'
import { requestData } from './taskDomain'
import type { CreateProjectPayload, Project } from '@/types'

/**
 * 项目隔离 API
 * Skill / Memory / 群聊 / 任务均挂在 project 下
 */
export const projectApi = {
  listByTeam(teamId: string) {
    return request<Project[]>(`/teams/${teamId}/projects`)
  },

  getById(projectId: string) {
    return requestData<Project>(`/projects/${projectId}`)
  },

  create(payload: CreateProjectPayload) {
    return request<Project>('/projects', { method: 'POST', body: payload })
  },

  /**
   * TODO[后端联调]:
   * - Skill 按项目存取：GET/PUT /projects/:id/skills
   * - Memory 按项目存取：GET/PUT /projects/:id/memories
   * - owner 可编辑共享，member 仅使用（前端按角色禁用编辑入口）
   */
}
