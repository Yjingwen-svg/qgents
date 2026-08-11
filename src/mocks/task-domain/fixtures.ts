import type {
  Deliverable,
  ExecutionContext,
  InputRequest,
  OrchestrationRun,
  Subtask,
  TaskRun,
  TaskRunLog,
  TaskRunStep,
  WorkPackage,
} from '@/types'
import type { TaskDomainState } from './store'

const timestamp = '2026-08-11T08:00:00Z'

export const taskDomainScenarioNames = [
  'QUEUED',
  'PLANNING',
  'RUNNING',
  'WAITING_INPUT',
  'WAITING_APPROVAL',
  'BLOCKED',
  'FAILED',
  'SUCCEEDED',
  'CANCELLING',
  'CANCELLED',
  'EMPTY',
] as const

export type TaskDomainScenario = (typeof taskDomainScenarioNames)[number]

function createBaseState(projectId: string): TaskDomainState {
  const orchestrationRunId = `orchestration-${projectId}-1`
  const workPackageIds = [`work-package-${projectId}-1`, `work-package-${projectId}-2`]
  const orchestrationRun: OrchestrationRun = {
    id: orchestrationRunId,
    projectId,
    groupId: `group-${projectId}-login`,
    instruction: '实现邮箱登录并补充 API 测试',
    workflowId: 'system-default-code-delivery',
    startMode: 'AUTO',
    status: 'RUNNING',
    createdBy: 'demo-user',
    workPackageIds,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const workPackages = new Map<string, WorkPackage>()
  const subtasks = new Map<string, Subtask>()
  const taskRuns = new Map<string, TaskRun>()
  const steps = new Map<string, TaskRunStep[]>()
  const logs = new Map<string, TaskRunLog[]>()
  const inputRequests = new Map<string, InputRequest[]>()
  const executionContexts = new Map<string, ExecutionContext>()
  const deliverables = new Map<string, Deliverable>()

  workPackageIds.forEach((workPackageId, packageIndex) => {
    const subtaskIds = ['PLANNER', 'DEVELOPER', 'TESTER'].map(
      (role) => `${workPackageId}-subtask-${role.toLowerCase()}`,
    )
    const workPackage: WorkPackage = {
      id: workPackageId,
      projectId,
      orchestrationRunId,
      groupId: orchestrationRun.groupId,
      repositoryId: `repository-${projectId}`,
      baseRef: 'main',
      headRef: packageIndex === 0 ? 'feat/login-api' : 'feat/login-tests',
      title: packageIndex === 0 ? '实现登录 API' : '补充登录测试',
      description: packageIndex === 0 ? '完成邮箱登录和刷新机制' : '覆盖登录接口核心场景',
      priority: packageIndex + 1,
      testsetIds: [`testset-${projectId}-required`],
      startMode: packageIndex === 0 ? 'AUTO' : 'MANUAL',
      status: packageIndex === 0 ? 'RUNNING' : 'READY',
      subtaskIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    workPackages.set(workPackageId, workPackage)

    subtaskIds.forEach((subtaskId, subtaskIndex) => {
      const role = ['PLANNER', 'DEVELOPER', 'TESTER'][subtaskIndex] as Subtask['role']
      const subtask: Subtask = {
        id: subtaskId,
        projectId,
        orchestrationRunId,
        workPackageId,
        title: `${role} step`,
        role,
        agentId: `agent-${role.toLowerCase()}`,
        status: subtaskIndex === 0 ? 'SUCCEEDED' : subtaskIndex === 1 ? 'RUNNING' : 'PENDING',
        dependsOnSubtaskIds: subtaskIndex === 0 ? [] : [subtaskIds[subtaskIndex - 1]],
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      subtasks.set(subtaskId, subtask)

      const taskRunId = `${subtaskId}-run-1`
      const taskRun: TaskRun = {
        id: taskRunId,
        projectId,
        orchestrationRunId,
        workPackageId,
        subtaskId,
        status: subtaskIndex === 0 ? 'SUCCEEDED' : subtaskIndex === 1 ? 'RUNNING' : 'QUEUED',
        retryOfTaskRunId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      taskRuns.set(taskRunId, taskRun)
      steps.set(taskRunId, [
        {
          id: `${taskRunId}-step-1`,
          projectId,
          taskRunId,
          node: role,
          status: taskRun.status === 'SUCCEEDED' ? 'PASSED' : taskRun.status === 'RUNNING' ? 'RUNNING' : 'PENDING',
          startedAt: taskRun.status === 'QUEUED' ? null : timestamp,
          finishedAt: taskRun.status === 'SUCCEEDED' ? timestamp : null,
          durationMs: taskRun.status === 'SUCCEEDED' ? 18_000 : null,
          errorCode: null,
        },
      ])
      logs.set(taskRunId, [
        {
          id: `${taskRunId}-log-1`,
          projectId,
          taskRunId,
          sequence: 1,
          level: 'INFO',
          content: `${role} started`,
          timestamp,
        },
      ])
      executionContexts.set(taskRunId, {
        id: `${taskRunId}-context`,
        projectId,
        taskRunId,
        workspaceId: `${workPackageId}-workspace`,
        sandboxStatus: taskRun.status === 'QUEUED' ? 'READY' : 'RUNNING',
        repositoryId: workPackage.repositoryId,
        baseRef: workPackage.baseRef,
        headRef: workPackage.headRef,
        startedAt: taskRun.status === 'QUEUED' ? null : timestamp,
        expiresAt: '2026-08-11T20:00:00Z',
      })
      inputRequests.set(taskRunId, [])
    })
  })

  const developerRunId = `${workPackageIds[0]}-subtask-developer-run-1`
  inputRequests.set(developerRunId, [
    {
      id: `${developerRunId}-input`,
      projectId,
      taskRunId: developerRunId,
      kind: 'INPUT',
      status: 'PENDING',
      prompt: '请选择需要使用的基准分支',
      options: [
        { value: 'main', label: 'main' },
        { value: 'develop', label: 'develop' },
      ],
      createdAt: timestamp,
      resolvedAt: null,
    },
  ])
  const approvalRunId = `${workPackageIds[1]}-subtask-developer-run-1`
  inputRequests.set(approvalRunId, [
    {
      id: `${approvalRunId}-approval`,
      projectId,
      taskRunId: approvalRunId,
      kind: 'APPROVAL',
      status: 'PENDING',
      prompt: '批准在受控 Sandbox 内运行测试',
      options: null,
      createdAt: timestamp,
      resolvedAt: null,
    },
  ])

  const pendingDeliverable: Deliverable = {
    id: `deliverable-${projectId}-pending`,
    projectId,
    workPackageId: workPackageIds[0],
    taskRunId: developerRunId,
    title: '登录 API 代码交付',
    type: 'CODE',
    version: 1,
    status: 'PENDING_REVIEW',
    repositoryId: `repository-${projectId}`,
    sourceRef: 'feat/login-api',
    diffId: `diff-${projectId}-login`,
    mergeRequestId: null,
    rejectionReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const acceptedDeliverable: Deliverable = {
    ...pendingDeliverable,
    id: `deliverable-${projectId}-accepted`,
    workPackageId: workPackageIds[1],
    status: 'ACCEPTED',
    sourceRef: 'feat/login-tests',
    version: 2,
  }
  deliverables.set(pendingDeliverable.id, pendingDeliverable)
  deliverables.set(acceptedDeliverable.id, acceptedDeliverable)

  return {
    projectId,
    orchestrationRuns: new Map([[orchestrationRun.id, orchestrationRun]]),
    workPackages,
    subtasks,
    taskRuns,
    steps,
    logs,
    inputRequests,
    executionContexts,
    deliverables,
  }
}

export function createTaskDomainScenario(
  projectId: string,
  scenario: TaskDomainScenario = 'RUNNING',
): TaskDomainState {
  const state = createBaseState(projectId)
  if (scenario === 'EMPTY') {
    return {
      projectId,
      orchestrationRuns: new Map(),
      workPackages: new Map(),
      subtasks: new Map(),
      taskRuns: new Map(),
      steps: new Map(),
      logs: new Map(),
      inputRequests: new Map(),
      executionContexts: new Map(),
      deliverables: new Map(),
    }
  }

  const run = [...state.orchestrationRuns.values()][0]
  const firstWorkPackage = [...state.workPackages.values()][0]
  const firstTaskRun = [...state.taskRuns.values()][1]
  const scenarioStatus: Record<Exclude<TaskDomainScenario, 'EMPTY'>, OrchestrationRun['status']> = {
    QUEUED: 'QUEUED',
    PLANNING: 'PLANNING',
    RUNNING: 'RUNNING',
    WAITING_INPUT: 'WAITING_INPUT',
    WAITING_APPROVAL: 'WAITING_APPROVAL',
    BLOCKED: 'BLOCKED',
    FAILED: 'FAILED',
    SUCCEEDED: 'SUCCEEDED',
    CANCELLING: 'CANCELLING',
    CANCELLED: 'CANCELLED',
  }
  run.status = scenarioStatus[scenario]

  if (scenario === 'WAITING_INPUT') firstTaskRun.status = 'WAITING_INPUT'
  if (scenario === 'WAITING_APPROVAL') firstTaskRun.status = 'WAITING_APPROVAL'
  if (scenario === 'BLOCKED') firstTaskRun.status = 'BLOCKED'
  if (scenario === 'FAILED') firstTaskRun.status = 'FAILED'
  if (scenario === 'SUCCEEDED') {
    firstTaskRun.status = 'SUCCEEDED'
    firstWorkPackage.status = 'SUCCEEDED'
  }
  if (scenario === 'CANCELLING') firstTaskRun.status = 'CANCELLING'
  if (scenario === 'CANCELLED') {
    firstTaskRun.status = 'CANCELLED'
    firstWorkPackage.status = 'CANCELLED'
  }
  return state
}
