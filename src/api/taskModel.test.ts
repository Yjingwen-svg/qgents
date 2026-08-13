import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubApi } from './github'
import { diffsApi, taskRunsApi, tasksApi } from './taskModel'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('new task model API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ data: {}, requestId: 'req' }))
    vi.stubGlobal('crypto', { randomUUID: () => 'idempotency-key' })
  })

  it('preserves the envelope when loading repositories for Task creation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      data: [{ repositoryId: 'repository-1' }],
      requestId: 'req-repositories',
    }))

    await expect(githubApi.listProjectRepositories('project-1')).resolves.toEqual([
      { repositoryId: 'repository-1' },
    ])
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/projects/project-1/repositories',
      expect.objectContaining({ body: undefined }),
    )
  })

  it('uses the Task create path and request body without legacy fields', async () => {
    const fetchMock = vi.mocked(fetch)
    await tasksApi.create('project-1', {
      requirementGroupId: 'group-1',
      title: 'Implement login',
      requirement: 'Support login',
      repositoryIds: ['repo-1'],
      baseRef: 'main',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-1/tasks', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'idempotency-key' }),
      body: JSON.stringify({
        requirementGroupId: 'group-1',
        title: 'Implement login',
        requirement: 'Support login',
        repositoryIds: ['repo-1'],
        baseRef: 'main',
      }),
    }))
  })

  it('uses only the documented Task and Diff list filters', async () => {
    const fetchMock = vi.mocked(fetch)
    await tasksApi.list('project-1', { groupId: 'group-1', status: 'RUNNING', createdBy: 'user-1', cursor: 'c1', limit: 20 })
    await diffsApi.list('project-1', { taskId: 'task-1', cursor: 'c2', limit: 10 })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/project-1/tasks?groupId=group-1&status=RUNNING&createdBy=user-1&cursor=c1&limit=20', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projects/project-1/diffs?taskId=task-1&cursor=c2&limit=10', expect.any(Object))
  })

  it('preserves the pagination envelope for model list responses', async () => {
    const page = { data: [{ id: 'task-1' }], page: { nextCursor: null, hasMore: false }, requestId: 'req-1' }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page))

    await expect(tasksApi.list('project-1')).resolves.toEqual(page)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/projects/project-1/tasks', expect.objectContaining({
      body: undefined,
    }))
  })

  it('uses TaskRun by-task paths and does not expose a standalone steps endpoint', async () => {
    const fetchMock = vi.mocked(fetch)
    await taskRunsApi.list('project-1', 'task-1', { status: 'FAILED', cursor: 'c1', limit: 20 })
    await taskRunsApi.get('project-1', 'run-1')
    await taskRunsApi.retry('project-1', 'run-1')
    await taskRunsApi.logs('project-1', 'run-1', { cursor: 'c2', limit: 10 })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/project-1/tasks/task-1/task-runs?status=FAILED&cursor=c1&limit=20', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projects/project-1/task-runs/run-1', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/projects/project-1/task-runs/run-1/retry', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/projects/project-1/task-runs/run-1/logs?cursor=c2&limit=10', expect.any(Object))
    expect(fetchMock.mock.calls.some(([path]) => String(path).includes('/steps'))).toBe(false)
  })

  it('uses Diff accept and reject paths with idempotent writes', async () => {
    const fetchMock = vi.mocked(fetch)
    await diffsApi.accept('project-1', 'diff-1')
    await diffsApi.reject('project-1', 'diff-1', { reason: 'Please address the failing test' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/project-1/diffs/diff-1/accept', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projects/project-1/diffs/diff-1/reject', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: 'Please address the failing test' }),
    }))
  })
})
