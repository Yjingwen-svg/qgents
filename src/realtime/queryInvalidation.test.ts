import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/query'
import { invalidateProjectTaskModel, queryKeysForProjectTaskEvent, TASK_MODEL_QUERY_ROOTS } from './queryInvalidation'
import type { ProjectTaskEvent } from './eventParser'

const projectId = 'project-1'

afterEach(() => {
  vi.restoreAllMocks()
})

function keysFor(type: ProjectTaskEvent['type'], payload: Record<string, unknown>) {
  return queryKeysForProjectTaskEvent(projectId, {
    id: 'evt-1',
    type,
    payload: { projectId, ...payload },
  }).map((key) => JSON.stringify(key))
}

describe('project SSE Task model query invalidation mapping', () => {
  it('maps task.updated to Task list and detail', () => {
    expect(keysFor('task.updated', { taskId: 'task-1' })).toEqual([
      JSON.stringify(['qgents', 'projects', projectId, 'tasks']),
      JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1']),
    ])
  })

  it('maps task-step.updated to Task, TaskStep list, and TaskRun list', () => {
    const keys = keysFor('task-step.updated', { taskId: 'task-1', taskStepId: 'step-1' })
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1', 'steps']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1', 'task-runs']))
  })

  it('maps task-run.updated to run detail, task runs, and Task detail', () => {
    const keys = keysFor('task-run.updated', { taskId: 'task-1', taskRunId: 'run-1' })
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'run-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1', 'task-runs']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1']))
  })

  it('maps progress only to TaskRun detail and never writes content', () => {
    const keys = keysFor('task-run.step.progress', { taskRunId: 'run-1', taskStepId: 'step-1', content: 'raw event content' })
    expect(keys).toEqual([JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'run-1'])])
  })

  it.each(['input-required', 'approval-required'] as const)('maps %s to run, input requests, and Task detail', (type) => {
    const keys = keysFor(type, { taskId: 'task-1', taskRunId: 'run-1', inputRequestId: 'input-1' })
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'run-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'run-1', 'input-requests']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1']))
  })

  it('maps diff.created to Diff list/detail, Task, and optional TaskRun detail', () => {
    const keys = keysFor('diff.created', { taskId: 'task-1', diffId: 'diff-1', taskRunId: 'run-1' })
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'diffs']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'diffs', 'diff-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'tasks', 'task-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'run-1']))
    expect(keysFor('diff.created', { taskId: 'task-1', diffId: 'diff-1' }).some((key) => key.includes('task-runs'))).toBe(false)
  })

  it('ignores mismatched projects and missing required IDs without broad invalidation', () => {
    expect(queryKeysForProjectTaskEvent(projectId, {
      id: 'evt-2',
      type: 'task.updated',
      payload: { projectId: 'project-2', taskId: 'task-1' },
    })).toEqual([])
    expect(keysFor('task.updated', {})).toEqual([])
    expect(keysFor('task-step.updated', { taskId: 'task-1' })).toEqual([])
    expect(keysFor('task-run.updated', { taskId: 'task-1' })).toEqual([])
    expect(keysFor('task-step.updated', { taskId: 'task-1', stepId: 'old-step-id' })).toEqual([])
    expect(keysFor('diff.created', { taskId: 'task-1' })).toEqual([])
  })

  it('does not map retired or unrelated events', () => {
    const retiredEvent = {
      id: 'evt-3',
      type: 'task.updated' as const,
      payload: { projectId, taskId: 'task-1', eventName: 'orchestration-run.updated' },
    }
    expect(queryKeysForProjectTaskEvent(projectId, retiredEvent)).not.toHaveLength(0)
  })

  it('refreshes only the four new model roots after cursor expiration', () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    invalidateProjectTaskModel(projectId)
    expect(invalidateQueries.mock.calls.map(([options]) => JSON.stringify(options?.queryKey))).toEqual([
      JSON.stringify(['qgents', 'projects', projectId, 'tasks']),
      JSON.stringify(['qgents', 'projects', projectId, 'task-steps']),
      JSON.stringify(['qgents', 'projects', projectId, 'task-runs']),
      JSON.stringify(['qgents', 'projects', projectId, 'diffs']),
    ])
    expect(TASK_MODEL_QUERY_ROOTS(projectId)).not.toContainEqual(['qgents', 'projects', projectId, 'orchestration-runs'])
    expect(TASK_MODEL_QUERY_ROOTS(projectId)).not.toContainEqual(['qgents', 'projects', projectId, 'work-packages'])
    expect(TASK_MODEL_QUERY_ROOTS(projectId)).not.toContainEqual(['qgents', 'projects', projectId, 'deliverables'])
  })
})
