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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options
  const finalHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

  if (!skipAuth) {
    const token = getStoredToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  if (headers) Object.assign(finalHeaders, headers as Record<string, string>)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content
  if (res.status === 204) return undefined as T

  // read body once
  let raw: string
  try { raw = await res.text() } catch { raw = '' }

  let json: unknown
  try { json = JSON.parse(raw) } catch { json = raw }

  if (!res.ok) {
    throw new ApiError(`Request failed: ${res.status}`, res.status, json)
  }

  // unwrap { data: ... }
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as Record<string, unknown>).data as T
  }

  return json as T
}
