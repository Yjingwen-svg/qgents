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
  useMergeRequests,
  useRejectDiff,
  useTask,
} from '@/hooks/task-model'
import { findOpenMergeRequestForDiff, githubPullRequestUrl } from './mergeRequestDisplay'
import { isEmptyBranchDiffId } from './emptyBranchDiff'
import { diffFileStatusLabel, diffStatusLabel } from '@/types/diff'
import { usePreflight } from '@/hooks/qualityGate'
import { readApiErrorCode, readApiErrorDetails } from '@/api/qualityGate'
import { PreflightPanel } from './PreflightPanel'
import { preflightBlockerLabel, requiresRedoDryRun, requiresSourceRefresh } from './preflightDisplay'
import type { ProjectRole } from '@/types/project'
import type { TeamRole } from '@/types/team'
import type { DiffComment, DiffDetail, DiffFile, DiffLine, DiffListItem, DiffStatus, MergeRequestSummary } from '@/types/task-model'
import type { Preflight } from '@/types/qualityGate'
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
 * POST /projects/{projectId}/merge-requests  // 创建 MR；成功后跳站内详情
 * GET  /projects/{projectId}/merge-requests  // 刷新后用 OPEN 列表恢复「已开过 MR」
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

  const emptyBranchShell = isEmptyBranchDiffId(diffId)
  const liveDiffId = emptyBranchShell ? '' : diffId
  const detailQuery = useDiff(projectId, liveDiffId)
  const diffsQuery = useDiffs(projectId, { limit: 100 })
  const filesQuery = useDiffFiles(projectId, liveDiffId, { limit: FILE_PAGE_SIZE })
  const commentsQuery = useDiffComments(projectId, liveDiffId, { limit: FILE_PAGE_SIZE })
  const addComment = useAddDiffComment(projectId, liveDiffId)
  const acceptDiff = useAcceptDiff(projectId)
  const rejectDiff = useRejectDiff(projectId)
  const createMr = useCreateMergeRequest(projectId)
  const taskQuery = useTask(projectId, detailQuery.data?.taskId ?? '')
  const openMrsQuery = useMergeRequests(
    projectId,
    {
      repositoryId: detailQuery.data?.repositoryId,
      status: 'OPEN',
      limit: 50,
    },
    { enabled: Boolean(detailQuery.data?.repositoryId) },
  )

  const review = detailQuery.data
  const files = filesQuery.data?.data ?? []
  const comments = commentsQuery.data?.data ?? []
  const existingMr = useMemo(
    () => (review ? findOpenMergeRequestForDiff(openMrsQuery.data?.data ?? [], review) ?? null : null),
    [openMrsQuery.data, review],
  )

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
  const boundRepo = reposQuery.data?.find((item) => item.id === review?.repositoryId)
  const taskRepository = taskQuery.data?.repositories?.find(
    (item) => item.repositoryId === review?.repositoryId,
  )
  const targetBranch = review
    ? boundRepo?.defaultBranch || taskRepository?.defaultBranch || taskRepository?.baseRef || 'main'
    : undefined
  const preflightQuery = usePreflight(
    projectId,
    review?.taskId ?? '',
    review?.repositoryId ?? '',
    targetBranch ?? '',
  )
  const preflight = preflightQuery.data
  const createMrHint = review
    ? createMergeRequestHint(
        review.status,
        review.headCommit,
        Boolean(existingMr) && review.status === 'ACCEPTED',
        preflight,
      )
    : '请先通过该 Diff'
  const githubMrUrl = existingMr
    ? githubPullRequestUrl(existingMr.webUrl, existingMr.number, boundRepo)
    : null
  const reqChatTo = review?.requirementGroupId
    ? PATHS.projectReqChat(projectId, review.requirementGroupId)
    : PATHS.projectDetail(projectId)
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
    if (!review || createMrHint || !targetBranch) return
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
            message.success(`已创建 MR #${mr.number}`)
            navigate(PATHS.projectCodeMr(projectId, mr.id))
          },
          (error: unknown) => {
            const code = readApiErrorCode(error)
            if (code === 'MR_PREFLIGHT_NOT_PASSED') {
              void preflightQuery.refetch()
              const blockers = readApiErrorDetails(error)
                .map((detail) => preflightBlockerLabel(detail.code, detail.message))
                .join('；')
              message.error(blockers ? `预检未通过：${blockers}` : 'MR 前预检未通过，请处理 blockers 后重试')
            } else if (requiresSourceRefresh(code)) {
              message.warning('源分支有新提交，请刷新 Task/Diff 后重新预检（不会自动重试创建 MR）')
              void preflightQuery.refetch()
            } else if (requiresRedoDryRun(code)) {
              message.warning('预检上下文已变化，请重新发起 Dry Run 并重新 CQ+1')
              void preflightQuery.refetch()
            } else {
              message.error(formatApiError(error))
            }
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

  // 代码与 Branch：+/- 为 0 且无真实快照时进入的空壳
  if (emptyBranchShell) {
    return (
      <div className="diff-review">
        <header className="diff-review__top">
          <Link to={PATHS.projectCode(projectId)} className="diff-review__back">
            <ArrowLeftOutlined /> 返回 Branch
          </Link>
          <div className="diff-review__title-row">
            <h1>Diff</h1>
            <Tag>无变更</Tag>
          </div>
          <p className="diff-review__branch">该分支当前没有可查看的代码变更</p>
        </header>
        <div className="diff-review__toolbar">
          <Text>变更文件：0</Text>
          <Space>
            <Text type="success">+0</Text>
            <Text type="danger">-0</Text>
          </Space>
        </div>
        <Empty style={{ margin: 48 }} description="没有文件" />
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
            existingMr={existingMr}
            githubMrUrl={githubMrUrl}
            accepting={acceptDiff.isPending}
            rejecting={rejectDiff.isPending}
            creatingMr={createMr.isPending}
            preflight={preflight}
            preflightLoading={preflightQuery.isLoading}
            preflightError={preflightQuery.error}
            onRefreshPreflight={() => void preflightQuery.refetch()}
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
  existingMr,
  githubMrUrl,
  accepting,
  rejecting,
  creatingMr,
  preflight,
  preflightLoading,
  preflightError,
  onRefreshPreflight,
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
  existingMr: MergeRequestSummary | null
  githubMrUrl: string | null
  accepting: boolean
  rejecting: boolean
  creatingMr: boolean
  preflight: Preflight | undefined
  preflightLoading: boolean
  preflightError: Error | null
  onRefreshPreflight: () => void
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
      <h3 style={{ marginTop: 16 }}>MR 前预检</h3>
      <PreflightPanel
        preflight={preflight}
        loading={preflightLoading}
        error={preflightError}
        onRefresh={onRefreshPreflight}
      />
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
          existingMr={existingMr}
          githubMrUrl={githubMrUrl}
          projectId={projectId}
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
  existingMr,
  githubMrUrl,
  projectId,
  onAccept,
  onCreateMr,
}: {
  canReviewDiff: boolean
  pending: boolean
  accepting: boolean
  creatingMr: boolean
  createMrHint: string | undefined
  existingMr: MergeRequestSummary | null
  githubMrUrl: string | null
  projectId: string
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
      {githubMrUrl && existingMr ? (
        <a
          className="diff-review__github-mr"
          href={githubMrUrl}
          target="_blank"
          rel="noreferrer"
        >
          打开 MR #{existingMr.number}
        </a>
      ) : existingMr ? (
        <Link className="diff-review__github-mr" to={PATHS.projectCodeMr(projectId, existingMr.id)}>
          查看 MR #{existingMr.number}
        </Link>
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
  preflight: Preflight | undefined,
): string | undefined {
  if (alreadyCreated) return '该 Diff 已创建过 MR'
  if (status !== 'ACCEPTED') return '请先通过该 Diff'
  if (!headCommit) return '等待远端提交核验完成'
  if (preflight) {
    if (preflight.status === 'PASSED') return undefined
    if (preflight.status === 'STALE') return '预检已失效，请重新 Dry Run + CQ+1'
    if (preflight.status === 'FAILED') return '预检未通过，请处理 blockers'
    return '预检进行中，请等待完成'
  }
  return '等待 MR 前预检结果'
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
