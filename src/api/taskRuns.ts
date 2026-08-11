import { requestData, requestPage, withQuery, writeHeaders } from './taskDomain'
import type {
  DecisionInput,
  CursorPageFilters,
  ExecutionContext,
  InputRequest,
  InputRequestAnswer,
  TaskRun,
  TaskRunFilters,
  TaskRunLog,
  TaskRunStep,
} from '@/types'

const taskRunsPath = (projectId: string, taskRunId: string) =>
  `/projects/${projectId}/task-runs/${taskRunId}`

export const taskRunsApi = {
  list(projectId: string, workPackageId: string, filters: TaskRunFilters = {}) {
    return requestPage<TaskRun>(
      withQuery(`/projects/${projectId}/work-packages/${workPackageId}/task-runs`, filters),
    )
  },

  get(projectId: string, taskRunId: string) {
    return requestData<TaskRun>(taskRunsPath(projectId, taskRunId))
  },

  retry(projectId: string, taskRunId: string) {
    return requestData<TaskRun>(`${taskRunsPath(projectId, taskRunId)}/retry`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  cancel(projectId: string, taskRunId: string) {
    return requestData<TaskRun>(`${taskRunsPath(projectId, taskRunId)}/cancel`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  steps(projectId: string, taskRunId: string, filters: CursorPageFilters = {}) {
    return requestPage<TaskRunStep>(
      withQuery(`${taskRunsPath(projectId, taskRunId)}/steps`, filters),
    )
  },

  logs(projectId: string, taskRunId: string, cursor?: string, limit?: number) {
    return requestPage<TaskRunLog>(
      withQuery(`${taskRunsPath(projectId, taskRunId)}/logs`, { cursor, limit }),
    )
  },

  executionContext(projectId: string, taskRunId: string) {
    return requestData<ExecutionContext>(`${taskRunsPath(projectId, taskRunId)}/execution-context`)
  },

  inputRequests(projectId: string, taskRunId: string, filters: CursorPageFilters = {}) {
    return requestPage<InputRequest>(
      withQuery(`${taskRunsPath(projectId, taskRunId)}/input-requests`, filters),
    )
  },

  replyInputRequest(
    projectId: string,
    taskRunId: string,
    requestId: string,
    input: InputRequestAnswer,
  ) {
    return requestData<InputRequest>(
      `${taskRunsPath(projectId, taskRunId)}/input-requests/${requestId}/reply`,
      { method: 'POST', headers: writeHeaders(), body: input },
    )
  },

  approveInputRequest(projectId: string, taskRunId: string, requestId: string, input: DecisionInput) {
    return requestData<InputRequest>(
      `${taskRunsPath(projectId, taskRunId)}/input-requests/${requestId}/approve`,
      { method: 'POST', headers: writeHeaders(), body: input },
    )
  },

  rejectInputRequest(projectId: string, taskRunId: string, requestId: string, input: DecisionInput) {
    return requestData<InputRequest>(
      `${taskRunsPath(projectId, taskRunId)}/input-requests/${requestId}/reject`,
      { method: 'POST', headers: writeHeaders(), body: input },
    )
  },
}
