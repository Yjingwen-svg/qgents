import type { Page } from '@/types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

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
  skipAuth?: boolean
}

function getStoredToken(): string | null {
  return localStorage.getItem('qgents_access_token')
}

/** 生成幂等键：UUID v4。后端要求写操作携带 Idempotency-Key（接口文档 §2） */
function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** 需要携带 Idempotency-Key 的写方法 */
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/** 底层请求：返回后端统一响应的原始 JSON（含 data / page / error） */
async function rawRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { body, skipAuth, headers, ...rest } = options
  const finalHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

  if (!skipAuth) {
    const token = getStoredToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  if (headers) Object.assign(finalHeaders, headers as Record<string, string>)

  // 写操作统一携带幂等键（后端要求，否则 400）。调用方显式传入的优先（如 sendMessage 用 clientMessageId）。
  const method = (rest.method ?? 'GET').toUpperCase()
  if (WRITE_METHODS.has(method) && !finalHeaders['Idempotency-Key']) {
    finalHeaders['Idempotency-Key'] = generateIdempotencyKey()
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content
  if (res.status === 204) return undefined

  // read body once
  let raw: string
  try {
    raw = await res.text()
  } catch {
    raw = ''
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    json = raw
  }

  if (!res.ok) {
    // 提取后端统一错误响应 { error: { code, message } }，把 message 透传到错误信息，避免页面只显示 "Request failed: 4xx"
    let message = `Request failed: ${res.status}`
    if (json && typeof json === 'object' && 'error' in json) {
      const err = (json as Record<string, unknown>).error as
        | { code?: string; message?: string }
        | undefined
      if (err && typeof err.message === 'string' && err.message) {
        message = err.message
      }
    }
    throw new ApiError(message, res.status, json)
  }

  return json
}

/** 普通请求：解出 `data` 层返回 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const json = await rawRequest(path, options)

  if (json && typeof json === 'object' && 'data' in json) {
    return (json as Record<string, unknown>).data as T
  }

  return json as T
}

/** 分页请求：解出 `data` + `page` 层，对齐接口文档 v1.1.8 §2「列表分页」 */
export async function requestPage<T>(path: string, options: RequestOptions = {}): Promise<Page<T>> {
  const json = (await rawRequest(path, options)) as Record<string, unknown> | undefined

  if (json && typeof json === 'object') {
    const data = ('data' in json ? json.data : []) as T[]
    const page = (json.page as Page<T>['page']) ?? { nextCursor: null, hasMore: false }
    return { data, page }
  }

  return { data: [], page: { nextCursor: null, hasMore: false } }
}
