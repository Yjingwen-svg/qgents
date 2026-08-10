import { request } from './client'
import type { AuthTokens, LoginPayload, RegisterPayload, User } from '@/types'

/**
 * 账号 / 登录态相关 API
 * 对应后端：账号体系、Session/JWT
 */
export const authApi = {
  /** POST /auth/login */
  login(payload: LoginPayload) {
    return request<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  },

  /** POST /auth/register */
  register(payload: RegisterPayload) {
    return request<{ user: User; tokens: AuthTokens }>('/auth/register', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  },

  /** GET /auth/me — 刷新登录态后拉取当前用户 */
  me() {
    return request<User>('/auth/me')
  },

  /** POST /auth/logout */
  logout() {
    return request<void>('/auth/logout', { method: 'POST' })
  },

  /**
   * TODO[后端联调]: GitHub OAuth
   * 前端跳转到后端提供的授权 URL，回调后落 Token
   */
  getGithubOAuthUrl() {
    return `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/oauth/github`
  },
}
