import type { TaskExecutionSummary, TaskListItem, TaskRepositorySummary } from '@/types/task-model'

export function valueOrNone(value: string | null | undefined): string {
  return value?.trim() || '暂无'
}

/** Safely render a list item while its repository projection is still incomplete. */
export function taskRepositories(task: Pick<TaskListItem, 'repositories'>): TaskRepositorySummary[] {
  return Array.isArray(task.repositories) ? task.repositories : []
}

/** Safely render a list item while its execution projection is still incomplete. */
export function taskExecutionSummary(task: Pick<TaskListItem, 'executionSummary'>): TaskExecutionSummary | null {
  const summary = task.executionSummary
  return summary && typeof summary === 'object' ? summary : null
}
