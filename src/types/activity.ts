/**
 * 最近动态类型 —— 对齐「前端待接接口清单.md」的团队 activities 接口设计。
 * 用于团队首页右侧「最近动态」面板，聚合团队内各类操作记录。
 */

/** 动态类型（后端按事件落库时写入） */
export type ActivityType =
  | 'MESSAGE'
  | 'GROUP_CREATED'
  | 'MEMBER_JOINED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'DIFF_CREATED'
  | 'MR_CREATED'
  | 'MR_MERGED'
  | 'TEST_RUN_FAILED'

/** 动态目标类型 */
export type ActivityTargetType = 'GROUP' | 'TASK' | 'MR' | 'PROJECT' | 'DIFF'

export interface ActivityActor {
  id: string
  displayName: string
  avatar?: string
}

export interface ActivityTarget {
  type: ActivityTargetType
  id: string
  title?: string
}

export interface Activity {
  id: string
  type: ActivityType
  title: string
  summary?: string | null
  actor: ActivityActor
  target: ActivityTarget
  /** 前端路由路径（可选；后端若只给 target，前端用 PATHS 拼） */
  link?: string
  createdAt: string
}
