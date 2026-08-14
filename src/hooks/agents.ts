import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { agentApi } from '@/api'
import { queryClient, queryKeys } from '@/query'
import type { AgentDetail, AgentSkillBindingResponse, AgentSummary, CreateAgentPayload, UpdateAgentPayload } from '@/types'

export function useAgents(projectId: string, teamId?: string, scenario?: string): UseQueryResult<{ data: AgentSummary[] }> {
  const resolvedTeamId = teamId ?? projectId
  const resolvedProjectId = teamId ? projectId : ''
  return useQuery({ queryKey: queryKeys.agents.list(resolvedProjectId, resolvedTeamId, scenario), queryFn: () => agentApi.list(resolvedTeamId, scenario), enabled: Boolean(resolvedTeamId) })
}
export function useAgent(projectId: string, teamId: string, agentId: string | null): UseQueryResult<AgentDetail> {
  return useQuery({ queryKey: queryKeys.agents.detail(projectId, teamId, agentId ?? ''), queryFn: () => agentApi.get(teamId, agentId ?? ''), enabled: Boolean(projectId && teamId && agentId) })
}
export function useAgentSkillBindings(projectId: string, agentId: string | null): UseQueryResult<AgentSkillBindingResponse> {
  const enabled = Boolean(projectId && agentId) && import.meta.env.VITE_USE_MOCK !== 'true'
  return useQuery({ queryKey: queryKeys.agents.skillBindings(projectId, agentId ?? ''), queryFn: () => agentApi.skillBindings(projectId, agentId ?? ''), enabled })
}
type Variables = { agentId: string }
function invalidate(projectId: string, teamId: string, agentId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all(projectId, teamId) })
  if (agentId) void queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(projectId, teamId, agentId) })
}
export function useCreateAgent(projectId: string, teamId: string): UseMutationResult<AgentDetail, Error, CreateAgentPayload> {
  return useMutation({ mutationFn: (payload) => agentApi.create(teamId, payload), onSuccess: (agent) => invalidate(projectId, teamId, agent.id) })
}
export function useUpdateAgent(projectId: string, teamId: string): UseMutationResult<AgentDetail, Error, Variables & { payload: UpdateAgentPayload }> {
  return useMutation({ mutationFn: ({ agentId, payload }) => agentApi.update(teamId, agentId, payload), onSuccess: (agent) => invalidate(projectId, teamId, agent.id) })
}
function useAgentAction(projectId: string, teamId: string, execute: (id: string) => Promise<AgentDetail>): UseMutationResult<AgentDetail, Error, Variables> {
  return useMutation({ mutationFn: ({ agentId }) => execute(agentId), onSuccess: (agent) => invalidate(projectId, teamId, agent.id) })
}
export const usePublishAgent = (projectId: string, teamId: string) => useAgentAction(projectId, teamId, (id) => agentApi.publish(teamId, id))
export const useUnpublishAgent = (projectId: string, teamId: string) => useAgentAction(projectId, teamId, (id) => agentApi.unpublish(teamId, id))
export const useArchiveAgent = (projectId: string, teamId: string) => useAgentAction(projectId, teamId, (id) => agentApi.archive(teamId, id))
