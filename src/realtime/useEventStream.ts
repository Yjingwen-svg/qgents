import { useEffect, useRef } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { getApiBaseUrl, getStoredToken } from '@/api/client'

const CURSOR_PREFIX = 'qgents.events.cursor.'
const RETRY_DELAY_MS = 5000

/**
 * 通用 SSE 连接 hook —— 团队级 / 通知级事件流复用。
 *
 * 与 B 的项目级 ProjectEventConnection 同源（fetchEventSource + Last-Event-ID 续传），
 * 但简化：不做事件去重，收到事件后由 onEvent 直接 invalidate 对应 query。
 * 事件仅用于刷新界面，恢复连接后以查询接口为准（接口文档 §12.1）。
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
    const token = getStoredToken()
    const url = `${getApiBaseUrl()}${path}`
    const cursorKey = `${CURSOR_PREFIX}${streamKey}`

    let stopped = false
    let currentController: AbortController | null = null

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

    async function connect(): Promise<void> {
      if (stopped) return
      currentController = new AbortController()
      const lastEventId = readCursor()
      try {
        await fetchEventSource(url, {
          signal: currentController.signal,
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
          },
          openWhenHidden: true,
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
            if (!stopped) setTimeout(connect, RETRY_DELAY_MS)
          },
        })
      } catch {
        currentController = null
        if (!stopped) setTimeout(connect, RETRY_DELAY_MS)
      }
    }

    void connect()
    return () => {
      stopped = true
      currentController?.abort()
    }
  }, [streamKey, path])
}
