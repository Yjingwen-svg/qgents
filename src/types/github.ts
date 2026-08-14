/**
 * GitHub App 安装跳转 —— 类型（接口文档 §6）
 *
 * ============================================================================
 * 联调对照：README/Qgents接口文档.md →「6. GitHub App 与项目仓库」
 * ============================================================================
 */

/** 安装链接来源端：后端写入 state，callback 据此回跳 Web 或移动端 */
export type GithubInstallClient = 'WEB' | 'MOBILE'

/**
 * POST /teams/{teamId}/integrations/github/installations?client=WEB|MOBILE
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
 * 已冻结见 docs：以上三项仍按文档执行；字段名以 github-backend-fields-needed.md / 前后端联调.md §6 为准。
 */
export interface GithubInstallationRedirect {
  /** 浏览器应整页跳转的 GitHub App 安装/管理地址 */
  installationUrl: string
  /** 该跳转链接的过期时间（ISO 字符串）；过期后需重新 POST */
  expiresAt: string
}

export type GithubInstallationStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type GithubAccountType = 'USER' | 'ORGANIZATION'
export type GithubRepoVisibility = 'PUBLIC' | 'PRIVATE' | 'INTERNAL'
export type GithubAuthorizationStatus = 'AUTHORIZED' | 'REVOKED'

/**
 * GET /teams/{teamId}/integrations/github/installations 列表项
 * TODO[后端联调] 字段名以 Java DTO 为准，若不一致在此对齐
 * 已冻结见 docs：主键为本地 `id`；`providerInstallationId` 仅展示；status 不含 EXPIRED。
 *
 * accountType：安装时选的是个人账号(User)还是组织(Organization)
 */
export interface GithubInstallation {
  /** github_installations.id，Qgents 本地 UUID；绑定 / sync / 筛选用 */
  id: string
  /** GitHub Installation 数字 ID，仅展示或排查，禁止写入绑定 body */
  providerInstallationId: number
  accountLogin: string
  accountType: GithubAccountType
  installedAt: string
  status: GithubInstallationStatus
  metadataSyncedAt: string
  /**
   * 可选：后端若直接返回授权仓库数则可展示；没有则前端用 repositories 列表统计
   * 已冻结见 docs：第一版不返回 authorizedRepositoryCount，前端按 installationId 统计。
   */
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
 * 已冻结见 docs：可见性用 visibility（不要 private 布尔）；元数据时间用 metadataSyncedAt；
 * 项目绑定 DTO 不要代码向 syncStatus / lastSyncedAt / syncError。授权仓用 authorizationStatus。
 */
export interface GithubAuthorizedRepository {
  /** github_repositories.id，Qgents 本地 UUID；绑定 body.repositoryId */
  id: string
  /** 归属哪一次 GitHub App 安装（本地 installation.id）；用于卡片「查看仓库」过滤 */
  installationId: string
  /** GitHub Repository 数字 ID，仅展示或排查，禁止写入绑定 body */
  providerRepositoryId: number
  fullName: string
  githubUrl: string
  /** 仓库默认分支；缺失时不得前端回退为 main，应禁用绑定并提示刷新 */
  defaultBranch?: string | null
  visibility: GithubRepoVisibility
  archived: boolean
  authorizationStatus: GithubAuthorizationStatus
  metadataSyncedAt: string
}

/** 项目已绑定仓库（GET/POST /projects/{projectId}/repositories） */
export interface ProjectBoundRepository {
  /** project_repositories.id；PATCH / DELETE / Task.repositoryIds 用此 id */
  id: string
  /** github_repositories.id（授权仓本地 UUID），不是 GitHub 数字 ID */
  repositoryId: string
  installationId: string
  providerRepositoryId: number
  fullName: string
  githubUrl: string
  displayName?: string
  defaultBranch: string
  authorizationStatus: GithubAuthorizationStatus
  metadataSyncedAt: string
  boundAt: string
}

/**
 * POST /projects/{projectId}/repositories 请求体
 * 已冻结见 docs：只传本地 UUID；defaultBranch 省略，后端以授权仓元数据为准。
 */
export interface BindProjectRepositoryPayload {
  installationId: string
  repositoryId: string
  displayName?: string
}

/** 仅允许绑定：已授权、未归档、默认分支非空、对应 Installation 为 ACTIVE */
export function isGithubRepoBindable(
  repo: GithubAuthorizedRepository,
  installation: GithubInstallation | undefined,
): boolean {
  return (
    repo.authorizationStatus === 'AUTHORIZED' &&
    repo.archived === false &&
    Boolean(repo.defaultBranch && repo.defaultBranch.trim()) &&
    installation?.status === 'ACTIVE'
  )
}
