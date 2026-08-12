import { requestData, requestPage, withQuery, writeHeaders } from './taskDomain'
import type { CursorPageFilters, Deliverable, RejectDeliverableInput } from '@/types'

const basePath = (projectId: string) => `/projects/${projectId}/deliverables`

export const deliverablesApi = {
  list(projectId: string, workPackageId: string, filters: CursorPageFilters = {}) {
    return requestPage<Deliverable>(
      withQuery(`/projects/${projectId}/work-packages/${workPackageId}/deliverables`, filters),
    )
  },

  get(projectId: string, deliverableId: string) {
    return requestData<Deliverable>(`${basePath(projectId)}/${deliverableId}`)
  },

  accept(projectId: string, deliverableId: string) {
    return requestData<Deliverable>(`${basePath(projectId)}/${deliverableId}/accept`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  reject(projectId: string, deliverableId: string, input: RejectDeliverableInput) {
    return requestData<Deliverable>(`${basePath(projectId)}/${deliverableId}/reject`, {
      method: 'POST',
      headers: writeHeaders(),
      body: input,
    })
  },
}
