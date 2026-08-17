import { describe, expect, it } from 'vitest'
import { PATHS } from '@/routes/paths'
import type { Notification } from '@/types'
import { notificationTargetPath } from './NotificationCenter'

const taskFailed: Notification = {
  id: 'notification-1',
  kind: 'TASK_FAILED',
  title: 'Task failed',
  isRead: false,
  createdAt: '2026-08-17T00:00:00Z',
  projectId: 'project-1',
  resourceId: 'task-1',
}

describe('notificationTargetPath', () => {
  it('opens the related Task detail for a task failure', () => {
    expect(notificationTargetPath(taskFailed)).toBe(PATHS.projectTaskDetail('project-1', 'task-1'))
  })

  it('falls back to Task Center when a task notification has no resource id', () => {
    expect(notificationTargetPath({ ...taskFailed, resourceId: undefined })).toBe(PATHS.projectTasks('project-1'))
  })
})
