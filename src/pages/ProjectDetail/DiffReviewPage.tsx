import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Avatar,
  Empty,
  App,
} from 'antd'
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
  CommentOutlined,
} from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import {
  diffFileStatusLabel,
  diffStatusLabel,
  type DiffComment,
  type DiffFile,
  type DiffLine,
} from '@/types/diff'
import { getDemoDiffReview } from './diffReviewDemo'
import './DiffReviewPage.css'

const { Text } = Typography

/**
 * Diff 与 CR 详情
 * 入口：代码与 Branch → 点击 Diff 列 +/-
 *
 * TODO[后端联调] GET /projects/{projectId}/diffs/{diffId}
 * TODO[后端联调] GET /projects/{projectId}/diffs/{diffId}/files
 * TODO[后端联调] GET/POST /projects/{projectId}/diffs/{diffId}/comments
 * 本期指定 Reviewer / Reviewer 管理不做。
 */
export function DiffReviewPage() {
  const { message } = App.useApp()
  const { projectId = '', branchId = '' } = useParams<{
    projectId: string
    branchId: string
  }>()
  const review = useMemo(() => getDemoDiffReview(branchId), [branchId])
  const [fileIndex, setFileIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [localComments, setLocalComments] = useState<DiffComment[]>([])

  if (!review) {
    return (
      <div className="diff-review">
        <div className="diff-review__top">
          <Link to={PATHS.projectCode(projectId)} className="diff-review__back">
            <ArrowLeftOutlined /> 返回代码与 Branch
          </Link>
        </div>
        <div className="diff-review__empty">
          <Empty description="该分支没有可查看的 Diff" />
        </div>
      </div>
    )
  }

  const files = review.files
  const safeIndex = Math.min(fileIndex, Math.max(files.length - 1, 0))
  const current = files[safeIndex]
  const comments = [...review.comments, ...localComments]
  const fileComments = current
    ? comments.filter((item) => item.path === current.path)
    : []

  function goFile(next: number) {
    if (next < 0 || next >= files.length) return
    setFileIndex(next)
    setDraft('')
  }

  function addComment() {
    if (!current || !draft.trim()) return
    const firstChanged = current.hunks
      .flatMap((hunk) => hunk.lines)
      .find((line) => line.kind === 'ADD' || line.kind === 'DEL')
    const line = firstChanged?.newLine ?? firstChanged?.oldLine ?? 1
    setLocalComments((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        authorName: '我',
        body: draft.trim(),
        createdAt: new Date().toISOString(),
        path: current.path,
        line,
        side: 'RIGHT',
      },
    ])
    setDraft('')
    message.success('评论已添加到当前文件（演示，未提交后端）')
  }

  const tree = groupFiles(files)
  const reqChatTo = review.requirementGroupId
    ? PATHS.projectReqChat(projectId, review.requirementGroupId)
    : PATHS.projectDetail(projectId)

  return (
    <div className="diff-review">
      <header className="diff-review__top">
        <Link to={PATHS.projectCode(projectId)} className="diff-review__back">
          <ArrowLeftOutlined /> 返回 Diff 列表
        </Link>
        <p className="diff-review__crumb">
          需求群：{review.requirementTitle || '—'}
          {review.taskCode ? ` / 任务 ${review.taskCode}` : ''}
          {` / ${review.repositoryName} / ${review.sourceBranch} → ${review.targetBranch}`}
        </p>
        <div className="diff-review__title-row">
          <h1>
            Diff {review.displayCode} · {review.title}
          </h1>
          <Tag color={review.status === 'PENDING_REVIEW' ? 'success' : 'default'}>
            {diffStatusLabel(review.status)}
          </Tag>
          {review.headCommit ? (
            <Text type="secondary">
              SHA <Text code>{review.headCommit}</Text>
            </Text>
          ) : null}
        </div>
      </header>

      <div className="diff-review__toolbar">
        <Text>变更文件：{review.changeStats.files}</Text>
        <Space>
          <Button icon={<CommentOutlined />} onClick={() => document.getElementById('diff-comment-input')?.focus()}>
            添加评论
          </Button>
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

      <div className="diff-review__body">
        <aside className="diff-review__panel" aria-label="文件树">
          <div className="diff-review__panel-head">文件树</div>
          <div className="diff-review__tree">
            {tree.map((group) => (
              <div key={group.dir || '(root)'}>
                {group.dir ? <div className="diff-review__dir">{group.dir}</div> : null}
                {group.files.map((file) => {
                  const index = files.indexOf(file)
                  const mark = diffFileStatusLabel(file.status)
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
                    <article key={item.id} className="diff-review__comment">
                      <Avatar size={28}>{item.authorName.slice(0, 1)}</Avatar>
                      <div className="diff-review__comment-body">
                        <strong>
                          {item.authorName}
                          {item.replyToId ? ' · 回复' : ''}
                          {item.resolved ? ' · 已解决' : ''}
                        </strong>
                        <p>{item.body}</p>
                        <time>L{item.line} · {item.createdAt.replace('T', ' ').slice(0, 16)}</time>
                      </div>
                    </article>
                  ))
                )}
                <Input.TextArea
                  id="diff-comment-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="添加评论…"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  style={{ marginTop: 8 }}
                />
                <Button type="primary" size="small" style={{ marginTop: 8 }} onClick={addComment}>
                  发表评论
                </Button>
              </div>
            </>
          ) : (
            <Empty style={{ margin: 48 }} description="没有文件" />
          )}
        </section>

        <aside className="diff-review__panel diff-review__aside-wrap" aria-label="审查信息">
          <div className="diff-review__aside">
            <h3>提交信息</h3>
            <p>作者 {review.authorName}</p>
            <p>
              Diff{' '}
              <Text type="success">+{review.changeStats.additions}</Text>
              {' / '}
              <Text type="danger">-{review.changeStats.deletions}</Text>
            </p>
            <h3 style={{ marginTop: 16 }}>Agent 助手</h3>
            <p>可参与审查（演示占位，本期不做 Reviewer 指定）</p>
            <h3 style={{ marginTop: 16 }}>关联跳转</h3>
            <Space direction="vertical" size={4}>
              <Link to={reqChatTo}>引用 Diff 回需求群</Link>
              <Link to={PATHS.projectTasks(projectId)}>跳转关联任务</Link>
            </Space>
            <div className="diff-review__actions">
              <Button
                onClick={() => message.success('演示：已标记评论已解决')}
              >
                标记评论已解决
              </Button>
              <Button danger onClick={() => message.warning('演示：已请求修改')}>
                请求修改
              </Button>
              <Button
                type="primary"
                onClick={() => message.info('创建 MR 需要已接受的 Diff；本页第一版先占位')}
              >
                创建 MR
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
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
