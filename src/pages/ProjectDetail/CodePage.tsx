import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  Tabs,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  GithubOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import { githubApi, groupApi, projectApi } from '@/api'
import { useWorkBranches } from '@/hooks/workBranch'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository, WorkBranch } from '@/types/github'
import { toEmptyBranchDiffId } from './emptyBranchDiff'
import { MergeRequestTab } from './MergeRequestTab'
import RemoteBranchSection from './RemoteBranchSection'

const { Title, Paragraph, Text } = Typography
/**
 * 代码与 Branch
 *
 * 仓库列表：GET /projects/{projectId}/repositories（绑定记录 id）。
 * 分支行：GET /projects/{projectId}/work-branches（接口文档 v2.0.8 §6.2）。
 *         latestTask / latestDiff / openMergeRequest / lastVerification 可为 null，
 *         显示空状态，不补演示数据。
 * MR 列表：GET /projects/{projectId}/merge-requests；创建入口在 Diff 评审页。
 * 刷新：SSE task.updated / diff.created / merge-request.updated / test-run.updated
 *       会 invalidate work-branches 查询（见 realtime/queryInvalidation.ts）。
 */
export function CodePage() {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { projectId = 'demo-project' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'branches'

  const [requirementGroupId, setRequirementGroupId] = useState<string | undefined>()
  const [drawer, setDrawer] = useState<{
    repo: ProjectBoundRepository
    branch: WorkBranch
  } | null>(null)

  // 项目信息（含当前用户角色）
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const isProjectAdmin = project?.role === 'PROJECT_ADMIN'

  // 项目绑定仓库列表
  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  // 需求群（真实接口）—— 分支筛选下拉的数据源（§6.2 requirementGroupId 过滤）
  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: Boolean(projectId),
  })

  const requirementGroups = groups.filter((g) => g.type === 'REQUIREMENT')

  // 项目工作分支视图（§6.2）；SSE 会 invalidate 本 query
  const workBranchesQuery = useWorkBranches(projectId, { requirementGroupId, limit: 100 })

  // 按仓库绑定 id 分组：每条分支归属其 projectRepositoryId 对应的仓库卡片
  const repoCards = useMemo(() => {
    const repos = reposQuery.data ?? []
    const branches = workBranchesQuery.data?.data ?? []
    return repos.map((repo) => ({
      repo,
      branches: branches.filter((b) => b.projectRepositoryId === repo.id),
    }))
  }, [reposQuery.data, workBranchesQuery.data])

  // 需求组（requirementGroupId 存在）就只保留「里面有匹配分支」的仓库卡片
  const visibleCards = requirementGroupId
    ? repoCards.filter((c) => c.branches.length > 0)
    : repoCards

  async function copyBranchName(name: string) {
    try {
      await navigator.clipboard.writeText(name)
      message.success('已复制分支名')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }

  async function handleSetDefaultBranch(repoId: string, branchName: string) {
    await githubApi.updateProjectRepository(projectId, repoId, { defaultBranch: branchName })
    // 刷新仓库列表
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectRepositories(projectId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.remoteBranches.all(projectId, repoId) })
  }

  function setTab(next: string) {
    const nextParams = new URLSearchParams()
    if (next === 'mr') nextParams.set('tab', 'mr')
    else nextParams.delete('tab')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
        分支与 Diff 详情
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
              value={requirementGroupId}
              onChange={(value) => setRequirementGroupId(value)}
              options={requirementGroups.map((g) => ({
                value: g.id,
                label: g.title,
              }))}
            />
          </Space>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="分支由需求任务在受控 Workspace 中产生，不代表 Git 上的任意远程分支。"
            description="分支行来自项目工作分支视图（GET /work-branches）；Diff 列取该分支最近的 Diff 快照（与群内 Agent 产出的 diffId / changeStats 同步），无快照时显示空状态。"
          />

          {workBranchesQuery.isLoading || reposQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : workBranchesQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={formatApiError(workBranchesQuery.error)}
              action={
                <Button size="small" onClick={() => void workBranchesQuery.refetch()}>
                  重试
                </Button>
              }
            />
          ) : visibleCards.length === 0 ? (
            <Card>
              <Empty
                description={
                  requirementGroupId ? '没有匹配该需求的分支' : '当前项目尚未绑定仓库或暂无工作分支'
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
                  isProjectAdmin={isProjectAdmin}
                  onSetDefaultBranch={handleSetDefaultBranch}
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
  isProjectAdmin,
  onSetDefaultBranch,
  onOpenDrawer,
}: {
  projectId: string
  repo: ProjectBoundRepository
  branches: WorkBranch[]
  tokenColorBorder: string
  isProjectAdmin: boolean
  onSetDefaultBranch: (repoId: string, branchName: string) => Promise<void>
  onOpenDrawer: (branch: WorkBranch) => void
}) {
  const titleName = repo.displayName || repo.fullName.split('/').pop() || repo.fullName

  const columns: ColumnsType<WorkBranch> = [
    {
      title: 'Branch',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <Text code>{name}</Text>
          {record.requirementGroups.length > 0 ? (
            <Tag>{record.requirementGroups.map((g) => g.title).join(' / ')}</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: '关联 Task',
      key: 'task',
      render: (_value, record) =>
        record.latestTask ? (
          <Text>
            <Text type="success">{record.latestTask.displayCode}</Text>
            {'  '}
            {record.latestTask.title}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '最近提交',
      key: 'head',
      width: 120,
      render: (_value, record) => (
        <Text code>{record.lastKnownHead ? record.lastKnownHead.slice(0, 7) : '—'}</Text>
      ),
    },
    {
      title: 'Diff',
      key: 'diff',
      width: 130,
      render: (_value, record) => <DiffStatLink projectId={projectId} branch={record} />,
    },
    {
      title: 'MR',
      key: 'mr',
      width: 100,
      render: (_value, record) =>
        record.openMergeRequest ? (
          <Text>
            <Text type="success">#{record.openMergeRequest.number}</Text>
            {' '}
            <Text type="secondary">{record.openMergeRequest.status}</Text>
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '最近验证',
      key: 'verification',
      width: 130,
      render: (_value, record) => <VerificationTag verification={record.lastVerification} />,
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
        </Space>
      }
      extra={
        <Space>
          {repo.defaultBranch ? (
            <Tag color="blue">默认: {repo.defaultBranch}</Tag>
          ) : null}
          <a href={repo.githubUrl} target="_blank" rel="noopener noreferrer">
            {repo.fullName}
          </a>
        </Space>
      }
    >
      <Table
        rowKey="name"
        size="middle"
        pagination={false}
        columns={columns}
        dataSource={branches}
        scroll={{ x: 860 }}
      />

      {/* 远程分支管理区 */}
      <div style={{ marginTop: 12 }}>
        <RemoteBranchSection
          projectId={projectId}
          repo={repo}
          isProjectAdmin={isProjectAdmin}
          onSetDefaultBranch={onSetDefaultBranch}
        />
      </div>
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
        <Descriptions.Item label="最近提交">
          {branch.lastKnownHead ? <Text code>{branch.lastKnownHead}</Text> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="关联 Task">
          {branch.latestTask ? (
            <Link to={PATHS.projectTasks(projectId)}>
              {branch.latestTask.displayCode} {branch.latestTask.title}
            </Link>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="需求群">
          {branch.requirementGroups.length > 0 ? (
            <Space wrap>
              {branch.requirementGroups.map((g) => (
                <Tag key={g.id}>{g.title}</Tag>
              ))}
            </Space>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Diff">
          <DiffStatLink projectId={projectId} branch={branch} />
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
        <Descriptions.Item label="MR">
          {branch.openMergeRequest ? (
            <Text>
              #{branch.openMergeRequest.number} {branch.openMergeRequest.status}
            </Text>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="最近验证">
          <VerificationTag verification={branch.lastVerification} />
        </Descriptions.Item>
      </Descriptions>
    </>
  )
}

function DiffStatLink({ projectId, branch }: { projectId: string; branch: WorkBranch }) {
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
  const linkStyle = { display: 'inline-block' as const, padding: '2px 4px', borderRadius: 4 }
  const isZeroDiff = additions === 0 && deletions === 0

  if (diff) {
    return (
      <Link
        to={PATHS.projectCodeDiff(projectId, diff.id)}
        title="查看该分支 Diff"
        style={linkStyle}
      >
        {inner}
      </Link>
    )
  }

  // 后端尚未为该分支生成 Diff 快照：+/- 为 0 时仍可进入空 Diff 页，否则灰显
  if (isZeroDiff) {
    return (
      <Link
        to={PATHS.projectCodeDiff(projectId, toEmptyBranchDiffId(branch.name))}
        title="该分支暂无变更，打开空 Diff"
        style={linkStyle}
      >
        {inner}
      </Link>
    )
  }

  return <Text type="secondary" title="后端尚未生成该分支的 Diff 快照">{inner}</Text>
}

function VerificationTag({ verification }: { verification: WorkBranch['lastVerification'] }) {
  if (!verification) return <Text type="secondary">—</Text>
  const status = verification.status
  const label = `${verification.kind}: ${status}`
  if (status === 'PASSED') return <Tag color="success">{label}</Tag>
  if (status === 'RUNNING') return <Tag color="processing">{label}</Tag>
  if (status === 'FAILED') return <Tag color="error">{label}</Tag>
  return <Tag>{label}</Tag>
}
