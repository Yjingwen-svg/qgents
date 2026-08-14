import type { TaskRunSummary, TaskStep } from '@/types/task-model'

export interface WorkflowGraphNode {
  step: TaskStep
  runs: TaskRunSummary[]
  latestRun: TaskRunSummary | null
  missingDependencyIds: string[]
  level: number
}

export interface WorkflowGraph {
  nodes: WorkflowGraphNode[]
  cycleNodeIds: string[]
}

function compareNewest(left: TaskRunSummary, right: TaskRunSummary): number {
  const leftTime = Date.parse(left.updatedAt || left.createdAt)
  const rightTime = Date.parse(right.updatedAt || right.createdAt)
  if (rightTime !== leftTime) return rightTime - leftTime
  return right.id.localeCompare(left.id)
}

export function runsForStep(taskRuns: TaskRunSummary[], taskStepId: string): TaskRunSummary[] {
  return taskRuns.filter((run) => run.taskStepId === taskStepId).sort(compareNewest)
}

export function buildWorkflowGraph(taskSteps: TaskStep[], taskRuns: TaskRunSummary[]): WorkflowGraph {
  const stepById = new Map(taskSteps.map((step) => [step.id, step]))
  const runMap = new Map(taskSteps.map((step) => [step.id, runsForStep(taskRuns, step.id)]))
  const missingById = new Map(
    taskSteps.map((step) => [step.id, step.dependencies.filter((dependencyId) => !stepById.has(dependencyId))]),
  )
  const order = new Map(taskSteps.map((step, index) => [step.id, index]))
  const indegree = new Map(taskSteps.map((step) => [step.id, 0]))
  const children = new Map<string, string[]>()

  for (const step of taskSteps) {
    for (const dependencyId of step.dependencies) {
      if (!stepById.has(dependencyId)) continue
      indegree.set(step.id, (indegree.get(step.id) ?? 0) + 1)
      children.set(dependencyId, [...(children.get(dependencyId) ?? []), step.id])
    }
  }

  const ready = taskSteps.filter((step) => indegree.get(step.id) === 0).map((step) => step.id)
  const sortedIds: string[] = []
  while (ready.length > 0) {
    ready.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0))
    const current = ready.shift()
    if (!current) continue
    sortedIds.push(current)
    for (const childId of children.get(current) ?? []) {
      const nextDegree = (indegree.get(childId) ?? 0) - 1
      indegree.set(childId, nextDegree)
      if (nextDegree === 0) ready.push(childId)
    }
  }

  const cycleNodeIds = taskSteps.filter((step) => !sortedIds.includes(step.id)).map((step) => step.id)
  const finalIds = [...sortedIds, ...cycleNodeIds]
  const levelById = new Map<string, number>()
  for (const id of sortedIds) {
    const step = stepById.get(id)
    if (!step) continue
    const dependencyLevels = step.dependencies
      .map((dependencyId) => levelById.get(dependencyId))
      .filter((level): level is number => level !== undefined)
    levelById.set(id, dependencyLevels.length ? Math.max(...dependencyLevels) + 1 : 0)
  }
  for (const id of cycleNodeIds) levelById.set(id, 0)
  return {
    nodes: finalIds.map((id) => {
      const step = stepById.get(id)
      if (!step) throw new Error(`TaskStep ${id} 不存在`)
      const runs = runMap.get(id) ?? []
      return {
        step,
        runs,
        latestRun: runs[0] ?? null,
        missingDependencyIds: missingById.get(id) ?? [],
        level: levelById.get(id) ?? 0,
      }
    }),
    cycleNodeIds,
  }
}
