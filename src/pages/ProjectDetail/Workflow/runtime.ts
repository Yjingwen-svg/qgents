import type {
  AgentSummary,
  WorkflowDefinitionNode,
  WorkflowNodeRuntime,
  WorkflowTaskRun,
  OrchestrationRun,
  WorkPackage,
} from '@/types'
import { mapRunStatus, mapTaskRunStatus } from './status'

function roleOf(taskRun: WorkflowTaskRun): string | null {
  return taskRun.agentNode ?? taskRun.agentRole ?? null
}

function taskRunForNode(taskRuns: WorkflowTaskRun[], node: WorkflowDefinitionNode): WorkflowTaskRun | null {
  if (!node.role) return null
  const matches = taskRuns.filter((taskRun) => roleOf(taskRun) === node.role)
  return [...matches].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

function workPackageForTaskRun(taskRun: WorkflowTaskRun | null, workPackages: WorkPackage[]): WorkPackage | null {
  return taskRun ? workPackages.find((workPackage) => workPackage.id === taskRun.workPackageId) ?? null : null
}

export function buildWorkflowNodeRuntime(
  node: WorkflowDefinitionNode,
  run: OrchestrationRun | null,
  workPackages: WorkPackage[],
  taskRuns: WorkflowTaskRun[],
): WorkflowNodeRuntime {
  const taskRun = taskRunForNode(taskRuns, node)
  const gateStatus = node.kind === 'GATE' ? mapRunStatus(run?.status) : null
  return {
    nodeId: node.id,
    status: gateStatus ?? mapTaskRunStatus(taskRun?.status),
    taskRun,
    workPackage: workPackageForTaskRun(taskRun, workPackages),
    agentId: taskRun?.agentId ?? null,
    currentStep: taskRun?.currentStep ?? taskRun?.subtaskTitle ?? null,
    skillNames: taskRun?.skillNames ?? [],
    testsetNames: taskRun?.testsetNames ?? [],
    startedAt: taskRun?.startedAt ?? null,
    finishedAt: taskRun?.finishedAt ?? null,
    errorMessage: taskRun?.errorSummary ?? null,
    waitingMessage: taskRun?.waitingMessage ?? null,
  }
}

export function agentForRuntime(runtime: WorkflowNodeRuntime, agents: AgentSummary[]): AgentSummary | null {
  return runtime.agentId ? agents.find((agent) => agent.id === runtime.agentId) ?? null : null
}
