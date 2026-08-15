import type {
  DiffComment,
  DiffFile,
  DiffFileStatus,
  DiffHunk,
  DiffLine,
  DiffLineKind,
  MergeRequestCheck,
  MergeRequestCheckName,
  MergeRequestStatus,
  MergeRequestSummary,
  TaskModelPage,
} from '@/types/task-model'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function mapChangeType(value: unknown): DiffFileStatus {
  if (value === 'ADDED' || value === 'MODIFIED' || value === 'DELETED') return value
  return 'MODIFIED'
}

function mapLineKind(value: unknown): DiffLineKind {
  if (value === 'ADD' || value === 'DEL' || value === 'CONTEXT') return value
  return 'CONTEXT'
}

function mapLines(raw: unknown): DiffLine[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!isRecord(item)) return []
    return [
      {
        kind: mapLineKind(item.kind),
        oldLine: typeof item.oldLine === 'number' ? item.oldLine : null,
        newLine: typeof item.newLine === 'number' ? item.newLine : null,
        text: readString(item, 'text'),
      },
    ]
  })
}

function mapHunks(raw: unknown): DiffHunk[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!isRecord(item)) return []
    return [
      {
        id: readString(item, 'id') || `hunk-${index + 1}`,
        header: readString(item, 'header'),
        lines: mapLines(item.lines),
      },
    ]
  })
}

/** DiffFileResponse：changeType；若仍带 status / hunks 则一并收。 */
export function mapDiffFile(raw: unknown): DiffFile {
  const row = isRecord(raw) ? raw : {}
  const changeType = mapChangeType(row.changeType ?? row.status)
  return {
    id: readString(row, 'id'),
    sequence: readNumber(row, 'sequence'),
    path: readString(row, 'path'),
    changeType,
    status: changeType,
    additions: readNumber(row, 'additions'),
    deletions: readNumber(row, 'deletions'),
    binary: row.binary === true,
    hunks: mapHunks(row.hunks),
  }
}

export function mapDiffFilePage(page: TaskModelPage<unknown>): TaskModelPage<DiffFile> {
  const data = Array.isArray(page.data) ? page.data.map(mapDiffFile) : []
  return { ...page, data }
}

/** DiffCommentResponse：authorUserId + createdAt；authorName 需补前可缺。 */
export function mapDiffComment(raw: unknown): DiffComment {
  const row = isRecord(raw) ? raw : {}
  return {
    id: readString(row, 'id'),
    diffId: readString(row, 'diffId') || null,
    path: typeof row.path === 'string' ? row.path : null,
    side: typeof row.side === 'string' ? row.side : null,
    line: typeof row.line === 'number' ? row.line : null,
    hunkId: typeof row.hunkId === 'string' ? row.hunkId : null,
    commitSha: typeof row.commitSha === 'string' ? row.commitSha : null,
    body: readString(row, 'body'),
    authorUserId: typeof row.authorUserId === 'string' ? row.authorUserId : null,
    authorName: typeof row.authorName === 'string' ? row.authorName : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
  }
}

export function mapDiffCommentPage(page: TaskModelPage<unknown>): TaskModelPage<DiffComment> {
  const data = Array.isArray(page.data) ? page.data.map(mapDiffComment) : []
  return { ...page, data }
}

function mapCheckName(value: unknown): MergeRequestCheckName | null {
  if (value === 'TESTSET' || value === 'AI_REVIEW' || value === 'DRY_RUN' || value === 'CQ_PLUS_ONE') {
    return value
  }
  return null
}

function mapCheckStatus(value: unknown): MergeRequestCheck['status'] {
  if (value === 'PASSED' || value === 'FAILED' || value === 'PENDING') return value
  return 'PENDING'
}

export function mapMergeRequestCheck(raw: unknown): MergeRequestCheck | null {
  const row = isRecord(raw) ? raw : {}
  const type = mapCheckName(row.type ?? row.name)
  if (!type) return null
  return {
    id: readString(row, 'id'),
    type,
    status: mapCheckStatus(row.status),
    attemptNo: typeof row.attemptNo === 'number' ? row.attemptNo : null,
    testsetId: typeof row.testsetId === 'string' ? row.testsetId : null,
    commitSha: typeof row.commitSha === 'string' ? row.commitSha : null,
    source: typeof row.source === 'string' ? row.source : null,
    startedAt: typeof row.startedAt === 'string' ? row.startedAt : null,
    completedAt: typeof row.completedAt === 'string' ? row.completedAt : null,
  }
}

/** 现状：扁平数组。若以后包装成 {items[]} 也收。 */
export function mapMergeRequestChecks(raw: unknown): MergeRequestCheck[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.items)
      ? raw.items
      : []
  return list.flatMap((item) => {
    const mapped = mapMergeRequestCheck(item)
    return mapped ? [mapped] : []
  })
}

function mapMrStatus(value: unknown): MergeRequestStatus {
  if (value === 'OPEN' || value === 'MERGED' || value === 'CLOSED') return value
  return 'OPEN'
}

export function mapMergeRequest(raw: unknown): MergeRequestSummary {
  const row = isRecord(raw) ? raw : {}
  const qualityGate = isRecord(row.qualityGate) ? row.qualityGate : null
  const requiredChecks = Array.isArray(qualityGate?.requiredChecks)
    ? qualityGate.requiredChecks.filter((item): item is string => typeof item === 'string')
    : []
  const groupIds = Array.isArray(row.groupIds)
    ? row.groupIds.filter((item): item is string => typeof item === 'string')
    : []
  return {
    id: readString(row, 'id'),
    repositoryId: readString(row, 'repositoryId') || readString(row, 'projectRepositoryId'),
    groupIds,
    provider: readString(row, 'provider') || 'GITHUB',
    number: readNumber(row, 'number'),
    title: typeof row.title === 'string' ? row.title : null,
    description: typeof row.description === 'string' ? row.description : null,
    sourceBranch: readString(row, 'sourceBranch'),
    targetBranch: readString(row, 'targetBranch'),
    status: mapMrStatus(row.status),
    headCommit: typeof row.headCommit === 'string' ? row.headCommit : null,
    webUrl: typeof row.webUrl === 'string' ? row.webUrl : null,
    taskId: typeof row.taskId === 'string' ? row.taskId : null,
    qualityGate: qualityGate
      ? {
          status: typeof qualityGate.status === 'string' ? qualityGate.status : 'PENDING',
          requiredChecks,
        }
      : undefined,
  }
}

export function mapMergeRequestPage(page: TaskModelPage<unknown>): TaskModelPage<MergeRequestSummary> {
  const data = Array.isArray(page.data) ? page.data.map(mapMergeRequest) : []
  return { ...page, data }
}
