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

function readErrorMessage(json: unknown, status: number): string {
  if (json && typeof json === 'object' && 'error' in json) {
    const error = (json as { error?: { code?: string; message?: string } }).error
    if (error?.code && error.message) return `[${error.code}] ${error.message}`
    if (error?.message) return error.message
  }
  return `Request failed: ${status}`
}

/** 底层请求：返回后端统一响应的原始 JSON（含 data / page / error） */
async function rawRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { body, skipAuth, headers, ...rest } = options
  const finalHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

  if (!skipAuth) {
    const token = getStoredToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  if (headers) Object.assign(finalHeaders, headers as Record<string, string>)

  const method = String(rest.method ?? 'GET').toUpperCase()
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  if (isWrite && !finalHeaders['Idempotency-Key']) {
    finalHeaders['Idempotency-Key'] = crypto.randomUUID()
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 12_000)
  if (rest.signal) {
    if (rest.signal.aborted) controller.abort()
    else rest.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络或 API 是否可用', 0)
    }
    throw new ApiError('无法连接服务器，请检查 API 地址或网络', 0)
  } finally {
    window.clearTimeout(timeoutId)
  }


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
    throw new ApiError(readErrorMessage(json, res.status), res.status, json)
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
