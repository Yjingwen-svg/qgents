import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, Input, Spin, Typography } from 'antd'
import { BranchesOutlined, DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons'
import { useDiffFiles } from '@/hooks/task-model'
import { diffFileStatusLabel } from '@/types/diff'
import { PATHS } from '@/routes/paths'
import type { DiffFile, DiffLine } from '@/types/task-model'
import type { DiffMessageContent, Message } from '@/types'

const { Text } = Typography

/** 群聊内联 Diff 展开区的固定高度（左右栏内部各自滚动） */
const PANEL_HEIGHT = 440
/** 文件变更行数（additions + deletions）超过该值 → 群聊内不渲染行级 diff，提示跳转详情 */
const INLINE_MAX_CHANGED_LINES = 200
/** 左栏文件树宽度 */
const FILE_TREE_WIDTH = 208

interface Props {
  message: Message
  projectId: string
  onReply?: (m: Message) => void
}

/**
 * 群聊内 Diff 卡片 —— 固定高度可展开的「文件树 + 代码提交 diff 视图」框。
 * - 头部摘要保留；点「展开 Diff」拉出固定高度左右分栏（文件树 / 行级 diff），再点收起
 * - 文件树中变更文件用绿色圆点 + A/M/D 标记；点哪个文件就打开哪个文件的 diff
 * - 文件变更行数 > 200 行 → 提示「文件太长」，点击跳转 Diff 详情页
 * - 「查看 Diff」跳转 /app/projects/:projectId/code/diff/:diffId（代码提交 diff 视图）
 */
export function ChatDiffCard({ message, projectId, onReply }: Props) {
  const c = message.content as DiffMessageContent
  const diffId = c.diffId ?? ''
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // 展开后才拉取文件列表：消息列表可能有多条 Diff 卡，避免全部预取
  const { data, isLoading } = useDiffFiles(projectId, open ? diffId : '', { limit: 100 })
  // 稳定化引用：避免每次渲染产生新数组导致下方 useMemo 重算
  const files = useMemo(() => data?.data ?? [], [data])

  const visibleFiles = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => f.path.toLowerCase().includes(q))
  }, [files, keyword])

  // 首次加载 / 关键词过滤后，自动选中第一个可见文件
  useEffect(() => {
    if (visibleFiles.length === 0) return
    if (!visibleFiles.some((f) => f.path === selectedPath)) {
      setSelectedPath(visibleFiles[0].path)
    }
  }, [visibleFiles, selectedPath])

  const current = visibleFiles.find((f) => f.path === selectedPath) ?? visibleFiles[0]
  const changedLines = (current?.additions ?? 0) + (current?.deletions ?? 0)
  const tooLong = changedLines > INLINE_MAX_CHANGED_LINES
  const tree = useMemo(() => groupFiles(visibleFiles), [visibleFiles])

  const displayTitle = c.displayCode
    ? `${c.displayCode}${c.repositoryName ? ` · ${c.repositoryName}` : ''}${c.sourceBranch ? ` / ${c.sourceBranch}` : ''}`
    : (c.title ?? '代码交付')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: 8,
        background: 'rgba(59, 130, 246, 0.06)',
        minWidth: 220,
        maxWidth: '100%',
      }}
    >
      {/* 头部：Diff 码 · 仓库 / 源分支 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BranchesOutlined style={{ fontSize: 16, color: '#3b82f6' }} />
        <Text strong style={{ fontSize: 14 }}>{displayTitle}</Text>
      </div>
      {/* 目标分支与变更统计 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {c.repositoryName && c.targetBranch ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            -{c.repositoryName}/{c.targetBranch}
          </Text>
        ) : null}
        {c.additions != null ? (
          <Text style={{ fontSize: 12, color: '#16a34a' }}>+{c.additions}</Text>
        ) : null}
        {c.deletions != null ? (
          <Text style={{ fontSize: 12, color: '#dc2626' }}>-{c.deletions}</Text>
        ) : null}
        {files.length > 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>{files.length} 个文件</Text>
        ) : null}
      </div>
      {/* 变更文件列表（收起时展示路径摘要） */}
      {!open && c.files && c.files.length > 0 ? (
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
          {c.files.slice(0, 5).map((file) => (
            <div key={file} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file}
            </div>
          ))}
          {c.files.length > 5 ? (
            <Text type="secondary">…共 {c.files.length} 个文件</Text>
          ) : null}
        </div>
      ) : null}
      {/* 操作：展开 / 查看 Diff / 引用继续修改 */}
      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
        <Button
          size="small"
          type="link"
          icon={open ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '收起 Diff' : '展开 Diff'}
        </Button>
        <Link to={PATHS.projectCodeDiff(projectId, diffId)}>
          <Button size="small" type="link" icon={<BranchesOutlined />}>
            查看 Diff
          </Button>
        </Link>
        {onReply ? (
          <Button size="small" type="link" onClick={() => onReply(message)}>
            引用继续修改
          </Button>
        ) : null}
      </div>

      {/* 展开区：固定高度「文件树 + diff 视图」左右分栏。
          宽度固定 820px（窄屏受气泡 maxWidth 78% 限制收缩，不会溢出），
          避免右侧代码行少时整框跟着缩水；代码超长行在右侧内容区横向滚动。 */}
      {open ? (
        <div
          style={{
            display: 'flex',
            width: 820,
            maxWidth: '100%',
            height: PANEL_HEIGHT,
            marginTop: 8,
            border: '1px solid #d9e2ef',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {/* 左栏：文件树 */}
          <div
            style={{
              width: FILE_TREE_WIDTH,
              flexShrink: 0,
              borderRight: '1px solid #eef2f6',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#5b6b82',
                borderBottom: '1px solid #eef2f6',
              }}
            >
              📂 文件树
            </div>
            <div style={{ padding: 8 }}>
              <Input
                size="small"
                prefix={<SearchOutlined />}
                placeholder="Filter files…"
                allowClear
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin size="small" />
                </div>
              ) : tree.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有文件" />
              ) : (
                tree.map((group) => (
                  <div key={group.dir || '(root)'}>
                    {group.dir ? (
                      <div style={{ padding: '6px 12px 2px', fontSize: 12, color: '#5b6b82' }}>
                        {group.dir}
                      </div>
                    ) : null}
                    {group.files.map((file) => {
                      const active = current?.path === file.path
                      const mark = diffFileStatusLabel(file.changeType || file.status)
                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setSelectedPath(file.path)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            border: 0,
                            background: active ? '#eef8f6' : 'transparent',
                            padding: '6px 12px 6px 20px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: 'inherit',
                          }}
                        >
                          {/* 有 diff 的文件的绿色符号标记 */}
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: '#16a34a',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 13,
                            }}
                          >
                            {fileName(file.path)}
                          </span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: 11,
                              fontWeight: 800,
                              color: mark === 'A' ? '#16a34a' : mark === 'M' ? '#2563eb' : '#dc2626',
                            }}
                          >
                            {mark}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右栏：行级 diff 视图（整体横向滚动：内容按最长代码行撑宽，一个总滚动条） */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#fff' }}>
            {current ? (
              <>
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #eef2f6',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {current.path}
                  </span>
                  <Text type="success" style={{ fontSize: 12 }}>+{current.additions}</Text>
                  <Text type="danger" style={{ fontSize: 12 }}>-{current.deletions}</Text>
                </div>
                {tooLong ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: '#5b6b82' }}>
                    <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                      文件变更 {changedLines} 行，内容过长，群聊内不展示行级 Diff
                    </Text>
                    <Link to={PATHS.projectCodeDiff(projectId, diffId)}>
                      <Button size="small" type="primary">
                        查看完整 Diff
                      </Button>
                    </Link>
                  </div>
                ) : current.binary || current.hunks.length === 0 ? (
                  <Empty style={{ margin: 40 }} description="无行级 Diff（二进制文件或暂无 hunks）" />
                ) : (
                  <div style={{ width: 'max-content', minWidth: '100%' }}>
                    {current.hunks.map((hunk) => (
                      <div key={hunk.id}>
                        <div
                          style={{
                            padding: '6px 12px',
                            background: '#f4f7fb',
                            color: '#5b6b82',
                            fontFamily: 'ui-monospace, Consolas, monospace',
                            fontSize: 12,
                          }}
                        >
                          {hunk.header}
                        </div>
                        {hunk.lines.map((line, lineIndex) => (
                          <DiffLineRow key={`${hunk.id}-${lineIndex}`} line={line} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Empty style={{ margin: 40 }} description="没有文件" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** 行级 diff：行号 + 符号 + 内容（ADD 绿底 / DEL 红底）。
 *  代码列不换行不截断，由右侧内容区的总横向滚动条统一滚动（行号列固定不跟着滚）。 */
function DiffLineRow({ line }: { line: DiffLine }) {
  const sign = line.kind === 'ADD' ? '+' : line.kind === 'DEL' ? '-' : ''
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: 12,
        lineHeight: 1.55,
        background: line.kind === 'ADD' ? '#e7f8ee' : line.kind === 'DEL' ? '#fdecec' : undefined,
      }}
    >
      <span style={{ width: 44, flexShrink: 0, color: '#94a3b8', textAlign: 'right', padding: '0 6px', userSelect: 'none' }}>
        {line.oldLine ?? ''}
      </span>
      <span style={{ width: 44, flexShrink: 0, color: '#94a3b8', textAlign: 'right', padding: '0 6px', userSelect: 'none' }}>
        {line.newLine ?? ''}
      </span>
      <span style={{ width: 22, flexShrink: 0, textAlign: 'center', fontWeight: 700 }}>{sign}</span>
      <span style={{ padding: '0 10px', whiteSpace: 'pre' }}>{line.text}</span>
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
