import type { OrchestrationRun, OrchestrationRunStatus } from '@/types'

/**
 * FE-API-006 临时展示适配：后端当前未返回群组名称、用户显示名、进度和错误摘要。
 * 这些值只用于任务中心视觉呈现，不代表正式 API 字段。
 */
export interface TaskCenterPresentation {
  groupLabel: string
  creatorLabel: string
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

export function getTaskCenterPresentation(run: OrchestrationRun): TaskCenterPresentation {
  return {
    groupLabel: MOCK_GROUP_LABELS[run.groupId] ?? run.groupId,
    creatorLabel: MOCK_CREATOR_LABELS[run.createdBy] ?? run.createdBy,
    progressPercent: MOCK_PROGRESS[run.status],
    waitingLabel:
      run.status === 'WAITING_INPUT'
        ? '等待用户输入'
        : run.status === 'WAITING_APPROVAL'
          ? '等待项目管理员审批'
          : run.status === 'BLOCKED'
            ? '任务被阻塞，等待处理'
            : undefined,
    errorSummary:
      run.status === 'FAILED' ? '编排执行失败，错误详情将在任务详情阶段提供' : undefined,
  }
}

