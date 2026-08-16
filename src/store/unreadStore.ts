import { create } from 'zustand'

/**
 * 群聊未读状态 —— localStorage 兜底（接口文档 §7：unreadCount 本轮后端不返回）。
 *
 * 模型：记录每个群「最后已读时间」；群 latestActivityAt 比已读时间新 → 未读（红点）。
 * 进入群聊面板时持续 markRead，离开后群有新活动即重新亮红点。
 */

const READ_AT_KEY = 'qgents_group_read_at'

function readStoredReadAt(): Record<string, string> {
  try {
    const raw = localStorage.getItem(READ_AT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

interface UnreadStore {
  /** groupId → 最后已读时间（ISO 字符串） */
  readAt: Record<string, string>
  /** 标记某群已读（写当前时间） */
  markRead: (groupId: string) => void
}

export const useUnreadStore = create<UnreadStore>((set, get) => ({
  readAt: readStoredReadAt(),
  markRead: (groupId) => {
    const readAt = { ...get().readAt, [groupId]: new Date().toISOString() }
    try {
      localStorage.setItem(READ_AT_KEY, JSON.stringify(readAt))
    } catch {
      // localStorage 不可用（隐私模式等）时静默降级，仅内存生效
    }
    set({ readAt })
  },
}))

/** 判断某群是否有未读：从未读过或有比已读时间更新的活动 */
export function hasUnread(
  readAt: Record<string, string>,
  group: { id: string; latestActivityAt?: string },
): boolean {
  const read = readAt[group.id]
  if (!group.latestActivityAt) return false
  // 从未读过 → 有活动即视为未读
  if (!read) return true
  return new Date(group.latestActivityAt).getTime() > new Date(read).getTime()
}
