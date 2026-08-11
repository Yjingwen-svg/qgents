import {
  useMutation,
  useInfiniteQuery,
  useQueries,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  deliverablesApi,
  orchestrationApi,
  taskRunsApi,
  workPackagesApi,
} from '@/api'
import { queryClient, queryKeys } from '@/query'
import type {
  CreateOrchestrationRunInput,
  CursorPageFilters,
  DecisionInput,
  Deliverable,
  ExecutionContext,
  InputRequest,
  InputRequestAnswer,
  OrchestrationRun,
  OrchestrationRunFilters,
  RejectDeliverableInput,
  TaskRun,
  TaskRunFilters,
  TaskRunLog,
  TaskRunStep,
  UpdateWorkPackageInput,
  WorkPackage,
  WorkPackageFilters,
  CursorPage,
} from '@/types'

export function useOrchestrationRuns(
  projectId: string,
  filters: OrchestrationRunFilters = {},
): UseQueryResult<CursorPage<OrchestrationRun>> {
  return useQuery({
    queryKey: queryKeys.orchestrationRuns.list(projectId, filters),
    queryFn: () => orchestrationApi.list(projectId, filters),
    enabled: Boolean(projectId),
  })
}

export function useInfiniteOrchestrationRuns(
  projectId: string,
  filters: Omit<OrchestrationRunFilters, 'cursor'> = {},
): UseInfiniteQueryResult<
  InfiniteData<CursorPage<OrchestrationRun>, string | undefined>,
  Error
> {
  return useInfiniteQuery({
    queryKey: queryKeys.orchestrationRuns.infinite(projectId, filters),
    queryFn: ({ pageParam }) =>
      orchestrationApi.list(projectId, {
        ...filters,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId),
  })
}

export function useOrchestrationRun(
  projectId: string,
  runId: string,
): UseQueryResult<OrchestrationRun> {
  return useQuery({
    queryKey: queryKeys.orchestrationRuns.detail(projectId, runId),
    queryFn: () => orchestrationApi.get(projectId, runId),
    enabled: Boolean(projectId && runId),
  })
}

export function useWorkPackages(
  projectId: string,
  filters: WorkPackageFilters = {},
): UseQueryResult<CursorPage<WorkPackage>> {
  return useQuery({
    queryKey: queryKeys.workPackages.list(projectId, filters),
    queryFn: () => workPackagesApi.list(projectId, filters),
    enabled: Boolean(projectId),
  })
}

export function useWorkPackage(
  projectId: string,
  workPackageId: string,
): UseQueryResult<WorkPackage> {
  return useQuery({
    queryKey: queryKeys.workPackages.detail(projectId, workPackageId),
    queryFn: () => workPackagesApi.get(projectId, workPackageId),
    enabled: Boolean(projectId && workPackageId),
  })
}

export function useOrchestrationWorkPackages(
  projectId: string,
  workPackageIds: readonly string[],
) {
  const uniqueIds = [...new Set(workPackageIds)]

  return useQueries({
    queries: uniqueIds.map((workPackageId) => ({
      queryKey: queryKeys.workPackages.detail(projectId, workPackageId),
      queryFn: () => workPackagesApi.get(projectId, workPackageId),
      enabled: Boolean(projectId && workPackageId),
    })),
  })
}

export function useTaskRuns(
  projectId: string,
  workPackageId: string,
  filters: TaskRunFilters = {},
): UseQueryResult<CursorPage<TaskRun>> {
  return useQuery({
    queryKey: queryKeys.taskRuns.list(projectId, workPackageId, filters),
    queryFn: () => taskRunsApi.list(projectId, workPackageId, filters),
    enabled: Boolean(projectId && workPackageId),
  })
}

export function useInfiniteTaskRuns(
  projectId: string,
  workPackageId: string,
  filters: Omit<TaskRunFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<CursorPage<TaskRun>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.taskRuns.infinite(projectId, workPackageId, filters),
    queryFn: ({ pageParam }) =>
      taskRunsApi.list(projectId, workPackageId, {
        ...filters,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId && workPackageId),
  })
}

export function useTaskRun(projectId: string, taskRunId: string): UseQueryResult<TaskRun> {
  return useQuery({
    queryKey: queryKeys.taskRuns.detail(projectId, taskRunId),
    queryFn: () => taskRunsApi.get(projectId, taskRunId),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useTaskRunSteps(
  projectId: string,
  taskRunId: string,
  filters: CursorPageFilters = {},
): UseQueryResult<CursorPage<TaskRunStep>> {
  return useQuery({
    queryKey: queryKeys.taskRuns.steps(projectId, taskRunId, filters),
    queryFn: () => taskRunsApi.steps(projectId, taskRunId, filters),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useInfiniteTaskRunSteps(
  projectId: string,
  taskRunId: string,
  filters: Omit<CursorPageFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<CursorPage<TaskRunStep>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.taskRuns.stepsInfinite(projectId, taskRunId, filters),
    queryFn: ({ pageParam }) =>
      taskRunsApi.steps(projectId, taskRunId, {
        ...filters,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useTaskRunLogs(
  projectId: string,
  taskRunId: string,
  cursor?: string,
  limit?: number,
): UseQueryResult<CursorPage<TaskRunLog>> {
  return useQuery({
    queryKey: queryKeys.taskRuns.logs(projectId, taskRunId, cursor, limit),
    queryFn: () => taskRunsApi.logs(projectId, taskRunId, cursor, limit),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useInfiniteTaskRunLogs(
  projectId: string,
  taskRunId: string,
  filters: Omit<CursorPageFilters, 'cursor'> = {},
): UseInfiniteQueryResult<InfiniteData<CursorPage<TaskRunLog>, string | undefined>, Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.taskRuns.logsInfinite(projectId, taskRunId, filters),
    queryFn: ({ pageParam }) =>
      taskRunsApi.logs(projectId, taskRunId, pageParam, filters.limit),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useExecutionContext(
  projectId: string,
  taskRunId: string,
): UseQueryResult<ExecutionContext> {
  return useQuery({
    queryKey: queryKeys.taskRuns.executionContext(projectId, taskRunId),
    queryFn: () => taskRunsApi.executionContext(projectId, taskRunId),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useInputRequests(
  projectId: string,
  taskRunId: string,
  filters: CursorPageFilters = {},
): UseQueryResult<CursorPage<InputRequest>> {
  return useQuery({
    queryKey: queryKeys.taskRuns.inputRequests.list(projectId, taskRunId, filters),
    queryFn: () => taskRunsApi.inputRequests(projectId, taskRunId, filters),
    enabled: Boolean(projectId && taskRunId),
  })
}

export function useDeliverables(
  projectId: string,
  workPackageId: string,
  filters: CursorPageFilters = {},
): UseQueryResult<CursorPage<Deliverable>> {
  return useQuery({
    queryKey: queryKeys.deliverables.list(projectId, workPackageId, filters),
    queryFn: () => deliverablesApi.list(projectId, workPackageId, filters),
    enabled: Boolean(projectId && workPackageId),
  })
}

export function useDeliverable(
  projectId: string,
  deliverableId: string,
): UseQueryResult<Deliverable> {
  return useQuery({
    queryKey: queryKeys.deliverables.detail(projectId, deliverableId),
    queryFn: () => deliverablesApi.get(projectId, deliverableId),
    enabled: Boolean(projectId && deliverableId),
  })
}

export function useCreateOrchestrationRun(
  projectId: string,
): UseMutationResult<OrchestrationRun, Error, CreateOrchestrationRunInput> {
  return useMutation({
    mutationFn: (input) => orchestrationApi.create(projectId, input),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.orchestrationRuns.detail(projectId, run.id), run)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orchestrationRuns.all(projectId) })
    },
  })
}

export function useCancelOrchestrationRun(
  projectId: string,
): UseMutationResult<OrchestrationRun, Error, string> {
  return useMutation({
    mutationFn: (runId) => orchestrationApi.cancel(projectId, runId),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.orchestrationRuns.detail(projectId, run.id), run)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orchestrationRuns.all(projectId) })
    },
  })
}

type WorkPackageMutation = (workPackageId: string) => Promise<WorkPackage>

function useWorkPackageMutation(
  projectId: string,
  mutationFn: WorkPackageMutation,
): UseMutationResult<WorkPackage, Error, string> {
  return useMutation({
    mutationFn,
    onSuccess: (workPackage) => {
      queryClient.setQueryData(
        queryKeys.workPackages.detail(projectId, workPackage.id),
        workPackage,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.workPackages.all(projectId) })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orchestrationRuns.detail(projectId, workPackage.orchestrationRunId),
      })
    },
  })
}

export function useStartWorkPackage(projectId: string): UseMutationResult<WorkPackage, Error, string> {
  return useWorkPackageMutation(projectId, (workPackageId) =>
    workPackagesApi.start(projectId, workPackageId),
  )
}

export function usePauseWorkPackage(projectId: string): UseMutationResult<WorkPackage, Error, string> {
  return useWorkPackageMutation(projectId, (workPackageId) =>
    workPackagesApi.pause(projectId, workPackageId),
  )
}

export function useResumeWorkPackage(projectId: string): UseMutationResult<WorkPackage, Error, string> {
  return useWorkPackageMutation(projectId, (workPackageId) =>
    workPackagesApi.resume(projectId, workPackageId),
  )
}

export function useCancelWorkPackage(projectId: string): UseMutationResult<WorkPackage, Error, string> {
  return useWorkPackageMutation(projectId, (workPackageId) =>
    workPackagesApi.cancel(projectId, workPackageId),
  )
}

export function useUpdateWorkPackage(
  projectId: string,
): UseMutationResult<WorkPackage, Error, { workPackageId: string; input: UpdateWorkPackageInput }> {
  return useMutation({
    mutationFn: ({ workPackageId, input }) => workPackagesApi.update(projectId, workPackageId, input),
    onSuccess: (workPackage) => {
      queryClient.setQueryData(queryKeys.workPackages.detail(projectId, workPackage.id), workPackage)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workPackages.all(projectId) })
    },
  })
}

export function useRetryTaskRun(projectId: string): UseMutationResult<TaskRun, Error, string> {
  return useMutation({
    mutationFn: (taskRunId) => taskRunsApi.retry(projectId, taskRunId),
    onSuccess: (taskRun, originalTaskRunId) => {
      queryClient.setQueryData(queryKeys.taskRuns.detail(projectId, taskRun.id), taskRun)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.taskRuns.detail(projectId, originalTaskRunId),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskRuns.all(projectId) })
    },
  })
}

export function useCancelTaskRun(projectId: string): UseMutationResult<TaskRun, Error, string> {
  return useMutation({
    mutationFn: (taskRunId) => taskRunsApi.cancel(projectId, taskRunId),
    onSuccess: (taskRun) => {
      queryClient.setQueryData(queryKeys.taskRuns.detail(projectId, taskRun.id), taskRun)
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskRuns.all(projectId) })
    },
  })
}

type InputRequestMutation<TInput> = {
  requestId: string
  input: TInput
}

function useInputRequestMutation<TInput>(
  projectId: string,
  mutationFn: (variables: InputRequestMutation<TInput>) => Promise<InputRequest>,
): UseMutationResult<InputRequest, Error, InputRequestMutation<TInput>> {
  return useMutation({
    mutationFn,
    onSuccess: (request) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.taskRuns.inputRequests.all(projectId, request.taskRunId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.taskRuns.detail(projectId, request.taskRunId),
      })
    },
  })
}

export function useReplyInputRequest(
  projectId: string,
  taskRunId: string,
): UseMutationResult<InputRequest, Error, { requestId: string; input: InputRequestAnswer }> {
  return useInputRequestMutation(projectId, ({ requestId, input }) =>
    taskRunsApi.replyInputRequest(projectId, taskRunId, requestId, input),
  )
}

export function useApproveInputRequest(
  projectId: string,
  taskRunId: string,
): UseMutationResult<InputRequest, Error, { requestId: string; input: DecisionInput }> {
  return useInputRequestMutation(projectId, ({ requestId, input }) =>
    taskRunsApi.approveInputRequest(projectId, taskRunId, requestId, input),
  )
}

export function useRejectInputRequest(
  projectId: string,
  taskRunId: string,
): UseMutationResult<InputRequest, Error, { requestId: string; input: DecisionInput }> {
  return useInputRequestMutation(projectId, ({ requestId, input }) =>
    taskRunsApi.rejectInputRequest(projectId, taskRunId, requestId, input),
  )
}

type DeliverableMutation = { deliverableId: string }

function invalidateDeliverableQueries(projectId: string, deliverable: Deliverable): void {
  queryClient.setQueryData(queryKeys.deliverables.detail(projectId, deliverable.id), deliverable)
  void queryClient.invalidateQueries({ queryKey: queryKeys.deliverables.all(projectId) })
  void queryClient.invalidateQueries({
    queryKey: queryKeys.workPackages.detail(projectId, deliverable.workPackageId),
  })
}

export function useAcceptDeliverable(
  projectId: string,
): UseMutationResult<Deliverable, Error, DeliverableMutation> {
  return useMutation({
    mutationFn: ({ deliverableId }) => deliverablesApi.accept(projectId, deliverableId),
    onSuccess: (deliverable) => invalidateDeliverableQueries(projectId, deliverable),
  })
}

export function useRejectDeliverable(
  projectId: string,
): UseMutationResult<Deliverable, Error, DeliverableMutation & { input: RejectDeliverableInput }> {
  return useMutation({
    mutationFn: ({ deliverableId, input }) => deliverablesApi.reject(projectId, deliverableId, input),
    onSuccess: (deliverable) => invalidateDeliverableQueries(projectId, deliverable),
  })
}
