import { describe, expect, it } from 'vitest'
import { queryKeysForProjectTaskEvent } from './queryInvalidation'
import type { ProjectTaskEvent } from './eventParser'

const projectId = 'project-1'
const payload = {
  projectId,
  orchestrationRunId: 'run-1',
  workPackageId: 'wp-1',
  taskRunId: 'task-1',
}

function keysFor(type: ProjectTaskEvent['type']) {
  return queryKeysForProjectTaskEvent(projectId, {
    id: 'evt-1',
    type,
    payload,
  }).map((key) => JSON.stringify(key))
}

describe('project task event query invalidation mapping', () => {
  it('maps orchestration updates to list and detail', () => {
    expect(keysFor('orchestration-run.updated')).toEqual([
      JSON.stringify(['qgents', 'projects', projectId, 'orchestration-runs']),
      JSON.stringify(['qgents', 'projects', projectId, 'orchestration-runs', 'run-1']),
    ])
  })

  it('maps work package updates to work package and orchestration queries', () => {
    const keys = keysFor('work-package.updated')
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'work-packages']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'work-packages', 'wp-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'orchestration-runs', 'run-1']))
  })

  it('maps task run updates and progress to associated queries', () => {
    const updated = keysFor('task-run.updated')
    expect(updated).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs']))
    expect(updated).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'task-1']))
    expect(updated).toContain(JSON.stringify(['qgents', 'projects', projectId, 'work-packages', 'wp-1']))
    expect(updated).toContain(JSON.stringify(['qgents', 'projects', projectId, 'orchestration-runs', 'run-1']))

    const progress = keysFor('task-run.step.progress')
    expect(progress).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'task-1']))
    expect(progress.some((key) => key.includes('"steps"'))).toBe(true)
  })

  it.each(['task-run.input-required', 'task-run.approval-required'] as const)('maps %s to request, task and summary queries', (type) => {
    const keys = keysFor(type)
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'task-1', 'input-requests']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'task-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'work-packages', 'wp-1']))
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'orchestration-runs', 'run-1']))
  })

  it('maps deliverables to the delivery center, work package list and task detail', () => {
    const keys = keysFor('deliverable.created')
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'deliverables']))
    expect(keys.some((key) => key.includes('"deliverables"') && key.includes('"wp-1"'))).toBe(true)
    expect(keys).toContain(JSON.stringify(['qgents', 'projects', projectId, 'task-runs', 'task-1']))
  })

  it('does not map unrelated domains', () => {
    const keys = queryKeysForProjectTaskEvent(projectId, {
      id: 'evt-2',
      type: 'deliverable.created',
      payload: { projectId: 'another-project', workPackageId: 'wp-1' },
    })
    expect(keys).toHaveLength(2)
  })
})
