import type {
  ExecutionContext,
  InputRequest,
  OrchestrationRun,
  Subtask,
  TaskRun,
  TaskRunLog,
  TaskRunStep,
  WorkPackage,
} from '@/types'

export interface TaskDomainState {
  projectId: string
  orchestrationRuns: Map<string, OrchestrationRun>
  workPackages: Map<string, WorkPackage>
  subtasks: Map<string, Subtask>
  taskRuns: Map<string, TaskRun>
  steps: Map<string, TaskRunStep[]>
  logs: Map<string, TaskRunLog[]>
  inputRequests: Map<string, InputRequest[]>
  executionContexts: Map<string, ExecutionContext>
}

export function createTaskDomainStore(initial: TaskDomainState): TaskDomainState {
  return initial
}

export function findOrchestrationRun(state: TaskDomainState, id: string): OrchestrationRun | undefined {
  return state.orchestrationRuns.get(id)
}

export function findWorkPackage(state: TaskDomainState, id: string): WorkPackage | undefined {
  return state.workPackages.get(id)
}

export function findTaskRun(state: TaskDomainState, id: string): TaskRun | undefined {
  return state.taskRuns.get(id)
}

export function findInputRequest(
  state: TaskDomainState,
  taskRunId: string,
  requestId: string,
): InputRequest | undefined {
  return state.inputRequests.get(taskRunId)?.find((request) => request.id === requestId)
}
