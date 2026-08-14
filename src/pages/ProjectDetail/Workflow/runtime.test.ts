import { describe, expect, it } from 'vitest'
import type { TaskRunSummary, TaskStep } from '@/types/task-model'
import { buildWorkflowGraph } from './runtime'

const step = (id: string, dependencies: string[] = []): TaskStep => ({ id, taskId: 'task-1', sequenceNo: 1, title: 'Developer', description: null, role: 'DEVELOPER', agent: null, repository: null, dependencies, status: 'PENDING', acceptanceNotes: null, latestRun: null, runCount: 0, startedAt: null, finishedAt: null, createdAt: '2026-08-12T00:00:00Z', updatedAt: '2026-08-12T00:00:00Z' })
const run = (id: string, taskStepId: string, updatedAt: string): TaskRunSummary => ({ id, taskId: 'task-1', taskStepId, taskStepTitle: 'Developer', agent: { id: 'agent-1', name: 'Agent', role: 'DEVELOPER', avatarUrl: null }, role: 'DEVELOPER', status: 'SUCCEEDED', retryOfTaskRunId: null, statusSummary: null, statusReason: null, startedAt: updatedAt, finishedAt: updatedAt, durationMs: 1, artifactSummary: { total: 0, diffCount: 0 }, createdAt: updatedAt, updatedAt })

describe('workflow runtime graph', () => {
  it('orders dependency chains and keeps parallel roots/siblings', () => {
    const graph = buildWorkflowGraph([step('a'), step('b', ['a']), step('c', ['a']), step('d', ['b', 'c'])], [])
    expect(graph.nodes.map((node) => node.step.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(graph.nodes.map((node) => node.level)).toEqual([0, 1, 1, 2])
  })

  it('reports missing dependencies and cycles without dropping nodes', () => {
    const graph = buildWorkflowGraph([step('a', ['missing']), step('b', ['c']), step('c', ['b'])], [])
    expect(graph.nodes).toHaveLength(3)
    expect(graph.nodes.find((node) => node.step.id === 'a')?.missingDependencyIds).toEqual(['missing'])
    expect(graph.cycleNodeIds).toEqual(['b', 'c'])
  })

  it('associates runs by taskStepId and chooses the newest run', () => {
    const graph = buildWorkflowGraph([step('a')], [run('old', 'a', '2026-08-12T08:00:00Z'), run('new', 'a', '2026-08-12T09:00:00Z'), run('wrong', 'b', '2026-08-12T10:00:00Z')])
    expect(graph.nodes[0]?.runs.map((item) => item.id)).toEqual(['new', 'old'])
    expect(graph.nodes[0]?.latestRun?.id).toBe('new')
  })
})
