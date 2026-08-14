import { http, HttpResponse } from 'msw'
import type { GithubAuthorizedRepository, GithubInstallation } from '@/types/github'
import type { Group, GroupMember, Message } from '@/types/group'
import type { Activity, Memory, Notification, MyTeamInvitation } from '@/types'
import { MOCK_CURRENT_USER } from './currentUser'

// ══════════════════════════════════════════════
// Mock 数据
// ══════════════════════════════════════════════

const MOCK_USER = MOCK_CURRENT_USER

const MOCK_TEAMS = [
  {
    id: 'team-owned-001',
    name: '星河工作室',
    description: '全栈开发团队，专注内部工具与开源项目',
    createdAt: '2026-06-01T08:00:00Z',
    role: 'TEAM_OWNER' as const,
    memberCount: 5,
  },
  {
    id: 'team-joined-001',
    name: '广工创新团队',
    description: '校园技术团队，AI 与 Web 方向',
    createdAt: '2026-05-15T08:00:00Z',
    role: 'TEAM_MEMBER' as const,
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

const MOCK_PROJECTS: Record<string, Array<{ id: string; teamId: string; name: string; description: string; createdAt: string; role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER'; repositoryCount: number }>> = {
  'team-owned-001': [
    { id: 'demo-project', teamId: 'team-owned-001', name: 'Demo Project', description: 'Demo project for Mock acceptance', createdAt: '2026-08-13T00:00:00Z', role: 'PROJECT_ADMIN', repositoryCount: 1 },
    { id: 'proj-001', teamId: 'team-owned-001', name: 'Qgents', description: '团队多人 + 多 Agent 云端协作开发平台', createdAt: '2026-07-01T08:00:00Z', role: 'PROJECT_ADMIN', repositoryCount: 3 },
    { id: 'proj-002', teamId: 'team-owned-001', name: '宠影记', description: '宠物健康管理小程序', createdAt: '2026-07-15T08:00:00Z', role: 'PROJECT_ADMIN', repositoryCount: 1 },
  ],
  'team-joined-001': [
    { id: 'proj-003', teamId: 'team-joined-001', name: 'AI 决策系统', description: '校园选课推荐与学业规划', createdAt: '2026-06-10T08:00:00Z', role: 'PROJECT_MEMBER', repositoryCount: 2 },
    { id: 'proj-004', teamId: 'team-joined-001', name: '校园助手', description: '课表、成绩、图书馆一站式查询', createdAt: '2026-08-01T08:00:00Z', role: 'PROJECT_MEMBER', repositoryCount: 1 },
  ],
}

let nextTeamId = 10
let nextProjectId = 10

// 当前用户收到的待处理团队邀请（演示用样例）
const MOCK_MY_INVITATIONS: MyTeamInvitation[] = [
  {
    id: 'my-inv-001',
    token: 'inv-token-demo-001',
    teamId: 'team-joined-001',
    teamName: '广工创新团队',
    role: 'TEAM_MEMBER',
    inviterDisplayName: '陈同学',
    status: 'PENDING',
    expiresAt: '2026-08-21T00:00:00Z',
    createdAt: '2026-08-14T10:00:00Z',
  },
]

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
      latestActivityAt: '2026-08-12T10:03:00Z',
      unreadCount: 2,
      isPinned: true,
      isArchived: false,
    },
    {
      id: 'group-pay-proj-001',
      projectId: 'proj-001',
      type: 'REQUIREMENT',
      title: '支付回调',
      description: '支付回调与对账',
      status: 'ACTIVE',
      latestActivityAt: '2026-08-11T18:00:00Z',
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
    },
    {
      id: 'group-home-proj-001',
      projectId: 'proj-001',
      type: 'REQUIREMENT',
      title: '首页改版',
      description: '旧版首页重构，已完成并归档',
      status: 'ARCHIVED',
      latestActivityAt: '2026-08-01T09:00:00Z',
      unreadCount: 0,
      isPinned: false,
      isArchived: true,
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
    // ── 演示用样例：验证多类型消息渲染（content 结构对齐「A-联调约定」第三节）──
    {
      id: 'msg-login-005',
      groupId: 'group-login-proj-001',
      type: 'IMAGE',
      content: {
        url: 'https://picsum.photos/seed/qgents/400/240',
        width: 400,
        height: 240,
      },
      senderType: 'USER',
      senderId: 'user-002',
      senderName: '张工',
      sequence: 5,
      createdAt: '2026-08-12T10:10:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-006',
      groupId: 'group-login-proj-001',
      type: 'FILE',
      content: {
        url: 'https://example.com/files/api-design.pdf',
        name: '登录接口设计.pdf',
        size: 524288,
        mimeType: 'application/pdf',
      },
      senderType: 'USER',
      senderId: 'user-001',
      senderName: '陈同学',
      sequence: 6,
      createdAt: '2026-08-12T10:12:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-007',
      groupId: 'group-login-proj-001',
      type: 'QUOTE',
      content: {
        quotedMessageId: 'msg-login-004',
        quotedText: '密码要用 RSA 加密后传输，别发明文。',
        quotedSenderName: '张工',
      },
      senderType: 'AGENT',
      senderId: 'agent-developer',
      senderName: 'Developer',
      sequence: 7,
      createdAt: '2026-08-12T10:15:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-008',
      groupId: 'group-login-proj-001',
      type: 'DIFF',
      content: {
        diffId: 'diff-001',
        title: '实现邮箱登录',
        additions: 128,
        deletions: 12,
      },
      senderType: 'AGENT',
      senderId: 'agent-developer',
      senderName: 'Developer',
      sequence: 8,
      createdAt: '2026-08-12T10:30:00Z',
      replyToId: null,
    },
    {
      id: 'msg-login-009',
      groupId: 'group-login-proj-001',
      type: 'TASK_STATUS',
      content: {
        taskId: 'task-001',
        status: 'SUCCEEDED',
        node: 'Developer',
        message: '任务已完成，代码已交付待验收',
      },
      senderType: 'SYSTEM',
      sequence: 9,
      createdAt: '2026-08-12T10:35:00Z',
      replyToId: null,
    },
  ],
}

// ══════════════════════════════════════════════
// 群成员数据 —— 对齐接口文档 v1.1.8 §7「群成员 = 项目成员 + 群内 Agent」
// ══════════════════════════════════════════════

interface MockProjectMember {
  userId: string
  displayName: string
  email: string
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER'
}

// 项目成员（按项目隔离，作为群 USER 成员来源；同时供 GET /projects/:id/members 复用）
const MOCK_PROJECT_MEMBERS: Record<string, MockProjectMember[]> = {
  'proj-001': [
    { userId: 'user-001', displayName: '陈同学', email: 'demo@qgents.dev', role: 'PROJECT_ADMIN' },
    { userId: 'user-002', displayName: '张工', email: 'zhang@example.com', role: 'PROJECT_MEMBER' },
    { userId: 'user-003', displayName: '李设计', email: 'li@example.com', role: 'PROJECT_MEMBER' },
  ],
}

// 每个群参与的 Agent（按群隔离：不同需求触发不同 Agent 回群）
const MOCK_GROUP_AGENTS: Record<string, GroupMember[]> = {
  'group-main-proj-001': [
    { id: 'agent-orchestrator', displayName: 'AgentOrchestrator', memberType: 'AGENT' },
  ],
  'group-login-proj-001': [
    { id: 'agent-orchestrator', displayName: 'AgentOrchestrator', memberType: 'AGENT' },
    { id: 'agent-planner', displayName: 'Planner', memberType: 'AGENT' },
    { id: 'agent-developer', displayName: 'Developer', memberType: 'AGENT' },
    { id: 'agent-tester', displayName: 'Tester', memberType: 'AGENT' },
    { id: 'agent-reviewer', displayName: 'Reviewer', memberType: 'AGENT' },
  ],
  'group-pay-proj-001': [
    { id: 'agent-orchestrator', displayName: 'AgentOrchestrator', memberType: 'AGENT' },
    { id: 'agent-developer', displayName: 'Developer', memberType: 'AGENT' },
  ],
}

// 群成员 = 项目成员（USER）+ 该群参与的 Agent；memberCount 与此函数保持一致
function getGroupMembers(projectId: string, groupId: string): GroupMember[] {
  const users: GroupMember[] = (MOCK_PROJECT_MEMBERS[projectId] ?? []).map(
    (m): GroupMember => ({ id: m.userId, displayName: m.displayName, memberType: 'USER' }),
  )
  return [...users, ...(MOCK_GROUP_AGENTS[groupId] ?? [])]
}

// 最新消息摘要（会话列表展示用）：从 MOCK_MESSAGES 取该群最后一条消息，与消息列表保持一致
function getLatestMessageSummary(groupId: string): Group['latestMessage'] {
  const msgs = MOCK_MESSAGES[groupId] ?? []
  const last = msgs[msgs.length - 1]
  if (!last) return undefined
  const text =
    last.type === 'CODE'
      ? ((last.content as { code?: string }).code ?? '').split('\n')[0]
      : (last.content as { text?: string }).text ?? ''
  return { senderName: last.senderName, text }
}

// ══════════════════════════════════════════════
// 通知中心 Mock 数据 —— 对齐分工安排「通知中心」（本轮前端 Mock）
// ══════════════════════════════════════════════

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    kind: 'TASK_COMPLETED',
    title: '登录功能任务已完成',
    description: 'Agent 已完成「实现邮箱登录」，Diff 待你验收',
    isRead: false,
    createdAt: '2026-08-13T01:00:00Z',
    projectId: 'proj-001',
    groupId: 'group-login-proj-001',
    resourceId: 'task-001',
  },
  {
    id: 'notif-2',
    kind: 'AGENT_INPUT_REQUIRED',
    title: 'Agent 需要你补充信息',
    description: 'Developer 在「支付回调」任务中请求补充验收说明',
    isRead: false,
    createdAt: '2026-08-13T00:40:00Z',
    projectId: 'proj-001',
    groupId: 'group-pay-proj-001',
    resourceId: 'task-002',
  },
  {
    id: 'notif-3',
    kind: 'MR_PENDING',
    title: 'MR 待处理',
    description: 'feature/login-api 已提交，等待质量门禁与合并',
    isRead: false,
    createdAt: '2026-08-12T23:30:00Z',
    projectId: 'proj-001',
    resourceId: 'mr-001',
  },
  {
    id: 'notif-4',
    kind: 'TASK_FAILED',
    title: '测试任务失败',
    description: 'Tester 在「登录功能」中报告测试未通过',
    isRead: true,
    createdAt: '2026-08-12T22:10:00Z',
    projectId: 'proj-001',
    groupId: 'group-login-proj-001',
    resourceId: 'task-003',
  },
  {
    id: 'notif-5',
    kind: 'DELIVERABLE_PENDING',
    title: '交付物待验收',
    description: '「登录功能」产出代码交付物，请验收',
    isRead: true,
    createdAt: '2026-08-12T21:00:00Z',
    projectId: 'proj-001',
    groupId: 'group-login-proj-001',
    resourceId: 'task-001',
  },
]

// ══════════════════════════════════════════════
// 团队最近动态（演示用样例，对齐「前端待接接口清单.md」的 activities 接口设计）
// ══════════════════════════════════════════════

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'act-001',
    type: 'GROUP_CREATED',
    title: '陈同学 创建了需求群 登录功能',
    summary: null,
    actor: { id: 'user-001', displayName: '陈同学' },
    target: { type: 'GROUP', id: 'group-login-proj-001', title: '登录功能' },
    createdAt: '2026-08-14T09:00:00Z',
  },
  {
    id: 'act-002',
    type: 'TASK_COMPLETED',
    title: '任务「实现登录功能」已完成',
    summary: '由 Developer Agent 完成',
    actor: { id: 'agent-developer', displayName: 'Developer' },
    target: { type: 'TASK', id: 'task-001', title: '实现登录功能' },
    createdAt: '2026-08-14T08:30:00Z',
  },
  {
    id: 'act-003',
    type: 'MR_CREATED',
    title: '登录功能 MR #42 已创建',
    summary: '等待合并',
    actor: { id: 'agent-developer', displayName: 'Developer' },
    target: { type: 'MR', id: 'mr-001', title: '#42 登录功能' },
    createdAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'act-004',
    type: 'MEMBER_JOINED',
    title: '张工 加入了项目',
    summary: null,
    actor: { id: 'user-002', displayName: '张工' },
    target: { type: 'PROJECT', id: 'proj-001', title: 'Qgents Web' },
    createdAt: '2026-08-13T18:00:00Z',
  },
]

// ══════════════════════════════════════════════
// 共享 Memory Mock 数据 —— 对齐接口文档 v1.1.8 §9
// ══════════════════════════════════════════════

let nextMemoryId = 100
const MOCK_MEMORIES: Record<string, Memory[]> = {
  'proj-001': [
    {
      id: 'mem-1',
      projectId: 'proj-001',
      title: '密码存储约定',
      content: '密码仅存储 bcrypt 哈希，登录时使用 bcrypt.compare 校验，不得明文存储或日志输出。',
      category: 'ENGINEERING_DECISION',
      tags: ['auth', 'security'],
      status: 'APPROVED',
      source: 'MESSAGE',
      sources: [{ groupId: 'group-login-proj-001', messageId: 'msg-login-004' }],
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-08-12T11:00:00Z',
      createdAt: '2026-08-12T10:30:00Z',
      updatedAt: '2026-08-12T11:00:00Z',
    },
    {
      id: 'mem-2',
      projectId: 'proj-001',
      title: 'API 响应统一信封',
      content: '所有接口统一返回 { data, requestId }，错误返回 { error, requestId }，前端 client.ts 已按此解包。',
      category: 'ENGINEERING_DECISION',
      tags: ['api', 'convention'],
      status: 'APPROVED',
      source: 'MANUAL',
      sources: [],
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-08-11T15:00:00Z',
      createdAt: '2026-08-11T14:00:00Z',
      updatedAt: '2026-08-11T15:00:00Z',
    },
    {
      id: 'mem-3',
      projectId: 'proj-001',
      title: '支付回调幂等处理',
      content: '支付回调需带 Idempotency-Key，重复通知返回首次结果，避免重复入账。',
      category: 'ENGINEERING_DECISION',
      tags: ['pay', 'idempotency'],
      status: 'PENDING_REVIEW',
      source: 'MESSAGE',
      sources: [{ groupId: 'group-pay-proj-001', messageId: 'msg-pay-001' }],
      creator: { id: 'user-002', displayName: '张工' },
      reviewer: null,
      reviewedAt: null,
      createdAt: '2026-08-13T00:30:00Z',
      updatedAt: '2026-08-13T00:30:00Z',
    },
    {
      id: 'mem-4',
      projectId: 'proj-001',
      title: '登录错误码约定',
      content: '登录失败统一返回 401 + INVALID_CREDENTIALS，不区分"用户不存在"和"密码错误"以免泄露账号信息。',
      category: 'ENGINEERING_DECISION',
      tags: ['auth'],
      status: 'DRAFT',
      source: 'MANUAL',
      sources: [],
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: null,
      reviewedAt: null,
      createdAt: '2026-08-13T01:00:00Z',
      updatedAt: '2026-08-13T01:00:00Z',
    },
    {
      id: 'mem-5',
      projectId: 'proj-001',
      title: '旧版 token 存储方案',
      content: '早期曾讨论将 token 存 cookie，后废弃改用 localStorage + Bearer 头。',
      category: 'DEPRECATED',
      tags: ['auth'],
      status: 'REJECTED',
      source: 'MANUAL',
      sources: [],
      creator: { id: 'user-003', displayName: '李设计' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-08-10T10:00:00Z',
      createdAt: '2026-08-10T09:00:00Z',
      updatedAt: '2026-08-10T10:00:00Z',
    },
    {
      id: 'mem-6',
      projectId: 'proj-001',
      title: '初版部署流程',
      content: '旧版手工部署流程，已被自动化 CI 取代，归档留存。',
      category: 'PROCESS',
      tags: ['deploy'],
      status: 'ARCHIVED',
      source: 'MANUAL',
      sources: [],
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-07-20T12:00:00Z',
      createdAt: '2026-07-20T11:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    },
  ],
}

// ══════════════════════════════════════════════
// GitHub 集成 Mock 数据
// ══════════════════════════════════════════════

const MOCK_TEAM_ID = 'team-owned-001'

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

// ══════════════════════════════════════════════
// 项目仓库绑定（内存表）
// ══════════════════════════════════════════════

/** 项目已绑定仓库内存表（MSW 进程内） */
// 用闭包变量模拟后端落库
function createRepoBindingHandlers() {
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
  bindings.set('proj-001', [
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

  http.post('/api/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string }
    if (!body.refreshToken) {
      return HttpResponse.json(
        { error: { code: 'INVALID_REFRESH_TOKEN', message: '刷新令牌无效' } },
        { status: 401 },
      )
    }
    return HttpResponse.json({
      data: {
        accessToken: 'mock-access-token-' + Date.now(),
        accessTokenExpiresIn: 900,
        refreshToken: 'mock-refresh-token-' + Date.now(),
        refreshTokenExpiresIn: 2592000,
      },
    })
  }),

  http.get('/api/me', () =>
    HttpResponse.json({
      data: {
        user: MOCK_USER,
        teams: MOCK_TEAMS.map((t) => ({ id: t.id, name: t.name, role: t.role ?? 'TEAM_MEMBER' })),
        projects: Object.values(MOCK_PROJECTS)
          .flat()
          .map((p) => ({ id: p.id, teamId: p.teamId, name: p.name, role: p.role })),
      },
    }),
  ),

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
      role: 'TEAM_OWNER' as const,
      memberCount: 1,
    }
    return HttpResponse.json({ data: newTeam }, { status: 201 })
  }),

  http.get('/api/teams/:teamId', ({ params }) => {
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '团队不存在' } }, { status: 404 })
    return HttpResponse.json({ data: team })
  }),

  // GET /teams/:teamId/activities —— 团队最近动态（演示样例）
  http.get('/api/teams/:teamId/activities', () => HttpResponse.json({ data: MOCK_ACTIVITIES })),

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

  // GET /team-invitations —— 当前用户收到的待处理邀请（收件人视角）
  http.get('/api/team-invitations', () => HttpResponse.json({ data: MOCK_MY_INVITATIONS })),

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
// 来自 MSW 内部，在【拦截成功、路由匹配上之后】，MSW 自动组装、生成这个info上下文对象，再调用你的回调函数，把它塞进来。
//info 对象;const params = info.params
    // const request = info.request
    // const cookies = info.cookies
    // const requestId = info.requestId
// 拦截,匹配路由,执行回调函数
//匹配路由:只要是 POST 请求，并且 URL 路径符合 /api/teams/【任意值】/integrations/github/installations 这个格式，就触发后面这个回调，不要发到真实后端。
//拦截 = MSW 在浏览器发出真实网络请求、发给后端之前，把这个请求 “半路截住”，不走真实后端，直接用你写的 mock 函数返回假数据。
//request.url 不是对象！是字符串！
  http.post('/api/teams/:teamId/integrations/github/installations', ({ params, request }) => {//路径参数对象params,就是路径当中用:进行占位的都赋值给params
    const teamId = String(params.teamId)
    const idempotencyKey = request.headers.get('Idempotency-Key')
    const clientParam = new URL(request.url).searchParams.get('client')
    const client = clientParam === 'MOBILE' ? 'MOBILE' : 'WEB'
    console.info('[MSW] createInstallation', { teamId, client, idempotencyKey })

    const state = encodeURIComponent(`mock:${teamId}:${Date.now()}`)//模拟的state,真实的不会这样写.进行url编码,encodeURIComponent 只是传输包装，不是 state 本身的业务内容。
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
  // ── Projects ──
  http.get('/api/teams/:teamId/projects', ({ params }) => {
    const projects = MOCK_PROJECTS[params.teamId as string] || []
    return HttpResponse.json({ data: projects })
  }),

  http.post('/api/teams/:teamId/projects', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const teamId = params.teamId as string
    const newProject = {
      id: 'proj-new-' + nextProjectId++,
      teamId,
      name: body.name || '未命名项目',
      description: body.description || '',
      createdAt: new Date().toISOString(),
      role: 'PROJECT_ADMIN' as const,
      repositoryCount: 0,
    }
    // 写回内存，保证后续 GET /projects/:id 能查到
    if (!MOCK_PROJECTS[teamId]) MOCK_PROJECTS[teamId] = []
    MOCK_PROJECTS[teamId].push(newProject)

    // 新建项目的成员只有创建者本人
    MOCK_PROJECT_MEMBERS[newProject.id] = [
      { userId: 'user-001', displayName: '陈同学', email: 'demo@qgents.dev', role: 'PROJECT_ADMIN' },
    ]

    // 对齐接口文档 §7：创建项目时服务端自动创建唯一的 PROJECT_MAIN 总群
    const mainGroupId = 'group-main-' + newProject.id
    if (!MOCK_GROUPS[newProject.id]) MOCK_GROUPS[newProject.id] = []
    MOCK_GROUPS[newProject.id].push({
      id: mainGroupId,
      projectId: newProject.id,
      type: 'PROJECT_MAIN',
      title: '项目总群',
      description: '项目级讨论与结构化动态',
      status: 'ACTIVE',
      memberCount: getGroupMembers(newProject.id, mainGroupId).length,
      latestActivityAt: new Date().toISOString(),
      unreadCount: 0,
      isPinned: true,
      isArchived: false,
    })

    return HttpResponse.json({ data: newProject }, { status: 201 })
  }),

  http.get('/api/projects/:projectId', ({ params }) => {
    for (const list of Object.values(MOCK_PROJECTS)) {
      const proj = list.find((p) => p.id === params.projectId)
      if (proj) return HttpResponse.json({ data: proj })
    }
    return HttpResponse.json({ error: { code: 'NOT_FOUND', message: '项目不存在' } }, { status: 404 })
  }),

  http.get('/api/projects/:projectId/members', ({ params }) =>
    HttpResponse.json({ data: MOCK_PROJECT_MEMBERS[params.projectId as string] ?? [] }),
  ),

  http.post('/api/projects/:projectId/members', () => HttpResponse.json({ data: null }, { status: 201 })),

  http.post('/api/projects/:projectId/archive', () => HttpResponse.json({ data: null })),

  http.post('/api/projects/:projectId/restore', () => HttpResponse.json({ data: null })),

  // ── Group 与消息 ──
  http.get('/api/projects/:projectId/groups', ({ params }) => {
    const projectId = params.projectId as string
    // memberCount 由群成员派生（= 项目成员 + 群内 Agent），与 GET .../members 保持一致；
    // latestMessage 由消息列表派生，与 GET .../messages 保持一致
    const groups = (MOCK_GROUPS[projectId] ?? []).map((g) => ({
      ...g,
      memberCount: getGroupMembers(projectId, g.id).length,
      latestMessage: getLatestMessageSummary(g.id),
    }))
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
    const groupId = 'group-' + Date.now()
    const group: Group = {
      id: groupId,
      projectId,
      type: 'REQUIREMENT',
      title: body.title || '未命名需求群',
      description: body.description || '',
      status: 'ACTIVE',
      // 新需求群默认只有项目成员，无 Agent 参与
      memberCount: getGroupMembers(projectId, groupId).length,
      latestActivityAt: new Date().toISOString(),
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
    }
    const list = MOCK_GROUPS[projectId] ?? (MOCK_GROUPS[projectId] = [])
    list.push(group)
    return HttpResponse.json({ data: group }, { status: 201 })
  }),

  http.get('/api/projects/:projectId/groups/:groupId/members', ({ params }) => {
    // 群成员 = 项目成员 + 群内 Agent，群内成员平等、无角色区分
    return HttpResponse.json({
      data: getGroupMembers(params.projectId as string, params.groupId as string),
    })
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

  // ── 通知中心（本轮前端 Mock）──
  http.get('/api/notifications', () => HttpResponse.json({ data: MOCK_NOTIFICATIONS })),

  http.post('/api/notifications/:id/read', ({ params }) => {
    const n = MOCK_NOTIFICATIONS.find((x) => x.id === params.id)
    if (n) n.isRead = true
    return HttpResponse.json({ data: null })
  }),

  http.post('/api/notifications/read-all', () => {
    MOCK_NOTIFICATIONS.forEach((n) => {
      n.isRead = true
    })
    return HttpResponse.json({ data: null })
  }),

  // ── 共享 Memory（对齐接口文档 §9）──
  http.get('/api/projects/:projectId/memories', ({ params }) => {
    const list = MOCK_MEMORIES[params.projectId as string] ?? []
    // 文档：默认仅返回 APPROVED；此处返回全量供前端按状态筛选演示
    return HttpResponse.json({ data: list })
  }),

  http.post('/api/projects/:projectId/memories', async ({ params, request }) => {
    const projectId = params.projectId as string
    const body = (await request.json()) as {
      title?: string
      content?: string
      category?: string
      tags?: string[]
    }
    const memory: Memory = {
      id: 'mem-' + nextMemoryId++,
      projectId,
      title: body.title || '未命名 Memory',
      content: body.content || '',
      category: body.category || 'GENERAL',
      tags: body.tags ?? [],
      status: 'DRAFT',
      source: 'MANUAL',
      sources: [],
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    ;(MOCK_MEMORIES[projectId] ??= []).push(memory)
    return HttpResponse.json({ data: memory }, { status: 201 })
  }),

  http.post('/api/projects/:projectId/memories/drafts', async ({ params, request }) => {
    const projectId = params.projectId as string
    const body = (await request.json()) as {
      sourceMessages?: { groupId: string; messageId: string }[]
      instruction?: string
    }
    const src = body.sourceMessages ?? []
    const memory: Memory = {
      id: 'mem-' + nextMemoryId++,
      projectId,
      title: '群聊生成草稿' + (body.instruction ? `：${body.instruction}` : ''),
      content: `根据 ${src.length} 条群消息自动生成的草稿，待人工确认。`,
      category: 'GENERAL',
      tags: [],
      status: 'DRAFT',
      source: 'MESSAGE',
      sources: src,
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    ;(MOCK_MEMORIES[projectId] ??= []).push(memory)
    return HttpResponse.json({ data: memory }, { status: 201 })
  }),

  http.patch('/api/projects/:projectId/memories/:memoryId', async ({ params, request }) => {
    const list = MOCK_MEMORIES[params.projectId as string] ?? []
    const memory = list.find((m) => m.id === params.memoryId)
    if (!memory) {
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Memory 不存在' } }, { status: 404 })
    }
    const body = (await request.json()) as Partial<Memory>
    Object.assign(memory, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/submit-review', ({ params }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'PENDING_REVIEW'
      memory.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/approve', ({ params }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'APPROVED'
      memory.reviewer = { id: 'user-002', displayName: '张工' }
      memory.reviewedAt = new Date().toISOString()
      memory.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/reject', async ({ params, request }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'REJECTED'
      memory.reviewer = { id: 'user-002', displayName: '张工' }
      memory.reviewedAt = new Date().toISOString()
      memory.updatedAt = new Date().toISOString()
      await request.json().catch(() => ({}))
    }
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/archive', ({ params }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'ARCHIVED'
      memory.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: memory })
  }),
]
