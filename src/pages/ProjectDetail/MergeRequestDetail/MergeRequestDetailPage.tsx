import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  App,
  Avatar,
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
} from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { projectApi } from '@/api/project'
import {
  useAddDiffComment,
  useDiffComments,
  useDiffFiles,
  useDiffs,
  useMergeMergeRequest,
  useMergeRequest,
  useMergeRequestChecks,
} from '@/hooks/task-model'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { diffFileStatusLabel } from '@/types/diff'
import type { ProjectRole } from '@/types/project'
import type {
  DiffComment,
  DiffFile,
  DiffLine,
  DiffListItem,
  MergeRequestCheck,
  MergeRequestCheckName,
  MergeRequestStatus,
  MergeRequestSummary,
} from '@/types/task-model'
import { commentAuthorName, HUNK_UNAVAILABLE_HINT } from '../commentAuthor'
import { githubPullRequestUrl } from '../mergeRequestDisplay'
import styles from './MergeRequestDetailPage.module.scss'

const { Text } = Typography

const FILE_PAGE_SIZE = 100
const DESCRIPTION_CLAMP = 96

const QUALITY_GATE_NAMES: MergeRequestCheckName[] = ['TESTSET', 'AI_REVIEW', 'DRY_RUN', 'CQ_PLUS_ONE']
type QualityGateName = MergeRequestCheckName

const GATE_LABEL: Record<QualityGateName, string> = {
  TESTSET: 'Testset',
  AI_REVIEW: 'AI Review',
  DRY_RUN: 'Dry-run',
  CQ_PLUS_ONE: 'CQ+1',
}

type DetailView = 'gate' | 'changes' | 'comments'

/**
 * MR 详情
 * 入口：代码与 Branch → MR Tab → 点某一条
 *
 * GET  /projects/{projectId}/merge-requests/{mergeRequestId}
 * GET  /projects/{projectId}/merge-requests/{mergeRequestId}/checks
 * POST /projects/{projectId}/merge-requests/{mergeRequestId}/merge  仅 PROJECT_ADMIN，且门禁 PASSED
 *
 * 评论 / 变更没有独立 MR 评论接口，复用关联 Diff 的 files / comments。
 */
export default function MergeRequestDetailPage() {
  const { message, modal } = App.useApp()
  const { projectId = '', mergeRequestId = '' } = useParams<{
    projectId: string
    mergeRequestId: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  const view: DetailView = isDetailView(viewParam) ? viewParam : 'gate'
  const [fileIndex, setFileIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [descriptionOpen, setDescriptionOpen] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })
  const membersQuery = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: Boolean(projectId),
  })

  const detailQuery = useMergeRequest(projectId, mergeRequestId)
  const checksQuery = useMergeRequestChecks(projectId, mergeRequestId)
  const mergeMr = useMergeMergeRequest(projectId)
  const diffsQuery = useDiffs(projectId, { limit: FILE_PAGE_SIZE })

  const mr = detailQuery.data
  const relatedDiff = useMemo(
    () => (mr ? pickRelatedDiff(diffsQuery.data?.data ?? [], mr) : undefined),
    [diffsQuery.data, mr],
  )
  const relatedDiffId = relatedDiff?.id ?? ''
  const filesQuery = useDiffFiles(projectId, relatedDiffId, { limit: FILE_PAGE_SIZE })
  const commentsQuery = useDiffComments(projectId, relatedDiffId, { limit: FILE_PAGE_SIZE })
  const addComment = useAddDiffComment(projectId, relatedDiffId)

  const files = filesQuery.data?.data ?? []
  const comments = commentsQuery.data?.data ?? []
  const members = membersQuery.data ?? []
  const safeIndex = Math.min(fileIndex, Math.max(files.length - 1, 0))
  const current = files[safeIndex]
  const listToMr = `${PATHS.projectCode(projectId)}?tab=mr`
  const repoName = repoLabel(reposQuery.data ?? [], mr?.repositoryId ?? '')
  const githubUrl = mr
    ? githubPullRequestUrl(
        mr.webUrl,
        mr.number,
        reposQuery.data?.find((item) => item.id === mr.repositoryId),
      )
    : null
  const showMerge = canShowMergeButton(project?.role, mr)

  function setView(next: string) {
    const params = new URLSearchParams(searchParams)
    if (next === 'gate') params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  function submitComment() {
    if (!relatedDiff || !draft.trim()) return
    const firstChanged = current?.hunks
      .flatMap((hunk) => hunk.lines)
      .find((line) => line.kind === 'ADD' || line.kind === 'DEL')
    addComment.mutate(
      {
        path: current?.path,
        side: 'RIGHT',
        line: firstChanged?.newLine ?? firstChanged?.oldLine ?? 1,
        hunkId: current?.hunks[0]?.id,
        body: draft.trim(),
      },
      {
        onSuccess: () => {
          setDraft('')
          message.success('评论已提交')
          void commentsQuery.refetch()
        },
        onError: (error) => message.error(formatApiError(error)),
      },
    )
  }

  function handleMerge() {
    if (!mr || !showMerge) return
    modal.confirm({
      title: '合并该 MR？',
      content: '仅 Project Admin 可在质量门禁全部通过后合并。合并后不可从本页撤销。',
      okText: '确认合并',
      onOk: () =>
        mergeMr.mutateAsync(mr.id).then(
          () => message.success('已合并'),
          (error: unknown) => {
            message.error(formatApiError(error))
            return Promise.reject(error)
          },
        ),
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('链接已复制')
    } catch {
      message.error('复制失败')
    }
  }

  if (!mergeRequestId) {
    return (
      <div className={styles.page}>
        <Empty description="缺少 mergeRequestId" />
      </div>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Spin />
        </div>
      </div>
    )
  }

  if (detailQuery.isError || !mr) {
    return (
      <div className={styles.page}>
        <Link to={listToMr} className={styles.back}>
          <ArrowLeftOutlined /> 返回 MR 列表
        </Link>
        <Alert
          type="error"
          showIcon
          message={detailQuery.error ? formatApiError(detailQuery.error) : '该 MR 不存在或不可见'}
          action={
            <Button size="small" onClick={() => void detailQuery.refetch()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  const description = mr.description?.trim() || ''
  const descriptionLong = description.length > DESCRIPTION_CLAMP
  const gateNodes = qualityGateNodes(checksQuery.data, mr)

  return (
    <div className={styles.page}>
      <Link to={listToMr} className={styles.back}>
        <ArrowLeftOutlined /> 返回 MR 列表
      </Link>

      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1>
              MR #{mr.number} · {mr.title?.trim() || `${mr.sourceBranch} → ${mr.targetBranch}`}
            </h1>
            <Tag color={statusColor(mr.status)}>{statusLabel(mr.status)}</Tag>
            <Tag color={qualityGateColor(mr.qualityGate?.status)}>
              {qualityGateLabel(mr.qualityGate?.status)}
            </Tag>
          </div>
          <p className={styles.meta}>
            <Text code>{mr.sourceBranch}</Text>
            {' → '}
            <Text code>{mr.targetBranch}</Text>
            {repoName ? ` · ${repoName}` : ''}
            {mr.headCommit ? (
              <>
                {' · HEAD '}
                <Text code>{mr.headCommit.slice(0, 7)}</Text>
              </>
            ) : null}
          </p>
        </div>
        <div className={styles.actions}>
          <Button icon={<CopyOutlined />} onClick={() => void copyLink()}>
            复制链接
          </Button>
          {githubUrl ? (
            <Button href={githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </Button>
          ) : null}
          {showMerge ? (
            <Button
              type="primary"
              loading={mergeMr.isPending}
              onClick={handleMerge}
              aria-label="merge-merge-request"
            >
              合并
            </Button>
          ) : null}
        </div>
      </header>

      {project?.role === 'PROJECT_ADMIN' && mr.status === 'OPEN' && mr.qualityGate?.status !== 'PASSED' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="质量门禁未全部通过前不显示合并。Testset、AI Review、Dry-run、CQ+1 均需 PASSED。"
        />
      ) : null}

      <Tabs
        activeKey={view}
        onChange={setView}
        items={[
          {
            key: 'gate',
            label: '质量门禁',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <section className={styles.card} aria-label="质量门禁">
                  <h2 className={styles.cardTitle}>质量门禁</h2>
                  {checksQuery.isError ? (
                    <Alert type="error" showIcon message={formatApiError(checksQuery.error)} />
                  ) : (
                    <div className={styles.gate}>
                      {gateNodes.map((node) => (
                        <div key={node.name} className={styles.gateItem}>
                          <span className={`${styles.gateDot} ${gateDotClass(node.status)}`}>
                            {gateIcon(node.status)}
                          </span>
                          <strong className={styles.gateName}>{GATE_LABEL[node.name]}</strong>
                          <p className={styles.gateSummary}>{gateStatusLabel(node.status)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className={styles.card} aria-label="MR 描述">
                  <h2 className={styles.cardTitle}>MR 描述</h2>
                  {description ? (
                    <>
                      <p className={`${styles.description}${descriptionLong && !descriptionOpen ? ` ${styles.isClamped}` : ''}`}>
                        {description}
                      </p>
                      {descriptionLong ? (
                        <Button type="link" className={styles.expand} onClick={() => setDescriptionOpen((open) => !open)}>
                          {descriptionOpen ? '收起' : '展开全文'}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <Text type="secondary">暂无描述</Text>
                  )}
                </section>
              </Space>
            ),
          },
          {
            key: 'changes',
            label: '变更',
            children: (
              <ChangesPane
                relatedDiff={relatedDiff}
                files={files}
                loading={Boolean(relatedDiff) && filesQuery.isLoading}
                error={filesQuery.error}
                isError={filesQuery.isError}
                fileIndex={safeIndex}
                onSelectFile={setFileIndex}
              />
            ),
          },
          {
            key: 'comments',
            label: '评论',
            children: (
              <CommentsPane
                relatedDiff={relatedDiff}
                comments={comments}
                members={members}
                loading={Boolean(relatedDiff) && commentsQuery.isLoading}
                error={commentsQuery.error}
                isError={commentsQuery.isError}
                draft={draft}
                submitting={addComment.isPending}
                onDraftChange={setDraft}
                onSubmit={submitComment}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

function ChangesPane({
  relatedDiff,
  files,
  loading,
  error,
  isError,
  fileIndex,
  onSelectFile,
}: {
  relatedDiff: DiffListItem | undefined
  files: DiffFile[]
  loading: boolean
  error: Error | null
  isError: boolean
  fileIndex: number
  onSelectFile: (index: number) => void
}) {
  if (!relatedDiff) {
    return <Empty className={styles.empty} description="没有关联 Diff，无法展示变更" />
  }
  if (loading) {
    return (
      <div className={styles.empty}>
        <Spin />
      </div>
    )
  }
  if (isError) {
    return <Alert type="error" showIcon message={error ? formatApiError(error) : '加载变更失败'} />
  }
  const current = files[fileIndex]
  return (
    <div className={styles.changes}>
      <aside className={styles.panel} aria-label="变更文件">
        <div className={styles.panelHead}>文件</div>
        {files.map((file, index) => (
          <button
            key={file.path}
            type="button"
            className={`${styles.file}${index === fileIndex ? ` ${styles.isActive}` : ''}`}
            onClick={() => onSelectFile(index)}
          >
            <span className={styles.fileName}>{fileName(file.path)}</span>
            <span className={`${styles.fileMark} ${fileMarkClass(file.changeType || file.status)}`}>
              {diffFileStatusLabel(file.changeType || file.status)}
            </span>
          </button>
        ))}
      </aside>
      <section className={styles.panel}>
        {current ? (
          <>
            <div className={styles.fileMeta}>
              {current.path}
              {' · '}
              <Text type="success">+{current.additions}</Text>
              {' / '}
              <Text type="danger">-{current.deletions}</Text>
            </div>
            {current.binary ? (
              <Empty className={styles.empty} description="二进制文件" />
            ) : current.hunks.length === 0 ? (
              <Empty className={styles.empty} description={HUNK_UNAVAILABLE_HINT} />
            ) : (
              current.hunks.map((hunk) => (
                <div key={hunk.id}>
                  <div className={styles.hunkHead}>{hunk.header}</div>
                  {hunk.lines.map((line, index) => (
                    <DiffLineRow key={`${hunk.id}-${index}`} line={line} />
                  ))}
                </div>
              ))
            )}
          </>
        ) : (
          <Empty className={styles.empty} description="没有文件" />
        )}
      </section>
    </div>
  )
}

function CommentsPane({
  relatedDiff,
  comments,
  members,
  loading,
  error,
  isError,
  draft,
  submitting,
  onDraftChange,
  onSubmit,
}: {
  relatedDiff: DiffListItem | undefined
  comments: DiffComment[]
  members: Array<{ userId: string; displayName?: string }>
  loading: boolean
  error: Error | null
  isError: boolean
  draft: string
  submitting: boolean
  onDraftChange: (value: string) => void
  onSubmit: () => void
}) {
  if (!relatedDiff) {
    return <Empty className={styles.empty} description="没有关联 Diff，无法展示评论" />
  }
  if (loading) {
    return (
      <div className={styles.empty}>
        <Spin />
      </div>
    )
  }
  if (isError) {
    return <Alert type="error" showIcon message={error ? formatApiError(error) : '加载评论失败'} />
  }
  return (
    <section className={styles.card} aria-label="评论">
      <h2 className={styles.cardTitle}>评论</h2>
      {comments.length === 0 ? (
        <Empty description="还没有评论" />
      ) : (
        comments.map((comment) => <CommentCard key={comment.id} comment={comment} members={members} />)
      )}
      <div className={styles.composer}>
        <Input.TextArea
          id="mr-comment-input"
          value={draft}
          placeholder="在本 MR 详情页发表评论"
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <Button type="primary" loading={submitting} disabled={!draft.trim()} onClick={onSubmit}>
          发表评论
        </Button>
      </div>
    </section>
  )
}

function CommentCard({
  comment,
  members,
}: {
  comment: DiffComment
  members: Array<{ userId: string; displayName?: string }>
}) {
  const name = commentAuthorName(comment, members)
  return (
    <article className={styles.comment}>
      <Avatar size={28}>{name.slice(0, 1)}</Avatar>
      <div className={styles.commentBody}>
        <strong>{name}</strong>
        <p>{comment.body}</p>
        <time>
          {comment.path ? `${fileName(comment.path)} · ` : ''}
          {comment.line != null ? `L${comment.line} · ` : ''}
          {comment.createdAt ? comment.createdAt.replace('T', ' ').slice(0, 16) : ''}
        </time>
      </div>
    </article>
  )
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const sign = line.kind === 'ADD' ? '+' : line.kind === 'DEL' ? '-' : ''
  return (
    <div
      className={`${styles.line}${line.kind === 'ADD' ? ` ${styles.isAdd}` : ''}${line.kind === 'DEL' ? ` ${styles.isDel}` : ''}`}
    >
      <span className={styles.gutter}>{line.oldLine ?? ''}</span>
      <span className={styles.gutter}>{line.newLine ?? ''}</span>
      <span className={styles.sign}>{sign}</span>
      <span className={styles.code}>{line.text}</span>
    </div>
  )
}

function canShowMergeButton(
  role: ProjectRole | undefined,
  mr: MergeRequestSummary | undefined,
): boolean {
  return role === 'PROJECT_ADMIN' && mr?.status === 'OPEN' && mr.qualityGate?.status === 'PASSED'
}

function pickRelatedDiff(items: DiffListItem[], mr: MergeRequestSummary): DiffListItem | undefined {
  const matched = items.filter(
    (item) =>
      item.repositoryId === mr.repositoryId &&
      item.sourceBranch === mr.sourceBranch &&
      (!mr.taskId || item.taskId === mr.taskId),
  )
  return matched.find((item) => item.status === 'ACCEPTED') ?? matched[0]
}

function qualityGateNodes(
  checks: MergeRequestCheck[] | undefined,
  mr: MergeRequestSummary,
): Array<{ name: QualityGateName; status: MergeRequestCheck['status'] }> {
  const names = (mr.qualityGate?.requiredChecks ?? QUALITY_GATE_NAMES).filter(isQualityGateName)
  const ordered = names.length > 0 ? names : [...QUALITY_GATE_NAMES]
  return ordered.map((name) => {
    const item = checks?.find((check) => check.type === name)
    return {
      name,
      status: item?.status ?? 'PENDING',
    }
  })
}

function isQualityGateName(value: string): value is QualityGateName {
  return (QUALITY_GATE_NAMES as readonly string[]).includes(value)
}

function isDetailView(value: string | null): value is DetailView {
  return value === 'gate' || value === 'changes' || value === 'comments'
}

function statusLabel(status: MergeRequestStatus): string {
  if (status === 'OPEN') return '进行中'
  if (status === 'MERGED') return '已合并'
  return '已关闭'
}

function statusColor(status: MergeRequestStatus): string {
  if (status === 'OPEN') return 'blue'
  if (status === 'MERGED') return 'green'
  return 'default'
}

function qualityGateLabel(status: string | undefined): string {
  if (status === 'PASSED') return '门禁通过'
  if (status === 'FAILED') return '门禁未过'
  if (status === 'PENDING') return '门禁检查中'
  return '门禁未知'
}

function qualityGateColor(status: string | undefined): string {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'PENDING') return 'processing'
  return 'default'
}

function gateStatusLabel(status: MergeRequestCheck['status']): string {
  if (status === 'PASSED') return '通过'
  if (status === 'FAILED') return '未通过'
  return '待检查'
}

function gateDotClass(status: MergeRequestCheck['status']): string {
  if (status === 'PASSED') return styles.isPassed
  if (status === 'FAILED') return styles.isFailed
  return styles.isPending
}

function gateIcon(status: MergeRequestCheck['status']) {
  if (status === 'PASSED') return <CheckCircleFilled />
  if (status === 'FAILED') return <CloseCircleFilled />
  return <ClockCircleFilled />
}

function fileName(path: string): string {
  return path.split('/').pop() || path
}

function fileMarkClass(status: DiffFile['status']): string {
  if (status === 'ADDED') return styles.isA
  if (status === 'DELETED') return styles.isD
  return styles.isM
}

function repoLabel(
  repositories: Array<{ id: string; displayName?: string; fullName?: string }>,
  repositoryId: string,
): string {
  const repo = repositories.find((item) => item.id === repositoryId)
  return repo?.displayName || repo?.fullName || repositoryId
}
