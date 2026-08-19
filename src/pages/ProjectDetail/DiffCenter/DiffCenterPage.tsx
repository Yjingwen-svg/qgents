import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Empty, Form, Input, Result, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CodeOutlined, CloseOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, githubApi } from '@/api'
import { useAcceptDiff, useDiff, useDiffFiles, useInfiniteDiffs, useRejectDiff, useTask } from '@/hooks/task-model'
import { queryKeys } from '@/query/queryKeys'
import type { DiffDetail, DiffFile, DiffLine, DiffStatus, Task } from '@/types/task-model'
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

function statusLabel(status: DiffStatus): string {
  return status === 'PENDING_REVIEW' ? '待验收' : status === 'ACCEPTED' ? '已验收' : '已拒绝'
}

function statusColor(status: DiffStatus): string {
  return status === 'PENDING_REVIEW' ? 'gold' : status === 'ACCEPTED' ? 'green' : 'red'
}

export default function DiffCenterPage() {
  const { projectId = '', diffId = '' } = useParams<{ projectId: string; diffId?: string }>()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')?.trim() || undefined
  const navigate = useNavigate()
  const listQuery = useInfiniteDiffs(projectId, { taskId, limit: PAGE_SIZE })
  const selectedQuery = useDiff(projectId, diffId)

  function backToList() {
    navigate(PATHS.projectDiffs(projectId) + (taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''))
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><Title level={2}><CodeOutlined /> 交付中心</Title><Text className={styles.subtitle}>Diff 摘要、验收与关联任务信息</Text></div>
      <Tag color="blue">Diff</Tag>
    </header>
    {taskId ? <Alert className={styles.notice} type="info" showIcon message={`当前仅按 taskId 筛选：${taskId}`} /> : null}
    <main className={styles.mainContent}>
      {diffId ? <Button type="text" icon={<ArrowLeftOutlined />} onClick={backToList}>返回交付中心</Button> : null}
      {diffId ? <section className={styles.selectedDetail}><DiffDetailPanel query={selectedQuery} projectId={projectId} onRefresh={() => void selectedQuery.refetch()} /></section> : null}
      {!listQuery.isLoading && listQuery.hasNextPage ? <Button className={styles.loadMore} loading={listQuery.isFetchingNextPage} onClick={() => void listQuery.fetchNextPage()}>加载更多</Button> : null}
    </main>
  </div>
}

function DiffDetailPanel({ query, projectId, onRefresh }: { query: ReturnType<typeof useDiff>; projectId: string; onRefresh: () => void }) {
  const diff = query.data
  const taskQuery = useTask(projectId, diff?.taskId ?? '')
  const repositoriesQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })
  if (query.isLoading) return <Card><Spin /></Card>
  if (query.isError || !diff || diff.projectId !== projectId) return <Card><Result status={query.isError ? errorStatus(query.error) : '404'} title={query.isError ? errorTitle(query.error, 'Diff 详情') : 'Diff 不存在或不可见'} extra={<Button onClick={onRefresh}>刷新</Button>} /></Card>
  const cardTitle = (
    <span>
      {taskQuery.data?.title?.trim() || display(diff.taskId)}
      <Tag color={statusColor(diff.status)}>{statusLabel(diff.status)}</Tag>
    </span>
  )
  return <Card title={cardTitle}>
    <Space direction="vertical" className={styles.detailContent}>
      <DetailFields diff={diff} task={taskQuery.data} repositories={repositoriesQuery.data ?? []} />
      <DiffFilesPanel projectId={projectId} diffId={diff.id} />
      <DiffAcceptance diff={diff} projectId={projectId} onRefresh={onRefresh} />
      <Text type="secondary">本页面仅完成 Diff 验收，不代表已合并 MR。</Text>
    </Space>
  </Card>
}

/** 文件变更区块：文件列表 + 行级红绿 hunks（GET /diffs/{diffId}/files，映射层已适配后端结构） */
function DiffFilesPanel({ projectId, diffId }: { projectId: string; diffId: string }) {
  const filesQuery = useDiffFiles(projectId, diffId, { limit: 100 })
  const files = filesQuery.data?.data ?? []
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const current = files.find((f) => f.path === selectedPath) ?? files.find((f) => f.hunks.length > 0) ?? files[0]

  if (filesQuery.isLoading) return <Card size="small" title="文件变更"><Spin /></Card>
  if (files.length === 0) return null

  return <Card size="small" title="文件变更">
    <div className={styles.fileList}>
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          className={`${styles.fileChip}${current?.id === file.id ? ` ${styles.fileChipActive}` : ''}`}
          onClick={() => setSelectedPath(file.path)}
        >
          <span className={styles.fileStatus}>{fileStatusLabel(file.changeType)}</span>
          <span className={styles.filePath}>{file.path}</span>
          <span className={styles.fileStats}>+{file.additions}/-{file.deletions}</span>
        </button>
      ))}
    </div>
    {current ? (
      current.binary ? (
        <div className={styles.binary}>二进制文件，无法展示行级 Diff</div>
      ) : current.hunks.length === 0 ? (
        <Empty style={{ margin: 24 }} description="该文件暂无行级变更" />
      ) : (
        current.hunks.map((hunk) => (
          <div key={hunk.id}>
            <div className={styles.hunkHead}>{hunk.header}</div>
            {hunk.lines.map((line, index) => <DiffLineRow key={`${hunk.id}-${index}`} line={line} />)}
          </div>
        ))
      )
    ) : null}
  </Card>
}

/** 行级渲染：CONTEXT 灰、ADD 绿、DEL 红（kind 已由映射层归一） */
function DiffLineRow({ line }: { line: DiffLine }) {
  const sign = line.kind === 'ADD' ? '+' : line.kind === 'DEL' ? '-' : ''
  return (
    <div className={`${styles.lineRow}${line.kind === 'ADD' ? ` ${styles.lineAdd}` : ''}${line.kind === 'DEL' ? ` ${styles.lineDel}` : ''}`}>
      <span className={styles.gutter}>{line.oldLine ?? ''}</span>
      <span className={styles.gutter}>{line.newLine ?? ''}</span>
      <span className={styles.sign}>{sign}</span>
      <span className={styles.code}>{line.text}</span>
    </div>
  )
}

/** DiffFile.changeType → A/M/D 徽标 */
function fileStatusLabel(changeType: DiffFile['changeType']): string {
  return changeType === 'ADDED' ? 'A' : changeType === 'DELETED' ? 'D' : 'M'
}

function DetailFields({ diff, task, repositories }: { diff: DiffDetail; task?: Task | undefined; repositories: Array<{ id: string; displayName?: string; fullName: string }> }) {
  const requirementGroupName = task?.requirementGroup?.name ?? display(diff.requirementGroupId)
  // 仓库信息优先从项目绑定仓库列表（diff.repositoryId 即 project_repositories.id）解析；
  // 若绑定列表未拉到或 id 未命中，回退到 task.repositories（同名属性），最后回退原始 ID
  const boundRepo = repositories.find((repo) => repo.id === diff.repositoryId)
  const taskRepo = task?.repositories?.find((r) => r.repositoryId === diff.repositoryId)
  const repositoryName = boundRepo?.displayName || boundRepo?.fullName || taskRepo?.name || display(diff.repositoryId)
  return <div className={styles.detailFields}>
    <span>需求群 <b>{requirementGroupName}</b></span><span>仓库 <b>{repositoryName}</b></span>
    <span>分支 <b>{display(diff.sourceBranch)}</b></span><span>交付时间 <b>{formatDate(diff.updatedAt)}</b></span>
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
