import { http, HttpResponse } from 'msw'
import type { GithubAuthorizedRepository, GithubInstallation } from '@/types/github'

/**
 * MSW Mock —— 接口文档 §6 GitHub App
 *
 * ============================================================================
 * 启用条件：.env 中 VITE_USE_MOCK=true，且 main.tsx 已调用 worker.start()
 *
 * 联调真实后端时：
 * 1. 将 VITE_USE_MOCK 设为 false（或删掉）
 * 2. 在 vite.config.ts 打开 proxy，把 /api 转到 Java（如 http://localhost:8080）
 * 3. 本文件的 handler 将不再拦截（或可暂时注释掉 github 相关路由）
 * ============================================================================
 */

const MOCK_TEAM_ID = 'team-xinghe'

/** 模拟：团队已安装记录（个人 + 组织） */
let mockInstallations: GithubInstallation[] = [
  {
    id: 'gh-install-1001',
    providerInstallationId: 12345678,
    accountLogin: 'Yjingwen-svg',
    accountType: 'USER',
    installedAt: '2026-08-01T08:00:00Z',
    status: 'ACTIVE',
    metadataSyncedAt: '2026-08-13T10:00:00Z',
  },
  {
    id: 'gh-install-1002',
    providerInstallationId: 87654321,
    accountLogin: 'qgents-lab',
    accountType: 'ORGANIZATION',
    installedAt: '2026-08-08T10:00:00Z',
    status: 'ACTIVE',
    metadataSyncedAt: '2026-08-13T10:00:00Z',
  },
]

/** 团队授权仓库（带 installationId，便于按安装过滤） */
const mockAuthorizedRepos: GithubAuthorizedRepository[] = [
  {
    id: 'repo-1',
    installationId: 'gh-install-1001',
    providerRepositoryId: 987654321,
    fullName: 'Yjingwen-svg/qgents-web',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-web',
    defaultBranch: 'main',
    visibility: 'PUBLIC',
    archived: false,
    authorizationStatus: 'AUTHORIZED',
    metadataSyncedAt: '2026-08-13T10:00:00Z',
  },
  {
    id: 'repo-2',
    installationId: 'gh-install-1001',
    providerRepositoryId: 987654322,
    fullName: 'Yjingwen-svg/qgents-server',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-server',
    defaultBranch: 'main',
    visibility: 'PRIVATE',
    archived: false,
    authorizationStatus: 'AUTHORIZED',
    metadataSyncedAt: '2026-08-13T10:00:00Z',
  },
  {
    id: 'repo-3',
    installationId: 'gh-install-1002',
    providerRepositoryId: 987654323,
    fullName: 'qgents-lab/pet-app',
    githubUrl: 'https://github.com/qgents-lab/pet-app',
    defaultBranch: 'develop',
    visibility: 'PRIVATE',
    archived: false,
    authorizationStatus: 'AUTHORIZED',
    metadataSyncedAt: '2026-08-13T09:00:00Z',
  },
]

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', source: 'msw' })),

  /** GET /teams/{teamId}/integrations/github/installations */
  http.get('/api/teams/:teamId/integrations/github/installations', ({ params }) => {
    if (params.teamId !== MOCK_TEAM_ID) {
      return HttpResponse.json({ data: [], requestId: 'req_mock_empty' })
    }
    return HttpResponse.json({
      data: mockInstallations,
      requestId: 'req_mock_installations',
    })
  }),

  /** GET /teams/{teamId}/integrations/github/repositories */
  http.get('/api/teams/:teamId/integrations/github/repositories', ({ params }) => {
    if (params.teamId !== MOCK_TEAM_ID) {
      return HttpResponse.json({ data: [], requestId: 'req_mock_repos_empty' })
    }
    return HttpResponse.json({
      data: mockAuthorizedRepos,
      requestId: 'req_mock_authorized_repos',
    })
  }),

  /**
   * POST /teams/{teamId}/integrations/github/installations
   *
   * 模拟后端「生成安装跳转地址」：
   * - 真实环境 URL 由后端签发（含 state）
   * - Mock 返回 GitHub App 安装页形态，便于前端验证「拿到 URL 后整页跳转」
   *
   * 注意：若 GitHub 上尚无名为 qgents 的 App，跳转后可能 404，这只说明
   * 「前端跳转逻辑已通」；真联调时以后端返回的 installationUrl 为准。
   */
  http.post('/api/teams/:teamId/integrations/github/installations', ({ params, request }) => {
    const teamId = String(params.teamId)
    const idempotencyKey = request.headers.get('Idempotency-Key')
    console.info('[MSW] createInstallation', { teamId, idempotencyKey })

    const state = encodeURIComponent(`mock:${teamId}:${Date.now()}`)
    const installationUrl = `https://github.com/apps/qgents/installations/new?state=${state}`

    return HttpResponse.json({
      data: {
        installationUrl,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      requestId: 'req_mock_install_redirect',
    })
  }),

  http.delete(
    '/api/teams/:teamId/integrations/github/installations/:installationId',
    ({ params }) => {
      mockInstallations = mockInstallations.filter((i) => i.id !== params.installationId)
      return new HttpResponse(null, { status: 204 })
    },
  ),

  /** POST .../installations/{installationId}/sync —— 刷新 Installation 与授权仓库元数据 */
  http.post(
    '/api/teams/:teamId/integrations/github/installations/:installationId/sync',
    ({ params }) => {
      const installationId = String(params.installationId)
      const now = new Date().toISOString()
      mockInstallations = mockInstallations.map((i) =>
        i.id === installationId ? { ...i, metadataSyncedAt: now } : i,
      )
      mockAuthorizedRepos.forEach((repo, index) => {
        if (repo.installationId === installationId) {
          mockAuthorizedRepos[index] = { ...repo, metadataSyncedAt: now }
        }
      })
      const updated = mockInstallations.find((i) => i.id === installationId)
      if (!updated) {
        return HttpResponse.json(
          {
            error: {
              code: 'GITHUB_RESOURCE_NOT_FOUND',
              message: 'Installation 不存在',
              details: [],
            },
            requestId: 'req_mock_sync_404',
          },
          { status: 404 },
        )
      }
      return HttpResponse.json({ data: updated, requestId: 'req_mock_sync' })
    },
  ),

  /** GET /teams/{teamId}/projects —— Owner 绑定仓库时用 */
  http.get('/api/teams/:teamId/projects', ({ params }) => {
    if (params.teamId !== MOCK_TEAM_ID) {
      return HttpResponse.json({ data: [], requestId: 'req_mock_projects_empty' })
    }
    return HttpResponse.json({
      data: [
        {
          id: 'proj-qgents',
          teamId: MOCK_TEAM_ID,
          name: 'Qgents Web',
          description: '前端与联调演示项目',
          createdAt: '2026-08-01T00:00:00Z',
        },
        {
          id: 'proj-server',
          teamId: MOCK_TEAM_ID,
          name: 'Qgents 后端',
          description: '服务端项目',
          createdAt: '2026-08-02T00:00:00Z',
        },
        {
          id: 'proj-pet',
          teamId: MOCK_TEAM_ID,
          name: '宠影记',
          description: '示例业务项目',
          createdAt: '2026-08-03T00:00:00Z',
        },
      ],
      requestId: 'req_mock_team_projects',
    })
  }),

  /** 项目已绑定仓库内存表（MSW 进程内） */
  // 用闭包变量模拟后端落库
  ...(() => {
    const bindings = new Map<string, import('@/types/github').ProjectBoundRepository[]>()
    bindings.set('proj-qgents', [
      {
        id: 'bound-proj-qgents-repo-1',
        repositoryId: 'repo-1',
        installationId: 'gh-install-1001',
        providerRepositoryId: 987654321,
        fullName: 'Yjingwen-svg/qgents-web',
        githubUrl: 'https://github.com/Yjingwen-svg/qgents-web',
        displayName: 'qgents-web',
        defaultBranch: 'main',
        authorizationStatus: 'AUTHORIZED',
        metadataSyncedAt: '2026-08-13T10:00:00Z',
        boundAt: '2026-08-10T12:00:00Z',
      },
    ])
    bindings.set('demo-project', [
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
    ])

    return [
      http.get('/api/projects/:projectId/repositories', ({ params }) => {
        const projectId = String(params.projectId)
        return HttpResponse.json({
          data: bindings.get(projectId) ?? [],
          requestId: 'req_mock_project_repos',
        })
      }),

      http.post('/api/projects/:projectId/repositories', async ({ params, request }) => {
        const projectId = String(params.projectId)
        const body = (await request.json().catch(() => ({}))) as {
          installationId?: string
          repositoryId?: string
          displayName?: string
        }
        const source = mockAuthorizedRepos.find((r) => r.id === body.repositoryId)
        const record: import('@/types/github').ProjectBoundRepository = {
          id: `bound-${projectId}-${body.repositoryId ?? 'repo'}`,
          installationId: body.installationId ?? source?.installationId ?? 'unknown',
          repositoryId: body.repositoryId ?? 'unknown',
          providerRepositoryId: source?.providerRepositoryId ?? 0,
          fullName: source?.fullName ?? body.displayName ?? 'demo/repo',
          githubUrl: source?.githubUrl ?? `https://github.com/${body.displayName ?? 'demo/repo'}`,
          displayName:
            body.displayName ?? source?.fullName.split('/').pop() ?? source?.fullName,
          defaultBranch: source?.defaultBranch ?? '',
          authorizationStatus: source?.authorizationStatus ?? 'AUTHORIZED',
          metadataSyncedAt: source?.metadataSyncedAt ?? new Date().toISOString(),
          boundAt: new Date().toISOString(),
        }
        const prev = (bindings.get(projectId) ?? []).filter(
          (b) => b.repositoryId !== record.repositoryId,
        )
        bindings.set(projectId, [...prev, record])
        return HttpResponse.json({ data: record, requestId: 'req_mock_bind_repo' })
      }),

      http.delete('/api/projects/:projectId/repositories/:bindingId', ({ params }) => {
        const projectId = String(params.projectId)
        const bindingId = String(params.bindingId)
        const next = (bindings.get(projectId) ?? []).filter(
          (b) => b.id !== bindingId && b.repositoryId !== bindingId,
        )
        bindings.set(projectId, next)
        return new HttpResponse(null, { status: 204 })
      }),
    ]
  })(),
]
