// 中间显示的代码内容（AuthController.ts 那些行就写在这里）
import type { DiffFile, DiffLine, DiffReviewView } from '@/types/diff'
import { findDemoBranchById } from './codeBranchDemo'

function ctx(oldLine: number, newLine: number, text: string): DiffLine {
  return { kind: 'CONTEXT', oldLine, newLine, text }
}

function add(newLine: number, text: string): DiffLine {
  return { kind: 'ADD', oldLine: null, newLine, text }
}

function del(oldLine: number, text: string): DiffLine {
  return { kind: 'DEL', oldLine, newLine: null, text }
}

const AUTH_CONTROLLER: DiffFile = {
  id: 'file-auth-controller',
  sequence: 1,
  path: 'src/auth/AuthController.ts',
  changeType: 'MODIFIED',
  status: 'MODIFIED',
  additions: 8,
  deletions: 2,
  binary: false,
  hunks: [
    {
      id: 'hunk-login',
      header: '@@ -17,7 +17,10 @@ export class AuthController {',
      lines: [
        ctx(17, 17, '  @Post(\'login\')'),
        ctx(18, 18, '  async login(@Body() dto: LoginDto) {'),
        ctx(19, 19, '    this.logger.info(\'login attempt\', dto.email)'),
        del(20, '    return this.authService.loginByPhone(dto)'),
        add(20, '    return this.authService.loginByEmail({'),
        add(21, '      email: dto.email,'),
        add(22, '      password: dto.password,'),
        add(23, '    })'),
        ctx(21, 24, '  }'),
        ctx(22, 25, ''),
      ],
    },
    {
      id: 'hunk-error',
      header: '@@ -29,4 +32,9 @@ export class AuthController {',
      lines: [
        ctx(29, 32, '    if (!user) {'),
        del(30, '      throw new UnauthorizedException()'),
        add(33, '      throw new UnauthorizedException({'),
        add(34, '        code: \'INVALID_CREDENTIALS\','),
        add(35, '        message: \'邮箱或密码错误\','),
        add(36, '      })'),
        ctx(31, 37, '    }'),
        ctx(32, 38, '    return this.tokenService.sign(user)'),
      ],
    },
  ],
}

const JWT_MIDDLEWARE: DiffFile = {
  id: 'file-jwt-middleware',
  sequence: 2,
  path: 'src/auth/JwtMiddleware.ts',
  changeType: 'ADDED',
  status: 'ADDED',
  additions: 18,
  deletions: 0,
  binary: false,
  hunks: [
    {
      id: 'hunk-jwt',
      header: '@@ -0,0 +1,18 @@',
      lines: [
        add(1, 'import { Injectable, NestMiddleware } from \'@nestjs/common\''),
        add(2, 'import { JwtService } from \'./JwtService\''),
        add(3, ''),
        add(4, '@Injectable()'),
        add(5, 'export class JwtMiddleware implements NestMiddleware {'),
        add(6, '  constructor(private readonly jwt: JwtService) {}'),
        add(7, ''),
        add(8, '  use(req: { headers: Record<string, string | undefined> }, _res: unknown, next: () => void) {'),
        add(9, '    const token = req.headers.authorization?.replace(\'Bearer \', \'\')'),
        add(10, '    if (token) req.headers[\'x-user-id\'] = this.jwt.verify(token).userId'),
        add(11, '    next()'),
        add(12, '  }'),
        add(13, '}'),
      ],
    },
  ],
}

const AUTH_TYPES: DiffFile = {
  id: 'file-auth-types',
  sequence: 3,
  path: 'src/auth/types.ts',
  changeType: 'ADDED',
  status: 'ADDED',
  additions: 12,
  deletions: 0,
  binary: false,
  hunks: [
    {
      id: 'hunk-types',
      header: '@@ -0,0 +1,12 @@',
      lines: [
        add(1, 'export interface LoginDto {'),
        add(2, '  email: string'),
        add(3, '  password: string'),
        add(4, '}'),
        add(5, ''),
        add(6, 'export interface AuthUser {'),
        add(7, '  id: string'),
        add(8, '  email: string'),
        add(9, '}'),
      ],
    },
  ],
}

const AUTH_TEST: DiffFile = {
  id: 'file-auth-test',
  sequence: 4,
  path: 'test/auth/AuthController.test.ts',
  changeType: 'ADDED',
  status: 'ADDED',
  additions: 16,
  deletions: 0,
  binary: false,
  hunks: [
    {
      id: 'hunk-test',
      header: '@@ -0,0 +1,16 @@',
      lines: [
        add(1, 'import { loginByEmail } from \'../../src/auth/AuthService\''),
        add(2, ''),
        add(3, 'describe(\'loginByEmail\', () => {'),
        add(4, '  it(\'rejects empty password\', async () => {'),
        add(5, '    await expect(loginByEmail({ email: \'a@b.c\', password: \'\' })).rejects.toThrow()'),
        add(6, '  })'),
        add(7, '})'),
      ],
    },
  ],
}

const LOGIN_FLOW_PNG: DiffFile = {
  id: 'file-login-flow',
  sequence: 5,
  path: 'docs/login-flow.png',
  changeType: 'ADDED',
  status: 'ADDED',
  additions: 0,
  deletions: 0,
  binary: true,
  hunks: [],
}

function loginDiff(repositoryName: string): DiffReviewView {
  const files = [AUTH_CONTROLLER, JWT_MIDDLEWARE, AUTH_TYPES, AUTH_TEST, LOGIN_FLOW_PNG]
  return {
    id: 'diff-demo-login',
    displayCode: 'D-1024',
    title: '登录接口实现',
    status: 'PENDING_REVIEW',
    sourceBranch: 'feat/login-api',
    targetBranch: 'main',
    repositoryName,
    taskCode: 'T-1024',
    taskTitle: '登录接口开发',
    requirementGroupId: 'login',
    requirementTitle: '登录功能',
    authorName: '陈同学',
    headCommit: 'a1b2c3d',
    changeStats: { files: files.length, additions: 230, deletions: 12 },
    files,
    comments: [
      {
        id: 'cmt-1',
        authorName: '李同学',
        body: '这里直接把 password 透传到 service，要不要先做一次空值校验？',
        createdAt: '2026-08-13T11:20:00Z',
        path: 'src/auth/AuthController.ts',
        line: 22,
        side: 'RIGHT',
      },
      {
        id: 'cmt-2',
        authorName: '陈同学',
        body: '校验放在 DTO pipe 里了，我补一行注释标一下。',
        createdAt: '2026-08-13T11:26:00Z',
        path: 'src/auth/AuthController.ts',
        line: 22,
        side: 'RIGHT',
        replyToId: 'cmt-1',
      },
    ],
  }
}

const DETAILED_BY_BRANCH: Record<string, DiffReviewView> = {
  'br-auth-login': loginDiff('auth-service'),
  'br-qgents-login': loginDiff('auth-service'),
}

function genericDiff(branchId: string): DiffReviewView {
  const found = findDemoBranchById(branchId)
  const branch = found?.branch
  const repoName =
    found?.repo.displayName || found?.repo.fullName.split('/').pop() || 'repository'
  const source = branch?.name ?? branchId
  const additions = branch?.diffAdditions ?? 8
  const deletions = branch?.diffDeletions ?? 1

  return {
    id: `diff-demo-${branchId}`,
    displayCode: 'D-DEMO',
    title: branch?.relatedTask?.title || `${source} 变更`,
    status: branch?.healthStatus === 'MERGED' ? 'ACCEPTED' : 'PENDING_REVIEW',
    sourceBranch: source,
    targetBranch: found?.repo.defaultBranch || '默认分支',
    repositoryName: repoName,
    taskCode: branch?.relatedTask?.code,
    taskTitle: branch?.relatedTask?.title,
    requirementGroupId: branch?.requirementGroupId,
    requirementTitle: branch?.requirementTitle,
    authorName: branch?.createdBy || '陈同学',
    headCommit: branch?.latestCommitSha,
    changeStats: { files: 2, additions, deletions },
    files: [
      {
        id: 'file-index',
        sequence: 1,
        path: 'src/index.ts',
        changeType: 'MODIFIED',
        status: 'MODIFIED',
        additions,
        deletions,
        binary: false,
        hunks: [
          {
            id: 'hunk-generic',
            header: '@@ -1,6 +1,8 @@',
            lines: [
              ctx(1, 1, 'export function boot() {'),
              del(2, '  console.log(\'start\')'),
              add(2, '  console.log(\'boot\', process.env.NODE_ENV)'),
              add(3, '  return true'),
              ctx(3, 4, '}'),
            ],
          },
        ],
      },
      {
        id: 'file-readme',
        sequence: 2,
        path: 'README.md',
        changeType: 'ADDED',
        status: 'ADDED',
        additions: 3,
        deletions: 0,
        binary: false,
        hunks: [
          {
            id: 'hunk-readme',
            header: '@@ -0,0 +1,3 @@',
            lines: [
              add(1, `# ${repoName}`),
              add(2, ''),
              add(3, `分支 ${source} 的演示 Diff。`),
            ],
          },
        ],
      },
    ],
    comments: [],
  }
}

/**
 * 按分支行 id 取演示 Diff。接口未返回文件/hunk 时，详情页走这份静态数据。
 */
export function getDemoDiffReview(branchId: string): DiffReviewView | null {
  const detailed = DETAILED_BY_BRANCH[branchId]
  if (detailed) return detailed

  const found = findDemoBranchById(branchId)
  if (found && found.branch.diffAdditions === 0 && found.branch.diffDeletions === 0) {
    return null
  }

  return genericDiff(branchId)
}
