import { describe, expect, it } from 'vitest'
import {
  canRetryTaskRun,
  InvalidStateTransitionError,
  transitionOrchestrationRunCancel,
  transitionWorkPackageStatus,
} from './stateTransitions'
import { queryKeys } from '@/query'

describe('task domain state transitions', () => {
  it('pauses only a running work package and resumes a paused one', () => {
    expect(transitionWorkPackageStatus('RUNNING', 'pause')).toBe('PAUSED')
    expect(transitionWorkPackageStatus('PAUSED', 'resume')).toBe('RUNNING')
    expect(() => transitionWorkPackageStatus('READY', 'pause')).toThrow(InvalidStateTransitionError)
  })

  it('allows retry only for failed, cancelled, or blocked runs', () => {
    expect(canRetryTaskRun('FAILED')).toBe(true)
    expect(canRetryTaskRun('CANCELLED')).toBe(true)
    expect(canRetryTaskRun('BLOCKED')).toBe(true)
    expect(canRetryTaskRun('RUNNING')).toBe(false)
  })

  it('cancels queued/planning runs immediately and running runs asynchronously', () => {
    expect(transitionOrchestrationRunCancel('QUEUED')).toBe('CANCELLED')
    expect(transitionOrchestrationRunCancel('PLANNING')).toBe('CANCELLED')
    expect(transitionOrchestrationRunCancel('RUNNING')).toBe('CANCELLING')
    expect(transitionOrchestrationRunCancel('WAITING_INPUT')).toBe('CANCELLING')
    expect(() => transitionOrchestrationRunCancel('SUCCEEDED')).toThrow(InvalidStateTransitionError)
    expect(() => transitionOrchestrationRunCancel('CANCELLED')).toThrow(InvalidStateTransitionError)
  })

  it('scopes task query keys to the project', () => {
    expect(queryKeys.taskRuns.detail('project-a', 'run-1')).toContain('project-a')
    expect(queryKeys.taskRuns.detail('project-a', 'run-1')).not.toEqual(
      queryKeys.taskRuns.detail('project-b', 'run-1'),
    )
  })
})
