import { describe, expect, it } from 'vitest'
import { canPerformAgentAction } from './agentActions'

const agent = { id: 'agent', name: 'Agent', avatar: null, role: 'DEVELOPER' as const, capabilities: [], visibility: 'PRIVATE' as const, status: 'ACTIVE' as const, createdBy: 'user', description: null, runtime: { status: 'IDLE' as const, activeRunCount: 0, concurrencyLimit: 1, assignmentUsage: { requirementGroups: { assignedCount: 0, assignableCount: 0 }, workflows: { assignedCount: 0, assignableCount: 0 } } } }
describe('Agent action matrix', () => {
  it('uses only formal status and visibility', () => { expect(canPerformAgentAction(agent, 'edit')).toBe(true); expect(canPerformAgentAction(agent, 'publish')).toBe(true); expect(canPerformAgentAction(agent, 'unpublish')).toBe(false); expect(canPerformAgentAction({ ...agent, visibility: 'TEAM' }, 'unpublish')).toBe(true); expect(canPerformAgentAction({ ...agent, status: 'ARCHIVED' }, 'archive')).toBe(false) })
})
