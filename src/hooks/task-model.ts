import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { diffsApi, mergeRequestsApi, tasksApi, taskRunsApi } from '@/api/taskModel'
import { deliveryCenterKeys, queryClient, taskModelQueryKeys } from '@/query'
import type {
  DiffComment,
  DiffCommentInput,
  DiffDetail,
  DiffFile,
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
  TaskModelPage,
  TaskArtifact,
  DiffReviewBatch,
  MergeRequestCheck,
  MergeRequestCreateInput,
  MergeRequestCqInput,
  MergeRequestCqReview,
  MergeRequestCommitList,
  MergeRequestListFilters,
  MergeRequestSummary,
} from '@/types/task-model'

type Page<T> = TaskModelPage<T>

export function useTasks(projectId: string, filters: TaskListFilters = {}): UseQueryResult<Page<TaskListItem>> {
  return useQuery({
    queryKey: taskModelQueryKeys.tasks.list(projectId, filters),
    queryFn: () => tasksApi.list(projectId, filters),
    enabled: Boolean(projectId),
  })
}

export function useInfiniteTasks(
  projectId: string,
  filters: Omit<TaskListFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<Page<TaskListItem>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: taskModelQueryKeys.tasks.infinite(projectId, filters),
    queryFn: ({ pageParam }) => tasksApi.list(projectId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId),
  })
}

export function useTask(projectId: string, taskId: string): UseQueryResult<Task> {
  return useQuery({
    queryKey: taskModelQueryKeys.tasks.detail(projectId, taskId),
    queryFn: () => tasksApi.get(projectId, taskId),
    enabled: Boolean(projectId && taskId),
  })
}

export function useTaskArtifacts(projectId: string, taskId: string): UseQueryResult<TaskArtifact[]> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskArtifacts.all(projectId, taskId),
    queryFn: () => tasksApi.artifacts(projectId, taskId),
    enabled: Boolean(projectId && taskId),
  })
}

export function useTaskDiffReview(projectId: string, taskId: string, enabled = true): UseQueryResult<DiffReviewBatch> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskDiffReview.detail(projectId, taskId),
    queryFn: () => tasksApi.diffReview(projectId, taskId),
    enabled: Boolean(projectId && taskId && enabled),
  })
}

export function useTaskSteps(projectId: string, taskId: string, filters: PageFilters = {}): UseQueryResult<Page<TaskStep>> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskSteps.list(projectId, taskId, filters),
    queryFn: () => tasksApi.listSteps(projectId, taskId, filters),
    enabled: Boolean(projectId && taskId),
  })
}

export function useTaskRuns(projectId: string, taskId: string, filters: TaskRunListFilters = {}): UseQueryResult<Page<TaskRunSummary>> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskRuns.list(projectId, taskId, filters),
    queryFn: () => taskRunsApi.list(projectId, taskId, filters),
    enabled: Boolean(projectId && taskId),
  })
}

export function useInfiniteTaskRuns(
  projectId: string,
  taskId: string,
  filters: Omit<TaskRunListFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<Page<TaskRunSummary>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: taskModelQueryKeys.taskRuns.infinite(projectId, taskId, filters),
    queryFn: ({ pageParam }) => taskRunsApi.list(projectId, taskId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId && taskId),
  })
}

export function useTaskRun(projectId: string, taskRunId: string): UseQueryResult<TaskRunDetail> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskRuns.detail(projectId, taskRunId),
    queryFn: () => taskRunsApi.get(projectId, taskRunId),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useTaskRunLogs(projectId: string, taskRunId: string, filters: PageFilters = {}): UseQueryResult<Page<TaskRunLog>> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskRuns.logs(projectId, taskRunId, filters),
    queryFn: () => taskRunsApi.logs(projectId, taskRunId, filters),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useInfiniteTaskRunLogs(
  projectId: string,
  taskRunId: string,
  filters: Omit<PageFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<Page<TaskRunLog>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: taskModelQueryKeys.taskRuns.logs(projectId, taskRunId, filters),
    queryFn: ({ pageParam }) => taskRunsApi.logs(projectId, taskRunId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useTaskRunExecutionContext(projectId: string, taskRunId: string): UseQueryResult<ExecutionContext> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskRuns.executionContext(projectId, taskRunId),
    queryFn: () => taskRunsApi.executionContext(projectId, taskRunId),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useTaskRunInputRequests(projectId: string, taskRunId: string, filters: PageFilters = {}): UseQueryResult<Page<InputRequest>> {
  return useQuery({
    queryKey: taskModelQueryKeys.taskRuns.inputRequests.list(projectId, taskRunId, filters),
    queryFn: () => taskRunsApi.inputRequests(projectId, taskRunId, filters),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useDiffs(projectId: string, filters: DiffListFilters = {}): UseQueryResult<Page<DiffListItem>> {
  return useQuery({
    queryKey: taskModelQueryKeys.diffs.list(projectId, filters),
    queryFn: () => diffsApi.list(projectId, filters),
    enabled: Boolean(projectId),
  })
}

export function useInfiniteDiffs(
  projectId: string,
  filters: Omit<DiffListFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<Page<DiffListItem>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: taskModelQueryKeys.diffs.infinite(projectId, filters),
    queryFn: ({ pageParam }) => diffsApi.list(projectId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId),
  })
}

export function useDiff(projectId: string, diffId: string): UseQueryResult<DiffDetail> {
  return useQuery({
    queryKey: taskModelQueryKeys.diffs.detail(projectId, diffId),
    queryFn: () => diffsApi.get(projectId, diffId),
    enabled: Boolean(projectId && diffId),
  })
}

export function useDiffFiles(projectId: string, diffId: string, filters: PageFilters = {}): UseQueryResult<Page<DiffFile>> {
  return useQuery({
    queryKey: taskModelQueryKeys.diffs.files(projectId, diffId, filters),
    queryFn: () => diffsApi.files(projectId, diffId, filters),
    enabled: Boolean(projectId && diffId),
  })
}

export function useDiffComments(projectId: string, diffId: string, filters: PageFilters = {}): UseQueryResult<Page<DiffComment>> {
  return useQuery({
    queryKey: taskModelQueryKeys.diffs.comments(projectId, diffId, filters),
    queryFn: () => diffsApi.comments(projectId, diffId, filters),
    enabled: Boolean(projectId && diffId),
  })
}

export function useCreateTaskStep(projectId: string, taskId: string): UseMutationResult<TaskStep, Error, TaskStepCreateInput> {
  return useMutation({
    mutationFn: (input) => tasksApi.createStep(projectId, taskId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.detail(projectId, taskId) })
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskSteps.all(projectId, taskId) })
    },
  })
}

export function useCreateTask(projectId: string): UseMutationResult<Task, Error, TaskCreateInput> {
  return useMutation({
    mutationFn: (input) => tasksApi.create(projectId, input),
    onSuccess: (task) => {
      queryClient.setQueryData(taskModelQueryKeys.tasks.detail(projectId, task.id), task)
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.all(projectId) })
    },
  })
}

export function useCancelTask(projectId: string): UseMutationResult<Task, Error, string> {
  return useMutation({
    mutationFn: (taskId) => tasksApi.cancel(projectId, taskId),
    onSuccess: (task) => {
      queryClient.setQueryData(taskModelQueryKeys.tasks.detail(projectId, task.id), task)
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.all(projectId) })
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.detail(projectId, task.id) })
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.list(projectId, task.id) })
    },
  })
}

export function useReplaceTaskStepAgent(projectId: string, taskId: string): UseMutationResult<TaskStep, Error, { taskStepId: string; input: ReplaceTaskStepAgentInput }> {
  return useMutation({
    mutationFn: ({ taskStepId, input }) => tasksApi.replaceAgent(projectId, taskId, taskStepId, input),
    onSuccess: (step) => {
      queryClient.setQueryData(taskModelQueryKeys.taskSteps.detail(projectId, taskId, step.id), step)
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskSteps.all(projectId, taskId) })
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.detail(projectId, taskId) })
    },
  })
}

export function useRetryTaskRunModel(projectId: string): UseMutationResult<TaskRunDetail, Error, string> {
  return useMutation({
    mutationFn: (taskRunId) => taskRunsApi.retry(projectId, taskRunId),
    onSuccess: (taskRun, originalTaskRunId) => {
      queryClient.setQueryData(taskModelQueryKeys.taskRuns.detail(projectId, taskRun.id), taskRun)
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.detail(projectId, originalTaskRunId) })
      // 刷新运行列表，使新 retry run 显示在「最近执行」中
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.list(projectId, taskRun.taskId) })
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.detail(projectId, taskRun.taskId) })
    },
  })
}

export function useCancelTaskRunModel(projectId: string): UseMutationResult<TaskRunDetail, Error, string> {
  return useMutation({
    mutationFn: (taskRunId) => taskRunsApi.cancel(projectId, taskRunId),
    onSuccess: (taskRun) => {
      queryClient.setQueryData(taskModelQueryKeys.taskRuns.detail(projectId, taskRun.id), taskRun)
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.list(projectId, taskRun.taskId) })
    },
  })
}

type InputRequestMutation<TInput> = { requestId: string; input: TInput }

function useInputRequestMutation<TInput>(
  projectId: string,
  taskRunId: string,
  mutationFn: (input: InputRequestMutation<TInput>) => Promise<InputRequest>,
): UseMutationResult<InputRequest, Error, InputRequestMutation<TInput>> {
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.inputRequests.all(projectId, taskRunId) })
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.detail(projectId, taskRunId) })
    },
  })
}

export function useReplyTaskRunInputRequest(projectId: string, taskRunId: string): UseMutationResult<InputRequest, Error, InputRequestMutation<InputRequestAnswer>> {
  return useInputRequestMutation(projectId, taskRunId, ({ requestId, input }) => taskRunsApi.replyInputRequest(projectId, taskRunId, requestId, input))
}

export function useApproveTaskRunInputRequest(projectId: string, taskRunId: string): UseMutationResult<InputRequest, Error, InputRequestMutation<InputRequestDecision>> {
  return useInputRequestMutation(projectId, taskRunId, ({ requestId, input }) => taskRunsApi.approveInputRequest(projectId, taskRunId, requestId, input))
}

export function useRejectTaskRunInputRequest(projectId: string, taskRunId: string): UseMutationResult<InputRequest, Error, InputRequestMutation<InputRequestDecision>> {
  return useInputRequestMutation(projectId, taskRunId, ({ requestId, input }) => taskRunsApi.rejectInputRequest(projectId, taskRunId, requestId, input))
}

export function useAddDiffComment(
  projectId: string,
  diffId: string,
): UseMutationResult<DiffComment, Error, DiffCommentInput> {
  return useMutation({
    mutationFn: (input) => diffsApi.addComment(projectId, diffId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.diffs.detail(projectId, diffId) })
      void queryClient.invalidateQueries({ queryKey: ['qgents', 'projects', projectId, 'diffs', diffId, 'comments'] })
    },
  })
}

export function useAcceptDiff(projectId: string): UseMutationResult<DiffDetail, Error, string> {
  return useMutation({
    mutationFn: (diffId) => diffsApi.accept(projectId, diffId),
    onSuccess: (diff) => invalidateDiffQueries(projectId, diff),
  })
}

export function useRejectDiff(projectId: string): UseMutationResult<DiffDetail, Error, { diffId: string; input: DiffRejectInput }> {
  return useMutation({
    mutationFn: ({ diffId, input }) => diffsApi.reject(projectId, diffId, input),
    onSuccess: (diff) => invalidateDiffQueries(projectId, diff),
  })
}

export function useCreateMergeRequest(
  projectId: string,
): UseMutationResult<MergeRequestSummary, Error, MergeRequestCreateInput> {
  return useMutation({
    mutationFn: (input) => mergeRequestsApi.create(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.mergeRequests.all(projectId) })
    },
  })
}

export function useMergeRequests(
  projectId: string,
  filters: MergeRequestListFilters = {},
  options?: { enabled?: boolean },
): UseQueryResult<Page<MergeRequestSummary>> {
  return useQuery({
    queryKey: taskModelQueryKeys.mergeRequests.list(projectId, filters),
    queryFn: () => mergeRequestsApi.list(projectId, filters),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    // 兼容"用户手动点创建 MR"和"后端 MrFirstAutomationService 自动创建 MR"两种链路：
    // - 手动创建 useCreateMergeRequest 会在 onSuccess 立即 invalidate 缓存 → 立即刷新
    // - 自动创建没有 SSE 推送前，用 10s 轻量轮询兜底，保证用户停在 MR 列表页时能很快看到新记录
    //   (后台 tab 不刷新，最小化用户 CPU/网络开销)
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useMergeRequest(
  projectId: string,
  mergeRequestId: string,
): UseQueryResult<MergeRequestSummary> {
  return useQuery({
    queryKey: taskModelQueryKeys.mergeRequests.detail(projectId, mergeRequestId),
    queryFn: () => mergeRequestsApi.get(projectId, mergeRequestId),
    enabled: Boolean(projectId && mergeRequestId),
  })
}

export function useMergeRequestChecks(
  projectId: string,
  mergeRequestId: string,
): UseQueryResult<MergeRequestCheck[]> {
  return useQuery({
    queryKey: taskModelQueryKeys.mergeRequests.checks(projectId, mergeRequestId),
    queryFn: () => mergeRequestsApi.checks(projectId, mergeRequestId),
    enabled: Boolean(projectId && mergeRequestId),
  })
}

export function useMergeRequestReviews(
  projectId: string,
  mergeRequestId: string,
  enabled = true,
): UseQueryResult<MergeRequestCqReview[]> {
  return useQuery({
    queryKey: taskModelQueryKeys.mergeRequests.reviews(projectId, mergeRequestId),
    queryFn: () => mergeRequestsApi.reviews(projectId, mergeRequestId),
    enabled: Boolean(projectId && mergeRequestId && enabled),
  })
}

export function useMergeRequestCommits(
  projectId: string,
  mergeRequestId: string,
  limit = 3,
  enabled = true,
): UseQueryResult<MergeRequestCommitList> {
  return useQuery({
    queryKey: taskModelQueryKeys.mergeRequests.commits(projectId, mergeRequestId, limit),
    queryFn: () => mergeRequestsApi.commits(projectId, mergeRequestId, limit),
    enabled: Boolean(projectId && mergeRequestId && enabled),
  })
}

export function useMergeMergeRequest(
  projectId: string,
): UseMutationResult<MergeRequestSummary, Error, string> {
  return useMutation({
    mutationFn: (mergeRequestId) => mergeRequestsApi.merge(projectId, mergeRequestId),
    onSuccess: (mr) => {
      rememberMergeRequest(projectId, mr)
    },
  })
}

type MergeRequestCqMutationInput = { mergeRequestId: string; input: MergeRequestCqInput }

export function useApproveMergeRequestCq(
  projectId: string,
): UseMutationResult<MergeRequestSummary, Error, MergeRequestCqMutationInput> {
  return useMutation({
    mutationFn: ({ mergeRequestId, input }) => mergeRequestsApi.approveCq(projectId, mergeRequestId, input),
    onSuccess: (mr) => {
      rememberMergeRequest(projectId, mr)
    },
  })
}

export function useRejectMergeRequestCq(
  projectId: string,
): UseMutationResult<MergeRequestSummary, Error, MergeRequestCqMutationInput> {
  return useMutation({
    mutationFn: ({ mergeRequestId, input }) => mergeRequestsApi.rejectCq(projectId, mergeRequestId, input),
    onSuccess: (mr) => {
      rememberMergeRequest(projectId, mr)
    },
  })
}

function rememberMergeRequest(projectId: string, mr: MergeRequestSummary): void {
  if (mr.id) {
    queryClient.setQueryData(taskModelQueryKeys.mergeRequests.detail(projectId, mr.id), mr)
  }
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.mergeRequests.all(projectId) })
}

type TaskDiffReviewRejectInput = { taskId: string; input: DiffRejectInput }

function invalidateTaskDiffReview(projectId: string, batch: DiffReviewBatch): void {
  queryClient.setQueryData(taskModelQueryKeys.taskDiffReview.detail(projectId, batch.taskId), batch)
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskDiffReview.detail(projectId, batch.taskId) })
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.detail(projectId, batch.taskId) })
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.all(projectId) })
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.diffs.all(projectId) })
  void queryClient.invalidateQueries({ queryKey: deliveryCenterKeys.all(projectId) })
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.mergeRequests.all(projectId) })
}

export function useConfirmTaskDiffReview(projectId: string): UseMutationResult<DiffReviewBatch, Error, string> {
  return useMutation({
    mutationFn: (taskId) => tasksApi.confirmDiffReview(projectId, taskId),
    onSuccess: (batch) => invalidateTaskDiffReview(projectId, batch),
  })
}

export function useRejectTaskDiffReview(projectId: string): UseMutationResult<DiffReviewBatch, Error, TaskDiffReviewRejectInput> {
  return useMutation({
    mutationFn: ({ taskId, input }) => tasksApi.rejectDiffReview(projectId, taskId, input),
    onSuccess: (batch) => invalidateTaskDiffReview(projectId, batch),
  })
}

export function useRetryTaskDiffReviewDelivery(projectId: string): UseMutationResult<DiffReviewBatch, Error, string> {
  return useMutation({
    mutationFn: (taskId) => tasksApi.retryDiffReviewDelivery(projectId, taskId),
    onSuccess: (batch) => invalidateTaskDiffReview(projectId, batch),
  })
}

function invalidateDiffQueries(projectId: string, diff: DiffDetail): void {
  queryClient.setQueryData(taskModelQueryKeys.diffs.detail(projectId, diff.id), diff)
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.diffs.all(projectId) })
  void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.tasks.detail(projectId, diff.taskId) })
  if (diff.taskRunId) {
    void queryClient.invalidateQueries({ queryKey: taskModelQueryKeys.taskRuns.detail(projectId, diff.taskRunId) })
  }
}
