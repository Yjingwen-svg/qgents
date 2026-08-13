import { request } from './client'
import type {
  LoginPayload,
  RegisterPayload,
  AuthResponse,
  RefreshResponse,
  MeResponse,
} from '@/types'

/**
 * 认证接口 —— 对齐接口文档 v1.1.4 §4
 *
 * RSA 公钥不再通过接口动态拉取，改为前端硬编码。
 * 见 src/utils/rsaConfig.ts
 */
export const authApi = {
  /** POST /auth/login — 邮箱密码登录 */
  login(payload: LoginPayload) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  },

  /** POST /auth/register — 邮箱注册 */
  register(payload: RegisterPayload) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  },

  /** POST /auth/refresh — 用 refreshToken 换新的 accessToken */
  refresh(refreshToken: string) {
    return request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    })
  },

  /** GET /me — 获取当前用户信息（data 层为聚合结构 user + teams + projects） */
  me() {
    return request<MeResponse>('/me')
  },

  /** POST /auth/logout — 登出，使当前 refreshToken 失效 */
  logout(refreshToken?: string) {
    return request<void>('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : undefined,
    })
  },

  /** POST /auth/password-reset-requests — 发起找回密码邮件 */
  resetPasswordRequest(email: string) {
    return request<void>('/auth/password-reset-requests', {
      method: 'POST',
      body: { email },
      skipAuth: true,
    })
  },

  /**
   * GitHub OAuth 跳转地址
   * 接口文档标注：不属于本期必需能力，仅预留
   */
  getGithubOAuthUrl() {
    return `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/oauth/github`
  },
}
