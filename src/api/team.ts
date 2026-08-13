import { request } from './client'
import type {
  CreateTeamPayload,
  CreateInvitationPayload,
  Team,
  TeamMember,
  TeamInvitation,
  AcceptInvitationResponse,
} from '@/types'

/**
 * 团队管理 API —— 对齐接口文档 v1.1.4 §5.1
 */
export const teamApi = {
  /** GET /teams — 当前用户加入的团队列表 */
  listMine() {
    return request<Team[]>('/teams')
  },

  /** POST /teams — 创建团队，创建者成为 TEAM_OWNER */
  create(payload: CreateTeamPayload) {
    return request<Team>('/teams', { method: 'POST', body: payload })
  },

  /** GET /teams/{teamId} — 获取团队资料 */
  getById(teamId: string) {
    return request<Team>(`/teams/${teamId}`)
  },

  /** PATCH /teams/{teamId} — 修改团队资料（仅 Team Owner） */
  update(teamId: string, payload: Partial<CreateTeamPayload>) {
    return request<Team>(`/teams/${teamId}`, { method: 'PATCH', body: payload })
  },

  /** GET /teams/{teamId}/members — 团队成员列表 */
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


  /** DELETE /teams/{teamId}/invitations/{invitationId} — 撤销邀请 */
  revokeInvitation(teamId: string, invitationId: string) {
    return request<void>(`/teams/${teamId}/invitations/${invitationId}`, {
      method: 'DELETE',
    })
  },


  /** PATCH /teams/{teamId}/members/{userId} — 调整团队角色（仅 Team Owner） */
  updateMemberRole(teamId: string, userId: string, role: string) {
    return request<void>(`/teams/${teamId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    })
  },

  /** DELETE /teams/{teamId}/members/{userId} — 移除团队成员（仅 Team Owner） */
  removeMember(teamId: string, userId: string) {
    return request<void>(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    })
  },
}
