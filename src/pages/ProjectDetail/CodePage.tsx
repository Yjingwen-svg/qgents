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
import {
  GithubOutlined,
  MoreOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { githubApi } from '@/api/github'
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
  demoBoundReposForProject,
  repoAlias,
} from './codeBranchDemo'

const { Title, Paragraph, Text } = Typography

/**
 * 代码与 Branch
 * TODO: 仓库绑定 / 分支列表
 * TODO: Diff 预览、手动创建 MR
 *
 * 仓库列表：GET /projects/{projectId}/repositories（绑定记录 id）。
 * 分支行：文档暂无分支查询接口，当前为页面演示数据。
 */
export function CodePage() {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { projectId = 'demo-project' } = useParams<{ projectId: string }>()

  const [requirementId, setRequirementId] = useState<string | undefined>()
  const [drawer, setDrawer] = useState<{
    repo: ProjectBoundRepository
    branch: ProjectBranchRow
  } | null>(null)

  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  const repos = useMemo(() => {
    const fromApi = reposQuery.data ?? []
    if (fromApi.length > 0) return fromApi
    return demoBoundReposForProject(projectId)
  }, [reposQuery.data, projectId])

  const repoCards = useMemo(() => {
    return repos.map((repo) => {
      const allBranches = branchesForBoundRepo(repo)
      const branches = requirementId
        ? allBranches.filter((b) => b.requirementGroupId === requirementId)
        : allBranches
      return { repo, branches }
    })
  }, [repos, requirementId])

  const visibleCards = requirementId
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

  function openCreateMrPlaceholder() {
    // TODO: Diff 预览、手动创建 MR
    message.info('创建 MR 需要已接受的 Diff；本页第一版先占位，不新开页面')
  }

  const usingDemoFallback =
    (reposQuery.data?.length ?? 0) === 0 && demoBoundReposForProject(projectId).length > 0

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
        代码与 Branch
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        projectId: <Text code>{projectId}</Text>
        {usingDemoFallback ? ' · 当前为演示仓库（接口暂无绑定时）' : null}
      </Paragraph>

      <Space wrap style={{ marginBottom: 16 }}>
        <Text type="secondary">需求过滤</Text>
        <Select
          allowClear
          placeholder="全部需求"
          style={{ minWidth: 180 }}
          value={requirementId}
          onChange={(value) => setRequirementId(value)}
          options={PROJECT_REQUIREMENTS.map((r) => ({
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
        description="「状态」表示该分支相对默认分支是否还能继续开发：正常、落后基线、冲突、已合并。受保护标记、Testset、MR 数量是另外几列，不要混在一起。"
      />

      {reposQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : reposQuery.isError && repos.length === 0 ? (
        <Alert type="error" showIcon message={formatApiError(reposQuery.error)} />
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
              <Button type="primary" onClick={openCreateMrPlaceholder}>
                创建 MR
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
  repo,
  branches,
  tokenColorBorder,
  onOpenDrawer,
}: {
  repo: ProjectBoundRepository
  branches: ProjectBranchRow[]
  tokenColorBorder: string
  onOpenDrawer: (branch: ProjectBranchRow) => void
}) {
  const alias = repoAlias(repo)
  const titleName = repo.displayName || repo.fullName.split('/').pop() || repo.fullName

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
      render: (status: BranchHealthStatus) => <HealthTag status={status} />,
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
        <Text>
          <Text type="success">+{record.diffAdditions}</Text>
          {' / '}
          <Text type="danger">-{record.diffDeletions}</Text>
        </Text>
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
          <Text type="success">+{branch.diffAdditions}</Text>
          {' / '}
          <Text type="danger">-{branch.diffDeletions}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="MR">{branch.mrCount}</Descriptions.Item>
      </Descriptions>
    </>
  )
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
  const label = branchTestLabel(status)
  if (status === 'PASSED') return <Tag color="success">{label}</Tag>
  if (status === 'RUNNING') return <Tag color="processing">{label}</Tag>
  if (status === 'FAILED') return <Tag color="error">{label}</Tag>
  return <Tag>{label}</Tag>
}
