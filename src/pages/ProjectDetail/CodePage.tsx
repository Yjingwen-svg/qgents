import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Drawer,
  Descriptions,
  Alert,
  Empty,
  Spin,
  Select,
  Tabs,
  App,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  GithubOutlined,
  MoreOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { useDiffs } from '@/hooks/task-model'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository } from '@/types/github'
import {
  branchHealthLabel,
  branchTestLabel,
  type BranchHealthStatus,
  type BranchTestStatus,
  type ProjectBranchRow,
} from '@/types/codeBranch'
import { PROJECT_REQUIREMENTS } from './requirements'
import {
  branchesForBoundRepo,
  repoAlias,
} from './codeBranchDemo'
import { syncBranchesWithDiffs } from './branchDiffSync'
import { toEmptyBranchDiffId } from './emptyBranchDiff'
import { MergeRequestTab } from './MergeRequestTab'
import { groupApi } from '@/api'

const { Title, Paragraph, Text } = Typography
// 分支行仍用演示骨架（文档：分支查询本轮不做）；+/- 与 diffId 对齐 GET /diffs（Agent 产出）
/**
 * 代码与 Branch
 *
 * 仓库列表：GET /projects/{projectId}/repositories（绑定记录 id）。
 * 分支行：文档暂无分支查询接口，骨架用演示数据；+/- 以 Diff 列表 changeStats 为准。
 * MR 列表：GET /projects/{projectId}/merge-requests；创建入口在 Diff 评审页。
 * Diff 列：有快照则进详情；+/- 为 0 且无快照也可点进空页。
 * Agent 新 Diff 经项目 SSE diff.created → invalidate → 本页 useDiffs 自动刷新。
 */
export function CodePage() {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { projectId = 'demo-project' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'mr' ? 'mr' : 'branches'

  const [requirementId, setRequirementId] = useState<string | undefined>()
  const [drawer, setDrawer] = useState<{
    repo: ProjectBoundRepository//项目绑定到仓库的选择,主要涵盖的是仓库的信息
    branch: ProjectBranchRow//?
  } | null>(null)
  //  向后端要数据 写法
  // 组件一挂上就去拉项目绑定仓库列表数据
  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),//拉到的数据的名字,相同也页面可以用缓存
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),//只有projectId有值才执行
  })

  // Agent / 受控执行产出的 Diff；与群 DIFF 卡同一 diffId；SSE 会 invalidate 本 query
  const diffsQuery = useDiffs(projectId, { limit: 100 })

// 筛选逻辑
// 先拉需求群，下拉联调时再替换 PROJECT_REQUIREMENTS
useQuery({
  queryKey: ['groups', projectId],
  queryFn: () => groupApi.listByProject(projectId),
  enabled: Boolean(projectId),
})
//基于仓库列表拼接出来的,是因为卡片的数据源就是仓库列表。
  const repoCards = useMemo(() => {
    const list = reposQuery.data ?? []
    const diffs = diffsQuery.data?.data ?? []
    return list.map((repo) => {
      const demoBranches = branchesForBoundRepo(repo)
      const allBranches = syncBranchesWithDiffs(demoBranches, diffs, repo.id)
      const branches = requirementId
        ? allBranches.filter((b) => b.requirementGroupId === requirementId)
        : allBranches
      return { repo, branches }
    })
  }, [reposQuery.data, diffsQuery.data, requirementId])
//分支的有无
  const visibleCards = requirementId//有没有暂无数据
    ? repoCards.filter((c) => c.branches.length > 0)
    : repoCards//决定卡片要不要渲染
//需求组（requirementId 存在），就只保留「里面有匹配分支」的仓库卡片；没选需求组，全部卡片原样保留。
  async function copyBranchName(name: string) {
    try {
      await navigator.clipboard.writeText(name)
      message.success('已复制分支名')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }
  // navigator.clipboard.writeText(name)：浏览器原生剪贴板 API，把分支名写入剪贴板

  function setTab(next: string) {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'mr') nextParams.set('tab', 'mr')//再点一次mr还是不变,这样的话刷新不会变
    else nextParams.delete('tab')
    if (next !== 'mr') {
      nextParams.delete('repositoryId')
      nextParams.delete('status')
    }
    setSearchParams(nextParams, { replace: true })//历史只是保留了一页
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
        代码与 Branch
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        projectId: <Text code>{projectId}</Text>
      </Paragraph>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'branches', label: '分支' },
          { key: 'mr', label: 'MR' },
        ]}
        style={{ marginBottom: 8 }}
      />

      {tab === 'mr' ? (
        <MergeRequestTab projectId={projectId} repositories={reposQuery.data ?? []} />
      ) : (
        <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Text type="secondary">需求过滤</Text>
        <Select
          allowClear
          placeholder="全部需求"
          style={{ minWidth: 180 }}
          //requirementId只是这页自己用 useState 记「下拉框当前选中了哪一项」。

          value={requirementId}
          onChange={(value) => setRequirementId(value)}
          options={PROJECT_REQUIREMENTS.map((r) => ({//联调替换requirementGroups
            value: r.id,
            label: r.title,
          }))}
        />
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="分支由需求任务在受控 Workspace 中产生，不代表 Git 上的任意远程分支。"
        description="Diff 列的 +/- 来自项目 Diff 列表（与群内 Agent 产出的 diffId / changeStats 同步）。「状态」表示相对默认分支是否还能继续开发；受保护标记、Testset、MR 是另外几列。"
      />

      {reposQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : reposQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message={formatApiError(reposQuery.error)}
          action={
            <Button size="small" onClick={() => void reposQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : visibleCards.length === 0 ? (
        <Card>
          <Empty
            description={
              requirementId ? '没有匹配该需求的分支' : '当前项目尚未绑定仓库'
            }
          />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {visibleCards.map(({ repo, branches }) => (
            <RepoBranchCard
              key={repo.id}
              projectId={projectId}
              repo={repo}
              branches={branches}
              tokenColorBorder={token.colorBorder}
              onOpenDrawer={(branch) => setDrawer({ repo, branch })}
            />
          ))}
        </Space>
      )}

      <Drawer
        title="Branch 详情"
        width={420}
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
        destroyOnHidden
        footer={
          drawer ? (
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => void copyBranchName(drawer.branch.name)}>
                复制 Branch 名称
              </Button>
            </Space>
          ) : null
        }
      >
        {drawer ? (
          <BranchDetailBody
            repo={drawer.repo}
            branch={drawer.branch}
            projectId={projectId}
          />
        ) : null}
      </Drawer>
        </>
      )}
    </div>
  )
}

function RepoBranchCard({
  projectId,
  repo,
  branches,
  tokenColorBorder,
  onOpenDrawer,
}: {
  projectId: string
  repo: ProjectBoundRepository
  branches: ProjectBranchRow[]
  tokenColorBorder: string
  onOpenDrawer: (branch: ProjectBranchRow) => void//子向父通信：子组件不维护抽屉状态，只触发回调，状态交给父组件管理
}) {
  const alias = repoAlias(repo)
  const titleName = repo.displayName || repo.fullName.split('/').pop() || repo.fullName








//type:类型
  const columns: ColumnsType<ProjectBranchRow> = [
    {
      title: 'Branch',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <Text code>{name}</Text>
          {record.protected ? <Tag color="blue">受保护</Tag> : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'healthStatus',
      key: 'healthStatus',
      width: 120,
      render: (status: BranchHealthStatus) => <HealthTag status={status} />,//渲染成标签
    },
    {
      title: '关联 Task',
      key: 'task',
      render: (_value, record) =>
        record.relatedTask ? (
          <Text>
            <Text type="success">{record.relatedTask.code}</Text>
            {'  '}
            {record.relatedTask.title}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '提交',
      dataIndex: 'commitCount',
      key: 'commitCount',
      width: 80,
      align: 'right',
    },
    {
      title: 'Diff',
      key: 'diff',
      width: 120,
      render: (_value, record) => (
        <DiffStatLink projectId={projectId} branch={record} />
      ),
    },
    {
      title: 'MR',
      dataIndex: 'mrCount',
      key: 'mrCount',
      width: 64,
      align: 'right',
    },
    {
      title: 'Testset',
      dataIndex: 'testStatus',
      key: 'testStatus',
      width: 100,
      render: (status: BranchTestStatus) => <TestStatusTag status={status} />,
    },
    {
      title: '',
      key: 'action',
      width: 48,
      align: 'right',
      render: (_value, record) => (
        <Button
          type="text"
          icon={<MoreOutlined />}
          aria-label={`查看 ${record.name} 详情`}
          onClick={() => onOpenDrawer(record)}
        />
      ),
    },
  ]

  return (
    <Card
      size="small"
      style={{ borderColor: tokenColorBorder }}
      title={
        <Space>
          <GithubOutlined />
          <Text strong>{titleName}</Text>
          {alias ? <Text type="secondary">（{alias}）</Text> : null}
        </Space>
      }
      extra={
        <a href={repo.githubUrl} target="_blank" rel="noopener noreferrer">
          {repo.fullName}
        </a>
      }
    >
      <Table
        rowKey="id"
        size="middle"
        pagination={false}
        columns={columns}
        dataSource={branches}
        scroll={{ x: 860 }}
      />
    </Card>
  )
}

function BranchDetailBody({
  repo,
  branch,
  projectId,
}: {
  repo: ProjectBoundRepository
  branch: ProjectBranchRow
  projectId: string
}) {
  const titleName = repo.displayName || repo.fullName.split('/').pop() || repo.fullName

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <GithubOutlined />
        <Text strong>{titleName}</Text>
      </Space>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Branch">{branch.name}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <HealthTag status={branch.healthStatus} />
        </Descriptions.Item>
        <Descriptions.Item label="受保护">{branch.protected ? '是' : '否'}</Descriptions.Item>
        <Descriptions.Item label="关联 Task">
          {branch.relatedTask ? (
            <Link to={PATHS.projectTasks(projectId)}>
              {branch.relatedTask.code} {branch.relatedTask.title}
            </Link>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="需求群">
          {branch.requirementTitle ? (
            <Tag>{branch.requirementTitle}</Tag>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Workspace">{branch.workspaceName || '—'}</Descriptions.Item>
        <Descriptions.Item label="创建者">{branch.createdBy || '—'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {branch.createdAt ? branch.createdAt.replace('T', ' ').replace('Z', '') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="最新提交">
          {branch.latestCommitSha ? (
            <span>
              <Text code>{branch.latestCommitSha}</Text>
              {branch.latestCommitMessage ? ` ${branch.latestCommitMessage}` : ''}
            </span>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="构建产物">
          {branch.artifactName ? (
            <Space>
              {branch.artifactPublished ? (
                <Tag color="success">已发布</Tag>
              ) : (
                <Tag>未发布</Tag>
              )}
              <Text>{branch.artifactName}</Text>
            </Space>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Testset">
          <TestStatusTag status={branch.testStatus} />
        </Descriptions.Item>
        <Descriptions.Item label="提交数">{branch.commitCount}</Descriptions.Item>
        <Descriptions.Item label="Diff">
          <DiffStatLink projectId={projectId} branch={branch} />
        </Descriptions.Item>
        <Descriptions.Item label="MR">{branch.mrCount}</Descriptions.Item>
      </Descriptions>
    </>
  )
}

function DiffStatLink({
  projectId,
  branch,
}: {
  projectId: string
  branch: ProjectBranchRow
}) {
  const diffsQuery = useDiffs(projectId, { limit: 100 })
  const diffId = (diffsQuery.data?.data ?? []).find(
    (item) => item.repositoryId === branch.projectRepositoryId && item.sourceBranch === branch.name,
  )?.id
    ?? (diffsQuery.data?.data ?? []).find((item) => item.sourceBranch === branch.name)?.id
  const inner = (
    <>
      <Text type="success">+{branch.diffAdditions}</Text>
      {' / '}
      <Text type="danger">-{branch.diffDeletions}</Text>
    </>
  )
  const linkStyle = { display: 'inline-block' as const, padding: '2px 4px', borderRadius: 4 }
  const isZeroDiff = branch.diffAdditions === 0 && branch.diffDeletions === 0

  if (diffId) {
    return (
      <Link
        to={PATHS.projectCodeDiff(projectId, diffId)}
        title="查看该分支 Diff"
        style={linkStyle}
      >
        {inner}
      </Link>
    )
  }

  // +/- 为 0 且尚无快照：仍可进入空 Diff 页
  if (isZeroDiff) {
    return (
      <Link
        to={PATHS.projectCodeDiff(projectId, toEmptyBranchDiffId(branch.id))}
        title="该分支暂无变更，打开空 Diff"
        style={linkStyle}
      >
        {inner}
      </Link>
    )
  }

  return <Text type="secondary" title="后端尚未生成该分支的 Diff 快照">{inner}</Text>
}

function HealthTag({ status }: { status: BranchHealthStatus }) {
  const label = branchHealthLabel(status)
  switch (status) {
    case 'HEALTHY':
      return (
        <Space size={6}>
          <CheckCircleFilled style={{ color: '#3fb950' }} />
          <Text>{label}</Text>
        </Space>
      )
    case 'BEHIND':
      return (
        <Space size={6}>
          <WarningFilled style={{ color: '#d29922' }} />
          <Text>{label}</Text>
        </Space>
      )
    case 'CONFLICT':
      return (
        <Space size={6}>
          <CloseCircleFilled style={{ color: '#f85149' }} />
          <Text>{label}</Text>
        </Space>
      )
    case 'MERGED':
      return (
        <Space size={6}>
          <CheckCircleOutlined />
          <Text type="secondary">{label}</Text>
        </Space>
      )
  }
}

function TestStatusTag({ status }: { status: BranchTestStatus }) {
  const label = branchTestLabel(status)//翻译成中文的
  if (status === 'PASSED') return <Tag color="success">{label}</Tag>
  if (status === 'RUNNING') return <Tag color="processing">{label}</Tag>
  if (status === 'FAILED') return <Tag color="error">{label}</Tag>
  return <Tag>{label}</Tag>
}
