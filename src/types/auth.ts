/** 当前登录用户 */
export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  /** 展示用首字，如「陈」 */
  avatarChar?: string
}

/** 登录态 Token（具体字段以后端 JWT/Session 方案为准） */
export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface LoginPayload {
  email: string
  password: string
  /** 保持登录 */
  rememberMe?: boolean
}

export interface RegisterPayload {
  email: string
  password: string
  displayName?: string
}
