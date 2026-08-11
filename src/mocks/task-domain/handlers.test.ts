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
})
