/**
 * 项目：团队下隔离单元
 * Skill / Memory / 群聊 / 任务均按 projectId 隔离，禁止跨项目污染上下文
 */
export interface Project {
  id: string
  teamId: string
  name: string
  description?: string
  /** 绑定的 Git 仓库地址；创建时可绑定已有仓库或由平台自动新建 */
  gitRepoUrl?: string
  createdAt?: string
}

export interface CreateProjectPayload {
  teamId: string
  name: string
  description?: string
  /** 已有仓库 URL；为空时后端可自动创建并绑定 */
  gitRepoUrl?: string
  autoCreateRepo?: boolean
}
