import { describe, expect, it } from 'vitest'
import { canCancelOrchestrationRun } from './orchestrationRunCapabilities'

describe('orchestration run cancel capability', () => {
  it.each(['QUEUED', 'PLANNING', 'RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED'] as const)(
    'allows cancellation from %s',
    (status) => expect(canCancelOrchestrationRun(status)).toBe(true),
  )

  it.each(['CANCELLING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const)(
    'does not allow cancellation from %s',
    (status) => expect(canCancelOrchestrationRun(status)).toBe(false),
  )
})
