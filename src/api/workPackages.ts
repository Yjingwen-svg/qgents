import { requestData, requestPage, withQuery, writeHeaders } from './taskDomain'
import type { UpdateWorkPackageInput, WorkPackage, WorkPackageFilters } from '@/types'

const basePath = (projectId: string) => `/projects/${projectId}/work-packages`

export const workPackagesApi = {
  list(projectId: string, filters: WorkPackageFilters = {}) {
    return requestPage<WorkPackage>(withQuery(basePath(projectId), filters))
  },

  get(projectId: string, workPackageId: string) {
    return requestData<WorkPackage>(`${basePath(projectId)}/${workPackageId}`)
  },

  update(projectId: string, workPackageId: string, input: UpdateWorkPackageInput) {
    return requestData<WorkPackage>(`${basePath(projectId)}/${workPackageId}`, {
      method: 'PATCH',
      headers: writeHeaders(),
      body: input,
    })
  },

  start(projectId: string, workPackageId: string) {
    return requestData<WorkPackage>(`${basePath(projectId)}/${workPackageId}/start`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  pause(projectId: string, workPackageId: string) {
    return requestData<WorkPackage>(`${basePath(projectId)}/${workPackageId}/pause`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  resume(projectId: string, workPackageId: string) {
    return requestData<WorkPackage>(`${basePath(projectId)}/${workPackageId}/resume`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },

  cancel(projectId: string, workPackageId: string) {
    return requestData<WorkPackage>(`${basePath(projectId)}/${workPackageId}/cancel`, {
      method: 'POST',
      headers: writeHeaders(),
    })
  },
}
