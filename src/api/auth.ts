import { request } from './client'
import type {
  AvatarCredential,
  LoginPayload,
  RegisterPayload,
  AuthResponse,
  RefreshResponse,
  MeResponse,
  UpdateMePayload,
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

  /** GET /me — 获取当前用户信息（data 层为聚合结构 user + teams + projects）。可传 signal 用于取消（如 StrictMode 卸载时掐断首请求） */
  me(signal?: AbortSignal) {
    return request<MeResponse>('/me', { signal })
  },

  /** PATCH /me — 修改昵称和头像（§4；写操作由 client 自动带 Idempotency-Key） */
  updateMe(payload: UpdateMePayload) {
    return request<void>('/me', { method: 'PATCH', body: payload })
  },

  /** POST /me/avatar/credential — 签发头像直传凭证（§4；OSS 未启用时 501 AVATAR_STORAGE_NOT_CONFIGURED） */
  createAvatarCredential(input: { mediaType: string; sizeBytes: number }) {
    return request<AvatarCredential>('/me/avatar/credential', { method: 'POST', body: input })
  },

  /** POST /me/avatar/confirm — 确认头像上传，写入 users.avatar_url 并返回长期公共读 URL（§4） */
  confirmAvatar(objectKey: string) {
    return request<{ avatarUrl: string }>('/me/avatar/confirm', {
      method: 'POST',
      body: { objectKey },
    })
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

/**
 * 上传头像并返回长期公共读 URL：创建凭证 → 直传 OSS → 确认（§4，镜像 §18 附件链路）。
 * 失败时抛错，由调用方 toast 展示；OSS 未启用时抛 501 错误。
 */
export async function uploadAvatar(file: File): Promise<string> {
  const credential = await authApi.createAvatarCredential({
    mediaType: file.type,
    sizeBytes: file.size,
  })

  // 用 ArrayBuffer 作 body：fetch 不会自动带 Content-Type 头，避免预签名 PUT 签名不匹配
  const putRes = await fetch(credential.uploadUrl, {
    method: 'PUT',
    body: await file.arrayBuffer(),
  })
  if (!putRes.ok) {
    throw new Error(`头像上传失败（${putRes.status}）`)
  }

  const result = await authApi.confirmAvatar(credential.objectKey)
  return result.avatarUrl
}
