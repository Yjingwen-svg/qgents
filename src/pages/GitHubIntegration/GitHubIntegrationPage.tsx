import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useGithubInstallRedirect } from '@/hooks/useGithubInstall'
import {
  Typography,
  Card,
  Button,
  Tag,
  Space,
  Empty,
  Alert,
  App,
  theme,
  Row,
  Col,
  Spin,
} from 'antd'
import {
  PlusOutlined,
  ArrowLeftOutlined,
  GithubOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { DarkPage } from '@/components/DarkPage'
import type { GithubInstallation } from '@/types/github'

/**
 * ============================================================================
 * GitHub 集成页 —— 接口文档 §6
 *
 * 入口：我的团队 → 我创建的团队 → 查看详情 →「github集成」
 * 路由：/app/integrations/github?teamId=xxx
 *
 * 【本页「安装Github App」按钮职责】
 * 1. 校验 teamId（来自 URL query）
 * 2. POST /teams/{teamId}/integrations/github/installations
 * 3. 使用返回的 installationUrl 整页跳转 GitHub
 *
 * 【回调说明】
 * GET /integrations/github/callback 由 GitHub 打到后端，前端不直接请求。
 * 后端处理完后应重定向回本页，建议带：
 *   ?teamId=xxx&installed=1
 * 本页检测到 installed=1 时提示安装成功（见下方 useEffect）。
 *
 * 【页面结构】
 * - 上：已安装的 GitHub App（个人 User / 组织 Organization 卡片）
 * - 卡片「查看仓库」→ 跳转独立页 GithubInstallationReposPage
 * - 仓库页「绑定该仓库到项目」→ BindRepoToProjectPage（团队项目列表）
 *
 * 相关文件：
 * - API：src/api/github.ts
 * - 类型：src/types/github.ts
 * - Mock：src/mocks/handlers.ts
 * ============================================================================
 */

const { Title, Paragraph, Text } = Typography

// export interface GithubInstallation {
//   installationId: string
//   accountLogin: string
//   accountType: 'User' | 'Organization'
//   installedAt: string
//   status: 'ACTIVE' | 'EXPIRED'
//   /** 可选：后端若直接返回授权仓库数则可展示；没有则前端用 repositories 列表统计 */
//   authorizedRepoCount?: number
// }
// 已冻结见 docs：Installation 主键为 id；accountType = USER | ORGANIZATION；status 不含 EXPIRED。
function accountTypeLabel(type: GithubInstallation['accountType']): string {
  return type === 'ORGANIZATION' ? 'GitHub 组织' : 'GitHub 个人账号'
}

function statusTag(status: GithubInstallation['status']) {
  if (status === 'ACTIVE') return <Tag color="success">已启用</Tag>
  if (status === 'SUSPENDED') return <Tag color="warning">已暂停</Tag>
  return <Tag>已删除</Tag>
}

// 给当前团队安装 GitHub App
export function GitHubIntegrationPage() {
  const { token } = theme.useToken()
  const { message } = App.useApp() //toast
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // JS 代码里做页面跳转（编程式导航）
  // ReactRouter hook，用来读写 url 问号后面参数：
  const [searchParams, setSearchParams] = useSearchParams()
  // searchParams 是 useSearchParams() 返回的对象，代表当前 url 问号后的全部参数。

  /**
   * teamId 来源（优先级）：
   * 1. URL ?teamId=xxx（团队详情「github集成」按钮带入）
   * 2. 缺省 mock：team-xinghe（仅本地演示；联调后应强制要求 URL 带 teamId）
   *
   * TODO[后端联调] 若无 teamId，应提示用户从团队详情进入，而不是静默用默认值
   */
  const teamId = searchParams.get('teamId') || 'team-xinghe' //A是假值就返回B

  /**
   * 后端回调回跳约定（请与后端对齐）：
   * GET /integrations/github/callback 处理完后 302 →
   * /app/integrations/github?teamId={id}&installed=1
   */
  const handledRef = useRef(false)
  // 处理 GitHub 安装完成回调回跳
  useEffect(() => {
    const installed = searchParams.get('installed')
    if (installed !== '1') return
    if (handledRef.current) return
    handledRef.current = true //ref防抖操作
    message.success('GitHub App 安装/授权已完成')
    // 复制一份当前所有 url 查询参数，得到一份副本对象next。
    // 清掉 installed，避免刷新反复弹 toast
    const next = new URLSearchParams(searchParams)
    next.delete('installed')
    // 把 key 为installed的参数删掉。
    setSearchParams(next, { replace: true })
    // 默认模式:用户点浏览器左上角回退按钮，会退回到记录 A，url 又出现installed=1，又会触发 useEffect，再次弹出「安装完成」提示，bug。
    //替换模式:不新增历史，直接覆盖当前这一条历史记录

    // TODO[后端联调] 安装成功后刷新 installations / repositories 列表
    // 已冻结见 docs：installed=1 后提示一次、invalidate 列表、清理 query。
    void queryClient.invalidateQueries({ queryKey: queryKeys.githubInstallations(teamId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.githubTeamRepositories(teamId) })
  }, [searchParams, setSearchParams, message, queryClient, teamId])
  // searchParams:url 查询参数对象。
  // 只要浏览器 url 问号后面参数发生变化，searchParams 引用就会变，触发 useEffect 执行。
  //主要是看searchParams的变化,其余那两个引用一直不变

  /**
   * 「安装Github App」核心 mutation
   * ----------------------------------------------------------------------------
   * mutationFn → githubApi.createInstallation(teamId)
   *   POST /api/teams/{teamId}/integrations/github/installations
   *
   * onSuccess → 校验 installationUrl → 整页跳转 GitHub
   * onError   → toast 展示后端错误（403 非 Owner 等）
   * ----------------------------------------------------------------------------
   */
  // 修改类 / 触发式网络请求
  const installMutation = useGithubInstallRedirect(teamId)

  /** 按钮点击入口：仅触发 mutation，业务全在上面 */
  function handleInstallApp() {
    installMutation.mutate()
  }

  /** GET 团队已安装的 GitHub App 列表 */
  const installationsQuery = useQuery({
    queryKey: queryKeys.githubInstallations(teamId),//缓存地址
    queryFn: () => githubApi.listInstallations(teamId),//请求函数,返回成功之后是一个对象数组
    enabled: Boolean(teamId),//是否启用这个请求,true才执行
  })

  /** GET 团队已授权仓库（用于卡片上统计仓库数） */
  const reposQuery = useQuery({
    queryKey: queryKeys.githubTeamRepositories(teamId),
    queryFn: () => githubApi.listTeamRepositories(teamId),
    enabled: Boolean(teamId),
  })

  const installations = installationsQuery.data ?? []
  const allRepos = reposQuery.data ?? []
  // 计算某一条 GitHub App 安装记录，绑定了多少个授权仓库
  function repoCountOf(inst: GithubInstallation): number {
    if (typeof inst.authorizedRepoCount === 'number') return inst.authorizedRepoCount
    return allRepos.filter((r) => r.installationId === inst.id).length
  }

  return (
    <DarkPage>
      {/* 入口来自团队详情「github集成」，提供返回，避免只能靠浏览器后退 */}
      <Link to={PATHS.teamDetail(teamId)}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回团队详情
        </Button>
      </Link>

      <header
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
            GitHub 集成
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            团队级 GitHub App 授权与项目仓库绑定。代码操作由服务端受控执行，前端不持有 Git 凭据。
            {' · '}
            teamId: <Text code>{teamId}</Text>
          </Paragraph>
        </div>

        {/*
          安装按钮（Team Owner）
          点击 → POST .../installations → location.assign(installationUrl)
          可再次安装到另一个个人账号或组织
        */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={installMutation.isPending}
          onClick={handleInstallApp}
        >
          安装Github App
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="GitHub App 以团队为边界授权。安装时可选择个人账号或组织，并勾选授权仓库；Qgents 只访问你明确选择的仓库。"
      />

      <Card
        title="已安装的 GitHub App"
        extra={
          <Text type="secondary">当前团队已关联 {installations.length} 个安装</Text>
        }
        style={{ marginBottom: 16 }}
      >
        {installationsQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : installationsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message={formatApiError(installationsQuery.error)}
            action={
              <Button size="small" onClick={() => void installationsQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : installations.length === 0 ? (
          <Empty description="您还没有任何安装的 GitHub App，请先安装">
            <Paragraph type="secondary">
              点击右上角「安装Github App」，在 GitHub 选择个人或组织并勾选仓库。
            </Paragraph>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {installations.map((inst) => (
              <Col xs={24} md={12} key={inst.id}>
                <Card
                  size="small"
                  styles={{
                    body: {
                      background: token.colorBgContainer,
                    },
                  }}
                  style={{
                    borderColor: token.colorBorder,
                    height: '100%',
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                    <Space align="start">
                      <GithubOutlined style={{ fontSize: 28, marginTop: 4 }} />
                      <div>
                        <Space wrap>
                          <Text strong style={{ fontSize: 16 }}>
                            {inst.accountLogin}
                          </Text>
                          {statusTag(inst.status)}
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">
                            {accountTypeLabel(inst.accountType)}
                            {' · '}
                            {repoCountOf(inst)} 个仓库已授权
                          </Text>
                        </div>
                        <Text
                          type="secondary"
                          style={{ display: 'block', marginTop: 8, fontSize: 12 }}
                        >
                          安装于 {inst.installedAt}
                        </Text>
                      </div>
                    </Space>
                  </Space>

                  <Button
                    type="default"
                    icon={<EyeOutlined />}
                    style={{ marginTop: 16 }}
                    block
                    onClick={() =>
                      navigate(PATHS.githubInstallationRepos(teamId, inst.id))
                    }
                  >
                    查看仓库
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Card title="说明" type="inner">
        <ul style={{ margin: 0, paddingLeft: 20, color: token.colorTextSecondary }}>
          <li>
            GitHub App 授权为<strong>团队级</strong>；一次安装对应一个<strong>个人账号</strong>或
            <strong>组织</strong>（安装时在 GitHub 上选择）。
          </li>
          <li>
            「查看仓库」进入独立页面；仓库后的「绑定该仓库到项目」会进入本团队项目列表（Owner 可见全部项目）。
          </li>
          <li>
            点击「安装Github App」→ POST 获取 <code>installationUrl</code> → 跳转 GitHub；回调由后端
            <code> GET /integrations/github/callback </code>处理。
          </li>
        </ul>
      </Card>
    </DarkPage>
  )
}
