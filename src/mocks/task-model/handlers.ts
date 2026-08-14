import { http, HttpResponse, type HttpHandler, type PathParams } from 'msw'
import type {
  DiffComment,
  DiffRejectInput,
  ExecutionContext,
  InputRequest,
  Task,
  TaskCreateInput,
  TaskStepCreateInput,
  TaskRunDetail,
  TaskRunSummary,
  TaskStep,
  TaskArtifact,
} from '@/types/task-model'
import {
  InvalidTaskModelTransitionError,
  transitionDiff,
  transitionInputRequest,
  transitionTaskCancel,
  transitionTaskRunCancel,
  transitionTaskRunRetry,
} from './stateTransitions'
import {
  createTaskModelScenario,
  createTaskModelScenarioByName,
  addDiff,
  taskModelScenarioNames,
  type TaskModelScenario,
} from './fixtures'
import { findDiff, findInputRequest, findTask, findTaskRun, findTaskStep, type TaskModelStore } from './store'

const stores = new Map<string, TaskModelStore>()
const diffReviewIdempotency = new Map<string, { fingerprint: string; batch: import('@/types/task-model').DiffReviewBatch }>()
const requestId = 'task-model-mock-request'

export function resetTaskModelStore(): void {
  stores.clear()
  diffReviewIdempotency.clear()
}

function pathParam(params: PathParams, name: string): string {
  const value = params[name]
  return typeof value === 'string' ? value : ''
}

function getStore(projectId: string, request: Request): TaskModelStore {
  const scenarioValue = new URL(request.url).searchParams.get('scenario')
  const scenario = taskModelScenarioNames.includes(scenarioValue as TaskModelScenario)
    ? (scenarioValue as TaskModelScenario)
    : undefined
  if (scenario) {
    const store = createTaskModelScenarioByName(projectId, scenario)
    stores.set(projectId, store)
    return store
  }
  const existing = stores.get(projectId)
  if (existing) return existing
  const store = createTaskModelScenario(projectId)
  stores.set(projectId, store)
  return store
}

function response<T>(data: T, status = 200): HttpResponse<Record<string, unknown>> {
  return HttpResponse.json({ data, requestId }, { status }) as HttpResponse<Record<string, unknown>>
}

function page<T>(items: T[], request: Request): HttpResponse<Record<string, unknown>> {
  const search = new URL(request.url).searchParams
  const rawLimit = Number(search.get('limit') ?? '30')
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30
  const rawCursor = Number(search.get('cursor') ?? '0')
  const start = Number.isInteger(rawCursor) && rawCursor >= 0 ? rawCursor : 0
  const data = items.slice(start, start + limit)
  const nextStart = start + data.length
  return HttpResponse.json({
    data,
    page: { nextCursor: nextStart < items.length ? String(nextStart) : null, hasMore: nextStart < items.length },
    requestId,
  }) as HttpResponse<Record<string, unknown>>
}

function errorResponse(status: number, code: string, message: string, field?: string): HttpResponse<Record<string, unknown>> {
  return HttpResponse.json({
    error: { code, message, details: field ? [{ field, reason: 'invalid' }] : [] },
    requestId,
  }, { status }) as HttpResponse<Record<string, unknown>>
}

function transitionError(error: unknown): HttpResponse<Record<string, unknown>> {
  if (error instanceof InvalidTaskModelTransitionError) {
    return errorResponse(error.status, error.code, error.message)
  }
  return errorResponse(500, 'MOCK_UNEXPECTED_ERROR', 'Unexpected mock error')
}

function guardProject(projectId: string): HttpResponse<Record<string, unknown>> | null {
  return projectId === 'forbidden'
    ? errorResponse(403, 'PROJECT_ACCESS_DENIED', 'Project access is forbidden')
    : null
}

function missing(resource: string): HttpResponse<Record<string, unknown>> {
  return errorResponse(404, 'MOCK_NOT_FOUND', `${resource} was not found`)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item))
}

function diffReviewIdempotencyResponse(
  projectId: string,
  taskId: string,
  request: Request,
  fingerprint: string,
): HttpResponse<Record<string, unknown>> | null {
  const key = request.headers.get('Idempotency-Key')
  if (!key) return errorResponse(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required')
  const recordKey = `${projectId}:${taskId}:${key}`
  const existing = diffReviewIdempotency.get(recordKey)
  if (!existing) return null
  if (existing.fingerprint !== fingerprint) return errorResponse(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used for another request')
  return response(structuredClone(existing.batch))
}

function rememberDiffReviewIdempotency(projectId: string, taskId: string, request: Request, fingerprint: string, batch: import('@/types/task-model').DiffReviewBatch): void {
  const key = request.headers.get('Idempotency-Key')
  if (!key) return
  diffReviewIdempotency.set(`${projectId}:${taskId}:${key}`, { fingerprint, batch: structuredClone(batch) })
}

async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json()
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

function invalidTaskInput(body: Record<string, unknown>): string | null {
  const allowed = new Set(['requirementGroupId', 'title', 'requirement', 'repositoryIds', 'baseRef', 'workspaceId', 'continuationOfTaskId'])
  const unsupported = Object.keys(body).find((key) => !allowed.has(key))
  if (unsupported) return unsupported
  if (!isNonEmptyString(body.requirementGroupId)) return 'requirementGroupId'
  if (!isNonEmptyString(body.title)) return 'title'
  if (!isNonEmptyString(body.requirement)) return 'requirement'
  if (!isStringArray(body.repositoryIds)) return 'repositoryIds'
  if (!isNonEmptyString(body.baseRef)) return 'baseRef'
  return null
}

function makeId(projectId: string, resource: string, currentSize: number): string {
  return `${resource}-${projectId}-${currentSize + 1}`
}

function createTaskResources(store: TaskModelStore, input: TaskCreateInput, projectId: string): Task {
  const createdAt = new Date().toISOString()
  const id = makeId(projectId, 'task', store.tasks.size)
  const repositoryId = input.repositoryIds[0]!
  const task: Task = {
    id,
    projectId,
    requirementGroupId: input.requirementGroupId,
    triggerMessageId: `message-${id}`,
    title: input.title,
    requirement: input.requirement,
    status: 'PENDING',
    deliveryMode: 'DIFF_FIRST',
    workspaceId: input.workspaceId ?? `workspace-${id}`,
    workspaceStatus: 'READY',
    continuationOfTaskId: input.continuationOfTaskId ?? null,
    repositoryIds: input.repositoryIds,
    repositories: input.repositoryIds.map((repository) => ({
      repositoryId: repository,
      baseCommit: `base-${input.baseRef}`,
      sourceBranch: input.baseRef,
      headCommit: null,
    })),
    createdBy: 'mock-user',
    createdAt,
    updatedAt: createdAt,
  }
  store.tasks.set(task.id, task)

  const planner: TaskStep = {
    id: `step-${id}-planner`, taskId: id, role: 'PLANNER', agentId: 'agent-planner', repositoryId,
    baseRef: input.baseRef, dependencies: [], testsetIds: [], status: 'PENDING', acceptanceNotes: null,
  }
  const developer: TaskStep = {
    id: `step-${id}-developer`, taskId: id, role: 'DEVELOPER', agentId: 'agent-developer', repositoryId,
    baseRef: input.baseRef, dependencies: [planner.id], testsetIds: [], status: 'PENDING', acceptanceNotes: null,
  }
  const tester: TaskStep = {
    id: `step-${id}-tester`, taskId: id, role: 'TESTER', agentId: 'agent-tester', repositoryId,
    baseRef: input.baseRef, dependencies: [developer.id], testsetIds: [], status: 'PENDING', acceptanceNotes: null,
  }
  for (const step of [planner, developer, tester]) store.taskSteps.set(step.id, step)

  const inputRun: TaskRunDetail = {
    id: `run-${planner.id}`, projectId, taskId: id, taskStepId: planner.id, agentId: planner.agentId ?? 'agent-planner',
    role: planner.role, status: 'WAITING_INPUT', retryOfTaskRunId: null, artifactSummary: { diffs: { count: 0, byStatus: {} } },
    startedAt: createdAt, finishedAt: null, durationMs: null, createdAt, updatedAt: createdAt,
  }
  const failedRun: TaskRunDetail = {
    id: `run-${developer.id}`, projectId, taskId: id, taskStepId: developer.id, agentId: developer.agentId ?? 'agent-developer',
    role: developer.role, status: 'FAILED', retryOfTaskRunId: null, artifactSummary: { diffs: { count: 2, byStatus: { PENDING_REVIEW: 2 } } },
    startedAt: createdAt, finishedAt: new Date(Date.now() + 1).toISOString(), durationMs: 1_000, createdAt, updatedAt: createdAt,
  }
  for (const run of [inputRun, failedRun]) {
    store.taskRuns.set(run.id, run)
    store.taskRunLogs.set(run.id, [{
      id: `log-${run.id}-1`, sequence: 1, node: run.role, content: `${run.role} started`, timestamp: createdAt,
    }])
    const context: ExecutionContext = {
      workspaceId: task.workspaceId,
      sandboxStatus: 'RUNNING',
      repositoryId,
      baseRef: input.baseRef,
      headRef: input.baseRef,
      startedAt: run.startedAt,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    }
    store.executionContexts.set(run.id, context)
  }
  const inputRequest: InputRequest = {
    id: `input-${inputRun.id}`,
    taskRunId: inputRun.id,
    kind: 'INPUT',
    status: 'PENDING',
    prompt: 'Choose a base branch',
    options: [{ value: input.baseRef, label: input.baseRef }],
    createdAt,
  }
  store.inputRequests.set(inputRequest.id, inputRequest)
  addDiff(store, task, developer, 'PENDING_REVIEW', 'created-pending-1', failedRun.id)
  addDiff(store, task, developer, 'PENDING_REVIEW', 'created-pending-2', failedRun.id)
  return task
}

function taskRunsForTask(store: TaskModelStore, taskId: string): TaskRunDetail[] {
  return [...store.taskRuns.values()].filter((run) => run.taskId === taskId)
}

function taskStepsForTask(store: TaskModelStore, taskId: string): TaskStep[] {
  return [...store.taskSteps.values()].filter((step) => step.taskId === taskId)
}

function detailForRun(store: TaskModelStore, run: TaskRunDetail): TaskRunDetail {
  const steps = store.taskRunSteps.get(run.id)
  return steps ? { ...run, steps: [...steps] } : (() => {
    const { steps: _steps, ...summary } = run
    return summary
  })()
}

function summaryForRun(run: TaskRunDetail): TaskRunSummary {
  const {
    id,
    projectId,
    taskId,
    taskStepId,
    agentId,
    role,
    status,
    retryOfTaskRunId,
    createdAt,
    updatedAt,
  } = run
  return { id, projectId, taskId, taskStepId, agentId, role, status, retryOfTaskRunId, createdAt, updatedAt }
}

function cloneRetryResources(store: TaskModelStore, original: TaskRunDetail, retry: TaskRunDetail): void {
  const steps = store.taskRunSteps.get(original.id)
  if (steps) store.taskRunSteps.set(retry.id, steps.map((step) => ({ ...step, status: 'PENDING' })))
  const logs = store.taskRunLogs.get(original.id)
  store.taskRunLogs.set(retry.id, logs?.map((log) => ({ ...log })) ?? [])
  const context = store.executionContexts.get(original.id)
  if (context) store.executionContexts.set(retry.id, { ...context, startedAt: null })
}

const taskCreateListDetailHandlers: HttpHandler[] = [
  http.post('*/api/projects/:projectId/tasks', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const body = await jsonObject(request)
    const invalidField = invalidTaskInput(body)
    if (invalidField) return errorResponse(422, 'VALIDATION_FAILED', `Invalid ${invalidField}`, invalidField)
    return response(createTaskResources(getStore(projectId, request), body as unknown as TaskCreateInput, projectId), 201)
  }),

  http.get('*/api/projects/:projectId/tasks', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const search = new URL(request.url).searchParams
    const groupId = search.get('groupId')
    const status = search.get('status')
    const createdBy = search.get('createdBy')
    const tasks = [...store.tasks.values()].filter((task) =>
      (!groupId || task.requirementGroupId === groupId) &&
      (!status || task.status === status) &&
      (!createdBy || task.createdBy === createdBy),
    )
    return page(tasks, request)
  }),

  http.get('*/api/projects/:projectId/tasks/:taskId', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const task = findTask(getStore(projectId, request), pathParam(params, 'taskId'))
    return task?.projectId === projectId ? response(task) : missing('Task')
  }),
]

const taskStepListHandler: HttpHandler = http.get('*/api/projects/:projectId/tasks/:taskId/steps', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const task = findTask(store, pathParam(params, 'taskId'))
    return task ? page(taskStepsForTask(store, task.id), request) : missing('Task')
  })

const taskStepMutationHandlers: HttpHandler[] = [
  http.post('*/api/projects/:projectId/tasks/:taskId/steps', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const task = findTask(store, pathParam(params, 'taskId'))
    if (!task) return missing('Task')
    const body = await jsonObject(request)
    if (!isNonEmptyString(body.role)) return errorResponse(422, 'VALIDATION_FAILED', 'Invalid role', 'role')
    if (body.agentId !== undefined && !isNonEmptyString(body.agentId)) return errorResponse(422, 'VALIDATION_FAILED', 'Invalid agentId', 'agentId')
    const input = body as unknown as TaskStepCreateInput
    const step: TaskStep = {
      id: makeId(task.id, 'step', taskStepsForTask(store, task.id).length),
      taskId: task.id,
      role: input.role,
      agentId: input.agentId ?? null,
      repositoryId: input.repositoryId ?? task.repositoryIds[0] ?? null,
      baseRef: input.baseRef ?? null,
      dependencies: input.dependencies ?? [],
      testsetIds: input.testsetIds ?? [],
      status: 'PENDING',
      acceptanceNotes: input.acceptanceNotes ?? null,
    }
    store.taskSteps.set(step.id, step)
    return response(step, 201)
  }),

  http.post('*/api/projects/:projectId/tasks/:taskId/steps/:stepId/replace-agent', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const step = findTaskStep(store, pathParam(params, 'stepId'))
    if (!step || step.taskId !== pathParam(params, 'taskId')) return missing('TaskStep')
    if (step.status !== 'PENDING') return errorResponse(409, 'INVALID_STATE_TRANSITION', 'TaskStep can only replace agent while PENDING')
    const body = await jsonObject(request)
    if (!isNonEmptyString(body.agentId)) return errorResponse(422, 'VALIDATION_FAILED', 'Invalid agentId', 'agentId')
    step.agentId = body.agentId
    return response(step)
  }),

]

const taskCancelHandler: HttpHandler = http.post('*/api/projects/:projectId/tasks/:taskId/cancel', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const task = findTask(store, pathParam(params, 'taskId'))
    if (!task) return missing('Task')
    try {
      task.status = transitionTaskCancel(task.status)
      task.updatedAt = new Date().toISOString()
      return response(task, 202)
    } catch (error: unknown) {
      return transitionError(error)
    }
  })

export const taskModelTaskCenterHandlers: HttpHandler[] = [
  ...taskCreateListDetailHandlers,
  taskStepListHandler,
  taskCancelHandler,
]

export const taskModelTaskHandlers: HttpHandler[] = [
  ...taskModelTaskCenterHandlers,
  ...taskStepMutationHandlers,
]

export const taskModelTaskRunHandlers: HttpHandler[] = [
  http.get('*/api/projects/:projectId/tasks/:taskId/task-runs', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const task = findTask(store, pathParam(params, 'taskId'))
    if (!task) return missing('Task')
    const status = new URL(request.url).searchParams.get('status')
    return page(taskRunsForTask(store, task.id).filter((run) => !status || run.status === status).map(summaryForRun), request)
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const run = findTaskRun(getStore(projectId, request), pathParam(params, 'taskRunId'))
    return run?.projectId === projectId ? response(detailForRun(getStore(projectId, request), run)) : missing('TaskRun')
  }),

  http.post('*/api/projects/:projectId/task-runs/:taskRunId/retry', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const original = findTaskRun(store, pathParam(params, 'taskRunId'))
    if (!original) return missing('TaskRun')
    let retryStatus: TaskRunDetail['status']
    try {
      retryStatus = transitionTaskRunRetry(original.status)
    } catch (error: unknown) {
      return transitionError(error)
    }
    const now = new Date().toISOString()
    const retry: TaskRunDetail = {
      ...original,
      id: `${original.id}-retry-${store.taskRuns.size + 1}`,
      status: retryStatus,
      retryOfTaskRunId: original.id,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      updatedAt: now,
      createdAt: now,
    }
    delete retry.steps
    store.taskRuns.set(retry.id, retry)
    cloneRetryResources(store, original, retry)
    return response(detailForRun(store, retry), 202)
  }),

  http.post('*/api/projects/:projectId/task-runs/:taskRunId/cancel', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const run = findTaskRun(store, pathParam(params, 'taskRunId'))
    if (!run) return missing('TaskRun')
    try {
      run.status = transitionTaskRunCancel(run.status)
      run.updatedAt = new Date().toISOString()
      return response(detailForRun(store, run), 202)
    } catch (error: unknown) {
      return transitionError(error)
    }
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/logs', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const run = findTaskRun(store, pathParam(params, 'taskRunId'))
    return run ? page(store.taskRunLogs.get(run.id) ?? [], request) : missing('TaskRun')
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/execution-context', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const run = findTaskRun(store, pathParam(params, 'taskRunId'))
    const context = run ? store.executionContexts.get(run.id) : undefined
    return context ? response(context) : missing('ExecutionContext')
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/input-requests', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const run = findTaskRun(store, pathParam(params, 'taskRunId'))
    if (!run) return missing('TaskRun')
    return page([...store.inputRequests.values()].filter((item) => item.taskRunId === run.id), request)
  }),

  ...(['reply', 'approve', 'reject'] as const).map((action) => http.post(
    `*/api/projects/:projectId/task-runs/:taskRunId/input-requests/:requestId/${action}`,
    async ({ params, request }) => {
      const projectId = pathParam(params, 'projectId')
      const denied = guardProject(projectId)
      if (denied) return denied
      const store = getStore(projectId, request)
      const run = findTaskRun(store, pathParam(params, 'taskRunId'))
      const inputRequest = findInputRequest(store, pathParam(params, 'requestId'))
      if (!run || !inputRequest || inputRequest.taskRunId !== run.id) return missing('InputRequest')
      const body = await jsonObject(request)
      if (action === 'reply' && (!body.answer || typeof body.answer !== 'object' || !isNonEmptyString((body.answer as Record<string, unknown>).value))) {
        return errorResponse(422, 'VALIDATION_FAILED', 'A non-empty answer is required', 'answer')
      }
      if (action !== 'reply' && !isNonEmptyString(body.reason)) {
        return errorResponse(422, 'VALIDATION_FAILED', 'A non-empty reason is required', 'reason')
      }
      try {
        inputRequest.status = transitionInputRequest(inputRequest.kind, inputRequest.status, action)
      } catch (error: unknown) {
        return transitionError(error)
      }
      run.status = action === 'reject' ? 'BLOCKED' : 'RUNNING'
      run.updatedAt = new Date().toISOString()
      return response(inputRequest, 202)
    },
  )),

]

export const taskModelDiffHandlers: HttpHandler[] = [
  http.get('*/api/projects/:projectId/diffs', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const taskId = new URL(request.url).searchParams.get('taskId')
    return page([...store.diffs.values()].filter((diff) => !taskId || diff.taskId === taskId), request)
  }),

  http.get('*/api/projects/:projectId/diffs/:diffId', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const diff = findDiff(getStore(projectId, request), pathParam(params, 'diffId'))
    return diff?.projectId === projectId ? response(diff) : missing('Diff')
  }),

  http.get('*/api/projects/:projectId/diffs/:diffId/files', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const diff = findDiff(store, pathParam(params, 'diffId'))
    return diff ? page(store.diffFiles.get(diff.id) ?? [], request) : missing('Diff')
  }),

  http.get('*/api/projects/:projectId/diffs/:diffId/comments', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const diff = findDiff(store, pathParam(params, 'diffId'))
    return diff ? page(store.diffComments.get(diff.id) ?? [], request) : missing('Diff')
  }),

  http.post('*/api/projects/:projectId/diffs/:diffId/comments', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const diff = findDiff(store, pathParam(params, 'diffId'))
    if (!diff) return missing('Diff')
    const body = await jsonObject(request)
    if (!isNonEmptyString(body.body)) return errorResponse(422, 'VALIDATION_FAILED', 'Comment body is required', 'body')
    const comment: DiffComment = {
      id: `comment-${diff.id}-${(store.diffComments.get(diff.id) ?? []).length + 1}`,
      path: typeof body.path === 'string' ? body.path : null,
      side: typeof body.side === 'string' ? body.side : null,
      line: typeof body.line === 'number' ? body.line : null,
      hunkId: typeof body.hunkId === 'string' ? body.hunkId : null,
      body: body.body,
    }
    store.diffComments.set(diff.id, [...(store.diffComments.get(diff.id) ?? []), comment])
    return response(comment, 201)
  }),

  http.post('*/api/projects/:projectId/diffs/:diffId/accept', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const diff = findDiff(store, pathParam(params, 'diffId'))
    if (!diff) return missing('Diff')
    if (store.diffReviews.has(diff.taskId)) return errorResponse(409, 'DIFF_BATCH_REVIEW_REQUIRED', 'Review the task Diff batch instead')
    try {
      diff.status = transitionDiff(diff.status, 'accept')
      diff.reviewedBy = 'mock-reviewer'
      diff.reviewedAt = new Date().toISOString()
      diff.updatedAt = diff.reviewedAt
      return response(diff, 202)
    } catch (error: unknown) {
      return transitionError(error)
    }
  }),

  http.post('*/api/projects/:projectId/diffs/:diffId/reject', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const diff = findDiff(store, pathParam(params, 'diffId'))
    if (!diff) return missing('Diff')
    if (store.diffReviews.has(diff.taskId)) return errorResponse(409, 'DIFF_BATCH_REVIEW_REQUIRED', 'Review the task Diff batch instead')
    const body = await jsonObject(request) as unknown as DiffRejectInput
    if (!isNonEmptyString(body.reason)) return errorResponse(422, 'VALIDATION_FAILED', 'A rejection reason is required', 'reason')
    try {
      diff.status = transitionDiff(diff.status, 'reject')
      diff.reviewedBy = 'mock-reviewer'
      diff.reviewReason = body.reason
      diff.reviewedAt = new Date().toISOString()
      diff.updatedAt = diff.reviewedAt
      return response(diff, 202)
    } catch (error: unknown) {
      return transitionError(error)
    }
  }),
]

const taskArtifactAndDiffReviewHandlers: HttpHandler[] = [
  http.get('*/api/projects/:projectId/tasks/:taskId/artifacts', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const task = findTask(store, pathParam(params, 'taskId'))
    if (!task || task.projectId !== projectId) return missing('Task')
    return response([...(store.taskArtifacts.get(task.id) ?? [])] satisfies TaskArtifact[])
  }),
  http.get('*/api/projects/:projectId/tasks/:taskId/diff-review', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const task = findTask(store, pathParam(params, 'taskId'))
    const batch = task ? store.diffReviews.get(task.id) : undefined
    return batch ? response(batch) : errorResponse(404, 'DIFF_REVIEW_NOT_FOUND', 'Final Diff has not been generated')
  }),
  http.post('*/api/projects/:projectId/tasks/:taskId/diff-review/confirm', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const taskId = pathParam(params, 'taskId')
    const idempotencyResponse = diffReviewIdempotencyResponse(projectId, taskId, request, 'confirm')
    if (idempotencyResponse) return idempotencyResponse
    const batch = store.diffReviews.get(taskId)
    if (!batch) return errorResponse(404, 'DIFF_REVIEW_NOT_FOUND', 'Final Diff has not been generated')
    if (batch.reviewStatus !== 'PENDING_CONFIRMATION') return errorResponse(409, 'DIFF_REVIEW_NOT_DECIDABLE', 'Diff review is no longer pending')
    batch.reviewStatus = 'ACCEPTED'
    batch.deliveryStatus = 'DELIVERING'
    const task = findTask(store, taskId)
    if (task) task.status = 'DELIVERING'
    rememberDiffReviewIdempotency(projectId, taskId, request, 'confirm', batch)
    return response(batch)
  }),
  http.post('*/api/projects/:projectId/tasks/:taskId/diff-review/reject', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const body = await jsonObject(request)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reason || reason.length > 4000) return errorResponse(400, 'DIFF_REJECT_REASON_REQUIRED', 'A rejection reason is required')
    const store = getStore(projectId, request)
    const taskId = pathParam(params, 'taskId')
    const idempotencyResponse = diffReviewIdempotencyResponse(projectId, taskId, request, `reject:${reason}`)
    if (idempotencyResponse) return idempotencyResponse
    const batch = store.diffReviews.get(taskId)
    if (!batch) return errorResponse(404, 'DIFF_REVIEW_NOT_FOUND', 'Final Diff has not been generated')
    if (batch.reviewStatus !== 'PENDING_CONFIRMATION') return errorResponse(409, 'DIFF_REVIEW_NOT_DECIDABLE', 'Diff review is no longer pending')
    batch.reviewStatus = 'REJECTED'
    batch.reviewReason = reason
    const task = findTask(store, taskId)
    if (task) task.status = 'FAILED'
    rememberDiffReviewIdempotency(projectId, taskId, request, `reject:${reason}`, batch)
    return response(batch)
  }),
  http.post('*/api/projects/:projectId/tasks/:taskId/diff-review/retry-delivery', ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const denied = guardProject(projectId)
    if (denied) return denied
    const store = getStore(projectId, request)
    const taskId = pathParam(params, 'taskId')
    const idempotencyResponse = diffReviewIdempotencyResponse(projectId, taskId, request, 'retry-delivery')
    if (idempotencyResponse) return idempotencyResponse
    const batch = store.diffReviews.get(taskId)
    if (!batch) return errorResponse(404, 'DIFF_REVIEW_NOT_FOUND', 'Final Diff has not been generated')
    if (batch.reviewStatus !== 'ACCEPTED' || (batch.deliveryStatus !== 'FAILED' && batch.deliveryStatus !== 'PARTIALLY_DELIVERED')) return errorResponse(409, 'DIFF_DELIVERY_NOT_RETRYABLE', 'Diff delivery cannot be retried')
    batch.deliveryStatus = 'DELIVERED'
    const task = findTask(store, taskId)
    if (task) task.status = 'SUCCEEDED'
    rememberDiffReviewIdempotency(projectId, taskId, request, 'retry-delivery', batch)
    return response(batch)
  }),
]

const taskModelRepositoryHandlers: HttpHandler[] = [
  http.get('*/api/projects/:projectId/repositories', ({ params }) => {
    const projectId = pathParam(params, 'projectId')
    const repository = {
      id: `bound-${projectId}-repository-1`,
      installationId: 'mock-installation-1',
      repositoryId: `repository-${projectId}`,
      providerRepositoryId: 1,
      fullName: `mock/${projectId}`,
      githubUrl: `https://github.com/mock/${projectId}`,
      displayName: projectId,
      defaultBranch: 'main',
      authorizationStatus: 'AUTHORIZED' as const,
      metadataSyncedAt: '2026-08-10T12:00:00Z',
      boundAt: '2026-08-10T12:00:00Z',
      boundProjectId: projectId,
      boundProjectName: projectId,
      syncStatus: 'SYNCED' as const,
      lastSyncedAt: '2026-08-10T12:00:00Z',
    }
    return response([repository])
  }),
]

export const taskModelHandlers: HttpHandler[] = [
  ...taskModelRepositoryHandlers,
  ...taskArtifactAndDiffReviewHandlers,
  ...taskModelTaskHandlers,
  ...taskModelTaskRunHandlers,
  ...taskModelDiffHandlers,
]
