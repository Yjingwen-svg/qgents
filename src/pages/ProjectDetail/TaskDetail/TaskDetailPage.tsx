import { Alert, App, Button, Card, Col, Form, Input, Result, Row, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CodeOutlined, CopyOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useCancelTask, useConfirmTaskDiffReview, useDiffs, useRejectTaskDiffReview, useRetryTaskDiffReviewDelivery, useTask, useTaskDiagnostics, useTaskDiffReview, useTaskRuns, useTaskSteps } from '@/hooks/task-model'
import { usePreflight } from '@/hooks/qualityGate'
import type {
  DiffReviewBatch,
  Task,
  TaskRunSummary,
  TaskStep,
  TaskStatus,
  TaskStatusReason,
} from '@/types/task-model'
import type { Preflight } from '@/types/qualityGate'
import { PATHS } from '@/routes/paths'
import { useTaskCompletedWithoutCode } from '@/store/taskNoCodeChangeStore'
import { TaskModelStatusTag } from '../TaskCenter/TaskModelStatusTag'
import { TaskRunInspectorPanel } from './TaskRunInspectorDrawer'
import { WorkspaceDiffPreviewCard } from './WorkspaceDiffPreviewCard'
import { PreflightPanel } from '../PreflightPanel'
import { EmptyState } from '@/components/EmptyState'
import styles from './TaskDetailPage.module.scss'

const { Text, Title } = Typography

// ——— 本地内联 helper（避免依赖不存在的 taskDetailHelpers/PreflightRepoQuery 等文件）———
function display(value: string | null | undefined): string {
  return value?.trim() || '暂无'
}
function formatDate(value: string | null | undefined): string {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return display(value)
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
function isDiffReviewTask(status: Task['status'] | undefined): boolean {
  return (
    status === 'WAITING_DIFF_CONFIRMATION'
    || status === 'WAITING_PREFLIGHT'
    || status === 'DIFF_REJECTED'
    || status === 'DELIVERING'
    || status === 'DELIVERY_FAILED'
    || status === 'SUCCEEDED'
  )
}
function normalizeTaskForDisplay(task: Task): Task {
  const capabilities = task.capabilities
  return {
    ...task,
    requirement: typeof task.requirement === 'string' ? task.requirement : task.requirementSummary ?? '',
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
    repositories:
      Array.isArray(task.repositories) && task.repositories.length > 0
        ? task.repositories
        : Array.isArray(task.workspace?.repositories) ? task.workspace.repositories : [],
    executionSummary:
      task.executionSummary && typeof task.executionSummary === 'object'
        ? task.executionSummary
        : {
          totalSteps: 0,
          pendingSteps: 0,
          runningSteps: 0,
          waitingSteps: 0,
          blockedSteps: 0,
          succeededSteps: 0,
          failedSteps: 0,
          currentStage: null,
          currentStageTitle: null,
          requiresUserAction: false,
        },
    capabilities: {
      canCancel: capabilities?.canCancel === true,
      canReplacePendingStepAgent: capabilities?.canReplacePendingStepAgent === true,
      canConfirmDiffReview: capabilities?.canConfirmDiffReview === true,
      canRejectDiffReview: capabilities?.canRejectDiffReview === true,
      canRetryDelivery: capabilities?.canRetryDelivery === true,
    },
    sourceMessage:
      task.sourceMessage && task.sourceMessage.sender && typeof task.sourceMessage.sender.displayName === 'string'
        ? task.sourceMessage
        : null,
  }
}
function resolveReturnPath(state: unknown, projectId: string, _taskId: string): string {
  const fallback = PATHS.projectTasks(projectId)
  return state && typeof state === 'object' && 'from' in state
    && typeof (state as { from?: unknown }).from === 'string'
    && (state as { from: string }).from.startsWith(PATHS.projectTasks(projectId))
    ? (state as { from: string }).from
    : fallback
}
function errorCode(error: Error | null): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object' || !('error' in error.body)) return undefined
  const bodyError = (error.body as { error?: { code?: unknown } }).error
  return typeof bodyError?.code === 'string' ? bodyError.code : undefined
}
function diffReviewError(error: Error): string {
  const code = errorCode(error)
  if (code === 'DIFF_REVIEW_FORBIDDEN') return '暂无 Diff 验收权限'
  if (code === 'DIFF_REVIEW_NOT_FOUND') return '最终 Diff 尚未生成'
  if (code === 'DIFF_REVIEW_NOT_DECIDABLE') return 'Diff 状态已变化，请刷新后重试'
  if (code === 'DIFF_DELIVERY_NOT_RETRYABLE') return '当前交付状态不可重试'
  return 'Diff 操作失败'
}
function TaskStartupFailureAlert({ statusReason }: { statusReason: TaskStatusReason }) {
  return (
    <Alert
      type="warning"
      showIcon
      closable
      message={`任务异常：${statusReason.title}`}
      description={<Text type="secondary">{statusReason.summary}</Text>}
    />
  )
}
function mapRunOrStepStatus(status: TaskStep['status'] | TaskRunSummary['status']): TaskStatus | null {
  const map: Record<string, TaskStatus | undefined> = {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    QUEUED: 'RUNNING',
    BLOCKED: 'DELIVERY_FAILED',
    CANCELLED: 'CANCELLED',
    CANCELLING: 'CANCELLING',
    WAITING_INPUT: 'WAITING_DIFF_CONFIRMATION',
    WAITING_APPROVAL: 'WAITING_PREFLIGHT',
    PASSED: 'SUCCEEDED',
  }
  return map[status] ?? null
}

export default function TaskDetailPage() {
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const taskQuery = useTask(projectId, taskId)
  const diagnosticsQuery = useTaskDiagnostics(projectId, taskId)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const taskRunsQuery = useTaskRuns(projectId, taskId, { limit: 5 })
  const diffsQuery = useDiffs(projectId, { taskId, limit: 100 })
  const cancelMutation = useCancelTask(projectId)
  const completedWithoutCode = useTaskCompletedWithoutCode(projectId, taskId)
  const reviewEnabled =
    (isDiffReviewTask(taskQuery.data?.status) || taskQuery.data?.status === 'SUCCEEDED') && !completedWithoutCode
  const diffReviewQuery = useTaskDiffReview(projectId, taskId, reviewEnabled)

  const [searchParams, setSearchParams] = useSearchParams()
  const [hasClearedRunSelection, setHasClearedRunSelection] = useState(false)
  const paramBatchId = searchParams.get('diffReviewBatchId')
  const selectedRunId = searchParams.get('runId')

  // —— 【关键】usePreflight 必须在任何 early return 之前调用，且参数稳定使用 URL projectId/taskId，
  //    避免首次 render 走到 isLoading return，后续 usePreflight 才调用而出现「Hooks 顺序不一致」。
  const rawTask = taskQuery.data
  const firstRepoId =
    (Array.isArray(rawTask?.repositories) && rawTask.repositories.length > 0)
      ? rawTask.repositories[0]!.repositoryId
      : (Array.isArray(rawTask?.workspace?.repositories) && rawTask.workspace.repositories.length > 0)
        ? rawTask.workspace.repositories[0]!.repositoryId
        : ''
  const firstRepoBaseRef =
    (Array.isArray(rawTask?.repositories) && rawTask.repositories.length > 0)
      ? rawTask.repositories[0]!.baseRef ?? ''
      : (Array.isArray(rawTask?.workspace?.repositories) && rawTask.workspace.repositories.length > 0)
        ? rawTask.workspace.repositories[0]!.baseRef ?? ''
        : ''
  const preflightQuery = usePreflight(projectId, taskId, firstRepoId, firstRepoBaseRef)

  useEffect(() => {
    setHasClearedRunSelection(false)
  }, [taskId])
  useEffect(() => {
    if (!paramBatchId) return
    const attentionBatchId = taskQuery.data?.attention?.diffReviewBatchId
    const loadedBatchId = diffReviewQuery.data?.id
    if (attentionBatchId !== paramBatchId && loadedBatchId !== paramBatchId) return
    const target = document.getElementById('output-delivery')
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [paramBatchId, taskQuery.data?.attention?.diffReviewBatchId, diffReviewQuery.data?.id])

  if (taskQuery.isLoading) return <DetailState loading description="正在加载任务详情" />
  if (taskQuery.isError) return <DetailError error={taskQuery.error} resource="任务详情" />
  const task = taskQuery.data
  if (!task || task.projectId !== projectId || task.id !== taskId) return <DetailState description="任务不存在或不可见" />
  const currentTask = normalizeTaskForDisplay(task)
  const firstRepo = currentTask.repositories[0] ?? null
  const steps = stepsQuery.data?.data ?? []
  const recentRuns = taskRunsQuery.data?.data ?? []
  const inspectedRunId = hasClearedRunSelection ? null : selectedRunId ?? recentRuns[0]?.id ?? null

  function handleCancel() {
    if (!window.confirm('确认取消此任务？服务端将按安全检查点停止执行。')) return
    cancelMutation.mutate(currentTask.id, {
      onError: (error) => { if (error instanceof ApiError && error.status === 409) void taskQuery.refetch() },
    })
  }

  function locate(id: string) {
    const target = document.getElementById(id)
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function openRun(taskRunId: string) {
    setHasClearedRunSelection(false)
    const next = new URLSearchParams(searchParams)
    next.set('runId', taskRunId)
    setSearchParams(next)
  }

  function clearRunSelection() {
    setHasClearedRunSelection(true)
    if (!selectedRunId) return
    const next = new URLSearchParams(searchParams)
    next.delete('runId')
    setSearchParams(next)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Space style={{ width: '100%' }} size={4}>
          <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(resolveReturnPath(location.state, projectId, taskId))}>返回任务中心</Button>
          <TaskModelStatusTag status={task.status} completedWithoutCode={completedWithoutCode} />
        </Space>
      </div>
      <div className={styles.taskWorkspace}>
        <div className={styles.taskWorkspaceMain}>
          <CompactTaskHeader task={currentTask} projectId={projectId} onCancel={handleCancel} cancelPending={cancelMutation.isPending} completedWithoutCode={completedWithoutCode} />
          {cancelMutation.error ? <CancelError error={cancelMutation.error} onRefresh={() => void taskQuery.refetch()} /> : null}
          {currentTask.attention ? <AttentionBanner task={currentTask} steps={steps} onLocate={locate} onOpenRun={openRun} /> : null}
          <TaskFailureDiagnostic query={diagnosticsQuery} onOpenRun={openRun} />
          {task.status === 'WAITING_PREFLIGHT' ? (
            firstRepo ? (
              <PreflightPanel
                projectId={projectId}
                preflights={[
                  {
                    repositoryId: firstRepo.repositoryId,
                    repositoryName: firstRepo.name || firstRepo.repositoryId,
                    preflight: preflightQuery.isLoading || preflightQuery.isError ? undefined : preflightQuery.data ?? undefined,
                    loading: preflightQuery.isLoading,
                    error: preflightQuery.isError ? (preflightQuery.error as Error | null) : null,
                    refetch: () => void preflightQuery.refetch(),
                  },
                ]}
                onRefreshAll={() => { void preflightQuery.refetch(); void taskQuery.refetch() }}
                taskCreatedByUserId={task.createdByUser?.id ?? null}
              />
            ) : (
              <Alert type="info" showIcon message="任务尚未分配仓库，无法执行质量门禁" />
            )
          ) : null}
          <main className={styles.content}>
            <ExecutionFlowRow task={currentTask} query={stepsQuery} steps={steps} onOpenRun={openRun} />
            <div className={styles.workbenchMain}>
              <RecentExecutionPanel projectId={projectId} task={currentTask} query={taskRunsQuery} onOpenRun={openRun} onClearSelection={clearRunSelection} selectedRunId={inspectedRunId} />
              <DeliveryPanel projectId={projectId} taskId={currentTask.id} task={currentTask} diffsQuery={diffsQuery} diffReviewQuery={diffReviewQuery} reviewEnabled={reviewEnabled} completedWithoutCode={completedWithoutCode} onRefresh={() => { void diffReviewQuery.refetch(); void taskQuery.refetch() }} />
            </div>
          </main>
        </div>
        <aside className={styles.taskWorkspaceAside}>
          <TaskRunInspectorPanel
            projectId={projectId}
            task={currentTask}
            taskId={currentTask.id}
            taskRunId={inspectedRunId}
            onRunChange={openRun}
          />
        </aside>
      </div>
    </div>
  )
}

function TaskFailureDiagnostic({ query, onOpenRun }: { query: ReturnType<typeof useTaskDiagnostics>; onOpenRun: (taskRunId: string) => void }) {
  if (query.isLoading || query.isError || !query.data?.failure) return null
  const diagnostic = query.data
  const run = diagnostic.latestFailedRun
  return <Alert type="error" showIcon className={styles.taskFailureDiagnostic}
    title={`任务失败：${diagnostic.failure?.failureCode ?? diagnostic.failure?.title ?? '未知原因'}`}
    description={<span>{diagnostic.failure?.summary ?? '任务执行失败'} · 阶段：{diagnostic.stage}{run ? <> · <Button type="link" size="small" onClick={() => onOpenRun(run.taskRunId)}>查看失败运行</Button></> : ' · 失败发生在创建执行记录之前'}</span>} />
}

function CompactTaskHeader({ task, projectId, onCancel, cancelPending, completedWithoutCode }: { task: Task; projectId: string; onCancel: () => void; cancelPending: boolean; completedWithoutCode: boolean }) {
  const navigate = useNavigate()
  return (
    <header className={styles.taskHeader} data-testid="task-summary">
      {task.statusReason ? <TaskStartupFailureAlert task={task} projectId={projectId} statusReason={task.statusReason} /> : null}
      <div className={styles.headerPrimary}>
        <div className={styles.headerTitleLine}>
          <Title level={2} className={styles.taskTitle}>{display(task.title)}</Title>
          <Button
            type="text"
            size="small"
            className={styles.copyButton}
            icon={<CopyOutlined />}
            aria-label="复制任务 ID"
            title={`复制任务 ID：${task.id}`}
            onClick={() => void navigator.clipboard?.writeText(task.id)}
          />
        </div>
        <div className={styles.headerActions}>
          {task.requirementGroup ? (
            <Button size="small" onClick={() => navigate(PATHS.projectReqChat(projectId, task.requirementGroup!.id))}>查看完整需求来源信息</Button>
          ) : null}
          {task.capabilities.canCancel ? (
            <Button size="small" danger loading={cancelPending} disabled={cancelPending} onClick={onCancel}>取消任务</Button>
          ) : null}
        </div>
      </div>
      <div className={styles.headerMeta}>
        <HeaderMeta label="需求群" value={task.requirementGroup?.name} />
        <HeaderMeta
          label="当前状态"
          value={<TaskModelStatusTag status={task.status} completedWithoutCode={completedWithoutCode} />}
        />
        <HeaderMeta label="仓库" value={`${task.repositories.length || task.repositoryIds?.length || 0} 个`} />
        <HeaderMeta label="更新于" value={formatDate(task.updatedAt)} />
        <HeaderMeta label="创建者" value={task.createdByUser?.displayName || '未记录'} />
      </div>
    </header>
  )
}

function HeaderMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.headerMetaItem}>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <div className={styles.headerMetaValue}>{value ?? '—'}</div>
    </div>
  )
}

function DetailState({ loading, description }: { loading?: boolean; description: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        {loading ? (
          <Spin size="large" tip={description} />
        ) : (
          <EmptyState title={description} />
        )}
      </div>
    </div>
  )
}

function DetailError({ error, resource }: { error: unknown; resource: string }) {
  const msg = error instanceof Error ? error.message : '请求失败'
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <Result status="warning" title={`无法加载${resource}`} subTitle={msg} />
      </div>
    </div>
  )
}

function StepCard({ step, onRun }: { step: TaskStep; onRun: (runId: string) => void }) {
  const current = step.status === 'RUNNING'
  return <article className={`${styles.stepCard} ${current ? styles.stepCardCurrent : ''}`}><div className={styles.stepHeading}><span className={styles.stepIcon}>{stepIcon(step.role)}</span><span className={styles.stepNumber}>{step.sequenceNo}.</span><Tooltip title={display(step.title)}><Text strong className={styles.stepTitle}>{display(step.title)}</Text></Tooltip><Tag color={stepStatusColor(step.status)}>{step.status}</Tag></div><div className={styles.stepDetails}><StepInfo label="Agent" value={display(step.agent?.name)} /><StepInfo label="仓库" value={display(step.repository?.name)} /><StepInfo label="说明" value={display(step.acceptanceNotes)} /><StepInfo label="运行" value={`${step.runCount} 次`} /></div><div className={styles.stepFooter}>{step.latestRun ? <Button type="link" size="small" onClick={() => onRun(step.latestRun!.id)}>查看最新运行</Button> : <Text type="secondary">尚未运行</Text>}{step.latestRun ? <ArrowRightOutlined /> : null}</div></article>
}

function RecentExecutionPanel({ projectId, task, query, onOpenRun, onClearSelection, selectedRunId }: { projectId: string; task: Task; query: ReturnType<typeof useTaskRuns>; onOpenRun: (taskRunId: string) => void; onClearSelection: () => void; selectedRunId: string | null }) {
  const runs = [...(query.data?.data ?? [])].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const repositoryNames = Object.fromEntries(task.repositories.map((repository) => [repository.repositoryId, repository.name]))
  return <section className={styles.recentExecutionPanel} data-testid="recent-execution-panel"><div className={styles.panelHeading}><Title level={3}>最近执行</Title></div>{query.isLoading ? <InlineState loading /> : query.isError ? <SectionError resource="执行记录" error={query.error} /> : runs.length === 0 ? <Text type="secondary" className={styles.compactEmpty}>尚无执行记录</Text> : <div className={styles.recentExecutionScroller} data-testid="recent-execution-blank" onClick={(event) => { if (event.target === event.currentTarget) onClearSelection() }}><div className={styles.recentExecutionGrid}>{runs.map((run) => <RecentRunItem key={run.id} run={run} selected={run.id === selectedRunId} onOpen={() => onOpenRun(run.id)} />)}</div></div>}<WorkspaceDiffPreviewCard projectId={projectId} taskId={task.id} taskStatus={task.status} repositoryNames={repositoryNames} /></section>
}

function RecentRunItem({ run, selected, onOpen }: { run: TaskRunSummary; selected: boolean; onOpen: () => void }) {
  return <button type="button" className={`${styles.recentRunItem} ${selected ? styles.recentRunItemSelected : ''}`} onClick={onOpen}><div className={styles.recentRunItemRow}><Text strong className={styles.recentRunItemTitle}>{run.taskStepTitle || roleLabel(run.role)}</Text><Tag color={runStatusColor(run.status)}>{run.status}</Tag></div><Text type="secondary" className={styles.recentRunItemStatus}>{run.statusSummary ?? formatDate(run.updatedAt)}</Text><Text type="secondary" className={styles.recentRunItemArtifact}>产物 {run.artifactSummary?.total ?? 0} · Diff {run.artifactSummary?.diffCount ?? 0}</Text></button>
}

function StepInfo({ label, value }: { label: string; value: string }) {
  return <Tooltip title={`${label}：${value}`}><Text ellipsis><span className={styles.stepInfoBullet}>·</span> {label}：{value}</Text></Tooltip>
}

function stepStatusColor(status: TaskStep['status']): 'default' | 'processing' | 'success' | 'error' | 'warning' {
  if (status === 'RUNNING') return 'processing'
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'PENDING') return 'warning'
  return 'default'
}

function runStatusColor(status: TaskRunSummary['status']): 'default' | 'processing' | 'success' | 'error' | 'warning' {
  if (status === 'RUNNING') return 'processing'
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED' || status === 'BLOCKED' || status === 'CANCELLED') return 'error'
  if (status === 'WAITING_INPUT' || status === 'WAITING_APPROVAL') return 'warning'
  return 'default'
}

function roleLabel(role: TaskStep['role'] | TaskRunSummary['role']): string {
  const labels: Record<TaskStep['role'], string> = { ORCHESTRATOR: '编排器', PLANNER: '规划器', DEVELOPER: '开发者', TESTER: '测试器', REVIEWER: '审查者' }
  return labels[role]
}

function stepIcon(role: TaskStep['role']) {
  if (role === 'PLANNER') return <FileTextOutlined />
  if (role === 'DEVELOPER') return <CodeOutlined />
  if (role === 'TESTER') return <ExperimentOutlined />
  return <TeamOutlined />
}

function DeliveryPanel({ projectId, taskId, task, diffsQuery, diffReviewQuery, reviewEnabled, completedWithoutCode, onRefresh }: { projectId: string; taskId: string; task: Task; diffsQuery: ReturnType<typeof useDiffs>; diffReviewQuery: ReturnType<typeof useTaskDiffReview>; reviewEnabled: boolean; completedWithoutCode: boolean; onRefresh: () => void }) {
  const navigate = useNavigate()
  return <section className={styles.deliveryPanel} id="output-delivery" data-testid="delivery-panel"><div className={styles.panelHeading}><Title level={3}>交付</Title><Button type="link" size="small" onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(taskId)}`)}>查看全部变更</Button></div><div className={styles.deliveryGrid}><CodeChangeCard projectId={projectId} taskId={taskId} task={task} query={diffsQuery} completedWithoutCode={completedWithoutCode} /><DeliveryCard projectId={projectId} task={task} query={diffReviewQuery} enabled={reviewEnabled} completedWithoutCode={completedWithoutCode} onRefresh={onRefresh} /></div></section>
}

function CodeChangeCard({ projectId, taskId, task, query, completedWithoutCode }: { projectId: string; taskId: string; task: Task; query: ReturnType<typeof useDiffs>; completedWithoutCode: boolean }) {
  const navigate = useNavigate()
  const diffs = query.data?.data ?? []
  const repositories = new Map<string, { name: string; files: number; additions: number; deletions: number; diffIds: string[] }>()
  for (const diff of diffs) {
    const repository = task.repositories.find((item) => item.repositoryId === diff.repositoryId)
    const summary = repositories.get(diff.repositoryId) ?? { name: repository?.name ?? '未命名仓库', files: 0, additions: 0, deletions: 0, diffIds: [] }
    summary.files += diff.changeStats.files
    summary.additions += diff.changeStats.additions
    summary.deletions += diff.changeStats.deletions
    summary.diffIds.push(diff.id)
    repositories.set(diff.repositoryId, summary)
  }
  const totals = [...repositories.values()].reduce((sum, repository) => ({ files: sum.files + repository.files, additions: sum.additions + repository.additions, deletions: sum.deletions + repository.deletions }), { files: 0, additions: 0, deletions: 0 })
  return <Card className={styles.codeChangeCard} size="small" data-testid="code-change-card"><div className={styles.cardHeading}><span><CodeOutlined />代码变更</span><Text type="secondary">{diffs.length} 个 Diff / {repositories.size} 个仓库</Text></div>{query.isLoading ? <InlineState loading /> : query.isError ? <SectionError resource="代码变更" error={query.error} /> : diffs.length === 0 ? <Text type="secondary" className={styles.compactEmpty}>{completedWithoutCode ? '任务已完成，未产生代码变更' : '尚未产生代码变更'}</Text> : <><Text type="secondary">files {totals.files} · +{totals.additions} / -{totals.deletions}</Text><div className={styles.diffSummaryList}>{[...repositories.entries()].map(([repositoryId, summary]) => <div key={repositoryId} className={styles.diffSummaryRow}><Text ellipsis>{summary.name}</Text><Text type="secondary">{summary.files} files · +{summary.additions} / -{summary.deletions}</Text>{summary.diffIds.map((diffId) => <Button key={diffId} type="link" size="small" onClick={() => navigate(PATHS.projectDiff(projectId, diffId), { state: { from: PATHS.projectTaskDetail(projectId, taskId) } })}>查看完整 Diff</Button>)}</div>)}</div></>}</Card>
}

function DeliveryCard({ projectId, task, query, enabled, completedWithoutCode, onRefresh }: { projectId: string; task: Task; query: ReturnType<typeof useTaskDiffReview>; enabled: boolean; completedWithoutCode: boolean; onRefresh: () => void }) {
  if (completedWithoutCode) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div><Text type="secondary" className={styles.compactEmpty}>任务已完成，无代码变更，因此未生成 Diff 或 MR</Text></Card>
  if (!enabled) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div><Text type="secondary" className={styles.compactEmpty}>{task.status === 'SUCCEEDED' ? '任务已完成' : '当前任务尚未进入代码交付确认阶段'}</Text></Card>
  if (query.isLoading) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div><InlineState loading /></Card>
  if (query.isError) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div>{task.status === 'SUCCEEDED' && errorCode(query.error) === 'DIFF_REVIEW_NOT_FOUND' ? <Text type="secondary" className={styles.compactEmpty}>任务已完成，无代码变更，因此未生成 Diff 或 MR</Text> : <SectionError resource="DiffReview" error={query.error} />}</Card>
  if (!query.data || query.data.taskId !== task.id) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div><Text type="secondary" className={styles.compactEmpty}>最终 Diff 尚未生成</Text></Card>
  return <DiffReviewPanel projectId={projectId} task={task} batch={query.data} onRefresh={onRefresh} />
}

function DiffReviewPanel({ projectId, task, batch, onRefresh }: { projectId: string; task: Task; batch: DiffReviewBatch; onRefresh: () => void }) {
  const confirm = useConfirmTaskDiffReview(projectId)
  const reject = useRejectTaskDiffReview(projectId)
  const retry = useRetryTaskDiffReviewDelivery(projectId)
  const [reason, setReason] = useState('')
  const pending = confirm.isPending || reject.isPending || retry.isPending
  const error = confirm.error ?? reject.error ?? retry.error
  const canUserDecide = task.deliveryMode === 'DIFF_FIRST' && batch.reviewStatus === 'PENDING_CONFIRMATION' && batch.confirmationSource === 'USER'
  const canRetry = task.capabilities.canRetryDelivery && batch.reviewStatus === 'ACCEPTED' && (batch.deliveryStatus === 'PARTIALLY_DELIVERED' || batch.deliveryStatus === 'FAILED')
  const handleError = (mutationError: Error) => { if (mutationError instanceof ApiError && mutationError.status === 409) onRefresh() }
  const authorizationLabel = batch.reviewStatus === 'ACCEPTED'
    ? batch.confirmationSource === 'SYSTEM' ? '自动交付' : '已由用户确认'
    : batch.reviewStatus
  return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}><span>交付确认与结果</span><div className={styles.cardHeadingRight}><Tag>{authorizationLabel}</Tag></div></div>{task.deliveryReason ? <Text type="secondary">{task.deliveryReason}</Text> : null}{batch.reviewStatus === 'REJECTED' && batch.reviewReason ? <Text type="danger">拒绝原因：{batch.reviewReason}</Text> : null}{batch.repositoryDeliveries.length > 0 ? <div className={styles.deliverySummaryList}>{batch.repositoryDeliveries.map((delivery) => <div key={delivery.repositoryId} className={styles.deliverySummaryRow}><Text ellipsis>{delivery.repositoryName}</Text><Tag color={delivery.deliveryStatus === 'FAILED' ? 'red' : delivery.deliveryStatus === 'MR_CREATED' ? 'green' : 'orange'}>{delivery.deliveryStatus}</Tag>{delivery.failureReason ? <Text type="danger">{delivery.failureReason}</Text> : null}{delivery.mergeRequest?.webUrl ? <a href={delivery.mergeRequest.webUrl} target="_blank" rel="noreferrer">查看 MR</a> : null}</div>)}</div> : null}{batch.deliveryStatus === 'DELIVERED' ? <Text type="secondary">交付已完成，可从 MR 入口继续查看。</Text> : null}{canUserDecide ? <div className={styles.reviewActions}>{task.capabilities.canConfirmDiffReview ? <Button type="primary" loading={confirm.isPending} disabled={pending} onClick={() => confirm.mutate(batch.taskId, { onError: handleError })}>确认交付</Button> : null}{task.capabilities.canRejectDiffReview ? <Form onFinish={() => { const trimmed = reason.trim(); if (trimmed) reject.mutate({ taskId: batch.taskId, input: { reason: trimmed } }, { onError: handleError }) }}><Form.Item label="拒绝原因" required><Input.TextArea value={reason} rows={2} maxLength={4000} disabled={pending} onChange={(event) => setReason(event.target.value)} /></Form.Item><Button danger htmlType="submit" loading={reject.isPending} disabled={pending || !reason.trim()}>拒绝交付</Button></Form> : null}</div> : null}{canRetry ? <Button size="small" loading={retry.isPending} disabled={pending} onClick={() => retry.mutate(batch.taskId, { onError: handleError })}>重试交付</Button> : null}{error ? <Alert type="error" showIcon title={diffReviewError(error)} action={error instanceof ApiError && error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} /> : null}</Card>
}

function normalizeTaskForDisplay(task: Task): Task {
  const capabilities = task.capabilities
  return {
    ...task,
    requirement: typeof task.requirement === 'string' ? task.requirement : task.requirementSummary ?? '',
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
    repositories: Array.isArray(task.repositories) && task.repositories.length > 0
      ? task.repositories
      : Array.isArray(task.workspace?.repositories) ? task.workspace.repositories : [],
    executionSummary: task.executionSummary && typeof task.executionSummary === 'object'
      ? task.executionSummary
      : {
        totalSteps: 0,
        pendingSteps: 0,
        runningSteps: 0,
        waitingSteps: 0,
        blockedSteps: 0,
        succeededSteps: 0,
        failedSteps: 0,
        currentStage: null,
        currentStageTitle: null,
        requiresUserAction: false,
      },
    capabilities: {
      canCancel: capabilities?.canCancel === true,
      canReplacePendingStepAgent: capabilities?.canReplacePendingStepAgent === true,
      canConfirmDiffReview: capabilities?.canConfirmDiffReview === true,
      canRejectDiffReview: capabilities?.canRejectDiffReview === true,
      canRetryDelivery: capabilities?.canRetryDelivery === true,
    },
    sourceMessage: task.sourceMessage && task.sourceMessage.sender && typeof task.sourceMessage.sender.displayName === 'string'
      ? task.sourceMessage
      : null,
  }
}

function RowHeading({ title, meta }: { title: string; meta?: string }) { return <div className={styles.rowHeading}><Title level={4}>{title}</Title>{meta ? <Text type="secondary">{meta}</Text> : null}</div> }
function HeaderMeta({ label, value }: { label: string; value: ReactNode }) { return <div className={styles.headerMetaItem}><Text type="secondary">{label}</Text><Text ellipsis strong>{value}</Text></div> }
function RequirementMeta({ task }: { task: Task }) {
  return <div className={styles.headerMetaItem}>
    <Text type="secondary">需求说明</Text>
    <Tooltip title={display(task.requirement)}><Text ellipsis strong>{display(task.requirement)}</Text></Tooltip>
  </div>
}
function InlineState({ loading = false, text }: { loading?: boolean; text?: string }) { return <div className={styles.inlineState}>{loading ? <Spin size="small" /> : null}<Text type="secondary">{text ?? '正在加载'}</Text></div> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon title={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
function CancelError({ error, onRefresh }: { error: Error; onRefresh: () => void }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert className={styles.executionAlert} type="error" showIcon title={status === 409 ? '任务状态已变化，请刷新详情' : '取消任务失败'} action={status === 409 ? <Button type="link" onClick={onRefresh}>刷新</Button> : undefined} /> }
function DetailState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.page}><div className={styles.panelState}>{loading ? <Spin /> : <Result status="404" title={description} />}</div></div> }
function DetailError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.page}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function isDiffReviewTask(status: Task['status'] | undefined): boolean { return status === 'WAITING_DIFF_CONFIRMATION' || status === 'WAITING_PREFLIGHT' || status === 'DIFF_REJECTED' || status === 'DELIVERING' || status === 'DELIVERY_FAILED' || status === 'SUCCEEDED' }
function getAttentionRunId(attention: Task['attention']): string | null { return attention?.taskRunId ?? null }
function errorCode(error: Error | null): string | undefined { if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object' || !('error' in error.body)) return undefined; const bodyError = (error.body as { error?: { code?: unknown } }).error; return typeof bodyError?.code === 'string' ? bodyError.code : undefined }
function diffReviewError(error: Error): string { const code = errorCode(error); if (code === 'DIFF_REVIEW_FORBIDDEN') return '暂无 Diff 验收权限'; if (code === 'DIFF_REVIEW_NOT_FOUND') return '最终 Diff 尚未生成'; if (code === 'DIFF_REVIEW_NOT_DECIDABLE') return 'Diff 状态已变化，请刷新后重试'; if (code === 'DIFF_DELIVERY_NOT_RETRYABLE') return '当前交付状态不可重试'; return 'Diff 操作失败' }
function display(value: string | null | undefined): string { return value?.trim() || '暂无' }
function formatDate(value: string | null | undefined): string { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? display(value) : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function TaskStartupFailureAlert({ task, projectId, statusReason }: { task: Task; projectId: string; statusReason: TaskStatusReason | null }) {
  if (!statusReason) return null
  const isBranchMissing = statusReason.failureCode === 'GIT_BRANCH_NOT_FOUND'
  // 基线分支不存在时从任务仓库元数据还原「仓库 + 基线分支」：summary 已含后端拼好的
  // 可读文案（含仓库与分支名），结构化字段供前端精确展示与跳转。
  const failedRepository = isBranchMissing
    ? task.repositories?.find((repo) => repo.baseRef && !repo.fullName.startsWith('未')) ?? task.repositories?.[0]
    : undefined
  const action = isBranchMissing ? (
    <Button type="link" size="small" onClick={() => {
      const groupId = task.requirementGroup?.id
      if (groupId) window.location.href = PATHS.projectReqChat(projectId, groupId)
    }}>
      重新发起任务
    </Button>
  ) : statusReason.retryable ? <Tag color="orange">可重试</Tag> : undefined
  return (
    <Alert
      type="error"
      showIcon
      className={styles.taskStartupFailureAlert}
      title={isBranchMissing ? '任务无法启动' : statusReason.title}
      description={
        isBranchMissing ? (
          <>
            <div>仓库：{failedRepository?.fullName ?? '未知仓库'}</div>
            <div>基线分支：{failedRepository?.baseRef ?? '未知'}</div>
            <div>原因：{statusReason.summary}</div>
            <div>请修改基线分支后重新发起任务。</div>
          </>
        ) : (
          statusReason.summary
        )
      }
      action={action}
    />
  )
}

function AttentionBanner({ task, steps, onLocate, onOpenRun }: { task: Task; steps: TaskStep[]; onLocate: (id: string) => void; onOpenRun: (runId: string) => void }) {
  const attention = task.attention
  if (!attention) return null
  const batchId = attention.diffReviewBatchId
  const step = batchId ? steps.find((s) => s.id === batchId) : undefined
  const runId = attention.taskRunId ?? step?.latestRun?.id
  const deliverUntil = typeof (attention as unknown as { deliverUntil?: unknown }).deliverUntil === 'string'
    ? (attention as unknown as { deliverUntil: string }).deliverUntil
    : null
  return (
    <Alert
      type="info"
      showIcon
      message="任务需要您处理"
      description={
        <Space wrap>
          <Tag color="gold">{attention.kind}</Tag>
          <Text type="secondary">{attention.summary ?? ''}</Text>
          {batchId ? (
            runId ? (
              <Button size="small" type="link" onClick={() => onOpenRun(runId)}>
                查看本次运行 <FileTextOutlined />
              </Button>
            ) : (
              <Button size="small" type="link" onClick={() => onLocate('output-delivery')}>
                跳到交付结果
              </Button>
            )
          ) : runId ? (
            <Button size="small" type="link" onClick={() => onOpenRun(runId)}>
              查看运行
            </Button>
          ) : null}
          {deliverUntil ? (
            <Tag color="gold">交付截止：{deliverUntil}</Tag>
          ) : null}
        </Space>
      }
    />
  )
}

function ExecutionFlowRow({ task, query, steps, onOpenRun }: { task: Task; query: ReturnType<typeof useTaskSteps>; steps: TaskStep[]; onOpenRun: (runId: string) => void }) {
  const ordered = steps.slice().sort((l, r) => l.sequenceNo - r.sequenceNo)
  const isPlanning = task.status === 'PLANNING'
  return (
    <Card
      size="small"
      title="执行流程"
      extra={
        <Space>
          {query.isLoading ? <Text type="secondary"><Spin size="small" style={{ marginRight: 8 }} />加载中</Text> : null}
          {ordered.length > 0 ? <Tag>{ordered.length} 个步骤</Tag> : isPlanning ? <Tag color="processing">规划中</Tag> : null}
        </Space>
      }
      className={styles.panelCard}
      id="execution-flow"
    >
      {ordered.length === 0 ? (
        <EmptyState description="当前任务尚未产生执行步骤" />
      ) : (
        <ol className={styles.stepsList}>
          {ordered.map((s, i) => {
            const latest = s.latestRun
            const tagStatus = mapRunOrStepStatus(s.status)
            return (
              <li key={s.id} className={styles.stepsItem}>
                <div className={styles.stepsHead}>
                  <Text strong>步骤 {i + 1}：{display(s.title ?? `Step #${s.sequenceNo}`)}</Text>
                  <Space wrap>
                    {tagStatus ? (
                      <TaskModelStatusTag status={tagStatus} completedWithoutCode={false} />
                    ) : (
                      <Tag>{s.status}</Tag>
                    )}
                    {latest?.id ? (
                      <Button size="small" type="link" onClick={() => onOpenRun(latest.id)}>
                        打开运行 <ArrowRightOutlined />
                      </Button>
                    ) : (
                      <Text type="secondary">尚未运行</Text>
                    )}
                  </Space>
                </div>
                <Space size="small" style={{ marginTop: 6, width: '100%' }} wrap>
                  <StepInfo label="Agent" value={display(s.agent?.name)} />
                  <StepInfo label="仓库" value={display(s.repository?.name)} />
                  <StepInfo label="说明" value={display(s.acceptanceNotes ?? s.description)} />
                  <StepInfo label="运行" value={`${s.runCount} 次`} />
                </Space>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

function StepInfo({ label, value }: { label: string; value: string }) {
  return (
    <Tooltip title={`${label}：${value}`}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        · {label}：{value}
      </Text>
    </Tooltip>
  )
}

function RecentExecutionPanel({
  query,
  onOpenRun,
  onClearSelection,
  selectedRunId,
}: {
  query: ReturnType<typeof useTaskRuns>
  onOpenRun: (runId: string) => void
  onClearSelection: () => void
  selectedRunId: string | null
}) {
  const runs = [...(query.data?.data ?? [])].sort(
    (left, right) => (right.updatedAt ? Date.parse(right.updatedAt) : 0) - (left.updatedAt ? Date.parse(left.updatedAt) : 0),
  )
  return (
    <Card
      size="small"
      title="最近执行"
      className={styles.panelCard}
      extra={
        <Button size="small" type="link" onClick={onClearSelection} disabled={!selectedRunId}>
          清空选择
        </Button>
      }
    >
      {query.isLoading ? (
        <div style={{ padding: 16 }}><Spin /></div>
      ) : runs.length === 0 ? (
        <EmptyState description="暂无运行记录" />
      ) : (
        <ul
          className={styles.runList}
          data-testid="recent-execution-blank"
          onClick={(event) => { if (event.target === event.currentTarget) onClearSelection() }}
        >
          {runs.map((run) => {
            const isSelected = run.id === selectedRunId
            const tagStatus = mapRunOrStepStatus(run.status)
            return (
              <li key={run.id} className={`${styles.runItem} ${isSelected ? styles.runItemSelected : ''}`}>
                <button
                  type="button"
                  className={styles.runTitle}
                  onClick={() => onOpenRun(run.id)}
                  style={{ all: 'unset', cursor: 'pointer', width: '100%' }}
                >
                  <Space align="start" direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text strong ellipsis style={{ maxWidth: 260 }}>
                        <TeamOutlined style={{ marginRight: 6 }} />
                        {run.taskStepTitle || run.role}
                      </Text>
                      {tagStatus ? (
                        <TaskModelStatusTag status={tagStatus} completedWithoutCode={false} />
                      ) : (
                        <Tag>{run.status}</Tag>
                      )}
                    </Space>
                    <Text type="secondary" ellipsis style={{ width: '100%' }}>
                      {run.statusSummary ?? formatDate(run.updatedAt ?? run.createdAt)}
                    </Text>
                    <Text type="secondary">
                      产物 {run.artifactSummary?.total ?? 0} · Diff {run.artifactSummary?.diffCount ?? 0}
                    </Text>
                  </Space>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function DeliveryPanel(props: {
  projectId: string
  taskId: string
  task: Task
  diffsQuery: ReturnType<typeof useDiffs>
  diffReviewQuery: ReturnType<typeof useTaskDiffReview>
  reviewEnabled: boolean
  completedWithoutCode: boolean
  onRefresh: () => void
}) {
  const { projectId, taskId, task, diffsQuery, diffReviewQuery, reviewEnabled, completedWithoutCode, onRefresh } = props
  const navigate = useNavigate()

  if (completedWithoutCode) {
    return (
      <Card size="small" title="任务产出与交付" id="output-delivery" className={styles.panelCard}>
        <EmptyState
          title="任务已完成：无需代码变更"
          description="系统已完成问题分析，判断该需求无需对代码进行修改，因此不会产出 Diff。"
        />
      </Card>
    )
  }

  const diffs = diffsQuery.data?.data ?? []
  const review = reviewEnabled ? diffReviewQuery.data : null

  return (
    <Card size="small" title="任务产出与交付" id="output-delivery" className={styles.panelCard}>
      {!reviewEnabled && !task.capabilities?.canRetryDelivery && diffs.length === 0 ? (
        <EmptyState description="任务尚未完成，暂无法查看交付结果" />
      ) : (
        <>
          {review ? (
            <DeliveryReviewCard projectId={projectId} review={review} onRefresh={onRefresh} />
          ) : reviewEnabled && diffReviewQuery.isError ? (
            <Result status="warning" title="加载交付结果失败" />
          ) : reviewEnabled ? (
            <Spin />
          ) : null}
          <div style={{ marginTop: 16 }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Text strong>相关 Diff：{diffs.length} 条</Text>
              {diffs.length > 0 ? (
                <Button size="small" type="link" onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(taskId)}`)}>
                  查看全部变更
                </Button>
              ) : null}
            </Space>
            {diffs.length > 0 ? (
              <ul className={styles.diffList}>
                {diffs.map((d) => (
                  <li key={d.id}>
                    <Space>
                      <Button size="small" type="link" onClick={() => navigate(PATHS.projectDiff(projectId, d.id), { state: { from: PATHS.projectTaskDetail(projectId, taskId) } })}>
                        <CodeOutlined /> Diff #{d.id.slice(0, 8)}
                      </Button>
                      <Tag color={d.status === 'ACCEPTED' ? 'success' : d.status === 'REJECTED' ? 'error' : 'default'}>
                        {d.status === 'ACCEPTED' ? '已通过' : d.status === 'REJECTED' ? '已拒绝' : '评审中'}
                      </Tag>
                    </Space>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </Card>
  )
}

function DeliveryReviewCard({ projectId, review, onRefresh }: { projectId: string; review: DiffReviewBatch; onRefresh: () => void }) {
  const accept = useConfirmTaskDiffReview(projectId)
  const reject = useRejectTaskDiffReview(projectId)
  const retry = useRetryTaskDiffReviewDelivery(projectId)
  const { message, modal } = App.useApp()
  const [reason, setReason] = useState('')
  const [openReason, setOpenReason] = useState(false)

  const statusMap: Record<string, [string, string]> = {
    NOT_STARTED: ['default', '未启动'],
    DELIVERING: ['geekblue', '交付中'],
    DELIVERED: ['success', '已交付（待验收）'],
    ACCEPTED: ['success', '已验收'],
    REJECTED: ['error', '已拒绝'],
    PARTIALLY_DELIVERED: ['processing', '部分交付'],
    FAILED: ['error', '交付失败'],
  }
  const [color, label] = statusMap[review.deliveryStatus] || ['default', review.deliveryStatus]
  const deliveries = review.repositoryDeliveries ?? []
  const totals = deliveries.reduce(
    (sum, next) => ({
      total: sum.total + 1,
      success: sum.success + (next.deliveryStatus === 'MR_CREATED' ? 1 : 0),
      failed: sum.failed + (next.deliveryStatus === 'FAILED' ? 1 : 0),
    }),
    { total: 0, success: 0, failed: 0 },
  )

  function doAccept() {
    modal.confirm({
      title: '确认「验收通过」？',
      content: '确认交付结果符合预期，验收通过后任务会根据配置自动创建 MR。',
      okText: '通过',
      onOk: async () => {
        try {
          await accept.mutateAsync(review.taskId)
          message.success('已验收通过')
          onRefresh()
        } catch (err) {
          message.error(err instanceof Error ? err.message : diffReviewError(err as Error))
          return Promise.reject(err)
        }
      },
    })
  }

  function triggerReject() {
    setOpenReason(true)
  }

  function submitReject() {
    const trimmed = reason.trim()
    if (!trimmed) {
      message.warning('请先填写拒绝原因')
      return
    }
    modal.confirm({
      title: '确认「验收拒绝」？',
      content: '任务交付结果不符合预期，拒绝后将标注失败，可稍后重试交付（若配置允许）。',
      okText: '拒绝',
      okButtonProps: { danger: true, disabled: reject.isPending },
      onOk: async () => {
        try {
          await reject.mutateAsync({ taskId: review.taskId, input: { reason: trimmed } })
          message.success('已拒绝交付')
          setOpenReason(false)
          onRefresh()
        } catch (err) {
          message.error(err instanceof Error ? err.message : diffReviewError(err as Error))
          return Promise.reject(err)
        }
      },
    })
  }

  const canUserDecideAccept = review.deliveryStatus === 'DELIVERED' && review.reviewStatus === 'PENDING_CONFIRMATION'
  const canRetryDelivery = review.deliveryStatus === 'FAILED' || review.deliveryStatus === 'PARTIALLY_DELIVERED'

  return (
    <div>
      <Row gutter={[12, 8]}>
        <Col xs={24} md={12}>
          <div className={styles.descLabel}><Text type="secondary">批次 ID</Text></div>
          <div className={styles.descValue}>{review.id}</div>
        </Col>
        <Col xs={24} md={12}>
          <div className={styles.descLabel}><Text type="secondary">验收状态</Text></div>
          <div className={styles.descValue}>
            <Tag color={color as Parameters<typeof Tag>['0']['color']}>{label}</Tag>
            <Tag style={{ marginLeft: 8 }}>{review.confirmationSource === 'SYSTEM' ? '自动交付' : '用户确认'}</Tag>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className={styles.descLabel}><Text type="secondary">仓库交付</Text></div>
          <div className={styles.descValue}>
            {totals.success} 成功 · {totals.failed} 失败 · {totals.total} 总数
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className={styles.descLabel}><Text type="secondary">相关 Diff</Text></div>
          <div className={styles.descValue}>{review.diffs.length} 条</div>
        </Col>
        <Col xs={24} md={8}>
          <div className={styles.descLabel}><Text type="secondary">验收原因</Text></div>
          <div className={styles.descValue}>{display(review.reviewReason)}</div>
        </Col>
      </Row>
      {deliveries.length > 0 ? (
        <ul className={styles.deliverySummaryList} style={{ marginTop: 12 }}>
          {deliveries.map((delivery) => (
            <li key={delivery.repositoryId} className={styles.deliverySummaryRow}>
              <Space wrap size={8}>
                <Text ellipsis style={{ maxWidth: 260 }}>{delivery.repositoryName}</Text>
                <Tag color={delivery.deliveryStatus === 'FAILED' ? 'red' : delivery.deliveryStatus === 'MR_CREATED' ? 'green' : 'orange'}>
                  {delivery.deliveryStatus}
                </Tag>
                {delivery.failureReason ? <Text type="danger">{delivery.failureReason}</Text> : null}
                {delivery.mergeRequest?.webUrl ? (
                  <a href={delivery.mergeRequest.webUrl} target="_blank" rel="noreferrer">查看 MR</a>
                ) : null}
              </Space>
            </li>
          ))}
        </ul>
      ) : null}
      <Space style={{ marginTop: 16 }} wrap>
        {review.deliveryStatus === 'DELIVERING' ? <Tag color="geekblue">交付进行中…</Tag> : null}
        {canUserDecideAccept ? (
          <>
            <Button type="primary" size="small" loading={accept.isPending} onClick={doAccept}>验收通过</Button>
            {openReason ? (
              <Form layout="vertical" style={{ flex: '1 1 320px', minWidth: 280 }}>
                <Form.Item label="拒绝原因" required>
                  <Input.TextArea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={4000}
                    placeholder="请输入至少 1 个字符的说明"
                  />
                </Form.Item>
                <Space>
                  <Button danger htmlType="button" loading={reject.isPending} disabled={!reason.trim()} onClick={submitReject}>
                    拒绝交付
                  </Button>
                  <Button onClick={() => { setOpenReason(false); setReason('') }}>取消</Button>
                </Space>
              </Form>
            ) : (
              <Button size="small" danger loading={reject.isPending} onClick={triggerReject}>拒绝交付</Button>
            )}
          </>
        ) : null}
        {canRetryDelivery ? (
          taskCanRetryDelivery(review) ? (
            <Button
              size="small"
              loading={retry.isPending}
              onClick={() => {
                message.loading({ content: '重试交付…', key: 'retry-delivery' })
                retry.mutate(review.taskId, {
                  onSuccess: () => {
                    message.success({ content: '已重新发起交付', key: 'retry-delivery' })
                    onRefresh()
                  },
                  onError: (e) => {
                    message.error({ content: e.message || diffReviewError(e), key: 'retry-delivery' })
                  },
                })
              }}
            >
              重试交付
            </Button>
          ) : (
            <Text type="secondary">当前交付状态不可重试</Text>
          )
        ) : null}
      </Space>
    </div>
  )
}

/** 保守判断是否可重试：交付失败时允许，其他状态依赖服务器 capabilities 返回，这里保守不展示（避免访问不存在字段） */
function taskCanRetryDelivery(review: DiffReviewBatch): boolean {
  const batch = review as DiffReviewBatch & { capabilities?: { canRetry?: boolean } }
  return Boolean(batch.capabilities?.canRetry)
}

// 类型兜底：PreflightPanel 接收的数组项含 refetch；TaskDetailPage 中我们传递了 refetch，这里确保不触发 TS 未使用错误
export type { TaskRunSummary, TaskStep, Preflight }
