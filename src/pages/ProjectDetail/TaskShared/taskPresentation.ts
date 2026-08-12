import type { DeliveryType, OrchestrationRun, TaskCenterSummary } from '@/types'

export interface TaskPresentation {
  groupLabel: string
  creatorLabel: string
  deliveryTypeLabel: string
  description: string
  executionTarget: string
  targetLabel: string
  taskCount: number
  statusCounts?: TaskCenterSummary['statusCounts']
  progressPercent?: number
  waitingLabel?: string
  errorSummary?: string
}

const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  SERVICE_API: '服务端接口',
  WEB_PAGE: '前端页面',
  SHARED_SDK: '共享 SDK / 库',
  DOCUMENT: '文档与验收清单',
}

export function getTaskPresentation(run: OrchestrationRun): TaskPresentation {
  const summary = run.taskCenterSummary
  return {
    groupLabel: summary?.requirementGroupName ?? (run.groupId || '暂无'),
    creatorLabel: run.createdBy || '暂无',
    deliveryTypeLabel: summary ? DELIVERY_TYPE_LABELS[summary.deliveryType] : '—',
    description: summary?.description ?? run.instruction,
    executionTarget: summary?.executionTarget ?? '—',
    targetLabel: summary?.targetRepositoryId
      ? `${summary.targetRepositoryId}${summary.targetRef ? ` / ${summary.targetRef}` : ''}`
      : '暂无',
    taskCount: summary?.taskCount ?? run.workPackageIds.length,
    statusCounts: summary?.statusCounts,
    progressPercent: summary?.progressPercent,
    waitingLabel:
      run.status === 'WAITING_INPUT'
        ? '等待用户输入'
        : run.status === 'WAITING_APPROVAL'
          ? '等待项目管理员审批'
          : run.status === 'BLOCKED'
            ? '任务已阻塞，等待处理'
            : undefined,
    errorSummary: run.status === 'FAILED' ? '编排执行失败，详情请查看任务详情页' : undefined,
  }
}
