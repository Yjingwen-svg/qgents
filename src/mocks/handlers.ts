import { http, HttpResponse } from 'msw'
import type { GithubAuthorizedRepository, GithubInstallation } from '@/types/github'
import type { Group, Message } from '@/types/group'

// ══════════════════════════════════════════════
// Mock 数据
// ══════════════════════════════════════════════

const MOCK_USER = {
  id: 'user-001',
  email: 'demo@qgents.dev',
  displayName: '陈同学',
  avatarChar: '陈',
}

const MOCK_TEAMS = [
  {
    id: 'team-owned-001',
    name: '星河工作室',
    description: '全栈开发团队，专注内部工具与开源项目',
    createdAt: '2026-06-01T08:00:00Z',
    myRole: 'TEAM_OWNER' as const,
    memberCount: 5,
  },
  {
    id: 'team-joined-001',
    name: '广工创新团队',
    description: '校园技术团队，AI 与 Web 方向',
    createdAt: '2026-05-15T08:00:00Z',
    myRole: 'TEAM_MEMBER' as const,
    memberCount: 8,
  },
]

const MOCK_TEAM_MEMBERS = [
  { userId: 'user-001', displayName: '陈同学', email: 'demo@qgents.dev', role: 'TEAM_OWNER' as const },
  { userId: 'user-002', displayName: '张工', email: 'zhang@example.com', role: 'TEAM_MEMBER' as const },
  { userId: 'user-003', displayName: '李设计', email: 'li@example.com', role: 'TEAM_MEMBER' as const },
  { userId: 'user-004', displayName: '王测试', email: 'wang@example.com', role: 'TEAM_MEMBER' as const },
  { userId: 'user-005', displayName: '赵架构', email: 'zhao@example.com', role: 'TEAM_MEMBER' as const },
]

const MOCK_PROJECTS: Record<string, Array<{ id: string; teamId: string; name: string; description: string; createdAt: string; myRole: 'PROJECT_ADMIN' | 'PROJECT_MEMBER'; repositoryCount: number }>> = {
  'team-owned-001': [
    { id: 'proj-001', teamId: 'team-owned-001', name: 'Qgents', description: '团队多人 + 多 Agent 云端协作开发平台', createdAt: '2026-07-01T08:00:00Z', myRole: 'PROJECT_ADMIN', repositoryCount: 3 },
    { id: 'proj-002', teamId: 'team-owned-001', name: '宠影记', description: '宠物健康管理小程序', createdAt: '2026-07-15T08:00:00Z', myRole: 'PROJECT_ADMIN', repositoryCount: 1 },
  ],
  'team-joined-001': [
    { id: 'proj-003', teamId: 'team-joined-001', name: 'AI 决策系统', description: '校园选课推荐与学业规划', createdAt: '2026-06-10T08:00:00Z', myRole: 'PROJECT_MEMBER', repositoryCount: 2 },
    { id: 'proj-004', teamId: 'team-joined-001', name: '校园助手', description: '课表、成绩、图书馆一站式查询', createdAt: '2026-08-01T08:00:00Z', myRole: 'PROJECT_MEMBER', repositoryCount: 1 },
  ],
}

let nextTeamId = 10
let nextProjectId = 10

// ══════════════════════════════════════════════
// 群聊（Group / Message）Mock 数据 —— 对齐接口文档 v1.1.8 §7
// ══════════════════════════════════════════════

const MOCK_GROUPS: Record<string, Group[]> = {
  'proj-001': [
    {
      id: 'group-main-proj-001',
      projectId: 'proj-001',
      type: 'PROJECT_MAIN',
      title: '项目总群',
      description: '项目级讨论与结构化动态',
      status: 'ACTIVE',
      memberCount: 5,
      latestActivityAt: '2026-08-12T10:05:00Z',
      unreadCount: 0,
      isPinned: true,
      isArchived: false,
    },
    {
      id: 'group-login-proj-001',
      projectId: 'proj-001',
      type: 'REQUIREMENT',
      title: '登录功能',
      description: '账号与登录体验',
      status: 'ACTIVE',
      memberCount: 3,
      latestActivityAt: '2026-08-12T10:03:00Z',
      unreadCount: 2,
      isPinned: false,
      isArchived: false,
    },
    {
      id: 'group-pay-proj-001',
      projectId: 'proj-001',
      type: 'REQUIREMENT',
      title: '支付回调',
      description: '支付回调与对账',
      status: 'ACTIVE',
      memberCount: 3,
      latestActivityAt: '2026-08-11T18:00:00Z',
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
    },
  ],
}

const MOCK_MESSAGES: Record<string, Message[]> = {
  'group-main-proj-001': [
    {
      id: 'msg-main-001',
      groupId: 'group-main-proj-001',
      type: 'TEXT',
      content: { text: '欢迎来到 Qgents 项目总群。需求讨论请到对应需求群。' },
      senderType: 'SYSTEM',
      sequence: 1,
      createdAt: '2026-08-12T09:00:00Z',
      replyToId: null,
    },
    {
      id: 'msg-main-002',
      groupId: 'group-main-proj-001',
      type: 'TEXT',
      content: { text: '登录功能的需求群已经建好了，大家进去领一下。' },
      senderType: 'USER',
      senderId: 'user-001',
      senderName: '陈同学',
      sequence: 2,
      createdAt: '2026-08-12T09:30:00Z',
      replyToId: null,
    },
  ],
  'group-login-proj-001': [
    {
      id: 'msg-login-001',
      groupId: 'group-login-proj-001',
      type: 'TEXT',
      content: { text: '登录接口需要支持邮箱和密码两种方式。' },
      senderType: 'USER',
      senderId: 'user-001',
      senderName: '陈同学',
      sequence: 1,
      createdAt: '2026-08-12T10:00:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-002',
      groupId: 'group-login-proj-001',
      type: 'CODE',
      content: {
        code: 'POST /auth/login\n{ "email": "...", "password": "..." }',
        language: 'http',
      },
      senderType: 'AGENT',
      senderId: 'agent-orchestrator',
      senderName: 'AgentOrchestrator',
      sequence: 2,
      createdAt: '2026-08-12T10:01:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-003',
      groupId: 'group-login-proj-001',
      type: 'TEXT',
      content: { text: '好的，我按接口文档实现，完成后给出 Diff。' },
      senderType: 'AGENT',
      senderId: 'agent-orchestrator',
      senderName: 'AgentOrchestrator',
      sequence: 3,
      createdAt: '2026-08-12T10:02:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-004',
      groupId: 'group-login-proj-001',
      type: 'TEXT',
      content: { text: '密码要用 RSA 加密后传输，别发明文。' },
      senderType: 'USER',
      senderId: 'user-002',
      senderName: '张工',
      sequence: 4,
      createdAt: '2026-08-12T10:03:00Z',
      replyToId: null,
    },
  ],
}

// 群成员 = 项目成员 + 群内 Agent（memberType: USER/AGENT）
const MOCK_GROUP_MEMBERS = [
  { id: 'user-001', displayName: '陈同学', memberType: 'USER' as const },
  { id: 'user-002', displayName: '张工', memberType: 'USER' as const },
  { id: 'user-003', displayName: '李设计', memberType: 'USER' as const },
  { id: 'agent-orchestrator', displayName: 'AgentOrchestrator', memberType: 'AGENT' as const },
  { id: 'agent-developer', displayName: 'Developer', memberType: 'AGENT' as const },
]

// ══════════════════════════════════════════════
// GitHub 集成 Mock 数据
// ══════════════════════════════════════════════

const MOCK_TEAM_ID = 'team-xinghe'

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

// ══════════════════════════════════════════════
// 项目仓库绑定（内存表）
// ══════════════════════════════════════════════

function createRepoBindingHandlers() {
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
}

// ══════════════════════════════════════════════
// 所有 Handlers
// ══════════════════════════════════════════════

export const handlers = [
  // ── health ──
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', source: 'msw' })),

  // ── Auth ──
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    if (!body.email?.includes('@')) {
      return HttpResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' } }, { status: 401 })
    }
    return HttpResponse.json({
      data: {
        accessToken: 'mock-access-token-' + Date.now(),
        accessTokenExpiresIn: 900,
        refreshToken: 'mock-refresh-token-' + Date.now(),
        refreshTokenExpiresIn: 2592000,
        user: { ...MOCK_USER, email: body.email },
      },
    })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email?: string; displayName?: string }
    if (!body.email?.includes('@')) {
      return HttpResponse.json({ error: { code: 'INVALID_INPUT', message: '邮箱格式不正确' } }, { status: 400 })
    }
    return HttpResponse.json({
      data: {
        accessToken: 'mock-access-token-' + Date.now(),
        accessTokenExpiresIn: 900,
        refreshToken: 'mock-refresh-token-' + Date.now(),
        refreshTokenExpiresIn: 2592000,
        user: { id: 'user-' + Date.now(), email: body.email!, displayName: body.displayName || body.email!.split('@')[0], avatarChar: (body.displayName || '用')[0] },
      },
    })
  }),

  http.get('/api/me', () => HttpResponse.json({ data: MOCK_USER })),

  http.post('/api/auth/logout', () => HttpResponse.json({ data: null })),

  // ── Teams ──
  http.get('/api/teams', () => HttpResponse.json({ data: MOCK_TEAMS })),

  http.post('/api/teams', async ({ request }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const newTeam = {
      id: 'team-new-' + nextTeamId++,
      name: body.name || '未命名团队',
      description: body.description || '',
      createdAt: new Date().toISOString(),
      myRole: 'TEAM_OWNER' as const,
      memberCount: 1,
    }
    return HttpResponse.json({ data: newTeam }, { status: 201 })
  }),

  http.get('/api/teams/:teamId', ({ params }) => {
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '团队不存在' } }, { status: 404 })
    return HttpResponse.json({ data: team })
  }),

  http.patch('/api/teams/:teamId', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '团队不存在' } }, { status: 404 })
    return HttpResponse.json({ data: { ...team, ...body } })
  }),

  http.get('/api/teams/:teamId/members', ({ params }) => {
    const members = params.teamId === 'team-joined-001'
      ? MOCK_TEAM_MEMBERS.map((m) => (m.userId === 'user-001' ? { ...m, role: 'TEAM_MEMBER' as const } : m))
      : MOCK_TEAM_MEMBERS
    return HttpResponse.json({ data: members })
  }),

  http.post('/api/teams/:teamId/invitations', async ({ request }) => {
    const body = (await request.json()) as { email?: string; role?: string }
    return HttpResponse.json({
      data: { id: 'inv-' + Date.now(), email: body.email || '', role: body.role || 'TEAM_MEMBER', status: 'PENDING', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() },
    }, { status: 201 })
  }),

  http.get('/api/teams/:teamId/invitations', () => HttpResponse.json({ data: [] })),

  http.post('/api/team-invitations/:token/accept', () =>
    HttpResponse.json({ data: { teamId: 'team-joined-001', teamName: '广工创新团队' } }),
  ),

  // ── GitHub 集成 ──
  http.get('/api/teams/:teamId/integrations/github/installations', ({ params }) => {
    if (params.teamId !== MOCK_TEAM_ID) {
      return HttpResponse.json({ data: [], requestId: 'req_mock_empty' })
    }
    return HttpResponse.json({
      data: mockInstallations,
      requestId: 'req_mock_installations',
    })
  }),

  http.get('/api/teams/:teamId/integrations/github/repositories', ({ params }) => {
    if (params.teamId !== MOCK_TEAM_ID) {
      return HttpResponse.json({ data: [], requestId: 'req_mock_repos_empty' })
    }
    return HttpResponse.json({
      data: mockAuthorizedRepos,
      requestId: 'req_mock_authorized_repos',
    })
  }),

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

  // ── Projects ──
  http.get('/api/teams/:teamId/projects', ({ params }) => {
    const projects = MOCK_PROJECTS[params.teamId as string] || []
    return HttpResponse.json({ data: projects })
  }),

  http.post('/api/teams/:teamId/projects', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const newProject = {
      id: 'proj-new-' + nextProjectId++,
      teamId: params.teamId as string,
      name: body.name || '未命名项目',
      description: body.description || '',
      createdAt: new Date().toISOString(),
      myRole: 'PROJECT_ADMIN' as const,
      repositoryCount: 0,
    }
    return HttpResponse.json({ data: newProject }, { status: 201 })
  }),

  http.get('/api/projects/:projectId', ({ params }) => {
    for (const list of Object.values(MOCK_PROJECTS)) {
      const proj = list.find((p) => p.id === params.projectId)
      if (proj) return HttpResponse.json({ data: proj })
    }
    return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '项目不存在' } }, { status: 404 })
  }),

  http.get('/api/projects/:projectId/members', () =>
    HttpResponse.json({
      data: [
        { userId: 'user-001', displayName: '陈同学', email: 'demo@qgents.dev', role: 'PROJECT_ADMIN' },
        { userId: 'user-002', displayName: '张工', email: 'zhang@example.com', role: 'PROJECT_MEMBER' },
      ],
    }),
  ),

  http.post('/api/projects/:projectId/members', () => HttpResponse.json({ data: null }, { status: 201 })),

  http.post('/api/projects/:projectId/archive', () => HttpResponse.json({ data: null })),

  http.post('/api/projects/:projectId/restore', () => HttpResponse.json({ data: null })),

  // ── Group 与消息 ──
  http.get('/api/projects/:projectId/groups', ({ params }) => {
    const groups = MOCK_GROUPS[params.projectId as string] ?? []
    // 按最近活跃排序（项目总群固定靠前由前端处理，这里直接返回）
    return HttpResponse.json({ data: groups })
  }),

  http.post('/api/projects/:projectId/groups', async ({ params, request }) => {
    const projectId = params.projectId as string
    const body = (await request.json()) as { title?: string; description?: string; type?: string }
    // 只接受 REQUIREMENT（省略 type 也按 REQUIREMENT 处理），PROJECT_MAIN 返回 422
    if (body.type === 'PROJECT_MAIN') {
      return HttpResponse.json(
        { error: { code: 'SYSTEM_GROUP_MANAGED', message: '项目总群由系统管理，不可创建' } },
        { status: 422 },
      )
    }
    const group: Group = {
      id: 'group-' + Date.now(),
      projectId,
      type: 'REQUIREMENT',
      title: body.title || '未命名需求群',
      description: body.description || '',
      status: 'ACTIVE',
      memberCount: 1,
      latestActivityAt: new Date().toISOString(),
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
    }
    const list = MOCK_GROUPS[projectId] ?? (MOCK_GROUPS[projectId] = [])
    list.push(group)
    return HttpResponse.json({ data: group }, { status: 201 })
  }),

  http.get('/api/projects/:projectId/groups/:groupId/members', () => {
    // 群成员 = 项目成员 + 群内 Agent，群内成员平等、无角色区分
    return HttpResponse.json({ data: MOCK_GROUP_MEMBERS })
  }),

  http.get('/api/projects/:projectId/groups/:groupId/messages', ({ params }) => {
    const messages = MOCK_MESSAGES[params.groupId as string] ?? []
    return HttpResponse.json({
      data: messages,
      page: { nextCursor: null, hasMore: false },
    })
  }),

  http.post('/api/projects/:projectId/groups/:groupId/messages', async ({ params, request }) => {
    const groupId = params.groupId as string
    const body = (await request.json()) as {
      type?: Message['type']
      content?: unknown
      senderId?: string
      clientMessageId?: string
    }
    const list = MOCK_MESSAGES[groupId] ?? (MOCK_MESSAGES[groupId] = [])
    const message: Message = {
      id: 'msg-' + Date.now(),
      groupId,
      type: body.type ?? 'TEXT',
      content: body.content ?? { text: '' },
      senderType: 'USER',
      senderId: 'user-001',
      senderName: '陈同学',
      sequence: list.length + 1,
      createdAt: new Date().toISOString(),
      replyToId: null,
    }
    list.push(message)
    return HttpResponse.json({ data: message }, { status: 201 })
  }),

  // ── 项目仓库绑定（GitHub）──
  ...createRepoBindingHandlers(),
]
