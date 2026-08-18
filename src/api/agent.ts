import { request, requestPage } from './client'
import { requestData, withQuery, writeHeaders } from './requestHelpers'
import type { AgentAssignmentsFilters, AgentAssignmentSummary, AgentDetail, AgentRuntimeSummary, AgentSkillBindingResponse, AgentSummary, AgentTaskRunSummary, CreateAgentPayload, UpdateAgentPayload } from '@/types'
import type { CursorPage } from '@/types/api'

const teamAgentsPath = (teamId: string) => `/teams/${teamId}/agents`

export const agentApi = {
  list(teamId: string, scenario?: string) { return requestPage<AgentSummary>(withQuery(teamAgentsPath(teamId), { scenario })) },
  get(teamId: string, agentId: string, projectId?: string) { return requestData<AgentDetail>(withQuery(`${teamAgentsPath(teamId)}/${agentId}`, { projectId })) },
  create(teamId: string, payload: CreateAgentPayload) { return requestData<AgentDetail>(teamAgentsPath(teamId), { method: 'POST', headers: writeHeaders(), body: payload }) },
  update(teamId: string, agentId: string, payload: UpdateAgentPayload) { return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}`, { method: 'PATCH', headers: writeHeaders(), body: payload }) },
  publish(teamId: string, agentId: string) { return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}/publish`, { method: 'POST', headers: writeHeaders() }) },
  unpublish(teamId: string, agentId: string) { return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}/unpublish`, { method: 'POST', headers: writeHeaders() }) },
  archive(teamId: string, agentId: string) { return requestData<AgentDetail>(`${teamAgentsPath(teamId)}/${agentId}/archive`, { method: 'POST', headers: writeHeaders() }) },
  /** Agent 头像直传：签发凭证（objectKey/uploadUrl） */
  avatarCredential(teamId: string, input: { mediaType: string; sizeBytes: number }) {
    return requestData<{ objectKey: string; uploadUrl: string; method: string; headers: Record<string, string>; expiresAt: string }>(
      `${teamAgentsPath(teamId)}/avatar/credential`, { method: 'POST', headers: writeHeaders(), body: input })
  },
  /** Agent 头像确认：对象上传后返回公共读 URL */
  avatarConfirm(teamId: string, objectKey: string) {
    return requestData<{ avatarUrl: string }>(`${teamAgentsPath(teamId)}/avatar/confirm`, { method: 'POST', headers: writeHeaders(), body: { objectKey } })
  },
  skillBindings(projectId: string, agentId: string) { return requestData<AgentSkillBindingResponse>(`/projects/${projectId}/agent-skill-bindings/${agentId}`) },
  assignments(projectId: string, agentId: string, filters: AgentAssignmentsFilters = {}) {
    return requestCursorPage<AgentAssignmentSummary>(withQuery(`/projects/${projectId}/agents/${agentId}/assignments`, filters))
  },
  runtime(projectId: string, agentId: string) {
    return request<AgentRuntimeSummary>(`/projects/${projectId}/agents/${agentId}/runtime`)
  },
  taskRuns(projectId: string, filters: { agentId: string; status?: AgentTaskRunSummary['status']; cursor?: string; limit?: number }): Promise<CursorPage<AgentTaskRunSummary>> {
    return requestCursorPage<AgentTaskRunSummary>(withQuery(`/projects/${projectId}/task-runs`, filters))
  },
}

function requestCursorPage<T>(path: string): Promise<CursorPage<T>> {
  return request<CursorPage<T>>(path, { unwrapData: false })
}
