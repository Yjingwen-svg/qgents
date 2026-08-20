import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Empty, Select, Space, Spin, Table, Tag, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQueries } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { qualityGateApi } from '@/api/qualityGate'
import { useCreateMergeRequest, useMergeMergeRequest, useMergeRequests } from '@/hooks/task-model'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository } from '@/types/github'
import type { MergeRequestStatus, MergeRequestSummary } from '@/types/task-model'
import type { Preflight } from '@/types/qualityGate'
import { githubPullRequestUrl } from './mergeRequestDisplay'

const { Text } = Typography

const STATUS_OPTIONS: Array<{ value: MergeRequestStatus; label: string }> = [
  { value: 'PENDING_CREATE', label: '待创建' },
  { value: 'OPEN', label: '进行中' },
  { value: 'MERGED', label: '已合并' },
  { value: 'CLOSED', label: '已关闭' },
]

function isMergeRequestStatus(value: string | null): value is MergeRequestStatus {
  return value === 'OPEN' || value === 'MERGED' || value === 'CLOSED' || value === 'PENDING_CREATE'
}

function statusLabel(status: MergeRequestStatus): string {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

function statusColor(status: MergeRequestStatus): string {
  if (status === 'OPEN') return 'blue'
  if (status === 'MERGED') return 'green'
  if (status === 'CLOSED') return 'default'
  // PENDING_CREATE：占位 MR，GitHub PR 尚未创建
  return 'cyan'
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

function cqLabel(preflight: Preflight | undefined, isLoading: boolean, isError: boolean, status: Preflight['cqPlusOne']['status'] | 'MISSING' | undefined): string {
  if (status === 'MISSING') return '待盖章'
  if (isLoading) return 'CQ 查询中'
  if (isError) return 'CQ 未知'
  const s = preflight?.cqPlusOne?.status
  if (s === 'APPROVED') return 'CQ+1 通过'
  if (s === 'REJECTED') return 'CQ+1 未通过'
  if (s === 'PENDING' || !s) return '待盖章'
  return s
}

function cqColor(preflight: Preflight | undefined, isLoading: boolean, isError: boolean): string {
  if (isLoading || isError) return 'default'
  const s = preflight?.cqPlusOne?.status
  if (s === 'APPROVED') return 'success'
  if (s === 'REJECTED') return 'error'
  // PENDING / 无记录
  return 'warning'
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
  isAdmin = false,
}: {
  projectId: string
  repositories: ProjectBoundRepository[]
  isAdmin?: boolean
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const repositoryId = searchParams.get('repositoryId')?.trim() || undefined
  const statusParam = searchParams.get('status')
  const status = isMergeRequestStatus(statusParam) ? statusParam : undefined
  const { modal, message } = App.useApp()

  const query = useMergeRequests(projectId, {
    repositoryId,
    status,
    limit: 50,
  })
  const items = query.data?.data ?? []

  // ========== 每行的 CQ+1 状态：useQueries 按 (projectId+taskId+repoId+targetBranch) 查 Preflight =====
  // taskId 为空或未关联任务的 MR（如纯手动 GitHub 创建）不查，直接显示 "—"
  const cqQueries = useQueries({
    queries: items.map((mr) => {
      const enabled = Boolean(mr.taskId) && Boolean(mr.repositoryId) && Boolean(mr.targetBranch)
      return {
        queryKey: ['preflight', 'mr-row', projectId, mr.taskId || '', mr.repositoryId || '', mr.targetBranch || ''],
        enabled,
        staleTime: 30 * 1000,
        gcTime: 2 * 60 * 1000,
        queryFn: async (): Promise<Preflight | null> => {
          if (!enabled) return null
          const res = await qualityGateApi.preflight(projectId, {
            taskId: mr.taskId!,
            repositoryId: mr.repositoryId!,
            targetBranch: mr.targetBranch!,
          })
          return (res as unknown) as Preflight | null
        },
      }
    }),
  })

  const mergeMr = useMergeMergeRequest(projectId)
  const createMr = useCreateMergeRequest(projectId)
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)

  function handleMerge(record: MergeRequestSummary) {
    modal.confirm({
      title: `合并 MR #${record.number}？`,
      content: `将 ${record.sourceBranch} 合并到 ${record.targetBranch}。此操作不可撤销。`,
      okText: '确认合并',
      cancelText: '取消',
      okButtonProps: { loading: mergingId === record.id },
      onOk: async () => {
        setMergingId(record.id)
        try {
          await mergeMr.mutateAsync(record.id)
          message.success('MR 已合并')
        } catch (error) {
          message.error(formatApiError(error))
        } finally {
          setMergingId(null)
        }
      },
    })
  }

  function handleCreate(record: MergeRequestSummary) {
    const taskId = record.taskId
    if (!taskId) {
      message.warning('该 MR 未关联任务，无法从列表直接创建 GitHub PR')
      return
    }
    modal.confirm({
      title: '确认创建 GitHub PR？',
      content: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <p>
            将在仓库 <code>{repoLabel(repositories, record.repositoryId)}</code>
            基于 <code>{record.sourceBranch} → {record.targetBranch}</code> 真的创建 GitHub PR。
          </p>
          <p style={{ color: '#6d7d95', margin: 0 }}>
            ⚠️ 操作前请确保 <strong>质量门禁 = 通过</strong> 且
            <strong> CQ+1 = 通过</strong>。
            按钮在前置条件未满足时仍可点击，但 GitHub 端可能会被分支策略阻止合并。
          </p>
        </div>
      ),
      okText: '立即创建',
      cancelText: '取消',
      okButtonProps: { loading: creatingId === record.id },
      onOk: async () => {
        setCreatingId(record.id)
        try {
          await createMr.mutateAsync({
            taskId,
            repositoryId: record.repositoryId,
            targetBranch: record.targetBranch,
            title: record.title?.trim() || `${record.sourceBranch} → ${record.targetBranch}`,
          })
          message.success('已创建 GitHub PR，列表稍后自动刷新')
        } catch (error) {
          message.error(formatApiError(error))
        } finally {
          setCreatingId(null)
        }
      },
    })
  }

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
        render: (_value, record) => (
          record.status === 'PENDING_CREATE' ? (
            <Tooltip title="大任务识别后自动插入的占位记录，尚未在 GitHub 创建 PR。点击操作列的「创建」按钮才会真的创建 PR。">
              <Text type="secondary" style={{ cursor: 'help' }}>待创建</Text>
            </Tooltip>
          ) : <Text strong>#{record.number}</Text>
        ),
      },
      {
        title: '标题',
        key: 'title',
        render: (_value, record) => (
          <Space size={[6, 4]} wrap>
            <Text>
              {record.title?.trim() || `${record.sourceBranch} → ${record.targetBranch}`}
            </Text>
            {record.createMode === 'MANUAL' ? (
              <Tag color="purple" style={{ marginInlineStart: 0 }}>
                人工创建
              </Tag>
            ) : null}
            {record.createMode === 'SYSTEM' ? (
              <Tag color="geekblue" style={{ marginInlineStart: 0 }}>
                自动创建
              </Tag>
            ) : null}
            {/* createMode === 'UNKNOWN' 不显示 Tag（兼容后端尚未回传该字段的旧版本） */}
          </Space>
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
        title: 'CQ+1',
        key: 'cqPlusOne',
        width: 120,
        render: (_value, record, index) => {
          const q = cqQueries[index]
          const enabled = Boolean(record.taskId)
          if (!enabled) return <Text type="secondary">—</Text>
          return (
            <Tooltip title="点击跳转到 CQ+1 大印章审查页（只有真正盖章后，才会标记通过）">
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                disabled={q?.isLoading}
                onClick={(e) => {
                  e.stopPropagation()
                  const params = new URLSearchParams({
                    taskId: record.taskId ?? '',
                    repositoryId: record.repositoryId ?? '',
                    targetBranch: record.targetBranch ?? '',
                  })
                  navigate(`${PATHS.projectCqReview(projectId)}?${params.toString()}`)
                }}
              >
                <Tag color={cqColor(q?.data, q?.isLoading, q?.isError)}>
                  {cqLabel(q?.data, q?.isLoading, q?.isError, q?.isFetched && !q?.data ? 'MISSING' : undefined)}
                </Tag>
              </Button>
            </Tooltip>
          )
        },
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
        title: '操作',
        key: 'action',
        width: 156,
        align: 'right',
        render: (_value, record) => {
          if (record.status === 'PENDING_CREATE') {
            const gatePassed = record.qualityGate?.status === 'PASSED'
            // CQ 通过 = 查 preflight 里是否 APPROVED，使用 cqQueries[index].data.cqPlusOne.status === 'APPROVED'
            // 若 CQ 查询还没回来，默认把按钮做成「可点但提示」；如果门禁/CQ未过，tooltip 提示原因
            const rowIndex = items.findIndex((it) => it.id === record.id)
            const cq = cqQueries[rowIndex]
            const cqApproved = cq?.data?.cqPlusOne?.status === 'APPROVED'
            let tip: string | null = null
            if (!gatePassed) tip = '需要质量门禁 = 通过'
            else if (cq?.isLoading) tip = 'CQ+1 状态查询中…'
            else if (!cqApproved) tip = '需要 CQ+1 = 通过'
            const btn = (
              <Button
                size="small"
                type="primary"
                ghost
                loading={creatingId === record.id}
                onClick={(event) => {
                  event.stopPropagation()
                  handleCreate(record)
                }}
              >
                创建
              </Button>
            )
            return tip ? <Tooltip title={tip}>{btn}</Tooltip> : btn
          }
          const canMerge =
            isAdmin &&
            record.status === 'OPEN' &&
            record.qualityGate?.status === 'PASSED'
          if (canMerge) {
            return (
              <Button
                size="small"
                type="primary"
                loading={mergingId === record.id}
                onClick={(event) => {
                  event.stopPropagation()
                  handleMerge(record)
                }}
              >
                合并
              </Button>
            )
          }
          if (record.status === 'OPEN' && record.qualityGate?.status !== 'PASSED') {
            return <Text type="secondary">门禁未过</Text>
          }
          if (record.status === 'MERGED' || record.status === 'CLOSED') {
            return <Text type="secondary">—</Text>
          }
          return <Text type="secondary">—</Text>
        },
      },
      {
        title: '',
        key: 'link',
        width: 88,
        align: 'right',
        render: (_value, record) => {
          const href = githubPullRequestUrl(
            record.webUrl,
            record.number,
            repositories.find((item) => item.id === record.repositoryId),
          )
          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              GitHub
            </a>
          ) : (
            <Text type="secondary">—</Text>
          )
        },
      },
    ],
    [projectId, repositories, isAdmin, mergingId, creatingId, items, cqQueries, navigate, handleMerge, handleCreate],
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
        message={
          <Space>
            <span>大任务完成后系统会先在此列表插入占位记录（状态「待创建」），质量门禁与 CQ+1 都通过后，</span>
            <Button size="small" type="link" style={{ padding: 0, margin: 0 }} onClick={() => void query.refetch()}>
              手动刷新
            </Button>
          </Space>
        }
        description="在操作列点击「创建」才会真的去 GitHub 端创建 PR。合并仍需 Project Admin 执行，并必须质量门禁通过。"
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
        <Empty description="当前筛选下没有 MR。任务完成后系统会自动插入占位记录。" />
      ) : (
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={items}
          scroll={{ x: 1120 }}
        />
      )}
    </Space>
  )
}
