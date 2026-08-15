import { Alert, Button, Empty, Spin, Tabs, Tag, Typography } from 'antd'
import type { Task, TaskListItem, TaskStep } from '@/types/task-model'
import { useTask, useTaskRuns, useTaskSteps } from '@/hooks/task-model'
import { TASK_CENTER_PANEL_OPTIONS, type TaskCenterPanel } from './taskCenterConfig'
import { TaskModelStatusTag } from './TaskModelStatusTag'
import { valueOrNone } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

const { Text, Title } = Typography

interface TaskContextPanelProps {
  projectId: string
  task?: TaskListItem
  taskId?: string
  panel: TaskCenterPanel
  onPanelChange: (panel: TaskCenterPanel) => void
  onViewDetails: (taskId: string) => void
  onViewRun: (taskId: string, taskRunId: string) => void
}

export function TaskContextPanel({ projectId, task, taskId, panel, onPanelChange, onViewDetails, onViewRun }: TaskContextPanelProps) {
  const detailQuery = useTask(projectId, taskId ?? '')
  const stepsQuery = useTaskSteps(projectId, taskId ?? '')
  const runsQuery = useTaskRuns(projectId, taskId ?? '')
  const detail = detailQuery.data
  const steps = stepsQuery.data?.data ?? []

  return (
    <aside className={styles.contextPanel} aria-label="任务预览">
      <div className={styles.contextHeader}>
        <div className={styles.contextHeaderTitle}>
          <Text className={styles.contextId}>{valueOrNone(task?.displayCode ?? taskId)}</Text>
          {task ? <TaskModelStatusTag status={task.status} /> : null}
        </div>
        <Text type="secondary" className={styles.contextTaskId}>任务 ID：{valueOrNone(taskId)}</Text>
      </div>
      <Tabs
        activeKey={panel}
        items={TASK_CENTER_PANEL_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
        onChange={(key) => onPanelChange(key === 'detail' || key === 'executions' ? key : 'context')}
        className={styles.contextTabs}
      />
      {!task ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择任务" /> : (
        <div className={styles.contextContent}>
          {panel === 'context' ? <ContextSummary query={detailQuery} detail={detail} /> : null}
          {panel === 'detail' ? <TaskSummary query={detailQuery} detail={detail} /> : null}
          {panel === 'executions' ? <ExecutionSummary taskId={task.id} steps={steps} query={stepsQuery} runsQuery={runsQuery} onViewRun={onViewRun} /> : null}
          <Button type="link" className={styles.previewDetailsButton} onClick={() => onViewDetails(task.id)}>查看完整任务详情</Button>
        </div>
      )}
    </aside>
  )
}

function ContextSummary({ query, detail }: { query: ReturnType<typeof useTask>; detail?: Task }) {
  if (query.isLoading) return <PanelLoading />
  if (query.isError) return <PanelError resource="需求上下文" onRetry={() => void query.refetch()} />
  if (!detail) return <PanelEmpty description="暂无需求上下文" />
  return (
    <section>
      <Title level={5}>共享需求上下文</Title>
      <PreviewField label="需求群" value={detail.requirementGroup?.name} accent />
      <PreviewField label="完整需求" value={detail.requirement} paragraph />
      <Text type="secondary" className={styles.contextLabel}>验收标准</Text>
      {detail.acceptanceCriteria.length > 0 ? <ul className={styles.criteriaList}>{detail.acceptanceCriteria.map((criterion) => <li key={criterion.id}><span className={styles.checkMark}>✓</span>{criterion.title}</li>)}</ul> : <Text type="secondary">暂无验收标准</Text>}
      <PreviewField label="来源消息" value={detail.sourceMessage?.textExcerpt} paragraph />
      <PreviewField label="发起人" value={detail.createdByUser?.displayName} />
      <Text type="secondary" className={styles.contextLabel}>目标仓库</Text>
      <div className={styles.repositoryList}>{detail.repositories.length > 0 ? detail.repositories.map((repository) => <Tag key={repository.repositoryId}>{repository.name} / {repository.sourceBranch}</Tag>) : <Text type="secondary">暂无仓库</Text>}</div>
    </section>
  )
}

function TaskSummary({ query, detail }: { query: ReturnType<typeof useTask>; detail?: Task }) {
  if (query.isLoading) return <PanelLoading />
  if (query.isError) return <PanelError resource="任务详情" onRetry={() => void query.refetch()} />
  if (!detail) return <PanelEmpty description="暂无任务详情" />
  const summary = detail.executionSummary
  return (
    <section>
      <Title level={5}>任务详情</Title>
      <PreviewField label="任务编号" value={detail.displayCode} />
      <PreviewField label="状态" value={<TaskModelStatusTag status={detail.status} />} />
      <PreviewField label="交付模式" value={detail.deliveryMode} />
      <PreviewField label="当前阶段" value={summary.currentStageTitle ?? summary.currentStage} />
      <div className={styles.previewStatGrid}>
        <StatField label="总步骤" value={summary.totalSteps} />
        <StatField label="运行中" value={summary.runningSteps} />
        <StatField label="等待" value={summary.waitingSteps} />
        <StatField label="阻塞" value={summary.blockedSteps} />
        <StatField label="已完成" value={summary.succeededSteps} />
        <StatField label="失败" value={summary.failedSteps} />
      </div>
      {detail.attention ? <Alert type="warning" showIcon message={detail.attention.title} description={detail.attention.summary} className={styles.previewAlert} /> : <Text type="secondary">暂无待处理事项</Text>}
      <PreviewField label="Workspace" value={detail.workspace?.status} />
      <PreviewField label="创建时间" value={formatDate(detail.createdAt)} />
      <PreviewField label="更新时间" value={formatDate(detail.updatedAt)} />
      <Text type="secondary" className={styles.contextLabel}>当前能力</Text>
      <div className={styles.capabilityList}>{capabilityRows(detail).map((row) => <div key={row.label} className={styles.capabilityRow}><span>{row.label}</span><Tag color={row.enabled ? 'cyan' : undefined}>{row.enabled ? '可用' : valueOrNone(row.reason)}</Tag></div>)}</div>
    </section>
  )
}

function ExecutionSummary({ taskId, steps, query, runsQuery, onViewRun }: { taskId: string; steps: TaskStep[]; query: ReturnType<typeof useTaskSteps>; runsQuery: ReturnType<typeof useTaskRuns>; onViewRun: (taskId: string, taskRunId: string) => void }) {
  if (query.isLoading || runsQuery.isLoading) return <PanelLoading />
  if (query.isError) return <PanelError resource="TaskStep" onRetry={() => void query.refetch()} />
  if (runsQuery.isError) return <PanelError resource="TaskRun" onRetry={() => void runsQuery.refetch()} />
  if (steps.length === 0) return <PanelEmpty description="暂无执行记录" />
  return (
    <section>
      <Title level={5}>执行记录</Title>
      <div className={styles.executionPreviewList}>
        {steps.slice().sort((a, b) => a.sequenceNo - b.sequenceNo).map((step) => {
          const latestRun = step.latestRun
          return <div className={styles.executionStep} key={step.id}>
            <div className={styles.executionStepHeader}><Text strong>{step.sequenceNo}. {step.title}</Text><Tag>{step.status}</Tag></div>
            <Text type="secondary">Agent：{valueOrNone(step.agent?.name)} · 仓库：{valueOrNone(step.repository?.name)}{step.repository?.sourceBranch ? ` / ${step.repository.sourceBranch}` : ''}</Text>
            <Text type="secondary">运行 {step.runCount} 次 · {formatDate(step.startedAt)} - {formatDate(step.finishedAt)}</Text>
            <Text type="secondary">验收说明：{valueOrNone(step.acceptanceNotes)}</Text>
            {latestRun ? <><Text type="secondary">最近运行：{latestRun.status}（{formatDate(latestRun.startedAt)}）</Text><Button type="link" size="small" onClick={() => onViewRun(taskId, latestRun.id)}>查看最近运行</Button></> : <Text type="secondary">尚未运行</Text>}
          </div>
        })}
      </div>
    </section>
  )
}

function capabilityRows(task: Task) {
  return [
    { label: '取消任务', enabled: task.capabilities.canCancel, reason: task.capabilities.canCancelDisabledReason },
    { label: '更换待执行 Agent', enabled: task.capabilities.canReplacePendingStepAgent, reason: task.capabilities.canReplacePendingStepAgentDisabledReason },
    { label: '确认 Diff', enabled: task.capabilities.canConfirmDiffReview, reason: task.capabilities.canConfirmDiffReviewDisabledReason },
    { label: '拒绝 Diff', enabled: task.capabilities.canRejectDiffReview, reason: task.capabilities.canRejectDiffReviewDisabledReason },
    { label: '重试交付', enabled: task.capabilities.canRetryDelivery, reason: task.capabilities.canRetryDeliveryDisabledReason },
  ]
}

function PreviewField({ label, value, accent = false, paragraph = false }: { label: string; value: React.ReactNode; accent?: boolean; paragraph?: boolean }) {
  const display = typeof value === 'string' ? valueOrNone(value) : value
  return <div className={styles.previewField}><Text type="secondary" className={styles.contextLabel}>{label}</Text>{paragraph ? <Typography.Paragraph className={styles.contextDescription}>{display}</Typography.Paragraph> : <Text className={`${styles.contextValue} ${accent ? styles.contextAccent : ''}`}>{display}</Text>}</div>
}

function StatField({ label, value }: { label: string; value: number }) { return <div className={styles.previewStat}><Text type="secondary">{label}</Text><Text strong>{value}</Text></div> }
function PanelLoading() { return <div className={styles.panelState}><Spin /></div> }
function PanelEmpty({ description }: { description: string }) { return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} className={styles.panelResult} /> }
function PanelError({ resource, onRetry }: { resource: string; onRetry: () => void }) { return <div className={styles.panelResult}><Alert type="error" showIcon message={`${resource}加载失败`} action={<Button size="small" onClick={onRetry}>重新加载</Button>} /></div> }
function formatDate(value: string | null | undefined): string { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? valueOrNone(value) : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
