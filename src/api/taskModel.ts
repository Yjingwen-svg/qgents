import { requestModelData, requestModelPage, withModelQuery, writeModelHeaders } from './modelClient'
import {
  mapDiffComment,
  mapDiffCommentPage,
  mapDiffFilePage,
  mapMergeRequest,
  mapMergeRequestChecks,
  mapMergeRequestCqReviews,
  mapMergeRequestCommitList,
  mapMergeRequestPage,
} from './taskModelMap'
import type {
  DiffCommentInput,
  DiffDetail,
  DiffListFilters,
  DiffListItem,
  DiffRejectInput,
  ExecutionContext,
  InputRequest,
  InputRequestAnswer,
  InputRequestDecision,
  Task,
  TaskListItem,
  TaskCreateInput,
  TaskListFilters,
  TaskRunDetail,
  TaskRunListFilters,
  TaskRunLog,
  TaskRunSummary,
  TaskStep,
  TaskStepCreateInput,
  ReplaceTaskStepAgentInput,
  PageFilters,
  TaskArtifact,
  DiffReviewBatch,
  MergeRequestCreateInput,
  MergeRequestCqInput,
  MergeRequestListFilters,
} from '@/types/task-model'

const taskPath = (projectId: string, taskId: string) => `/projects/${projectId}/tasks/${taskId}`
const taskRunPath = (projectId: string, taskRunId: string) => `/projects/${projectId}/task-runs/${taskRunId}`
const diffPath = (projectId: string, diffId: string) => `/projects/${projectId}/diffs/${diffId}`

export const tasksApi = {
  create(projectId: string, input: TaskCreateInput) {
    return requestModelData<Task>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },

  list(projectId: string, filters: TaskListFilters = {}) {
    return requestModelPage<TaskListItem>(withModelQuery(`/projects/${projectId}/tasks`, filters))
  },

  get(projectId: string, taskId: string) {
    return requestModelData<Task>(taskPath(projectId, taskId))
  },

  artifacts(projectId: string, taskId: string) {
    return requestModelData<TaskArtifact[]>(`${taskPath(projectId, taskId)}/artifacts`)
  },

  diffReview(projectId: string, taskId: string) {
    return requestModelData<DiffReviewBatch>(`${taskPath(projectId, taskId)}/diff-review`)
  },

  confirmDiffReview(projectId: string, taskId: string) {
    return requestModelData<DiffReviewBatch>(`${taskPath(projectId, taskId)}/diff-review/confirm`, {
      method: 'POST',
      headers: writeModelHeaders(),
    })
  },

  rejectDiffReview(projectId: string, taskId: string, input: DiffRejectInput) {
    return requestModelData<DiffReviewBatch>(`${taskPath(projectId, taskId)}/diff-review/reject`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },

  retryDiffReviewDelivery(projectId: string, taskId: string) {
    return requestModelData<DiffReviewBatch>(`${taskPath(projectId, taskId)}/diff-review/retry-delivery`, {
      method: 'POST',
      headers: writeModelHeaders(),
    })
  },

  listSteps(projectId: string, taskId: string, filters: PageFilters = {}) {
    return requestModelPage<TaskStep>(withModelQuery(`${taskPath(projectId, taskId)}/steps`, filters))
  },

  createStep(projectId: string, taskId: string, input: TaskStepCreateInput) {
    return requestModelData<TaskStep>(`${taskPath(projectId, taskId)}/steps`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },

  replaceAgent(
    projectId: string,
    taskId: string,
    taskStepId: string,
    input: ReplaceTaskStepAgentInput,
  ) {
    return requestModelData<TaskStep>(`${taskPath(projectId, taskId)}/steps/${taskStepId}/replace-agent`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },

  cancel(projectId: string, taskId: string) {
    return requestModelData<Task>(`${taskPath(projectId, taskId)}/cancel`, {
      method: 'POST',
      headers: writeModelHeaders(),
    })
  },
}

export const taskRunsApi = {
  list(projectId: string, taskId: string, filters: TaskRunListFilters = {}) {
    return requestModelPage<TaskRunSummary>(withModelQuery(`${taskPath(projectId, taskId)}/task-runs`, filters))
  },

  get(projectId: string, taskRunId: string) {
    return requestModelData<TaskRunDetail>(taskRunPath(projectId, taskRunId))
  },

  retry(projectId: string, taskRunId: string) {
    return requestModelData<TaskRunDetail>(`${taskRunPath(projectId, taskRunId)}/retry`, {
      method: 'POST',
      headers: writeModelHeaders(),
    })
  },

  cancel(projectId: string, taskRunId: string) {
    return requestModelData<TaskRunDetail>(`${taskRunPath(projectId, taskRunId)}/cancel`, {
      method: 'POST',
      headers: writeModelHeaders(),
    })
  },

  logs(projectId: string, taskRunId: string, filters: PageFilters = {}) {
    return requestModelPage<TaskRunLog>(withModelQuery(`${taskRunPath(projectId, taskRunId)}/logs`, filters))
  },

  executionContext(projectId: string, taskRunId: string) {
    return requestModelData<ExecutionContext>(`${taskRunPath(projectId, taskRunId)}/execution-context`)
  },

  inputRequests(projectId: string, taskRunId: string, filters: PageFilters = {}) {
    return requestModelPage<InputRequest>(withModelQuery(`${taskRunPath(projectId, taskRunId)}/input-requests`, filters))
  },

  replyInputRequest(projectId: string, taskRunId: string, requestId: string, input: InputRequestAnswer) {
    return requestModelData<InputRequest>(`${taskRunPath(projectId, taskRunId)}/input-requests/${requestId}/reply`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },

  approveInputRequest(projectId: string, taskRunId: string, requestId: string, input: InputRequestDecision) {
    return requestModelData<InputRequest>(`${taskRunPath(projectId, taskRunId)}/input-requests/${requestId}/approve`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },

  rejectInputRequest(projectId: string, taskRunId: string, requestId: string, input: InputRequestDecision) {
    return requestModelData<InputRequest>(`${taskRunPath(projectId, taskRunId)}/input-requests/${requestId}/reject`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },
}

export const diffsApi = {
  list(projectId: string, filters: DiffListFilters = {}) {
    return requestModelPage<DiffListItem>(withModelQuery(`/projects/${projectId}/diffs`, filters))
  },

  get(projectId: string, diffId: string) {
    return requestModelData<DiffDetail>(diffPath(projectId, diffId))
  },

  files(projectId: string, diffId: string, filters: PageFilters = {}) {
    return requestModelPage<unknown>(withModelQuery(`${diffPath(projectId, diffId)}/files`, filters)).then(
      mapDiffFilePage,
    )
  },

  comments(projectId: string, diffId: string, filters: PageFilters = {}) {
    return requestModelPage<unknown>(withModelQuery(`${diffPath(projectId, diffId)}/comments`, filters)).then(
      mapDiffCommentPage,
    )
  },

  addComment(projectId: string, diffId: string, input: DiffCommentInput) {
    return requestModelData<unknown>(`${diffPath(projectId, diffId)}/comments`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    }).then(mapDiffComment)
  },

  accept(projectId: string, diffId: string) {
    return requestModelData<DiffDetail>(`${diffPath(projectId, diffId)}/accept`, {
      method: 'POST',
      headers: writeModelHeaders(),
    })
  },

  reject(projectId: string, diffId: string, input: DiffRejectInput) {
    return requestModelData<DiffDetail>(`${diffPath(projectId, diffId)}/reject`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    })
  },
}

export const mergeRequestsApi = {
  list(projectId: string, filters: MergeRequestListFilters = {}) {
    return requestModelPage<unknown>(withModelQuery(`/projects/${projectId}/merge-requests`, filters)).then(
      mapMergeRequestPage,
    )
  },

  get(projectId: string, mergeRequestId: string) {
    return requestModelData<unknown>(`/projects/${projectId}/merge-requests/${mergeRequestId}`).then(
      mapMergeRequest,
    )
  },

  checks(projectId: string, mergeRequestId: string) {
    return requestModelData<unknown>(
      `/projects/${projectId}/merge-requests/${mergeRequestId}/checks`,
    ).then(mapMergeRequestChecks)
  },

  reviews(projectId: string, mergeRequestId: string) {
    return requestModelData<unknown>(
      `/projects/${projectId}/merge-requests/${mergeRequestId}/reviews`,
    ).then(mapMergeRequestCqReviews)
  },

  /** 暂定路径：官方契约尚未冻结 MR commits */
  commits(projectId: string, mergeRequestId: string, limit = 3) {
    return requestModelData<unknown>(
      withModelQuery(`/projects/${projectId}/merge-requests/${mergeRequestId}/commits`, { limit }),
    ).then(mapMergeRequestCommitList)
  },

  create(projectId: string, input: MergeRequestCreateInput) {
    return requestModelData<unknown>(`/projects/${projectId}/merge-requests`, {
      method: 'POST',
      headers: writeModelHeaders(),
      body: input,
    }).then(mapMergeRequest)
  },

  merge(projectId: string, mergeRequestId: string) {
    return requestModelData<unknown>(`/projects/${projectId}/merge-requests/${mergeRequestId}/merge`, {
      method: 'POST',
      headers: writeModelHeaders(),
    }).then(mapMergeRequest)
  },

  approveCq(projectId: string, mergeRequestId: string, input: MergeRequestCqInput) {
    return requestModelData<unknown>(
      `/projects/${projectId}/merge-requests/${mergeRequestId}/cq-approvals`,
      {
        method: 'POST',
        headers: writeModelHeaders(),
        body: input,
      },
    ).then(mapMergeRequest)
  },

  rejectCq(projectId: string, mergeRequestId: string, input: MergeRequestCqInput) {
    return requestModelData<unknown>(
      `/projects/${projectId}/merge-requests/${mergeRequestId}/cq-rejections`,
      {
        method: 'POST',
        headers: writeModelHeaders(),
        body: input,
      },
    ).then(mapMergeRequest)
  },
}
