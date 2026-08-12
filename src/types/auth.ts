/**
 * 认证相关类型 —— 对齐接口文档 v1.1.4 §4、§4.1
 */

/** 当前登录用户 */
export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  /** 展示用首字，如「陈」 */
  avatarChar?: string
}

// ──── 请求体 ────

/** POST /auth/login 请求体 */
export interface LoginPayload {
  email: string
  /** Base64(RSA-PKCS1-v1_5(明文密码)) */
  password: string
  /** 固定值，与前端硬编码的公钥 keyId 一致 */
  passwordKeyId: string
}

/** POST /auth/register 请求体 */
export interface RegisterPayload {
  email: string
  /** Base64(RSA-PKCS1-v1_5(明文密码)) */
  password: string
  /** 固定值，与前端硬编码的公钥 keyId 一致 */
  passwordKeyId: string
  displayName: string
}

// ──── 响应体（已解包 data 层）────

/** POST /auth/login 或 /auth/register 成功响应 */
export interface AuthResponse {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  refreshTokenExpiresIn: number
  user: User
}

/** POST /auth/refresh 响应 */
export interface RefreshResponse {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  refreshTokenExpiresIn: number
}
