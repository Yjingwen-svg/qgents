import { useMemo, useState, type ReactNode } from 'react'
import { useInfiniteDeliveryItems, useDeliveryActionMutation, useDeliverySummary } from '@/hooks/delivery-center'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, Empty, Form, Input, Result, Select, Skeleton, Tag, Typography, Modal } from 'antd'
import {
  CheckCircleOutlined,
  CheckOutlined,
  CodeOutlined,
  CloudUploadOutlined,
  CloseOutlined,
  DownOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InboxOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SettingOutlined,
  TagsOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, groupApi, githubApi } from '@/api'
import { PATHS } from '@/routes/paths'
import type {
  CodeDeliveryItem,
  DeliveryAction,
  DeliveryDisplayStatus,
  DeliveryItem,
  DeliveryResourceType,
  MemoryDeliveryItem,
  SkillDeliveryItem,
} from '@/types/delivery-center'
import styles from './DeliveryCenterPage.module.scss'

const { Text, Title } = Typography

const STATUS_LABELS: Record<DeliveryDisplayStatus, string> = {
  DRAFT: '草稿中',
  PENDING_REVIEW: '待审核',
  PROCESSING: '处理中',
  ACCEPTED: '已接受',
  REJECTED: '已拒绝',
  DELIVERED: '已交付',
  FAILED: '交付失败',
  ARCHIVED: '已归档',
}

const STATUS_COLORS: Record<DeliveryDisplayStatus, string> = {
  DRAFT: 'default',
  PENDING_REVIEW: 'purple',
  PROCESSING: 'orange',
  ACCEPTED: 'green',
  REJECTED: 'red',
  DELIVERED: 'green',
  FAILED: 'red',
  ARCHIVED: 'default',
}

const TYPE_LABELS: Record<DeliveryResourceType, string> = { CODE: 'CODE', MEMORY: 'MEMORY', SKILL: 'SKILL' }
const TYPE_COLORS: Record<DeliveryResourceType, string> = { CODE: '#0d9b8a', MEMORY: '#7c55d9', SKILL: '#e79216' }
const PAGE_SIZE = 5

/** 交付动作成功提示文案 */
const ACTION_SUCCESS_TEXT: Record<DeliveryAction, string> = {
  submitReview: '已提交审核，等待 Admin 批准',
  approve: '已批准并共享',
  reject: '已拒绝该交付',
  archive: '已归档',
  confirm: '已确认交付，正在执行仓库交付',
  retryDelivery: '已重新发起交付',
}

function formatDate(value: string | null): string {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function display(value: string | null | undefined): string {
  return value?.trim() ? value : '暂无'
}

function readType(value: string | null): DeliveryResourceType | undefined {
  return value === 'CODE' || value === 'MEMORY' || value === 'SKILL' ? value : undefined
}

function readStatus(value: string | null): DeliveryDisplayStatus | undefined {
  return value && value in STATUS_LABELS ? value as DeliveryDisplayStatus : undefined
}

function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return '操作失败，请稍后重试'
  if (error.status === 403) return '无权限执行此操作'
  if (error.status === 404) return '关联资源不存在或不可见'
  if (error.status === 409) return '资源状态已变化，已刷新最新数据'
  if (error.status === 422) return '参数无效或当前状态不可操作'
  return error.message || '操作失败，请稍后重试'
}

export default function DeliveryCenterPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [rejectTarget, setRejectTarget] = useState<DeliveryItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<DeliveryItem | null>(null)

  const filters = useMemo(() => ({
    groupId: searchParams.get('groupId') || undefined,
    type: readType(searchParams.get('type')),
    repositoryId: searchParams.get('repositoryId') || undefined,
    status: readStatus(searchParams.get('status')),
    createdBy: searchParams.get('createdBy') || undefined,
    keyword: searchParams.get('keyword') || undefined,
  }), [searchParams])

  const itemQuery = useInfiniteDeliveryItems(projectId, { ...filters, limit: PAGE_SIZE })
  const summaryQuery = useDeliverySummary(projectId, {
    groupId: filters.groupId,
    type: filters.type,
    status: filters.status,
    repositoryId: filters.repositoryId,
    createdBy: filters.createdBy,
    keyword: filters.keyword,
  })
  const actionMutation = useDeliveryActionMutation()

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: Boolean(projectId),
  })
  const { data: repositories = [] } = useQuery({
    queryKey: ['qgents', 'projects', projectId, 'repositories'],
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  const items = useMemo(() => {
    const seen = new Map<string, DeliveryItem>()
    itemQuery.data?.pages.flatMap((page) => page.data).forEach((item) => seen.set(item.id, item))
    return [...seen.values()]
  }, [itemQuery.data])

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, { id: string | null; name: string; items: DeliveryItem[]; latestAt: string }>()
    for (const item of items) {
      const id = item.requirementGroup?.id ?? null
      const key = id ?? '__unassociated__'
      const group = grouped.get(key) ?? {
        id,
        name: item.requirementGroup?.name ?? '未关联需求群',
        items: [],
        latestAt: item.updatedAt || item.createdAt,
      }
      group.items.push(item)
      if (item.updatedAt > group.latestAt) group.latestAt = item.updatedAt
      grouped.set(key, group)
    }
    return [...grouped.values()].sort((left, right) => right.latestAt.localeCompare(left.latestAt))
  }, [items])

  function updateFilter(key: 'groupId' | 'type' | 'repositoryId' | 'status' | 'keyword', value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function resetFilters() {
    setSearchParams({}, { replace: true })
  }

  async function performAction(item: DeliveryItem, action: DeliveryAction, reason?: string) {
    if (actionMutation.isPending) return
    if (action === 'reject' && !reason?.trim()) {
      setActionErrors((current) => ({ ...current, [item.id]: '请填写拒绝原因' }))
      return
    }
    setActiveItemId(item.id)
    setActionErrors((current) => ({ ...current, [item.id]: '' }))
    try {
      await actionMutation.mutateAsync({ projectId, item, action, reason: reason?.trim() })
      setActiveItemId(null)
      // 操作成功提示（申请交付等），避免用户误以为无响应后重复提交
      message.success(ACTION_SUCCESS_TEXT[action] ?? '操作成功')
      if (rejectTarget?.id === item.id) {
        setRejectTarget(null)
        setRejectReason('')
      }
    } catch (error) {
      setActionErrors((current) => ({ ...current, [item.id]: errorText(error) }))
      setActiveItemId(null)
    }
  }

  function openReject(item: DeliveryItem) {
    setActionErrors((current) => ({ ...current, [item.id]: '' }))
    setRejectReason('')
    setRejectTarget(item)
  }

  function openResource(item: DeliveryItem) {
    if (!item.capabilities.canOpenResource) return
    // MEMORY/SKILL 在交付中心内直接弹详情窗，避免跳转后无高亮定位（最小改动）
    if (item.openTarget.kind === 'MEMORY' || item.openTarget.kind === 'SKILL') {
      setDetailTarget(item)
      return
    }
    switch (item.openTarget.kind) {
      case 'TASK_DIFF_REVIEW':
        navigate(`${PATHS.projectTaskDetail(projectId, item.openTarget.taskId)}?diffReviewBatchId=${encodeURIComponent(item.openTarget.diffReviewBatchId)}`)
        break
    }
  }

  const total = summaryQuery.data?.total ?? 0
  const hasMainError = itemQuery.isError

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Title level={2} className={styles.title}><InboxOutlined /> 交付中心</Title>
          <Text className={styles.subtitle}>按需求查看与管理所有交付物，支持审阅、验收与回溯</Text>
        </div>
      </header>

      <div className={styles.contentLayout}>
        <section className={styles.mainColumn}>
          <div className={styles.filterBar} aria-label="交付筛选">
            <FilterField label="搜索交付">
              <Input aria-label="搜索交付" allowClear value={filters.keyword} placeholder="标题、摘要或来源" onChange={(event) => updateFilter('keyword', event.target.value.trim() || undefined)} />
            </FilterField>
            <FilterField label="需求群">
              <Select
                aria-label="需求群"
                allowClear
                placeholder="全部需求群"
                value={filters.groupId}
                onChange={(value: string | undefined) => updateFilter('groupId', value)}
                options={groups.filter((group) => group.type === 'REQUIREMENT').map((group) => ({ label: group.title, value: group.id }))}
              />
            </FilterField>
            <FilterField label="交付类型">
              <Select aria-label="交付类型" placeholder="全部类型" value={filters.type} onChange={(value: DeliveryResourceType | undefined) => updateFilter('type', value)} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, value }))} />
            </FilterField>
            <FilterField label="仓库">
              <Select
                aria-label="仓库"
                value={filters.repositoryId}
                onChange={(value: string | undefined) => updateFilter('repositoryId', value)}
                placeholder="全部仓库"
                options={repositories.map((repository) => ({ label: repository.displayName ?? repository.fullName, value: repository.repositoryId }))}
              />
            </FilterField>
            <FilterField label="状态">
              <Select aria-label="状态" placeholder="全部状态" value={filters.status} onChange={(value: DeliveryDisplayStatus | undefined) => updateFilter('status', value)} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value }))} />
            </FilterField>
            <Button className={styles.resetButton} icon={<RollbackOutlined />} onClick={resetFilters}>重置筛选</Button>
          </div>

          <main className={styles.mainContent}>
            {hasMainError ? (
              <Result status={itemQuery.error instanceof ApiError && itemQuery.error.status === 403 ? '403' : itemQuery.error instanceof ApiError && itemQuery.error.status === 404 ? '404' : 'error'} title={errorText(itemQuery.error)} extra={<Button icon={<ReloadOutlined />} onClick={() => void itemQuery.refetch()}>重新加载</Button>} />
            ) : itemQuery.isLoading ? (
              <div className={styles.loadingStack}><Skeleton active /><Skeleton active /><Skeleton active /></div>
            ) : groupedItems.length === 0 ? (
              <Empty className={styles.empty} description="当前没有符合条件的交付物" />
            ) : (
              <div className={styles.groupList}>
                {groupedItems.map((group) => {
                  const key = group.id ?? '__unassociated__'
                  const collapsed = collapsedGroups.has(key)
                  return (
                    <section className={styles.groupSection} key={key}>
                      <button type="button" className={styles.groupHeader} onClick={() => setCollapsedGroups((current) => {
                        const next = new Set(current)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })} aria-expanded={!collapsed}>
                        <span className={styles.groupHeaderMain}><DownOutlined className={collapsed ? styles.chevronCollapsed : styles.chevron} /> <strong>{group.name}</strong><Text type="secondary">最近更新 {formatDate(group.latestAt)}</Text></span>
                        <span className={styles.groupCount}>{group.items.length} 个交付物</span>
                      </button>
                      {!collapsed && <div className={styles.itemList}>{group.items.map((item) => <DeliveryItemCard key={item.id} item={item} active={activeItemId === item.id} error={actionErrors[item.id]} onAction={performAction} onReject={openReject} onOpenResource={openResource} />)}</div>}
                    </section>
                  )
                })}
              </div>
            )}
            {!hasMainError && itemQuery.hasNextPage ? <Button className={styles.loadMore} loading={itemQuery.isFetchingNextPage} onClick={() => void itemQuery.fetchNextPage()}>加载更多</Button> : null}
          </main>
        </section>

        <DeliveryOverview summaryQuery={summaryQuery} total={total} groupId={filters.groupId} />
      </div>

      <Modal
        title="拒绝交付"
        open={Boolean(rejectTarget)}
        okText="确认拒绝"
        cancelText="取消"
        confirmLoading={actionMutation.isPending}
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        onCancel={() => setRejectTarget(null)}
        onOk={() => {
          if (rejectTarget) void performAction(rejectTarget, 'reject', rejectReason)
        }}
      >
        <Form layout="vertical">
          <Form.Item label="拒绝原因" required validateStatus={rejectTarget && actionErrors[rejectTarget.id] ? 'error' : undefined} help={rejectTarget ? actionErrors[rejectTarget.id] : undefined}>
            <Input.TextArea autoFocus value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="请说明需要修改的内容" maxLength={500} rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* MEMORY/SKILL 详情弹窗：交付中心内直接查看，避免跳转后无高亮定位 */}
      <Modal
        title={detailTarget ? detailTarget.title : ''}
        open={Boolean(detailTarget)}
        footer={null}
        onCancel={() => setDetailTarget(null)}
      >
        {detailTarget ? <DeliveryDetailModal item={detailTarget} /> : null}
      </Modal>
    </div>
  )
}

/** MEMORY/SKILL 分类中文映射 */
const MEMORY_CATEGORY_LABELS: Record<string, string> = {
  ENGINEERING_DECISION: '工程决策',
  PROCESS: '流程约定',
  GENERAL: '通用',
}

/** MEMORY/SKILL 交付详情弹窗内容（CODE 不经过此弹窗）；正文突出、属性收尾 */
function DeliveryDetailModal({ item }: { item: DeliveryItem }) {
  if (item.resourceType === 'CODE') return null
  const isMemory = item.resourceType === 'MEMORY'
  const sourceText = isMemory
    ? (item.sources ?? []).length > 0
      ? `来源消息 ${(item.sources ?? []).map((source) => display(source.messageId)).join('、')}`
      : '无关联来源'
    : item.source.taskId
      ? `来源 Task ${display(item.source.taskDisplayCode)}`
      : item.source.messageId
        ? `来源消息 ${item.source.messageId}`
        : '无关联来源'
  return (
    <div className={styles.detailModal}>
      <div className={styles.detailModalRow}>
        <Tag color={TYPE_COLORS[item.resourceType]}>{TYPE_LABELS[item.resourceType]}</Tag>
        <Tag color={STATUS_COLORS[item.displayStatus]}>{STATUS_LABELS[item.displayStatus]}</Tag>
      </div>
      {/* 正文：主要信息，正常字号深色展示 */}
      <div className={styles.detailModalBody}>{display(item.contentExcerpt)}</div>
      {(item.tags ?? []).length > 0 ? <Tags tags={item.tags} /> : null}
      {/* 属性：次要信息收尾展示 */}
      <div className={styles.detailModalMeta}>
        <div><span>分类</span><b>{isMemory ? MEMORY_CATEGORY_LABELS[item.category] ?? item.category : '—'}</b></div>
        <div><span>可见性</span><b>{item.visibility}</b></div>
        <div><span>资源状态</span><b>{item.resourceStatus}</b></div>
        <div><span>来源</span><b>{sourceText}</b></div>
        <div><span>创建人</span><b>{item.creator?.displayName ?? '未知'}</b></div>
        <div><span>创建时间</span><b>{formatDate(item.createdAt)}</b></div>
        <div><span>提交人</span><b>{item.submitter?.displayName ?? '暂无'}</b></div>
        <div><span>提交时间</span><b>{formatDate(item.submittedAt)}</b></div>
        <div><span>审核人</span><b>{item.reviewer?.displayName ?? '暂无'}</b></div>
        <div><span>更新时间</span><b>{formatDate(item.updatedAt)}</b></div>
      </div>
      {item.reviewReason ? (
        <div className={styles.reviewReason}><WarningOutlined /> {item.reviewReason}</div>
      ) : null}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.filterField}><span>{label}</span>{children}</label>
}

function DeliveryItemCard({
  item,
  active,
  error,
  onAction,
  onReject,
  onOpenResource,
}: {
  item: DeliveryItem
  active: boolean
  error?: string
  onAction: (item: DeliveryItem, action: DeliveryAction, reason?: string) => Promise<void>
  onReject: (item: DeliveryItem) => void
  onOpenResource: (item: DeliveryItem) => void
}) {
  return (
    <article id={`delivery-item-${item.id}`} className={styles.itemCard}>
      <div className={styles.itemIcon} style={{ background: TYPE_COLORS[item.resourceType] }}>
        {item.resourceType === 'CODE' ? <CodeOutlined /> : item.resourceType === 'MEMORY' ? <FileTextOutlined /> : <SafetyCertificateOutlined />}
        <small>{TYPE_LABELS[item.resourceType]}</small>
      </div>
      <div className={styles.itemBody}>
        <div className={styles.itemTitleRow}><div><strong>{item.title}</strong>{item.version ? <Tag className={styles.versionTag}>{item.version}</Tag> : null}</div><Tag color={STATUS_COLORS[item.displayStatus]}>{STATUS_LABELS[item.displayStatus]}</Tag></div>
        <div className={styles.itemSummary}>{item.resourceType === 'CODE' ? <CodeDetails item={item} /> : item.resourceType === 'MEMORY' ? <MemoryDetails item={item} /> : <SkillDetails item={item} />}</div>
        <div className={styles.itemFooter}><span><UserOutlined /> {item.creator?.displayName ?? '未知'}</span><span>创建于 {formatDate(item.createdAt)}</span>{item.submittedAt ? <span>提交于 {formatDate(item.submittedAt)}</span> : null}{item.reviewer ? <span>审核者 {item.reviewer.displayName}</span> : null}</div>
        {item.reviewReason ? <div className={styles.reviewReason}><WarningOutlined /> {item.reviewReason}</div> : null}
        <div className={styles.itemActions}>
          {item.resourceType === 'CODE' ? <CodeActions item={item} active={active} onAction={onAction} onReject={onReject} onOpenResource={onOpenResource} /> : <ResourceActions item={item} active={active} onAction={onAction} onReject={onReject} onOpenResource={onOpenResource} />}
        </div>
        {error ? <Alert className={styles.itemError} type="error" showIcon message={error} /> : null}
      </div>
    </article>
  )
}

function CodeDetails({ item }: { item: CodeDeliveryItem }) {
  return <><div className={styles.detailLine}><span><CloudUploadOutlined /> {item.repositories.map((repository) => `${repository.name} / ${display(repository.branch)}`).join('、') || '暂无仓库'}</span><span>来源 Task {display(item.source.taskDisplayCode)} / {display(item.source.taskTitle)}</span></div><div className={styles.detailLine}><span>Diff {item.filesChanged} 文件 · <b className={styles.additions}>+{item.additions}</b> <b className={styles.deletions}>-{item.deletions}</b></span><span>Review {item.reviewStatus} · Delivery {item.deliveryStatus}</span></div>{item.repositoryDeliveries.length > 1 ? <div className={styles.repositoryStrip}>{item.repositoryDeliveries.map((delivery) => <span key={delivery.repositoryId}>{delivery.repositoryName}: {delivery.deliveryStatus}</span>)}</div> : null}{item.mergeRequest ? <div className={styles.mrLine}>MR #{item.mergeRequest.number} · {item.mergeRequest.title}</div> : null}</>
}

function MemoryDetails({ item }: { item: MemoryDeliveryItem }) {
  return <><div className={styles.detailLine}><span><FileTextOutlined /> {item.category} · {item.visibility} · {item.resourceStatus}</span><span>{(item.sources ?? []).length > 0 ? `来源消息 ${(item.sources ?? []).map((source) => display(source.messageId)).join('、')}` : '无关联来源'}</span></div><div className={styles.excerpt}>{display(item.contentExcerpt)}</div><Tags tags={item.tags} /></>
}

function SkillDetails({ item }: { item: SkillDeliveryItem }) {
  return <><div className={styles.detailLine}><span><SafetyCertificateOutlined /> {item.visibility} · {item.resourceStatus}</span><span>{item.source.taskId ? `来源 Task ${display(item.source.taskDisplayCode)}` : item.source.messageId ? `来源消息 ${item.source.messageId}` : '无关联来源'}</span></div><div className={styles.excerpt}>{display(item.capabilitySummary ?? item.contentExcerpt)}</div><Tags tags={item.tags} /></>
}

function Tags({ tags }: { tags: string[] }) {
  return <span className={styles.tags}>{(tags ?? []).map((tag) => <Tag key={tag} icon={<TagsOutlined />}>{tag}</Tag>)}</span>
}

function ResourceActions({ item, active, onAction, onReject, onOpenResource }: { item: MemoryDeliveryItem | SkillDeliveryItem; active: boolean; onAction: (item: DeliveryItem, action: DeliveryAction) => Promise<void>; onReject: (item: DeliveryItem) => void; onOpenResource: (item: DeliveryItem) => void }) {
  return <>
    {item.capabilities.canOpenResource ? <Button size="small" icon={<GlobalOutlined />} onClick={() => onOpenResource(item)}>查看详情</Button> : null}
    {item.capabilities.canSubmitReview ? <Button size="small" type="primary" icon={<SendOutlined />} loading={active} disabled={active} onClick={() => void onAction(item, 'submitReview')}>申请交付</Button> : null}
    {item.capabilities.canApprove ? <Button size="small" type="primary" icon={<CheckOutlined />} loading={active} disabled={active} onClick={() => void onAction(item, 'approve')}>批准并共享</Button> : null}
    {item.capabilities.canReject ? <Button size="small" danger icon={<CloseOutlined />} disabled={active} onClick={() => onReject(item)}>拒绝</Button> : null}
    {item.capabilities.canArchive ? <Button size="small" icon={<InboxOutlined />} loading={active} disabled={active} onClick={() => void onAction(item, 'archive')}>归档</Button> : null}
  </>
}

function CodeActions({ item, active, onAction, onReject, onOpenResource }: { item: CodeDeliveryItem; active: boolean; onAction: (item: DeliveryItem, action: DeliveryAction) => Promise<void>; onReject: (item: DeliveryItem) => void; onOpenResource: (item: DeliveryItem) => void }) {
  return <>
    {item.capabilities.canOpenResource ? <Button size="small" icon={<CodeOutlined />} onClick={() => onOpenResource(item)}>查看 Diff</Button> : null}
    {item.capabilities.canApprove ? <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={active} disabled={active} onClick={() => void onAction(item, 'confirm')}>确认交付</Button> : null}
    {item.capabilities.canReject ? <Button size="small" danger icon={<CloseOutlined />} disabled={active} onClick={() => onReject(item)}>拒绝</Button> : null}
    {item.capabilities.canRetryDelivery ? <Button size="small" icon={<ReloadOutlined />} loading={active} disabled={active} onClick={() => void onAction(item, 'retryDelivery')}>重试交付</Button> : null}
  </>
}

function DeliveryOverview({ summaryQuery, total, groupId }: { summaryQuery: ReturnType<typeof useDeliverySummary>; total: number; groupId?: string }) {
  if (summaryQuery.isLoading) return <aside className={styles.sidebar}><Card className={styles.overviewCard}><Skeleton active /></Card><Card className={styles.overviewCard}><Skeleton active /></Card></aside>
  if (summaryQuery.isError || !summaryQuery.data) return <aside className={styles.sidebar}><Card className={styles.overviewCard}><Alert type="error" showIcon message="交付概览加载失败" description={errorText(summaryQuery.error)} action={<Button size="small" onClick={() => void summaryQuery.refetch()}>重试</Button>} /></Card><Card className={styles.overviewCard}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="仓库数据不可用" /></Card></aside>

  const { countsByStatus, repositorySummaries, requirementGroupSummaries } = summaryQuery.data
  const accepted = (countsByStatus.ACCEPTED ?? 0) + (countsByStatus.DELIVERED ?? 0)
  const processing = countsByStatus.PROCESSING ?? 0
  const failed = countsByStatus.FAILED ?? 0
  const pending = countsByStatus.PENDING_REVIEW ?? 0
  const draft = countsByStatus.DRAFT ?? 0
  const archived = countsByStatus.ARCHIVED ?? 0
  const chartTotal = Math.max(total, 1)
  const acceptedDeg = accepted / chartTotal * 360
  const pendingDeg = acceptedDeg + pending / chartTotal * 360
  const processingDeg = pendingDeg + processing / chartTotal * 360
  return <aside className={styles.sidebar}>
    <Card className={styles.overviewCard} title="交付概览">
      <div className={styles.chartRow}><div className={styles.donut} style={{ background: `conic-gradient(#45bb73 0deg ${acceptedDeg}deg, #a875df ${acceptedDeg}deg ${pendingDeg}deg, #f1a62d ${pendingDeg}deg ${processingDeg}deg, #7b879a ${processingDeg}deg 360deg)` }}><div><strong>{total}</strong><span>总交付物</span></div></div><div className={styles.chartLegend}><Legend color="#45bb73" label="已接受 / 已共享" value={accepted} /><Legend color="#a875df" label="待审核" value={pending} /><Legend color="#f1a62d" label="处理中" value={processing} /><Legend color="#e05252" label="失败" value={failed} /><Legend color="#7b879a" label="草稿 / 归档" value={draft + archived} /></div></div>
    </Card>
    <Card className={styles.overviewCard} title={<span>仓库交付状态 <Text type="secondary">{repositorySummaries.length} 个仓库</Text></span>}>
      {repositorySummaries.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无仓库交付" /> : <div className={styles.repositoryList}>{repositorySummaries.map((repository) => <div className={styles.repositoryRow} key={repository.repositoryId}><div><strong>{repository.repositoryName}</strong><span>{repository.accepted}/{repository.total} 已交付</span></div><div><Tag color={repository.failed > 0 ? 'red' : repository.pending > 0 ? 'orange' : 'green'}>{repository.deliveryStatus ?? '暂无'}</Tag>{repository.mergeRequest ? <small>MR #{repository.mergeRequest.number}</small> : null}</div></div>)}</div>}
    </Card>
    <Card className={styles.overviewCard} title={<span>待我处理 <Text type="secondary">{summaryQuery.data.pendingForCurrentUser}</Text></span>}>
      <div className={styles.projectInfo}><SettingOutlined /><span>{summaryQuery.data.pendingForCurrentUser > 0 ? '当前筛选数据集中有待处理交付。' : '当前没有待处理交付。'}</span></div>
    </Card>
    <Card className={styles.overviewCard} title="需求信息">
      {groupId ? <GroupSummary summary={requirementGroupSummaries.find((group) => group.requirementGroupId === groupId)} /> : <div className={styles.projectInfo}><SettingOutlined /><span>当前展示项目级交付概览，可通过需求群筛选查看单组统计。</span></div>}
    </Card>
  </aside>
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>
}

function GroupSummary({ summary }: { summary: { requirementGroupId: string; name: string; total: number; pending: number } | undefined }) {
  if (!summary) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前需求群暂无统计" />
  return <div className={styles.projectInfo}><SettingOutlined /><div><strong>{summary.name}</strong><span>{summary.total} 个交付物，其中 {summary.pending} 个待审核</span></div></div>
}
