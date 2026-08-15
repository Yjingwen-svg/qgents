import { request } from './client'
import { withQuery } from './requestHelpers'
import type {
  CreateDryRunPayload,
  CreateTestRunPayload,
  CreateTestsetPayload,
  DryRunConflict,
  DryRunReport,
  DryRunStatus,
  TestCaseDetail,
  TestCaseStatus,
  TestCaseSummary,
  TestRun,
  TestRunArtifactRef,
  TestRunStatus,
  Testset,
  TestsetListFilters,
  TestsetPassRule,
  TestsetStatus,
  UpdateTestsetPayload,
} from '@/types/testset'

/** 接口文档统一成功响应外壳：{ data, requestId } */
interface ApiEnvelope<T> {
  data: T
  requestId?: string
}

/**
 * 判断 Testset 是否启用。
 * 决策 2 选项 1：只用 status === 'ENABLED'，不读 enabled 布尔。
 */
export function isTestsetEnabled(testset: Pick<Testset, 'status'>): boolean {
  return testset.status === 'ENABLED'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function asList(data: unknown): unknown[] {
  return Array.isArray(data) ? data : []
}

/**
 * 把后端 Testset JSON 收成前端类型。
 * 若后端误带 enabled 布尔、漏 status，只在映射层补 status，页面仍然只认 status。
 */
export function mapTestset(raw: unknown): Testset {
  const row = isRecord(raw) ? raw : {}
  const definition = isRecord(row.definition) ? row.definition : {}
  const statusRaw = row.status
  const status: TestsetStatus =
    statusRaw === 'ENABLED' || statusRaw === 'DISABLED'
      ? statusRaw
      : row.enabled === false
        ? 'DISABLED'
        : 'ENABLED'
  const createdBy = readString(row, 'createdBy')

  return {
    id: readString(row, 'id'),
    projectId: readString(row, 'projectId'),
    name: readString(row, 'name'),
    repositoryId: readString(row, 'repositoryId'),
    /** 创建请求有 scopeTags，当前响应未返回——缺则 []，不要当 Bug */
    scopeTags: readStringArray(row.scopeTags),
    command: readString(row, 'command') || readString(definition, 'command'),
    timeoutSeconds: readNumber(row, 'timeoutSeconds') || readNumber(definition, 'timeoutSeconds') || 900,
    passRule: mapPassRule(row.passRule ?? definition.passRule),
    acceptanceNotes: readString(row, 'acceptanceNotes') || readString(definition, 'acceptanceNotes'),
    status,
    createdBy: createdBy || undefined,
    createdAt: readString(row, 'createdAt'),
    updatedAt: readString(row, 'updatedAt'),
  }
}

/** 解析 passRule；缺省按文档示例 EXIT_CODE / 0 */
function mapPassRule(raw: unknown): TestsetPassRule {
  const row = isRecord(raw) ? raw : {}
  return {
    type: 'EXIT_CODE',
    expected: typeof row.expected === 'number' ? row.expected : 0,
  }
}

function mapTestRunStatus(value: unknown): TestRunStatus {
  if (value === 'QUEUED' || value === 'RUNNING' || value === 'FAILED' || value === 'CANCELLED') {
    return value
  }
  if (value === 'SUCCEEDED' || value === 'PASSED') return 'PASSED'
  return 'QUEUED'
}

function mapDryRunStatus(value: unknown): DryRunStatus {
  if (
    value === 'QUEUED' ||
    value === 'RUNNING' ||
    value === 'FAILED' ||
    value === 'CONFLICT' ||
    value === 'CANCELLED'
  ) {
    return value
  }
  if (value === 'SUCCEEDED' || value === 'PASSED') return 'PASSED'
  return 'QUEUED'
}

function mapCaseSummary(raw: unknown): TestCaseSummary | null {
  if (!isRecord(raw)) return null
  const passed = readNumber(raw, 'passed')
  const failed = readNumber(raw, 'failed')
  const blocked = readNumber(raw, 'blocked')
  const skipped = readNumber(raw, 'skipped')
  const total = readNumber(raw, 'total') || passed + failed + blocked + skipped
  return { passed, failed, blocked, skipped, total }
}

function mapArtifacts(raw: unknown): TestRunArtifactRef[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!isRecord(item)) return []
    const name = readString(item, 'name')
    const url = readString(item, 'url')
    const contentType = readString(item, 'contentType') || null
    return name && url ? [{ name, url, contentType }] : []
  })
}

function mapCaseStatus(value: unknown): TestCaseStatus {
  if (value === 'PASSED' || value === 'FAILED' || value === 'BLOCKED' || value === 'SKIPPED') {
    return value
  }
  if (value === 'SUCCEEDED') return 'PASSED'
  return 'SKIPPED'
}

/** cases 或 caseDetails；文档尚未写死，缺省为空 */
function mapCases(raw: unknown): TestCaseDetail[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const name = readString(item, 'name') || readString(item, 'title')
    if (!name) return []
    const durationRaw = item.durationMs ?? item.durationMillis
    return [
      {
        id: readString(item, 'id') || `case-${index + 1}`,
        name,
        testsetId: readString(item, 'testsetId') || null,
        suite: readString(item, 'suite') || readString(item, 'className') || null,
        status: mapCaseStatus(item.status),
        durationMs: typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? durationRaw : null,
        message: readString(item, 'message') || readString(item, 'error') || null,
        filePath: readString(item, 'filePath') || readString(item, 'file') || null,
      },
    ]
  })
}

function readPdfUrl(row: Record<string, unknown>, artifacts: TestRunArtifactRef[]): string | null {
  const direct = readString(row, 'pdfUrl') || readString(row, 'reportPdfUrl')
  if (direct) return direct
  const pdfArtifact = artifacts.find(
    (item) =>
      item.contentType === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf'),
  )
  return pdfArtifact?.url ?? null
}

/** sandboxId 或 sandbox.id；文档未保证该字段，缺省为 null */
function readSandboxId(row: Record<string, unknown>): string | null {
  const direct = readString(row, 'sandboxId')
  if (direct) return direct
  const sandbox = row.sandbox
  if (!isRecord(sandbox)) return null
  return readString(sandbox, 'id') || null
}

/** 把 GET test-run 响应收成 TestRun */
export function mapTestRun(raw: unknown): TestRun {
  const row = isRecord(raw) ? raw : {}
  const artifacts = mapArtifacts(row.artifacts)
  return {
    id: readString(row, 'id'),
    projectId: readString(row, 'projectId'),
    repositoryId: readString(row, 'repositoryId'),
    testsetIds: readStringArray(row.testsetIds),
    taskId: readString(row, 'taskId') || null,
    ref: readString(row, 'ref') || null,
    status: mapTestRunStatus(row.status),
    summary: readString(row, 'summary'),
    createdBy: readString(row, 'createdBy') || null,
    createdAt: readString(row, 'createdAt'),
    caseSummary: mapCaseSummary(row.caseSummary),
    cases: mapCases(row.cases ?? row.caseDetails),
    artifacts,
    reportUrl: readString(row, 'reportUrl') || null,
    pdfUrl: readPdfUrl(row, artifacts),
    startedAt: readString(row, 'startedAt') || null,
    finishedAt: readString(row, 'finishedAt') || null,
    sandboxId: readSandboxId(row),
  }
}

function mapConflicts(raw: unknown): DryRunConflict[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!isRecord(item)) return []
    const path = readString(item, 'path')
    const message = readString(item, 'message') || readString(item, 'reason')
    return path || message ? [{ path, message }] : []
  })
}

/** 把 GET dry-run report 响应收成 DryRunReport；POST dry-runs 若直接返回报告也走这里 */
export function mapDryRunReport(raw: unknown): DryRunReport {
  const row = isRecord(raw) ? raw : {}
  return {
    id: readString(row, 'id') || readString(row, 'dryRunId'),
    projectId: readString(row, 'projectId'),
    repositoryId: readString(row, 'repositoryId'),
    sourceRef: readString(row, 'sourceRef'),
    targetBranch: readString(row, 'targetBranch'),
    taskId: readString(row, 'taskId') || null,
    status: mapDryRunStatus(row.status),
    conflicts: mapConflicts(row.conflicts),
    caseSummary: mapCaseSummary(row.caseSummary) ?? mapCaseSummary(row.testSummary),
    cases: mapCases(row.cases ?? row.caseDetails),
    summary: readString(row, 'summary'),
    reportUrl: readString(row, 'reportUrl') || null,
    pdfUrl: readPdfUrl(row, mapArtifacts(row.artifacts)),
    startedAt: readString(row, 'startedAt') || null,
    finishedAt: readString(row, 'finishedAt') || null,
    durationSeconds: typeof row.durationSeconds === 'number' ? row.durationSeconds : null,
    sandboxId: readSandboxId(row),
    testsetIds: readStringArray(row.testsetIds),
    createdAt: readString(row, 'createdAt'),
  }
}

function mapTestsetList(data: unknown): Testset[] {
  return asList(data).map(mapTestset)
}

/** enable/disable 可能 204 无 body，也可能返回更新后的对象 */
function mapOptionalTestset(res: ApiEnvelope<unknown> | undefined): Testset | undefined {
  if (!res || !('data' in res) || res.data === undefined) return undefined
  return mapTestset(res.data)
}

/**
 * Testset / 受控测试运行 / Dry-run API
 * 组件只走本文件，不得直接读 Mock fixture。
 */
export const testsetApi = {
  /**
   * GET /projects/{projectId}/testsets
   * 支持 repositoryId、status（ENABLED/DISABLED）过滤。
   */
  list(projectId: string, filters: TestsetListFilters = {}) {
    const query: Record<string, string> = {}
    if (filters.repositoryId) query.repositoryId = filters.repositoryId
    if (filters.status) query.status = filters.status
    return request<ApiEnvelope<unknown>>(withQuery(`/projects/${projectId}/testsets`, query), {
      unwrapData: false,
    }).then((res) => mapTestsetList(res.data))
  },

  /** GET /projects/{projectId}/testsets/{testsetId} */
  getById(projectId: string, testsetId: string) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/testsets/${testsetId}`, {
      unwrapData: false,
    }).then((res) => mapTestset(res.data))
  },

  /** POST /projects/{projectId}/testsets —— Project Admin */
  create(projectId: string, payload: CreateTestsetPayload) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/testsets`, {
      method: 'POST',
      unwrapData: false,
      body: payload,
    }).then((res) => mapTestset(res.data))
  },

  /** PATCH /projects/{projectId}/testsets/{testsetId} —— Project Admin */
  update(projectId: string, testsetId: string, payload: UpdateTestsetPayload) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/testsets/${testsetId}`, {
      method: 'PATCH',
      unwrapData: false,
      body: payload,
    }).then((res) => mapTestset(res.data))
  },

  /** POST .../enable —— Project Admin；204 或返回更新后的 Testset 都视为成功 */
  enable(projectId: string, testsetId: string) {
    return request<ApiEnvelope<unknown> | undefined>(
      `/projects/${projectId}/testsets/${testsetId}/enable`,
      { method: 'POST', unwrapData: false },
    ).then(mapOptionalTestset)
  },

  /** POST .../disable —— Project Admin */
  disable(projectId: string, testsetId: string) {
    return request<ApiEnvelope<unknown> | undefined>(
      `/projects/${projectId}/testsets/${testsetId}/disable`,
      { method: 'POST', unwrapData: false },
    ).then(mapOptionalTestset)
  },

  /** DELETE .../{testsetId} —— 删除未被门禁引用的 Testset；约定 204 */
  remove(projectId: string, testsetId: string) {
    return request<void>(`/projects/${projectId}/testsets/${testsetId}`, {
      method: 'DELETE',
    })
  },

  /**
   * POST /projects/{projectId}/test-runs
   * 对指定提交或 Task 发起已启用 Testset 的受控运行。
   */
  createTestRun(projectId: string, payload: CreateTestRunPayload) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/test-runs`, {
      method: 'POST',
      unwrapData: false,
      body: payload,
    }).then((res) => mapTestRun(res.data))
  },

  /** GET /projects/{projectId}/test-runs/{testRunId} */
  getTestRun(projectId: string, testRunId: string) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/test-runs/${testRunId}`, {
      unwrapData: false,
    }).then((res) => mapTestRun(res.data))
  },

  /**
   * POST /projects/{projectId}/dry-runs
   * 针对源分支和目标分支发起合并前试运行。
   */
  createDryRun(projectId: string, payload: CreateDryRunPayload) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/dry-runs`, {
      method: 'POST',
      unwrapData: false,
      body: payload,
    }).then((res) => mapDryRunReport(res.data))
  },

  /** GET /projects/{projectId}/dry-runs/{dryRunId}/report —— 冲突、测试摘要 */
  getDryRunReport(projectId: string, dryRunId: string) {
    return request<ApiEnvelope<unknown>>(`/projects/${projectId}/dry-runs/${dryRunId}/report`, {
      unwrapData: false,
    }).then((res) => mapDryRunReport(res.data))
  },
}
