/**
 * 项目相关类型 —— 对齐接口文档 v1.1.4 §3.1 §5.2
 */

/** 项目角色 */
export type ProjectRole = 'PROJECT_ADMIN' | 'PROJECT_MEMBER'

export interface Project {
  id: string
  teamId: string
  name: string
  description?: string
  createdAt?: string
  /** 当前用户在项目中的角色（后端字段名为 role，非 myRole） */
  role?: ProjectRole
  /** 绑定的仓库数量 */
  repositoryCount?: number
}

export interface ProjectMember {
  userId: string
  displayName: string
  email: string
  role: ProjectRole
  avatarUrl?: string
}

/** POST /teams/{teamId}/projects 请求体 */
export interface CreateProjectPayload {
  teamId: string
  name: string
  description?: string
  /** 初始项目成员 userId 列表 */
  memberIds?: string[]
}
