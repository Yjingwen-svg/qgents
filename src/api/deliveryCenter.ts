import { memoryApi } from './memory'
import { ApiError, request } from './client'
import { withQuery } from './requestHelpers'
import { skillApi } from './skill'
import { tasksApi } from './taskModel'
import type {
  DeliveryActionInput,
  DeliveryItem,
  DeliveryItemsFilters,
  DeliveryItemsResponse,
  DeliverySummaryResponse,
  DeliverySummaryFilters,
  MemoryDeliveryItem,
  SkillDeliveryItem,
} from '@/types/delivery-center'
import type { DiffReviewBatch } from '@/types/task-model'
import type { Memory, Skill } from '@/types'

const DELIVERY_STATUS_KEYS = ['DRAFT', 'PENDING_REVIEW', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'DELIVERED', 'FAILED', 'ARCHIVED'] as const
const DELIVERY_TYPE_KEYS = ['CODE', 'MEMORY', 'SKILL'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasNumericKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'number')
}

function isDeliverySummaryResponse(value: unknown): value is DeliverySummaryResponse {
  if (!isRecord(value)) return false
  return typeof value.total === 'number'
    && isRecord(value.countsByType)
    && hasNumericKeys(value.countsByType, DELIVERY_TYPE_KEYS)
    && isRecord(value.countsByStatus)
    && hasNumericKeys(value.countsByStatus, DELIVERY_STATUS_KEYS)
    && typeof value.pendingForCurrentUser === 'number'
    && Array.isArray(value.repositorySummaries)
    && Array.isArray(value.requirementGroupSummaries)
    && typeof value.updatedAt === 'string'
}

function resourceId(item: DeliveryItem): string {
  return item.resourceId
}

function taskIdForCode(item: DeliveryItem): string {
  if (item.resourceType !== 'CODE' || item.openTarget.kind !== 'TASK_DIFF_REVIEW') {
    throw new Error('CODE delivery item is missing TASK_DIFF_REVIEW openTarget')
  }
  return item.openTarget.taskId
}

export const deliveryCenterApi = {
  list(projectId: string, filters: DeliveryItemsFilters = {}) {
    return request<DeliveryItemsResponse>(
      withQuery(`/projects/${projectId}/delivery-items`, filters),
      { unwrapData: false },
    )
  },

  summary(projectId: string, filters: DeliverySummaryFilters = {}) {
    return request<DeliverySummaryResponse>(
      withQuery(`/projects/${projectId}/delivery-summary`, filters),
      { unwrapData: false },
    ).then((response: unknown) => {
      if (!isDeliverySummaryResponse(response)) {
        throw new ApiError('Delivery summary response shape mismatch: expected v1.8.0 summary object', 502, response)
      }
      return response
    })
  },

  perform(input: DeliveryActionInput): Promise<Memory | Skill | DiffReviewBatch> {
    const { projectId, item, action, reason } = input
    switch (item.resourceType) {
      case 'MEMORY':
        return performMemoryAction(projectId, item, action, reason)
      case 'SKILL':
        return performSkillAction(projectId, item, action, reason)
      case 'CODE':
        return performCodeAction(projectId, item, action, reason)
    }
  },

  submitReview(projectId: string, item: MemoryDeliveryItem | SkillDeliveryItem) {
    return this.perform({ projectId, item, action: 'submitReview' })
  },

  approve(projectId: string, item: MemoryDeliveryItem | SkillDeliveryItem) {
    return this.perform({ projectId, item, action: 'approve' })
  },

  reject(projectId: string, item: DeliveryItem, reason: string) {
    return this.perform({ projectId, item, action: 'reject', reason })
  },

  archive(projectId: string, item: MemoryDeliveryItem | SkillDeliveryItem) {
    return this.perform({ projectId, item, action: 'archive' })
  },

  confirmCode(projectId: string, item: DeliveryItem) {
    return this.perform({ projectId, item, action: 'confirm' })
  },

  retryDelivery(projectId: string, item: DeliveryItem) {
    return this.perform({ projectId, item, action: 'retryDelivery' })
  },
}

function performMemoryAction(
  projectId: string,
  item: MemoryDeliveryItem,
  action: DeliveryActionInput['action'],
  reason?: string,
): Promise<Memory> {
  const id = resourceId(item)
  switch (action) {
    case 'submitReview': return memoryApi.submitReview(projectId, id)
    case 'approve': return memoryApi.approve(projectId, id)
    case 'reject': return memoryApi.reject(projectId, id, reason ?? '')
    case 'archive': return memoryApi.archive(projectId, id)
    default: throw new Error(`Action ${action} is not supported for MEMORY`)
  }
}

function performSkillAction(
  projectId: string,
  item: SkillDeliveryItem,
  action: DeliveryActionInput['action'],
  reason?: string,
): Promise<Skill> {
  const id = resourceId(item)
  switch (action) {
    case 'submitReview': return skillApi.submitReview(projectId, id)
    case 'approve': return skillApi.approve(projectId, id)
    case 'reject': return skillApi.reject(projectId, id, reason ?? '')
    case 'archive': return skillApi.archive(projectId, id)
    default: throw new Error(`Action ${action} is not supported for SKILL`)
  }
}

function performCodeAction(
  projectId: string,
  item: Extract<DeliveryItem, { resourceType: 'CODE' }>,
  action: DeliveryActionInput['action'],
  reason?: string,
): Promise<DiffReviewBatch> {
  const taskId = taskIdForCode(item)
  switch (action) {
    case 'confirm': return tasksApi.confirmDiffReview(projectId, taskId)
    case 'reject': return tasksApi.rejectDiffReview(projectId, taskId, { reason: reason ?? '' })
    case 'retryDelivery': return tasksApi.retryDiffReviewDelivery(projectId, taskId)
    default: throw new Error(`Action ${action} is not supported for CODE`)
  }
}
