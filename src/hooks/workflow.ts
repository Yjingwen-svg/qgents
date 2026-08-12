import { useQueries } from '@tanstack/react-query'
import { taskRunsApi } from '@/api'
import { queryKeys } from '@/query'
import type { TaskRun, WorkflowRuntimeData } from '@/types'
import {
  useOrchestrationRun,
  useOrchestrationRuns,
  useOrchestrationWorkPackages,
} from './task-domain'

export function useWorkflowRuntime(projectId: string, runId: string | null): {
  runsQuery: ReturnType<typeof useOrchestrationRuns>
  runQuery: ReturnType<typeof useOrchestrationRun>
  data: WorkflowRuntimeData
  isLoading: boolean
  error: Error | null
} {
  const runsQuery = useOrchestrationRuns(projectId)
  const runQuery = useOrchestrationRun(projectId, runId ?? '')
  const workPackageIds = runQuery.data?.workPackageIds ?? []
  const workPackageQueries = useOrchestrationWorkPackages(projectId, workPackageIds)
  const workPackages = workPackageQueries.flatMap((query) => query.data ? [query.data] : [])
  const taskRunQueries = useQueries({
    queries: workPackages.map((workPackage) => ({
      queryKey: queryKeys.taskRuns.list(projectId, workPackage.id),
      queryFn: () => taskRunsApi.list(projectId, workPackage.id),
      enabled: Boolean(projectId && runId && workPackage.id),
    })),
  })
  const taskRuns = taskRunQueries.flatMap((query) => query.data?.data ?? [])
  const workPackageError = workPackageQueries.find((query) => query.isError)?.error ?? null
  const taskRunError = taskRunQueries.find((query) => query.isError)?.error ?? null
  const error = runQuery.error ?? workPackageError ?? taskRunError

  const data: WorkflowRuntimeData = {
    run: runQuery.data ?? null,
    workPackages,
    taskRuns: taskRuns as TaskRun[],
    hasWorkPackageError: Boolean(workPackageError),
    hasTaskRunError: Boolean(taskRunError),
  }

  return {
    runsQuery,
    runQuery,
    data,
    isLoading: Boolean(runId) && (runQuery.isPending || workPackageQueries.some((query) => query.isPending) || taskRunQueries.some((query) => query.isPending)),
    error,
  }
}
