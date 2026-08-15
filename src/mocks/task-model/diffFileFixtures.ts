import type { DiffComment, DiffFile } from '@/types/task-model'

/** 对齐 DiffFileResponse：id/sequence/path/changeType/additions/deletions/binary，无 hunk。 */
export function defaultMockDiffFiles(): DiffFile[] {
  return [
    {
      id: 'file-example',
      sequence: 1,
      path: 'src/example.ts',
      changeType: 'MODIFIED',
      status: 'MODIFIED',
      additions: 1,
      deletions: 1,
      binary: false,
      hunks: [],
    },
  ]
}

export function loginApiDiffFiles(): DiffFile[] {
  return [
    {
      id: 'file-auth-controller',
      sequence: 1,
      path: 'src/auth/AuthController.ts',
      changeType: 'MODIFIED',
      status: 'MODIFIED',
      additions: 8,
      deletions: 2,
      binary: false,
      hunks: [],
    },
    {
      id: 'file-jwt-middleware',
      sequence: 2,
      path: 'src/auth/JwtMiddleware.ts',
      changeType: 'ADDED',
      status: 'ADDED',
      additions: 18,
      deletions: 0,
      binary: false,
      hunks: [],
    },
    {
      id: 'file-auth-types',
      sequence: 3,
      path: 'src/auth/types.ts',
      changeType: 'ADDED',
      status: 'ADDED',
      additions: 12,
      deletions: 0,
      binary: false,
      hunks: [],
    },
    {
      id: 'file-auth-test',
      sequence: 4,
      path: 'test/auth/AuthController.test.ts',
      changeType: 'ADDED',
      status: 'ADDED',
      additions: 16,
      deletions: 0,
      binary: false,
      hunks: [],
    },
    {
      id: 'file-login-flow',
      sequence: 5,
      path: 'docs/login-flow.png',
      changeType: 'ADDED',
      status: 'ADDED',
      additions: 0,
      deletions: 0,
      binary: true,
      hunks: [],
    },
  ]
}

/** 对齐 DiffCommentResponse：authorUserId，无 authorName。 */
export function loginApiDiffComments(diffId: string): DiffComment[] {
  return [
    {
      id: `comment-${diffId}-1`,
      diffId,
      path: 'src/auth/AuthController.ts',
      side: 'RIGHT',
      line: 20,
      hunkId: null,
      commitSha: 'a1b2c3d',
      body: '密码有做哈希吗？还是明文比对？',
      authorUserId: 'user-002',
      authorName: null,
      createdAt: '2026-05-16T11:20:00Z',
    },
    {
      id: `comment-${diffId}-2`,
      diffId,
      path: 'src/auth/AuthController.ts',
      side: 'RIGHT',
      line: 20,
      hunkId: null,
      commitSha: 'a1b2c3d',
      body: 'AuthService 里 bcrypt.compare，下一提交补测试。',
      authorUserId: 'user-001',
      authorName: null,
      createdAt: '2026-05-16T11:35:00Z',
    },
  ]
}
