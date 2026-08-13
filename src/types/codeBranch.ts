/**
 * 项目「代码与 Branch」页的分支行模型
 *
 * TODO[后端联调] 接口文档写明「分支查询」暂不在本轮范围，本页分支行先用前端演示数据。
 * 仓库卡片本身应对齐 GET /projects/{projectId}/repositories（绑定记录 id = project_repositories.id）。
 */

/** 相对默认分支 / 交付链路是否还能继续开发，不是 GitHub 受保护标记，也不是 Testset */
export type BranchHealthStatus = 'HEALTHY' | 'BEHIND' | 'CONFLICT' | 'MERGED'

export type BranchTestStatus = 'PASSED' | 'RUNNING' | 'FAILED' | 'PENDING'

export interface BranchRelatedTask {
  /** 演示用任务编号，如 T-1024；联调后应对齐 Task.id（UUID） */
  code: string
  title: string
}

export interface ProjectBranchRow {
  id: string
  /** 项目仓库绑定 id，即 project_repositories.id */
  projectRepositoryId: string
  name: string
  protected: boolean
  healthStatus: BranchHealthStatus
  relatedTask: BranchRelatedTask | null
  requirementGroupId?: string
  requirementTitle?: string
  workspaceName?: string
  createdBy?: string
  createdAt?: string
  commitCount: number
  diffAdditions: number
  diffDeletions: number
  mrCount: number
  testStatus: BranchTestStatus
  latestCommitSha?: string
  latestCommitMessage?: string
  artifactName?: string
  artifactPublished?: boolean
}

export function branchHealthLabel(status: BranchHealthStatus): string {
  switch (status) {
    case 'HEALTHY':
      return '正常'
    case 'BEHIND':
      return '落后基线'
    case 'CONFLICT':
      return '冲突'
    case 'MERGED':
      return '已合并'
  }
}

export function branchTestLabel(status: BranchTestStatus): string {
  switch (status) {
    case 'PASSED':
      return '通过'
    case 'RUNNING':
      return '运行中'
    case 'FAILED':
      return '失败'
    case 'PENDING':
      return '未跑'
  }
}
