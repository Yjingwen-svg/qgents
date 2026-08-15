/**
 * Testset / Test Run / Dry Run —— 对齐 README/Qgents接口文档.md §10、§12.4
 *
 * Testset 是项目自建、可复用的测试配置（命令、超时、通过规则），不是特殊语法。
 * repositoryId 一律使用 project_repositories.id（项目绑定 UUID），不是 GitHub 数字 ID。
 *
 * 决策 2 选项 1：后端 v1 用 status = ENABLED | DISABLED，不使用 enabled 布尔字段。
 * 页面是否启用请用 isTestsetEnabled()（status === 'ENABLED'）。
 */

/** Testset 启用状态（后端枚举，不要自行发明 enabled） */
export type TestsetStatus = 'ENABLED' | 'DISABLED'

/** 测试运行状态：GET /test-runs/{id} */
export type TestRunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED'

/** Dry-run 报告状态：GET /dry-runs/{id}/report */
export type DryRunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CONFLICT' | 'CANCELLED'

/** 通过规则：文档创建示例为 EXIT_CODE + expected */
export interface TestsetPassRule {
  type: 'EXIT_CODE'
  expected: number
}

/**
 * GET/POST/PATCH /projects/{projectId}/testsets 的 Testset 对象
 * 列表项与详情共用同一形状；后端若多返回字段，映射层丢弃即可。
 */
export interface Testset {
  id: string
  projectId: string
  name: string
  /** project_repositories.id */
  repositoryId: string
  scopeTags: string[]
  command: string
  timeoutSeconds: number
  passRule: TestsetPassRule
  acceptanceNotes: string
  status: TestsetStatus
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/** POST /projects/{projectId}/testsets 请求体（与文档创建示例一致） */
export interface CreateTestsetPayload {
  name: string
  repositoryId: string
  scopeTags: string[]
  command: string
  timeoutSeconds: number
  passRule: TestsetPassRule
  acceptanceNotes: string
}

/** PATCH /projects/{projectId}/testsets/{testsetId} 只提交可改配置，不含 status */
export type UpdateTestsetPayload = Partial<CreateTestsetPayload>

/** GET /projects/{projectId}/testsets 查询参数 */
export interface TestsetListFilters {
  repositoryId?: string
  /** 启用状态过滤；不传表示全部。对应后端 status，不是 enabled */
  status?: TestsetStatus
}

/**
 * POST /projects/{projectId}/test-runs
 * 必须提供 repositoryId，以及 taskId 或 ref 之一；testsetIds 须属该仓库且 ENABLED。
 */
export interface CreateTestRunPayload {
  repositoryId: string
  testsetIds: string[]
  taskId?: string
  ref?: string
}

/** 用例计数摘要（GET test-run / dry-run report 已有；缺省字段用 0） */
export interface TestCaseSummary {
  passed: number
  failed: number
  blocked: number
  skipped: number
  total: number
}

/**
 * 逐条用例详情。本轮后端不返回 cases[]；映射层若遇到则收下，页面默认空态。
 */
export type TestCaseStatus = 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED'

export interface TestCaseDetail {
  id: string
  /** 用例名称，例如 should reject invalid password */
  name: string
  testsetId: string | null
  /** 套件 / 类名 / describe */
  suite: string | null
  status: TestCaseStatus
  durationMs: number | null
  /** 失败或阻塞原因 */
  message: string | null
  filePath: string | null
}

export interface TestRunArtifactRef {
  name: string
  url: string
  contentType: string | null
}

/** GET /projects/{projectId}/test-runs/{testRunId} */
export interface TestRun {
  id: string
  projectId: string
  repositoryId: string
  testsetIds: string[]
  taskId: string | null
  ref: string | null
  status: TestRunStatus
  summary: string
  createdBy: string | null
  createdAt: string
  /** 本轮契约没有；若后端以后带上则展示 */
  caseSummary: TestCaseSummary | null
  cases: TestCaseDetail[]
  artifacts: TestRunArtifactRef[]
  reportUrl: string | null
  pdfUrl: string | null
  startedAt: string | null
  finishedAt: string | null
  sandboxId: string | null
}

/**
 * POST /projects/{projectId}/dry-runs
 * 必须提供 repositoryId、sourceRef、targetBranch，可选 taskId。
 */
export interface CreateDryRunPayload {
  repositoryId: string
  sourceRef: string
  targetBranch: string
  taskId?: string
}

/** Dry-run 冲突条目（报告接口；后端字段名若不同在映射层对齐） */
export interface DryRunConflict {
  path: string
  message: string
}

/** GET /projects/{projectId}/dry-runs/{dryRunId}/report */
export interface DryRunReport {
  id: string
  projectId: string
  repositoryId: string
  sourceRef: string
  targetBranch: string
  taskId: string | null
  status: DryRunStatus
  conflicts: DryRunConflict[]
  caseSummary: TestCaseSummary | null
  cases: TestCaseDetail[]
  summary: string
  reportUrl: string | null
  pdfUrl: string | null
  startedAt: string | null
  finishedAt: string | null
  durationSeconds: number | null
  /** GET 文档未写死该字段；有则展示，没有则页面显示 — */
  sandboxId: string | null
  /** 报告若带回本次用到的测试集；缺省为空，页面显示 — */
  testsetIds: string[]
  createdAt: string
}

/** 前端会话内历史（后端没有历史列表接口时使用，不是 HTTP 资源） */
export type LocalRunKind = 'TEST_RUN' | 'DRY_RUN'

export interface LocalRunHistoryItem {
  kind: LocalRunKind
  id: string
  repositoryId: string
  createdAt: string
  label: string
}
