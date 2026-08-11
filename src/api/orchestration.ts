import { requestData, requestPage, withQuery, writeHeaders } from './taskDomain'
import type {
  CreateOrchestrationRunInput,
  OrchestrationRun,
  OrchestrationRunFilters,
} from '@/types'

const basePath = (projectId: string) => `/projects/${projectId}/orchestration-runs`

export const orchestrationApi = {
  create(projectId: string, input: CreateOrchestrationRunInput) {
    return requestData<OrchestrationRun>(basePath(projectId), {
      method: 'POST',
      headers: writeHeaders(),
      body: input,
    })
  },

  list(projectId: string, filters: OrchestrationRunFilters = {}) {
    return requestPage<OrchestrationRun>(withQuery(basePath(projectId), filters))
  },

  get(projectId: string, runId: string) {
    return requestData<OrchestrationRun>(`${basePath(projectId)}/${runId}`)
  },

  cancel(projectId: string, runId: string) {
    return requestData<OrchestrationRun>(`${basePath(projectId)}/${runId}/cancel`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },
}
