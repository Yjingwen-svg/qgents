import { getApiBaseUrl, getStoredToken, refreshAccessToken } from '@/api/client'
import { projectEventsEnabled } from '@/api/projectEvents'
import { queryClient } from '@/query'
import { invalidateProjectTaskEvent } from './queryInvalidation'
import { PROJECT_TASK_EVENT_TYPES, type ProjectTaskEventType } from './eventParser'
import type { RealtimeFrame } from '@/types'

/**
 * WebSocket 实时通道（/api/v1/ws/realtime）—— 单连接 + 用户级聚合流。
 *
 * - 每个账号只开一条连接；SSE 三端点保留兼容，未移除。
 * - 鉴权：握手 ?token=<accessToken>（浏览器 WS 升级无法带 Authorization 头）。
 * - 连接可用判定：收到 hello 帧（{"type":"hello","userId":...}）。
 * - 断线自动重连（指数退避）；握手阶段失败（token 过期）先 refresh token 再重连。
 * - 核心模型不变：REST 是真相。帧只作刷新信号 → dispatchRealtimeFrame 走
 *   与 SSE 同源的 queryInvalidation，收到后重查 REST 校准。
 */

export const REALTIME_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000] as const

/** 拼接 WS 地址：BASE_URL 为绝对 http(s) 时转 ws(s)；为相对路径（/api）时拼当前 origin */
export function realtimeWsUrl(token: string): string {
  const base = getApiBaseUrl()
  const wsBase = base.startsWith('http')
    ? base.replace(/^http/i, 'ws')
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${base}`
  return `${wsBase}/ws/realtime?token=${encodeURIComponent(token)}`
}

function isRealtimeFrame(value: unknown): value is RealtimeFrame {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.type === 'string' &&
    (record.scope === 'project' || record.scope === 'team' || record.scope === 'notification') &&
    typeof record.payload === 'object' &&
    record.payload !== null
  )
}

function isProjectTaskEventType(type: string): type is ProjectTaskEventType {
  return (PROJECT_TASK_EVENT_TYPES as readonly string[]).includes(type)
}

/**
 * 帧 → 查询失效（与 SSE queryInvalidation 同源）。
 * - scope=project：复用项目事件映射（message.created 额外校准主群聚合，覆盖不挂 SSE 的群聊工作台）
 * - scope=team：刷新团队相关列表
 * - scope=notification：刷新通知中心 + 铃铛
 */
export function dispatchRealtimeFrame(frame: RealtimeFrame): void {
  const { type, scope } = frame
  if (scope === 'notification') {
    if (type === 'notification.created') {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    return
  }
  if (scope === 'team') {
    void queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
    const teamId = typeof frame.teamId === 'string' && frame.teamId ? frame.teamId : null
    if (teamId) {
      void queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
      void queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
      void queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'activities'] })
    }
    return
  }
  // scope === 'project'
  const projectId = typeof frame.projectId === 'string' && frame.projectId ? frame.projectId : null
  if (!projectId) return
  if (type === 'message.created') {
    void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
  }
  if (isProjectTaskEventType(type)) {
    invalidateProjectTaskEvent(projectId, { id: null, type, payload: { ...frame.payload, projectId } })
  }
}

export class RealtimeClient {
  private ws: WebSocket | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0
  private running = false
  /** 当前这次连接是否成功 open 过（区分「握手失败」与「已连上后断线」） */
  private everOpened = false
  private reconnectListeners = new Set<() => void>()

  start(): void {
    if (this.running) return
    this.running = true
    this.connectNow()
  }

  stop(): void {
    this.running = false
    this.clearRetryTimer()
    this.closeSocket()
  }

  /** 断线重连成功后回调（用于重查当前范围关键列表，REST 兜底） */
  addReconnectListener(listener: () => void): () => void {
    this.reconnectListeners.add(listener)
    return () => this.reconnectListeners.delete(listener)
  }

  /** 默认断线恢复：整页级重查关键列表（§六.6，不依赖 WS 续传） */
  private handleReconnected(): void {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
    void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
    for (const listener of this.reconnectListeners) listener()
  }

  private closeSocket(): void {
    if (!this.ws) return
    const ws = this.ws
    this.ws = null
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    try {
      ws.close()
    } catch {
      // 已关闭的连接忽略
    }
  }

  private connectNow(): void {
    if (!this.running || this.ws) return
    const token = getStoredToken()
    if (!token) return

    this.everOpened = false
    let ws: WebSocket
    try {
      ws = new WebSocket(realtimeWsUrl(token))
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.everOpened = true
      // 连接是否可用以 hello 帧为准
    }
    ws.onmessage = (event) => this.handleMessage(event)
    ws.onerror = () => {
      // 握手失败（HTTP 401 拒绝升级）或传输错误：由 onclose 统一处理重连
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      if (!this.running) return
      if (this.everOpened) {
        // 已建立过连接后断线：直接用当前 token 重连
        this.scheduleReconnect()
      } else {
        // 握手阶段失败（token 缺失/过期）：先尽力刷新 token（写回 localStorage），再重连
        void refreshAccessToken().finally(() => this.scheduleReconnect())
      }
    }
  }

  private handleMessage(event: MessageEvent): void {
    let raw: unknown
    try {
      raw = JSON.parse(String(event.data))
    } catch {
      return // 非 JSON 文本帧（心跳等控制帧）忽略
    }
    if (typeof raw === 'object' && raw !== null && (raw as Record<string, unknown>).type === 'hello') {
      const wasReconnecting = this.retryAttempt > 0
      this.retryAttempt = 0
      if (wasReconnecting) this.handleReconnected()
      return
    }
    if (isRealtimeFrame(raw)) {
      dispatchRealtimeFrame(raw)
    }
  }

  private scheduleReconnect(): void {
    if (!this.running || this.retryTimer) return
    const index = Math.min(this.retryAttempt, REALTIME_RETRY_DELAYS_MS.length - 1)
    const delay = REALTIME_RETRY_DELAYS_MS[index] ?? 1000
    this.retryAttempt += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connectNow()
    }, delay)
  }

  private clearRetryTimer(): void {
    if (!this.retryTimer) return
    clearTimeout(this.retryTimer)
    this.retryTimer = null
  }
}

let sharedClient: RealtimeClient | null = null
let refCount = 0

/**
 * 订阅全局实时通道（每账号一条连接）。返回取消订阅函数。
 * mock 模式（VITE_USE_MOCK=true）下无 WS 端点，直接跳过。
 */
export function subscribeRealtime(): () => void {
  if (!projectEventsEnabled()) return () => {}
  sharedClient ??= new RealtimeClient()
  refCount += 1
  sharedClient.start()
  return () => {
    refCount -= 1
    if (refCount <= 0 && sharedClient) {
      sharedClient.stop()
      sharedClient = null
    }
  }
}
