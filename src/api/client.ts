/**
 * HTTP 客户端封装
 * TODO[后端联调]:
 * 1. 将 BASE_URL 改为环境变量 VITE_API_BASE_URL
 * 2. 在请求头注入 Authorization: Bearer <token>
 * 3. 统一处理 401 跳转登录、业务错误码 toast
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
// 自定义的接口请求异常类,继承原生 Error，额外加上 status、body 两个属性的类。
export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** 跳过自动附带 Token（登录/注册接口用） */
  skipAuth?: boolean
}

function getStoredToken(): string | null {
  // TODO[后端联调]: 与 AuthContext / localStorage / cookie 策略对齐
  return localStorage.getItem('qgents_access_token')
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options
  const finalHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (!skipAuth) {
    const token = getStoredToken()
    if (token) {
      ;(finalHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    // 响应体只能读一次：先 text，再尝试 JSON.parse
    const raw = await res.text()
    let errBody: unknown = raw || undefined
    if (raw) {
      try {
        errBody = JSON.parse(raw) as unknown
      } catch {
        // 非 JSON 保留原文
      }
    }
    throw new ApiError(`Request failed: ${res.status}`, res.status, errBody)
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}
