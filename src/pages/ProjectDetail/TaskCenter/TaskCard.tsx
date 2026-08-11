import { Card, Col, Divider, Progress, Row, Space, Typography } from 'antd'
import { ClockCircleOutlined, TeamOutlined, AppstoreOutlined } from '@ant-design/icons'
import type { OrchestrationRun } from '@/types'
import { TaskStatusTag } from './TaskStatusTag'
import { getTaskCenterPresentation } from './taskCenterPresentation'
import styles from './TaskCenterPage.module.scss'

const { Text, Paragraph } = Typography

interface TaskCardProps {
  run: OrchestrationRun
  selected: boolean
  onSelect: (runId: string) => void
}

export function TaskCard({ run, selected, onSelect }: TaskCardProps) {
  const presentation = getTaskCenterPresentation(run)

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
          <Typography.Title level={5} ellipsis={{ tooltip: run.instruction }}>
            {run.instruction}
          </Typography.Title>
          <TaskStatusTag status={run.status} />
        </div>

        <Space wrap size={[6, 6]} className={styles.taskCardTags}>
          <Text className={styles.groupTag}>{presentation.groupLabel}</Text>
        </Space>

        <Paragraph ellipsis={{ rows: 2 }} type="secondary" className={styles.taskCardCopy}>
          编排任务，包含 {run.workPackageIds.length} 个工作包。
        </Paragraph>

        <div className={styles.taskCardMeta}>
          <Text type="secondary">进度（临时展示）</Text>
          <Progress percent={presentation.progressPercent} size="small" showInfo />
        </div>

        <Divider />

        <Row gutter={[8, 10]} className={styles.taskCardDetails}>
          <Col span={12}>
            <Text type="secondary"><TeamOutlined /> 发起人</Text>
            <Text strong>{presentation.creatorLabel}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary"><AppstoreOutlined /> 工作包</Text>
            <Text strong>{run.workPackageIds.length} 个</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary"><ClockCircleOutlined /> 创建时间</Text>
            <Text>{formatDate(run.createdAt)}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary"><ClockCircleOutlined /> 最近更新</Text>
            <Text>{formatDate(run.updatedAt)}</Text>
          </Col>
        </Row>

        {presentation.waitingLabel ? (
          <div className={`${styles.taskCardNotice} ${styles.waitingNotice}`}>{presentation.waitingLabel}</div>
        ) : null}
        {presentation.errorSummary ? (
          <div className={`${styles.taskCardNotice} ${styles.errorNotice}`}>{presentation.errorSummary}</div>
        ) : null}
      </Card>
    </Col>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date)
}
