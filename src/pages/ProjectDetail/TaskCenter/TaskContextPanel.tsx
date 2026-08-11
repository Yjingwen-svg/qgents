import { Alert, Collapse, Descriptions, Divider, Empty, Progress, Result, Space, Spin, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ApiError } from '@/api'
import { useOrchestrationRun, useOrchestrationWorkPackages } from '@/hooks'
import type { OrchestrationRun, WorkPackage } from '@/types'
import { TaskStatusTag } from './TaskStatusTag'
import { getTaskCenterPresentation } from './taskCenterPresentation'
import { type TaskCenterPanel } from './taskCenterConfig'
import styles from './TaskCenterPage.module.scss'

const { Paragraph, Text, Title } = Typography

interface TaskContextPanelProps {
  projectId: string
  runId?: string
  summaryRun?: OrchestrationRun
  panel: TaskCenterPanel
  onPanelChange: (panel: TaskCenterPanel) => void
}

export function TaskContextPanel({
  projectId,
  runId,
  summaryRun,
  panel,
  onPanelChange,
}: TaskContextPanelProps) {
  const detailQuery = useOrchestrationRun(projectId, runId ?? '')
  const detailRun = detailQuery.data
  const headerRun = detailRun ?? summaryRun
  const presentation = headerRun ? getTaskCenterPresentation(headerRun) : undefined

  return (
    <aside className={styles.contextPanel} aria-label="任务上下文">
      <div className={styles.contextHeader}>
        <Text className={styles.contextId}>任务 ID：{runId ?? '—'}</Text>
        {headerRun ? <TaskStatusTag status={headerRun.status} /> : null}
        <Text type="secondary" className={styles.contextPlaceholder}>···</Text>
      </div>

      <Tabs
        className={styles.contextTabs}
        activeKey={panel}
        onChange={(key) => onPanelChange(parsePanelKey(key))}
        items={[
          {
            key: 'context',
            label: '需求上下文',
            children: (
              <ContextPanelContent
                run={headerRun}
                runId={runId}
                query={detailQuery}
              />
            ),
          },
          {
            key: 'detail',
            label: '任务详情',
            children: (
              <DetailPanelContent
                run={detailRun}
                runId={runId}
                query={detailQuery}
              />
            ),
          },
          {
            key: 'executions',
            label: '执行记录',
            children: <ExecutionsPlaceholder runId={runId} />,
          },
        ]}
      />

      {headerRun && presentation ? (
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

interface ContextPanelContentProps {
  run?: OrchestrationRun
  runId?: string
  query: ReturnType<typeof useOrchestrationRun>
}

function ContextPanelContent({ run, runId, query }: ContextPanelContentProps) {
  if (!run) return <PanelQueryState runId={runId} query={query} />

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
        {run.workPackageIds.length > 0 ? (
          <Space wrap>
            {run.workPackageIds.map((workPackageId) => <Tag key={workPackageId}>{workPackageId}</Tag>)}
          </Space>
        ) : (
          <Text type="secondary">暂无工作包</Text>
        )}
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
    </div>
  )
}

interface DetailPanelContentProps {
  run?: OrchestrationRun
  runId?: string
  query: ReturnType<typeof useOrchestrationRun>
}

function DetailPanelContent({ run, runId, query }: DetailPanelContentProps) {
  const workPackageQueries = useOrchestrationWorkPackages(run?.projectId ?? '', run?.workPackageIds ?? [])
  if (!run) return <PanelQueryState runId={runId} query={query} />

  const presentation = getTaskCenterPresentation(run)
  const workPackages = workPackageQueries.flatMap((result) => result.data ? [result.data] : [])
  const workPackagesLoading = workPackageQueries.some((result) => result.isLoading)
  const workPackagesFailed = workPackageQueries.some((result) => result.isError)

  return (
    <Spin spinning={query.isFetching && !query.isLoading}>
      <div className={styles.detailContent}>
        {query.isError ? (
          <Alert type="warning" showIcon title="任务详情刷新失败，已保留上次内容" className={styles.detailAlert} />
        ) : null}
        <section>
          <Title level={5}>编排详情</Title>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="编排 ID">{run.id}</Descriptions.Item>
            <Descriptions.Item label="instruction">{run.instruction}</Descriptions.Item>
            <Descriptions.Item label="状态"><TaskStatusTag status={run.status} /></Descriptions.Item>
            <Descriptions.Item label="发起人">{presentation.creatorLabel}</Descriptions.Item>
            <Descriptions.Item label="需求群">{presentation.groupLabel}</Descriptions.Item>
            <Descriptions.Item label="workflowId">{run.workflowId}</Descriptions.Item>
            <Descriptions.Item label="startMode">{run.startMode}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDateTime(run.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatDateTime(run.updatedAt)}</Descriptions.Item>
          </Descriptions>
          <Text type="secondary" className={styles.contextLabel}>总体进度（临时展示）</Text>
          <Progress percent={presentation.progressPercent} size="small" />
          {presentation.waitingLabel ? <Alert type="warning" showIcon title={presentation.waitingLabel} /> : null}
          {presentation.errorSummary ? <Alert type="error" showIcon title={presentation.errorSummary} /> : null}
        </section>

        <Divider />

        <section>
          <Title level={5}>工作包详情</Title>
          {workPackagesLoading && workPackages.length === 0 ? <Spin /> : null}
          {workPackagesFailed ? (
            <Alert type="warning" showIcon title="部分工作包详情暂时无法加载" className={styles.detailAlert} />
          ) : null}
          {run.workPackageIds.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作包" />
          ) : (
            <Collapse
              defaultActiveKey={run.workPackageIds[0]}
              items={workPackageQueries.map((result, index) => {
                const workPackage = result.data
                return {
                  key: workPackage?.id ?? run.workPackageIds[index],
                  label: workPackage?.title ?? run.workPackageIds[index],
                  children: workPackage ? <WorkPackageContent workPackage={workPackage} /> : <WorkPackageState result={result} />,
                }
              })}
              bordered={false}
              size="small"
            />
          )}
        </section>
      </div>
    </Spin>
  )
}

function WorkPackageContent({ workPackage }: { workPackage: WorkPackage }) {
  return (
    <div className={styles.workPackageContent}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="说明">{workPackage.description}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag>{workPackage.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="优先级">P{workPackage.priority}</Descriptions.Item>
        <Descriptions.Item label="repositoryId">{workPackage.repositoryId}</Descriptions.Item>
        <Descriptions.Item label="baseRef">{workPackage.baseRef}</Descriptions.Item>
        <Descriptions.Item label="headRef">{workPackage.headRef}</Descriptions.Item>
        <Descriptions.Item label="startMode">{workPackage.startMode}</Descriptions.Item>
        <Descriptions.Item label="Testset 摘要">
          {workPackage.testsetIds.length > 0 ? workPackage.testsetIds.join(', ') : '暂无 Testset'}
        </Descriptions.Item>
        <Descriptions.Item label="子任务数量">{workPackage.subtaskIds.length}</Descriptions.Item>
        <Descriptions.Item label="创建/更新时间">
          {formatDateTime(workPackage.createdAt)} / {formatDateTime(workPackage.updatedAt)}
        </Descriptions.Item>
      </Descriptions>
      <Title level={5}>子任务</Title>
      {workPackage.subtaskIds.length > 0 ? <SubtaskTable subtaskIds={workPackage.subtaskIds} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无子任务" />}
    </div>
  )
}

function SubtaskTable({ subtaskIds }: { subtaskIds: string[] }) {
  const columns: ColumnsType<{ id: string; order: number }> = [
    { title: '子任务', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '顺序', dataIndex: 'order', key: 'order', width: 48 },
    { title: '角色', key: 'role', render: () => <Text type="secondary">待接口字段</Text> },
    { title: '状态', key: 'status', render: () => <Text type="secondary">待接口字段</Text> },
  ]

  return (
    <Table
      aria-label="子任务列表"
      size="small"
      pagination={false}
      rowKey="id"
      columns={columns}
      dataSource={subtaskIds.map((id, index) => ({ id, order: index + 1 }))}
      scroll={{ x: 360 }}
    />
  )
}

function WorkPackageState({ result }: { result: ReturnType<typeof useOrchestrationWorkPackages>[number] }) {
  if (result.isLoading) return <Spin size="small" />
  return <Text type="secondary">工作包详情暂不可用</Text>
}

function PanelQueryState({
  runId,
  query,
}: {
  runId?: string
  query: ReturnType<typeof useOrchestrationRun>
}) {
  if (!runId) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择任务" />
  if (query.isLoading) return <div className={styles.panelState}><Spin description="正在加载任务详情" /></div>
  if (query.isError) return <PanelError error={query.error} />
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务详情" />
}

function PanelError({ error }: { error: Error | null }) {
  const status = error instanceof ApiError ? error.status : undefined
  return (
    <Result
      className={styles.panelResult}
      status={status === 403 ? '403' : status === 404 ? '404' : 'error'}
      title={status === 403 ? '暂无权限查看任务' : status === 404 ? '任务不存在或不可见' : '任务详情加载失败'}
      subTitle="未显示技术错误信息。"
    />
  )
}

function ExecutionsPlaceholder({ runId }: { runId?: string }) {
  return (
    <div className={styles.panelState}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={runId ? '执行记录将在后续 TaskRun 阶段提供' : '请选择任务'}
      />
    </div>
  )
}

function parsePanelKey(value: string): TaskCenterPanel {
  if (value === 'context' || value === 'detail' || value === 'executions') return value
  return 'context'
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
