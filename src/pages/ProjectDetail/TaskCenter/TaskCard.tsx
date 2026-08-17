import { Button, Card, Progress, Space, Tag, Tooltip, Typography } from 'antd'
import type { TaskListItem } from '@/types/task-model'
import { TaskModelStatusTag } from './TaskModelStatusTag'
import { formatExactTime, formatRelativeTime, taskExecutionSummary, taskRepositories, valueOrNone } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

const { Text, Paragraph } = Typography

interface TaskCardProps {
  task: TaskListItem
  onViewDetails: (taskId: string) => void
}

export function TaskCard({ task: rawTask, onViewDetails }: TaskCardProps) {
  const task: TaskListItem = {
    ...rawTask,
    repositories: taskRepositories(rawTask),
    executionSummary: taskExecutionSummary(rawTask) ?? {
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
  }
  return (
    <Card
      className={styles.taskCard}
      variant="outlined"
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onViewDetails(task.id)
      }}
    >
      <div className={styles.taskCardHeading}>
        <Text className={styles.taskCode}>#{valueOrNone(task.displayCode)}</Text>
        <div className={styles.taskCardTitleLine}>
          <Typography.Title level={5} ellipsis={{ tooltip: valueOrNone(task.title) }}>{valueOrNone(task.title)}</Typography.Title>
          <TaskModelStatusTag status={task.status} />
        </div>
      </div>
      <Space wrap size={[6, 6]} className={styles.taskCardTags}>
        <Tag className={styles.groupTag}>{valueOrNone(task.requirementGroup?.name)}</Tag>
        <Tag className={styles.deliveryTag}>{task.deliveryMode}</Tag>
      </Space>
      <Paragraph ellipsis={{ rows: 2, tooltip: valueOrNone(task.requirementSummary) }} className={styles.taskCardCopy}>{valueOrNone(task.requirementSummary)}</Paragraph>
      <div className={styles.taskCardInfoGrid}>
        <div>
          <Text type="secondary">仓库</Text>
          <RepositoryLocation task={task} />
        </div>
        <div>
          <Text type="secondary">发起人</Text>
          <Tooltip title={valueOrNone(task.createdByUser?.displayName)}>
            <Text className={styles.taskInfoEllipsis}>{valueOrNone(task.createdByUser?.displayName)}</Text>
          </Tooltip>
        </div>
        <div>
          <Text type="secondary">执行概览</Text>
          <div className={styles.executionOverview}>
            <Text className={styles.taskInfoEllipsis}>{valueOrNone(task.executionSummary.currentStageTitle ?? task.executionSummary.currentStage)}</Text>
            <Progress percent={executionPercent(task.executionSummary)} size="small" showInfo />
          </div>
        </div>
      </div>
      <div className={`${styles.taskCardAttention} ${task.attention ? '' : styles.taskCardAttentionPlaceholder}`} title={task.attention ? `${task.attention.title}：${task.attention.summary}` : undefined}>
        {task.attention ? `${task.attention.title}：${task.attention.summary}` : null}
      </div>
      <div className={styles.taskCardDates}><Tooltip title={formatExactTime(task.updatedAt)}><Text type="secondary">更新：{formatRelativeTime(task.updatedAt)}</Text></Tooltip></div>
      <div className={styles.taskCardActions}>
        <Button type="link" className={styles.cardDetailsButton} onClick={(event) => { event.stopPropagation(); onViewDetails(task.id) }}>
          查看完整任务详情
        </Button>
      </div>
    </Card>
  )
}

function RepositoryLocation({ task }: { task: TaskListItem }) {
  const repository = task.repositories[0]
  if (!repository) return <Text className={styles.taskInfoEllipsis}>暂无</Text>
  return <Tooltip title={repositorySummary(task)}><div className={styles.repositoryLocationValue}><Tag className={styles.repositoryName}>{repository.name}</Tag>{task.repositories.length > 1 ? <Text className={styles.repositoryMore}>+{task.repositories.length - 1}</Text> : null}</div></Tooltip>
}

function repositorySummary(task: TaskListItem): string {
  if (task.repositories.length === 0) return '暂无'
  return task.repositories.map((repository) => repository.name).join('、')
}

function executionPercent(summary: TaskListItem['executionSummary']): number {
  if (summary.totalSteps <= 0) return 0
  return Math.min(100, Math.round((summary.succeededSteps / summary.totalSteps) * 100))
}
