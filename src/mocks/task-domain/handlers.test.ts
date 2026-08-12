import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { resetTaskDomainStores, taskDomainHandlers } from './handlers'

const server = setupServer(...taskDomainHandlers)
const baseUrl = 'http://localhost/api'

async function jsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetTaskDomainStores())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('task domain MSW scenarios', () => {
  it('registers waiting input and approval requests on selectable task runs', async () => {
    const runResponse = await fetch(`${baseUrl}/projects/project-chain/orchestration-runs/orchestration-project-chain-1`)
    const run = await jsonResponse<{
      data: { id: string; projectId: string; workPackageIds: string[] }
    }>(runResponse)
    expect(runResponse.status).toBe(200)

    const workPackageResponses = await Promise.all(run.data.workPackageIds.map(async (workPackageId) => {
      const response = await fetch(`${baseUrl}/projects/project-chain/work-packages/${workPackageId}`)
      return jsonResponse<{ data: { id: string; orchestrationRunId: string } }>(response)
    }))
    expect(workPackageResponses.every((response) => response.data.orchestrationRunId === run.data.id)).toBe(true)

    const taskRuns = (await Promise.all(workPackageResponses.map(async (workPackage) => {
      const response = await fetch(
        `${baseUrl}/projects/project-chain/work-packages/${workPackage.data.id}/task-runs`,
      )
      const page = await jsonResponse<{ data: Array<{ id: string; status: string; workPackageId: string }> }>(response)
      return page.data
    }))).flat()
    const waitingInputRun = taskRuns.find((taskRun) => taskRun.status === 'WAITING_INPUT')
    const waitingApprovalRun = taskRuns.find((taskRun) => taskRun.status === 'WAITING_APPROVAL')
    expect(waitingInputRun).toBeDefined()
    expect(waitingApprovalRun).toBeDefined()
    expect(waitingInputRun?.workPackageId).toBe(workPackageResponses[0].data.id)
    expect(waitingApprovalRun?.workPackageId).toBe(workPackageResponses[1].data.id)

    for (const taskRun of [waitingInputRun, waitingApprovalRun]) {
      const response = await fetch(
        `${baseUrl}/projects/project-chain/task-runs/${taskRun?.id}/input-requests?limit=40`,
      )
      const page = await jsonResponse<{ data: Array<{ taskRunId: string; status: string }> }>(response)
      expect(page.data).toHaveLength(1)
      expect(page.data[0].taskRunId).toBe(taskRun?.id)
      expect(page.data[0].status).toBe('PENDING')
    }
  })

  it('returns a 202 orchestration summary and supports cursor pagination', async () => {
    const createResponse = await fetch(`${baseUrl}/projects/project-test/orchestration-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'test-create-1' },
      body: JSON.stringify({
        groupId: 'group-test',
        instruction: 'run tests',
        workflowId: 'system-default-code-delivery',
        startMode: 'AUTO',
      }),
    })
    expect(createResponse.status).toBe(202)

    const listResponse = await fetch(
      `${baseUrl}/projects/project-test/orchestration-runs?limit=1`,
    )
    const list = await jsonResponse<{ data: unknown[]; page: { nextCursor: string | null; hasMore: boolean } }>(
      listResponse,
    )
    expect(listResponse.status).toBe(200)
    expect(list.data).toHaveLength(1)
    expect(list.page.hasMore).toBe(true)
    expect(list.page.nextCursor).toBe('1')
  })

  it('cancels a running orchestration and then completes it asynchronously', async () => {
    const response = await fetch(
      `${baseUrl}/projects/project-cancel-run/orchestration-runs/orchestration-project-cancel-run-1/cancel`,
      { method: 'POST', headers: { 'Idempotency-Key': 'cancel-run-1' } },
    )
    const body = await jsonResponse<{ data: { status: string } }>(response)
    expect(response.status).toBe(202)
    expect(body.data.status).toBe('CANCELLING')

    await Promise.resolve()
    const detailResponse = await fetch(
      `${baseUrl}/projects/project-cancel-run/orchestration-runs/orchestration-project-cancel-run-1`,
    )
    const detail = await jsonResponse<{ data: { status: string } }>(detailResponse)
    expect(detail.data.status).toBe('CANCELLED')
  })

  it('cancels queued runs immediately and rejects terminal duplicate cancellation', async () => {
    const queuedResponse = await fetch(
      `${baseUrl}/projects/project-cancel-queued/orchestration-runs/orchestration-project-cancel-queued-1/cancel?scenario=QUEUED`,
      { method: 'POST', headers: { 'Idempotency-Key': 'cancel-queued-1' } },
    )
    const queued = await jsonResponse<{ data: { status: string } }>(queuedResponse)
    expect(queuedResponse.status).toBe(202)
    expect(queued.data.status).toBe('CANCELLED')

    const terminalResponse = await fetch(
      `${baseUrl}/projects/project-cancel-terminal/orchestration-runs/orchestration-project-cancel-terminal-1/cancel?scenario=SUCCEEDED`,
      { method: 'POST', headers: { 'Idempotency-Key': 'cancel-terminal-1' } },
    )
    expect(terminalResponse.status).toBe(409)
  })

  it.each([
    ['FORBIDDEN', 403],
    ['INVALID', 422],
  ] as const)('returns %s cancellation errors', async (error, status) => {
    const response = await fetch(
      `${baseUrl}/projects/project-cancel-errors/orchestration-runs/orchestration-project-cancel-errors-1/cancel?error=${error}`,
      { method: 'POST', headers: { 'Idempotency-Key': `cancel-${error}` } },
    )
    expect(response.status).toBe(status)
  })

  it('returns 404 when the orchestration run does not exist', async () => {
    const response = await fetch(
      `${baseUrl}/projects/project-cancel-errors/orchestration-runs/missing-run/cancel`,
      { method: 'POST', headers: { 'Idempotency-Key': 'cancel-missing' } },
    )
    expect(response.status).toBe(404)
  })

  it('validates required orchestration fields and workflow inputs', async () => {
    const missingInstruction = await fetch(`${baseUrl}/projects/project-validation/orchestration-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: 'group-validation',
        workflowId: 'system-default-code-delivery',
        startMode: 'AUTO',
      }),
    })
    expect(missingInstruction.status).toBe(422)

    const invalidWorkflow = await fetch(`${baseUrl}/projects/project-validation/orchestration-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: 'group-validation',
        instruction: 'run tests',
        workflowId: 'invalid-workflow',
        startMode: 'AUTO',
      }),
    })
    expect(invalidWorkflow.status).toBe(422)
  })

  it.each([
    ['AUTO', 'RUNNING'],
    ['MANUAL', 'QUEUED'],
  ] as const)('creates a new %s orchestration run in %s', async (startMode, status) => {
    const createResponse = await fetch(`${baseUrl}/projects/project-start-mode/orchestration-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: 'group-start-mode',
        instruction: `start ${startMode}`,
        workflowId: 'system-default-code-delivery',
        startMode,
      }),
    })
    const created = await jsonResponse<{
      data: { id: string; status: string; startMode: string; workPackageIds: string[] }
    }>(createResponse)
    expect(createResponse.status).toBe(202)
    expect(created.data.id).not.toBe('orchestration-project-start-mode-1')
    expect(created.data.status).toBe(status)
    expect(created.data.startMode).toBe(startMode)

    const listResponse = await fetch(
      `${baseUrl}/projects/project-start-mode/orchestration-runs?groupId=group-start-mode`,
    )
    const list = await jsonResponse<{ data: Array<{ id: string }> }>(listResponse)
    expect(listResponse.status).toBe(200)
    expect(list.data.some((item) => item.id === created.data.id)).toBe(true)

    const detailResponse = await fetch(
      `${baseUrl}/projects/project-start-mode/orchestration-runs/${created.data.id}`,
    )
    const detail = await jsonResponse<{ data: { id: string; instruction: string } }>(detailResponse)
    expect(detailResponse.status).toBe(200)
    expect(detail.data.id).toBe(created.data.id)
    expect(detail.data.instruction).toBe(`start ${startMode}`)

    const workPackageResponse = await fetch(
      `${baseUrl}/projects/project-start-mode/work-packages/${created.data.workPackageIds[0]}`,
    )
    const workPackage = await jsonResponse<{ data: { orchestrationRunId: string; status: string } }>(workPackageResponse)
    expect(workPackage.data.orchestrationRunId).toBe(created.data.id)
    expect(workPackage.data.status).toBe(startMode === 'AUTO' ? 'RUNNING' : 'READY')
  })

  it('walks one newly-created MANUAL run through its related resource graph', async () => {
    const projectId = 'project-created-chain'
    const createResponse = await fetch(`${baseUrl}/projects/${projectId}/orchestration-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'created-chain-1' },
      body: JSON.stringify({
        groupId: 'group-created-chain',
        instruction: 'implement created chain',
        workflowId: 'system-default-code-delivery',
        startMode: 'MANUAL',
      }),
    })
    const created = await jsonResponse<{
      data: { id: string; projectId: string; status: string; workPackageIds: string[] }
    }>(createResponse)
    expect(createResponse.status).toBe(202)
    expect(created.data.projectId).toBe(projectId)
    expect(created.data.status).toBe('QUEUED')
    expect(created.data.workPackageIds).toHaveLength(1)

    const runId = created.data.id
    const workPackageId = created.data.workPackageIds[0]
    const taskCenter = await jsonResponse<{ data: Array<{ id: string; projectId: string }> }>(await fetch(
      `${baseUrl}/projects/${projectId}/orchestration-runs?groupId=group-created-chain`,
    ))
    expect(taskCenter.data.some((run) => run.id === runId && run.projectId === projectId)).toBe(true)
    const runDetail = await jsonResponse<{
      data: { id: string; projectId: string; workPackageIds: string[] }
    }>(await fetch(`${baseUrl}/projects/${projectId}/orchestration-runs/${runId}`))
    expect(runDetail.data.id).toBe(runId)
    expect(runDetail.data.workPackageIds).toEqual([workPackageId])

    const workPackage = await jsonResponse<{
      data: { id: string; projectId: string; orchestrationRunId: string; subtaskIds: string[]; status: string }
    }>(await fetch(`${baseUrl}/projects/${projectId}/work-packages/${workPackageId}`))
    expect(workPackage.data.projectId).toBe(projectId)
    expect(workPackage.data.orchestrationRunId).toBe(runId)
    expect(workPackage.data.subtaskIds).toHaveLength(1)

    const started = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/start`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-start' } },
    ))
    expect(started.data.status).toBe('RUNNING')
    const paused = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/pause`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-pause' } },
    ))
    expect(paused.data.status).toBe('PAUSED')
    const resumed = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/resume`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-resume' } },
    ))
    expect(resumed.data.status).toBe('RUNNING')

    const taskRunPage = await jsonResponse<{
      data: Array<{
        id: string
        projectId: string
        orchestrationRunId: string
        workPackageId: string
        status: string
      }>
    }>(await fetch(`${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/task-runs`))
    expect(taskRunPage.data).toHaveLength(1)
    const taskRun = taskRunPage.data[0]
    expect(taskRun.projectId).toBe(projectId)
    expect(taskRun.orchestrationRunId).toBe(runId)
    expect(taskRun.workPackageId).toBe(workPackageId)
    expect(taskRun.status).toBe('WAITING_INPUT')

    const [steps, logs, executionContext, inputRequests] = await Promise.all([
      fetch(`${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/steps`).then((response) =>
        jsonResponse<{ data: Array<{ taskRunId: string }> }>(response)),
      fetch(`${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/logs`).then((response) =>
        jsonResponse<{ data: Array<{ taskRunId: string }> }>(response)),
      fetch(`${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/execution-context`).then((response) =>
        jsonResponse<{ data: { taskRunId: string } }>(response)),
      fetch(`${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/input-requests`).then((response) =>
        jsonResponse<{ data: Array<{ id: string; taskRunId: string; status: string }> }>(response)),
    ])
    expect(steps.data[0].taskRunId).toBe(taskRun.id)
    expect(logs.data[0].taskRunId).toBe(taskRun.id)
    expect(executionContext.data.taskRunId).toBe(taskRun.id)
    expect(inputRequests.data).toHaveLength(1)
    expect(inputRequests.data[0].taskRunId).toBe(taskRun.id)
    expect(inputRequests.data[0].status).toBe('PENDING')

    const inputResponse = await fetch(
      `${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/input-requests/${inputRequests.data[0].id}/reply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'created-chain-input' },
        body: JSON.stringify({ answer: { value: 'main' } }),
      },
    )
    expect(inputResponse.status).toBe(202)
    const handledTaskRun = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}`,
    ))
    expect(handledTaskRun.data.status).toBe('RUNNING')

    const cancelTaskRun = await jsonResponse<{ data: { id: string; status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/cancel`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-task-cancel' } },
    ))
    expect(cancelTaskRun.data.status).toBe('CANCELLING')
    await Promise.resolve()
    const retry = await jsonResponse<{
      data: { id: string; status: string; retryOfTaskRunId: string | null; workPackageId: string }
    }>(await fetch(
      `${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}/retry`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-task-retry' } },
    ))
    expect(retry.data.id).not.toBe(taskRun.id)
    expect(retry.data.status).toBe('QUEUED')
    expect(retry.data.retryOfTaskRunId).toBe(taskRun.id)
    expect(retry.data.workPackageId).toBe(workPackageId)
    const originalTaskRun = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}`,
    ))
    expect(originalTaskRun.data.status).toBe('CANCELLED')

    const deliverables = await jsonResponse<{
      data: Array<{
        id: string
        projectId: string
        workPackageId: string
        taskRunId: string
        status: string
      }>
    }>(await fetch(`${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/deliverables`))
    expect(deliverables.data).toHaveLength(1)
    const deliverable = deliverables.data[0]
    expect(deliverable.projectId).toBe(projectId)
    expect(deliverable.workPackageId).toBe(workPackageId)
    expect(deliverable.taskRunId).toBe(taskRun.id)
    expect(deliverable.status).toBe('PENDING_REVIEW')
    const accepted = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/deliverables/${deliverable.id}/accept`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-deliverable-accept' } },
    ))
    expect(accepted.data.status).toBe('ACCEPTED')

    const repeatAccept = await fetch(
      `${baseUrl}/projects/${projectId}/deliverables/${deliverable.id}/accept`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-deliverable-repeat' } },
    )
    expect(repeatAccept.status).toBe(409)
    const deliverableAfterConflict = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/deliverables/${deliverable.id}`,
    ))
    expect(deliverableAfterConflict.data.status).toBe('ACCEPTED')

    const forbidden = await fetch(`${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}?error=FORBIDDEN`)
    expect(forbidden.status).toBe(403)
    const missing = await fetch(`${baseUrl}/projects/${projectId}/task-runs/missing-task-run`)
    expect(missing.status).toBe(404)
    const taskRunAfterErrors = await fetch(`${baseUrl}/projects/${projectId}/task-runs/${taskRun.id}`)
    expect(taskRunAfterErrors.status).toBe(200)

    const cancelledWorkPackage = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/cancel`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-work-package-cancel' } },
    ))
    expect(cancelledWorkPackage.data.status).toBe('CANCELLING')
    await Promise.resolve()
    const cancelledRun = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/orchestration-runs/${runId}/cancel`,
      { method: 'POST', headers: { 'Idempotency-Key': 'created-chain-run-cancel' } },
    ))
    expect(cancelledRun.data.status).toBe('CANCELLING')
    await Promise.resolve()
    const finalRun = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/orchestration-runs/${runId}`,
    ))
    expect(finalRun.data.status).toBe('CANCELLED')
  })

  it('creates an isolated MANUAL graph that starts its own work package', async () => {
    const projectId = 'project-manual-created'
    const response = await fetch(`${baseUrl}/projects/${projectId}/orchestration-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'manual-created-1' },
      body: JSON.stringify({
        groupId: 'group-manual-created',
        instruction: 'manual created chain',
        workflowId: 'system-default-code-delivery',
        startMode: 'MANUAL',
      }),
    })
    const created = await jsonResponse<{
      data: { id: string; projectId: string; status: string; workPackageIds: string[] }
    }>(response)
    expect(created.data.status).toBe('QUEUED')
    expect(created.data.workPackageIds).toHaveLength(1)
    const workPackageId = created.data.workPackageIds[0]
    const workPackage = await jsonResponse<{ data: { projectId: string; orchestrationRunId: string; status: string } }>(
      await fetch(`${baseUrl}/projects/${projectId}/work-packages/${workPackageId}`),
    )
    expect(workPackage.data.projectId).toBe(projectId)
    expect(workPackage.data.orchestrationRunId).toBe(created.data.id)
    expect(workPackage.data.status).toBe('READY')
    const started = await jsonResponse<{ data: { status: string } }>(await fetch(
      `${baseUrl}/projects/${projectId}/work-packages/${workPackageId}/start`,
      { method: 'POST', headers: { 'Idempotency-Key': 'manual-created-start' } },
    ))
    expect(started.data.status).toBe('RUNNING')

    const otherProject = await fetch(
      `http://localhost/api/projects/project-other/orchestration-runs/${created.data.id}`,
    )
    expect(otherProject.status).toBe(404)
    const otherProjectList = await jsonResponse<{ data: Array<{ id: string }> }>(await fetch(
      'http://localhost/api/projects/project-other/orchestration-runs',
    ))
    expect(otherProjectList.data.some((run) => run.id === created.data.id)).toBe(false)
  })

  it.each([
    ['FORBIDDEN', 403],
    ['CONFLICT', 409],
    ['INVALID', 422],
  ] as const)('returns %s errors from orchestration creation', async (error, status) => {
    const response = await fetch(
      `${baseUrl}/projects/project-errors/orchestration-runs?error=${error}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: 'group-errors',
          instruction: 'trigger error',
          workflowId: 'system-default-code-delivery',
          startMode: 'AUTO',
        }),
      },
    )
    expect(response.status).toBe(status)
  })

  it('enforces work package pause/resume and rejects illegal pause', async () => {
    const readyResponse = await fetch(
      `${baseUrl}/projects/project-ready/work-packages?scenario=RUNNING`,
    )
    const readyPage = await jsonResponse<{ data: Array<{ id: string }> }>(readyResponse)
    const workPackageId = readyPage.data[0].id
    const readyWorkPackageId = readyPage.data[1].id

    const pauseResponse = await fetch(
      `${baseUrl}/projects/project-ready/work-packages/${workPackageId}/pause`,
      { method: 'POST', headers: { 'Idempotency-Key': 'pause-1' } },
    )
    expect(pauseResponse.status).toBe(202)

    const resumeResponse = await fetch(
      `${baseUrl}/projects/project-ready/work-packages/${workPackageId}/resume`,
      { method: 'POST', headers: { 'Idempotency-Key': 'resume-1' } },
    )
    expect(resumeResponse.status).toBe(202)

    const illegalPauseResponse = await fetch(
      `${baseUrl}/projects/project-ready/work-packages/${readyWorkPackageId}/pause`,
      { method: 'POST', headers: { 'Idempotency-Key': 'pause-2' } },
    )
    expect(illegalPauseResponse.status).toBe(409)
  })

  it('supports the complete WorkPackage control lifecycle', async () => {
    const readyPackageId = 'work-package-project-controls-1'
    const readyResponse = await fetch(`${baseUrl}/projects/project-controls/work-packages/${readyPackageId}?scenario=RUNNING`)
    expect(readyResponse.status).toBe(200)

    const startResponse = await fetch(`${baseUrl}/projects/project-controls/work-packages/${readyPackageId}/start`, {
      method: 'POST', headers: { 'Idempotency-Key': 'start-1' },
    })
    expect(startResponse.status).toBe(409)

    const packageList = await fetch(`${baseUrl}/projects/project-controls/work-packages?scenario=RUNNING`)
    const packages = await jsonResponse<{ data: Array<{ id: string; status: string }> }>(packageList)
    const runningPackage = packages.data.find((item) => item.status === 'RUNNING')
    expect(runningPackage).toBeDefined()

    const pauseResponse = await fetch(`${baseUrl}/projects/project-controls/work-packages/${runningPackage?.id}/pause`, {
      method: 'POST', headers: { 'Idempotency-Key': 'pause-controls' },
    })
    expect(pauseResponse.status).toBe(202)
    const paused = await jsonResponse<{ data: { status: string } }>(pauseResponse)
    expect(paused.data.status).toBe('PAUSED')

    const resumeResponse = await fetch(`${baseUrl}/projects/project-controls/work-packages/${runningPackage?.id}/resume`, {
      method: 'POST', headers: { 'Idempotency-Key': 'resume-controls' },
    })
    expect(resumeResponse.status).toBe(202)
    const resumed = await jsonResponse<{ data: { status: string } }>(resumeResponse)
    expect(resumed.data.status).toBe('RUNNING')

    const cancelResponse = await fetch(`${baseUrl}/projects/project-controls/work-packages/${runningPackage?.id}/cancel`, {
      method: 'POST', headers: { 'Idempotency-Key': 'cancel-controls' },
    })
    expect(cancelResponse.status).toBe(202)
    const cancelling = await jsonResponse<{ data: { status: string } }>(cancelResponse)
    expect(cancelling.data.status).toBe('CANCELLING')
  })

  it('creates a new retry run while preserving the original run id', async () => {
    const listResponse = await fetch(
      `${baseUrl}/projects/project-retry/work-packages/work-package-project-retry-1/task-runs?scenario=FAILED`,
    )
    const list = await jsonResponse<{ data: Array<{ id: string; status: string }> }>(listResponse)
    const failedRun = list.data.find((taskRun) => taskRun.status === 'FAILED')
    expect(failedRun).toBeDefined()

    const retryResponse = await fetch(
      `${baseUrl}/projects/project-retry/task-runs/${failedRun?.id}/retry`,
      { method: 'POST', headers: { 'Idempotency-Key': 'retry-1' } },
    )
    const retry = await jsonResponse<{ data: { id: string; retryOfTaskRunId: string | null } }>(retryResponse)
    expect(retryResponse.status).toBe(202)
    expect(retry.data.id).not.toBe(failedRun?.id)
    expect(retry.data.retryOfTaskRunId).toBe(failedRun?.id)
  })

  it.each(['CANCELLED', 'BLOCKED'] as const)('retries a %s TaskRun without resetting the original', async (scenario) => {
    const projectId = `project-retry-${scenario.toLowerCase()}`
    const listResponse = await fetch(
      `${baseUrl}/projects/${projectId}/work-packages/work-package-${projectId}-1/task-runs?scenario=${scenario}`,
    )
    const list = await jsonResponse<{ data: Array<{ id: string; status: string; projectId: string; orchestrationRunId: string; workPackageId: string; subtaskId: string }> }>(listResponse)
    const original = list.data.find((taskRun) => taskRun.status === scenario)
    expect(original).toBeDefined()

    const retryResponse = await fetch(
      `${baseUrl}/projects/${projectId}/task-runs/${original?.id}/retry`,
      { method: 'POST', headers: { 'Idempotency-Key': `retry-${scenario}` } },
    )
    const retry = await jsonResponse<{ data: typeof list.data[number] & { retryOfTaskRunId: string | null } }>(retryResponse)
    expect(retryResponse.status).toBe(202)
    expect(retry.data.id).not.toBe(original?.id)
    expect(retry.data.retryOfTaskRunId).toBe(original?.id)
    expect(retry.data.projectId).toBe(original?.projectId)
    expect(retry.data.orchestrationRunId).toBe(original?.orchestrationRunId)
    expect(retry.data.workPackageId).toBe(original?.workPackageId)
    expect(retry.data.subtaskId).toBe(original?.subtaskId)

    const originalResponse = await fetch(`${baseUrl}/projects/${projectId}/task-runs/${original?.id}`)
    const originalAfterRetry = await jsonResponse<{ data: { id: string; status: string } }>(originalResponse)
    expect(originalAfterRetry.data.id).toBe(original?.id)
    expect(originalAfterRetry.data.status).toBe(scenario)
  })

  it('returns CANCELLING for a cancellable TaskRun and rejects a second cancel with 409', async () => {
    const taskRunId = 'work-package-project-cancel-1-subtask-developer-run-1'
    const response = await fetch(
      `${baseUrl}/projects/project-cancel/task-runs/${taskRunId}/cancel?scenario=RUNNING`,
      { method: 'POST', headers: { 'Idempotency-Key': 'cancel-1' } },
    )
    const cancelling = await jsonResponse<{ data: { id: string; status: string } }>(response)
    expect(response.status).toBe(202)
    expect(cancelling.data.status).toBe('CANCELLING')

    const conflictResponse = await fetch(
      `${baseUrl}/projects/project-cancel/task-runs/${taskRunId}/cancel`,
      { method: 'POST', headers: { 'Idempotency-Key': 'cancel-2' } },
    )
    expect(conflictResponse.status).toBe(409)
  })

  it('resolves waiting input and approval requests', async () => {
    const inputListResponse = await fetch(
      `${baseUrl}/projects/project-input/task-runs/work-package-project-input-1-subtask-developer-run-1/input-requests?scenario=WAITING_INPUT`,
    )
    const inputList = await jsonResponse<{ data: Array<{ id: string }> }>(inputListResponse)
    const inputRequestId = inputList.data[0].id
    const replyResponse = await fetch(
      `${baseUrl}/projects/project-input/task-runs/work-package-project-input-1-subtask-developer-run-1/input-requests/${inputRequestId}/reply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'reply-1' },
        body: JSON.stringify({ answer: { value: 'main' } }),
      },
    )
    expect(replyResponse.status).toBe(202)

    const approvalListResponse = await fetch(
      `${baseUrl}/projects/project-approval/task-runs/work-package-project-approval-2-subtask-developer-run-1/input-requests?scenario=WAITING_APPROVAL`,
    )
    const approvalList = await jsonResponse<{ data: Array<{ id: string }> }>(approvalListResponse)
    const approvalRequestId = approvalList.data[0].id
    const approveResponse = await fetch(
      `${baseUrl}/projects/project-approval/task-runs/work-package-project-approval-2-subtask-developer-run-1/input-requests/${approvalRequestId}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'approve-1' },
        body: JSON.stringify({ reason: 'approved for sandbox' }),
      },
    )
    expect(approveResponse.status).toBe(202)
  })

  it('prevents accepting a deliverable outside pending review', async () => {
    const acceptResponse = await fetch(
      `${baseUrl}/projects/project-deliverable/deliverables/deliverable-project-deliverable-accepted/accept`,
      { method: 'POST', headers: { 'Idempotency-Key': 'accept-1' } },
    )
    expect(acceptResponse.status).toBe(409)
  })

  it('rejects only the requested pending deliverable', async () => {
    const rejectResponse = await fetch(
      `${baseUrl}/projects/project-deliverable/deliverables/deliverable-project-deliverable-pending/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'reject-1' },
        body: JSON.stringify({ reason: 'Missing required checks' }),
      },
    )
    expect(rejectResponse.status).toBe(202)
    const rejected = await jsonResponse<{ data: { status: string; rejectionReason: string } }>(rejectResponse)
    expect(rejected.data.status).toBe('REJECTED')
    expect(rejected.data.rejectionReason).toBe('Missing required checks')

    const acceptedResponse = await fetch(
      `${baseUrl}/projects/project-deliverable/deliverables/deliverable-project-deliverable-accepted`,
    )
    const accepted = await jsonResponse<{ data: { status: string } }>(acceptedResponse)
    expect(accepted.data.status).toBe('ACCEPTED')
  })
})
