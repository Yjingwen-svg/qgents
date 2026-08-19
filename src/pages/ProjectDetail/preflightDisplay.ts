import type { PreflightBlockerCode, PreflightStatus } from '@/types/qualityGate'

/**
 * MR 前预检（Preflight）的展示映射。
 * 服务端 409 的 details[].code 与预检 blockers[].code 复用同一套语义，统一在此文案化，
 * 前端不用按钮禁用代替服务端裁决。
 */

export function preflightStatusLabel(status: PreflightStatus): string {
  switch (status) {
    case 'PASSED':
      return '预检通过'
    case 'FAILED':
      return '预检未过'
    case 'STALE':
      return '预检已失效'
    default:
      return '预检进行中'
  }
}

export function preflightStatusColor(status: PreflightStatus): 'default' | 'processing' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'PASSED':
      return 'success'
    case 'FAILED':
      return 'error'
    case 'STALE':
      return 'warning'
    default:
      return 'processing'
  }
}

const BLOCKER_LABEL: Record<PreflightBlockerCode, string> = {
  TASK_NOT_READY: '任务尚未完成代码提交，请等待 Task 产出并推送当前提交',
  DRY_RUN_MISSING: '尚未发起 Dry Run，请先对当前提交发起 Dry Run',
  DRY_RUN_QUEUED: 'Dry Run 排队中，请等待执行完成',
  DRY_RUN_RUNNING: 'Dry Run 运行中，请等待执行完成',
  DRY_RUN_FAILED: 'Dry Run 未通过，请查看报告修复后重新发起',
  CQ_PLUS_ONE_MISSING: '缺少独立成员的 CQ+1，请由非发起人审批该 Dry Run',
  CQ_PLUS_ONE_REJECTED: 'CQ+1 被拒绝，请按意见修改后重新 Dry Run + CQ+1',
  PREFLIGHT_CONTEXT_STALE: '提交上下文已变化，请重新发起 Dry Run 并重新 CQ+1',
  MR_SOURCE_HEAD_CHANGED: '源分支有新提交，请刷新 Task/Diff 后重新预检',
}

/** 已知 blocker code 给精准文案，未知 code 回退 message / code 本身 */
export function preflightBlockerLabel(code: string, message = ''): string {
  if (code in BLOCKER_LABEL) return BLOCKER_LABEL[code as PreflightBlockerCode]
  return message.trim() || code || '存在未满足的预检条件'
}

/** 判断某 code 是否需要「重新 Dry Run + CQ+1」的重置引导 */
export function requiresRedoDryRun(code: string): boolean {
  return code === 'PREFLIGHT_CONTEXT_STALE' || code === 'MR_SOURCE_HEAD_CHANGED' || code === 'CQ_PLUS_ONE_REJECTED'
}

/** 判断某 code 是否引导刷新 Task/Diff 而非自动重试创建 MR */
export function requiresSourceRefresh(code: string): boolean {
  return code === 'MR_SOURCE_HEAD_CHANGED'
}
