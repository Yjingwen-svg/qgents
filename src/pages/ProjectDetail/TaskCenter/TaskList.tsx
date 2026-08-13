import { Empty, Row, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Task } from '@/types/task-model'
import { TaskModelStatusTag } from './TaskModelStatusTag'
import type { TaskCenterView } from './taskCenterConfig'
import { TaskCard } from './TaskCard'
import { valueOrNone } from './taskDisplay'
import styles from './TaskCenterPage.module.scss'

interface TaskListProps {
  tasks: Task[]
  view: TaskCenterView
  selectedTaskId?: string
  onSelectTask: (taskId: string) => void
  onViewDetails: (taskId: string) => void
}

export function TaskList({ tasks, view, selectedTaskId, onSelectTask, onViewDetails }: TaskListProps) {
  if (tasks.length === 0) return <Empty description="暂无匹配任务" className={styles.empty} />

  if (view === 'table') {
    const columns: ColumnsType<Task> = [
      { title: '任务', key: 'title', render: (_, task) => valueOrNone(task.title), ellipsis: true },
      { title: '状态', key: 'status', render: (_, task) => <TaskModelStatusTag status={task.status} /> },
      { title: '需求群', key: 'requirementGroupId', render: (_, task) => valueOrNone(task.requirementGroupId) },
      { title: '创建人', key: 'createdBy', render: (_, task) => valueOrNone(task.createdBy) },
      { title: '更新时间', key: 'updatedAt', render: (_, task) => valueOrNone(task.updatedAt) },
      { title: '详情', key: 'details', render: (_, task) => <a onClick={(event) => { event.stopPropagation(); onViewDetails(task.id) }}>查看完整任务详情</a> },
    ]
    return (
      <Table
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={tasks}
        pagination={false}
        scroll={{ x: 820 }}
        rowClassName={(task) => task.id === selectedTaskId ? styles.tableRowSelected : ''}
        onRow={(task) => ({ onClick: () => onSelectTask(task.id) })}
      />
    )
  }

  return <Row gutter={[16, 16]} className={styles.board}>
    {tasks.map((task) => <TaskCard key={task.id} task={task} selected={task.id === selectedTaskId} onSelect={onSelectTask} onViewDetails={onViewDetails} />)}
  </Row>
}
