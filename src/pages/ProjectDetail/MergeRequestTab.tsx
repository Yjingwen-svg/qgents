import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Card, Empty, Progress, Select, Space, Spin, Table, Tag, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQueries } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { qualityGateApi } from '@/api/qualityGate'
import { mergeRequestsApi } from '@/api/taskModel'
import {
  useMergeMergeRequest,
  useMergeRequests,
  useRequestMergeRequestPreflight,
  useTasks,
} from '@/hooks/task-model'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository } from '@/types/github'
import type {
  MergeRequestStatus,
  MergeRequestSummary,
  PreflightStatus,
} from '@/types/task-model'
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

/**
 * MANUAL 模式派生的前端子状态（用于区分 WAITING_CQ 下 CQ 是否已人工盖章）：
 *  - 'IDLE'        未申请预检
 *  - 'PREFLIGHTING' 预检中 / Dry Run / 等待 CQ+1 人工盖章
 *  - 'READY_CREATE' DryRun + CQ+1 都通过，等待人工点「创建MR」（仅 MANUAL）
 *  - 'CREATING'    用户点了创建MR，后端正在建 PR
 *  - 'MR_CREATED'  MR 已创建
 *  - 'FAILED'      申请失败
 *  - 'AUTO_PENDING_DONE' 自动模式等待后端完成后续动作（预检中 → 自动创建）
 */
type EffectiveState =
  | 'IDLE'
  | 'PREFLIGHTING'
  | 'READY_CREATE'
  | 'CREATING'
  | 'MR_CREATED'
  | 'FAILED'

function deriveEffectiveState(
  status: PreflightStatus | null | undefined,
  createMode: 'MANUAL' | 'SYSTEM' | 'UNKNOWN' | undefined,
  cqApproved: boolean,
): EffectiveState {
  switch (status) {
    case null:
    case undefined:
      return 'IDLE'
    case 'REQUESTED':
    case 'DRY_RUN_QUEUED':
    case 'DRY_RUN_RUNNING':
      return 'PREFLIGHTING'
    case 'WAITING_CQ':
      if (createMode === 'MANUAL' && cqApproved) return 'READY_CREATE'
      return 'PREFLIGHTING'
    case 'CREATING_MR':
      return 'CREATING'
    case 'CQ_REJECTED':
    case 'FAILED':
    case 'STALE':
      return 'FAILED'
    case 'MR_CREATED':
      return 'MR_CREATED'
    default:
      return 'IDLE'
  }
}

function preflightButtonLabel(
  eff: EffectiveState,
): { text: string; loading: boolean; disabled: boolean; failed: boolean; clickable: boolean } {
  switch (eff) {
    case 'IDLE':
      return { text: '申请MR', loading: false, disabled: false, failed: false, clickable: true }
    case 'PREFLIGHTING':
      return { text: '预检中', loading: true, disabled: true, failed: false, clickable: false }
    case 'READY_CREATE':
      // 人工模式：CQ+1通过后，需要用户再点「创建MR」
      return { text: '创建MR', loading: false, disabled: false, failed: false, clickable: true }
    case 'CREATING':
      return { text: '创建MR', loading: true, disabled: true, failed: false, clickable: false }
    case 'MR_CREATED':
      return { text: '', loading: false, disabled: true, failed: false, clickable: false }
    case 'FAILED':
      return { text: '申请失败', loading: false, disabled: true, failed: true, clickable: false }
  }
}

function preflightTagText(eff: EffectiveState): string {
  switch (eff) {
    case 'IDLE': return '待创建'
    case 'PREFLIGHTING': return '预检中'
    case 'READY_CREATE': return '待创建MR'
    case 'CREATING': return '创建MR'
    case 'MR_CREATED': return '进行中'
    case 'FAILED': return '申请失败'
  }
}

function preflightTagColor(eff: EffectiveState): string {
  switch (eff) {
    case 'IDLE': return 'cyan'
    case 'PREFLIGHTING': return 'processing'
    case 'READY_CREATE': return 'warning'
    case 'CREATING': return 'processing'
    case 'MR_CREATED': return 'blue'
    case 'FAILED': return 'error'
  }
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
  // 获取 MR_FIRST 模式下正在交付（DELIVERING）的任务，用于展示交付进度卡片。
  // 这些任务的 MR 占位记录只有在代码推送完成（WAITING_PREFLIGHT）后才会出现在列表中，
  // 因此需要独立拉取 DELIVERING 状态的任务，避免用户在等待 commit/push 时看到空列表。
  const deliveringTasksQuery = useTasks(projectId, { status: 'DELIVERING', limit: 20 })
  // 过滤出 MR_FIRST 模式的任务：这些任务由系统自动完成 commit/push，
  // 完成后会自动进入 WAITING_PREFLIGHT 并在 MR 列表中生成占位记录。
  const mrFirstDeliveringTasks = useMemo(() => {
    const data = deliveringTasksQuery.data?.data ?? []
    return data.filter((task) => task.deliveryMode === 'MR_FIRST')
  }, [deliveringTasksQuery.data])
  // 使用本地 state 包裹，允许预检 MR_CREATED 时乐观回写 webUrl/number
  const [items, setItems] = useState<MergeRequestSummary[]>(query.data?.data ?? [])
  const lastDataRef = useRef(query.data?.data)
  useEffect(() => {
    const latest = query.data?.data ?? []
    if (lastDataRef.current === query.data?.data) return // query data 引用未更新，跳过
    lastDataRef.current = query.data?.data
    setItems((prev) => {
      const latestIds = latest.map((m) => m.id).join('|')
      const prevIds = prev.map((m) => m.id).join('|')
      if (latestIds !== prevIds) return latest
      return latest.map((m) => {
        const local = prev.find((p) => p.id === m.id)
        if (!local) return m
        return {
          ...m,
          webUrl: m.webUrl ?? local.webUrl,
          number: m.number ?? local.number,
        }
      })
    })
  }, [query.data?.data])

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
        // 预检期间（Dry Run → CQ+1 → MR 创建）状态变化频繁，10s 轮询自动刷新，
        // 避免用户在 MR 列表页看到过期的 Dry Run/CQ 状态。
        refetchInterval: 10000,
        refetchIntervalInBackground: false,
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
  const requestPreflight = useRequestMergeRequestPreflight(projectId)
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  // 记录每行的预检状态（前端跟踪，真实环境由 SSE/后端返回）
  const [preflightStatusMap, setPreflightStatusMap] = useState<Record<string, PreflightStatus>>({})
  const restoredRef = useRef(false)

  // 页面加载时一次性查询预检状态，恢复已启动的进度
  useEffect(() => {
    if (restoredRef.current) return
    if (items.length === 0) return // 等待 MR 列表加载完成
    const taskIds = new Set<string>()
    items.forEach((mr) => {
      if (mr.status === 'PENDING_CREATE' && mr.taskId) taskIds.add(mr.taskId)
    })
    restoredRef.current = true
    if (taskIds.size === 0) return
      ; (async () => {
        try {
          const newMap: Record<string, PreflightStatus> = {}
          for (const taskId of taskIds) {
            const res = await mergeRequestsApi.getTaskPreflight(projectId, taskId)
            if (res?.items?.length) {
              const taskMrRows = items.filter((mr) => mr.taskId === taskId && mr.status === 'PENDING_CREATE')
              taskMrRows.forEach((mr) => {
                const repoStatus = res.items.find((it) => it.repositoryId === mr.repositoryId)
                if (repoStatus?.dryRunStatus) {
                  if (repoStatus.cqStatus === 'APPROVED') {
                    newMap[mr.id] = 'MR_CREATED'
                  } else if (repoStatus.cqStatus === 'REJECTED') {
                    newMap[mr.id] = 'CQ_REJECTED'
                  } else if (repoStatus.dryRunStatus === 'PASSED') {
                    newMap[mr.id] = 'WAITING_CQ'
                  } else if (repoStatus.dryRunStatus === 'FAILED') {
                    newMap[mr.id] = 'FAILED'
                  } else {
                    newMap[mr.id] = 'DRY_RUN_RUNNING'
                  }
                }
              })
            }
          }
          if (Object.keys(newMap).length > 0) {
            setPreflightStatusMap((prev) => ({ ...prev, ...newMap }))
          }
        } catch {
          // 静默失败，不影响页面展示
        }
      })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, items.length])

  // ============== 自动模式（createMode = SYSTEM）：页面加载完自动触发申请预检 ==============
  // 后端返回占位 MR 时已经标记好 SYSTEM，前端就不需要用户再手动点「申请MR」。
  const autoStartRef = useRef<Set<string>>(new Set())
  const autoStartTriedCountRef = useRef(0)
  useEffect(() => {
    if (items.length === 0) return
    const systemRows = items.filter((mr) =>
      mr.status === 'PENDING_CREATE'
      && mr.taskId
      && mr.createMode === 'SYSTEM'
      && !preflightStatusMap[mr.id]
      && !autoStartRef.current.has(mr.id),
    )
    if (systemRows.length === 0) {
      autoStartTriedCountRef.current += 1
      return
    }
    systemRows.forEach((mr) => {
      autoStartRef.current.add(mr.id)
      // 先乐观设置为 REQUESTED
      setPreflightStatusMap((prev) => (prev[mr.id] ? prev : { ...prev, [mr.id]: 'REQUESTED' }))
      const __mr = mr
        ; (async () => {
          try {
            const res = await requestPreflight.mutateAsync({
              taskId: __mr.taskId!,
              repositoryId: __mr.repositoryId,
            })
            setPreflightStatusMap((prev) => ({ ...prev, [__mr.id]: res.status }))
            if (res.mergeRequest && res.status === 'MR_CREATED') {
              setItems((prevItems) =>
                prevItems.map((item) =>
                  item.id === __mr.id
                    ? {
                      ...item,
                      webUrl: res.mergeRequest!.webUrl,
                      number: res.mergeRequest!.number,
                      qualityGate: res.mergeRequest!.qualityGate ?? item.qualityGate,
                    }
                    : item,
                ),
              )
            }
          } catch {
            setPreflightStatusMap((prev) =>
              prev[__mr.id] === 'REQUESTED'
                ? { ...prev, [__mr.id]: 'FAILED' }
                : prev,
            )
          }
        })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, preflightStatusMap, creatingId, requestPreflight])

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
      message.warning('该 MR 未关联任务，无法从列表直接申请预检')
      return
    }
    // 如果已在预检流程中，根据当前状态决定是否允许重新申请
    const currentStatus = preflightStatusMap[record.id]
    if (currentStatus && !['FAILED', 'STALE', 'CQ_REJECTED'].includes(currentStatus)) {
      // 预检进行中或已在等待 CQ，只允许「重新预检」的场景
      const label = preflightButtonLabel(currentStatus)
      if (label.loading || currentStatus === 'WAITING_CQ' || currentStatus === 'MR_CREATED') {
        message.info(`当前状态：${label.text}，无需重复操作`)
        return
      }
    }
    modal.confirm({
      title: '申请MR？',
      content: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <p>
            将在仓库 <code>{repoLabel(repositories, record.repositoryId)}</code>
            基于 <code>{record.sourceBranch} → {record.targetBranch}</code> 启动统一预检流程。
          </p>
          <p style={{ color: '#6d7d95', margin: 0 }}>
            顺序：先执行 <strong>Dry Run</strong> → <strong>CQ+1</strong> 审查。
            <br />
            两项均通过后，由后端自动在 GitHub 端创建真实 PR，前端不绕过门禁直接创建。
          </p>
        </div>
      ),
      okText: '申请MR',
      cancelText: '取消',
      okButtonProps: { loading: creatingId === record.id },
      onOk: async () => {
        setCreatingId(record.id)
        // 先乐观设置状态为预检中
        setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'REQUESTED' }))
        try {
          const res = await requestPreflight.mutateAsync({
            taskId,
            repositoryId: record.repositoryId,
          })
          // 根据返回的预检状态更新 UI
          setPreflightStatusMap((prev) => ({ ...prev, [record.id]: res.status }))
          // MR_CREATED：后端已建 PR，回写 webUrl/number 让 GitHub 跳转按钮生效
          if (res.mergeRequest && res.status === 'MR_CREATED') {
            // 更新缓存中对应的占位 MR
            setItems((prevItems) =>
              prevItems.map((item) =>
                item.id === record.id
                  ? {
                    ...item,
                    webUrl: res.mergeRequest!.webUrl,
                    number: res.mergeRequest!.number,
                    qualityGate: res.mergeRequest!.qualityGate ?? item.qualityGate,
                  }
                  : item,
              ),
            )
          }
          if (res.status === 'FAILED' || res.status === 'STALE' || res.status === 'CQ_REJECTED') {
            message.error(res.failureReason || '申请失败')
          } else if (res.status === 'MR_CREATED') {
            message.success('MR 已创建，点击 GitHub 按钮可跳转')
          } else {
            message.success('已申请 MR，正在预检（Dry Run → CQ+1）')
          }
        } catch (error) {
          setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'FAILED' }))
          message.error(formatApiError(error))
        } finally {
          setCreatingId(null)
        }
      },
    })
  }

  /**
   * MANUAL 模式专属：Dry Run + CQ+1 通过后，用户点击「创建MR」，
   * 才让后端真正在 GitHub 创建 PR。
   */
  function handleCreateFromManualReady(record: MergeRequestSummary) {
    const taskId = record.taskId
    if (!taskId) {
      message.warning('该 MR 未关联任务')
      return
    }
    modal.confirm({
      title: '创建 MR？',
      content: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <p>
            Dry Run 与 CQ+1 均已通过。确认后将由后端在 GitHub 端基于{' '}
            <code>{record.sourceBranch} → {record.targetBranch}</code> 创建 PR。
          </p>
        </div>
      ),
      okText: '创建MR',
      cancelText: '取消',
      okButtonProps: { loading: creatingId === record.id },
      onOk: async () => {
        setCreatingId(record.id)
        setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'CREATING_MR' }))
        try {
          // 此时 MANUAL 模式需再发一次「触发后端真正创建 MR」的请求。
          // 统一使用 preflight 接口（后端在 WAITING_CQ+CQ_APPROVED 时会进入创建 MR 流程）。
          const res = await requestPreflight.mutateAsync({
            taskId,
            repositoryId: record.repositoryId,
          })
          // 如果后端一次就返回了 MR_CREATED，则直接回写
          // 否则保守地把状态推进到 CREATING_MR，等待下次刷新
          const status = res.status === 'MR_CREATED' ? 'MR_CREATED' : 'CREATING_MR'
          setPreflightStatusMap((prev) => ({ ...prev, [record.id]: status }))
          if (res.mergeRequest) {
            setItems((prevItems) =>
              prevItems.map((item) =>
                item.id === record.id
                  ? {
                    ...item,
                    webUrl: res.mergeRequest!.webUrl,
                    number: res.mergeRequest!.number,
                    qualityGate: res.mergeRequest!.qualityGate ?? item.qualityGate,
                  }
                  : item,
              ),
            )
            message.success('MR 已创建，点击 GitHub 按钮可跳转')
          } else if (res.status === 'FAILED' || res.status === 'STALE' || res.status === 'CQ_REJECTED') {
            message.error(res.failureReason || '创建 MR 失败')
          } else {
            message.success('正在创建 MR，稍后会显示 GitHub 跳转')
          }
        } catch (error) {
          setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'FAILED' }))
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
            <Tooltip title="大任务识别后自动插入的占位记录，尚未在 GitHub 创建 PR。自动模式会自动发起预检；人工模式需点击「申请MR」。">
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
        width: 120,
        render: (value: MergeRequestStatus, record, index: number) => {
          if (record.status === 'PENDING_CREATE') {
            const currentStatus = preflightStatusMap[record.id]
            const cq = cqQueries[index]
            const cqApproved = cq?.data?.cqPlusOne?.status === 'APPROVED'
            const eff = deriveEffectiveState(currentStatus, record.createMode, cqApproved)
            return <Tag color={preflightTagColor(eff)}>{preflightTagText(eff)}</Tag>
          }
          return <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>
        },
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
            <Tooltip title="点击跳转到 CQ+1 大印章审查页">
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
                  // 真实 MR（非 PENDING_CREATE）才传 mr，让 CqReviewPage 进入 MR 模式
                  if (record.status !== 'PENDING_CREATE' && record.id) {
                    params.set('mr', record.id)
                  }
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
        width: 220,
        align: 'right',
        render: (_value, record, index: number) => {
          // ============== PENDING_CREATE：占位 MR，预检流程阶段 ==============
          if (record.status === 'PENDING_CREATE') {
            const currentStatus = preflightStatusMap[record.id]
            const cq = cqQueries[index]
            const cqApproved = cq?.data?.cqPlusOne?.status === 'APPROVED'
            const eff = deriveEffectiveState(currentStatus, record.createMode, cqApproved)
            const { text, loading, disabled, failed, clickable } = preflightButtonLabel(eff)

            // MR_CREATED：后端已在 GitHub 成功创建 PR → 操作列：GitHub + Admin合并MR
            if (eff === 'MR_CREATED') {
              const href = githubPullRequestUrl(
                record.webUrl,
                record.number,
                repositories.find((item) => item.id === record.repositoryId),
              )
              return (
                <Space size={8} wrap>
                  {href ? (
                    <Button
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation()
                        window.open(href, '_blank')
                      }}
                    >
                      GitHub
                    </Button>
                  ) : null}
                  {isAdmin && record.qualityGate?.status === 'PASSED' ? (
                    <Button
                      size="small"
                      type="primary"
                      loading={mergingId === record.id}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleMerge(record)
                      }}
                    >
                      合并MR
                    </Button>
                  ) : null}
                  {!href && !isAdmin ? <Text type="secondary">—</Text> : null}
                </Space>
              )
            }

            // 申请失败：显示 tooltip 原因
            let tip: string | null = null
            if (eff === 'FAILED') {
              if (currentStatus === 'CQ_REJECTED') tip = 'CQ+1 未通过，申请失败'
              else if (currentStatus === 'FAILED') tip = 'Dry Run 或质量门禁失败'
              else tip = '预检上下文过期，请刷新重试'
            } else if (eff === 'IDLE') {
              const gatePassed = record.qualityGate?.status === 'PASSED'
              if (!gatePassed) tip = '申请前请确保质量门禁 = 通过'
            } else if (eff === 'READY_CREATE') {
              tip = 'Dry Run + CQ+1 已通过，点击创建 MR 后由后端在 GitHub 端创建真实 PR'
            }

            const btn = (
              <Button
                size="small"
                type={failed ? 'default' : 'primary'}
                danger={failed}
                ghost={!loading && !failed}
                loading={creatingId === record.id || loading}
                disabled={disabled || (!clickable && !failed)}
                onClick={(event) => {
                  event.stopPropagation()
                  if (eff === 'READY_CREATE') {
                    // MANUAL 模式：用户点「创建MR」→ 触发真正的 MR 创建
                    handleCreateFromManualReady(record)
                  } else {
                    handleCreate(record)
                  }
                }}
              >
                {text}
              </Button>
            )
            return tip ? <Tooltip title={tip}>{btn}</Tooltip> : btn
          }

          // ============== OPEN / MERGED / CLOSED：真实 MR 已存在 ==============
          // 真实 MR 存在时，操作列独立渲染 GitHub + Admin 合并MR（与GitHub列重复但符合用户需求）
          const href = githubPullRequestUrl(
            record.webUrl,
            record.number,
            repositories.find((item) => item.id === record.repositoryId),
          )
          const canMerge =
            isAdmin &&
            record.status === 'OPEN' &&
            record.qualityGate?.status === 'PASSED'
          const children: JSX.Element[] = []
          if (href) {
            children.push(
              <Button
                key="gh"
                size="small"
                onClick={(event) => {
                  event.stopPropagation()
                  window.open(href!, '_blank')
                }}
              >
                GitHub
              </Button>,
            )
          }
          if (canMerge) {
            children.push(
              <Button
                key="merge"
                size="small"
                type="primary"
                loading={mergingId === record.id}
                onClick={(event) => {
                  event.stopPropagation()
                  handleMerge(record)
                }}
              >
                合并MR
              </Button>,
            )
          }
          if (record.status === 'OPEN' && record.qualityGate?.status !== 'PASSED') {
            return <Text type="secondary">门禁未过</Text>
          }
          if (record.status === 'MERGED' || record.status === 'CLOSED') {
            return href ? children[0] ?? <Text type="secondary">—</Text> : <Text type="secondary">—</Text>
          }
          return children.length > 0 ? <Space size={8}>{children}</Space> : <Text type="secondary">—</Text>
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
    [projectId, repositories, isAdmin, mergingId, creatingId, items, cqQueries, preflightStatusMap, navigate, handleMerge, handleCreate],
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
            <span>大任务完成后系统会在列表中插入占位记录。点击操作列的</span>
            <Tag color="cyan" style={{ margin: 0 }}>申请MR</Tag>
            <span>按钮启动统一预检：Dry Run → CQ+1 → 后端自动创建 GitHub PR。</span>
            <Button size="small" type="link" style={{ padding: 0, margin: 0 }} onClick={() => void query.refetch()}>
              手动刷新
            </Button>
          </Space>
        }
        description="预检通过后自动在 GitHub 创建 PR。Project Admin 可在操作列看到 GitHub 跳转 + 合并MR 按钮，普通成员仅看到 GitHub 跳转。CQ+1 或质量门禁任一未过则显示申请失败。"
      />
      {/* MR_FIRST 交付进度卡片：展示正在 commit/push 的任务，让用户在等待期间能看到进度 */}
      {mrFirstDeliveringTasks.length > 0 && !deliveringTasksQuery.isLoading ? (
        <Card
          size="small"
          style={{ marginBottom: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag color="processing">MR_FIRST 交付中</Tag>
            <Text strong style={{ fontSize: 14 }}>
              {mrFirstDeliveringTasks.length} 个任务正在自动交付（commit/push 进行中）
            </Text>
            <Button
              size="small"
              type="link"
              onClick={() => void deliveringTasksQuery.refetch()}
            >
              刷新
            </Button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mrFirstDeliveringTasks.map((task) => {
              // 计算等待时间
              const updatedAt = new Date(task.updatedAt)
              const elapsedMin = Math.floor((Date.now() - updatedAt.getTime()) / 60000)
              const isStuck = elapsedMin >= 5
              return (
                <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0', borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onClick={() => navigate(PATHS.projectTaskDetail(projectId, task.id))}
                    >
                      {task.title}
                    </Button>
                    <Tag color={isStuck ? 'warning' : 'processing'} style={{ margin: 0 }}>
                      {isStuck ? `DELIVERING · ${elapsedMin}min` : 'DELIVERING'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {task.repositories.length} 个仓库
                    </Text>
                  </div>
                  <Progress
                    percent={isStuck ? 20 : 10}
                    status={isStuck ? 'warning' : 'active'}
                    size="small"
                    showInfo={false}
                    style={{ width: 500 }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {isStuck
                      ? `已等待 ${elapsedMin} 分钟，如长时间无变化请前往任务详情查看`
                      : '代码推送完成后自动创建 MR占位记录'
                    }
                  </Text>
                </div>
              )
            })}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            <strong>交付流程：</strong> Diff 批次 → commit/push → Dry Run → CQ+1 → 创建 MR
            。代码推送完成后任务会自动转为「等待预检」状态，届时 MR 占位记录将自动出现在下方列表中。
          </Text>
        </Card>
      ) : null}
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
        <Empty description={
          mrFirstDeliveringTasks.length > 0
            ? 'MR_FIRST 任务正在自动交付中，代码推送完成后将自动在此生成 MR 占位记录。'
            : '当前筛选下没有 MR。任务完成后系统会自动插入占位记录。'
        } />
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
