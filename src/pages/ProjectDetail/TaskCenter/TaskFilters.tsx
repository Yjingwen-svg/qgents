import { Button, Col, Input, Row, Select, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { TaskCenterStatusFilter } from './taskCenterConfig'
import { TASK_CENTER_STATUS_OPTIONS } from './taskCenterConfig'
import styles from './TaskCenterPage.module.scss'

const { Text } = Typography

interface TaskFiltersProps {
  status: TaskCenterStatusFilter
  groupId?: string
  repositoryId?: string
  createdBy?: string
  search?: string
  groupOptions: Array<{ label: string; value: string }>
  repositoryOptions: Array<{ label: string; value: string }>
  createdByOptions: Array<{ label: string; value: string }>
  onStatusChange: (value: TaskCenterStatusFilter) => void
  onGroupChange: (value: string | undefined) => void
  onRepositoryChange: (value: string | undefined) => void
  onCreatedByChange: (value: string | undefined) => void
  onSearchChange: (value: string) => void
  onReset: () => void
}

export function TaskFilters({
  status,
  groupId,
  repositoryId,
  createdBy,
  search,
  groupOptions,
  repositoryOptions,
  createdByOptions,
  onStatusChange,
  onGroupChange,
  onRepositoryChange,
  onCreatedByChange,
  onSearchChange,
  onReset,
}: TaskFiltersProps) {
  return (
    <Row gutter={[16, 12]} align="bottom" className={styles.filters}>
      <Col xs={24} sm={12} lg={6}>
        <Text type="secondary" className={styles.filterLabel}>需求群</Text>
        <Select aria-label="需求群筛选" allowClear placeholder="全部" value={groupId} options={groupOptions} onChange={onGroupChange} className={styles.filterControl} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Text type="secondary" className={styles.filterLabel}>创建人</Text>
        <Select aria-label="创建人筛选" allowClear placeholder="全部" value={createdBy} options={createdByOptions} onChange={onCreatedByChange} className={styles.filterControl} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Text type="secondary" className={styles.filterLabel}>仓库</Text>
        <Select aria-label="仓库筛选" allowClear placeholder="全部" value={repositoryId} options={repositoryOptions} onChange={onRepositoryChange} className={styles.filterControl} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Text type="secondary" className={styles.filterLabel}>状态</Text>
        <Space.Compact className={styles.statusAndReset}>
          <Select aria-label="状态筛选" value={status} options={TASK_CENTER_STATUS_OPTIONS} onChange={onStatusChange} className={styles.statusControl} />
          <Button aria-label="重置筛选" icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
        </Space.Compact>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Text type="secondary" className={styles.filterLabel}>搜索任务</Text>
        <Input aria-label="搜索任务" allowClear value={search} placeholder="编号、标题或需求说明" onChange={(event) => onSearchChange(event.target.value)} className={styles.searchControl} />
      </Col>
    </Row>
  )
}
