import {
  Button, Card, Divider, Space, Tag, Tooltip, Typography,
} from 'antd'
import type { TaskListItem } from '@/types/task-model'
import { TaskModelStatusTag } from './TaskModelStatusTag'
import { valueOrNone } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

const { Text, Paragraph } = Typography

interface TaskCardProps {
  task: TaskListItem
  selected: boolean
  onSelect: (taskId: string) => void
  onViewDetails: (taskId: string) => void
}

export function TaskCard({ task, selected, onSelect, onViewDetails }: TaskCardProps) {
  return (
    <Card
      className={`${styles.taskCard} ${selected ? styles.taskCardSelected : ''}`}
      variant="outlined"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(task.id)
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
          <Text type="secondary">任务执行位置</Text>
          <RepositoryLocation task={task} />
        </div>
        <div>
          <Text type="secondary">发起人</Text>
          <Tooltip title={valueOrNone(task.createdByUser?.displayName)}>
            <Text className={styles.taskInfoEllipsis}>{valueOrNone(task.createdByUser?.displayName)}</Text>
          </Tooltip>
        </div>
      </div>
      <Divider className={styles.taskCardDivider} />
      <div className={styles.taskCardStats} aria-label="步骤统计">
        <Stat label="运行中" value={task.executionSummary.runningSteps} />
        <Stat label="等待" value={task.executionSummary.waitingSteps} />
        <Stat label="阻塞" value={task.executionSummary.blockedSteps} />
        <Stat label="已完成" value={task.executionSummary.succeededSteps} />
        <Stat label="失败" value={task.executionSummary.failedSteps} />
      </div>
      <div
        className={`${styles.taskCardAttention} ${task.attention ? '' : styles.taskCardAttentionPlaceholder}`}
        title={task.attention ? `${task.attention.title}：${task.attention.summary}` : undefined}
      >
        {task.attention ? `${task.attention.title}：${task.attention.summary}` : null}
      </div>
      <div className={styles.taskCardActions}>
        <Button type="link" className={styles.cardDetailsButton} onClick={(event) => { event.stopPropagation(); onViewDetails(task.id) }}>
          查看完整任务详情
        </Button>
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className={styles.statusCount}><span>{label}</span><strong>{value}</strong></div>
}

function RepositoryLocation({ task }: { task: TaskListItem }) {
  const repository = task.repositories[0]
  if (!repository) return <Text className={styles.taskInfoEllipsis}>暂无</Text>
  return <Tooltip title={repositorySummary(task)}>
    <div className={styles.repositoryLocationValue}>
      <Tag className={styles.repositoryName}>{repository.name}</Tag>
      <Text className={styles.repositoryBranch}>{repository.sourceBranch}</Text>
      {task.repositories.length > 1 ? <Text className={styles.repositoryMore}>+{task.repositories.length - 1}</Text> : null}
    </div>
  </Tooltip>
}

function repositorySummary(task: TaskListItem): string {
  if (task.repositories.length === 0) return '暂无'
  return task.repositories.map((repository) => `${repository.name} / ${repository.baseRef} → ${repository.sourceBranch}`).join('、')
}
