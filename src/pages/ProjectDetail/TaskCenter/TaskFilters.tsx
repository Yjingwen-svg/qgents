import { Button, Col, Input, Row, Select, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { TaskCenterStatusFilter } from './taskCenterConfig'
import { TASK_CENTER_STATUS_OPTIONS } from './taskCenterConfig'
import styles from './TaskCenterPage.module.scss'

const { Text } = Typography

interface TaskFiltersProps {
  status: TaskCenterStatusFilter
  groupId?: string
  createdBy?: string
  groupOptions: Array<{ label: string; value: string }>
  onStatusChange: (value: TaskCenterStatusFilter) => void
  onGroupChange: (value: string | undefined) => void
  onCreatedByChange: (value: string | undefined) => void
  onReset: () => void
}

export function TaskFilters({
  status,
  groupId,
  createdBy,
  groupOptions,
  onStatusChange,
  onGroupChange,
  onCreatedByChange,
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
        <Input aria-label="创建人筛选" allowClear placeholder="全部" value={createdBy} onChange={(event) => onCreatedByChange(event.target.value || undefined)} className={styles.filterControl} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Text type="secondary" className={styles.filterLabel}>状态</Text>
        <Select aria-label="状态筛选" value={status} options={TASK_CENTER_STATUS_OPTIONS} onChange={onStatusChange} className={styles.filterControl} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Space className={styles.statusAndReset}>
          <Button aria-label="重置筛选" icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
        </Space>
      </Col>
    </Row>
  )
}
