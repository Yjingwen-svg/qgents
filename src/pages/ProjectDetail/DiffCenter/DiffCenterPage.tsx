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

export function DiffCenterPage() {
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
        {!listQuery.isLoading && listQuery.hasNextPage ? <Button className={styles.loadMore} loading={listQuery.isFetchingNextPage} onClick={() => void listQuery.fetchNextPage()}>加载更多</Button> : null}
      </main>
      <aside className={styles.sidebar} aria-label="Diff 摘要">
        {diffId ? <DiffDetailPanel query={selectedQuery} projectId={projectId} onRefresh={() => void selectedQuery.refetch()} /> : <DiffSummary diffs={diffs} />}
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
  return <Card title="Diff 摘要"><Space direction="vertical"><Text>当前页 Diff：{diffs.length}</Text><Text>待验收：{pending}</Text><Text type="secondary">文件级 Diff、评论和合并由 Diff/CR 模块提供。</Text></Space></Card>
}

function DiffDetailPanel({ query, projectId, onRefresh }: { query: ReturnType<typeof useDiff>; projectId: string; onRefresh: () => void }) {
  const diff = query.data
  if (query.isLoading) return <Card><Spin /></Card>
  if (query.isError || !diff) return <Card><Result status={errorStatus(query.error)} title={errorTitle(query.error, 'Diff 详情')} extra={<Button onClick={onRefresh}>刷新</Button>} /></Card>
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
  const accept = useAcceptDiff(projectId)
  const reject = useRejectDiff(projectId)
  const [reason, setReason] = useState('')
  const pending = accept.isPending || reject.isPending
  if (diff.status !== 'PENDING_REVIEW') return <Text type="secondary">该 Diff 已处理，只读。</Text>
  return <Form layout="vertical" onFinish={() => { if (reason.trim()) reject.mutate({ diffId: diff.id, input: { reason: reason.trim() } }, { onError: (error) => { if (error instanceof ApiError && error.status === 409) onRefresh() } }) }}>
    <Form.Item label="拒绝原因" required><Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="请输入拒绝原因" disabled={pending} /></Form.Item>
    <Space wrap><Button aria-label="accept-diff" type="primary" icon={<CheckOutlined />} loading={accept.isPending} disabled={pending} onClick={() => accept.mutate(diff.id, { onError: (error) => { if (error instanceof ApiError && error.status === 409) onRefresh() } })}>验收 Diff</Button><Button aria-label="reject-diff" danger htmlType="submit" icon={<CloseOutlined />} loading={reject.isPending} disabled={pending || !reason.trim()}>拒绝 Diff</Button></Space>
    {accept.error || reject.error ? <Alert className={styles.mutationError} type="error" showIcon message={mutationError(accept.error ?? reject.error)} action={accept.error instanceof ApiError && accept.error.status === 409 || reject.error instanceof ApiError && reject.error.status === 409 ? <Button size="small" onClick={onRefresh}>刷新状态</Button> : undefined} /> : null}
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
