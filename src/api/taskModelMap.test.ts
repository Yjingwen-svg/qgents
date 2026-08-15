import { describe, expect, it } from 'vitest'
import {
  mapDiffComment,
  mapDiffFile,
  mapMergeRequest,
  mapMergeRequestChecks,
} from './taskModelMap'

describe('task model Diff / MR mapping', () => {
  it('maps DiffFileResponse changeType and leaves hunks empty when absent', () => {
    const file = mapDiffFile({
      id: 'file-1',
      sequence: 2,
      path: 'src/a.ts',
      changeType: 'ADDED',
      additions: 3,
      deletions: 0,
      binary: false,
    })
    expect(file).toMatchObject({
      id: 'file-1',
      sequence: 2,
      changeType: 'ADDED',
      status: 'ADDED',
      hunks: [],
    })
  })

  it('maps DiffCommentResponse authorUserId without inventing authorName', () => {
    const comment = mapDiffComment({
      id: 'c1',
      diffId: 'd1',
      path: 'src/a.ts',
      side: 'RIGHT',
      line: 12,
      body: 'looks good',
      authorUserId: 'user-002',
      createdAt: '2026-08-15T00:00:00Z',
    })
    expect(comment.authorUserId).toBe('user-002')
    expect(comment.authorName).toBeNull()
    expect(comment.createdAt).toBe('2026-08-15T00:00:00Z')
  })

  it('maps MR checks as a flat array and also accepts a wrapped items payload', () => {
    expect(
      mapMergeRequestChecks([
        { id: 'ck-1', type: 'TESTSET', status: 'PASSED', attemptNo: 1 },
        { id: 'ck-2', type: 'CR_BLOCKING_COMMENTS', status: 'FAILED' },
      ]).map((item) => item.type),
    ).toEqual(['TESTSET'])

    expect(
      mapMergeRequestChecks({
        status: 'PENDING',
        requiredChecks: ['TESTSET'],
        items: [{ id: 'ck-1', name: 'DRY_RUN', status: 'PENDING' }],
      }).map((item) => item.type),
    ).toEqual(['DRY_RUN'])
  })

  it('maps MR summary aliases and treats missing webUrl / description / groupIds as empty', () => {
    const mr = mapMergeRequest({
      id: 'mr-1',
      projectRepositoryId: 'bound-1',
      provider: 'GITHUB',
      number: 42,
      title: '实现邮箱登录',
      sourceBranch: 'feat/login-api',
      targetBranch: 'main',
      status: 'OPEN',
      headCommit: 'abc',
      taskId: 'task-1',
      qualityGate: { status: 'PENDING', requiredChecks: ['TESTSET', 'AI_REVIEW', 'DRY_RUN', 'CQ_PLUS_ONE'] },
    })
    expect(mr.repositoryId).toBe('bound-1')
    expect(mr.webUrl).toBeNull()
    expect(mr.description).toBeNull()
    expect(mr.groupIds).toEqual([])
    expect(mr.taskId).toBe('task-1')
  })
})
