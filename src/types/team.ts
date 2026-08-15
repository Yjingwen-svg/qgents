/**
 * 团队相关类型 —— 对齐接口文档 v1.1.4 §3.1 §5.1
 */

/** 团队角色 */
export type TeamRole = 'TEAM_OWNER' | 'TEAM_MEMBER'

export interface Team {
  id: string
  name: string
  /** 当前用户在团队中的角色（后端字段名为 role，非 myRole） */
  role?: TeamRole
  /** 旧字段别名；部分页面仍读取，normalizeTeam 会同时填到 role */
  myRole?: TeamRole
  description?: string
  avatarUrl?: string
  createdAt?: string
  /** 团队成员数（后端暂未返回，联调后补） */
  memberCount?: number
}

export interface TeamMember {
  userId: string
  /** 显示名（后端成员接口暂未返回，联调后补） */
  displayName?: string
  /** 邮箱（后端成员接口暂未返回，联调后补） */
  email?: string
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

/** 当前用户收到的待处理团队邀请（GET /team-invitations，收件人视角） */
export interface MyTeamInvitation {
  id: string
  token: string
  teamId: string
  teamName: string
  role: TeamRole
  inviterDisplayName: string
  status: 'PENDING'
  expiresAt: string
  createdAt: string
}
