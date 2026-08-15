import { useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Form, Input, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CodeOutlined, CloseOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { useAcceptDiff, useDiff, useInfiniteDiffs, useRejectDiff } from '@/hooks/task-model'
import type { DiffDetail, DiffListItem } from '@/types/task-model'
import { PATHS } from '@/routes/paths'
import styles from './DiffCenterPage.module.scss'

const { Text, Title } = Typography
const PAGE_SIZE = 20

function display(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '暂无' : String(value)
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleString('zh-CN', { hour12: false })
}

function statusLabel(status: DiffListItem['status']): string {
  return status === 'PENDING_REVIEW' ? '待验收' : status === 'ACCEPTED' ? '已验收' : '已拒绝'
}

function statusColor(status: DiffListItem['status']): string {
  return status === 'PENDING_REVIEW' ? 'gold' : status === 'ACCEPTED' ? 'green' : 'red'
}

export default function DiffCenterPage() {
  const { projectId = '', diffId = '' } = useParams<{ projectId: string; diffId?: string }>()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')?.trim() || undefined
  const location = useLocation()
  const navigate = useNavigate()
  const listQuery = useInfiniteDiffs(projectId, { taskId, limit: PAGE_SIZE })
  const selectedQuery = useDiff(projectId, diffId)
  const diffs = useMemo(() => {
    const seen = new Map<string, DiffListItem>()
    listQuery.data?.pages.flatMap((page) => page.data).forEach((diff) => seen.set(diff.id, diff))
    return [...seen.values()]
  }, [listQuery.data])

  function selectDiff(nextDiffId: string) {
    navigate(PATHS.projectDiff(projectId, nextDiffId) + (taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''), { state: { from: `${location.pathname}${location.search}` } })
  }

  function backToList() {
    navigate(PATHS.projectDiffs(projectId) + (taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''))
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><Title level={2}><CodeOutlined /> 交付中心</Title><Text className={styles.subtitle}>Diff 摘要、验收与关联任务信息</Text></div>
      <Tag color="blue">Diff</Tag>
    </header>
    {taskId ? <Alert className={styles.notice} type="info" showIcon message={`当前仅按 taskId 筛选：${taskId}`} /> : null}
    <div className={styles.unsupported}>groupId、repositoryId、status 筛选：接口暂未支持</div>
    <div className={styles.contentLayout}>
      <main className={styles.mainContent}>
        {diffId ? <Button type="text" icon={<ArrowLeftOutlined />} onClick={backToList}>返回交付中心</Button> : null}
        <DiffList query={listQuery} diffs={diffs} selectedId={diffId} onSelect={selectDiff} />
        {diffId ? <section className={styles.selectedDetail}><DiffDetailPanel query={selectedQuery} projectId={projectId} onRefresh={() => void selectedQuery.refetch()} /></section> : null}
        {!listQuery.isLoading && listQuery.hasNextPage ? <Button className={styles.loadMore} loading={listQuery.isFetchingNextPage} onClick={() => void listQuery.fetchNextPage()}>加载更多</Button> : null}
      </main>
      <aside className={styles.sidebar} aria-label="Diff 摘要">
        <DiffSummary diffs={diffs} />
      </aside>
    </div>
  </div>
}

function DiffList({ query, diffs, selectedId, onSelect }: { query: ReturnType<typeof useInfiniteDiffs>; diffs: DiffListItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  if (query.isLoading) return <div className={styles.state}><Spin /></div>
  if (query.isError && !query.data) return <Result status={errorStatus(query.error)} title={errorTitle(query.error, 'Diff 列表')} extra={<Button onClick={() => void query.refetch()}>重新加载</Button>} />
  if (diffs.length === 0) return <Empty className={styles.empty} description="当前项目暂无 Diff" />
  return <div className={styles.diffList}>{diffs.map((diff) => <DiffRow key={diff.id} diff={diff} selected={selectedId === diff.id} onSelect={onSelect} />)}</div>
}

function DiffRow({ diff, selected, onSelect }: { diff: DiffListItem; selected: boolean; onSelect: (id: string) => void }) {
  return <Card className={`${styles.diffRow} ${selected ? styles.selected : ''}`} size="small">
    <div className={styles.rowHeader}><Button type="link" className={styles.diffId} onClick={() => onSelect(diff.id)}>{diff.id}</Button><Tag color={statusColor(diff.status)}>{statusLabel(diff.status)}</Tag></div>
    <div className={styles.rowGrid}>
      <span>Task <b>{display(diff.taskId)}</b></span><span>TaskStep <b>{display(diff.taskStepId)}</b></span><span>TaskRun <b>{display(diff.taskRunId)}</b></span>
      <span>需求群 <b>{display(diff.requirementGroupId)}</b></span><span>仓库 <b>{display(diff.repositoryId)}</b></span><span>创建时间 <b>{formatDate(diff.createdAt)}</b></span>
      <span>baseCommit <b>{display(diff.baseCommit)}</b></span><span>sourceBranch <b>{display(diff.sourceBranch)}</b></span><span>headCommit <b>{display(diff.headCommit)}</b></span>
      <span>变更 <b>{diff.changeStats.files} 文件 / +{diff.changeStats.additions} / -{diff.changeStats.deletions}</b></span>
    </div>
    <Button size="small" onClick={() => onSelect(diff.id)}>查看摘要</Button>
  </Card>
}

function DiffSummary({ diffs }: { diffs: DiffListItem[] }) {
  const pending = diffs.filter((diff) => diff.status === 'PENDING_REVIEW').length
  const accepted = diffs.filter((diff) => diff.status === 'ACCEPTED').length
  const rejected = diffs.filter((diff) => diff.status === 'REJECTED').length
  const repositoryDiffs = [...new Map(diffs.map((diff) => [diff.repositoryId, diffs.filter((item) => item.repositoryId === diff.repositoryId)])).entries()]
  const reference = diffs[0]
  const actionableDiffs = diffs.filter((diff) => diff.status === 'PENDING_REVIEW')

  return <div className={styles.deliverySidebar}>
    <section className={styles.sidebarCard}>
      <h3>交付预览</h3>
      <div className={styles.overviewBody}>
        <div className={styles.deliveryTotal}><strong>{diffs.length}</strong><span>总交付物</span></div>
        <div className={styles.overviewLegend}>
          <SummaryCount tone="accepted" label="已验收" value={accepted} />
          <SummaryCount tone="pending" label="待验收" value={pending} />
          <SummaryCount tone="rejected" label="已拒绝" value={rejected} />
        </div>
      </div>
    </section>

    <section className={styles.sidebarCard}>
      <div className={styles.sidebarCardTitle}><h3>交付仓库状态</h3><Text>{repositoryDiffs.length} 个仓库</Text></div>
      <div className={styles.repositoryReviewList}>
        {repositoryDiffs.length === 0 ? <Text type="secondary">暂无仓库交付数据</Text> : repositoryDiffs.map(([repositoryId, items]) => {
          const repositoryAccepted = items.filter((diff) => diff.status === 'ACCEPTED').length
          const state = repositoryAccepted === items.length ? '已验收' : items.some((diff) => diff.status === 'REJECTED') ? '有拒绝项' : '待验收'
          return <div className={styles.repositoryReviewRow} key={repositoryId}>
            <strong title={repositoryId}>{repositoryId}</strong>
            <span>{repositoryAccepted}/{items.length} 已验收</span>
            <Tag className={`${styles.repositoryState} ${state === '已验收' ? styles.repositoryStateAccepted : state === '有拒绝项' ? styles.repositoryStateRejected : styles.repositoryStatePending}`}>{state}</Tag>
          </div>
        })}
      </div>
    </section>

    <section className={styles.sidebarCard}>
      <div className={styles.sidebarCardTitle}><h3>待我处理</h3><strong>{pending}/{diffs.length}</strong></div>
      <ul className={styles.acceptanceList}>
        {actionableDiffs.length === 0 ? <li><Text type="secondary">暂无待处理 Diff</Text></li> : actionableDiffs.map((diff) => <li key={diff.id}>
          <span className={`${styles.acceptanceMark} ${diff.status === 'ACCEPTED' ? styles.acceptanceMarkAccepted : diff.status === 'REJECTED' ? styles.acceptanceMarkRejected : ''}`} />
          <span title={diff.id}>{diff.id} · {diff.repositoryId}</span>
        </li>)}
      </ul>
    </section>

    <section className={styles.sidebarCard}>
      <h3>需求信息</h3>
      {reference ? <dl className={styles.deliveryInfo}>
        <div><dt>任务</dt><dd>{reference.taskId}</dd></div>
        <div><dt>需求群</dt><dd>{display(reference.requirementGroupId)}</dd></div>
        <div><dt>创建时间</dt><dd>{formatDate(reference.createdAt)}</dd></div>
      </dl> : <Text type="secondary">暂无交付信息</Text>}
    </section>
  </div>
  /*
  return <Card title="Diff 摘要"><Space direction="vertical"><Text>当前页 Diff：{diffs.length}</Text><Text>待验收：{pending}</Text><Text type="secondary">文件级 Diff、评论和合并由 Diff/CR 模块提供。</Text></Space></Card>
  */
}

function SummaryCount({ tone, label, value }: { tone: 'accepted' | 'pending' | 'rejected'; label: string; value: number }) {
  const toneClass = tone === 'accepted' ? styles.summaryDotAccepted : tone === 'pending' ? styles.summaryDotPending : styles.summaryDotRejected
  return <div className={styles.summaryCount}><span className={`${styles.summaryDot} ${toneClass}`} /><span>{label}</span><strong>{value}</strong></div>
}

function DiffDetailPanel({ query, projectId, onRefresh }: { query: ReturnType<typeof useDiff>; projectId: string; onRefresh: () => void }) {
  const diff = query.data
  if (query.isLoading) return <Card><Spin /></Card>
  if (query.isError || !diff || diff.projectId !== projectId) return <Card><Result status={query.isError ? errorStatus(query.error) : '404'} title={query.isError ? errorTitle(query.error, 'Diff 详情') : 'Diff 不存在或不可见'} extra={<Button onClick={onRefresh}>刷新</Button>} /></Card>
  return <Card title={<span>{diff.id} <Tag color={statusColor(diff.status)}>{statusLabel(diff.status)}</Tag></span>}>
    <Space direction="vertical" className={styles.detailContent}>
      <DetailFields diff={diff} />
      <DiffAcceptance diff={diff} projectId={projectId} onRefresh={onRefresh} />
      <Text type="secondary">本页面仅完成 Diff 验收，不代表已合并 MR。</Text>
    </Space>
  </Card>
}

function DetailFields({ diff }: { diff: DiffDetail }) {
  return <div className={styles.detailFields}>
    <span>Task <b>{display(diff.taskId)}</b></span><span>TaskStep <b>{display(diff.taskStepId)}</b></span><span>TaskRun <b>{display(diff.taskRunId)}</b></span>
    <span>需求群 <b>{display(diff.requirementGroupId)}</b></span><span>仓库 <b>{display(diff.repositoryId)}</b></span><span>baseCommit <b>{display(diff.baseCommit)}</b></span>
    <span>sourceBranch <b>{display(diff.sourceBranch)}</b></span><span>headCommit <b>{display(diff.headCommit)}</b></span><span>workingTreeHash <b>{display(diff.workingTreeHash)}</b></span>
    <span>snapshotKey <b>{display(diff.snapshotKey)}</b></span><span>reviewedBy <b>{display(diff.reviewedBy)}</b></span><span>reviewedAt <b>{formatDate(diff.reviewedAt ?? '')}</b></span>
    <span>reviewReason <b>{display(diff.reviewReason)}</b></span><span>updatedAt <b>{formatDate(diff.updatedAt)}</b></span>
  </div>
}

function DiffAcceptance({ diff, projectId, onRefresh }: { diff: DiffDetail; projectId: string; onRefresh: () => void }) {
  const navigate = useNavigate()
  const accept = useAcceptDiff(projectId)
  const reject = useRejectDiff(projectId)
  const [reason, setReason] = useState('')
  const pending = accept.isPending || reject.isPending
  if (diff.status !== 'PENDING_REVIEW') return <Text type="secondary">该 Diff 已处理，只读。</Text>
  return <Form layout="vertical" onFinish={() => { if (reason.trim()) reject.mutate({ diffId: diff.id, input: { reason: reason.trim() } }, { onError: (error) => { if (error instanceof ApiError && error.status === 409) onRefresh() } }) }}>
    <Form.Item label="拒绝原因" required><Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="请输入拒绝原因" disabled={pending} /></Form.Item>
    <Space wrap><Button aria-label="accept-diff" type="primary" icon={<CheckOutlined />} loading={accept.isPending} disabled={pending} onClick={() => { if (!window.confirm('确认验收此 Diff？')) return; accept.mutate(diff.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) onRefresh() } }) }}>验收 Diff</Button><Button aria-label="reject-diff" danger htmlType="submit" icon={<CloseOutlined />} loading={reject.isPending} disabled={pending || !reason.trim()}>拒绝 Diff</Button></Space>
    {accept.error || reject.error ? <Alert className={styles.mutationError} type="error" showIcon message={mutationError(accept.error ?? reject.error)} action={errorCode(accept.error ?? reject.error) === 'DIFF_BATCH_REVIEW_REQUIRED' ? <Button size="small" onClick={() => navigate(PATHS.projectTaskDetail(projectId, diff.taskId))}>进入总 Diff 验收</Button> : accept.error instanceof ApiError && accept.error.status === 409 || reject.error instanceof ApiError && reject.error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新状态</Button> : undefined} /> : null}
  </Form>
}

function errorStatus(error: Error | null): '403' | '404' | 'error' {
  const status = error instanceof ApiError ? error.status : undefined
  return status === 403 ? '403' : status === 404 ? '404' : 'error'
}

function errorTitle(error: Error | null, resource: string): string {
  const status = error instanceof ApiError ? error.status : undefined
  return status === 403 ? `暂无权限查看${resource}` : status === 404 ? `${resource}不存在或不可见` : `${resource}加载失败`
}

function mutationError(error: Error | null): string {
  if (error instanceof ApiError) return error.status === 409 ? 'Diff 状态已变化，请刷新后重试' : error.status === 422 ? '请求参数不合法' : error.status === 403 ? '暂无权限执行该操作' : error.status === 404 ? 'Diff 不存在或不可见' : '操作失败'
  return '操作失败，请稍后重试'
}

function errorCode(error: Error | null): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object' || !('error' in error.body)) return undefined
  const bodyError = (error.body as { error?: { code?: unknown } }).error
  return typeof bodyError?.code === 'string' ? bodyError.code : undefined
}
