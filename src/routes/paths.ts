/**
 * 路由路径常量 —— 避免魔法字符串散落各处
 * 新增页面时先在这里登记，再挂到 routes/index.tsx
 */
export const PATHS = {
  /** 登录 / 注册 */
  LOGIN: '/login',

  /**
   * 登录后若尚未加入任何团队 → 欢迎页（创建 / 加入）
   * 对应原型：欢迎来到 Qgents
   */
  WELCOME: '/welcome',

  /** 主应用壳（含顶部 Banner） */
  APP: '/app',
  /** 团队首页（Banner「团队首页」入口） */
  MY_TEAMS: '/app/teams',
  CREATE_TEAM: '/app/teams/create',
  JOIN_TEAM: '/app/teams/join',

  /**
   * 团队详情（我的团队卡片「查看详情」）
   * 此页提供「创建项目」入口
   */
  teamDetail: (teamId: string) => `/app/teams/${teamId}`,

  /**
   * 创建项目（个人中心 / 团队详情均可进入）
   * TODO[后端联调]: teamId 用于绑定项目所属团队
   */
  createProject: (teamId: string) => `/app/teams/${teamId}/projects/create`,

  /**
   * 项目群聊工作台外壳
   * 左侧会话列表 + 顶栏 + 底部输入；中间消息区留空待填充
   */
  CHAT: '/app/chat',

  /**
   * GitHub 集成（Banner 右侧 Octocat 图标入口）
   * 团队级 GitHub App 授权 + 仓库绑定管理
   * TODO[后端联调]: 见接口文档 §6 GitHub App 与项目仓库
   */
  GITHUB_INTEGRATION: '/app/integrations/github',

  /** 项目详情根路径（会重定向到默认子页） */
  projectDetail: (projectId: string) => `/app/projects/${projectId}`,

  /** 项目详情 — 各左侧导航子路由 */
  projectOverview: (projectId: string) => `/app/projects/${projectId}/overview`,

  /**
   * 需求群聊（导航入口，默认落到第一个需求）
   * 具体某个需求：projectReqChat(projectId, reqId)
   */
  projectReqChat: (projectId: string, reqId = 'login') =>
    `/app/projects/${projectId}/req-chat/${reqId}`,

  projectTasks: (projectId: string) => `/app/projects/${projectId}/tasks`,
  projectWorkflow: (projectId: string) => `/app/projects/${projectId}/workflow`,
  projectAgents: (projectId: string) => `/app/projects/${projectId}/agents`,
  projectSkills: (projectId: string) => `/app/projects/${projectId}/skills`,
  projectMemory: (projectId: string) => `/app/projects/${projectId}/memory`,
  projectCode: (projectId: string) => `/app/projects/${projectId}/code`,
  projectTestset: (projectId: string) => `/app/projects/${projectId}/testset`,
  projectMembers: (projectId: string) => `/app/projects/${projectId}/members`,
  projectSettings: (projectId: string) => `/app/projects/${projectId}/settings`,
} as const

/** 项目详情左侧导航 path 段（相对 projects/:projectId） */
export const PROJECT_NAV = [
  { path: 'overview', label: '概览', to: PATHS.projectOverview },
  {
    path: 'req-chat',
    label: '需求群聊',
    /** 导航高亮用前缀路径；实际落地到默认需求 */
    to: (projectId: string) => PATHS.projectReqChat(projectId, 'login'),
  },
  { path: 'tasks', label: '任务中心', to: PATHS.projectTasks, badge: 3 },
  { path: 'workflow', label: '工作流编排', to: PATHS.projectWorkflow },
  { path: 'agents', label: 'Agent 团队', to: PATHS.projectAgents },
  { path: 'skills', label: '共享 Skill', to: PATHS.projectSkills },
  { path: 'memory', label: '共享 Memory', to: PATHS.projectMemory },
  { path: 'code', label: '代码与 Branch', to: PATHS.projectCode },
  { path: 'testset', label: 'Testset', to: PATHS.projectTestset },
  { path: 'members', label: '项目成员', to: PATHS.projectMembers },
  { path: 'settings', label: '项目设置', to: PATHS.projectSettings },
] as const
