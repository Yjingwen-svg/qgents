import type { DryRunReport, TestRun, Testset } from '@/types/testset'

const NOW = '2026-08-15T02:00:00Z'

/** 尽量与现有项目绑定 Mock 对齐，避免卡片仓库名对不上 */
export function mockBoundRepositoryId(projectId: string): string {
  if (projectId === 'demo-project' || projectId === 'proj-001') return 'bound-demo-auth-service'
  return `bound-${projectId}-repository-1`
}

/** 生成一条最小 Testset。响应层会去掉 scopeTags，与当前后端一致。 */
export function createMockTestset(projectId: string, status: Testset['status'] = 'ENABLED'): Testset {
  return {
    id: `testset-${projectId}-login`,
    projectId,
    name: '登录接口测试',
    repositoryId: mockBoundRepositoryId(projectId),
    scopeTags: ['api'],
    command: './mvnw test',
    timeoutSeconds: 900,
    passRule: { type: 'EXIT_CODE', expected: 0 },
    acceptanceNotes: '覆盖登录成功与错误密码。',
    status,
    createdBy: 'user-001',
    createdAt: NOW,
    updatedAt: NOW,
  }
}

/** GET TestsetResponse：无 scopeTags */
export function toTestsetResponse(item: Testset): Record<string, unknown> {
  return {
    id: item.id,
    projectId: item.projectId,
    repositoryId: item.repositoryId,
    name: item.name,
    command: item.command,
    timeoutSeconds: item.timeoutSeconds,
    passRule: item.passRule,
    acceptanceNotes: item.acceptanceNotes,
    status: item.status,
    createdBy: item.createdBy ?? 'user-001',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

/** 对齐 TestRunResponse 本轮字段 */
export function createMockTestRun(projectId: string, input: Partial<TestRun> = {}): TestRun {
  return {
    id: input.id ?? `testrun-${projectId}-1`,
    projectId,
    repositoryId: input.repositoryId ?? mockBoundRepositoryId(projectId),
    testsetIds: input.testsetIds ?? [`testset-${projectId}-login`],
    taskId: input.taskId ?? null,
    ref: input.ref ?? 'feat/login-api',
    status: input.status ?? 'PASSED',
    summary: input.summary ?? '',
    createdBy: input.createdBy ?? 'user-001',
    createdAt: input.createdAt ?? NOW,
    caseSummary: null,
    cases: [],
    artifacts: [],
    reportUrl: null,
    pdfUrl: null,
    startedAt: null,
    finishedAt: null,
    sandboxId: null,
  }
}

export function toTestRunResponse(run: TestRun): Record<string, unknown> {
  return {
    id: run.id,
    projectId: run.projectId,
    repositoryId: run.repositoryId,
    ref: run.ref,
    testsetIds: run.testsetIds,
    status: run.status,
    summary: run.summary,
    createdBy: run.createdBy,
    createdAt: run.createdAt,
  }
}

/** Dry-run 内存对象；HTTP 只吐 id/status/createdAt */
export function createMockDryRunReport(projectId: string, input: Partial<DryRunReport> = {}): DryRunReport {
  return {
    id: input.id ?? `dryrun-${projectId}-1`,
    projectId,
    repositoryId: input.repositoryId ?? mockBoundRepositoryId(projectId),
    sourceRef: input.sourceRef ?? 'feat/login-api',
    targetBranch: input.targetBranch ?? 'main',
    taskId: input.taskId ?? null,
    status: input.status ?? 'PASSED',
    conflicts: [],
    caseSummary: null,
    cases: [],
    summary: input.summary ?? '',
    reportUrl: null,
    pdfUrl: null,
    startedAt: null,
    finishedAt: null,
    durationSeconds: null,
    sandboxId: null,
    testsetIds: [],
    createdAt: input.createdAt ?? NOW,
  }
}

export function toDryRunReportResponse(report: DryRunReport): Record<string, unknown> {
  return {
    id: report.id,
    status: report.status,
    createdAt: report.createdAt,
  }
}
