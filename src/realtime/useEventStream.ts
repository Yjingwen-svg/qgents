import { useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { getApiBaseUrl, getStoredToken, refreshAccessToken } from '@/api/client'

const CURSOR_PREFIX = 'qgents.events.cursor.'
const RETRY_DELAY_MS = 5000

/**
 * 通用 SSE 连接 hook —— 团队级 / 通知级事件流复用。
 *
 * 与 B 的项目级 ProjectEventConnection 同源（fetchEventSource + Last-Event-ID 续传），
 * 但简化：不做事件去重，收到事件后由 onEvent 直接 invalidate 对应 query。
 * 事件仅用于刷新界面，恢复连接后以查询接口为准（接口文档 §12.1）。
 *
 * 401 处理：access token 过期时，先尝试用 refresh token 换新 token 再重连；
 * 刷新失败则停止重连（等待普通请求派发 AUTH_EXPIRED 踢回登录页），避免 401 死循环刷屏。
 */
export function useEventStream(
  streamKey: string,
  path: string,
  onEvent: (eventType: string, data: Record<string, unknown>) => void,
): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!streamKey || !path) return
    const url = `${getApiBaseUrl()}${path}`
    const cursorKey = `${CURSOR_PREFIX}${streamKey}`

    let stopped = false
    let currentController: AbortController | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const readCursor = (): string | null => {
      try {
        return localStorage.getItem(cursorKey)
      } catch {
        return null
      }
    }
    const writeCursor = (id: string): void => {
      try {
        localStorage.setItem(cursorKey, id)
      } catch {
        // 存储不可用时静默降级
      }
    }

    function scheduleReconnect(): void {
      if (stopped || retryTimer) return
      retryTimer = setTimeout(() => {
        retryTimer = null
        void connect()
      }, RETRY_DELAY_MS)
    }

    async function connect(): Promise<void> {
      if (stopped) return
      currentController = new AbortController()
      const lastEventId = readCursor()
      // 每次连接都重新读取最新 token：普通接口 401 时会刷新 access token 写回 localStorage，
      // SSE 若闭包固定旧 token 会一直 401 死循环，必须现读。
      const token = getStoredToken()
      try {
        await fetchEventSource(url, {
          signal: currentController.signal,
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
          },
          openWhenHidden: true,
          async onopen(response) {
            if (response.ok) return
            if (response.status === 401) {
              // token 过期：刷新后抛错触发重连（下次 connect 会读到新 token）；刷新失败则停止。
              const newToken = await refreshAccessToken()
              if (!newToken) throw new Error('SSE auth expired')
              throw new Error('SSE token refreshed')
            }
            throw new Error(`SSE failed: ${response.status}`)
          },
          onmessage(msg) {
            const id = msg.id.trim()
            if (id) writeCursor(id)
            const data = msg.data.trim()
            if (!data) return
            try {
              onEventRef.current(msg.event.trim(), JSON.parse(data) as Record<string, unknown>)
            } catch {
              // 无法解析的事件忽略，不打断连接
            }
          },
          onclose() {
            currentController = null
            scheduleReconnect()
          },
        })
      } catch {
        currentController = null
        scheduleReconnect()
      }
    }

    void connect()
    return () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
      currentController?.abort()
    }
  }, [streamKey, path])
}
