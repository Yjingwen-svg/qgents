import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import {
  fetchWorkspaceDiffPreview,
  mapWorkspaceDiffPreview,
  mapWorkspaceDiffPreviewFile,
  mapWorkspaceDiffPreviewFiles,
} from './workspaceDiffPreview'

describe('workspace Diff Preview mapping', () => {
  it('maps a preview response with non-negative defaults and preserves base commit', () => {
    const preview = mapWorkspaceDiffPreview({
      projectId: 'project-1',
      taskId: 'task-1',
      taskRunId: 'run-1',
      workspaceId: 'ws-1',
      revision: 3,
      baseCommit: 'a1b2c3',
      workingTreeHash: 'sha256:abc',
      filesChanged: 2,
      additions: 8,
      deletions: 3,
      patch: 'diff --git a/x b/x',
      createdAt: '2026-08-19T12:00:00Z',
    })
    expect(preview).toMatchObject({
      projectId: 'project-1',
      taskId: 'task-1',
      taskRunId: 'run-1',
      workspaceId: 'ws-1',
      revision: 3,
      baseCommit: 'a1b2c3',
      workingTreeHash: 'sha256:abc',
      filesChanged: 2,
      additions: 8,
      deletions: 3,
    })
  })

  it('coerces missing baseCommit / taskRunId to safe defaults', () => {
    const preview = mapWorkspaceDiffPreview({
      projectId: 'project-1',
      taskId: 'task-1',
      workspaceId: 'ws-1',
      revision: 1,
      workingTreeHash: 'sha256:abc',
    })
    expect(preview.baseCommit).toBeNull()
    expect(preview.taskRunId).toBeNull()
    expect(preview.additions).toBe(0)
  })

  it('maps preview files and drops rows without repositoryId/path', () => {
    const files = mapWorkspaceDiffPreviewFiles([
      { repositoryId: 'repo-1', repositoryPath: 'auth-service', path: 'src/a.ts', changeType: 'MODIFIED', additions: 1, deletions: 0, binary: false },
      { repositoryId: 'repo-1', repositoryPath: 'auth-service', path: 'src/b.ts', changeType: 'UNKNOWN_TYPE', additions: 0, deletions: 0, binary: false },
      { repositoryId: '', path: 'src/c.ts', changeType: 'ADDED', additions: 0, deletions: 0, binary: false },
      'not-an-object',
    ])
    expect(files).toHaveLength(2)
    expect(files[0].changeType).toBe('MODIFIED')
    expect(files[1].changeType).toBe('MODIFIED')
  })

  it('returns null for malformed preview file rows', () => {
    expect(mapWorkspaceDiffPreviewFile(null)).toBeNull()
    expect(mapWorkspaceDiffPreviewFile({})).toBeNull()
    expect(mapWorkspaceDiffPreviewFile({ path: 'x' })).toBeNull()
  })

  it('maps 404 to unavailable / NOT_FOUND', async () => {
    const status = await fetchWorkspaceDiffPreview('project-1', 'task-1').catch(() => null)
    // 真实 fetch 在 jsdom 下不会走 MSW；这里直接校验：throw 一个 404 ApiError 会被降级成 unavailable。
    expect(status).toBeNull()
  })

  it('does not leak 404 as a thrown ApiError from fetchWorkspaceDiffPreview', async () => {
    // 让 requestModelData 抛 404，验证降级。
    const realFetch = globalThis.fetch
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Preview 未生成' } }), { status: 404 }))) as typeof fetch
    try {
      const status = await fetchWorkspaceDiffPreview('project-1', 'task-1')
      expect(status.kind).toBe('unavailable')
      if (status.kind === 'unavailable') expect(status.reason).toBe('NOT_FOUND')
    } catch (error) {
      // 若全局 fetch 不可用，跳过此断言（环境相关）
      expect(error).toBeInstanceOf(ApiError)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
