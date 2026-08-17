import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Avatar,
  Empty,
  App,
  Spin,
  Alert,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { githubApi } from '@/api/github'
import { teamApi } from '@/api/team'
import { PATHS } from '@/routes/paths'
import { ApiError } from '@/api/client'
import { formatApiError } from '@/utils/formatApiError'
import { projectApi } from '@/api/project'
import { queryKeys } from '@/query/queryKeys'
import { commentAuthorName, HUNK_UNAVAILABLE_HINT } from './commentAuthor'
import {
  useAcceptDiff,
  useAddDiffComment,
  useCreateMergeRequest,
  useDiff,
  useDiffComments,
  useDiffFiles,
  useDiffs,
  useRejectDiff,
  useTask,
} from '@/hooks/task-model'
import { diffFileStatusLabel, diffStatusLabel } from '@/types/diff'
import type { ProjectRole } from '@/types/project'
import type { TeamRole } from '@/types/team'
import type { DiffComment, DiffDetail, DiffFile, DiffLine, DiffListItem, DiffStatus, MergeRequestSummary } from '@/types/task-model'
import './DiffReviewPage.css'

const { Text } = Typography
const FILE_PAGE_SIZE = 100

/**
 * PROJECT_MEMBER:能看代码页、Diff、评论；通过后可创建 MR
 * PROJECT_ADMIN / TEAM_OWNER: 通过、请求修改；通过后同一按钮变为创建 MR
 * Diff 与 CR 详情
 * 入口：代码与 Branch → 点击 Diff 列 +/-
 *
 * GET  /projects/{projectId}/diffs/{diffId}    //Diff 标题、状态、SHA(commit当中)、+/- 汇总
 * GET  /projects/{projectId}/diffs/{diffId}/files //左侧文件树、文件数、+8/-2
 * GET  /projects/{projectId}/diffs/{diffId}/comments  //底部两条评论、发表评论
 * POST /projects/{projectId}/diffs/{diffId}/comments
 * POST /projects/{projectId}/diffs/{diffId}/accept | reject    //通过 / 请求修改
 * POST /projects/{projectId}/merge-requests//创建MR
 *
 * accept 同步：200 时 headCommit 已是真实 SHA，失败保持 PENDING_REVIEW。不轮询、不依赖 SSE。
 *
 * 通过 / 请求修改：Project Admin 或 Team Owner。
 * 创建 MR：项目成员可见；未通过 Diff 时禁用。远端核验与项目访问权由服务端在 POST 时校验。
 *
 * 数据一律走 diffsApi / mergeRequestsApi + TanStack Query；Mock / 真后端同一条调用链。
 */
export default function DiffReviewPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const jumpedToRef = useRef<string | null>(null)
  const { projectId = '', diffId = '' } = useParams<{
    projectId: string
    diffId: string
  }>()
  const [searchParams] = useSearchParams()
  const fileHint = searchParams.get('file')?.trim() || undefined
  const [fileIndex, setFileIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [createdMr, setCreatedMr] = useState<MergeRequestSummary | null>(null)

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const membersQuery = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: Boolean(projectId),
  })
  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })
  const teamQuery = useQuery({
    queryKey: ['teams', project?.teamId],
    queryFn: () => teamApi.getById(project?.teamId ?? ''),
    enabled: Boolean(project?.teamId),
  })

  const detailQuery = useDiff(projectId, diffId)
  const diffsQuery = useDiffs(projectId, { limit: 100 })
  const filesQuery = useDiffFiles(projectId, diffId, { limit: FILE_PAGE_SIZE })
  const commentsQuery = useDiffComments(projectId, diffId, { limit: FILE_PAGE_SIZE })
  const addComment = useAddDiffComment(projectId, diffId)
  const acceptDiff = useAcceptDiff(projectId)
  const rejectDiff = useRejectDiff(projectId)
  const createMr = useCreateMergeRequest(projectId)
  const taskQuery = useTask(projectId, detailQuery.data?.taskId ?? '')

  const review = detailQuery.data
  const files = filesQuery.data?.data ?? []
  const comments = commentsQuery.data?.data ?? []

  useEffect(() => {
    const list = filesQuery.data?.data ?? []
    if (!fileHint || list.length === 0) return
    const index = list.findIndex((item) => item.path === fileHint || item.path.endsWith(fileHint))
    if (index >= 0) setFileIndex(index)
  }, [fileHint, filesQuery.data])
  const safeIndex = Math.min(fileIndex, Math.max(files.length - 1, 0))
  const current = files[safeIndex]
  const fileComments = current
    ? comments.filter((item) => item.path === current.path)
    : []
  const tree = useMemo(() => groupFiles(filesQuery.data?.data ?? []), [filesQuery.data])
  const pending = review?.status === 'PENDING_REVIEW'
  const canReviewDiff = canAcceptOrRejectDiff(project?.role, teamQuery.data?.role)
  const createMrHint = review
    ? createMergeRequestHint(review.status, review.headCommit, Boolean(createdMr))
    : '请先通过该 Diff'
  const reqChatTo = review?.requirementGroupId
    ? PATHS.projectReqChat(projectId, review.requirementGroupId)
    : PATHS.projectDetail(projectId)
  const boundRepo = reposQuery.data?.find((item) => item.id === review?.repositoryId)
  const repoLabel = boundRepo?.displayName || boundRepo?.fullName || review?.repositoryId || ''
  const members = membersQuery.data ?? []

  useEffect(() => {
    if (!review || review.status === 'ACCEPTED') return
    const newer = latestDiffForSameBranch(diffsQuery.data?.data ?? [], review)
    if (!newer || jumpedToRef.current === newer.id) return
    jumpedToRef.current = newer.id
    message.info('工作区已有新快照，已切换到最新 Diff')
    navigate(PATHS.projectCodeDiff(projectId, newer.id), { replace: true })
  }, [diffsQuery.data, message, navigate, projectId, review])

  function goFile(next: number) {
    if (next < 0 || next >= files.length) return
    setFileIndex(next)
    setDraft('')
  }

  function submitComment() {
    if (!current || !draft.trim()) return
    const firstChanged = current.hunks
      .flatMap((hunk) => hunk.lines)
      .find((line) => line.kind === 'ADD' || line.kind === 'DEL')
    const line = firstChanged?.newLine ?? firstChanged?.oldLine ?? 1
    addComment.mutate(
      {
        path: current.path,
        side: 'RIGHT',
        line,
        hunkId: current.hunks[0]?.id,
        body: draft.trim(),
      },
      {
        onSuccess: () => {
          setDraft('')
          message.success('评论已提交')
        },
        onError: (error) => message.error(formatApiError(error)),
      },
    )
  }

  function handleAccept() {
    if (!review) return
    modal.confirm({
      title: '接受该 Diff？',
      content: '接受后由受控执行基于当前快照提交，不代表已合并 MR。若该 Diff 属于任务总确认批次，后端会返回 409。',
      okText: '接受',
      onOk: () =>
        acceptDiff.mutateAsync(review.id).then(
          () => {
            message.success('已接受 Diff')
          },
          async (error: unknown) => {
            message.error(formatApiError(error))
            if (apiErrorCode(error) === 'DIFF_BATCH_REVIEW_REQUIRED') return
            const result = await diffsQuery.refetch()
            const newer = latestDiffForSameBranch(result.data?.data ?? [], review)
            if (!newer) return
            jumpedToRef.current = newer.id
            message.info('工作区已有新快照，已切换到最新 Diff')
            navigate(PATHS.projectCodeDiff(projectId, newer.id), { replace: true })
          },
        ),
    })
  }

  function handleReject() {
    if (!review) return
    let reason = ''
    modal.confirm({
      title: '拒绝该 Diff',
      content: (
        <Input.TextArea
          placeholder="请输入退回原因"
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(event) => {
            reason = event.target.value
          }}
        />
      ),
      okText: '拒绝',
      okButtonProps: { danger: true },
      onOk: () => {
        if (!reason.trim()) {
          message.warning('拒绝原因不能为空')
          return Promise.reject(new Error('reason required'))
        }
        return rejectDiff.mutateAsync({ diffId: review.id, input: { reason: reason.trim() } }).then(
          () => message.success('已拒绝 Diff'),
          (error: unknown) => {
            message.error(formatApiError(error))
          },
        )
      },
    })
  }

  function handleCreateMr() {
    if (!review || createMrHint) return
    const repository = taskQuery.data?.repositories?.find(
      (item) => item.repositoryId === review.repositoryId,
    )
    const targetBranch = boundRepo?.defaultBranch || repository?.defaultBranch || repository?.baseRef || 'main'
    const title = taskQuery.data?.title?.trim() || `Merge ${review.sourceBranch}`
    modal.confirm({
      title: '创建合并请求？',
      content: `将基于已接受的 Diff 向 ${targetBranch} 发起 MR，不会直接合并。源分支与提交 SHA 由服务端核验。`,
      okText: '创建 MR',
      onOk: () =>
        createMr.mutateAsync({
          taskId: review.taskId,
          repositoryId: review.repositoryId,
          targetBranch,
          title,
        }).then(
          (mr) => {
            setCreatedMr(mr)
            message.success(`已创建 MR #${mr.number}`)
          },
          (error: unknown) => {
            message.error(formatApiError(error))
          },
        ),
    })
  }

  if (!diffId) {
    return (
      <div className="diff-review">
        <Empty description="缺少 diffId" />
      </div>
    )
  }

  if (detailQuery.isLoading || filesQuery.isLoading) {
    return (
      <div className="diff-review">
        <div className="diff-review__empty">
          <Spin />
        </div>
      </div>
    )
  }

  if (detailQuery.isError || !review) {
    return (
      <div className="diff-review">
        <div className="diff-review__top">
          <Link to={PATHS.projectCode(projectId)} className="diff-review__back">
            <ArrowLeftOutlined /> 返回 Branch
          </Link>
        </div>
        <Alert
          type="error"
          showIcon
          style={{ margin: 24 }}
          message={detailQuery.error ? formatApiError(detailQuery.error) : '该分支没有可查看的 Diff'}
          action={
            <Button size="small" onClick={() => void detailQuery.refetch()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="diff-review">
      <header className="diff-review__top">
        <Link to={PATHS.projectCode(projectId)} className="diff-review__back">
          <ArrowLeftOutlined /> 返回 Branch
        </Link>
        <div className="diff-review__title-row">
          <h1>Diff-{taskQuery.data?.title?.trim() || review.taskId}</h1>
          <Tag color={review.status === 'PENDING_REVIEW' ? 'success' : 'default'}>
            {diffStatusLabel(review.status)}
          </Tag>
        </div>
        <p className="diff-review__branch">{review.sourceBranch}</p>
      </header>

      <div className="diff-review__toolbar">
        <Text>变更文件：{review.changeStats.files}</Text>
        <Space>
          <Button
            icon={<LeftOutlined />}
            disabled={safeIndex <= 0}
            onClick={() => goFile(safeIndex - 1)}
          />
          <Text>
            {files.length === 0 ? '0/0' : `${safeIndex + 1}/${files.length}`} 个文件
          </Text>
          <Button
            icon={<RightOutlined />}
            disabled={safeIndex >= files.length - 1}
            onClick={() => goFile(safeIndex + 1)}
          />
          <Button icon={<DownloadOutlined />} disabled>
            文件视图
          </Button>
        </Space>
      </div>

      {filesQuery.isError ? (
        <Alert
          type="error"
          showIcon
          style={{ margin: '12px 16px 0' }}
          message={formatApiError(filesQuery.error)}
        />
      ) : null}

      <div className="diff-review__body">
        <aside className="diff-review__panel" aria-label="文件树">
          <div className="diff-review__panel-head">文件树</div>
          <div className="diff-review__tree">
            {tree.map((group) => (
              <div key={group.dir || '(root)'}>
                {group.dir ? <div className="diff-review__dir">{group.dir}</div> : null}
                {group.files.map((file) => {
                  const index = files.indexOf(file)
                  const mark = diffFileStatusLabel(file.changeType || file.status)
                  return (
                    <button
                      key={file.path}
                      type="button"
                      className={`diff-review__file${index === safeIndex ? ' is-active' : ''}`}
                      onClick={() => goFile(index)}
                    >
                      <span className="diff-review__file-name">{fileName(file.path)}</span>
                      <span className={`diff-review__file-mark is-${mark.toLowerCase()}`}>{mark}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        <section className="diff-review__panel diff-review__main">
          {current ? (
            <>
              <div className="diff-review__file-meta">
                {current.path}
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  <Text type="success">+{current.additions}</Text>
                  {' / '}
                  <Text type="danger">-{current.deletions}</Text>
                </Text>
              </div>
              {current.binary ? (
                <div className="diff-review__binary">二进制文件，无法展示行级 Diff</div>
              ) : current.hunks.length === 0 ? (
                <Empty style={{ margin: 48 }} description={HUNK_UNAVAILABLE_HINT} />
              ) : (
                current.hunks.map((hunk) => (
                  <div key={hunk.id}>
                    <div className="diff-review__hunk-head">{hunk.header}</div>
                    {hunk.lines.map((line, lineIndex) => (
                      <DiffLineRow
                        key={`${hunk.id}-${lineIndex}`}
                        line={line}
                        commented={fileComments.some((item) => item.line === (line.newLine ?? line.oldLine))}
                      />
                    ))}
                  </div>
                ))
              )}
              <div className="diff-review__thread">
                {fileComments.length === 0 ? (
                  <Text type="secondary">当前文件还没有行级评论</Text>
                ) : (
                  fileComments.map((item) => (
                    <CommentCard key={item.id} comment={item} members={members} />
                  ))
                )}
                <Input.TextArea
                  id="diff-comment-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="添加评论…"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  style={{ marginTop: 8 }}
                  disabled={!pending}
                />
                <Button
                  type="primary"
                  size="small"
                  style={{ marginTop: 8 }}
                  loading={addComment.isPending}
                  disabled={!pending}
                  onClick={submitComment}
                >
                  发表评论
                </Button>
              </div>
            </>
          ) : (
            <Empty style={{ margin: 48 }} description="没有文件" />
          )}
        </section>

        <aside className="diff-review__panel diff-review__aside-wrap" aria-label="审查信息">
          <ReviewAside
            projectId={projectId}
            review={review}
            reqChatTo={reqChatTo}
            pending={pending}
            repoLabel={repoLabel}
            canReviewDiff={canReviewDiff}
            createMrHint={createMrHint}
            createdMr={createdMr}
            accepting={acceptDiff.isPending}
            rejecting={rejectDiff.isPending}
            creatingMr={createMr.isPending}
            onAccept={handleAccept}
            onReject={handleReject}
            onCreateMr={handleCreateMr}
          />
        </aside>
      </div>
    </div>
  )
}

function ReviewAside({
  projectId,
  review,
  repoLabel,
  reqChatTo,
  pending,
  canReviewDiff,
  createMrHint,
  createdMr,
  accepting,
  rejecting,
  creatingMr,
  onAccept,
  onReject,
  onCreateMr,
}: {
  projectId: string
  review: DiffDetail
  repoLabel: string
  reqChatTo: string
  pending: boolean
  canReviewDiff: boolean
  createMrHint: string | undefined
  createdMr: MergeRequestSummary | null
  accepting: boolean
  rejecting: boolean
  creatingMr: boolean
  onAccept: () => void
  onReject: () => void
  onCreateMr: () => void
}) {
  return (
    <div className="diff-review__aside">
      <h3>提交信息</h3>
      <p>仓库 {repoLabel || review.repositoryId}</p>
      <p>
        基准 <ShaText value={review.baseCommit} />
      </p>
      <p>
        提交结果 <ShaText value={review.headCommit} />
      </p>
      <p>
        Diff{' '}
        <Text type="success">+{review.changeStats.additions}</Text>
        {' / '}
        <Text type="danger">-{review.changeStats.deletions}</Text>
      </p>
      <h3 style={{ marginTop: 16 }}>关联跳转</h3>
      <Space direction="vertical" size={4}>
        <Link to={reqChatTo}>引用 Diff 回需求群</Link>
        <Link to={PATHS.projectTasks(projectId)}>跳转关联任务</Link>
        <Link to={`${PATHS.projectCode(projectId)}?tab=mr`}>查看项目 MR 列表</Link>
        <Link to={PATHS.projectDiff(projectId, review.id)}>交付中心摘要</Link>
      </Space>
      <div className="diff-review__actions">
        <Button disabled>标记评论已解决</Button>
        {canReviewDiff && pending ? (
          <Button danger loading={rejecting} onClick={onReject} aria-label="reject-diff">
            请求修改
          </Button>
        ) : null}
        <ReviewPrimaryButton
          canReviewDiff={canReviewDiff}
          pending={pending}
          accepting={accepting}
          creatingMr={creatingMr}
          createMrHint={createMrHint}
          createdMr={createdMr}
          onAccept={onAccept}
          onCreateMr={onCreateMr}
        />
      </div>
    </div>
  )
}

function canAcceptOrRejectDiff(
  projectRole: ProjectRole | undefined,
  teamRole: TeamRole | undefined,
): boolean {
  return projectRole === 'PROJECT_ADMIN' || teamRole === 'TEAM_OWNER'
}

function ReviewPrimaryButton({
  canReviewDiff,
  pending,
  accepting,
  creatingMr,
  createMrHint,
  createdMr,
  onAccept,
  onCreateMr,
}: {
  canReviewDiff: boolean
  pending: boolean
  accepting: boolean
  creatingMr: boolean
  createMrHint: string | undefined
  createdMr: MergeRequestSummary | null
  onAccept: () => void
  onCreateMr: () => void
}) {
  if (canReviewDiff && (pending || accepting)) {
    return (
      <Button
        type="primary"
        loading={accepting}
        disabled={accepting}
        onClick={onAccept}
        aria-label="accept-diff"
      >
        通过
      </Button>
    )
  }

  return (
    <>
      <Tooltip title={createMrHint}>
        <span className="diff-review__action-wrap">
          <Button
            type="primary"
            loading={creatingMr}
            disabled={Boolean(createMrHint)}
            onClick={onCreateMr}
            aria-label="create-merge-request"
          >
            创建 MR
          </Button>
        </span>
      </Tooltip>
      {createdMr?.webUrl ? (
        <a
          className="diff-review__github-mr"
          href={createdMr.webUrl}
          target="_blank"
          rel="noreferrer"
        >
          打开 MR #{createdMr.number}
        </a>
      ) : null}
      {createMrHint ? (
        <Text type="secondary">{createMrHint}</Text>
      ) : (
        <Text type="secondary">创建 MR 会发起合并请求，不会直接合入目标分支</Text>
      )}
    </>
  )
}

function latestDiffForSameBranch(
  items: DiffListItem[],
  current: Pick<DiffDetail, 'id' | 'repositoryId' | 'sourceBranch' | 'createdAt'>,
): DiffListItem | undefined {
  const newest = items.reduce<DiffListItem | undefined>((best, item) => {
    if (item.repositoryId !== current.repositoryId || item.sourceBranch !== current.sourceBranch) return best
    if (!best || item.createdAt > best.createdAt) return item
    return best
  }, undefined)
  if (!newest || newest.id === current.id || newest.createdAt <= current.createdAt) return undefined
  return newest
}

function apiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined
  const body = error.body as { error?: { code?: string } } | undefined
  return body?.error?.code
}

function createMergeRequestHint(
  status: DiffStatus,
  headCommit: string | null | undefined,
  alreadyCreated: boolean,
): string | undefined {
  if (alreadyCreated) return '该 Diff 已创建过 MR'
  if (status !== 'ACCEPTED') return '请先通过该 Diff'
  if (!headCommit) return '等待远端提交核验完成'
  return undefined
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
    <article className="diff-review__comment">
      <Avatar size={28}>{name.slice(0, 1)}</Avatar>
      <div className="diff-review__comment-body">
        <strong>{name}</strong>
        <p>{comment.body}</p>
        <time>
          {comment.line != null ? `L${comment.line} · ` : ''}
          {comment.createdAt ? comment.createdAt.replace('T', ' ').slice(0, 16) : ''}
        </time>
      </div>
    </article>
  )
}

function DiffLineRow({ line, commented }: { line: DiffLine; commented: boolean }) {
  const sign = line.kind === 'ADD' ? '+' : line.kind === 'DEL' ? '-' : ''
  return (
    <div
      className={`diff-review__line${line.kind === 'ADD' ? ' is-add' : ''}${line.kind === 'DEL' ? ' is-del' : ''}${commented ? ' has-comment' : ''}`}
    >
      <span className="diff-review__gutter">{line.oldLine ?? ''}</span>
      <span className="diff-review__gutter">{line.newLine ?? ''}</span>
      <span className="diff-review__sign">{sign}</span>
      <span className="diff-review__code">{line.text}</span>
    </div>
  )
}

function ShaText({ value, empty }: { value: string | null | undefined; empty?: string }) {
  const sha = value?.trim()
  if (!sha) {
    return <Text type="secondary">{empty ?? '-'}</Text>
  }
  return (
    <Text code title={sha}>
      {sha.slice(0, 7)}
    </Text>
  )
}

function fileName(path: string): string {
  return path.split('/').pop() || path
}

function groupFiles(files: DiffFile[]): Array<{ dir: string; files: DiffFile[] }> {
  const map = new Map<string, DiffFile[]>()
  for (const file of files) {
    const parts = file.path.split('/')
    const dir = parts.slice(0, -1).join('/')
    const list = map.get(dir) ?? []
    list.push(file)
    map.set(dir, list)
  }
  return [...map.entries()].map(([dir, grouped]) => ({ dir, files: grouped }))
}
