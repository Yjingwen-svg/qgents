import { Divider, Empty, Space, Tabs, Tag, Typography } from 'antd'
import type { OrchestrationRun } from '@/types'
import { TaskStatusTag } from './TaskStatusTag'
import { getTaskCenterPresentation } from './taskCenterPresentation'
import styles from './TaskCenterPage.module.scss'

const { Paragraph, Text, Title } = Typography

interface TaskContextPanelProps {
  run?: OrchestrationRun
}

export function TaskContextPanel({ run }: TaskContextPanelProps) {
  const presentation = run ? getTaskCenterPresentation(run) : undefined

  return (
    <aside className={styles.contextPanel} aria-label="任务上下文">
      <div className={styles.contextHeader}>
        <Text className={styles.contextId}>任务 ID：{run?.id ?? '—'}</Text>
        {run ? <TaskStatusTag status={run.status} /> : null}
        <Text type="secondary" className={styles.contextPlaceholder}>···</Text>
      </div>

      <Tabs
        className={styles.contextTabs}
        activeKey="context"
        items={[
          { key: 'context', label: '需求上下文', children: <ContextContent run={run} /> },
          { key: 'details', label: '任务详情', disabled: true, children: null },
          { key: 'logs', label: '执行记录', disabled: true, children: null },
        ]}
      />

      {!run ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择任务查看上下文" /> : null}
      {run && presentation ? (
        <div className={styles.contextFooter}>
          <Text type="secondary">执行主体</Text>
          <Space wrap>
            <Tag className={styles.roleTag}>{presentation.creatorLabel}</Tag>
            <Tag className={styles.roleTag}>Agent 编排</Tag>
          </Space>
        </div>
      ) : null}
    </aside>
  )
}

function ContextContent({ run }: { run?: OrchestrationRun }) {
  if (!run) return null

  const presentation = getTaskCenterPresentation(run)

  return (
    <div className={styles.contextContent}>
      <section>
        <Title level={5}>共享需求上下文</Title>
        <Text type="secondary" className={styles.contextLabel}>需求群</Text>
        <Text className={styles.contextValue}>{presentation.groupLabel}</Text>
        <Text type="secondary" className={styles.contextLabel}>需求描述</Text>
        <Paragraph ellipsis={{ rows: 4 }} className={styles.contextDescription}>
          {run.instruction}
        </Paragraph>
        <Text className={styles.contextLink}>查看完整需求</Text>
      </section>

      <Divider />

      <section>
        <Title level={5}>可选执行目标 <Text type="secondary">（只读）</Text></Title>
        <Text type="secondary" className={styles.contextLabel}>工作包</Text>
        <Space wrap>
          {run.workPackageIds.map((workPackageId) => (
            <Tag key={workPackageId}>{workPackageId}</Tag>
          ))}
        </Space>
        <Text type="secondary" className={styles.contextNote}>
          仓库、分支和验收标准将在交付阶段提供。
        </Text>
      </section>

      <Divider />

      <section>
        <Title level={5}>参与角色 <Text type="secondary">（只读）</Text></Title>
        <div className={styles.roleGrid}>
          <div className={styles.roleCard}>
            <Text type="secondary">发起人</Text>
            <Text strong>{presentation.creatorLabel}</Text>
          </div>
          <div className={styles.roleCard}>
            <Text type="secondary">Agent</Text>
            <Text strong>云端编排</Text>
          </div>
        </div>
      </section>

      <Text type="secondary" className={styles.contextNote}>
        步骤、日志和任务操作将在后续任务详情阶段提供。
      </Text>
    </div>
  )
}
