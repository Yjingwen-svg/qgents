import { Button, Empty, Space, Tabs, Tag, Typography } from 'antd'
import type { TaskListItem } from '@/types/task-model'
import { TASK_CENTER_PANEL_OPTIONS, type TaskCenterPanel } from './taskCenterConfig'
import { TaskModelStatusTag } from './TaskModelStatusTag'
import { valueOrNone } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

const { Text, Title } = Typography

interface TaskContextPanelProps {
  task?: TaskListItem
  taskId?: string
  panel: TaskCenterPanel
  onPanelChange: (panel: TaskCenterPanel) => void
}

export function TaskContextPanel({ task, taskId, panel, onPanelChange }: TaskContextPanelProps) {
  return (
    <aside className={styles.contextPanel} aria-label="任务轻量预览">
      <div className={styles.contextHeader}>
        <Text className={styles.contextId}>任务 ID：{valueOrNone(taskId)}</Text>
        {task ? <TaskModelStatusTag status={task.status} /> : null}
      </div>
      <Tabs
        activeKey={panel}
        items={TASK_CENTER_PANEL_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
        onChange={(key) => onPanelChange(key === 'detail' || key === 'executions' ? key : 'context')}
        className={styles.contextTabs}
      />
      {!task ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择任务" /> : (
        <div className={styles.contextContent}>
          {panel === 'context' ? <ContextSummary task={task} /> : null}
          {panel === 'detail' ? <TaskSummary task={task} /> : null}
          {panel === 'executions' ? <ExecutionSummary /> : null}
          <Button type="link" disabled title="任务详情迁移中" className={styles.previewDetailsButton}>任务详情迁移中</Button>
        </div>
      )}
    </aside>
  )
}

function ContextSummary({ task }: { task: TaskListItem }) {
  return (
    <section>
      <Title level={5}>需求上下文</Title>
      <PreviewField label="需求群" value={task.requirementGroup?.name} accent />
      <PreviewField label="需求摘要" value={task.requirementSummary} paragraph />
      <PreviewField label="仓库" value={task.repositories[0]?.name} />
      <PreviewField label="仓库" value={task.repositories.map((repository) => repository.repositoryId).join(', ')} />
    </section>
  )
}

function TaskSummary({ task }: { task: TaskListItem }) {
  return (
    <section>
      <Title level={5}>任务详情摘要</Title>
      <PreviewField label="标题" value={task.title} />
      <PreviewField label="状态" value={<TaskModelStatusTag status={task.status} />} />
      <PreviewField label="创建人" value={task.createdByUser?.displayName} />
      <PreviewField label="创建时间" value={task.createdAt} />
      <PreviewField label="更新时间" value={task.updatedAt} />
    </section>
  )
}

function ExecutionSummary() {
  return (
    <section>
      <Title level={5}>执行记录摘要</Title>
      <Space direction="vertical">
        <Tag>TaskRun 内容将在后续迁移</Tag>
        <Text type="secondary">当前阶段只展示 Task 正式数据。</Text>
      </Space>
    </section>
  )
}

function PreviewField({ label, value, accent = false, paragraph = false }: {
  label: string
  value: React.ReactNode
  accent?: boolean
  paragraph?: boolean
}) {
  const display = typeof value === 'string' ? valueOrNone(value) : value
  return (
    <div className={styles.previewField}>
      <Text type="secondary" className={styles.contextLabel}>{label}</Text>
      {paragraph ? <Typography.Paragraph className={styles.contextDescription}>{display}</Typography.Paragraph> : <Text className={`${styles.contextValue} ${accent ? styles.contextAccent : ''}`}>{display}</Text>}
    </div>
  )
}
