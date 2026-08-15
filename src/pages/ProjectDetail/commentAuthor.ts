import type { DiffComment } from '@/types/task-model'

export const HUNK_UNAVAILABLE_HINT =
  '本轮未返回结构化 hunk。文件树与增减统计仍可用，行级对比待后端解析 patch。'

export function commentAuthorName(
  comment: Pick<DiffComment, 'authorName' | 'authorUserId'>,
  members: Array<{ userId: string; displayName?: string }>,
): string {
  const named = comment.authorName?.trim()
  if (named) return named
  const member = comment.authorUserId
    ? members.find((item) => item.userId === comment.authorUserId)
    : undefined
  return member?.displayName?.trim() || '成员'
}
