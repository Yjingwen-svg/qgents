import { request } from './client'
import type { CreateTeamPayload, JoinTeamPayload, Team, TeamMember } from '@/types'

/**
 * 团队管理 API
 * P0：创建团队、邀请/移除成员、角色权限（owner / member）
 */
export const teamApi = {
  /** GET /teams — 当前用户加入的团队列表 */
  listMine() {
    return request<Team[]>('/teams')
  },

  /** GET /teams/:id */
  getById(teamId: string) {
    return request<Team>(`/teams/${teamId}`)
  },

  /** POST /teams */
  create(payload: CreateTeamPayload) {
    return request<Team>('/teams', { method: 'POST', body: payload })
  },

  /** POST /teams/join — 邀请码加入 */
  join(payload: JoinTeamPayload) {
    return request<Team>('/teams/join', { method: 'POST', body: payload })
  },

  /** GET /teams/:id/members */
  listMembers(teamId: string) {
    return request<TeamMember[]>(`/teams/${teamId}/members`)
  },

  /** POST /teams/:id/invites — 发送邮箱邀请 */
  invite(teamId: string, emails: string[], role?: string) {
    return request<void>(`/teams/${teamId}/invites`, {
      method: 'POST',
      body: { emails, role },
    })
  },

  /** DELETE /teams/:id/members/:userId */
  removeMember(teamId: string, userId: string) {
    return request<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
  },
}
