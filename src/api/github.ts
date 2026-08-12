import { request } from './client'
import type {
  BindProjectRepositoryPayload,
  GithubInstallation,
  GithubInstallationRedirect,
  GithubAuthorizedRepository,
  ProjectBoundRepository,
} from '@/types/github'

/** 接口文档统一成功响应外壳：{ data, requestId } */
interface ApiEnvelope<T> {
  data: T
  requestId?: string
}

/**
 * GitHub App 与项目仓库 —— 接口文档 §6
 *
 * ============================================================================
 * 【安装 GitHub App 全链路 — 前后端如何配合】
 *
 * ① 前端（Team Owner）点击「安装Github App」
 *    → 调用本文件 createInstallation(teamId)
 *    → POST /teams/{teamId}/integrations/github/installations
 *    → 请求头需带 Authorization: Bearer <token>
 *    → 写操作需带 Idempotency-Key（文档要求）
 *
 * ② 后端生成带 state 的 GitHub 安装 URL，返回：
 *    { data: { installationUrl, expiresAt }, requestId }
 *
 * ③ 前端拿到 installationUrl 后：window.location.assign(installationUrl)
 *    （必须整页跳转，不能只开弹窗；前端不拼 GitHub URL、不持有凭据）
 *
 * ④ 用户在 GitHub 官网完成 App 安装 / 勾选仓库
 *
 * ⑤ GitHub 浏览器回调后端（前端不直接调这个接口）：
 *    GET /integrations/github/callback
 *    后端校验 state、落库 installation 元数据与授权仓库范围
 *
 * ⑥ 后端再 302 回前端（回跳地址需与后端约定，例如）：
 *    /app/integrations/github?teamId=xxx&installed=1
 *    前端可根据 installed=1 提示「安装成功」并刷新列表
 *
 * 【权限】createInstallation / listInstallations：Team Owner
 * 【联调开关】
 * - Mock：.env 中 VITE_USE_MOCK=true（MSW 拦截，见 src/mocks/handlers.ts）
 * - 真后端：VITE_USE_MOCK=false，并在 vite.config.ts 打开 /api 代理
 * ============================================================================
 */
export const githubApi = {
  /**
   * 生成 GitHub App 安装跳转地址
   *
   * METHOD: POST
   * PATH:   /teams/{teamId}/integrations/github/installations
   * AUTH:   Team Owner（Bearer Token）
   *
   * @param teamId 当前团队 ID（从团队详情页 URL / 上下文传入）
   * @returns data.installationUrl / data.expiresAt
   *
   * TODO[后端联调] 常见失败码（以文档为准，联调时对照实际返回）：
   * - 401 未登录 / Token 失效
   * - 403 非 Team Owner（TEAM_OWNER 权限不足）
   * - 404 团队不存在
   * - 409 Idempotency-Key 复用但 body 不同
   * - 429 / 500 限流或服务异常
   */
  createInstallation(teamId: string) {
    // 每次点击生成新的幂等键，避免用户连点被当成「相同写操作」
    const idempotencyKey = crypto.randomUUID()

    return request<ApiEnvelope<GithubInstallationRedirect>>(
      `/teams/${teamId}/integrations/github/installations`,
      {
        method: 'POST',
        // 文档：写操作必须支持 Idempotency-Key
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        // body 可为空；若后端要求 {}，联调时在此补 body: {}
      },
    ).then((res) => {
      // 解开信封，页面侧只使用 data
      return res.data
    })
  },

  /**
   * 查询团队已安装的 GitHub App 列表
   * GET /teams/{teamId}/integrations/github/installations
   * 权限：Team Owner
   *
   * 用途：安装回调返回本页后，可用来刷新「是否已安装」状态
   * （当前 UI 已去掉授权状态卡片，此方法仍供联调 / 后续扩展）
   */
  listInstallations(teamId: string) {
    return request<ApiEnvelope<GithubInstallation[]>>(//TS泛型用来约束返回数据类型：
      `/teams/${teamId}/integrations/github/installations`,
    ).then((res) => res.data)
  },

  /** DELETE /teams/{teamId}/integrations/github/installations/{installationId} */
  deleteInstallation(teamId: string, installationId: string) {
    return request<void>(`/teams/${teamId}/integrations/github/installations/${installationId}`, {
      method: 'DELETE',
    })
  },

  /** GET /teams/{teamId}/integrations/github/repositories */
  listTeamRepositories(teamId: string) {
    return request<ApiEnvelope<GithubAuthorizedRepository[]>>(
      `/teams/${teamId}/integrations/github/repositories`,
    ).then((res) => res.data)
  },//只要请求回来的仓库数组

  /** GET /projects/{projectId}/repositories */
  listProjectRepositories(projectId: string) {
    return request<ApiEnvelope<ProjectBoundRepository[]>>(
      `/projects/${projectId}/repositories`,
    ).then((res) => res.data)
  },

  /** POST /projects/{projectId}/repositories */
  bindRepository(projectId: string, payload: BindProjectRepositoryPayload) {
    return request<ApiEnvelope<ProjectBoundRepository>>(`/projects/${projectId}/repositories`, {
      method: 'POST',
      body: payload,
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
    }).then((res) => res.data)
  },

  /** PATCH /projects/{projectId}/repositories/{repositoryId} */
  updateProjectRepository(
    projectId: string,
    repositoryId: string,
    payload: Pick<BindProjectRepositoryPayload, 'defaultBranch' | 'displayName'>,
  ) {
    return request<ApiEnvelope<ProjectBoundRepository>>(
      `/projects/${projectId}/repositories/${repositoryId}`,
      {
        method: 'PATCH',
        body: payload,
      },
    ).then((res) => res.data)
  },

  /** DELETE /projects/{projectId}/repositories/{repositoryId} */
  unbindRepository(projectId: string, repositoryId: string) {
    return request<void>(`/projects/${projectId}/repositories/${repositoryId}`, {
      method: 'DELETE',
    })
  },
}
