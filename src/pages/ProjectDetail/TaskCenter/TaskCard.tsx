import { Button, Card, Col, Divider, Space, Tag, Typography } from 'antd'
import type { Task } from '@/types/task-model'
import { TaskModelStatusTag } from './TaskModelStatusTag'
import { valueOrNone } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

const { Text, Paragraph } = Typography

interface TaskCardProps {
  task: Task
  selected: boolean
  onSelect: (taskId: string) => void
  onViewDetails: (taskId: string) => void
}

export function TaskCard({ task, selected, onSelect, onViewDetails }: TaskCardProps) {
  return (
    <Col xs={24} sm={12} lg={8} xl={6}>
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
          <Typography.Title level={5} ellipsis={{ tooltip: valueOrNone(task.title) }}>{valueOrNone(task.title)}</Typography.Title>
          <TaskModelStatusTag status={task.status} />
        </div>
        <Space wrap size={[6, 6]} className={styles.taskCardTags}>
          <Tag className={styles.groupTag}>{valueOrNone(task.requirementGroupId)}</Tag>
          <Tag>{valueOrNone(task.createdBy)}</Tag>
        </Space>
        <Paragraph ellipsis={{ rows: 2 }} className={styles.taskCardCopy}>{valueOrNone(task.requirement)}</Paragraph>
        <div className={styles.taskCardTarget}>
          <Text type="secondary">工作区 / 仓库</Text>
          <Text strong>{workspaceSummary(task)}</Text>
        </div>
        <Divider />
        <div className={styles.taskCardTarget}>
          <Text type="secondary">创建时间</Text>
          <Text>{formatDate(task.createdAt)}</Text>
          <Text type="secondary">更新时间</Text>
          <Text>{formatDate(task.updatedAt)}</Text>
        </div>
        <Button
          type="link"
          disabled={false}
          title="任务详情迁移中"
          className={styles.cardDetailsButton}
          onClick={(event) => { event.stopPropagation(); onViewDetails(task.id) }}
        >
          查看完整任务详情
        </Button>
      </Card>
    </Col>
  )
}

function workspaceSummary(task: Task): string {
  const repositories = task.repositories.map((repository) => repository.repositoryId).filter(Boolean)
  const workspace = valueOrNone(task.workspaceId)
  return repositories.length > 0 ? `${workspace} / ${repositories.join(', ')}` : workspace
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return valueOrNone(value)
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
