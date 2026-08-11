import { Empty, Row, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { OrchestrationRun } from '@/types'
import { TaskCard } from './TaskCard'
import { ORCHESTRATION_STATUS_META, type TaskCenterView } from './taskCenterConfig'
import { getTaskCenterPresentation } from './taskCenterPresentation'
import styles from './TaskCenterPage.module.scss'

interface TaskListProps {
  runs: OrchestrationRun[]
  view: TaskCenterView
  selectedRunId?: string
  onSelectRun: (runId: string) => void
}

export function TaskList({ runs, view, selectedRunId, onSelectRun }: TaskListProps) {
  if (runs.length === 0) return <Empty description="暂无匹配任务" className={styles.empty} />

  if (view === 'table') {
    const columns: ColumnsType<OrchestrationRun> = [
      { title: '任务', dataIndex: 'instruction', key: 'instruction', ellipsis: true },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: OrchestrationRun['status']) => {
          const meta = ORCHESTRATION_STATUS_META[status]
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '需求群',
        key: 'group',
        render: (_, run) => getTaskCenterPresentation(run).groupLabel,
      },
      { title: '工作包', key: 'workPackages', render: (_, run) => run.workPackageIds.length },
      {
        title: '发起人',
        key: 'creator',
        render: (_, run) => getTaskCenterPresentation(run).creatorLabel,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (updatedAt: string) => formatDate(updatedAt),
      },
    ]

    return (
      <Table
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={runs}
        pagination={false}
        scroll={{ x: 720 }}
        rowClassName={(run) => run.id === selectedRunId ? styles.tableRowSelected : ''}
        onRow={(run) => ({ onClick: () => onSelectRun(run.id) })}
      />
    )
  }

  return (
    <Row gutter={[16, 16]} className={styles.board}>
      {runs.map((run) => (
        <TaskCard
          key={run.id}
          run={run}
          selected={run.id === selectedRunId}
          onSelect={onSelectRun}
        />
      ))}
    </Row>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date)
}
