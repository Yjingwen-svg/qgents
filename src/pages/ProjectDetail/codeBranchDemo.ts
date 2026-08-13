import type { ProjectBoundRepository } from '@/types/github'
import type { ProjectBranchRow } from '@/types/codeBranch'

/**
 * demo-project 在未拉到真实绑定列表时的仓库占位
 * 字段对齐 ProjectBoundRepository；id 为绑定记录 id，不是 GitHub 数字 ID
 */
export const DEMO_BOUND_REPOS: ProjectBoundRepository[] = [
  {
    id: 'bound-demo-auth-service',
    repositoryId: 'repo-2',
    installationId: 'gh-install-1001',
    providerRepositoryId: 987654322,
    fullName: 'Yjingwen-svg/qgents-server',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-server',
    displayName: 'auth-service',
    defaultBranch: 'main',
    authorizationStatus: 'AUTHORIZED',
    metadataSyncedAt: '2026-08-13T10:00:00Z',
    boundAt: '2026-08-10T12:00:00Z',
  },
  {
    id: 'bound-demo-web-console',
    repositoryId: 'repo-1',
    installationId: 'gh-install-1001',
    providerRepositoryId: 987654321,
    fullName: 'Yjingwen-svg/qgents-web',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-web',
    displayName: 'web-console',
    defaultBranch: 'main',
    authorizationStatus: 'AUTHORIZED',
    metadataSyncedAt: '2026-08-13T10:00:00Z',
    boundAt: '2026-08-10T12:00:00Z',
  },
  {
    id: 'bound-demo-shared-sdk',
    repositoryId: 'repo-3',
    installationId: 'gh-install-1002',
    providerRepositoryId: 987654323,
    fullName: 'qgents-lab/pet-app',
    githubUrl: 'https://github.com/qgents-lab/pet-app',
    displayName: 'shared-sdk',
    defaultBranch: 'main',
    authorizationStatus: 'AUTHORIZED',
    metadataSyncedAt: '2026-08-13T09:00:00Z',
    boundAt: '2026-08-11T09:00:00Z',
  },
]

const REPO_ALIAS: Record<string, string> = {
  'bound-demo-auth-service': '认证服务',
  'bound-demo-web-console': '前端控制台',
  'bound-demo-shared-sdk': '共享 SDK',
  'bound-proj-qgents-repo-1': '前端控制台',
}

export function repoAlias(repo: ProjectBoundRepository): string | undefined {
  return REPO_ALIAS[repo.id]
}

function row(
  partial: Omit<ProjectBranchRow, 'diffDeletions'> & { diffDeletions?: number },
): ProjectBranchRow {
  return {
    diffDeletions: partial.diffDeletions ?? 0,
    ...partial,
  }
}

const BRANCHES_BY_BINDING: Record<string, ProjectBranchRow[]> = {
  'bound-demo-auth-service': [
    row({
      id: 'br-auth-login',
      projectRepositoryId: 'bound-demo-auth-service',
      name: 'feat/login-api',
      protected: false,
      healthStatus: 'HEALTHY',
      relatedTask: { code: 'T-1024', title: '登录接口开发' },
      requirementGroupId: 'login',
      requirementTitle: '登录功能',
      workspaceName: 'ws-login-api',
      createdBy: '张同学',
      createdAt: '2026-05-16T10:30:00Z',
      commitCount: 18,
      diffAdditions: 230,
      diffDeletions: 12,
      mrCount: 1,
      testStatus: 'PASSED',
      latestCommitSha: 'a1b2c3d',
      latestCommitMessage: 'feat: 邮箱登录接口',
      artifactName: 'auth-service-login.zip',
      artifactPublished: true,
    }),
    row({
      id: 'br-auth-main',
      projectRepositoryId: 'bound-demo-auth-service',
      name: 'main',
      protected: true,
      healthStatus: 'HEALTHY',
      relatedTask: null,
      commitCount: 128,
      diffAdditions: 0,
      diffDeletions: 0,
      mrCount: 0,
      testStatus: 'PASSED',
      latestCommitSha: '9f8e7d6',
      latestCommitMessage: 'chore: 同步受保护分支',
    }),
    row({
      id: 'br-auth-pay',
      projectRepositoryId: 'bound-demo-auth-service',
      name: 'feat/payment-hook',
      protected: false,
      healthStatus: 'CONFLICT',
      relatedTask: { code: 'T-1028', title: '支付回调校验' },
      requirementGroupId: 'pay',
      requirementTitle: '支付回调',
      workspaceName: 'ws-payment-hook',
      createdBy: '李同学',
      createdAt: '2026-06-02T14:10:00Z',
      commitCount: 9,
      diffAdditions: 88,
      diffDeletions: 20,
      mrCount: 0,
      testStatus: 'FAILED',
      latestCommitSha: 'c4d5e6f',
      latestCommitMessage: 'fix: 回调验签',
    }),
  ],
  'bound-demo-web-console': [
    row({
      id: 'br-web-login',
      projectRepositoryId: 'bound-demo-web-console',
      name: 'feat/login-api',
      protected: false,
      healthStatus: 'HEALTHY',
      relatedTask: { code: 'T-1024', title: '登录接口开发' },
      requirementGroupId: 'login',
      requirementTitle: '登录功能',
      workspaceName: 'ws-login-web',
      createdBy: '陈同学',
      createdAt: '2026-05-16T11:00:00Z',
      commitCount: 22,
      diffAdditions: 410,
      diffDeletions: 36,
      mrCount: 1,
      testStatus: 'RUNNING',
      latestCommitSha: 'b7c8d9e',
      latestCommitMessage: 'feat: 登录页邮箱密码表单',
    }),
    row({
      id: 'br-web-main',
      projectRepositoryId: 'bound-demo-web-console',
      name: 'main',
      protected: true,
      healthStatus: 'HEALTHY',
      relatedTask: null,
      commitCount: 96,
      diffAdditions: 0,
      mrCount: 0,
      testStatus: 'PASSED',
      latestCommitSha: '1122334',
      latestCommitMessage: 'chore: release',
    }),
    row({
      id: 'br-web-dash',
      projectRepositoryId: 'bound-demo-web-console',
      name: 'feat/dashboard',
      protected: false,
      healthStatus: 'BEHIND',
      relatedTask: { code: 'T-1031', title: '数据看板图表' },
      requirementGroupId: 'dashboard',
      requirementTitle: '数据看板',
      workspaceName: 'ws-dashboard',
      createdBy: '陈同学',
      createdAt: '2026-07-01T09:20:00Z',
      commitCount: 6,
      diffAdditions: 40,
      diffDeletions: 8,
      mrCount: 0,
      testStatus: 'PENDING',
      latestCommitSha: '778899a',
      latestCommitMessage: 'wip: 看板骨架',
    }),
  ],
  'bound-demo-shared-sdk': [
    row({
      id: 'br-sdk-login',
      projectRepositoryId: 'bound-demo-shared-sdk',
      name: 'feat/login-api',
      protected: false,
      healthStatus: 'MERGED',
      relatedTask: { code: 'T-1024', title: '登录接口开发' },
      requirementGroupId: 'login',
      requirementTitle: '登录功能',
      workspaceName: 'ws-login-sdk',
      createdBy: '张同学',
      createdAt: '2026-05-15T16:00:00Z',
      commitCount: 4,
      diffAdditions: 52,
      diffDeletions: 3,
      mrCount: 1,
      testStatus: 'PASSED',
      latestCommitSha: 'aa11bb2',
      latestCommitMessage: 'feat: 登录 DTO',
      artifactName: 'shared-sdk.tgz',
      artifactPublished: true,
    }),
    row({
      id: 'br-sdk-main',
      projectRepositoryId: 'bound-demo-shared-sdk',
      name: 'main',
      protected: true,
      healthStatus: 'HEALTHY',
      relatedTask: null,
      commitCount: 41,
      diffAdditions: 0,
      mrCount: 0,
      testStatus: 'PASSED',
    }),
  ],
  'bound-proj-qgents-repo-1': [
    row({
      id: 'br-qgents-login',
      projectRepositoryId: 'bound-proj-qgents-repo-1',
      name: 'feat/login-api',
      protected: false,
      healthStatus: 'HEALTHY',
      relatedTask: { code: 'T-1024', title: '登录接口开发' },
      requirementGroupId: 'login',
      requirementTitle: '登录功能',
      commitCount: 18,
      diffAdditions: 230,
      diffDeletions: 12,
      mrCount: 1,
      testStatus: 'PASSED',
      createdBy: '张同学',
      createdAt: '2026-05-16T10:30:00Z',
      latestCommitSha: 'a1b2c3d',
      latestCommitMessage: 'feat: 邮箱登录',
    }),
    row({
      id: 'br-qgents-main',
      projectRepositoryId: 'bound-proj-qgents-repo-1',
      name: 'main',
      protected: true,
      healthStatus: 'HEALTHY',
      relatedTask: null,
      commitCount: 128,
      diffAdditions: 0,
      mrCount: 0,
      testStatus: 'PASSED',
    }),
  ],
}

const BRANCHES_BY_FULL_NAME: Record<string, string> = {
  'Yjingwen-svg/qgents-server': 'bound-demo-auth-service',
  'Yjingwen-svg/qgents-web': 'bound-demo-web-console',
  'qgents-lab/pet-app': 'bound-demo-shared-sdk',
}

export function demoBoundReposForProject(projectId: string): ProjectBoundRepository[] {
  if (projectId === 'demo-project') return DEMO_BOUND_REPOS
  return []
}

/**
 * 分支列表：优先按绑定 id 取演示行；没有则按 fullName；再没有则只展示默认分支占位。
 * 不得把缺失的 defaultBranch 回退成 main。
 */
export function branchesForBoundRepo(repo: ProjectBoundRepository): ProjectBranchRow[] {
  const direct = BRANCHES_BY_BINDING[repo.id]
  if (direct) return direct

  const mappedId = BRANCHES_BY_FULL_NAME[repo.fullName]
  if (mappedId && BRANCHES_BY_BINDING[mappedId]) {
    return BRANCHES_BY_BINDING[mappedId].map((b) => ({
      ...b,
      id: `${repo.id}-${b.id}`,
      projectRepositoryId: repo.id,
    }))
  }

  if (!repo.defaultBranch) return []

  return [
    {
      id: `${repo.id}-default`,
      projectRepositoryId: repo.id,
      name: repo.defaultBranch,
      protected: true,
      healthStatus: 'HEALTHY',
      relatedTask: null,
      commitCount: 0,
      diffAdditions: 0,
      diffDeletions: 0,
      mrCount: 0,
      testStatus: 'PENDING',
    },
  ]
}
