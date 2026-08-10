/** 团队角色：P0 至少 owner / member 两级 */
export type TeamRole = 'owner' | 'member'

export interface Team {
  id: string
  name: string
  description?: string
  avatarUrl?: string
  /** 成立时间，创建后由后端生成 */
  createdAt?: string
  inviteCode?: string
  myRole?: TeamRole
}

export interface TeamMember {
  userId: string
  displayName: string
  email: string
  role: TeamRole
  avatarUrl?: string
}

export interface CreateTeamPayload {
  name: string
  description?: string
  /** 头像上传后得到的 URL / fileId，具体以后端为准 */
  avatarFileId?: string
  /** 初始邀请成员（Github 邮箱），一行一个 */
  inviteEmails?: string[]
  /** 邀请默认角色 */
  inviteRole?: TeamRole | 'developer'
}

export interface JoinTeamPayload {
  inviteCode: string
}
