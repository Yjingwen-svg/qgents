import { Button, Card, Col, Divider, Space, Tag, Typography } from 'antd'
import type { OrchestrationRun } from '@/types'
import { TaskStatusTag } from '../TaskShared/TaskStatusTag'
import { getTaskPresentation } from '../TaskShared/taskPresentation'
import styles from './TaskCenterPage.module.scss'

const { Text, Paragraph } = Typography

interface TaskCardProps {
  run: OrchestrationRun
  selected: boolean
  onSelect: (runId: string) => void
  onViewDetails: (runId: string) => void
}

export function TaskCard({ run, selected, onSelect, onViewDetails }: TaskCardProps) {
  const presentation = getTaskPresentation(run)

  return (
    <Col xs={24} sm={12} lg={8} xl={6}>
      <Card
        className={`${styles.taskCard} ${selected ? styles.taskCardSelected : ''}`}
        variant="outlined"
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => onSelect(run.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(run.id)
        }}
      >
        <div className={styles.taskCardHeading}>
          <div className={styles.taskCardTitleLine}>
            <Typography.Title level={5} ellipsis={{ tooltip: run.instruction }}>{run.instruction}</Typography.Title>
            <Text className={styles.taskCount}>{presentation.taskCount}</Text>
          </div>
          <TaskStatusTag status={run.status} />
        </div>

        <Space wrap size={[6, 6]} className={styles.taskCardTags}>
          <Tag className={styles.groupTag}>{presentation.groupLabel}</Tag>
          <Tag className={styles.deliveryTag}>{presentation.deliveryTypeLabel}</Tag>
        </Space>

        <Paragraph ellipsis={{ rows: 2 }} className={styles.taskCardCopy}>
          {presentation.description}
        </Paragraph>

        <div className={styles.taskCardTarget}>
          <Text type="secondary">目标执行位置</Text>
          <Text strong>{presentation.targetLabel}</Text>
        </div>

        <Divider />

        {presentation.statusCounts ? (
          <div className={styles.taskCardCounts}>
            <StatusCount label="执行中" value={presentation.statusCounts.running} />
            <StatusCount label="待执行" value={presentation.statusCounts.pending} />
            <StatusCount label="已完成" value={presentation.statusCounts.completed} />
          </div>
        ) : <Text type="secondary">暂无统计</Text>}

        <Button
          type="link"
          className={styles.cardDetailsButton}
          onClick={(event) => {
            event.stopPropagation()
            onViewDetails(run.id)
          }}
        >
          查看完整任务详情
        </Button>
      </Card>
    </Col>
  )
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return <div className={styles.statusCount}><Text type="secondary">{label}</Text><Text strong>{value}</Text></div>
}
