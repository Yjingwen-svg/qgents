import { http, HttpResponse } from 'msw'

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
// Auth（已有）
// ══════════════════════════════════════════════

const handlers: ReturnType<typeof http.get>[] = [
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

  /** GET /api/teams */
  http.get('/api/teams', () => HttpResponse.json({ data: MOCK_TEAMS })),

  /** POST /api/teams */
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

  /** GET /api/teams/:teamId */
  http.get('/api/teams/:teamId', ({ params }) => {
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '团队不存在' } }, { status: 404 })
    return HttpResponse.json({ data: team })
  }),

  /** PATCH /api/teams/:teamId */
  http.patch('/api/teams/:teamId', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '团队不存在' } }, { status: 404 })
    return HttpResponse.json({ data: { ...team, ...body } })
  }),

  /** GET /api/teams/:teamId/members */
  http.get('/api/teams/:teamId/members', ({ params }) => {
    // 所有 Mock 团队返回同一组成员列表
    const members = params.teamId === 'team-joined-001'
      ? MOCK_TEAM_MEMBERS.map((m) => (m.userId === 'user-001' ? { ...m, role: 'TEAM_MEMBER' as const } : m))
      : MOCK_TEAM_MEMBERS
    return HttpResponse.json({ data: members })
  }),

  /** POST /api/teams/:teamId/invitations */
  http.post('/api/teams/:teamId/invitations', async ({ request }) => {
    const body = (await request.json()) as { email?: string; role?: string }
    return HttpResponse.json({
      data: { id: 'inv-' + Date.now(), email: body.email || '', role: body.role || 'TEAM_MEMBER', status: 'PENDING', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() },
    }, { status: 201 })
  }),

  /** GET /api/teams/:teamId/invitations */
  http.get('/api/teams/:teamId/invitations', () => HttpResponse.json({ data: [] })),

  /** POST /api/team-invitations/:token/accept */
  http.post('/api/team-invitations/:token/accept', ({ params }) =>
    HttpResponse.json({ data: { teamId: 'team-joined-001', teamName: '广工创新团队' } }),
  ),

  // ── Projects ──

  /** GET /api/teams/:teamId/projects */
  http.get('/api/teams/:teamId/projects', ({ params }) => {
    const projects = MOCK_PROJECTS[params.teamId as string] || []
    return HttpResponse.json({ data: projects })
  }),

  /** POST /api/teams/:teamId/projects */
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

  /** GET /api/projects/:projectId */
  http.get('/api/projects/:projectId', ({ params }) => {
    for (const list of Object.values(MOCK_PROJECTS)) {
      const proj = list.find((p) => p.id === params.projectId)
      if (proj) return HttpResponse.json({ data: proj })
    }
    return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '项目不存在' } }, { status: 404 })
  }),

  /** GET /api/projects/:projectId/members */
  http.get('/api/projects/:projectId/members', () =>
    HttpResponse.json({
      data: [
        { userId: 'user-001', displayName: '陈同学', email: 'demo@qgents.dev', role: 'PROJECT_ADMIN' },
        { userId: 'user-002', displayName: '张工', email: 'zhang@example.com', role: 'PROJECT_MEMBER' },
      ],
    }),
  ),

  /** POST /api/projects/:projectId/members */
  http.post('/api/projects/:projectId/members', () => HttpResponse.json({ data: null }, { status: 201 })),

  /** POST /api/projects/:projectId/archive */
  http.post('/api/projects/:projectId/archive', () => HttpResponse.json({ data: null })),

  /** POST /api/projects/:projectId/restore */
  http.post('/api/projects/:projectId/restore', () => HttpResponse.json({ data: null })),
]

export { handlers }
