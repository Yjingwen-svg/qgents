import { useMutation, useQuery } from '@tanstack/react-query'
import { App } from 'antd'
import { githubApi } from '@/api/github'
import { queryKeys } from '@/query/queryKeys'
import { formatApiError } from '@/utils/formatApiError'
import type { GithubInstallation } from '@/types/github'

export type GithubAuthStatus = 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'SUSPENDED' | 'DELETED'

export function deriveGithubAuthStatus(
  installations: GithubInstallation[] | undefined,
): GithubAuthStatus {
  if (!installations || installations.length === 0) return 'NOT_AUTHORIZED'
  if (installations.some((i) => i.status === 'ACTIVE')) return 'AUTHORIZED'
  if (installations.some((i) => i.status === 'SUSPENDED')) return 'SUSPENDED'
  return 'DELETED'
}

/**
 * Team Owner：生成 GitHub App 安装/管理 URL 并整页跳转
 * POST /teams/{teamId}/integrations/github/installations
 *
 * TODO[后端联调] 排错清单：
 * 1. VITE_USE_MOCK=true？否则需 vite proxy + 后端已启动
 * 2. localStorage 是否有 qgents_access_token（401）
 * 3. 当前用户是否 Team Owner（403）
 * 4. teamId 是否真实存在（404）
 * 5. 响应是否为 HTML（代理未配好时常见 Unexpected token '<'）
 */
export function useGithubInstallRedirect(teamId: string) {
  const { message } = App.useApp()


  // useQuery：读数据（GET，自动发请求、列表、详情）,会直接执行
  // useMutation：写数据（POST/PUT/DELETE，创建、修改、删除），不会自动执行！要手动调用 mutate (),这个是写操作,需要向后端发起请求
  return useMutation({
    mutationFn: async () => {
      console.info('[GitHubInstall] 开始请求安装跳转地址', { teamId })
      if (!teamId.trim()) {
        throw new Error('缺少 teamId，请从「我创建的团队 → 查看详情 → github集成」进入本页')
      }
      const data = await githubApi.createInstallation(teamId)//先从createInstallation获取跳转地址
      console.info('[GitHubInstall] 后端返回', data)
      return data//后端返回信息
    },//后端返回信息就是这两个东西{ installationUrl, expiresAt }
    onSuccess: ({ installationUrl, expiresAt }) => {
      if (!installationUrl || typeof installationUrl !== 'string') {
        message.error('后端未返回 installationUrl，请检查 POST installations 响应')
        console.error('[GitHubInstall] 非法响应：缺少 installationUrl', { expiresAt })
        return
      }
      const expireMs = Date.parse(expiresAt)//把后端返回的过期时间字符串（比如 2026-08-14T13:30:00Z）转成毫秒时间戳。
      if (!Number.isNaN(expireMs) && expireMs < Date.now()) {//判断时间合法并且过期,才进行拦截
        message.warning('安装链接已过期，请再次点击「安装Github App」获取新链接')
        return
      }
      // 没给过期时间也能跳转
      message.loading({
        content: '正在跳转到 GitHub 完成安装…',
        key: 'github-install-redirect',// Ant Design message 的前端标识,同一个 key 再弹一次会覆盖上一条，
        duration: 1.5,
      })
      console.info('即将跳转', installationUrl)
      window.location.assign(installationUrl)
    },
    onError: (error) => {
      console.error('[GitHubInstall] 失败', error)
      message.error(formatApiError(error))
    },
  })
}

/** Team Owner：查询团队 GitHub App 安装状态 */
export function useGithubInstallations(teamId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.githubInstallations(teamId),
    queryFn: () => githubApi.listInstallations(teamId),
    enabled: Boolean(teamId) && enabled,
  })
}

export function githubAuthActionLabel(status: GithubAuthStatus): string {
  switch (status) {
    case 'NOT_AUTHORIZED':
      return '安装 GitHub App'
    case 'AUTHORIZED':
      return '添加/调整授权仓库'
    case 'SUSPENDED':
      return '安装已暂停，请到 GitHub 恢复授权'
    case 'DELETED':
      return '重新授权'
  }
}
