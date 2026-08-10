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
   * 项目群聊工作台外壳
   * 左侧会话列表 + 顶栏 + 底部输入；中间消息区留空待填充
   */
  CHAT: '/app/chat',

  /** 项目详情（从群聊顶栏「进入项目详情」进入） */
  projectDetail: (projectId: string) => `/app/projects/${projectId}`,
} as const
