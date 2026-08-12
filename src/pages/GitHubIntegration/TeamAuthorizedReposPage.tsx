import { Link, useParams } from 'react-router-dom'
import { useCallback, useMemo, useState, type MouseEvent } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Typography,
  Button,
  Card,
  Tag,
  Space,
  Empty,
  Spin,
  Alert,
  App,
  theme,
  Checkbox,
  Input,
  List,
} from 'antd'
import { ArrowLeftOutlined, GithubOutlined, SearchOutlined } from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { projectApi } from '@/api/project'
import { ApiError } from '@/api/client'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import type { GithubAuthorizedRepository, GithubInstallation } from '@/types/github'

const { Title, Paragraph, Text } = Typography

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as
      | { error?: { code?: string; message?: string } }
      | undefined
    const code = body?.error?.code
    const msg = body?.error?.message
    if (code && msg) return `[${code}] ${msg}`
    if (msg) return msg
    return `请求失败 (HTTP ${error.status})`
  }
  if (error instanceof Error) return error.message
  return '未知错误'
}

function syncStatusCell(status: GithubAuthorizedRepository['syncStatus']) {
  switch (status) {
    case 'SYNCED':
      return (
        <Text style={{ color: '#3fb950' }}>
          <span style={{ marginRight: 6 }}>●</span>已同步
        </Text>
      )
    case 'SYNCING':
      return <Text type="warning">● 同步中</Text>
    case 'FAILED':
      return <Text type="danger">● 同步失败</Text>
    case 'NOT_SYNCED':
    default:
      return <Text type="secondary">● 未同步</Text>
  }
}

type Row = GithubAuthorizedRepository & {
  accountLogin?: string
  accountType?: GithubInstallation['accountType']
}

type RepoBindingHit = { projectId: string; bindingId: string }

/**
 * 该团队已授权的所有 GitHub 仓库
 * 入口：创建项目 →「绑定github仓库」
 *
 * 数据对接：
 * - GET /teams/{teamId}/integrations/github/repositories
 * - GET /teams/{teamId}/integrations/github/installations
 *   （用 installationId 拼出「授权组织/个人」展示名）
 *
 * 【绑定/解绑对接 — 与「绑定仓库到项目」页对称】
 * - GET /teams/{teamId}/projects → 团队项目列表
 * - GET /projects/{projectId}/repositories → 判断某授权仓库是否已绑到该项目
 * - POST /projects/{projectId}/repositories
 *   body: { installationId, repositoryId, defaultBranch, displayName }
 * - DELETE /projects/{projectId}/repositories/{bindingId}
 *
 * 「已绑定」定义：该 github repositoryId 至少绑到团队内任意一个项目。
 * 「绑定仓库」：把该仓库绑到团队内所有尚未绑定它的项目。
 * 「解除绑定」：从所有已绑定该仓库的项目上 DELETE。
 *
 * 【交互 — 复用绑定项目页逻辑】
 * - 搜索框过滤仓库
 * - 默认无勾选框；Ctrl/⌘+首次左键进入多选
 * - 多选时隐藏行内按钮与「一键绑定所有仓库」，显示「绑定到选中仓库（N）」
 * - 确认弹窗取消 → 退出多选并清空勾选
 */
export function TeamAuthorizedReposPage() {
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const { teamId = 'team-xinghe' } = useParams<{ teamId: string }>()

  const [keyword, setKeyword] = useState('')
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const installationsQuery = useQuery({
    queryKey: queryKeys.githubInstallations(teamId),
    queryFn: () => githubApi.listInstallations(teamId),
    enabled: Boolean(teamId),
  })

  const reposQuery = useQuery({
    queryKey: queryKeys.githubTeamRepositories(teamId),
    queryFn: () => githubApi.listTeamRepositories(teamId),
    enabled: Boolean(teamId),
  })

  /** 团队项目：绑定目标 */
  const projectsQuery = useQuery({
    queryKey: queryKeys.teamProjects(teamId),
    queryFn: () => projectApi.listByTeam(teamId),
    enabled: Boolean(teamId),
  })

  const projects = projectsQuery.data ?? []

  /**
   * 每个项目的已绑定仓库（用于计算授权仓库是否已绑定）
   * TODO[后端联调] 若提供「按 repositoryId 反查绑定」批量接口，可替换 N 次 GET
   */
  const projectRepoQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: queryKeys.projectRepositories(p.id),
      queryFn: () => githubApi.listProjectRepositories(p.id),
      enabled: Boolean(p.id),
    })),
  })

  /** github repositoryId → 已绑定到哪些项目（含 bindingId 供 DELETE） */
  const bindingsByRepoId = useMemo(() => {
    const map = new Map<string, RepoBindingHit[]>()
    projects.forEach((p, index) => {
      const list = projectRepoQueries[index]?.data ?? []
      for (const b of list) {
        const key = b.repositoryId
        const hits = map.get(key) ?? []
        hits.push({ projectId: p.id, bindingId: b.id })
        map.set(key, hits)
      }
    })
    return map
  }, [projects, projectRepoQueries])

  const rows: Row[] = useMemo(() => {
    const installations = installationsQuery.data ?? []
    const byId = new Map(installations.map((i) => [i.installationId, i]))
    return (reposQuery.data ?? []).map((repo) => {
      const inst = repo.installationId ? byId.get(repo.installationId) : undefined
      return {
        ...repo,
        accountLogin: inst?.accountLogin,
        accountType: inst?.accountType,
      }
    })
  }, [reposQuery.data, installationsQuery.data])

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.defaultBranch ?? '').toLowerCase().includes(q) ||
        (r.accountLogin ?? '').toLowerCase().includes(q) ||
        r.repositoryId.toLowerCase().includes(q),
    )
  }, [rows, keyword])

  /** 当前列表是否全部已绑定（至少绑到一个项目）→ 顶部按钮切换为解除 */
  const allFilteredBound =
    filteredRows.length > 0 &&
    filteredRows.every((r) => (bindingsByRepoId.get(r.repositoryId)?.length ?? 0) > 0)

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false)
    setSelectedIds([])
  }, [])

  const invalidateProjectBindings = useCallback(async () => {
    await Promise.all(
      projects.map((p) =>
        queryClient.invalidateQueries({ queryKey: queryKeys.projectRepositories(p.id) }),
      ),
    )
  }, [projects, queryClient])

  /**
   * 将单个授权仓库绑到「尚未绑定它的」全部团队项目
   * POST /projects/{projectId}/repositories
   */
  const bindRepoToUnboundProjects = useCallback(
    async (repo: Row) => {
      if (projects.length === 0) {
        throw new Error('该团队下暂无项目，请先创建项目')
      }
      const already = new Set(
        (bindingsByRepoId.get(repo.repositoryId) ?? []).map((h) => h.projectId),
      )
      const targets = projects.filter((p) => !already.has(p.id))
      if (targets.length === 0) return 0

      const results = await Promise.allSettled(
        targets.map((p) =>
          githubApi.bindRepository(p.id, {
            installationId: repo.installationId || '',
            repositoryId: repo.repositoryId,
            defaultBranch: repo.defaultBranch || 'main',
            displayName: repo.fullName,
          }),
        ),
      )
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        throw new Error(`${repo.fullName}：${failed.length} 个项目绑定失败`)
      }
      return targets.length
    },
    [projects, bindingsByRepoId],
  )

  /** 从所有已绑定项目上解除该仓库 */
  const unbindRepoFromAllProjects = useCallback(async (repo: Row) => {
    const hits = bindingsByRepoId.get(repo.repositoryId) ?? []
    if (hits.length === 0) return 0
    const results = await Promise.allSettled(
      hits.map((h) => githubApi.unbindRepository(h.projectId, h.bindingId)),
    )
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      throw new Error(`${repo.fullName}：${failed.length} 处解除失败`)
    }
    return hits.length
  }, [bindingsByRepoId])

  type BindScope = 'single' | 'all' | 'selected'

  const bindMutation = useMutation({
    mutationFn: async ({ repos, scope }: { repos: Row[]; scope: BindScope }) => {
      let total = 0
      for (const repo of repos) {
        total += await bindRepoToUnboundProjects(repo)
      }
      return { scope, bindOps: total }
    },
    onSuccess: async ({ scope, bindOps }) => {
      if (bindOps === 0) {
        message.success('所选仓库均已绑定，无需重复操作')
      } else if (scope === 'all') {
        message.success('成功绑定所有仓库')
      } else {
        // 单条 / 多选：统一用简短成功文案
        message.success('已成功绑定该仓库')
      }
      exitMultiSelect()
      await invalidateProjectBindings()
    },
    onError: (error) => {
      message.error(formatApiError(error))
    },
  })

  const unbindMutation = useMutation({
    mutationFn: async ({ repos, scope }: { repos: Row[]; scope: BindScope }) => {
      let total = 0
      for (const repo of repos) {
        total += await unbindRepoFromAllProjects(repo)
      }
      return { scope, total }
    },
    onSuccess: async ({ scope, total }) => {
      if (total === 0) {
        message.success('没有需要解除的绑定')
      } else if (scope === 'all') {
        message.success('成功解除绑定所有仓库')
      } else {
        message.success('已解除绑定')
      }
      exitMultiSelect()
      await invalidateProjectBindings()
    },
    onError: (error) => {
      message.error(formatApiError(error))
    },
  })

  function onRepoRowClick(repo: Row, e: MouseEvent) {
    const withCtrl = e.ctrlKey || e.metaKey
    if (!withCtrl) return
    e.preventDefault()

    if (!multiSelectMode) {
      setMultiSelectMode(true)
      setSelectedIds([repo.repositoryId])
      return
    }
    setSelectedIds((prev) =>
      prev.includes(repo.repositoryId)
        ? prev.filter((id) => id !== repo.repositoryId)
        : [...prev, repo.repositoryId],
    )
  }

  function confirmBindRepos(targetRepos: Row[], scope: BindScope) {
    if (targetRepos.length === 0) return
    const content =
      scope === 'all'
        ? '确定绑定所有仓库到该项目'
        : scope === 'single'
          ? `确定绑定 ${targetRepos[0].fullName} 仓库到该项目`
          : `确定绑定所选仓库到该项目`

    modal.confirm({
      title: '确认绑定',
      content,
      okText: '确定',
      cancelText: '取消',
      onOk: () => bindMutation.mutateAsync({ repos: targetRepos, scope }),
      onCancel: () => {
        exitMultiSelect()
      },
    })
  }

  function confirmUnbindRepos(targetRepos: Row[], scope: BindScope) {
    if (targetRepos.length === 0) return
    const content =
      scope === 'all'
        ? '确定解除所有仓库的绑定'
        : scope === 'single'
          ? `确定在该项目中解除 ${targetRepos[0].fullName} 仓库的绑定`
          : `确定在该项目中解除所选仓库的绑定`

    modal.confirm({
      title: '确认解除绑定',
      content,
      okText: '解除绑定',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => unbindMutation.mutateAsync({ repos: targetRepos, scope }),
      onCancel: () => {
        exitMultiSelect()
      },
    })
  }

  function handleBindSelected() {
    const selected = filteredRows.filter((r) => selectedIds.includes(r.repositoryId))
    confirmBindRepos(selected, selected.length === 1 ? 'single' : 'selected')
  }

  function handleBindOrUnbindAll() {
    if (allFilteredBound) {
      confirmUnbindRepos(filteredRows, 'all')
    } else {
      confirmBindRepos(filteredRows, 'all')
    }
  }

  function handleBindSingle(repo: Row) {
    confirmBindRepos([repo], 'single')
  }

  function handleUnbindSingle(repo: Row) {
    confirmUnbindRepos([repo], 'single')
  }

  const bindingsLoading = projectRepoQueries.some((q) => q.isLoading)
  const busy = bindMutation.isPending || unbindMutation.isPending

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link to={PATHS.createProject(teamId)}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回创建项目
        </Button>
      </Link>

      <Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
        该团队已授权的所有github仓库
      </Title>
      <Paragraph type="secondary">
        teamId: <Text code>{teamId}</Text>
        {' · '}
        下列仓库来自团队已安装的 GitHub App（个人或组织授权范围）
        <br />
        按住 <Text keyboard>Ctrl</Text>（Mac 为 <Text keyboard>⌘</Text>）再左键点击某一仓库，才会进入多选。
      </Paragraph>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索仓库名、默认分支、授权账号或 repositoryId"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <Card
        extra={
          <Space wrap>
            {multiSelectMode ? (
              <Button
                disabled={selectedIds.length === 0 || busy}
                onClick={handleBindSelected}
              >
                绑定到选中仓库（{selectedIds.length}）
              </Button>
            ) : (
              <Button
                type={allFilteredBound ? 'default' : 'primary'}
                danger={allFilteredBound}
                disabled={filteredRows.length === 0 || busy || bindingsLoading}
                loading={busy}
                onClick={handleBindOrUnbindAll}
              >
                {allFilteredBound ? '一键解除所有绑定' : '一键绑定所有仓库'}
              </Button>
            )}
            {multiSelectMode ? (
              <Button type="link" onClick={exitMultiSelect}>
                退出多选
              </Button>
            ) : null}
          </Space>
        }
      >
        {reposQuery.isLoading || installationsQuery.isLoading || projectsQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : reposQuery.isError ? (
          <Alert type="error" showIcon message={formatApiError(reposQuery.error)} />
        ) : filteredRows.length === 0 ? (
          <Empty description={keyword ? '没有匹配的仓库' : '该团队暂无已授权仓库'}>
            {!keyword ? (
              <Link to={PATHS.githubIntegration(teamId)}>
                <Button type="primary">去 GitHub 集成安装授权</Button>
              </Link>
            ) : null}
          </Empty>
        ) : (
          <List
            dataSource={filteredRows}
            renderItem={(repo) => {
              const checked = selectedIds.includes(repo.repositoryId)
              const hits = bindingsByRepoId.get(repo.repositoryId) ?? []
              const alreadyBound = hits.length > 0
              const kind =
                repo.accountType === 'Organization'
                  ? '组织'
                  : repo.accountType === 'User'
                    ? '个人'
                    : ''

              return (
                <List.Item
                  key={repo.repositoryId}
                  style={{
                    borderBottom: `1px solid ${token.colorBorder}`,
                    background: multiSelectMode && checked ? token.colorPrimaryBg : undefined,
                    cursor: 'pointer',
                    paddingLeft: 8,
                    paddingRight: 8,
                  }}
                  onClick={(e) => onRepoRowClick(repo, e)}
                  actions={
                    multiSelectMode
                      ? []
                      : [
                          alreadyBound ? (
                            <Button
                              key="unbind"
                              danger
                              size="small"
                              loading={busy}
                              disabled={bindingsLoading}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnbindSingle(repo)
                              }}
                            >
                              解除绑定
                            </Button>
                          ) : (
                            <Button
                              key="bind"
                              type="primary"
                              size="small"
                              loading={busy}
                              disabled={bindingsLoading}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBindSingle(repo)
                              }}
                            >
                              绑定仓库
                            </Button>
                          ),
                        ]
                  }
                >
                  <Space align="start" style={{ width: '100%' }}>
                    {multiSelectMode ? (
                      <Checkbox
                        checked={checked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => {
                          setSelectedIds((prev) =>
                            prev.includes(repo.repositoryId)
                              ? prev.filter((id) => id !== repo.repositoryId)
                              : [...prev, repo.repositoryId],
                          )
                        }}
                      />
                    ) : null}
                    <div style={{ flex: 1 }}>
                      <Space wrap>
                        <Text strong>{repo.fullName}</Text>
                        {repo.private ? <Tag>Private</Tag> : <Tag color="blue">Public</Tag>}
                        {!multiSelectMode && alreadyBound ? (
                          <Text type="success" style={{ fontSize: 12 }}>
                            已绑定
                          </Text>
                        ) : null}
                      </Space>
                      <div style={{ marginTop: 6 }}>
                        <Space size="large" wrap>
                          <Text type="secondary">
                            默认分支：{repo.defaultBranch || '—'}
                          </Text>
                          {syncStatusCell(repo.syncStatus)}
                          <Text type="secondary">
                            <GithubOutlined style={{ marginRight: 4 }} />
                            {repo.accountLogin
                              ? `${repo.accountLogin}${kind ? `（${kind}）` : ''}`
                              : '未知账号'}
                          </Text>
                        </Space>
                      </div>
                    </div>
                  </Space>
                </List.Item>
              )
            }}
          />
        )}
      </Card>
    </div>
  )
}
