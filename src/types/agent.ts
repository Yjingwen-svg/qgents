/** Agent 角色标签，如「Coder」「Reviewer」——禁止单 Agent 梭哈完整个任务 */
export type AgentRoleTag = string

export interface Agent {
  id: string
  projectId: string
  nickname: string
  avatarUrl?: string
  roleTags: AgentRoleTag[]
  /** 工具定义 ID 列表（具体 schema 待后端定） */
  toolIds?: string[]
  /** Skill / Memory 编辑权限由团队角色控制：owner 可编辑共享，member 仅使用 */
}
