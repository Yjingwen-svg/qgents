import type {
  AgentNodeRole,
  OrchestrationRun,
  OrchestrationRunStatus,
  TaskRun,
  TaskRunStatus,
  WorkPackage,
  WorkPackageStatus,
} from './task-domain'

export type WorkflowNodeKind = 'AGENT' | 'GATE'

export interface WorkflowDefinitionNode {
  id: string
  kind: WorkflowNodeKind
  label: string
  role: AgentNodeRole | null
  description: string
}

export interface WorkflowDefinitionEdge {
  from: string
  to: string
}

export interface WorkflowDefinition {
  id: 'system-default-code-delivery'
  name: string
  description: string
  nodes: WorkflowDefinitionNode[]
  edges: WorkflowDefinitionEdge[]
}

export type WorkflowDisplayStatus =
  | 'NOT_STARTED'
  | 'PLANNING'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_INPUT'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED'

export type WorkflowTaskRun = TaskRun

export interface WorkflowNodeRuntime {
  nodeId: string
  status: WorkflowDisplayStatus
  taskRun: WorkflowTaskRun | null
  workPackage: WorkPackage | null
  agentId: string | null
  currentStep: string | null
  skillNames: string[]
  testsetNames: string[]
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  waitingMessage: string | null
}

export type WorkflowStatusSource =
  | OrchestrationRunStatus
  | WorkPackageStatus
  | TaskRunStatus
  | 'PENDING'

export interface WorkflowRuntimeData {
  run: OrchestrationRun | null
  workPackages: WorkPackage[]
  taskRuns: WorkflowTaskRun[]
  hasWorkPackageError: boolean
  hasTaskRunError: boolean
}
