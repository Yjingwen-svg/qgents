/**
 * @deprecated 任务领域以 OrchestrationRun 为聚合根；此类型仅为旧占位页面保留。
 * 新代码应使用 `src/types/task-domain.ts` 中的实体。
 */
export type TaskStatus =
  | 'pending'
  | 'sandbox_creating'
  | 'running'
  | 'building'
  | 'testing'
  | 'awaiting_review'
  | 'done'
  | 'failed'

export interface Task {
  id: string
  projectId: string
  title: string
  status: TaskStatus
  /** 派发给哪些 Agent */
  agentIds?: string[]
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  diffRef?: string
  mrUrl?: string
}
