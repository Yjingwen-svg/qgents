/**
 * Diff / CR 页面前端模型
 *
 * TODO[后端联调] 对齐 GET /projects/{projectId}/diffs/{diffId}
 * 与 GET /projects/{projectId}/diffs/{diffId}/files、/comments。
 * 当前「代码与 Branch」点 +/- 进入的详情页先用演示数据。
 */

export type DiffReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED'

export type DiffFileStatus = 'ADDED' | 'MODIFIED' | 'DELETED'

export type DiffLineKind = 'CONTEXT' | 'ADD' | 'DEL'

export type DiffCommentSide = 'LEFT' | 'RIGHT'

export interface DiffChangeStats {
  files: number
  additions: number
  deletions: number
}

export interface DiffLine {
  kind: DiffLineKind
  oldLine: number | null
  newLine: number | null
  text: string
}

export interface DiffHunk {
  id: string
  header: string
  lines: DiffLine[]
}

export interface DiffFile {
  path: string
  status: DiffFileStatus
  additions: number
  deletions: number
  binary: boolean
  hunks: DiffHunk[]
}

export interface DiffComment {
  id: string
  authorName: string
  body: string
  createdAt: string
  path: string
  line: number
  side: DiffCommentSide
  resolved?: boolean
  replyToId?: string
}

export interface DiffReviewView {
  id: string
  displayCode: string
  title: string
  status: DiffReviewStatus
  sourceBranch: string
  targetBranch: string
  repositoryName: string
  taskCode?: string
  taskTitle?: string
  requirementGroupId?: string
  requirementTitle?: string
  authorName: string
  headCommit?: string
  changeStats: DiffChangeStats
  files: DiffFile[]
  comments: DiffComment[]
}

export function diffStatusLabel(status: DiffReviewStatus): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return '进行中'
    case 'ACCEPTED':
      return '已接受'
    case 'REJECTED':
      return '已拒绝'
  }
}

export function diffFileStatusLabel(status: DiffFileStatus): string {
  switch (status) {
    case 'ADDED':
      return 'A'
    case 'MODIFIED':
      return 'M'
    case 'DELETED':
      return 'D'
  }
}
