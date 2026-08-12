import type { DeliveryType, OrchestrationRun, OrchestrationRunStatus } from '@/types'

export interface TaskPresentation {
  groupLabel: string
  creatorLabel: string
  deliveryTypeLabel: string
  description: string
  executionTarget: string
  targetLabel: string
  taskCount: number
  statusCounts: {
    running: number
    pending: number
    completed: number
  }
  progressPercent: number
  waitingLabel?: string
  errorSummary?: string
}

const MOCK_GROUP_LABELS: Record<string, string> = {
  'group-demo-project-login': '登录功能',
}

const MOCK_CREATOR_LABELS: Record<string, string> = {
  'demo-user': 'Demo 用户',
}

const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  SERVICE_API: '服务端接口',
  WEB_PAGE: '前端页面',
  SHARED_SDK: '共享 SDK / 库',
  DOCUMENT: '文档与验收清单',
}

const MOCK_PROGRESS: Record<OrchestrationRunStatus, number> = {
  QUEUED: 8,
  PLANNING: 20,
  RUNNING: 62,
  WAITING_INPUT: 68,
  WAITING_APPROVAL: 72,
  BLOCKED: 72,
  FAILED: 100,
  SUCCEEDED: 100,
  CANCELLING: 78,
  CANCELLED: 0,
}

export function getTaskPresentation(run: OrchestrationRun): TaskPresentation {
  const summary = run.taskCenterSummary
  return {
    groupLabel: summary?.requirementGroupName ?? MOCK_GROUP_LABELS[run.groupId] ?? run.groupId,
    creatorLabel: MOCK_CREATOR_LABELS[run.createdBy] ?? run.createdBy,
    deliveryTypeLabel: summary ? DELIVERY_TYPE_LABELS[summary.deliveryType] : '—',
    description: summary?.description ?? run.instruction,
    executionTarget: summary?.executionTarget ?? '—',
    targetLabel: summary?.targetRepositoryId
      ? `${summary.targetRepositoryId}${summary.targetRef ? ` / ${summary.targetRef}` : ''}`
      : '群聊上下文',
    taskCount: summary?.taskCount ?? run.workPackageIds.length,
    statusCounts: summary?.statusCounts ?? { running: 0, pending: 0, completed: 0 },
    progressPercent: summary?.progressPercent ?? MOCK_PROGRESS[run.status],
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
