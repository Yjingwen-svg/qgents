import type {
  Deliverable,
  ExecutionContext,
  InputRequest,
  OrchestrationRun,
  Subtask,
  TaskRun,
  TaskRunLog,
  TaskRunStep,
  TaskExecutionPreviewStep,
  TaskExecutionStage,
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
  'INPUT_HANDLED',
  'APPROVAL_HANDLED',
  'APPROVAL_REJECTED',
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
      const taskRunStatus: TaskRun['status'] = packageIndex === 0 && subtaskIndex === 1
        ? 'WAITING_INPUT'
        : packageIndex === 1 && subtaskIndex === 1
          ? 'WAITING_APPROVAL'
          : subtaskIndex === 0
            ? 'SUCCEEDED'
            : subtaskIndex === 1
              ? 'RUNNING'
              : 'QUEUED'
      const taskRun: TaskRun = {
        id: taskRunId,
        projectId,
        orchestrationRunId,
        workPackageId,
        subtaskId,
        status: taskRunStatus,
        retryOfTaskRunId: null,
        subtaskTitle: `${role} step`,
        agentNode: role,
        agentRole: role,
        startedAt: subtaskIndex === 2 ? null : timestamp,
        finishedAt: subtaskIndex === 0 ? timestamp : null,
        durationMs: subtaskIndex === 0 ? 18_000 : null,
        artifactSummary: subtaskIndex === 0 ? `${role} 产物已生成` : null,
        errorSummary: null,
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
          node: role,
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

  const recentSteps: TaskExecutionPreviewStep[] = [
    {
      id: `${orchestrationRunId}-step-requirement`,
      label: '需求分析与方案设计',
      node: 'PLANNER',
      status: 'PASSED',
      startedAt: timestamp,
      finishedAt: timestamp,
    },
    {
      id: `${orchestrationRunId}-step-development`,
      label: '接口开发与自测',
      node: 'DEVELOPER',
      status: 'RUNNING',
      startedAt: timestamp,
      finishedAt: null,
    },
    {
      id: `${orchestrationRunId}-step-validation`,
      label: '测试与验证',
      node: 'TESTER',
      status: 'PENDING',
      startedAt: null,
      finishedAt: null,
    },
  ]

  const executionStages: TaskExecutionStage[] = [
    {
      id: `${orchestrationRunId}-stage-planning`,
      title: '需求分析与方案设计',
      node: 'PLANNER',
      status: 'COMPLETED',
      steps: [
        { id: `${orchestrationRunId}-planning-1`, label: '需求分析', node: 'PLANNER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
        { id: `${orchestrationRunId}-planning-2`, label: '方案设计', node: 'PLANNER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
        { id: `${orchestrationRunId}-planning-3`, label: '接口定义', node: 'PLANNER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
      ],
      startedAt: timestamp,
      finishedAt: timestamp,
    },
    {
      id: `${orchestrationRunId}-stage-development`,
      title: '接口开发与自测',
      node: 'DEVELOPER',
      status: 'COMPLETED',
      steps: [
        { id: `${orchestrationRunId}-development-1`, label: '接口开发', node: 'DEVELOPER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
        { id: `${orchestrationRunId}-development-2`, label: '单元测试', node: 'DEVELOPER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
        { id: `${orchestrationRunId}-development-3`, label: '自测验证', node: 'DEVELOPER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
      ],
      startedAt: timestamp,
      finishedAt: timestamp,
    },
    {
      id: `${orchestrationRunId}-stage-validation`,
      title: '测试与验证',
      node: 'TESTER',
      status: 'COMPLETED',
      steps: [
        { id: `${orchestrationRunId}-validation-1`, label: '功能测试', node: 'TESTER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
        { id: `${orchestrationRunId}-validation-2`, label: '接口测试', node: 'TESTER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
        { id: `${orchestrationRunId}-validation-3`, label: '安全测试', node: 'TESTER', status: 'PASSED', startedAt: timestamp, finishedAt: timestamp },
      ],
      startedAt: timestamp,
      finishedAt: timestamp,
    },
    {
      id: `${orchestrationRunId}-stage-delivery`,
      title: '交付整理',
      node: 'GENERAL',
      status: 'RUNNING',
      steps: [
        { id: `${orchestrationRunId}-delivery-1`, label: '交付物整理', node: 'GENERAL', status: 'RUNNING', startedAt: timestamp, finishedAt: null },
        { id: `${orchestrationRunId}-delivery-2`, label: '文档同步', node: 'GENERAL', status: 'PENDING', startedAt: null, finishedAt: null },
        { id: `${orchestrationRunId}-delivery-3`, label: '验收准备', node: 'GENERAL', status: 'PENDING', startedAt: null, finishedAt: null },
      ],
      startedAt: timestamp,
      finishedAt: null,
    },
  ]

  orchestrationRun.taskCenterSummary = {
    requirementGroupName: '登录功能',
    deliveryType: 'SERVICE_API',
    description: '实现邮箱登录、刷新机制，并补充 API 测试。',
    executionTarget: '登录接口与 API 测试',
    targetRepositoryId: `repository-${projectId}`,
    targetRef: 'feat/login-api',
    taskCount: 4,
    progressPercent: 62,
    statusCounts: { running: 2, pending: 1, completed: 1 },
    acceptanceCriteria: [
      '登录成功返回有效会话信息',
      '刷新机制覆盖过期与异常场景',
      'API 测试覆盖核心登录路径',
    ],
    participants: [
      { id: 'demo-user', name: 'Demo 用户', role: 'OWNER' },
      { id: 'developer-agent', name: 'Backend Developer Agent', role: 'AGENT' },
    ],
    agentName: 'Backend Developer Agent',
  }
  orchestrationRun.taskDetailSummary = {
    priorityLabel: '高',
    currentStage: '接口开发与自测',
    requirementDiscussion: '完整讨论记录与澄清',
    decisionRecord: '设计决策与权衡',
    skillMemorySummary: '相关技能与经验沉淀',
    workspaceId: `/workspace/${workPackages.get(workPackageIds[0])?.repositoryId ?? `repository-${projectId}`}`,
    sandboxId: 'sandbox/feat-login-api',
  }
  orchestrationRun.executionPreview = {
    latestTaskRunId: developerRunId,
    latestTaskRunStatus: taskRuns.get(developerRunId)?.status ?? null,
    currentNode: 'DEVELOPER',
    recentSteps,
    stages: executionStages,
    errorSummary: null,
    blockedSummary: null,
  }

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
    summary: '登录 API 实现与相关接口变更。',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const acceptedDeliverable: Deliverable = {
    ...pendingDeliverable,
    id: `deliverable-${projectId}-accepted`,
    workPackageId: workPackageIds[0],
    status: 'ACCEPTED',
    sourceRef: 'feat/login-tests',
    version: 2,
    summary: '登录接口核心场景测试报告。',
  }
  const contractDeliverable: Deliverable = {
    ...pendingDeliverable,
    id: `deliverable-${projectId}-contract`,
    workPackageId: workPackageIds[0],
    title: '登录 API 契约文档',
    type: 'DOCUMENT',
    status: 'ACCEPTED',
    sourceRef: 'main',
    version: 1,
    summary: '登录接口字段、错误码和调用示例。',
  }
  deliverables.set(pendingDeliverable.id, pendingDeliverable)
  deliverables.set(acceptedDeliverable.id, acceptedDeliverable)
  deliverables.set(contractDeliverable.id, contractDeliverable)

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

/**
 * Adds the resource graph created by the orchestration-runs API to an existing
 * project store. IDs are derived from the newly-created run so this graph never
 * falls back to the demo resources above.
 */
export function addCreatedOrchestrationRunResources(
  state: TaskDomainState,
  run: OrchestrationRun,
): void {
  const createdAt = run.createdAt
  const workPackageId = `${run.id}-work-package`
  const subtaskId = `${workPackageId}-subtask-developer`
  const taskRunId = `${subtaskId}-run-1`
  const isAuto = run.startMode === 'AUTO'
  const workPackageStatus: WorkPackage['status'] = isAuto ? 'RUNNING' : 'READY'
  const taskRunStatus: TaskRun['status'] = isAuto ? 'WAITING_INPUT' : 'QUEUED'

  run.status = isAuto ? 'RUNNING' : 'QUEUED'
  run.workPackageIds = [workPackageId]
  run.updatedAt = createdAt

  const workPackage: WorkPackage = {
    id: workPackageId,
    projectId: run.projectId,
    orchestrationRunId: run.id,
    groupId: run.groupId,
    repositoryId: `repository-${run.projectId}`,
    baseRef: 'main',
    headRef: `feat/${run.id}`,
    title: run.instruction,
    description: `Work package created for ${run.id}`,
    priority: 1,
    testsetIds: [],
    startMode: run.startMode,
    status: workPackageStatus,
    subtaskIds: [subtaskId],
    createdAt,
    updatedAt: createdAt,
  }
  const subtask: Subtask = {
    id: subtaskId,
    projectId: run.projectId,
    orchestrationRunId: run.id,
    workPackageId,
    title: 'Developer task',
    role: 'DEVELOPER',
    agentId: `agent-${run.id}`,
    status: isAuto ? 'RUNNING' : 'PENDING',
    dependsOnSubtaskIds: [],
    createdAt,
    updatedAt: createdAt,
  }
  const taskRun: TaskRun = {
    id: taskRunId,
    projectId: run.projectId,
    orchestrationRunId: run.id,
    workPackageId,
    subtaskId,
    status: taskRunStatus,
    retryOfTaskRunId: null,
    subtaskTitle: subtask.title,
    agentNode: 'DEVELOPER',
    agentRole: 'DEVELOPER',
    startedAt: isAuto ? createdAt : null,
    finishedAt: null,
    durationMs: null,
    artifactSummary: null,
    errorSummary: null,
    createdAt,
    updatedAt: createdAt,
  }

  state.workPackages.set(workPackageId, workPackage)
  state.subtasks.set(subtaskId, subtask)
  state.taskRuns.set(taskRunId, taskRun)
  state.steps.set(taskRunId, [
    {
      id: `${taskRunId}-step-1`,
      projectId: run.projectId,
      taskRunId,
      node: 'DEVELOPER',
      status: isAuto ? 'RUNNING' : 'PENDING',
      startedAt: isAuto ? createdAt : null,
      finishedAt: null,
      durationMs: null,
      errorCode: null,
    },
  ])
  state.logs.set(taskRunId, [
    {
      id: `${taskRunId}-log-1`,
      projectId: run.projectId,
      taskRunId,
      sequence: 1,
      node: 'DEVELOPER',
      level: 'INFO',
      content: 'Created task run',
      timestamp: createdAt,
    },
  ])
  state.executionContexts.set(taskRunId, {
    id: `${taskRunId}-context`,
    projectId: run.projectId,
    taskRunId,
    workspaceId: `${workPackageId}-workspace`,
    sandboxStatus: isAuto ? 'RUNNING' : 'READY',
    repositoryId: workPackage.repositoryId,
    baseRef: workPackage.baseRef,
    headRef: workPackage.headRef,
    startedAt: isAuto ? createdAt : null,
    expiresAt: null,
  })
  state.inputRequests.set(taskRunId, isAuto ? [{
    id: `${taskRunId}-input-request`,
    projectId: run.projectId,
    taskRunId,
    kind: 'INPUT',
    status: 'PENDING',
    prompt: 'Select the target branch',
    options: [
      { value: 'main', label: 'main' },
      { value: 'develop', label: 'develop' },
    ],
    createdAt,
    resolvedAt: null,
  }] : [])

  const deliverable: Deliverable = {
    id: `${taskRunId}-deliverable-1`,
    projectId: run.projectId,
    workPackageId,
    taskRunId,
    title: `${run.instruction} deliverable`,
    type: 'CODE',
    version: 1,
    status: 'PENDING_REVIEW',
    repositoryId: workPackage.repositoryId,
    sourceRef: workPackage.headRef,
    diffId: `${taskRunId}-diff-1`,
    mergeRequestId: null,
    rejectionReason: null,
    summary: 'Generated by the created orchestration run',
    createdAt,
    updatedAt: createdAt,
  }
  state.deliverables.set(deliverable.id, deliverable)
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
  const scenarioStatus: Record<Exclude<TaskDomainScenario, 'EMPTY' | 'INPUT_HANDLED' | 'APPROVAL_HANDLED' | 'APPROVAL_REJECTED'>, OrchestrationRun['status']> = {
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
  if (scenario === 'INPUT_HANDLED' || scenario === 'APPROVAL_HANDLED' || scenario === 'APPROVAL_REJECTED') {
    run.status = 'SUCCEEDED'
  } else {
    run.status = scenarioStatus[scenario]
  }

  if (scenario === 'WAITING_INPUT') firstTaskRun.status = 'WAITING_INPUT'
  if (scenario === 'WAITING_APPROVAL') firstTaskRun.status = 'WAITING_APPROVAL'
  if (scenario === 'INPUT_HANDLED') {
    firstTaskRun.status = 'SUCCEEDED'
    const request = state.inputRequests.get(developerRunIdFor(firstWorkPackage.id))?.[0]
    if (request) {
      request.status = 'ANSWERED'
      request.resolvedAt = timestamp
    }
  }
  if (scenario === 'APPROVAL_HANDLED' || scenario === 'APPROVAL_REJECTED') {
    const secondTaskRun = [...state.taskRuns.values()].find((taskRun) => taskRun.workPackageId !== firstWorkPackage.id && taskRun.subtaskId.includes('developer'))
    if (secondTaskRun) secondTaskRun.status = 'SUCCEEDED'
    const secondWorkPackage = [...state.workPackages.values()][1]
    const request = secondWorkPackage ? state.inputRequests.get(approvalRunIdFor(secondWorkPackage.id))?.[0] : undefined
    if (request) {
      request.status = scenario === 'APPROVAL_HANDLED' ? 'APPROVED' : 'REJECTED'
      request.resolvedAt = timestamp
    }
  }
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

function developerRunIdFor(workPackageId: string): string {
  return `${workPackageId}-subtask-developer-run-1`
}

function approvalRunIdFor(workPackageId: string): string {
  return `${workPackageId}-subtask-developer-run-1`
}
