import { useEventStream } from './useEventStream'
import { queryClient } from '@/query'

/**
 * 通知级 SSE（GET /notifications/events）—— 当前登录用户维度。
 *
 * 收到 notification.created 后刷新通知中心列表（铃铛实时提醒）。
 */
export function useNotificationEvents(enabled = true): void {
  useEventStream(
    enabled ? 'notifications' : '',
    enabled ? '/notifications/events' : '',
    (eventType) => {
      if (eventType === 'notification.created') {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
    },
  )
}
