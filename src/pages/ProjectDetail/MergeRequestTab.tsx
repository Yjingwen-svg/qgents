import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Empty, Select, Space, Spin, Table, Tag, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PATHS } from '@/routes/paths'
import { mergeRequestsApi } from '@/api/taskModel'
import {
  useMergeMergeRequest,
  useMergeRequests,
  useRequestMergeRequestPreflight,
} from '@/hooks/task-model'
import { formatApiError } from '@/utils/formatApiError'
import { ApiError } from '@/api/client'
import type { ProjectBoundRepository } from '@/types/github'
import type {
  MergeRequestStatus,
  MergeRequestSummary,
  PreflightStatus,
} from '@/types/task-model'
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
  if (status === 'PENDING') return '等待预检结果'
  return '门禁未知'
}

function qualityGateColor(status: string | undefined): string {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'PENDING') return 'processing'
  return 'default'
}

/**
 * 前端派生状态：严格按 PreflightStatus 区分不同阶段，便于用户理解 Dry Run 是否已通过。
 *  - 'IDLE'                未申请预检
 *  - 'DRY_RUN_RUNNING'     Dry Run 执行中（请求受理 / 排队 / 实际执行）
 *  - 'WAITING_CQ'          Dry Run 已通过，等待独立成员 CQ+1 盖章
 *  - 'READY_CREATE'        DryRun + CQ+1 都通过，等待人工点「创建MR」（仅 MANUAL 模式）
 *  - 'CREATING'            用户点了创建MR，后端正在建 PR
 *  - 'MR_CREATED'          MR 已创建（GitHub PR 已存在）
 *  - 'FAILED'              预检失败（Dry Run 失败 / CQ 被拒 / Worker 不可用等）
 */
type EffectiveState =
  | 'IDLE'
  | 'DRY_RUN_RUNNING'
  | 'WAITING_CQ'
  | 'READY_CREATE'
  | 'CREATING'
  | 'MR_CREATED'
  | 'NO_CHANGES'
  | 'FAILED'

type PreflightUiStatus = PreflightStatus | 'NO_CHANGES'

function deriveEffectiveState(
  status: string | null | undefined,
  createMode: 'MANUAL' | 'SYSTEM' | 'UNKNOWN' | undefined,
  cqApproved: boolean,
): EffectiveState {
  switch (status) {
    case null:
    case undefined:
      return 'IDLE'
    // 来自 task-model.ts 的预检状态（创建响应）
    case 'REQUESTED':
    case 'DRY_RUN_QUEUED':
    case 'DRY_RUN_RUNNING':
      return 'DRY_RUN_RUNNING'
    case 'WAITING_CQ':
      if (createMode === 'MANUAL' && cqApproved) return 'READY_CREATE'
      return 'WAITING_CQ'
    case 'CREATING_MR':
      return 'CREATING'
    case 'CQ_REJECTED':
    case 'FAILED':
    case 'STALE':
      return 'FAILED'
    case 'MR_CREATED':
      return 'MR_CREATED'
    case 'NO_CHANGES':
      return 'NO_CHANGES'
    // 来自 qualityGate.ts 的预检状态（轮询接口）
    case 'PENDING':
      return 'DRY_RUN_RUNNING'  // PENDING = Dry Run 正在运行
    case 'PASSED':
      if (createMode === 'MANUAL' && cqApproved) return 'READY_CREATE'
      return 'WAITING_CQ'  // PASSED = Dry Run 通过，等待 CQ+1
    default:
      return 'IDLE'
  }
}

function preflightButtonLabel(
  eff: EffectiveState,
  isAdmin: boolean = false,
): { text: string; loading: boolean; disabled: boolean; failed: boolean; clickable: boolean } {
  switch (eff) {
    case 'IDLE':
      return { text: '申请MR', loading: false, disabled: false, failed: false, clickable: true }
    case 'DRY_RUN_RUNNING':
      return { text: '待预检通过', loading: true, disabled: true, failed: false, clickable: false }
    case 'WAITING_CQ':
      return { text: '等待 CQ+1', loading: false, disabled: true, failed: false, clickable: false }
    case 'READY_CREATE':
      // CQ+1通过后，需要用户再点「创建MR」
      return { text: '创建MR', loading: false, disabled: false, failed: false, clickable: true }
    case 'CREATING':
      return { text: '正在创建 MR', loading: true, disabled: true, failed: false, clickable: false }
    case 'MR_CREATED':
      // MR 已创建：Admin 显示"合并"按钮，非 Admin 显示"已创建成功"（禁用）
      if (isAdmin) {
        return { text: '合并', loading: false, disabled: false, failed: false, clickable: true }
      }
      return { text: '已创建成功', loading: false, disabled: true, failed: false, clickable: false }
    case 'NO_CHANGES':
      return { text: '无新增变更', loading: false, disabled: true, failed: false, clickable: false }
    case 'FAILED':
      // 预检失败：允许用户点击重新发起预检
      return { text: '重新预检', loading: false, disabled: false, failed: true, clickable: true }
  }
}

function preflightTagText(eff: EffectiveState): string {
  switch (eff) {
    case 'IDLE': return '待创建'
    case 'DRY_RUN_RUNNING': return '正在进行质量门禁'
    case 'WAITING_CQ': return '等待 CQ+1'
    case 'READY_CREATE': return '待创建MR'
    case 'CREATING': return '正在创建 MR'
    case 'MR_CREATED': return '待合并'  // 用户要求：状态列显示"待合并"
    case 'NO_CHANGES': return '无新增变更'
    case 'FAILED': return '预检失败'
  }
}

function preflightTagColor(eff: EffectiveState): string {
  switch (eff) {
    case 'IDLE': return 'cyan'
    case 'DRY_RUN_RUNNING': return 'processing'
    case 'WAITING_CQ': return 'warning'
    case 'READY_CREATE': return 'warning'
    case 'CREATING': return 'processing'
    case 'MR_CREATED': return 'blue'
    case 'NO_CHANGES': return 'default'
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

function isNoChangesError(error: unknown): boolean {
  if (!(error instanceof ApiError) || !error.body) return false
  const body = error.body as { error?: { code?: string } }
  return body.error?.code === 'MR_NO_CHANGES'
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

  // 表格、CQ 查询和操作列必须使用同一份数据。
  const displayItems = items

  const mergeMr = useMergeMergeRequest(projectId)
  const requestPreflight = useRequestMergeRequestPreflight(projectId)
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  // 记录每行的预检状态（前端跟踪，真实环境由 SSE/后端返回）
  const [preflightStatusMap, setPreflightStatusMap] = useState<Record<string, PreflightUiStatus>>({})
  const [coverageMap, setCoverageMap] = useState<Record<string, { taskCount: number; diffCount: number }>>({})
  // 预检状态是否正在加载（用于显示 loading 状态）
  const [preflightLoading, setPreflightLoading] = useState(false)
  // 已完成加载预检状态的 MR ID 集合
  const [loadedPreflightIds, setLoadedPreflightIds] = useState<Set<string>>(new Set())

  // 页面加载和真实占位行替换时恢复已启动的预检状态。
  // 优化：使用并发控制（最多 3 个同时请求），避免超过浏览器并发限制
  const CONCURRENCY_LIMIT = 3
  const PREFLIGHT_QUERY_TIMEOUT_MS = 8000
  const preflightPolling = true
  const [preflightPollingInterval] = useState(10000)  // 轮询间隔

  // 并发控制：限制同时发出的请求数量
  async function asyncPool<T>(
    items: T[],
    limit: number,
    iteratorFn: (item: T) => Promise<void>,
  ) {
    const executing: Promise<void>[] = []
    for (const item of items) {
      const p = iteratorFn(item).finally(() => {
        const idx = executing.indexOf(p)
        if (idx > -1) executing.splice(idx, 1)
      })
      executing.push(p)
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
    await Promise.all(executing)
  }

  useEffect(() => {
    if (displayItems.length === 0) return // 等待 MR 列表加载完成
    const taskIds = new Set<string>()
    const pendingMrIds: string[] = []
    displayItems.forEach((mr) => {
      const currentStatus = preflightStatusMap[mr.id]
      const terminal = currentStatus === 'NO_CHANGES'
        || currentStatus === 'FAILED'
        || currentStatus === 'STALE'
        || currentStatus === 'CQ_REJECTED'
        || currentStatus === 'MR_CREATED'
      if (mr.status === 'PENDING_CREATE' && mr.taskId && !terminal) {
        taskIds.add(mr.taskId)
        if (!loadedPreflightIds.has(mr.id)) {
          pendingMrIds.push(mr.id)
        }
      }
    })
    if (taskIds.size === 0) return
    // 有未加载的 MR 则显示 loading
    const shouldShowLoading = pendingMrIds.length > 0 && Object.keys(preflightStatusMap).length === 0
    if (shouldShowLoading) setPreflightLoading(true)

    let cancelled = false
      ; (async () => {
        try {
          const newMap: Record<string, PreflightUiStatus> = {}
          const loadedIds = new Set(loadedPreflightIds)

          // 使用并发控制，最多 CONCURRENCY_LIMIT 个同时请求
          await asyncPool(Array.from(taskIds), CONCURRENCY_LIMIT, async (taskId) => {
            if (cancelled) return
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), PREFLIGHT_QUERY_TIMEOUT_MS)
            try {
              const res = await mergeRequestsApi.getTaskPreflight(projectId, taskId, controller.signal)
              if (cancelled) return
              if (res?.items?.length) {
                const taskMrRows = displayItems.filter((mr) => mr.taskId === taskId && mr.status === 'PENDING_CREATE')
                taskMrRows.forEach((mr) => {
                  const repoStatus = res.items.find((it) => it.repositoryId === mr.repositoryId)
                  loadedIds.add(mr.id)
                  if (repoStatus?.failureCode === 'MR_NO_CHANGES') {
                    newMap[mr.id] = 'NO_CHANGES'
                  } else if (repoStatus?.dryRunStatus) {
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
            } catch {
              // 静默失败
            } finally {
              clearTimeout(timeoutId)
            }
          })

          if (cancelled) return
          if (Object.keys(newMap).length > 0) setPreflightStatusMap((prev) => ({ ...prev, ...newMap }))
          setLoadedPreflightIds(loadedIds)
        } catch {
          // 静默失败
        } finally {
          if (!cancelled) setPreflightLoading(false)
        }
      })()

    // 轮询：每 10 秒刷新一次（仅当有 PENDING_CREATE 行时）
    if (preflightPolling && taskIds.size > 0) {
      const timer = setTimeout(() => {
        // 重置已加载状态，触发下一次刷新
        setLoadedPreflightIds(new Set())
      }, preflightPollingInterval)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, displayItems, preflightPolling, preflightStatusMap])

  // ============== 自动模式（createMode = SYSTEM）：页面加载完自动触发申请预检 ==============
  // 后端返回占位 MR 时已经标记好 SYSTEM，前端就不需要用户再手动点「申请MR」。
  const autoStartRef = useRef<Set<string>>(new Set())
  const autoStartTriedCountRef = useRef(0)
  useEffect(() => {
    if (displayItems.length === 0) return
    const systemRows = displayItems.filter((mr) =>
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
            setCoverageMap((prev) => ({
              ...prev,
              [__mr.id]: { taskCount: res.coveredTaskIds.length, diffCount: res.coveredDiffIds.length },
            }))
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
          } catch (error) {
            if (isNoChangesError(error)) {
              setPreflightStatusMap((prev) => ({ ...prev, [__mr.id]: 'NO_CHANGES' }))
              message.info('该分支与目标分支没有新增提交，无需申请 MR')
            } else {
              setPreflightStatusMap((prev) =>
                prev[__mr.id] === 'REQUESTED'
                  ? { ...prev, [__mr.id]: 'FAILED' }
                  : prev,
              )
            }
          }
        })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayItems, preflightStatusMap, creatingId, requestPreflight])

  function handleMerge(record: MergeRequestSummary) {
    modal.confirm({
      title: `合并 MR #${record.number}？`,
      content: `将 ${record.sourceBranch} 合并到 ${record.targetBranch}。此操作不可撤销。`,
      okText: '确认合并',
      cancelText: '取消',
      okButtonProps: { loading: mergingId === record.id },
      onOk: async () => {
        setMergingId(record.id)
        const progressKey = `merge-request-${record.id}`
        message.open({
          key: progressKey,
          type: 'loading',
          content: '正在请求 GitHub 合并，请稍候…',
          duration: 0,
        })
        try {
          const result = await mergeMr.mutateAsync(record.id)
          setItems((prevItems) => prevItems.map((item) =>
            item.id === record.id
              ? {
                ...item, mergeOperationStatus: result.mergeOperationStatus ?? item.mergeOperationStatus,
                status: result.status,
              }
              : item,
          ))
          if (result.mergeOperationStatus === 'RUNNING') {
            message.open({
              key: progressKey,
              type: 'info',
              content: '合并请求已受理，GitHub 正在处理，页面会自动刷新结果。',
              duration: 4,
            })
          } else if (result.status === 'MERGED') {
            message.open({ key: progressKey, type: 'success', content: 'MR 已合并', duration: 3 })
          } else {
            message.open({ key: progressKey, type: 'warning', content: '合并尚未完成，请稍后查看 MR 状态。', duration: 4 })
          }
        } catch (error) {
          message.open({ key: progressKey, type: 'error', content: formatApiError(error), duration: 5 })
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
    // 检查 repositoryId 是否存在
    if (!record.repositoryId) {
      message.error('缺少仓库绑定信息，无法申请预检')
      console.error('[handleCreate] repositoryId is missing', record)
      return
    }
    // 如果已在预检流程中，根据当前状态决定是否允许重新申请
    const currentStatus = preflightStatusMap[record.id]
    if (currentStatus && !['FAILED', 'STALE', 'CQ_REJECTED'].includes(currentStatus)) {
      // 预检进行中或已在等待 CQ，只允许「重新预检」的场景
      const label = preflightButtonLabel(
        deriveEffectiveState(currentStatus, record.createMode, false),
      )
      if (label.loading || currentStatus === 'WAITING_CQ' || currentStatus === 'MR_CREATED') {
        message.info(`当前状态：${label.text}，无需重复操作`)
        return
      }
    }
    // 直接执行预检申请（无需弹窗确认）
    setCreatingId(record.id)
    setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'REQUESTED' }))
    // 添加调试日志
    console.log('[handleCreate] Request payload:', {
      taskId,
      repositoryId: record.repositoryId,
      record: {
        id: record.id,
        status: record.status,
        createMode: record.createMode,
        sourceBranch: record.sourceBranch,
        targetBranch: record.targetBranch,
      },
    })
    requestPreflight
      .mutateAsync({
        taskId,
        repositoryId: record.repositoryId,
      })
      .then((res) => {
        console.log('[handleCreate] API success:', res)
        setPreflightStatusMap((prev) => ({ ...prev, [record.id]: res.status }))
        setCoverageMap((prev) => ({
          ...prev,
          [record.id]: { taskCount: res.coveredTaskIds.length, diffCount: res.coveredDiffIds.length },
        }))
        if (res.mergeRequest && res.status === 'MR_CREATED') {
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
      })
      .catch((error) => {
        console.error('[handleCreate] API error:', error)
        // 解析后端错误响应结构: { error: { code, message, details: [{field, message}] }, requestId }
        let errorMessage = formatApiError(error)
        let details: Array<{ field?: string; message?: string }> = []
        // ApiError 实例的 body 包含完整响应
        if (error instanceof ApiError && error.body) {
          const body = error.body as { error?: { code?: string; message?: string; details?: unknown[] }; requestId?: string }
          if (body?.error?.details && Array.isArray(body.error.details)) {
            details = body.error.details as Array<{ field?: string; message?: string }>
          }
          // 构建更详细的错误消息
          if (details.length > 0) {
            const detailMsgs = details.map(d => `${d.field || '字段'}: ${d.message || '不合法'}`).join('; ')
            errorMessage = `${body.error?.message || errorMessage} - ${detailMsgs}`
          }
        }
        console.error('[handleCreate] Error details:', {
          status: error?.status,
          errorMessage,
          details,
          fullBody: error instanceof ApiError ? error.body : null,
        })
        if (isNoChangesError(error)) {
          setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'NO_CHANGES' }))
          message.info('该分支与目标分支没有新增提交，无需申请 MR')
        } else {
          setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'FAILED' }))
          message.error({
            content: errorMessage,
            duration: 5, // 延长显示时间
          })
        }
      })
      .finally(() => {
        setCreatingId(null)
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
          setCoverageMap((prev) => ({
            ...prev,
            [record.id]: { taskCount: res.coveredTaskIds.length, diffCount: res.coveredDiffIds.length },
          }))
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
          if (isNoChangesError(error)) {
            setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'NO_CHANGES' }))
            message.info('该分支与目标分支没有新增提交，无需创建 MR')
          } else {
            setPreflightStatusMap((prev) => ({ ...prev, [record.id]: 'FAILED' }))
            message.error(formatApiError(error))
          }
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
            <Tooltip title="Qgents 任务产生的待创建占位记录，尚未在 GitHub 创建 PR。MR_FIRST 会自动发起预检；DIFF_FIRST 需点击「申请MR」。">
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
        render: (_value, record) => {
          const coverage = coverageMap[record.id]
          return (
            <Space size={[6, 4]} wrap>
              <Text>
                <Text code>{record.sourceBranch}</Text>
                {' → '}
                <Text code>{record.targetBranch}</Text>
              </Text>
              {coverage && (coverage.taskCount > 1 || coverage.diffCount > 1) ? (
                <Tag color="blue">{coverage.taskCount} 个任务 · {coverage.diffCount} 个 Diff</Tag>
              ) : null}
            </Space>
          )
        },
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
        render: (value: MergeRequestStatus, record) => {
          if (record.status === 'PENDING_CREATE') {
            const status = preflightStatusMap[record.id]
            // 如果还没加载完成，显示 loading
            if (!status && preflightLoading) {
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Spin size="small" />
                  <Text type="secondary">加载中</Text>
                </span>
              )
            }
            const eff = deriveEffectiveState(status, record.createMode, false)
            return <Tag color={preflightTagColor(eff)}>{preflightTagText(eff)}</Tag>
          }
          return <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>
        },
      },
      {
        title: 'CQ+1',
        key: 'cqPlusOne',
        width: 120,
        render: (_value, record) => {
          const enabled = Boolean(record.taskId)
          if (!enabled) return <Text type="secondary">—</Text>
          const status = preflightStatusMap[record.id]
          const isCqApproved = status === 'MR_CREATED'
          const isCqRejected = status === 'CQ_REJECTED'
          const isNoChanges = status === 'NO_CHANGES'
          const isLoading = !status && preflightLoading
          return (
            <Tooltip title="点击跳转到 CQ+1 大印章审查页">
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                disabled={isLoading}
                onClick={(e) => {
                  e.stopPropagation()
                  const params = new URLSearchParams({
                    taskId: record.taskId ?? '',
                    repositoryId: record.repositoryId ?? '',
                    targetBranch: record.targetBranch ?? '',
                  })
                  if (record.status !== 'PENDING_CREATE' && record.id) {
                    params.set('mr', record.id)
                  }
                  navigate(`${PATHS.projectCqReview(projectId)}?${params.toString()}`)
                }}
              >
                <Tag color={isLoading ? 'default' : isCqApproved ? 'success' : isCqRejected ? 'error' : 'default'}>
                  {isLoading ? '加载中' : isNoChanges ? '无需 CQ+1' : isCqApproved ? 'CQ+1 通过' : isCqRejected ? 'CQ+1 未通过' : 'WAITING'}
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
        render: (_value, record) => {
          const status = preflightStatusMap[record.id]
          const isDryRunFailed = status === 'FAILED'
          if (record.status === 'PENDING_CREATE' && !status && preflightLoading) {
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Spin size="small" />
              </span>
            )
          }
          if (isDryRunFailed) {
            return <Tag color="error">质量门禁失败</Tag>
          }
          return (
            <Tag color={qualityGateColor(record.qualityGate?.status)}>
              {qualityGateLabel(record.qualityGate?.status)}
            </Tag>
          )
        },
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
        render: (_value, record) => {
          // ============== PENDING_CREATE：占位 MR，预检流程阶段 ==============
          if (record.status === 'PENDING_CREATE') {
            const status = preflightStatusMap[record.id]
            if (!status && preflightLoading) {
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Spin size="small" />
                  <Text type="secondary">加载中</Text>
                </span>
              )
            }
            const eff = deriveEffectiveState(status, record.createMode, false)
            const { text, loading, disabled, failed, clickable } = preflightButtonLabel(eff, isAdmin)

            // MR_CREATED：后端已在 GitHub 成功创建 PR
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
                  {/* Admin 显示"合并"按钮，非 Admin 显示"已创建成功" */}
                  {isAdmin ? (
                    <Button
                      size="small"
                      type="primary"
                      loading={mergingId === record.id || record.mergeOperationStatus === 'RUNNING'}
                      disabled={record.mergeOperationStatus === 'RUNNING'}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleMerge(record)
                      }}
                    >
                      {record.mergeOperationStatus === 'RUNNING' ? '合并中' : text}
                    </Button>
                  ) : (
                    <Button size="small" disabled>
                      {text}
                    </Button>
                  )}
                </Space>
              )
            }

            // 申请失败：显示 tooltip 原因
            let tip: string | null = null
            if (eff === 'FAILED') {
              if (status === 'CQ_REJECTED') tip = 'CQ+1 未通过，申请失败'
              else if (status === 'FAILED') tip = '质量门禁失败'
              else tip = '预检上下文过期，请刷新重试'
            } else if (eff === 'IDLE') {
              const gatePassed = record.qualityGate?.status === 'PASSED'
              if (!gatePassed) tip = '申请前请确保质量门禁 = 通过'
            } else if (eff === 'READY_CREATE') {
              tip = 'Dry Run + CQ+1 已通过，点击创建 MR 后由后端在 GitHub 端创建真实 PR'
            } else if (eff === 'NO_CHANGES') {
              tip = '当前分支 HEAD 与目标分支相同，没有可提交到 MR 的新增变更'
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
            record.qualityGate?.status === 'PASSED' &&
            record.mergeOperationStatus !== 'RUNNING'
          const children: ReactElement[] = []
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
                loading={mergingId === record.id || record.mergeOperationStatus === 'RUNNING'}
                onClick={(event) => {
                  event.stopPropagation()
                  handleMerge(record)
                }}
              >
                {record.mergeOperationStatus === 'RUNNING' ? '合并中' : '合并MR'}
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
    [projectId, repositories, isAdmin, mergingId, creatingId, items, preflightStatusMap, coverageMap, navigate, handleMerge, handleCreate],
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
            <span>Qgents 中有已完成交付或等待预检的任务时，列表会插入占位记录（仅展示 Qgents 任务分支，不是 GitHub 全部远程分支）。点击操作列的</span>
            <Tag color="cyan" style={{ margin: 0 }}>申请MR</Tag>
            <span>按钮启动预检：Dry Run → CQ+1 → 后端创建 GitHub PR。MR_FIRST 会自动申请，DIFF_FIRST 需要手动申请。</span>
            <Button size="small" type="link" style={{ padding: 0, margin: 0 }} onClick={() => void query.refetch()}>
              手动刷新
            </Button>
          </Space>
        }
        description="预检通过后由后端在 GitHub 创建 PR。Project Admin 可在操作列看到 GitHub 跳转 + 合并MR 按钮，普通成员仅看到 GitHub 跳转。Dry Run 或 CQ+1 被拒绝时显示失败，预检进行中或等待 CQ+1 时不会误显示为失败。"
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
      ) : displayItems.length === 0 ? (
        <Empty description="当前筛选下没有 MR。任务完成后系统会自动插入占位记录。" />
      ) : (
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={displayItems}
          scroll={{ x: 1120 }}
        />
      )}
    </Space>
  )
}
