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
  /** 项目成员数（后端列表接口若返回则展示；未返回时前端隐藏该项，不显示占位） */
  memberCount?: number
  /** 项目状态（接口文档 §3.2：ACTIVE -> ARCHIVED；未返回时前端隐藏状态项） */
  status?: 'ACTIVE' | 'ARCHIVED'
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
  /** 创建时一并绑定的 GitHub 授权仓库 id 列表（github_repositories.id，授权仓本地 UUID） */
  repositoryIds?: string[]
}

/** 项目设置（GET/PATCH /projects/{projectId}/settings，§22.2）—— 需求群规则开关 */
export interface ProjectSettings {
  allowCreateGroup: boolean
  autoArchiveGroup: boolean
  allowAgentTrigger: boolean
  autoJoinAllGroups: boolean
}
