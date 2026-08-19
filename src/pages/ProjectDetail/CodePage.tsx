import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  App,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { GithubOutlined, MoreOutlined } from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { workBranchesApi } from '@/api/workBranches'
import { groupApi } from '@/api'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository } from '@/types/github'
import type { WorkBranch } from '@/types/workBranch'
import { workBranchRowKey } from '@/types/workBranch'
// 临时禁用：MR 列表当前被独立路由的 Diff 详情替换，后续按需恢复
// import { MergeRequestTab } from './MergeRequestTab'

const { Title, Paragraph, Text } = Typography

/**
 * 代码与 Branch
 *
 * 仓库卡片：GET /projects/{projectId}/repositories
 * 工作分支：GET /projects/{projectId}/work-branches（行内 latestDiff / latestTask / openMergeRequest）
 * 需求筛选：GET /projects/{projectId}/groups（REQUIREMENT + Group UUID）
 * Diff 跳转：仅使用行内 latestDiff.id，跳转至 /code/diff/:diffId
 * MR 列表已下线，独立路由的 Diff 详情占位；MR Tab 由 MergeRequestTab 渲染，目前禁用以待后续启用
 *
 * 口径：docs/frontend/code-branch-backend-confirm.md
 */
export function CodePage() {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { projectId = 'demo-project' } = useParams<{ projectId: string }>()

  const [requirementGroupId, setRequirementGroupId] = useState<string | undefined>()
  const [drawer, setDrawer] = useState<{
    repo: ProjectBoundRepository
    branch: WorkBranch
  } | null>(null)

  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  const groupsQuery = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: Boolean(projectId),
  })

  const workBranchesQuery = useQuery({
    queryKey: queryKeys.workBranches.list(projectId, {
      requirementGroupId,
      limit: 100,
    }),
    queryFn: () =>
      workBranchesApi.list(projectId, {
        requirementGroupId,
        limit: 100,
      }),
    enabled: Boolean(projectId),
  })

  const requirementOptions = useMemo(() => {
    const groups = groupsQuery.data ?? []
    return groups
      .filter((group) => group.type === 'REQUIREMENT' && group.status !== 'ARCHIVED')
      .map((group) => ({ value: group.id, label: group.title }))
  }, [groupsQuery.data])

  const repoCards = useMemo(() => {
    const repos = reposQuery.data ?? []
    const branches = workBranchesQuery.data?.data ?? []
    return repos.map((repo) => ({
      repo,
      branches: branches.filter((branch) => branch.projectRepositoryId === repo.id),
    }))
  }, [reposQuery.data, workBranchesQuery.data])

  const visibleCards = requirementGroupId
    ? repoCards.filter((card) => card.branches.length > 0)
    : repoCards

  async function copyBranchName(name: string) {
    try {
      await navigator.clipboard.writeText(name)
      message.success('已复制分支名')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }

  const branchesLoading = reposQuery.isLoading || workBranchesQuery.isLoading
  const branchesError = reposQuery.isError || workBranchesQuery.isError
  const branchesErrorObj = reposQuery.error ?? workBranchesQuery.error

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
        分支与 Diff 详情
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        projectId: <Text code>{projectId}</Text>
      </Paragraph>

      <Space wrap style={{ marginBottom: 16 }}>
        <Text type="secondary">需求过滤</Text>
        <Select
          allowClear
          placeholder="全部需求群"
          style={{ minWidth: 200 }}
          loading={groupsQuery.isLoading}
          value={requirementGroupId}
          onChange={(value) => setRequirementGroupId(value)}
          options={requirementOptions}
        />
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="仅展示 Qgents 可追溯的工作分支，不是 GitHub 全量远程分支。"
        description="Diff 列仅在后端给出 latestDiff.id 时可进入详情；+/- 来自行内 latestDiff.changeStats。无 Diff 时不可跳转。需求筛选使用需求群 UUID。"
      />

          {branchesLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : branchesError ? (
            <Alert
              type="error"
              showIcon
              message={formatApiError(branchesErrorObj)}
              action={
                <Button
                  size="small"
                  onClick={() => {
                    void reposQuery.refetch()
                    void workBranchesQuery.refetch()
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : (reposQuery.data?.length ?? 0) === 0 ? (
            <Card>
              <Empty description="当前项目尚未绑定仓库" />
            </Card>
          ) : visibleCards.every((card) => card.branches.length === 0) ? (
            <Card>
              <Empty
                description={
                  requirementGroupId
                    ? '没有匹配该需求群的工作分支'
                    : '暂无工作分支（等待 Task / Workspace 产出）'
                }
              />
            </Card>
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {visibleCards.map(({ repo, branches }) =>
                branches.length === 0 && requirementGroupId ? null : (
                  <RepoBranchCard
                    key={repo.id}
                    projectId={projectId}
                    repo={repo}
                    branches={branches}
                    tokenColorBorder={token.colorBorder}
                    onOpenDrawer={(branch) => setDrawer({ repo, branch })}
                  />
                ),
              )}
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
  branches: WorkBranch[]
  tokenColorBorder: string
  onOpenDrawer: (branch: WorkBranch) => void
}) {
  const titleName = repo.displayName || repo.fullName.split('/').pop() || repo.fullName

  const columns: ColumnsType<WorkBranch> = [
    {
      title: 'Branch',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text code>{name}</Text>,
    },
    {
      title: '最近 Task',
      key: 'latestTask',
      render: (_value, record) =>
        record.latestTask ? (
          <Link to={PATHS.projectTaskDetail(projectId, record.latestTask.id)}>
            <Text type="success">{record.latestTask.displayCode}</Text>
            {'  '}
            {record.latestTask.title}
          </Link>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Diff',
      key: 'diff',
      width: 140,
      render: (_value, record) => <DiffStatCell projectId={projectId} branch={record} />,
    },
    {
      title: 'Open MR',
      key: 'openMr',
      width: 100,
      render: (_value, record) =>
        record.openMergeRequest ? (
          <Link to={PATHS.projectCodeMr(projectId, record.openMergeRequest.id)}>
            #{record.openMergeRequest.number}
          </Link>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '最近验证',
      key: 'verification',
      width: 160,
      render: (_value, record) => <VerificationCell branch={record} />,
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
          {repo.defaultBranch ? (
            <Text type="secondary">默认分支 {repo.defaultBranch}</Text>
          ) : null}
        </Space>
      }
      extra={
        <a href={repo.githubUrl} target="_blank" rel="noopener noreferrer">
          {repo.fullName}
        </a>
      }
    >
      {branches.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该仓库暂无工作分支" />
      ) : (
        <Table
          rowKey={workBranchRowKey}
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={branches}
          scroll={{ x: 720 }}
        />
      )}
    </Card>
  )
}

function BranchDetailBody({
  repo,
  branch,
  projectId,
}: {
  repo: ProjectBoundRepository
  branch: WorkBranch
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
        <Descriptions.Item label="Workspace">{branch.workspaceId || '—'}</Descriptions.Item>
        <Descriptions.Item label="HEAD">
          {branch.lastKnownHead ? <Text code>{branch.lastKnownHead}</Text> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="最近 Task">
          {branch.latestTask ? (
            <Link to={PATHS.projectTaskDetail(projectId, branch.latestTask.id)}>
              {branch.latestTask.displayCode} {branch.latestTask.title}
            </Link>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="相关需求群">
          {branch.requirementGroups.length > 0 ? (
            <Space wrap size={[4, 4]}>
              {branch.requirementGroups.map((group) => (
                <Tag key={group.id}>{group.title}</Tag>
              ))}
            </Space>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Diff">
          <DiffStatCell projectId={projectId} branch={branch} />
        </Descriptions.Item>
        {branch.latestDiff?.taskId ? (
          <Descriptions.Item label="Diff 所属 Task">
            <Space wrap size={4}>
              <Link to={PATHS.projectTaskDetail(projectId, branch.latestDiff.taskId)}>
                {branch.latestDiff.taskId}
              </Link>
              {branch.latestTask && branch.latestDiff.taskId !== branch.latestTask.id ? (
                <Text type="secondary">（与最近 Task 不同，为历史快照）</Text>
              ) : null}
            </Space>
          </Descriptions.Item>
        ) : null}
        {branch.latestTask && branch.latestTask.finalDiff === null ? (
          <Descriptions.Item label="最近 Task 最终 Diff">
            <Text type="secondary">无变更（finalDiff = null）</Text>
          </Descriptions.Item>
        ) : null}
        <Descriptions.Item label="Open MR">
          {branch.openMergeRequest ? (
            <Link to={PATHS.projectCodeMr(projectId, branch.openMergeRequest.id)}>
              #{branch.openMergeRequest.number} ({branch.openMergeRequest.status})
            </Link>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="最近验证">
          <VerificationCell branch={branch} />
        </Descriptions.Item>
      </Descriptions>
    </>
  )
}

/** 仅使用行内 latestDiff；无 id 时不可跳转 */
function DiffStatCell({ projectId, branch }: { projectId: string; branch: WorkBranch }) {
  const diff = branch.latestDiff
  const additions = diff?.changeStats.additions ?? 0
  const deletions = diff?.changeStats.deletions ?? 0
  const inner = (
    <>
      <Text type="success">+{additions}</Text>
      {' / '}
      <Text type="danger">-{deletions}</Text>
    </>
  )
  if (!diff?.id) {
    return <Text type="secondary" title="该工作分支暂无 Diff 快照">{inner}</Text>
  }
  return (
    <Link
      to={PATHS.projectCodeDiff(projectId, diff.id)}
      title="查看该分支最新 Diff"
      style={{ display: 'inline-block', padding: '2px 4px', borderRadius: 4 }}
    >
      {inner}
    </Link>
  )
}

function VerificationCell({ branch }: { branch: WorkBranch }) {
  const verification = branch.lastVerification
  if (!verification) return <Text type="secondary">—</Text>
  const shortSha = verification.commitSha.slice(0, 7)
  const stale =
    Boolean(branch.lastKnownHead) &&
    Boolean(verification.commitSha) &&
    !branch.lastKnownHead!.startsWith(verification.commitSha) &&
    !verification.commitSha.startsWith(branch.lastKnownHead!)
  return (
    <Space size={4} wrap>
      {verification.kind ? <Tag>{verification.kind}</Tag> : null}
      <Tag color={verificationColor(verification.status)}>{verification.status}</Tag>
      <Text code>{shortSha}</Text>
      {stale ? <Tag>非当前版本</Tag> : null}
    </Space>
  )
}

function verificationColor(status: string): string {
  const upper = status.toUpperCase()
  if (upper === 'PASSED' || upper === 'SUCCEEDED') return 'success'
  if (upper === 'FAILED') return 'error'
  if (upper === 'RUNNING' || upper === 'PENDING') return 'processing'
  return 'default'
}
