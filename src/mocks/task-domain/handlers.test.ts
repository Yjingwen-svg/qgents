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
      body: JSON.stringify({ groupId: 'group-test', instruction: 'run tests' }),
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
