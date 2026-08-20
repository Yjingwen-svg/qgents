import { Alert, Button, Card, Form, Input, Result, Spin, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CodeOutlined, CopyOutlined, ExperimentOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons'
import { type ReactNode } from 'react'
import type { TaskStatusReason } from '@/types/task-model'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useCancelTask, useConfirmTaskDiffReview, useDiffs, useRejectTaskDiffReview, useRetryTaskDiffReviewDelivery, useTask, useTaskDiagnostics, useTaskDiffReview, useTaskRuns, useTaskSteps } from '@/hooks/task-model'
import { usePreflight } from '@/hooks/qualityGate'
import type { DiffReviewBatch, Task, TaskRunSummary, TaskStep } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { useTaskCompletedWithoutCode } from '@/store/taskNoCodeChangeStore'
import { TaskModelStatusTag } from '../TaskCenter/TaskModelStatusTag'
import { TaskRunInspectorPanel } from './TaskRunInspectorDrawer'
import { WorkspaceDiffPreviewCard } from './WorkspaceDiffPreviewCard'
import { PreflightPanel } from '../PreflightPanel'
import type { Preflight } from '@/types/qualityGate'
import styles from './TaskDetailPage.module.scss'

const { Text, Title } = Typography

export default function TaskDetailPage() {
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>()
  const navigate = useNavigate()
  const taskQuery = useTask(projectId, taskId)
  const diagnosticsQuery = useTaskDiagnostics(projectId, taskId)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const taskRunsQuery = useTaskRuns(projectId, taskId, { limit: 5 })
  const diffsQuery = useDiffs(projectId, { taskId, limit: 100 })
  const cancelMutation = useCancelTask(projectId)
  const completedWithoutCode = useTaskCompletedWithoutCode(projectId, taskId)
  // SUCCEEDED 也查 DiffReview：有批次 → 展示交付结果（正常完成）；404 → 无代码变更空态（§5.2，跨会话稳定）
  const reviewEnabled =
    (isDiffReviewTask(taskQuery.data?.status) || taskQuery.data?.status === 'SUCCEEDED') && !completedWithoutCode
  const diffReviewQuery = useTaskDiffReview(projectId, taskId, reviewEnabled)

  // WAITING_PREFLIGHT 时，按仓库逐个查询预检数据
  // 每个仓库一个 usePreflight Hook —— 通过 PreflightRepoCollector 组件封装
  const [preflightResults, setPreflightResults] = useState<Map<string, {
    repositoryId: string
    repositoryName: string
    preflight: Preflight | undefined
    loading: boolean
    error: Error | null
    refetch: () => void
  }>>(new Map())

  const handlePreflightResult = useCallback((
    repoId: string,
    result: {
      repositoryId: string
      repositoryName: string
      preflight: Preflight | undefined
      loading: boolean
      error: Error | null
      refetch: () => void
    },
  ) => {
    setPreflightResults((prev) => {
      const next = new Map(prev)
      next.set(repoId, result)
      return next
    })
  }, [])

  const handlePreflightRemove = useCallback((repoId: string) => {
    setPreflightResults((prev) => {
      const next = new Map(prev)
      next.delete(repoId)
      return next
    })
  }, [])

  // G1：交付中心等入口带 ?diffReviewBatchId 跳转时，定位到「任务产出与交付」卡片
  const [searchParams, setSearchParams] = useSearchParams()
  const [hasClearedRunSelection, setHasClearedRunSelection] = useState(false)
  const paramBatchId = searchParams.get('diffReviewBatchId')
  const selectedRunId = searchParams.get('runId')
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

  // 必须无条件调用：Rules of Hooks 要求 Hooks 在每次渲染中以相同顺序执行。
  // 这里的回调不依赖任何条件数据，可安全前置。
  const preflightRefetchAll = useCallback(() => {
    setPreflightResults((prev) => {
      const next = new Map(prev)
      for (const [, v] of next) {
        v.refetch()
      }
      return new Map()
    })
  }, [])

  // 必须无条件调用：基于可选的 taskQuery.data 计算，缺失时返回空数组。
  const preflightArray = useMemo(() => {
    const repositories = taskQuery.data?.repositories ?? []
    const result: Array<{
      repositoryId: string
      repositoryName: string
      preflight: Preflight | undefined
      loading: boolean
      error: Error | null
      refetch: () => void
    }> = []
    for (const repo of repositories) {
      const entry = preflightResults.get(repo.repositoryId)
      if (entry) {
        result.push(entry)
      } else {
        result.push({
          repositoryId: repo.repositoryId,
          repositoryName: repo.name || repo.repositoryId,
          preflight: undefined,
          loading: true,
          error: null,
          refetch: () => { },
        })
      }
    }
    return result
  }, [taskQuery.data?.repositories, preflightResults])

  if (taskQuery.isLoading) return <DetailState loading description="正在加载任务详情" />
  if (taskQuery.isError) return <DetailError error={taskQuery.error} resource="任务详情" />
  const task = taskQuery.data
  if (!task || task.projectId !== projectId || task.id !== taskId) return <DetailState description="任务不存在或不可见" />
  const currentTask = normalizeTaskForDisplay(task)
  const steps = stepsQuery.data?.data ?? []
  const recentRuns = taskRunsQuery.data?.data ?? []
  const inspectedRunId = hasClearedRunSelection ? null : selectedRunId ?? recentRuns[0]?.id ?? null

  function handleCancel() {
    if (!window.confirm('确认取消此任务？服务端将按安全检查点停止执行。')) return
    cancelMutation.mutate(currentTask.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) void taskQuery.refetch() } })
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

  // 任务创建人 ID，用于判断 CQ+1 自审
  const taskCreatedByUserId = task.createdByUser?.id ?? null

  return (
    <div className={styles.page}>
      <div className={styles.topBar}><Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(PATHS.projectTasks(projectId))}>返回任务中心</Button></div>
      <div className={styles.taskWorkspace}>
        <div className={styles.taskWorkspaceMain}>
          <CompactTaskHeader task={currentTask} projectId={projectId} onCancel={handleCancel} cancelPending={cancelMutation.isPending} completedWithoutCode={completedWithoutCode} />
          {cancelMutation.error ? <CancelError error={cancelMutation.error} onRefresh={() => void taskQuery.refetch()} /> : null}
          {currentTask.attention ? <AttentionBanner task={currentTask} steps={steps} onLocate={locate} onOpenRun={openRun} /> : null}
          <TaskFailureDiagnostic query={diagnosticsQuery} onOpenRun={openRun} />
          {task.status === 'WAITING_PREFLIGHT' ? (
            <>
              {/* 每个仓库独立的 preflight 查询 Hook —— 组件化以确保 Hook 调用顺序稳定 */}
              {(task.repositories ?? []).map((repo) => (
                <PreflightRepoQuery
                  key={repo.repositoryId}
                  projectId={projectId}
                  taskId={taskId}
                  repositoryId={repo.repositoryId}
                  repositoryName={repo.name || repo.repositoryId}
                  targetBranch={repo.baseRef}
                  onResult={handlePreflightResult}
                  onUnmount={handlePreflightRemove}
                />
              ))}
              <PreflightPanel
                projectId={projectId}
                preflights={preflightArray}
                onRefreshAll={preflightRefetchAll}
                taskCreatedByUserId={taskCreatedByUserId}
              />
            </>
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
          <TaskRunInspectorPanel projectId={projectId} task={currentTask} taskId={currentTask.id} taskRunId={inspectedRunId} onRunChange={openRun} />
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
          <Button type="text" size="small" className={styles.copyButton} icon={<CopyOutlined />} aria-label="复制任务 ID" title={`复制任务 ID：${task.id}`} onClick={() => void navigator.clipboard?.writeText(task.id)} />
        </div>
        <div className={styles.headerActions}>
          {task.requirementGroup ? <Button size="small" onClick={() => navigate(PATHS.projectReqChat(projectId, task.requirementGroup!.id))}>查看完整需求来源信息</Button> : null}
          {task.capabilities.canCancel ? <Button size="small" danger loading={cancelPending} disabled={cancelPending} onClick={onCancel}>取消任务</Button> : null}
        </div>
      </div>
      <div className={styles.headerMeta}>
        <HeaderMeta label="需求群" value={task.requirementGroup?.name} />
        <HeaderMeta label="当前状态" value={<TaskModelStatusTag status={task.status} completedWithoutCode={completedWithoutCode} />} />
        <HeaderMeta label="仓库" value={`${task.repositories.length || task.repositoryIds?.length || 0} 个`} />
        <HeaderMeta label="更新于" value={formatDate(task.updatedAt)} />
        <RequirementMeta task={task} />
      </div>
    </header>
  )
}

function AttentionBanner({ task, steps, onLocate, onOpenRun }: { task: Task; steps: TaskStep[]; onLocate: (id: string) => void; onOpenRun: (taskRunId: string) => void }) {
  const attention = task.attention!
  const attentionRunId = getAttentionRunId(attention)
  const latestRunId = steps.find((step) => step.latestRun)?.latestRun?.id ?? null
  const runId = attentionRunId ?? null
  const isOutput = attention.kind === 'DIFF_CONFIRMATION_REQUIRED' || attention.kind === 'DELIVERY_FAILED'
  const action = runId ? <Button size="small" onClick={() => onOpenRun(runId)}>查看关联运行</Button> : isOutput ? <Button size="small" onClick={() => onLocate('output-delivery')}>查看产出与交付</Button> : <Button size="small" onClick={() => onLocate('execution-flow')}>{latestRunId ? '查看执行流程' : '定位执行流程'}</Button>
  return <section className={styles.attentionBanner} data-testid="task-attention-banner"><Alert type="warning" showIcon title={<span><Tag color="orange">{attention.kind}</Tag>{attention.diffReviewBatchId ? <Tag color="blue">批次 {attention.diffReviewBatchId}</Tag> : null}{attention.title}</span>} description={attention.summary} action={action} /></section>
}

function PlanningSkeletonCard({ index }: { index: number }) {
  const delays = ['0ms', '150ms', '300ms']
  const delay = delays[index % 3]
  return (
    <div
      className={`${styles.planningStepCard} ${styles.planningCardFadeIn}`}
      style={{ animationDelay: delay }}
      data-testid="planning-step-card"
    >
      <div className={styles.planningBrainIcon}>
        <ExperimentOutlined />
      </div>
      <div className={`${styles.skeletonLine} ${styles.skeletonHeadingLine}`} />
      <div className={styles.planningMeta}>
        <div className={`${styles.skeletonLine} ${styles.skeletonMetaLine}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonMetaLine}`} style={{ width: '75%' }} />
        <div className={`${styles.skeletonLine} ${styles.skeletonMetaLine}`} style={{ width: '85%' }} />
      </div>
      <div className={styles.planningFooter}>
        <div className={`${styles.skeletonLine} ${styles.skeletonFooterLine}`} />
      </div>
    </div>
  )
}

function ExecutionFlowRow({ task, query, steps, onOpenRun }: { task: Task; query: ReturnType<typeof useTaskSteps>; steps: TaskStep[]; onOpenRun: (taskRunId: string) => void }) {
  const ordered = steps.slice().sort((left, right) => left.sequenceNo - right.sequenceNo)
  const isPlanning = task.status === 'PLANNING'
  return (
    <section className={styles.executionFlowRow} id="execution-flow" data-testid="execution-flow-row">
      <RowHeading
        title="执行流程"
        meta={ordered.length > 0 ? `${ordered.length} 个步骤` : isPlanning ? '规划中' : undefined}
      />
      {query.isLoading ? (
        <InlineState loading />
      ) : query.isError ? (
        <SectionError resource="TaskStep" error={query.error} />
      ) : isPlanning ? (
        <div className={styles.flowScroller}>
          <div className={styles.flowPlanningState}>
            {[0, 1, 2].map((i) => <PlanningSkeletonCard key={i} index={i} />)}
          </div>
        </div>
      ) : ordered.length === 0 ? (
        <div className={styles.flowEmptyState} data-testid="execution-flow-empty">
          <Text type="secondary">暂无执行步骤</Text>
        </div>
      ) : (
        <div className={styles.flowScroller}>
          <div className={styles.flowGrid}>
            {ordered.map((step) => <StepCard key={step.id} step={step} onRun={onOpenRun} />)}
          </div>
        </div>
      )}
    </section>
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

/**
 * 单仓库 preflight 查询组件 —— 封装 usePreflight Hook，将结果通过回调上报给父组件。
 * 父组件通过 Map 聚合所有仓库的 preflight 状态，传给 PreflightPanel 统一渲染。
 * 设计：每个仓库一个独立组件，确保 Hook 调用顺序在渲染间保持稳定。
 */
function PreflightRepoQuery({
  projectId,
  taskId,
  repositoryId,
  repositoryName,
  targetBranch,
  onResult,
  onUnmount,
}: {
  projectId: string
  taskId: string
  repositoryId: string
  repositoryName: string
  targetBranch: string
  onResult: (repoId: string, result: {
    repositoryId: string
    repositoryName: string
    preflight: Preflight | undefined
    loading: boolean
    error: Error | null
    refetch: () => void
  }) => void
  onUnmount: (repoId: string) => void
}) {
  const query = usePreflight(projectId, taskId, repositoryId, targetBranch)

  useEffect(() => {
    onResult(repositoryId, {
      repositoryId,
      repositoryName,
      preflight: query.data,
      loading: query.isLoading,
      error: query.error,
      refetch: () => { void query.refetch() },
    })
  }, [repositoryId, repositoryName, query.data, query.isLoading, query.error, query, onResult])

  useEffect(() => {
    return () => { onUnmount(repositoryId) }
  }, [repositoryId, onUnmount])

  return null
}
