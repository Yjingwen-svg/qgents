/**
 * GitHub App 安装跳转 —— 类型（接口文档 §6）
 *
 * ============================================================================
 * 联调对照：README/Qgents接口文档.md →「6. GitHub App 与项目仓库」
 * ============================================================================
 */

/**
 * POST /teams/{teamId}/integrations/github/installations
 * 成功响应 data 字段（外层还有 { data, requestId } 信封）
 *
 * 文档示例：
 * {
 *   "data": {
 *     "installationUrl": "https://github.com/apps/qgents/installations/new?state=...",
 *     "expiresAt": "2026-08-10T11:00:00Z"
 *   }
 * }
 *
 * TODO[后端联调] 请与后端确认：
 * - installationUrl 是否一定是绝对 URL（含 https://）
 * - expiresAt 时区是否为 UTC（ISO-8601）
 * - state 参数是否由后端签名，前端切勿自行拼接安装链接
 */
export interface GithubInstallationRedirect {
  /** 浏览器应整页跳转的 GitHub App 安装/管理地址 */
  installationUrl: string
  /** 该跳转链接的过期时间（ISO 字符串）；过期后需重新 POST */
  expiresAt: string
}

/**
 * GET /teams/{teamId}/integrations/github/installations 列表项
 * TODO[后端联调] 字段名以 Java DTO 为准，若不一致在此对齐
 *
 * accountType：安装时选的是个人账号(User)还是组织(Organization)
 */
export interface GithubInstallation {
  installationId: string
  accountLogin: string
  accountType: 'User' | 'Organization'
  installedAt: string
  status: 'ACTIVE' | 'EXPIRED'
  /** 可选：后端若直接返回授权仓库数则可展示；没有则前端用 repositories 列表统计 */
  authorizedRepoCount?: number
}

/**
 * 团队已授权仓库（GitHub App 勾选范围内、可供绑定到项目的仓库）
 * GET /teams/{teamId}/integrations/github/repositories
 *
 * 文档路径是「团队级」一条列表，没有 /installations/{id}/repositories。
 * 产品上按「某个安装（个人/组织）」查看仓库是合理的：
 * - 联调请后端在每条仓库上带回 installationId，前端再按安装过滤
 * - 若暂时没有该字段，前端只能展示整队全部授权仓库
 *
 * TODO[后端联调] 请确认 Java DTO 是否包含：
 * - defaultBranch（默认分支名，如 main）
 * - syncStatus（SYNCED | NOT_SYNCED | SYNCING | FAILED）
 * 字段名若不同（如 default_branch / sync_status），在映射层对齐即可，页面逻辑不用大改
 */
export interface GithubAuthorizedRepository {
  repositoryId: string
  fullName: string
  githubUrl: string
  private: boolean
  /** 归属哪一次 GitHub App 安装；用于卡片「查看仓库」过滤 */
  installationId?: string
  /** 仓库默认分支（联调字段名若为 default_branch，在 api 层映射） */
  defaultBranch?: string
  /** 与 Qgents 的同步状态；缺省时前端按未同步展示 */
  syncStatus?: 'SYNCED' | 'NOT_SYNCED' | 'SYNCING' | 'FAILED'
}

/** 项目已绑定仓库 */
export interface ProjectBoundRepository {
  id: string
  installationId: string
  repositoryId: string
  fullName: string
  githubUrl: string
  displayName?: string
  defaultBranch: string
  boundProjectId: string
  boundProjectName: string
  syncStatus: 'SYNCED' | 'SYNCING' | 'FAILED'
  lastSyncedAt?: string
  syncError?: string
}

export interface BindProjectRepositoryPayload {
  installationId: string
  repositoryId: string
  defaultBranch: string
  displayName?: string
}
