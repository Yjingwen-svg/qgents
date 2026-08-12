import { useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  InboxOutlined,
  CheckCircleFilled,
  CodeOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  MoreOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import {
  useAcceptDeliverable,
  useDeliverable,
  useOrchestrationRuns,
  useProjectDeliverables,
  useRejectDeliverable,
  useWorkPackages,
} from '@/hooks'
import type { Deliverable, DeliverableStatus, DeliverableType, OrchestrationRun, WorkPackage } from '@/types'
import { PATHS } from '@/routes/paths'
import styles from './DeliverablesPage.module.scss'

const { Text, Title } = Typography

type Filters = {
  groupId: string
  type: DeliverableType | ''
  repositoryId: string
  status: DeliverableStatus | ''
}

const INITIAL_FILTERS: Filters = { groupId: '', type: '', repositoryId: '', status: '' }

export function DeliverablesPage() {
  const { projectId = '', deliverableId } = useParams<{ projectId: string; deliverableId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const listQuery = useProjectDeliverables(projectId)
  const workPackagesQuery = useWorkPackages(projectId)
  const runsQuery = useOrchestrationRuns(projectId)
  const selectedQuery = useDeliverable(projectId, deliverableId ?? '')
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const isDetailRoute = Boolean(deliverableId)
  const deliverables = listQuery.data.data
  const workPackages = useMemo(() => workPackagesQuery.data?.data ?? [], [workPackagesQuery.data])
  const runs = useMemo(() => runsQuery.data?.data ?? [], [runsQuery.data])
  const workPackageById = useMemo(() => new Map(workPackages.map((workPackage) => [workPackage.id, workPackage])), [workPackages])
  const runById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs])
  const filteredDeliverables = useMemo(
    () => deliverables.filter((deliverable) => {
      const workPackage = workPackageById.get(deliverable.workPackageId)
      return (!filters.groupId || workPackage?.groupId === filters.groupId)
        && (!filters.type || deliverable.type === filters.type)
        && (!filters.repositoryId || deliverable.repositoryId === filters.repositoryId)
        && (!filters.status || deliverable.status === filters.status)
    }),
    [deliverables, filters, workPackageById],
  )
  const groups = useMemo(
    () => groupDeliverables(filteredDeliverables, workPackageById, runById),
    [filteredDeliverables, runById, workPackageById],
  )
  const selected = selectedQuery.data

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function selectDeliverable(id: string) {
    navigate(PATHS.projectDeliverable(projectId, id), { state: { from: `${location.pathname}${location.search}` } })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          {isDetailRoute ? (
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(PATHS.projectDeliverables(projectId))}>
              返回交付中心
            </Button>
          ) : null}
          <Title level={2}>交付中心</Title>
          <Text className={styles.subtitle}>按需求查看与管理所有交付物，支持审阅、验收与回溯</Text>
        </div>
        <Tooltip title="接口待提供">
          <Button disabled icon={<DownloadOutlined />}>导出汇总</Button>
        </Tooltip>
      </header>

      <section className={styles.filters} aria-label="交付物筛选">
        <FilterSelect label="需求群" value={filters.groupId} options={uniqueOptions(workPackages.map((workPackage) => ({ value: workPackage.groupId, label: groupLabel(workPackage, runById) })))} onChange={(value) => updateFilter('groupId', value)} />
        <FilterSelect label="交付类型" value={filters.type} options={typeOptions()} onChange={(value) => updateFilter('type', value as DeliverableType | '')} />
        <FilterSelect label="仓库" value={filters.repositoryId} options={uniqueOptions(deliverables.map((deliverable) => ({ value: deliverable.repositoryId ?? '', label: deliverable.repositoryId ?? '暂无' })).filter((option) => option.value))} onChange={(value) => updateFilter('repositoryId', value)} />
        <FilterSelect label="状态" value={filters.status} options={statusOptions()} onChange={(value) => updateFilter('status', value as DeliverableStatus | '')} />
        <Button className={styles.resetButton} onClick={() => setFilters(INITIAL_FILTERS)}>重置</Button>
      </section>

      <div className={styles.contentLayout}>
        <main className={styles.mainContent}>
          <DeliverableList
            query={listQuery}
            groups={groups}
            selectedId={deliverableId}
            workPackageById={workPackageById}
            onSelect={selectDeliverable}
          />
          <DisabledUploadArea />
        </main>
        <aside className={styles.sidebar} aria-label="交付摘要">
          {isDetailRoute ? (
            <DeliverableDetail query={selectedQuery} deliverable={selected} workPackageById={workPackageById} projectId={projectId} />
          ) : (
            <DeliverySummary deliverables={deliverables} workPackages={workPackages} selectedWorkPackage={undefined} />
          )}
        </aside>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className={styles.filterItem}>
      <Text type="secondary">{label}</Text>
      <Select aria-label={`${label}筛选`} value={value} onChange={onChange} options={[{ value: '', label: label === '状态' ? '全部状态' : label === '交付类型' ? '全部' : label === '仓库' ? '全部仓库' : '全部需求群' }, ...options]} />
    </label>
  )
}

type DeliverableGroup = {
  key: string
  label: string
  branch: string
  creator: string
  createdAt: string
  workPackage?: WorkPackage
  run?: OrchestrationRun
  deliverables: Deliverable[]
}

function groupDeliverables(deliverables: Deliverable[], workPackageById: Map<string, WorkPackage>, runById: Map<string, OrchestrationRun>): DeliverableGroup[] {
  const groups = new Map<string, DeliverableGroup>()
  for (const deliverable of deliverables) {
    const workPackage = workPackageById.get(deliverable.workPackageId)
    const run = workPackage ? runById.get(workPackage.orchestrationRunId) : undefined
    const key = workPackage?.groupId ?? 'unknown'
    const existing = groups.get(key)
    if (existing) {
      existing.deliverables.push(deliverable)
      continue
    }
    groups.set(key, {
      key,
      label: workPackage ? groupLabel(workPackage, runById) : '暂无',
      branch: workPackage?.headRef ?? '暂无',
      creator: run?.createdBy ?? '暂无',
      createdAt: run?.createdAt ?? workPackage?.createdAt ?? '',
      workPackage,
      run,
      deliverables: [deliverable],
    })
  }
  return [...groups.values()]
}

function DeliverableList({ query, groups, selectedId, workPackageById, onSelect }: { query: ReturnType<typeof useProjectDeliverables>; groups: DeliverableGroup[]; selectedId?: string; workPackageById: Map<string, WorkPackage>; onSelect: (id: string) => void }) {
  if (query.isLoading) return <div className={styles.state}><Spin description="正在加载交付物" /></div>
  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : undefined
    return <Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={errorTitle(status, '交付物列表')} extra={<Button onClick={() => void query.refetch()}>重新加载</Button>} />
  }
  if (groups.length === 0) return <Empty description="当前项目暂无交付物" />
  return (
    <div className={styles.groupList}>
      {groups.map((group) => (
        <section className={styles.group} key={group.key} aria-label={`需求群 ${group.label}`}>
          <div className={styles.groupHeader}>
            <div>
              <Title level={4}>{group.label}</Title>
              <Text type="secondary">{group.branch} · 创建者：{group.creator} · 创建于 {formatDate(group.createdAt)}</Text>
            </div>
            <Text type="secondary">{group.deliverables.length} 个交付物</Text>
          </div>
          <div className={styles.rows}>
            {group.deliverables.map((deliverable) => (
              <DeliverableRow key={deliverable.id} deliverable={deliverable} selected={selectedId === deliverable.id} workPackage={workPackageById.get(deliverable.workPackageId)} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function DeliverableRow({ deliverable, selected, workPackage, onSelect }: { deliverable: Deliverable; selected: boolean; workPackage?: WorkPackage; onSelect: (id: string) => void }) {
  return (
    <article className={`${styles.row} ${selected ? styles.rowSelected : ''}`}>
      <TypeBadge type={deliverable.type} />
      <div className={styles.rowMain}>
        <div className={styles.titleLine}>
          <Button type="link" className={styles.titleButton} onClick={() => onSelect(deliverable.id)}>{deliverable.title}</Button>
          <Tag color="blue">v{deliverable.version}</Tag>
        </div>
        <Text className={styles.repoLine}>{deliverable.repositoryId ?? '暂无'} / {deliverable.sourceRef ?? '暂无'}</Text>
        <Text type="secondary" className={styles.sourceLine}>来源任务：{deliverable.taskRunId || '暂无'} · WorkPackage：{workPackage?.title ?? '暂无'}</Text>
      </div>
      <div className={styles.contributor}><Text type="secondary">提交者</Text><Text>暂无</Text><Text type="secondary">{formatDate(deliverable.updatedAt)}</Text></div>
      <div className={styles.statusCell}><Tag color={statusColor(deliverable.status)}>{statusLabel(deliverable.status)}</Tag><Text type="secondary">更新时间 {formatDate(deliverable.updatedAt)}</Text></div>
      <div className={styles.rowActions}>
        <Button size="small" onClick={() => onSelect(deliverable.id)}>查看详情</Button>
        <DeliverableAcceptance deliverable={deliverable} />
        <Tooltip title="更多能力待提供"><Button size="small" disabled icon={<MoreOutlined />} aria-label="更多操作" /></Tooltip>
      </div>
    </article>
  )
}

function DeliverableDetail({ query, deliverable, workPackageById, projectId }: { query: ReturnType<typeof useDeliverable>; deliverable?: Deliverable; workPackageById: Map<string, WorkPackage>; projectId: string }) {
  const navigate = useNavigate()
  if (query.isLoading) return <div className={styles.state}><Spin description="正在加载交付物详情" /></div>
  if (query.isError || !deliverable) {
    const status = query.error instanceof ApiError ? query.error.status : undefined
    return <Result status={status === 403 ? '403' : status === 404 ? '404' : 'error'} title={errorTitle(status, '交付物')} />
  }
  const workPackage = workPackageById.get(deliverable.workPackageId)
  return (
    <Card className={styles.detailCard} title={<span><FileTextOutlined /> {deliverable.title}</span>} extra={<Tag color={statusColor(deliverable.status)}>{statusLabel(deliverable.status)}</Tag>}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="类型">{deliverable.type || '暂无'}</Descriptions.Item>
        <Descriptions.Item label="版本">{deliverable.version ?? '暂无'}</Descriptions.Item>
        <Descriptions.Item label="WorkPackage">{workPackage?.title ?? deliverable.workPackageId ?? '暂无'}</Descriptions.Item>
        <Descriptions.Item label="TaskRun">{deliverable.taskRunId || '暂无'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">{formatDate(deliverable.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="更新时间">{formatDate(deliverable.updatedAt)}</Descriptions.Item>
        <Descriptions.Item label="仓库">{deliverable.repositoryId ?? '暂无'}</Descriptions.Item>
        <Descriptions.Item label="分支">{deliverable.sourceRef ?? '暂无'}</Descriptions.Item>
        <Descriptions.Item label="检查摘要">{deliverable.diffId ?? '暂无'}</Descriptions.Item>
        <Descriptions.Item label="摘要">{deliverable.summary ?? '暂无'}</Descriptions.Item>
        <Descriptions.Item label="验收结果">{acceptanceResult(deliverable)}</Descriptions.Item>
      </Descriptions>
      <DeliverableAcceptance deliverable={deliverable} refresh={query.refetch} />
      <Tooltip title="接口待提供"><Button block disabled icon={<SearchOutlined />} className={styles.previewButton}>预览能力待提供</Button></Tooltip>
      <Text type="secondary" className={styles.detailNote}>项目级汇总、检查明细、导出和上传接口待提供。</Text>
      <Button type="link" onClick={() => navigate(PATHS.projectDeliverables(projectId))} className={styles.backLink}>返回交付中心</Button>
      <span className={styles.detailPathHint}>{projectId}</span>
    </Card>
  )
}

function DeliverySummary({ deliverables, workPackages, selectedWorkPackage }: { deliverables: Deliverable[]; workPackages: WorkPackage[]; selectedWorkPackage?: WorkPackage }) {
  const accepted = deliverables.filter((deliverable) => deliverable.status === 'ACCEPTED').length
  const pending = deliverables.filter((deliverable) => deliverable.status === 'PENDING_REVIEW').length
  const rejected = deliverables.filter((deliverable) => deliverable.status === 'REJECTED').length
  const repositories = [...new Set(deliverables.map((deliverable) => deliverable.repositoryId).filter((repositoryId): repositoryId is string => Boolean(repositoryId)))]
  return (
    <div className={styles.summaryStack}>
      <SummaryCard title="需求交付概览" icon={<InboxOutlined />}>
        <div className={styles.overviewNumber}>{deliverables.length}<Text>总交付物</Text></div>
        <div className={styles.statusLegend}><Legend color="green" label="已验收" value={accepted} /><Legend color="purple" label="待审阅" value={pending} /><Legend color="orange" label="已拒绝" value={rejected} /></div>
      </SummaryCard>
      <SummaryCard title="仓库交付状态" icon={<DatabaseOutlined />} extra={`${repositories.length} 个仓库`}>
        {repositories.length === 0 ? <SummaryEmpty /> : repositories.map((repositoryId) => {
          const repositoryDeliverables = deliverables.filter((deliverable) => deliverable.repositoryId === repositoryId)
          const repositoryAccepted = repositoryDeliverables.filter((deliverable) => deliverable.status === 'ACCEPTED').length
          return <div className={styles.repositoryRow} key={repositoryId}><Text strong>{repositoryId}</Text><Text>{repositoryAccepted}/{repositoryDeliverables.length} 已验收</Text><Text type="secondary">MR：暂无</Text></div>
        })}
      </SummaryCard>
      <SummaryCard title="验收清单（需求级）" icon={<CheckCircleFilled />} extra="暂无">
        <SummaryEmpty text="暂无验收清单" />
      </SummaryCard>
      <SummaryCard title="需求信息" icon={<FileTextOutlined />}>
        <InfoLine label="需求群" value={selectedWorkPackage?.groupId ?? '暂无'} />
        <InfoLine label="创建者" value="暂无" />
        <InfoLine label="创建时间" value={formatDate(selectedWorkPackage?.createdAt)} />
        <InfoLine label="最后更新" value={formatDate(selectedWorkPackage?.updatedAt)} />
        <InfoLine label="WorkPackage" value={workPackages.length ? `${workPackages.length} 个` : '暂无'} />
      </SummaryCard>
    </div>
  )
}

function SummaryCard({ title, icon, extra, children }: { title: string; icon: ReactNode; extra?: string; children: ReactNode }) {
  return <section className={styles.summaryCard}><div className={styles.summaryHeader}><Title level={4}>{icon} {title}</Title>{extra ? <Text>{extra}</Text> : null}</div>{children}</section>
}

function SummaryEmpty({ text = '暂无数据' }: { text?: string }) { return <div className={styles.summaryEmpty}>{text}</div> }
function Legend({ color, label, value }: { color: string; label: string; value: number }) { return <div><span className={`${styles.legendDot} ${styles[color]}`} />{label}<Text strong>{value}</Text></div> }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className={styles.infoLine}><Text type="secondary">{label}</Text><Text>{value}</Text></div> }

function TypeBadge({ type }: { type: DeliverableType }) {
  const meta = typeMeta(type)
  return <div className={`${styles.typeBadge} ${styles[meta.className]}`}><span className={styles.typeIcon}>{meta.icon}</span><Text>{meta.label}</Text></div>
}

function DeliverableAcceptance({ deliverable, refresh }: { deliverable: Deliverable; refresh?: () => Promise<unknown> }) {
  const acceptMutation = useAcceptDeliverable(deliverable.projectId)
  const rejectMutation = useRejectDeliverable(deliverable.projectId)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [form] = Form.useForm<{ reason: string }>()
  const isMutating = acceptMutation.isPending || rejectMutation.isPending
  const operationError = acceptMutation.error ?? rejectMutation.error

  function accept() {
    Modal.confirm({
      title: '确认接受交付物？',
      content: '接受后将不能再次进行验收操作。',
      onOk: () => new Promise<void>((resolve, reject) => {
        acceptMutation.mutate({ deliverableId: deliverable.id }, { onSuccess: () => resolve(), onError: (error) => { if (error instanceof ApiError && error.status === 409 && refresh) void refresh(); reject(error) } })
      }),
    })
  }

  function rejectDeliverable(values: { reason: string }) {
    setRejectReason(values.reason)
    rejectMutation.mutate({ deliverableId: deliverable.id, input: { reason: values.reason.trim() } }, { onSuccess: () => setRejectOpen(false), onError: (error) => { if (error instanceof ApiError && error.status === 409 && refresh) void refresh() } })
  }

  if (deliverable.status !== 'PENDING_REVIEW') {
    return <Text type="secondary" className={styles.readOnlyResult}>{acceptanceResult(deliverable)}</Text>
  }
  return (
    <div className={styles.acceptanceArea}>
      {operationError ? <OperationError error={operationError} /> : null}
      <Space wrap>
        <Button aria-label="接受交付物" size="small" type="primary" loading={acceptMutation.isPending} disabled={isMutating} onClick={accept}>接受</Button>
        <Button aria-label="拒绝交付物" size="small" danger loading={rejectMutation.isPending} disabled={isMutating} onClick={() => { form.setFieldsValue({ reason: rejectReason }); setRejectOpen(true) }}>拒绝</Button>
      </Space>
      <Modal title="拒绝交付物" open={rejectOpen} onCancel={() => setRejectOpen(false)} destroyOnHidden footer={null}>
        <Form form={form} layout="vertical" onFinish={rejectDeliverable} preserve>
          <Form.Item name="reason" label="拒绝原因" rules={[{ required: true, whitespace: true, message: '请填写拒绝原因' }]}><Input.TextArea rows={4} placeholder="请输入拒绝原因" /></Form.Item>
          {rejectMutation.error ? <OperationError error={rejectMutation.error} /> : null}
          <Space><Button onClick={() => setRejectOpen(false)}>取消</Button><Button type="primary" danger htmlType="submit" loading={isMutating} disabled={isMutating}>确认拒绝</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}

function OperationError({ error }: { error: Error }) { const status = error instanceof ApiError ? error.status : undefined; return <Alert className={styles.operationError} type="error" showIcon title={status === 409 ? '状态已被其他用户处理，请刷新最新状态' : errorTitle(status, '验收操作')} /> }
function DisabledUploadArea() { return <Tooltip title="接口待提供"><button type="button" className={styles.uploadArea} disabled><UploadOutlined /><span>上传交付物</span><Text>接口待提供 · 暂不支持真实上传</Text></button></Tooltip> }
function groupLabel(workPackage: WorkPackage, runById: Map<string, OrchestrationRun>): string { return runById.get(workPackage.orchestrationRunId)?.taskCenterSummary?.requirementGroupName ?? '暂无' }
function uniqueOptions(options: Array<{ value: string; label: string }>): Array<{ value: string; label: string }> { return [...new Map(options.map((option) => [option.value, option])).values()] }
function typeOptions(): Array<{ value: string; label: string }> { return [{ value: 'CODE', label: '代码' }, { value: 'DOCUMENT', label: '文档' }, { value: 'TEST_REPORT', label: '测试报告' }] }
function statusOptions(): Array<{ value: string; label: string }> { return [{ value: 'PENDING_REVIEW', label: '待验收' }, { value: 'ACCEPTED', label: '已接受' }, { value: 'REJECTED', label: '已拒绝' }] }
function statusLabel(status: DeliverableStatus): string { return status === 'PENDING_REVIEW' ? '待验收' : status === 'ACCEPTED' ? '已接受' : '已拒绝' }
function statusColor(status: DeliverableStatus): string { return status === 'ACCEPTED' ? 'success' : status === 'REJECTED' ? 'error' : 'processing' }
function acceptanceResult(deliverable: Deliverable): string { return deliverable.status === 'ACCEPTED' ? '已接受' : deliverable.status === 'REJECTED' ? `已拒绝：${deliverable.rejectionReason ?? '暂无'}` : '待验收' }
function errorTitle(status: number | undefined, resource: string): string { if (status === 403) return `暂无权限查看${resource}`; if (status === 404) return `${resource}不存在或不可见`; if (status === 409) return '状态已变化，请刷新最新状态'; if (status === 422) return '请求不合法，请检查输入'; return `${resource}加载失败` }
function formatDate(value: string | null | undefined): string { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function typeMeta(type: DeliverableType): { label: string; className: string; icon: ReactNode } { if (type === 'CODE') return { label: '代码', className: 'code', icon: <CodeOutlined /> }; if (type === 'TEST_REPORT') return { label: '测试', className: 'report', icon: <FilePdfOutlined /> }; return { label: '文档', className: 'document', icon: <FileTextOutlined /> } }
