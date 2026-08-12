import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Typography,
  Button,
  Card,
  Tag,
  Space,
  Empty,
  Spin,
  Alert,
  Table,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { GithubAuthorizedRepository, GithubInstallation } from '@/types/github'

const { Title, Paragraph, Text } = Typography

// 2.
// export interface GithubAuthorizedRepository {
//   repositoryId: string
//   fullName: string
//   githubUrl: string
//   private: boolean
//   /** 归属哪一次 GitHub App 安装；用于卡片「查看仓库」过滤 */
//   installationId?: string
//   /** 仓库默认分支（联调字段名若为 default_branch，在 api 层映射） */
//   defaultBranch?: string
//   /** 与 Qgents 的同步状态；缺省时前端按未同步展示 */
//   syncStatus?: 'SYNCED' | 'NOT_SYNCED' | 'SYNCING' | 'FAILED'
// }
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

/**
 * 某次 GitHub App 安装下的已授权仓库列表页
 * 路由：/app/integrations/github/installations/:installationId/repositories?teamId=
 * 入口：GitHub 集成页卡片「查看仓库」
 *
 * 列表列：已授权仓库 | 默认分支 | 同步状态 | 操作
 * 数据来自 GET /teams/{teamId}/integrations/github/repositories
 */
export function GithubInstallationReposPage() {
  const navigate = useNavigate()
  const { installationId = '' } = useParams<{ installationId: string }>()
  const [searchParams] = useSearchParams()
  const teamId = searchParams.get('teamId') || 'team-xinghe'//拿两个ID,一个是安装记录ID,还有一个是团队ID

  const installationsQuery = useQuery({
    queryKey: queryKeys.githubInstallations(teamId),
    queryFn: () => githubApi.listInstallations(teamId),
    enabled: Boolean(teamId),//安装列表的数组对象
  })

  const reposQuery = useQuery({
    queryKey: queryKeys.githubTeamRepositories(teamId),
    queryFn: () => githubApi.listTeamRepositories(teamId),
    enabled: Boolean(teamId),//仓库列表的数组对象
  })
// 缓存计算结果，不要没事反复循环查找
// 从一堆安装记录当中找到当前所点击的安装记录,主要还是通过路由地址进行校准
  const installation: GithubInstallation | undefined = useMemo(
    () => installationsQuery.data?.find((i) => i.installationId === installationId),//查找当前地址栏url和安装记录ID是否一致
    [installationsQuery.data, installationId],
  )
  // GitHub App 安装被删除 / 解绑了,仓库记录还保留在 Qgents 系统里，但关联关系失效，installationId 置空
  const repos = useMemo(() => {
    const all = reposQuery.data ?? []
    const scoped = all.filter((r) => r.installationId === installationId)//按照安装id进行筛选
    if (scoped.length === 0 && all.some((r) => !r.installationId)) return all//兜底返回全部
    return scoped
  }, [reposQuery.data, installationId])
// 仓库列表更新,安装id发生变化


  const accountLabel =
    installation?.accountType === 'Organization' ? 'GitHub 组织' : 'GitHub 个人账号'

  const columns: ColumnsType<GithubAuthorizedRepository> = [
    {
      title: '已授权仓库',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (_value, repo) => (
        <Space>
          <a href={repo.githubUrl} target="_blank" rel="noopener noreferrer">
            {repo.fullName}
          </a>
          {repo.private ? <Tag>Private</Tag> : <Tag color="blue">Public</Tag>}
          <a href={repo.githubUrl} target="_blank" rel="noopener noreferrer">
            <LinkOutlined />
          </a>
        </Space>
      ),
    },
    {
      title: '默认分支',
      dataIndex: 'defaultBranch',
      key: 'defaultBranch',
      width: 140,
      align: 'center',
      render: (branch: string | undefined) => branch || '—',
    },
    {
      title: '同步状态',
      dataIndex: 'syncStatus',
      key: 'syncStatus',
      width: 140,
      render: (status: GithubAuthorizedRepository['syncStatus'] | undefined) =>
        syncStatusCell(status ?? 'NOT_SYNCED'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'right',
      render: (_value, repo) => (
        <Button
          type="primary"
          size="small"
          onClick={() =>
            navigate(
              PATHS.bindRepoToProject(teamId, {
                installationId: repo.installationId || installationId,
                repositoryId: repo.repositoryId,
                fullName: repo.fullName,
              }),
            )
          }
        >
          绑定该仓库到项目
        </Button>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link to={PATHS.githubIntegration(teamId)}>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginBottom: 16 }}>
          返回 GitHub 集成
        </Button>
      </Link>

      <Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
        {installation?.accountLogin ?? installationId} · 已授权仓库
      </Title>
      <Paragraph type="secondary">
        {installation ? accountLabel : '加载安装信息…'}
        {' · '}
        installationId: <Text code>{installationId}</Text>
        {' · '}
        teamId: <Text code>{teamId}</Text>
      </Paragraph>

      <Card>
        {reposQuery.isLoading || installationsQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : reposQuery.isError ? (
          <Alert type="error" showIcon message={formatApiError(reposQuery.error)} />
        ) : repos.length === 0 ? (
          <Empty description="该安装下暂无授权仓库">
            <Paragraph type="secondary">
              可返回集成页再次「安装Github App」，在 GitHub 上调整授权仓库范围。
            </Paragraph>
          </Empty>
        ) : (
          <Table
            rowKey="repositoryId"
            columns={columns}
            dataSource={repos}
            pagination={false}
            size="middle"
          />
        )}
      </Card>
    </div>
  )
}
