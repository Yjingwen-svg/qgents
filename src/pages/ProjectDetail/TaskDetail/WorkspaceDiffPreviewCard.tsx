import { useMemo, useState } from 'react'
import { Alert, Button, Card, Collapse, Empty, Spin, Tag, Typography } from 'antd'
import { CaretRightOutlined, FileTextOutlined } from '@ant-design/icons'
import { useWorkspaceDiffPreview, useWorkspaceDiffPreviewFiles } from '@/hooks/workspaceDiffPreview'
import type {
  Task,
  WorkspaceDiffPreviewFile,
  WorkspaceDiffPreviewStatus,
} from '@/types/task-model'
import styles from './TaskDetailPage.module.scss'

const { Text } = Typography

interface WorkspaceDiffPreviewCardProps {
  projectId: string
  taskId: string
  taskStatus: Task['status']
  repositoryNames: Record<string, string>
}

/**
 * Workspace 实时 Diff Preview 卡片。
 *
 * 语义边界：
 * - 仅展示 Coding 写入触发的累计工作树视图，不代表已生成正式 Diff。
 * - 失败/不可用时显示「实时预览暂不可用」，不污染任务状态。
 * - 多仓库文件按 repositoryId 分组显示，路径使用 Workspace 相对路径。
 */
export function WorkspaceDiffPreviewCard({ projectId, taskId, taskStatus, repositoryNames }: WorkspaceDiffPreviewCardProps) {
  const previewQuery = useWorkspaceDiffPreview(projectId, taskId)
  const filesQuery = useWorkspaceDiffPreviewFiles(projectId, taskId)
  const status = previewQuery.data

  const summary = useMemo(() => buildSummary(status, previewQuery.isLoading, filesQuery.isLoading, filesQuery.data?.length ?? 0), [
    status,
    previewQuery.isLoading,
    filesQuery.isLoading,
    filesQuery.data,
  ])
  const filesByRepository = useMemo(() => groupFilesByRepository(filesQuery.data ?? [], repositoryNames), [filesQuery.data, repositoryNames])

  // 默认折叠：用户展开后才加载更详细的 patch。折叠状态保留 —— SSE 刷新不会"啪"地打开/关闭。
  const [expanded, setExpanded] = useState(false)

  // SUCCEEDED 之后，正式交付区域会接管；卡片折叠保留，但不主动消失。
  const isTerminal = taskStatus === 'SUCCEEDED' || taskStatus === 'FAILED' || taskStatus === 'CANCELLED'

  return (
    <Card className={styles.workspaceDiffPreviewCard} size="small" data-testid="workspace-diff-preview-card">
      <div className={styles.cardHeading}>
        <span><FileTextOutlined />实时预览</span>
        <Text type="secondary" data-testid="workspace-diff-preview-summary">{summary.headline}</Text>
      </div>
      {summary.kind === 'loading' ? (
        <div className={styles.inlineState}><Spin size="small" /><Text type="secondary">正在加载实时预览</Text></div>
      ) : summary.kind === 'empty' ? (
        <Text type="secondary" className={styles.compactEmpty}>Coding 尚未产生可预览的工作树变更</Text>
      ) : summary.kind === 'unavailable' ? (
        <Alert
          type="info"
          showIcon
          className={styles.workspaceDiffPreviewAlert}
          message="实时预览暂不可用"
          description={summary.message ?? null}
          action={
            <Button size="small" onClick={() => { void previewQuery.refetch(); void filesQuery.refetch() }}>重试</Button>
          }
        />
      ) : summary.kind === 'available' ? (
        <>
          <Text type="secondary" data-testid="workspace-diff-preview-stats">{summary.detail}</Text>
          {isTerminal ? <Text type="secondary" className={styles.workspaceDiffPreviewNote}>任务已结束，正式 Diff 区域优先展示，实时预览保留备查。</Text> : null}
          <Collapse
            ghost
            className={styles.workspaceDiffPreviewCollapse}
            activeKey={expanded ? ['preview'] : []}
            onChange={(keys) => setExpanded(Array.isArray(keys) ? keys.includes('preview') : keys === 'preview')}
            items={[{
              key: 'preview',
              label: expanded ? '收起实时 Diff' : '查看实时 Diff',
              children: (
                filesQuery.isLoading ? (
                  <div className={styles.inlineState}><Spin size="small" /><Text type="secondary">正在加载文件列表</Text></div>
                ) : filesByRepository.length === 0 ? (
                  <Empty description={filesLoading ? '正在加载文件列表' : '暂无文件'} />
                ) : (
                  <div className={styles.workspaceDiffPreviewFiles}>
                    {filesByRepository.map(({ repositoryId, repositoryName, files }) => (
                      <div key={repositoryId} className={styles.workspaceDiffPreviewRepo}>
                        <Text strong className={styles.workspaceDiffPreviewRepoName}>{repositoryName}</Text>
                        <Text type="secondary">{files.length} 个文件 · +{sum(files, 'additions')} / -{sum(files, 'deletions')}</Text>
                        <ul className={styles.workspaceDiffPreviewFileList}>
                          {files.map((file) => (
                            <li key={`${repositoryId}:${file.path}`} className={styles.workspaceDiffPreviewFileItem}>
                              <Tag color={file.changeType === 'ADDED' ? 'green' : file.changeType === 'DELETED' ? 'red' : file.changeType === 'RENAMED' ? 'blue' : 'orange'}>{file.changeType}</Tag>
                              <span className={styles.workspaceDiffPreviewPath} title={file.path}>{file.path}</span>
                              <Text type="secondary" className={styles.workspaceDiffPreviewStats}>+{file.additions} / -{file.deletions}{file.binary ? ' · binary' : ''}</Text>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              ),
              extra: <CaretRightOutlined rotate={expanded ? 90 : 0} aria-hidden />,
            }]}
          />
        </>
      ) : null}
    </Card>
  )
}

interface Summary {
  kind: 'loading' | 'empty' | 'unavailable' | 'available'
  headline: string
  detail?: string
  message?: string
}

function buildSummary(
  status: WorkspaceDiffPreviewStatus | undefined,
  previewLoading: boolean,
  filesLoading: boolean,
  filesCount: number,
): Summary {
  if (previewLoading) {
    return { kind: 'loading', headline: '正在加载实时预览' }
  }
  if (!status) {
    return { kind: 'loading', headline: '正在加载实时预览' }
  }
  if (status.kind === 'unavailable') {
    return {
      kind: 'unavailable',
      headline: '实时预览暂不可用',
      message: unavailableMessage(status.reason, status.message),
    }
  }
  const preview = status.preview
  if (preview.filesChanged === 0 && filesCount === 0 && !filesLoading) {
    return { kind: 'empty', headline: 'Coding 尚未产生可预览的工作树变更' }
  }
  return {
    kind: 'available',
    headline: `实时预览：${preview.filesChanged} 个文件 · +${preview.additions} / -${preview.deletions} · revision ${preview.revision}`,
    detail: `revision ${preview.revision} · workingTreeHash ${preview.workingTreeHash}`,
  }
}

function unavailableMessage(reason: 'NOT_FOUND' | 'WORKER_UNAVAILABLE' | 'UNKNOWN', fallback: string): string {
  if (reason === 'WORKER_UNAVAILABLE') return 'Worker 暂不可用，实时预览暂不可用；任务执行不受影响。'
  if (reason === 'NOT_FOUND') return 'Coding 尚未触发写入，实时预览待生成。'
  return fallback
}

interface RepositoryGroup {
  repositoryId: string
  repositoryName: string
  files: WorkspaceDiffPreviewFile[]
}

function groupFilesByRepository(files: WorkspaceDiffPreviewFile[], names: Record<string, string>): RepositoryGroup[] {
  const map = new Map<string, RepositoryGroup>()
  for (const file of files) {
    const existing = map.get(file.repositoryId)
    if (existing) {
      existing.files.push(file)
      continue
    }
    map.set(file.repositoryId, {
      repositoryId: file.repositoryId,
      repositoryName: file.repositoryPath || names[file.repositoryId] || file.repositoryId,
      files: [file],
    })
  }
  return [...map.values()].sort((left, right) => left.repositoryName.localeCompare(right.repositoryName))
}

function sum(files: WorkspaceDiffPreviewFile[], key: 'additions' | 'deletions'): number {
  return files.reduce((acc, file) => acc + (key === 'additions' ? file.additions : file.deletions), 0)
}
