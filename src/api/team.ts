import { request } from './client'
import type {
  AcceptInvitationResponse,
  CreateInvitationPayload,
  CreateTeamPayload,
  Team,
  TeamInvitation,
  TeamMember,
} from '@/types'

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

  /** GET /teams/:id/members */
  listMembers(teamId: string) {
    return request<TeamMember[]>(`/teams/${teamId}/members`)
  },

  /** POST /teams/:id/invitations — 按邮箱创建团队邀请 */
  invite(teamId: string, payload: CreateInvitationPayload) {
    return request<TeamInvitation>(`/teams/${teamId}/invitations`, {
      method: 'POST',
      body: payload,
    })
  },

  /** GET /teams/:id/invitations — 查询邀请状态 */
  listInvitations(teamId: string) {
    return request<TeamInvitation[]>(`/teams/${teamId}/invitations`)
  },

  /** POST /team-invitations/:token/accept — 接受团队邀请 */
  acceptInvitation(token: string) {
    return request<AcceptInvitationResponse>(`/team-invitations/${token}/accept`, {
      method: 'POST',
    })
  },

  /** DELETE /teams/:id/members/:userId */
  removeMember(teamId: string, userId: string) {
    return request<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
  },

  /** DELETE /teams/{teamId} —— 解散团队（仅 TEAM_OWNER） */
  disband(teamId: string) {
    return request<void>(`/teams/${teamId}`, { method: 'DELETE' })
  },
}
