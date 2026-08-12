/**
 * 团队相关类型 —— 对齐接口文档 v1.1.4 §3.1 §5.1
 */

/** 团队角色 */
export type TeamRole = 'TEAM_OWNER' | 'TEAM_MEMBER'

export interface Team {
  id: string
  name: string
  description?: string
  avatarUrl?: string
  createdAt?: string
  /** 当前用户在团队中的角色 */
  myRole?: TeamRole
  /** 团队成员数 */
  memberCount?: number
}

export interface TeamMember {
  userId: string
  displayName: string
  email: string
  role: TeamRole
  avatarUrl?: string
}

/** POST /teams 请求体 */
export interface CreateTeamPayload {
  name: string
  description?: string
}

/** POST /teams/{teamId}/invitations 请求体 */
export interface CreateInvitationPayload {
  email: string
  role: TeamRole
  expiresInDays?: number
}

/** 团队邀请 */
export interface TeamInvitation {
  id: string
  email: string
  role: TeamRole
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  createdAt: string
  expiresAt: string
}

/** POST /team-invitations/{token}/accept 响应 */
export interface AcceptInvitationResponse {
  teamId: string
  teamName: string
}
