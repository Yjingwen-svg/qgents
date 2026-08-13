import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { agentApi } from '@/api'
import { queryClient, queryKeys } from '@/query'
import type {
  AgentDetail,
  AgentSkillBindingResponse,
  AgentSummary,
  CreateAgentPayload,
  ProjectSkillOption,
  UpdateAgentPayload,
} from '@/types'

export function useAgents(teamId: string, scenario?: string): UseQueryResult<{ data: AgentSummary[] }> {
  return useQuery({
    queryKey: queryKeys.agents.list(teamId, scenario),
    queryFn: () => agentApi.list(teamId, scenario),
    enabled: Boolean(teamId),
  })
}

export function useAgent(teamId: string, agentId: string | null): UseQueryResult<AgentDetail> {
  return useQuery({
    queryKey: queryKeys.agents.detail(teamId, agentId ?? ''),
    queryFn: () => agentApi.get(teamId, agentId ?? ''),
    enabled: Boolean(teamId && agentId),
  })
}

export function useProjectSkillOptions(projectId: string): UseQueryResult<ProjectSkillOption[]> {
  return useQuery({
    queryKey: queryKeys.projectSkills(projectId),
    queryFn: () => agentApi.listProjectSkills(projectId),
    enabled: Boolean(projectId),
  })
}

type AgentMutationVariables = { agentId: string }

function invalidateAgents(teamId: string, agentId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all(teamId) })
  if (agentId) void queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(teamId, agentId) })
}

export function useCreateAgent(teamId: string): UseMutationResult<AgentDetail, Error, CreateAgentPayload> {
  return useMutation({
    mutationFn: (payload) => agentApi.create(teamId, payload),
    onSuccess: (agent) => {
      queryClient.setQueryData(queryKeys.agents.detail(teamId, agent.id), agent)
      invalidateAgents(teamId, agent.id)
    },
  })
}

export function useUpdateAgent(teamId: string): UseMutationResult<AgentDetail, Error, AgentMutationVariables & { payload: UpdateAgentPayload }> {
  return useMutation({
    mutationFn: ({ agentId, payload }) => agentApi.update(teamId, agentId, payload),
    onSuccess: (agent) => {
      queryClient.setQueryData(queryKeys.agents.detail(teamId, agent.id), agent)
      invalidateAgents(teamId, agent.id)
    },
  })
}

function useAgentAction(
  teamId: string,
  action: (agentId: string) => Promise<AgentDetail>,
): UseMutationResult<AgentDetail, Error, AgentMutationVariables> {
  return useMutation({
    mutationFn: ({ agentId }) => action(agentId),
    onSuccess: (agent) => {
      queryClient.setQueryData(queryKeys.agents.detail(teamId, agent.id), agent)
      invalidateAgents(teamId, agent.id)
    },
  })
}

export function usePublishAgent(teamId: string): UseMutationResult<AgentDetail, Error, AgentMutationVariables> {
  return useAgentAction(teamId, (agentId) => agentApi.publish(teamId, agentId))
}

export function useUnpublishAgent(teamId: string): UseMutationResult<AgentDetail, Error, AgentMutationVariables> {
  return useAgentAction(teamId, (agentId) => agentApi.unpublish(teamId, agentId))
}

export function useArchiveAgent(teamId: string): UseMutationResult<AgentDetail, Error, AgentMutationVariables> {
  return useAgentAction(teamId, (agentId) => agentApi.archive(teamId, agentId))
}

export function useBindAgentSkills(projectId: string, teamId: string): UseMutationResult<AgentSkillBindingResponse, Error, AgentMutationVariables & { skillIds: string[] }> {
  return useMutation({
    mutationFn: ({ agentId, skillIds }) => agentApi.bindSkills(projectId, agentId, skillIds),
    onSuccess: (binding) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(teamId, binding.agentId) })
    },
  })
}
