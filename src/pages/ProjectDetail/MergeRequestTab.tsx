import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Empty, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMergeRequests } from '@/hooks/task-model'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository } from '@/types/github'
import type { MergeRequestStatus, MergeRequestSummary } from '@/types/task-model'

const { Text } = Typography

const STATUS_OPTIONS: Array<{ value: MergeRequestStatus; label: string }> = [
  { value: 'OPEN', label: '进行中' },
  { value: 'MERGED', label: '已合并' },
  { value: 'CLOSED', label: '已关闭' },
]

function isMergeRequestStatus(value: string | null): value is MergeRequestStatus {
  return value === 'OPEN' || value === 'MERGED' || value === 'CLOSED'
}

function statusLabel(status: MergeRequestStatus): string {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

function statusColor(status: MergeRequestStatus): string {
  if (status === 'OPEN') return 'blue'
  if (status === 'MERGED') return 'green'
  return 'default'
}

function qualityGateLabel(status: string | undefined): string {
  if (status === 'PASSED') return '门禁通过'
  if (status === 'FAILED') return '门禁未过'
  if (status === 'PENDING') return '门禁检查中'
  return '门禁未知'
}

function qualityGateColor(status: string | undefined): string {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'PENDING') return 'processing'
  return 'default'
}

function shortSha(value: string | null): string {
  if (!value) return '—'
  return value.slice(0, 7)
}

function repoLabel(repositories: ProjectBoundRepository[], repositoryId: string): string {
  const repo = repositories.find((item) => item.id === repositoryId)
  return repo?.displayName || repo?.fullName || repositoryId
}

export function MergeRequestTab({
  projectId,
  repositories,
}: {
  projectId: string
  repositories: ProjectBoundRepository[]
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const repositoryId = searchParams.get('repositoryId')?.trim() || undefined
  const statusParam = searchParams.get('status')
  const status = isMergeRequestStatus(statusParam) ? statusParam : undefined

  const query = useMergeRequests(projectId, {
    repositoryId,
    status,
    limit: 50,
  })
  const items = query.data?.data ?? []
  const navigate = useNavigate()

  function patchParams(patch: { repositoryId?: string; status?: string }) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'mr')
    if (patch.repositoryId !== undefined) {
      if (patch.repositoryId) next.set('repositoryId', patch.repositoryId)
      else next.delete('repositoryId')
    }
    if (patch.status !== undefined) {
      if (patch.status) next.set('status', patch.status)
      else next.delete('status')
    }
    setSearchParams(next, { replace: true })
  }

  const columns: ColumnsType<MergeRequestSummary> = useMemo(
    () => [
      {
        title: 'MR',
        key: 'number',
        width: 88,
        render: (_value, record) => <Text strong>#{record.number}</Text>,
      },
      {
        title: '标题',
        key: 'title',
        render: (_value, record) => (
          <Link to={PATHS.projectCodeMr(projectId, record.id)}>
            {record.title?.trim() || `${record.sourceBranch} → ${record.targetBranch}`}
          </Link>
        ),
      },
      {
        title: '分支',
        key: 'branches',
        render: (_value, record) => (
          <Text>
            <Text code>{record.sourceBranch}</Text>
            {' → '}
            <Text code>{record.targetBranch}</Text>
          </Text>
        ),
      },
      {
        title: '仓库',
        key: 'repository',
        render: (_value, record) => repoLabel(repositories, record.repositoryId),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (value: MergeRequestStatus) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
      },
      {
        title: '质量门禁',
        key: 'qualityGate',
        width: 120,
        render: (_value, record) => (
          <Tag color={qualityGateColor(record.qualityGate?.status)}>
            {qualityGateLabel(record.qualityGate?.status)}
          </Tag>
        ),
      },
      {
        title: 'HEAD',
        key: 'headCommit',
        width: 100,
        render: (_value, record) => <Text code>{shortSha(record.headCommit)}</Text>,
      },
      {
        title: '',
        key: 'link',
        width: 88,
        align: 'right',
        render: (_value, record) =>
          record.webUrl ? (
            <a
              href={record.webUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              GitHub
            </a>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
    ],
    [projectId, repositories],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap>
        <Text type="secondary">仓库</Text>
        <Select
          allowClear
          placeholder="全部仓库"
          style={{ minWidth: 200 }}
          value={repositoryId}
          onChange={(value) => patchParams({ repositoryId: value })}
          options={repositories.map((repo) => ({
            value: repo.id,
            label: repo.displayName || repo.fullName,
          }))}
        />
        <Text type="secondary">状态</Text>
        <Select
          allowClear
          placeholder="全部状态"
          style={{ minWidth: 140 }}
          value={status}
          onChange={(value) => patchParams({ status: value })}
          options={STATUS_OPTIONS}
        />
      </Space>
      <Alert
        type="info"
        showIcon
        message="这里列出的是项目镜像的 GitHub PR，不是 Diff 评审。合并仍要过质量门禁，并由 Project Admin 执行。"
      />
      {query.isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : query.isError ? (
        <Alert
          type="error"
          showIcon
          message={formatApiError(query.error)}
          action={
            <Button size="small" onClick={() => void query.refetch()}>
              重试
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <Empty description="当前筛选下没有 MR。通过 Diff 后可在评审页创建。" />
      ) : (
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={items}
          scroll={{ x: 960 }}
          onRow={(record) => ({
            onClick: () => navigate(PATHS.projectCodeMr(projectId, record.id)),
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </Space>
  )
}
