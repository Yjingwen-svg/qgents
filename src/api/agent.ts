import { requestData, requestPage, withQuery, writeHeaders } from './requestHelpers'
import type {
  AgentDetail,
  AgentSummary,
  AgentSkillBindingResponse,
  CreateAgentPayload,
  ProjectSkillOption,
  UpdateAgentPayload,
} from '@/types'

const teamAgentsPath = (teamId: string) => `/teams/${teamId}/agents`

export const agentApi = {
  list(teamId: string, scenario?: string) {
    return requestPage<AgentSummary>(withQuery(teamAgentsPath(teamId), { scenario }))
  },

  get(teamId: string, agentId: string) {
    return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}`)
  },

  create(teamId: string, payload: CreateAgentPayload) {
    return requestData<AgentDetail>(teamAgentsPath(teamId), {
      method: 'POST',
      headers: writeHeaders(),
      body: payload,
    })
  },

  update(teamId: string, agentId: string, payload: UpdateAgentPayload) {
    return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}`, {
      method: 'PATCH',
      headers: writeHeaders(),
      body: payload,
    })
  },

  publish(teamId: string, agentId: string) {
    return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}/publish`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  unpublish(teamId: string, agentId: string) {
    return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}/unpublish`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  archive(teamId: string, agentId: string) {
    return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}/archive`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  listProjectSkills(projectId: string) {
    return requestData<ProjectSkillOption[]>(`/projects/${projectId}/skills`)
  },

  bindSkills(projectId: string, agentId: string, skillIds: string[]) {
    return requestData<AgentSkillBindingResponse>(`/projects/${projectId}/agent-skill-bindings/${agentId}`, {
      method: 'PUT',
      body: { skillIds },
    })
  },
}
