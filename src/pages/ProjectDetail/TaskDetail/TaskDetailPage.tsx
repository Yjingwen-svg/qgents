import { Alert, Breadcrumb, Button, Card, Form, Input, Modal, Result, Spin, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, CodeOutlined, CopyOutlined, ExperimentOutlined, FileTextOutlined, LinkOutlined, TeamOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useCancelTask, useConfirmTaskDiffReview, useDiffs, useRejectTaskDiffReview, useRetryTaskDiffReviewDelivery, useTask, useTaskArtifacts, useTaskDiffReview, useTaskSteps } from '@/hooks/task-model'
import type { DiffReviewBatch, Task, TaskArtifact, TaskArtifactType, TaskStep } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import { TaskModelStatusTag } from '../TaskCenter/TaskModelStatusTag'
import styles from './TaskDetailPage.module.scss'

const { Text, Title } = Typography
const ARTIFACT_TYPES: TaskArtifactType[] = ['PLAN', 'CODING', 'TESTING', 'REVIEWING']

export default function TaskDetailPage() {
  const { projectId = '', taskId = '' } = useParams<{ projectId: string; taskId: string }>()
  const location = useLocation()
  const taskQuery = useTask(projectId, taskId)
  const stepsQuery = useTaskSteps(projectId, taskId, { limit: 100 })
  const artifactsQuery = useTaskArtifacts(projectId, taskId)
  const diffsQuery = useDiffs(projectId, { taskId, limit: 100 })
  const cancelMutation = useCancelTask(projectId)
  const reviewEnabled = isDiffReviewTask(taskQuery.data?.status)
  const diffReviewQuery = useTaskDiffReview(projectId, taskId, reviewEnabled)

  if (taskQuery.isLoading) return <DetailState loading description="正在加载任务详情" />
  if (taskQuery.isError) return <DetailError error={taskQuery.error} resource="任务详情" />
  const task = taskQuery.data
  if (!task || task.projectId !== projectId || task.id !== taskId) return <DetailState description="任务不存在或不可见" />
  const currentTask = normalizeTaskForDisplay(task)
  const steps = stepsQuery.data?.data ?? []

  function handleCancel() {
    if (!window.confirm('确认取消此任务？服务端将按安全检查点停止执行。')) return
    cancelMutation.mutate(currentTask.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) void taskQuery.refetch() } })
  }

  function locate(id: string) {
    const target = document.getElementById(id)
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}><Breadcrumb items={[{ title: '任务中心' }, { title: '任务详情' }]} /></div>
      <CompactTaskHeader task={currentTask} projectId={projectId} location={location} onCancel={handleCancel} cancelPending={cancelMutation.isPending} />
      {cancelMutation.error ? <CancelError error={cancelMutation.error} onRefresh={() => void taskQuery.refetch()} /> : null}
      {currentTask.attention ? <AttentionBanner projectId={projectId} task={currentTask} steps={steps} onLocate={locate} /> : null}
      <main className={styles.content}>
        <ExecutionFlowRow projectId={projectId} taskId={currentTask.id} task={currentTask} query={stepsQuery} steps={steps} />
        <RequirementContextRow projectId={projectId} task={currentTask} />
        <OutputDeliveryRow projectId={projectId} taskId={currentTask.id} task={currentTask} artifactsQuery={artifactsQuery} diffsQuery={diffsQuery} diffReviewQuery={diffReviewQuery} reviewEnabled={reviewEnabled} onRefresh={() => { void diffReviewQuery.refetch(); void taskQuery.refetch() }} />
      </main>
    </div>
  )
}

function CompactTaskHeader({ task, projectId, location, onCancel, cancelPending }: { task: Task; projectId: string; location: ReturnType<typeof useLocation>; onCancel: () => void; cancelPending: boolean }) {
  const navigate = useNavigate()
  const from = typeof location.pathname === 'string' && location.pathname.includes('/tasks/') ? location.state : undefined
  return (
    <header className={styles.taskHeader} data-testid="task-summary">
      <div className={styles.headerPrimary}>
        <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(resolveReturnPath(from, projectId, task.id))}>返回任务中心</Button>
        <div className={styles.headerActions}>
          {task.requirementGroup ? <Button size="small" onClick={() => navigate(PATHS.projectReqChat(projectId, task.requirementGroup!.id))}>返回需求群</Button> : null}
          <Button size="small" type="primary" onClick={() => navigate(`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(task.id)}`)}>查看交付</Button>
          {task.capabilities.canCancel ? <Button size="small" danger loading={cancelPending} disabled={cancelPending} onClick={onCancel}>取消任务</Button> : null}
          <TaskModelStatusTag status={task.status} />
        </div>
      </div>
      <div className={styles.headerTitleBlock}>
        <Text className={styles.taskCode}>{task.displayCode}</Text>
        <div className={styles.headerTitleLine}>
          <Title level={2} className={styles.taskTitle}>{display(task.title)}</Title>
          <Button type="text" size="small" className={styles.copyButton} icon={<CopyOutlined />} aria-label="复制任务 ID" title={`复制任务 ID：${task.id}`} onClick={() => void navigator.clipboard?.writeText(task.id)} />
        </div>
        {task.status === 'PLANNING' ? <Text type="secondary">任务 ID：{task.id}</Text> : null}
      </div>
      <div className={styles.headerMeta}>
        <HeaderMeta label="需求群" value={task.requirementGroup?.name} />
        <HeaderMeta label="当前阶段" value={task.executionSummary.currentStageTitle ?? task.executionSummary.currentStage} />
        <HeaderMeta label="创建者" value={task.createdByUser?.displayName} />
        <HeaderMeta label="创建时间" value={formatDate(task.createdAt)} />
        <HeaderMeta label="更新时间" value={formatDate(task.updatedAt)} />
        <HeaderMeta label="仓库" value={`${task.repositories.length} 个`} />
      </div>
    </header>
  )
}

function AttentionBanner({ projectId, task, steps, onLocate }: { projectId: string; task: Task; steps: TaskStep[]; onLocate: (id: string) => void }) {
  const navigate = useNavigate()
  const attention = task.attention!
  const attentionRunId = getAttentionRunId(attention)
  const latestRunId = steps.find((step) => step.latestRun)?.latestRun?.id ?? null
  const runId = attentionRunId ?? null
  const isOutput = attention.kind === 'DIFF_CONFIRMATION_REQUIRED' || attention.kind === 'DELIVERY_FAILED'
  const action = runId ? <Button size="small" onClick={() => navigate(PATHS.projectTaskRunDetail(projectId, task.id, runId))}>查看关联运行</Button> : isOutput ? <Button size="small" onClick={() => onLocate('output-delivery')}>查看产出与交付</Button> : <Button size="small" onClick={() => onLocate('execution-flow')}>{latestRunId ? '查看执行流程' : '定位执行流程'}</Button>
  return <section className={styles.attentionBanner} data-testid="task-attention-banner"><Alert type="warning" showIcon title={<span><Tag color="orange">{attention.kind}</Tag>{attention.title}</span>} description={attention.summary} action={action} /></section>
}

function ExecutionFlowRow({ projectId, taskId, task, query, steps }: { projectId: string; taskId: string; task: Task; query: ReturnType<typeof useTaskSteps>; steps: TaskStep[] }) {
  const navigate = useNavigate()
  const ordered = steps.slice().sort((left, right) => left.sequenceNo - right.sequenceNo)
  return (
    <section className={styles.executionFlowRow} id="execution-flow" data-testid="execution-flow-row">
      <RowHeading title="执行流程" meta={ordered.length > 0 ? `${ordered.length} 个步骤` : undefined} />
      {query.isLoading ? <InlineState loading /> : query.isError ? <SectionError resource="TaskStep" error={query.error} /> : ordered.length === 0 ? <InlineState text="暂无执行步骤" /> : <div className={styles.flowScroller}><div className={styles.flowGrid}>{ordered.map((step) => <StepCard key={step.id} step={step} onRun={(runId) => navigate(PATHS.projectTaskRunDetail(projectId, taskId, runId))} />)}</div></div>}
      {task.workspace && task.workspace.status !== 'READY' ? <Text type="danger" className={styles.workspaceNotice}>执行环境状态：{task.workspace.status}</Text> : null}
    </section>
  )
}

function StepCard({ step, onRun }: { step: TaskStep; onRun: (runId: string) => void }) {
  const current = step.status === 'RUNNING'
  return <article className={`${styles.stepCard} ${current ? styles.stepCardCurrent : ''}`}><div className={styles.stepHeading}><span className={styles.stepIcon}>{stepIcon(step.role)}</span><span className={styles.stepNumber}>{step.sequenceNo}.</span><Tooltip title={display(step.title)}><Text strong className={styles.stepTitle}>{display(step.title)}</Text></Tooltip><Tag color={stepStatusColor(step.status)}>{step.status}</Tag></div><div className={styles.stepDetails}><StepInfo label="Agent" value={display(step.agent?.name)} /><StepInfo label="仓库" value={display(step.repository?.name)} /><StepInfo label="验收" value={display(step.acceptanceNotes)} /><StepInfo label="运行" value={`${step.runCount} 次`} /></div><div className={styles.stepFooter}>{step.latestRun ? <Button type="link" size="small" onClick={() => onRun(step.latestRun!.id)}>查看最新运行</Button> : <Text type="secondary">尚未运行</Text>}{step.latestRun ? <ArrowRightOutlined /> : null}</div></article>
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

function stepIcon(role: TaskStep['role']) {
  if (role === 'PLANNER') return <FileTextOutlined />
  if (role === 'DEVELOPER') return <CodeOutlined />
  if (role === 'TESTER') return <ExperimentOutlined />
  return <TeamOutlined />
}

function RequirementContextRow({ projectId, task }: { projectId: string; task: Task }) {
  const navigate = useNavigate()
  const [requirementOpen, setRequirementOpen] = useState(false)
  const [criteriaOpen, setCriteriaOpen] = useState(false)
  const isLong = task.requirement.length > 260
  const visibleCriteria = task.acceptanceCriteria.slice(0, 3)
  return (
    <section className={styles.requirementRow} data-testid="requirement-context-row">
      <Card className={styles.contextCard} size="small"><div className={styles.cardHeading}><FileTextOutlined />需求描述</div><Typography.Paragraph ellipsis={!requirementOpen && isLong ? { rows: 4 } : false} className={styles.requirementSummary}>{display(task.requirement)}</Typography.Paragraph>{isLong ? <Button type="link" size="small" onClick={() => setRequirementOpen((value) => !value)}>{requirementOpen ? '收起需求' : '查看完整需求'}</Button> : null}</Card>
      <Card className={styles.contextCard} size="small"><div className={styles.cardHeading}><CheckCircleOutlined />验收标准 <Text type="secondary">{task.acceptanceCriteria.filter((criterion) => criterion.status === 'SATISFIED').length}/{task.acceptanceCriteria.length}</Text></div>{visibleCriteria.length > 0 ? <div className={styles.criteriaPreview}>{visibleCriteria.map((criterion) => <div key={criterion.id}><Tag color={criterion.status === 'SATISFIED' ? 'green' : criterion.status === 'UNSATISFIED' ? 'red' : undefined}>{criterion.status}</Tag><Text ellipsis>{criterion.title}</Text></div>)}</div> : <Text type="secondary" className={styles.compactEmpty}>暂无验收标准</Text>}{task.acceptanceCriteria.length > 3 ? <Button type="link" size="small" onClick={() => setCriteriaOpen(true)}>查看其余 {task.acceptanceCriteria.length - 3} 条</Button> : null}</Card>
      {task.sourceMessage ? <Card className={styles.contextCard} size="small"><div className={styles.cardHeading}><LinkOutlined />来源消息</div><Text type="secondary">{task.sourceMessage.sender.displayName} · {formatDate(task.sourceMessage.createdAt)}</Text><Text ellipsis className={styles.sourceExcerpt}>{task.sourceMessage.textExcerpt}</Text>{task.requirementGroup ? <Button type="link" size="small" onClick={() => navigate(PATHS.projectReqChat(projectId, task.requirementGroup!.id))}>查看原消息</Button> : null}</Card> : null}
      <Modal title="完整需求" open={requirementOpen} footer={null} onCancel={() => setRequirementOpen(false)}>{task.requirement}</Modal>
      <Modal title="全部验收标准" open={criteriaOpen} footer={null} onCancel={() => setCriteriaOpen(false)}><div className={styles.criteriaModal}>{task.acceptanceCriteria.map((criterion) => <div key={criterion.id}><Tag>{criterion.status}</Tag><Text>{criterion.title}</Text></div>)}</div></Modal>
    </section>
  )
}

function OutputDeliveryRow({ projectId, taskId, task, artifactsQuery, diffsQuery, diffReviewQuery, reviewEnabled, onRefresh }: { projectId: string; taskId: string; task: Task; artifactsQuery: ReturnType<typeof useTaskArtifacts>; diffsQuery: ReturnType<typeof useDiffs>; diffReviewQuery: ReturnType<typeof useTaskDiffReview>; reviewEnabled: boolean; onRefresh: () => void }) {
  return <section className={styles.outputRow} id="output-delivery" data-testid="output-delivery-row"><RowHeading title="任务产出与交付" /><div className={styles.outputGrid}><ArtifactsCard projectId={projectId} taskId={taskId} query={artifactsQuery} /><DiffCard projectId={projectId} taskId={taskId} task={task} query={diffsQuery} /><DeliveryCard projectId={projectId} task={task} query={diffReviewQuery} enabled={reviewEnabled} onRefresh={onRefresh} /></div></section>
}

function ArtifactsCard({ projectId, taskId, query }: { projectId: string; taskId: string; query: ReturnType<typeof useTaskArtifacts> }) {
  const navigate = useNavigate()
  const artifacts = [...(query.data ?? [])].sort((left, right) => right.sequenceNo - left.sequenceNo)
  const latestByType = ARTIFACT_TYPES.map((type) => ({ type, artifact: artifacts.find((artifact) => artifact.artifactType === type) })).filter((item): item is { type: TaskArtifactType; artifact: TaskArtifact } => Boolean(item.artifact))
  return <Card className={styles.outputCard} size="small" data-testid="artifacts-card"><div className={styles.cardHeading}>执行产物 <Text type="secondary">{artifacts.length} 个</Text></div>{query.isLoading ? <InlineState loading /> : query.isError ? <SectionError resource="执行产物" error={query.error} /> : latestByType.length === 0 ? <Text type="secondary" className={styles.compactEmpty}>暂无执行产物</Text> : <div className={styles.artifactSummaryGrid}>{latestByType.map(({ type, artifact }) => <div className={styles.artifactSummary} key={type}><div><Tag>{type}</Tag><Text strong>{artifact.title}</Text></div><Text type="secondary" ellipsis>{display(artifact.description)}</Text><div><Tag color={artifact.status === 'SUCCEEDED' ? 'green' : artifact.status === 'FAILED' ? 'red' : undefined}>{artifact.status ?? 'PENDING'}</Tag>{artifact.taskRunId ? <Button type="link" size="small" onClick={() => navigate(PATHS.projectTaskRunDetail(projectId, taskId, artifact.taskRunId!))}>查看运行</Button> : null}</div></div>)}</div>}</Card>
}

function DiffCard({ projectId, taskId, task, query }: { projectId: string; taskId: string; task: Task; query: ReturnType<typeof useDiffs> }) {
  const navigate = useNavigate()
  const diffs = query.data?.data ?? []
  const repositories = new Map<string, { name: string; files: number; additions: number; deletions: number; ids: string[] }>()
  for (const diff of diffs) { const repository = task.repositories.find((item) => item.repositoryId === diff.repositoryId); const summary = repositories.get(diff.repositoryId) ?? { name: repository?.name ?? diff.repositoryId, files: 0, additions: 0, deletions: 0, ids: [] }; summary.files += diff.changeStats.files; summary.additions += diff.changeStats.additions; summary.deletions += diff.changeStats.deletions; summary.ids.push(diff.id); repositories.set(diff.repositoryId, summary) }
  const totals = [...repositories.values()].reduce((sum, repository) => ({ files: sum.files + repository.files, additions: sum.additions + repository.additions, deletions: sum.deletions + repository.deletions }), { files: 0, additions: 0, deletions: 0 })
  return <Card className={styles.outputCard} size="small" data-testid="diff-card"><div className={styles.cardHeading}><CodeOutlined />代码变更 <Text type="secondary">{diffs.length} 个 Diff / {repositories.size} 个仓库</Text></div>{query.isLoading ? <InlineState loading /> : query.isError ? <SectionError resource="Diff" error={query.error} /> : diffs.length === 0 ? <Text type="secondary" className={styles.compactEmpty}>{isDiffReviewTask(task.status) ? '当前阶段尚未生成 Diff' : '暂无代码变更'}</Text> : <><Text type="secondary">files {totals.files} · +{totals.additions} / -{totals.deletions}</Text><div className={styles.diffSummaryList}>{[...repositories.entries()].map(([repositoryId, summary]) => <div key={repositoryId} className={styles.diffSummaryRow}><Text ellipsis>{summary.name}</Text><Text type="secondary">{summary.files} files · +{summary.additions} / -{summary.deletions}</Text>{summary.ids.map((diffId) => <Button key={diffId} type="link" size="small" onClick={() => navigate(PATHS.projectDiff(projectId, diffId), { state: { from: PATHS.projectTaskDetail(projectId, taskId) } })}>查看完整 Diff</Button>)}</div>)}</div></>}</Card>
}

function DeliveryCard({ projectId, task, query, enabled, onRefresh }: { projectId: string; task: Task; query: ReturnType<typeof useTaskDiffReview>; enabled: boolean; onRefresh: () => void }) {
  if (!enabled) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div><Text type="secondary" className={styles.compactEmpty}>当前任务尚未进入代码交付确认阶段</Text></Card>
  if (query.isLoading) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div><InlineState loading /></Card>
  if (query.isError) return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果</div>{errorCode(query.error) === 'DIFF_REVIEW_NOT_FOUND' ? <Text type="secondary" className={styles.compactEmpty}>最终 Diff 尚未生成</Text> : <SectionError resource="DiffReview" error={query.error} />}</Card>
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
  const failed = batch.repositoryDeliveries.filter((delivery) => delivery.deliveryStatus === 'FAILED')
  const canRetry = task.capabilities.canRetryDelivery && batch.reviewStatus === 'ACCEPTED' && (batch.deliveryStatus === 'PARTIALLY_DELIVERED' || batch.deliveryStatus === 'FAILED')
  const handleError = (mutationError: Error) => { if (mutationError instanceof ApiError && mutationError.status === 409) onRefresh() }
  return <Card className={styles.outputCard} size="small" data-testid="delivery-card"><div className={styles.cardHeading}>交付确认与结果 <Tag>{batch.reviewStatus}</Tag></div><Text type="secondary">{batch.deliveryStatus} · {batch.repositoryDeliveries.length} 个仓库</Text>{batch.reviewStatus === 'REJECTED' && batch.reviewReason ? <Text type="danger">拒绝原因：{batch.reviewReason}</Text> : null}{batch.deliveryStatus === 'DELIVERING' || failed.length > 0 || batch.deliveryStatus === 'DELIVERED' ? <div className={styles.deliverySummaryList}>{batch.repositoryDeliveries.map((delivery) => <div key={delivery.repositoryId} className={styles.deliverySummaryRow}><Text ellipsis>{delivery.repositoryName}</Text><Tag color={delivery.deliveryStatus === 'FAILED' ? 'red' : delivery.deliveryStatus === 'MR_CREATED' ? 'green' : 'orange'}>{delivery.deliveryStatus}</Tag>{delivery.failureReason ? <Text type="danger">{delivery.failureReason}</Text> : null}{delivery.mergeRequest?.webUrl ? <a href={delivery.mergeRequest.webUrl} target="_blank" rel="noreferrer">查看 MR</a> : null}</div>)}</div> : null}{batch.deliveryStatus === 'DELIVERED' ? <Text type="secondary">交付已完成，可从 MR 入口继续查看。</Text> : null}{batch.reviewStatus === 'PENDING_CONFIRMATION' ? <div className={styles.reviewActions}>{task.capabilities.canConfirmDiffReview ? <Button type="primary" loading={confirm.isPending} disabled={pending} onClick={() => confirm.mutate(batch.taskId, { onError: handleError })}>确认交付</Button> : null}{task.capabilities.canRejectDiffReview ? <Form onFinish={() => { const trimmed = reason.trim(); if (trimmed) reject.mutate({ taskId: batch.taskId, input: { reason: trimmed } }, { onError: handleError }) }}><Form.Item label="拒绝原因" required><Input.TextArea value={reason} rows={2} maxLength={4000} disabled={pending} onChange={(event) => setReason(event.target.value)} /></Form.Item><Button danger htmlType="submit" loading={reject.isPending} disabled={pending || !reason.trim()}>拒绝交付</Button></Form> : null}</div> : null}{canRetry ? <Button size="small" loading={retry.isPending} disabled={pending} onClick={() => retry.mutate(batch.taskId, { onError: handleError })}>重试交付</Button> : null}{error ? <Alert type="error" showIcon title={diffReviewError(error)} action={error instanceof ApiError && error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新</Button> : undefined} /> : null}</Card>
}

function normalizeTaskForDisplay(task: Task): Task {
  const capabilities = task.capabilities
  return {
    ...task,
    requirement: typeof task.requirement === 'string' ? task.requirement : task.requirementSummary ?? '',
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
    repositories: Array.isArray(task.repositories) ? task.repositories : [],
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
function HeaderMeta({ label, value }: { label: string; value: string | null | undefined }) { return <div className={styles.headerMetaItem}><Text type="secondary">{label}</Text><Text ellipsis strong>{display(value)}</Text></div> }
function InlineState({ loading = false, text }: { loading?: boolean; text?: string }) { return <div className={styles.inlineState}>{loading ? <Spin size="small" /> : null}<Text type="secondary">{text ?? '正在加载'}</Text></div> }
function SectionError({ resource, error }: { resource: string; error: Error | null }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert type="error" showIcon title={status === 403 ? `暂无权限查看${resource}` : `${resource}加载失败`} /> }
function CancelError({ error, onRefresh }: { error: Error; onRefresh: () => void }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert className={styles.executionAlert} type="error" showIcon title={status === 409 ? '任务状态已变化，请刷新详情' : '取消任务失败'} action={status === 409 ? <Button type="link" onClick={onRefresh}>刷新</Button> : undefined} /> }
function DetailState({ description, loading = false }: { description: string; loading?: boolean }) { return <div className={styles.page}><div className={styles.panelState}>{loading ? <Spin /> : <Result status="404" title={description} />}</div></div> }
function DetailError({ error, resource }: { error: Error | null; resource: string }) { const status = error instanceof ApiError ? error.status : undefined; return <div className={styles.page}><Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`} /></div> }
function isDiffReviewTask(status: Task['status'] | undefined): boolean { return status === 'WAITING_DIFF_CONFIRMATION' || status === 'DELIVERING' || status === 'DELIVERY_FAILED' }
function getAttentionRunId(attention: Task['attention']): string | null { return attention?.taskRunId ?? null }
function errorCode(error: Error | null): string | undefined { if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object' || !('error' in error.body)) return undefined; const bodyError = (error.body as { error?: { code?: unknown } }).error; return typeof bodyError?.code === 'string' ? bodyError.code : undefined }
function diffReviewError(error: Error): string { const code = errorCode(error); if (code === 'DIFF_REVIEW_FORBIDDEN') return '暂无 Diff 验收权限'; if (code === 'DIFF_REVIEW_NOT_FOUND') return '最终 Diff 尚未生成'; if (code === 'DIFF_REVIEW_NOT_DECIDABLE') return 'Diff 状态已变化，请刷新后重试'; if (code === 'DIFF_DELIVERY_NOT_RETRYABLE') return '当前交付状态不可重试'; return 'Diff 操作失败' }
function display(value: string | null | undefined): string { return value?.trim() || '暂无' }
function formatDate(value: string | null | undefined): string { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? display(value) : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function resolveReturnPath(state: unknown, projectId: string, _taskId: string): string { const fallback = PATHS.projectTasks(projectId); return state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith(PATHS.projectTasks(projectId)) ? state.from : fallback }
