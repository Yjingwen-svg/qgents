import { Empty, Row, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { OrchestrationRun } from '@/types'
import { ORCHESTRATION_STATUS_META, type TaskCenterView } from './taskCenterConfig'
import { TaskCard } from './TaskCard'
import { getTaskPresentation } from '../TaskShared/taskPresentation'
import styles from './TaskCenterPage.module.scss'

interface TaskListProps {
  runs: OrchestrationRun[]
  view: TaskCenterView
  selectedRunId?: string
  onSelectRun: (runId: string) => void
  onViewDetails: (runId: string) => void
}
export function TaskList({ runs, view, selectedRunId, onSelectRun, onViewDetails }: TaskListProps) {
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
      { title: '需求群', key: 'group', render: (_, run) => getTaskPresentation(run).groupLabel },
      { title: 'WorkPackage', key: 'workPackages', render: (_, run) => run.workPackageIds.length },
      { title: '发起人', key: 'creator', render: (_, run) => getTaskPresentation(run).creatorLabel },
      { title: '最近更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: formatDate },
      {
        title: '操作',
        key: 'actions',
        render: (_, run) => <a onClick={(event) => { event.stopPropagation(); onViewDetails(run.id) }}>查看详情</a>,
      },
    ]

    return (
      <Table
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={runs}
        pagination={false}
        scroll={{ x: 820 }}
        rowClassName={(run) => run.id === selectedRunId ? styles.tableRowSelected : ''}
        onRow={(run) => ({ onClick: () => onSelectRun(run.id) })}
      />
    )
  }

  return (
    <Row gutter={[16, 16]} className={styles.board}>
      {runs.map((run) => <TaskCard key={run.id} run={run} selected={run.id === selectedRunId} onSelect={onSelectRun} onViewDetails={onViewDetails} />)}
    </Row>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date)
}
