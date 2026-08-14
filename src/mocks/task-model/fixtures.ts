import type {
  DiffDetail,
  ExecutionContext,
  InputRequest,
  Task,
  TaskRunDetail,
  TaskRunLog,
  TaskRunStep,
  TaskStatus,
  TaskStep,
  TaskStepRole,
} from '@/types/task-model'
import { createTaskModelStore, type TaskModelStore } from './store'

const timestamp = '2026-08-12T08:00:00Z'
const laterTimestamp = '2026-08-12T08:01:00Z'

const taskStatuses: readonly TaskStatus[] = [
  'PLANNING',
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLING',
  'CANCELLED',
]

const taskRunStatuses: readonly TaskRunDetail['status'][] = [
  'QUEUED',
  'RUNNING',
  'WAITING_INPUT',
  'WAITING_APPROVAL',
  'FAILED',
  'SUCCEEDED',
]

function taskId(projectId: string, suffix: string): string {
  return `task-${projectId}-${suffix}`
}

function createTask(projectId: string, id: string, status: TaskStatus, index: number): Task {
  return {
    id,
    projectId,
    requirementGroupId: `group-${projectId}-requirements`,
    triggerMessageId: `message-${id}`,
    title: `Task ${index + 1}`,
    requirement: `Requirement for ${id}`,
    status,
    workspaceId: `workspace-${id}`,
    workspaceStatus: 'READY',
    continuationOfTaskId: null,
    repositoryIds: [`repository-${projectId}`],
    repositories: [{
      repositoryId: `repository-${projectId}`,
      baseCommit: 'base-commit-1',
      sourceBranch: `feat/${id}`,
      headCommit: status === 'SUCCEEDED' ? `head-${id}` : null,
    }],
    createdBy: index % 2 === 0 ? 'user-1' : 'user-2',
    createdAt: timestamp,
    updatedAt: laterTimestamp,
  }
}

function createStep(task: Task, suffix: string, role: TaskStepRole, dependencies: string[]): TaskStep {
  return {
    id: `step-${task.id}-${suffix}`,
    taskId: task.id,
    role,
    agentId: `agent-${role.toLowerCase()}`,
    repositoryId: task.repositoryIds[0] ?? null,
    baseRef: 'main',
    dependencies,
    testsetIds: role === 'TESTER' ? [`testset-${task.projectId}-login`] : [],
    status: 'PENDING',
    acceptanceNotes: role === 'REVIEWER' ? 'Review the generated Diff' : null,
  }
}

function createRun(
  task: Task,
  step: TaskStep,
  status: TaskRunDetail['status'],
  includeSteps: boolean,
): TaskRunDetail {
  const completed = status === 'SUCCEEDED'
  const started = status === 'QUEUED' ? null : timestamp
  const finished = completed ? laterTimestamp : null
  return {
    id: `run-${step.id}`,
    projectId: task.projectId,
    taskId: task.id,
    taskStepId: step.id,
    agentId: step.agentId ?? 'agent-default',
    role: step.role,
    status,
    retryOfTaskRunId: null,
    artifactSummary: { diffs: { count: completed ? 1 : 0, byStatus: completed ? { ACCEPTED: 1 } : {} } },
    startedAt: started,
    finishedAt: finished,
    durationMs: completed ? 60_000 : null,
    createdAt: timestamp,
    updatedAt: laterTimestamp,
    ...(includeSteps ? { steps: [] } : {}),
  }
}

function addRunResources(store: TaskModelStore, run: TaskRunDetail, includeSteps: boolean): void {
  if (includeSteps) {
    const step: TaskRunStep = {
      node: run.role,
      status: run.status === 'SUCCEEDED' ? 'PASSED' : run.status === 'FAILED' ? 'FAILED' : 'PENDING',
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
      ...(run.status === 'FAILED' ? { errorCode: 'MOCK_TEST_FAILED' } : {}),
    }
    store.taskRunSteps.set(run.id, [step])
    run.steps = [step]
  }
  const log: TaskRunLog = {
    id: `log-${run.id}-1`,
    sequence: 1,
    node: run.role,
    content: `${run.role} started`,
    timestamp,
  }
  store.taskRunLogs.set(run.id, [log])
  const context: ExecutionContext = {
    workspaceId: `workspace-${run.taskId}`,
    sandboxStatus: run.status === 'QUEUED' ? 'READY' : 'RUNNING',
    repositoryId: `repository-${run.projectId}`,
    baseRef: 'main',
    headRef: `feat/${run.taskId}`,
    startedAt: run.startedAt,
    expiresAt: '2026-08-12T20:00:00Z',
  }
  store.executionContexts.set(run.id, context)
}

function addInputRequest(store: TaskModelStore, run: TaskRunDetail, kind: InputRequest['kind']): void {
  const request: InputRequest = {
    id: `input-${run.id}`,
    taskRunId: run.id,
    kind,
    status: 'PENDING',
    prompt: kind === 'INPUT' ? 'Choose a base branch' : 'Approve the controlled test run',
    options: kind === 'INPUT' ? [{ value: 'main', label: 'main' }, { value: 'develop', label: 'develop' }] : undefined,
    createdAt: timestamp,
  }
  store.inputRequests.set(request.id, request)
}

export function addDiff(
  store: TaskModelStore,
  task: Task,
  step: TaskStep,
  status: DiffDetail['status'],
  suffix: string,
  taskRunId = `run-${step.id}`,
): void {
  const diff: DiffDetail = {
    id: `diff-${task.projectId}-${suffix}`,
    projectId: task.projectId,
    taskId: task.id,
    taskRunId,
    taskStepId: step.id,
    requirementGroupId: task.requirementGroupId,
    workspaceId: task.workspaceId,
    repositoryId: task.repositoryIds[0] ?? 'repository-missing',
    baseCommit: 'base-commit-1',
    sourceBranch: `feat/${task.id}`,
    ...(status === 'PENDING_REVIEW' ? { headCommit: null } : { headCommit: `head-${task.id}` }),
    status,
    changeStats: { files: 2, additions: 10, deletions: 2 },
    createdAt: timestamp,
    workingTreeHash: `tree-${task.id}`,
    snapshotKey: `snapshot-${task.id}`,
    reviewedBy: status === 'PENDING_REVIEW' ? null : 'mock-reviewer',
    reviewReason: status === 'REJECTED' ? 'Please address the failing test' : null,
    reviewedAt: status === 'PENDING_REVIEW' ? null : laterTimestamp,
    updatedAt: laterTimestamp,
  }
  store.diffs.set(diff.id, diff)
  store.diffFiles.set(diff.id, [{ path: 'src/login.ts', body: '@@ -1 +1 @@', side: 'NEW' }])
  store.diffComments.set(diff.id, [])
}

export function createTaskModelScenario(projectId: string): TaskModelStore {
  const store = createTaskModelStore()
  const statusTasks = taskStatuses.map((status, index) => {
    const task = createTask(projectId, taskId(projectId, status.toLowerCase()), status, index)
    store.tasks.set(task.id, task)
    return task
  })

  const mainTask = createTask(projectId, taskId(projectId, 'main'), 'RUNNING', 10)
  store.tasks.set(mainTask.id, mainTask)
  const planner = createStep(mainTask, 'planner', 'PLANNER', [])
  const developer = createStep(mainTask, 'developer', 'DEVELOPER', [planner.id])
  const tester = createStep(mainTask, 'tester', 'TESTER', [developer.id])
  for (const step of [planner, developer, tester]) store.taskSteps.set(step.id, step)

  const mainRuns = [
    createRun(mainTask, planner, 'SUCCEEDED', true),
    createRun(mainTask, developer, 'WAITING_INPUT', true),
    createRun(mainTask, tester, 'QUEUED', false),
  ]
  for (const run of mainRuns) {
    store.taskRuns.set(run.id, run)
    addRunResources(store, run, run.steps !== undefined)
  }
  addInputRequest(store, mainRuns[1]!, 'INPUT')
  addDiff(store, mainTask, planner, 'PENDING_REVIEW', 'pending')
  addDiff(store, mainTask, planner, 'ACCEPTED', 'accepted')
  addDiff(store, mainTask, planner, 'REJECTED', 'rejected')

  const runStatusTask = statusTasks[1]!
  const runStatusStep = createStep(runStatusTask, 'developer', 'DEVELOPER', [])
  store.taskSteps.set(runStatusStep.id, runStatusStep)
  for (const status of taskRunStatuses) {
    const run = createRun(runStatusTask, runStatusStep, status, status !== 'QUEUED')
    run.id = `run-${projectId}-${status.toLowerCase()}`
    store.taskRuns.set(run.id, run)
    addRunResources(store, run, run.steps !== undefined)
    if (status === 'WAITING_INPUT') addInputRequest(store, run, 'INPUT')
    if (status === 'WAITING_APPROVAL') addInputRequest(store, run, 'APPROVAL')
  }

  return store
}

export const taskModelScenarioNames = ['DEFAULT', 'EMPTY'] as const
export type TaskModelScenario = (typeof taskModelScenarioNames)[number]

export function createTaskModelScenarioByName(projectId: string, scenario: TaskModelScenario): TaskModelStore {
  return scenario === 'EMPTY' ? createTaskModelStore() : createTaskModelScenario(projectId)
}
