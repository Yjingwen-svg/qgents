import { http, HttpResponse, type PathParams } from 'msw'
import type {
  DecisionInput,
  InputRequest,
  InputRequestAnswer,
  OrchestrationRun,
  RejectDeliverableInput,
  StartMode,
  TaskRun,
  UpdateWorkPackageInput,
  WorkPackage,
} from '@/types'
import { canRetryTaskRun } from '@/types'
import {
  addCreatedOrchestrationRunResources,
  createTaskDomainScenario,
  taskDomainScenarioNames,
  type TaskDomainScenario,
} from './fixtures'
import {
  InvalidStateTransitionError,
  transitionDeliverableStatus,
  transitionTaskRunInputRequest,
  transitionTaskRunCancel,
  transitionOrchestrationRunCancel,
  transitionWorkPackageStatus,
} from './stateTransitions'
import {
  findInputRequest,
  findOrchestrationRun,
  findTaskRun,
  findWorkPackage,
  type TaskDomainState,
} from './store'

const stores = new Map<string, TaskDomainState>()

export function resetTaskDomainStores(): void {
  stores.clear()
}

function pathParam(params: PathParams, name: string): string {
  const value = params[name]
  return typeof value === 'string' ? value : ''
}

function getStore(projectId: string, request: Request): TaskDomainState {
  const scenarioValue = new URL(request.url).searchParams.get('scenario')
  const scenario = taskDomainScenarioNames.includes(scenarioValue as TaskDomainScenario)
    ? (scenarioValue as TaskDomainScenario)
    : undefined
  if (scenario) {
    const store = createTaskDomainScenario(projectId, scenario)
    stores.set(projectId, store)
    return store
  }

  const existing = stores.get(projectId)
  if (existing) return existing
  const store = createTaskDomainScenario(projectId)
  stores.set(projectId, store)
  return store
}

function response<T>(data: T, status = 200): HttpResponse<Record<string, unknown>> {
  return HttpResponse.json(
    { data, requestId: 'mock-request-id' },
    { status },
  ) as HttpResponse<Record<string, unknown>>
}

function page<T>(items: T[], request: Request): HttpResponse<Record<string, unknown>> {
  const search = new URL(request.url).searchParams
  const limitValue = Number(search.get('limit') ?? '30')
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 30
  const cursorValue = Number(search.get('cursor') ?? '0')
  const start = Number.isFinite(cursorValue) && cursorValue >= 0 ? cursorValue : 0
  const data = items.slice(start, start + limit)
  const nextStart = start + data.length
  return HttpResponse.json({
    data,
    page: { nextCursor: nextStart < items.length ? String(nextStart) : null, hasMore: nextStart < items.length },
    requestId: 'mock-request-id',
  }) as HttpResponse<Record<string, unknown>>
}

function errorResponse(error: unknown): HttpResponse<Record<string, unknown>> {
  if (error instanceof InvalidStateTransitionError) {
    return HttpResponse.json(
      { error: { code: error.code, message: error.message, details: [] }, requestId: 'mock-request-id' },
      { status: error.status },
    )
  }
  return HttpResponse.json(
    {
      error: { code: 'MOCK_NOT_FOUND', message: 'Mock resource was not found', details: [] },
      requestId: 'mock-request-id',
    },
    { status: 404 },
  )
}

function deliverableErrorResponse(status: 403 | 404 | 422, code: string, message: string): HttpResponse<Record<string, unknown>> {
  return HttpResponse.json(
    { error: { code, message, details: [] }, requestId: 'mock-request-id' },
    { status },
  ) as HttpResponse<Record<string, unknown>>
}

async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  return body as Record<string, unknown>
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validationError(message: string, field: string): HttpResponse<Record<string, unknown>> {
  return HttpResponse.json(
    {
      error: { code: 'VALIDATION_FAILED', message, details: [{ field, reason: 'required' }] },
      requestId: 'mock-request-id',
    },
    { status: 422 },
  ) as HttpResponse<Record<string, unknown>>
}

function newResourceId(projectId: string, resource: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${resource}-${projectId}-${suffix}`
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function completeCancellation(resource: { status: string }): void {
  queueMicrotask(() => {
    if (resource.status === 'CANCELLING') resource.status = 'CANCELLED'
  })
}

function activateManualWorkPackage(store: TaskDomainState, workPackage: WorkPackage): void {
  const run = findOrchestrationRun(store, workPackage.orchestrationRunId)
  if (!run || run.status !== 'QUEUED') return

  run.status = 'RUNNING'
  run.updatedAt = workPackage.updatedAt
  for (const taskRun of store.taskRuns.values()) {
    if (taskRun.workPackageId !== workPackage.id || taskRun.status !== 'QUEUED') continue
    taskRun.status = 'WAITING_INPUT'
    taskRun.startedAt = workPackage.updatedAt
    taskRun.updatedAt = workPackage.updatedAt
    const request: InputRequest = {
      id: `${taskRun.id}-input-request`,
      projectId: taskRun.projectId,
      taskRunId: taskRun.id,
      kind: 'INPUT',
      status: 'PENDING',
      prompt: 'Select the target branch',
      options: [
        { value: 'main', label: 'main' },
        { value: 'develop', label: 'develop' },
      ],
      createdAt: workPackage.updatedAt,
      resolvedAt: null,
    }
    store.inputRequests.set(taskRun.id, [request])
  }
}

export const taskDomainHandlers = [
  http.all('*/api/projects/:projectId/*', ({ request }) => {
    const error = new URL(request.url).searchParams.get('error')
    if (error === 'FORBIDDEN') {
      return HttpResponse.json(
        {
          error: { code: 'PROJECT_MEMBER_REQUIRED', message: 'Mock permission denied', details: [] },
          requestId: 'mock-request-id',
        },
        { status: 403 },
      ) as HttpResponse<Record<string, unknown>>
    }
    if (error === 'INVALID') {
      return HttpResponse.json(
        {
          error: { code: 'VALIDATION_FAILED', message: 'Mock validation failed', details: [] },
          requestId: 'mock-request-id',
        },
        { status: 422 },
      ) as HttpResponse<Record<string, unknown>>
    }
    if (error === 'CONFLICT') {
      return HttpResponse.json(
        {
          error: { code: 'INPUT_REQUEST_CONFLICT', message: 'Mock input request was handled elsewhere', details: [] },
          requestId: 'mock-request-id',
        },
        { status: 409 },
      ) as HttpResponse<Record<string, unknown>>
    }
    return undefined
  }),

  http.post('*/api/projects/:projectId/orchestration-runs', async ({ params, request }) => {
    const projectId = pathParam(params, 'projectId')
    const store = getStore(projectId, request)
    const body = await jsonObject(request)
    if (!isNonEmptyString(projectId)) return validationError('projectId is required', 'projectId')
    if (!isNonEmptyString(body.groupId)) return validationError('groupId is required', 'groupId')
    if (!isNonEmptyString(body.instruction)) return validationError('instruction is required', 'instruction')
    if (body.workflowId !== 'system-default-code-delivery') {
      return validationError('Only the system default workflow is supported', 'workflowId')
    }
    if (body.startMode !== 'AUTO' && body.startMode !== 'MANUAL') {
      return validationError('startMode must be AUTO or MANUAL', 'startMode')
    }
    if (body.testsetIds !== undefined && (!Array.isArray(body.testsetIds) || !body.testsetIds.every(isNonEmptyString))) {
      return validationError('testsetIds must be an array of ids', 'testsetIds')
    }
    const now = new Date().toISOString()
    const startMode = body.startMode as StartMode
    const run: OrchestrationRun = {
      id: newResourceId(projectId, 'orchestration'),
      projectId,
      groupId: body.groupId.trim(),
      instruction: body.instruction.trim(),
      workflowId: 'system-default-code-delivery' as const,
      startMode: startMode as StartMode,
      status: startMode === 'AUTO' ? 'RUNNING' : 'QUEUED',
      createdBy: 'demo-user',
      workPackageIds: [],
      createdAt: now,
      updatedAt: now,
    }
    addCreatedOrchestrationRunResources(store, run)
    store.orchestrationRuns.set(run.id, run)
    return response(run, 202)
  }),

  http.get('*/api/projects/:projectId/orchestration-runs', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const search = new URL(request.url).searchParams
    const groupId = search.get('groupId')
    const status = search.get('status')
    const runs = [...store.orchestrationRuns.values()].filter(
      (run) => (!groupId || run.groupId === groupId) && (!status || run.status === status),
    )
    return page(runs, request)
  }),

  http.get('*/api/projects/:projectId/orchestration-runs/:runId', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const run = findOrchestrationRun(store, pathParam(params, 'runId'))
    return run ? response(run) : errorResponse(new Error('not found'))
  }),

  http.post('*/api/projects/:projectId/orchestration-runs/:runId/cancel', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const run = findOrchestrationRun(store, pathParam(params, 'runId'))
    if (!run) return errorResponse(new Error('not found'))
    try {
      run.status = transitionOrchestrationRunCancel(run.status)
      run.updatedAt = new Date().toISOString()
      if (run.status === 'CANCELLING') completeCancellation(run)
      return response(run, 202)
    } catch (error: unknown) {
      return errorResponse(error)
    }
  }),

  http.get('*/api/projects/:projectId/work-packages', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const search = new URL(request.url).searchParams
    const groupId = search.get('groupId')
    const status = search.get('status')
    const repositoryId = search.get('repositoryId')
    const workPackages = [...store.workPackages.values()].filter(
      (workPackage) =>
        (!groupId || workPackage.groupId === groupId) &&
        (!status || workPackage.status === status) &&
        (!repositoryId || workPackage.repositoryId === repositoryId),
    )
    return page(workPackages, request)
  }),

  http.get('*/api/projects/:projectId/work-packages/:workPackageId', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const workPackage = findWorkPackage(store, pathParam(params, 'workPackageId'))
    return workPackage ? response(workPackage) : errorResponse(new Error('not found'))
  }),

  http.patch('*/api/projects/:projectId/work-packages/:workPackageId', async ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const workPackage = findWorkPackage(store, pathParam(params, 'workPackageId'))
    if (!workPackage) return errorResponse(new Error('not found'))
    const body = (await jsonObject(request)) as UpdateWorkPackageInput
    if (workPackage.status !== 'PLANNING' && workPackage.status !== 'READY') {
      return errorResponse(new InvalidStateTransitionError('WorkPackage', workPackage.status, 'update'))
    }
    if (body.title !== undefined) workPackage.title = body.title
    if (body.description !== undefined) workPackage.description = body.description
    if (body.priority !== undefined) workPackage.priority = numberValue(body.priority, workPackage.priority)
    if (body.testsetIds !== undefined) workPackage.testsetIds = body.testsetIds
    if (body.startMode !== undefined) workPackage.startMode = body.startMode
    workPackage.updatedAt = new Date().toISOString()
    return response(workPackage)
  }),

  ...(['start', 'pause', 'resume', 'cancel'] as const).map((action) =>
    http.post(`*/api/projects/:projectId/work-packages/:workPackageId/${action}`, ({ params, request }) => {
      const store = getStore(pathParam(params, 'projectId'), request)
      const workPackage = findWorkPackage(store, pathParam(params, 'workPackageId'))
      if (!workPackage) return errorResponse(new Error('not found'))
      try {
        workPackage.status = transitionWorkPackageStatus(workPackage.status, action)
        workPackage.updatedAt = new Date().toISOString()
        if (action === 'start') activateManualWorkPackage(store, workPackage)
        if (action === 'cancel' && workPackage.status === 'CANCELLING') completeCancellation(workPackage)
        return response(workPackage, 202)
      } catch (error: unknown) {
        return errorResponse(error)
      }
    }),
  ),

  http.get('*/api/projects/:projectId/work-packages/:workPackageId/task-runs', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const workPackageId = pathParam(params, 'workPackageId')
    const status = new URL(request.url).searchParams.get('status')
    const taskRuns = [...store.taskRuns.values()].filter(
      (taskRun) => taskRun.workPackageId === workPackageId && (!status || taskRun.status === status),
    )
    return page(taskRuns, request)
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const taskRun = findTaskRun(store, pathParam(params, 'taskRunId'))
    return taskRun ? response(taskRun) : errorResponse(new Error('not found'))
  }),

  http.post('*/api/projects/:projectId/task-runs/:taskRunId/retry', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const taskRun = findTaskRun(store, pathParam(params, 'taskRunId'))
    if (!taskRun) return errorResponse(new Error('not found'))
    if (!canRetryTaskRun(taskRun.status)) {
      return errorResponse(new InvalidStateTransitionError('TaskRun', taskRun.status, 'retry'))
    }
    const retry: TaskRun = {
      ...taskRun,
      id: `${taskRun.id}-retry-${Date.now()}`,
      status: 'QUEUED',
      retryOfTaskRunId: taskRun.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.taskRuns.set(retry.id, retry)
    const retrySteps = store.steps.get(taskRun.id)
    if (retrySteps) {
      store.steps.set(retry.id, retrySteps.map((step) => ({
        ...step,
        id: `${retry.id}-${step.id}`,
        taskRunId: retry.id,
      })))
    }
    const retryLogs = store.logs.get(taskRun.id)
    if (retryLogs) {
      store.logs.set(retry.id, retryLogs.map((log) => ({
        ...log,
        id: `${retry.id}-${log.id}`,
        taskRunId: retry.id,
      })))
    }
    const retryContext = store.executionContexts.get(taskRun.id)
    if (retryContext) {
      store.executionContexts.set(retry.id, { ...retryContext, id: `${retry.id}-context`, taskRunId: retry.id })
    }
    const retryRequests = store.inputRequests.get(taskRun.id)
    if (retryRequests) {
      store.inputRequests.set(retry.id, retryRequests.map((request) => ({
        ...request,
        id: `${retry.id}-${request.id}`,
        taskRunId: retry.id,
      })))
    }
    return response(retry, 202)
  }),

  http.post('*/api/projects/:projectId/task-runs/:taskRunId/cancel', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const taskRun = findTaskRun(store, pathParam(params, 'taskRunId'))
    if (!taskRun) return errorResponse(new Error('not found'))
    try {
      taskRun.status = transitionTaskRunCancel(taskRun.status)
      taskRun.updatedAt = new Date().toISOString()
      completeCancellation(taskRun)
      return response(taskRun, 202)
    } catch (error: unknown) {
      return errorResponse(error)
    }
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/steps', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    return page(store.steps.get(pathParam(params, 'taskRunId')) ?? [], request)
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/logs', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    return page(store.logs.get(pathParam(params, 'taskRunId')) ?? [], request)
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/execution-context', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const context = store.executionContexts.get(pathParam(params, 'taskRunId'))
    return context ? response(context) : errorResponse(new Error('not found'))
  }),

  http.get('*/api/projects/:projectId/task-runs/:taskRunId/input-requests', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    return page(store.inputRequests.get(pathParam(params, 'taskRunId')) ?? [], request)
  }),

  ...(['reply', 'approve', 'reject'] as const).map((action) =>
    http.post(
      `*/api/projects/:projectId/task-runs/:taskRunId/input-requests/:requestId/${action}`,
      async ({ params, request }) => {
        const store = getStore(pathParam(params, 'projectId'), request)
        const inputRequest = findInputRequest(
          store,
          pathParam(params, 'taskRunId'),
          pathParam(params, 'requestId'),
        )
        if (!inputRequest) return errorResponse(new Error('not found'))
        if (inputRequest.status !== 'PENDING') {
          return errorResponse(new InvalidStateTransitionError('InputRequest', inputRequest.status, action))
        }
        const body = await jsonObject(request)
        if (action === 'reply') {
          const answer = body as unknown as InputRequestAnswer
          if (!answer.answer || typeof answer.answer.value !== 'string' || answer.answer.value.trim().length === 0) {
            return errorResponse(new InvalidStateTransitionError('InputRequest', 'INVALID', action))
          }
          inputRequest.status = 'ANSWERED'
        } else {
          const decision = body as unknown as DecisionInput
          if (typeof decision.reason !== 'string' || (action === 'reject' && decision.reason.trim().length === 0)) {
            return errorResponse(new InvalidStateTransitionError('InputRequest', 'INVALID', action))
          }
          inputRequest.status = action === 'approve' ? 'APPROVED' : 'REJECTED'
        }
        inputRequest.resolvedAt = new Date().toISOString()
        const taskRun = findTaskRun(store, pathParam(params, 'taskRunId'))
        if (taskRun && (taskRun.status === 'WAITING_INPUT' || taskRun.status === 'WAITING_APPROVAL')) {
          taskRun.status = transitionTaskRunInputRequest(taskRun.status)
          taskRun.updatedAt = inputRequest.resolvedAt
        }
        return response(inputRequest, 202)
      },
    ),
  ),

  http.get('*/api/projects/:projectId/work-packages/:workPackageId/deliverables', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const workPackageId = pathParam(params, 'workPackageId')
    return page(
      [...store.deliverables.values()].filter((deliverable) => deliverable.workPackageId === workPackageId),
      request,
    )
  }),

  http.get('*/api/projects/:projectId/deliverables/:deliverableId', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const deliverableId = pathParam(params, 'deliverableId')
    if (deliverableId === 'forbidden') return deliverableErrorResponse(403, 'MOCK_FORBIDDEN', 'Forbidden')
    const deliverable = store.deliverables.get(deliverableId)
    return deliverable ? response(deliverable) : errorResponse(new Error('not found'))
  }),

  http.post('*/api/projects/:projectId/deliverables/:deliverableId/accept', ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const deliverable = store.deliverables.get(pathParam(params, 'deliverableId'))
    if (!deliverable) return errorResponse(new Error('not found'))
    try {
      deliverable.status = transitionDeliverableStatus(deliverable.status, 'accept')
      deliverable.updatedAt = new Date().toISOString()
      return response(deliverable, 202)
    } catch (error: unknown) {
      return errorResponse(error)
    }
  }),

  http.post('*/api/projects/:projectId/deliverables/:deliverableId/reject', async ({ params, request }) => {
    const store = getStore(pathParam(params, 'projectId'), request)
    const deliverable = store.deliverables.get(pathParam(params, 'deliverableId'))
    if (!deliverable) return errorResponse(new Error('not found'))
    const body = (await jsonObject(request)) as unknown as RejectDeliverableInput
    if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return deliverableErrorResponse(422, 'INVALID_REJECTION_REASON', 'Rejection reason is required')
    }
    try {
      deliverable.status = transitionDeliverableStatus(deliverable.status, 'reject')
      deliverable.rejectionReason = body.reason
      deliverable.updatedAt = new Date().toISOString()
      return response(deliverable, 202)
    } catch (error: unknown) {
      return errorResponse(error)
    }
  }),
]
