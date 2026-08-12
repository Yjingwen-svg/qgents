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
    installationId: 'gh-install-1001',
    accountLogin: 'Yjingwen-svg',
    accountType: 'User',
    installedAt: '2026-08-01T08:00:00Z',
    status: 'ACTIVE',
    authorizedRepoCount: 2,
  },
  {
    installationId: 'gh-install-1002',
    accountLogin: 'qgents-lab',
    accountType: 'Organization',
    installedAt: '2026-08-08T10:00:00Z',
    status: 'ACTIVE',
    authorizedRepoCount: 1,
  },
]

/** 团队授权仓库（带 installationId，便于按安装过滤） */
const mockAuthorizedRepos: GithubAuthorizedRepository[] = [
  {
    repositoryId: 'repo-1',
    fullName: 'Yjingwen-svg/qgents-web',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-web',
    private: false,
    installationId: 'gh-install-1001',
    defaultBranch: 'main',
    syncStatus: 'SYNCED',
  },
  {
    repositoryId: 'repo-2',
    fullName: 'Yjingwen-svg/qgents-server',
    githubUrl: 'https://github.com/Yjingwen-svg/qgents-server',
    private: true,
    installationId: 'gh-install-1001',
    defaultBranch: 'main',
    syncStatus: 'SYNCED',
  },
  {
    repositoryId: 'repo-3',
    fullName: 'qgents-lab/pet-app',
    githubUrl: 'https://github.com/qgents-lab/pet-app',
    private: false,
    installationId: 'gh-install-1002',
    defaultBranch: 'develop',
    syncStatus: 'NOT_SYNCED',
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
      mockInstallations = mockInstallations.filter(
        (i) => i.installationId !== params.installationId,
      )
      return new HttpResponse(null, { status: 204 })
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
        installationId: 'gh-install-1001',
        repositoryId: 'repo-1',
        fullName: 'Yjingwen-svg/qgents-web',
        githubUrl: 'https://github.com/Yjingwen-svg/qgents-web',
        displayName: 'qgents-web',
        defaultBranch: 'main',
        boundProjectId: 'proj-qgents',
        boundProjectName: 'Qgents Web',
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-08-10T12:00:00Z',
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
          defaultBranch?: string
          displayName?: string
        }
        const record = {
          id: `bound-${projectId}-${body.repositoryId ?? 'repo'}`,
          installationId: body.installationId ?? 'unknown',
          repositoryId: body.repositoryId ?? 'unknown',
          fullName: body.displayName ?? 'demo/repo',
          githubUrl: `https://github.com/${body.displayName ?? 'demo/repo'}`,
          displayName: body.displayName,
          defaultBranch: body.defaultBranch ?? 'main',
          boundProjectId: projectId,
          boundProjectName: projectId,
          syncStatus: 'SYNCED' as const,
          lastSyncedAt: new Date().toISOString(),
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
