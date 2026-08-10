/** 任务看板状态（云端 Agent 执行生命周期） */
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
