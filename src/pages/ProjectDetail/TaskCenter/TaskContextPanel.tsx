import { Alert, Button, Empty, Result, Space, Spin, Tabs, Tag, Typography } from 'antd'
import { ApiError } from '@/api'
import { useOrchestrationRun } from '@/hooks'
import type { OrchestrationRun, TaskExecutionPreviewStep } from '@/types'
import { TASK_CENTER_PANEL_OPTIONS, type TaskCenterPanel } from './taskCenterConfig'
import { TaskStatusTag } from '../TaskShared/TaskStatusTag'
import { getTaskPresentation } from '../TaskShared/taskPresentation'
import styles from './TaskCenterPage.module.scss'

const { Paragraph, Text, Title } = Typography

interface TaskContextPanelProps {
  projectId: string
  runId?: string
  summaryRun?: OrchestrationRun
  panel: TaskCenterPanel
  onPanelChange: (panel: TaskCenterPanel) => void
  onViewDetails: (runId: string) => void
  onViewExecution: (runId: string, taskRunId: string) => void
}

export function TaskContextPanel({
  projectId,
  runId,
  summaryRun,
  panel,
  onPanelChange,
  onViewDetails,
  onViewExecution,
}: TaskContextPanelProps) {
  const detailQuery = useOrchestrationRun(projectId, summaryRun ? '' : runId ?? '')
  const run = summaryRun ?? detailQuery.data

  return (
    <aside className={styles.contextPanel} aria-label="任务轻量预览">
      <div className={styles.contextHeader}>
        <Text className={styles.contextId}>任务 ID：{runId ?? '—'}</Text>
        {run ? <TaskStatusTag status={run.status} /> : null}
      </div>
      <Tabs
        activeKey={panel}
        items={TASK_CENTER_PANEL_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
        onChange={(key) => onPanelChange(parsePanelKey(key))}
        className={styles.contextTabs}
      />

      {!run ? <PreviewState runId={runId} query={detailQuery} /> : (
        <PreviewContent run={run} panel={panel} onViewDetails={onViewDetails} onViewExecution={onViewExecution} />
      )}
    </aside>
  )
}

function PreviewContent({
  run,
  panel,
  onViewDetails,
  onViewExecution,
}: {
  run: OrchestrationRun
  panel: TaskCenterPanel
  onViewDetails: (runId: string) => void
  onViewExecution: (runId: string, taskRunId: string) => void
}) {
  return (
    <div className={styles.contextContent}>
      {panel === 'context' ? <ContextSummary run={run} /> : null}
      {panel === 'detail' ? <TaskSummary run={run} /> : null}
      {panel === 'executions' ? <ExecutionSummary run={run} /> : null}
      <Button
        type="link"
        className={styles.previewDetailsButton}
        onClick={() => panel === 'executions' && run.executionPreview?.latestTaskRunId
          ? onViewExecution(run.id, run.executionPreview.latestTaskRunId)
          : onViewDetails(run.id)}
      >
        {panel === 'executions' && run.executionPreview?.latestTaskRunId ? '查看完整执行记录' : '查看完整任务详情'}
      </Button>
    </div>
  )
}

function ContextSummary({ run }: { run: OrchestrationRun }) {
  const presentation = getTaskPresentation(run)
  const summary = run.taskCenterSummary
  return (
    <section>
      <Title level={5}>共享需求上下文</Title>
      <PreviewField label="需求群" value={presentation.groupLabel} accent />
      <PreviewField label="需求描述" value={summary?.description ?? presentation.description} paragraph />
      <PreviewField label="执行目标" value={presentation.executionTarget} />
      <div className={styles.contextLabel}>验收标准</div>
      <ul className={styles.criteriaList}>
        {(summary?.acceptanceCriteria ?? []).length > 0 ? (summary?.acceptanceCriteria ?? []).map((criterion) => (
          <li key={criterion}><span className={styles.checkMark}>✓</span>{criterion}</li>
        )) : <li>暂无验收标准</li>}
      </ul>
      <div className={styles.contextLabel}>参与者 / Agent</div>
      <Space wrap>
        {(summary?.participants ?? []).map((participant) => (
          <Tag className={styles.roleTag} key={participant.id}>{participant.role} · {participant.name}</Tag>
        ))}
        {summary?.agentName ? <Tag className={styles.roleTag}>{summary.agentName}</Tag> : null}
      </Space>
    </section>
  )
}

function TaskSummary({ run }: { run: OrchestrationRun }) {
  const presentation = getTaskPresentation(run)
  const summary = run.taskDetailSummary
  return (
    <section>
      <Title level={5}>任务详情摘要</Title>
      <PreviewField label="标题" value={run.instruction} />
      <div className={styles.previewStatGrid}>
        <PreviewField label="状态" value={<TaskStatusTag status={run.status} />} />
        <PreviewField label="进度" value={presentation.progressPercent === undefined ? '暂无进度' : `${presentation.progressPercent}%`} />
        <PreviewField label="交付类型" value={presentation.deliveryTypeLabel} />
        <PreviewField label="WorkPackage" value={`${run.workPackageIds.length} 个`} />
      </div>
      <PreviewField label="执行阶段" value={summary?.currentStage ?? run.status} />
      <PreviewField label="执行目标" value={presentation.targetLabel} />
      <PreviewField label="发起人" value={presentation.creatorLabel} />
      <PreviewField label="时间" value={`${formatDate(run.createdAt)} · ${formatDate(run.updatedAt)}`} />
    </section>
  )
}

function ExecutionSummary({ run }: { run: OrchestrationRun }) {
  const preview = run.executionPreview
  return (
    <section>
      <Title level={5}>执行记录摘要</Title>
      <div className={styles.previewStatGrid}>
        <PreviewField label="最新 TaskRun" value={preview?.latestTaskRunId ?? '暂无记录'} />
        <PreviewField label="当前节点" value={preview?.currentNode ?? '暂无节点'} />
      </div>
      {preview?.errorSummary ? <Alert type="error" showIcon title={preview.errorSummary} /> : null}
      {preview?.blockedSummary ? <Alert type="warning" showIcon title={preview.blockedSummary} /> : null}
      <div className={styles.contextLabel}>最近步骤</div>
      <ul className={styles.executionPreviewList}>
        {(preview?.recentSteps ?? []).length > 0 ? (preview?.recentSteps ?? []).slice(0, 5).map((step) => (
          <li key={step.id}><ExecutionPreviewItem step={step} /></li>
        )) : <li>暂无执行步骤</li>}
      </ul>
    </section>
  )
}

function ExecutionPreviewItem({ step }: { step: TaskExecutionPreviewStep }) {
  return (
    <div>
      <div className={styles.previewStep}>
        <Text strong>{step.label}</Text>
        <Space size={6}>
          <Tag>{step.node}</Tag>
          <Text type="secondary">{step.status}</Text>
        </Space>
      </div>
    </div>
  )
}

function PreviewField({
  label,
  value,
  accent = false,
  paragraph = false,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
  paragraph?: boolean
}) {
  return (
    <div className={styles.previewField}>
      <Text type="secondary" className={styles.contextLabel}>{label}</Text>
      {paragraph ? <Paragraph className={styles.contextDescription}>{value}</Paragraph> : <Text className={`${styles.contextValue} ${accent ? styles.contextAccent : ''}`}>{value}</Text>}
    </div>
  )
}

function PreviewState({ runId, query }: { runId?: string; query: ReturnType<typeof useOrchestrationRun> }) {
  if (!runId) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择任务" />
  if (query.isLoading) return <div className={styles.panelState}><Spin description="正在加载任务预览" /></div>
  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : undefined
    return (
      <Result
        className={styles.panelResult}
        status={status === 403 ? '403' : status === 404 ? '404' : 'error'}
        title={status === 403 ? '暂无权限查看任务' : status === 404 ? '任务不存在或不可见' : '任务预览加载失败'}
        subTitle="任务中心列表仍可继续使用。"
      />
    )
  }
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务预览" />
}

function parsePanelKey(value: string): TaskCenterPanel {
  if (value === 'detail' || value === 'executions') return value
  return 'context'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date)
}
