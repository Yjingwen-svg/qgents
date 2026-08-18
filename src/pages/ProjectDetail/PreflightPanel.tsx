import { Alert, Button, Spin, Tag, Typography } from 'antd'
import { formatApiError } from '@/utils/formatApiError'
import { preflightBlockerLabel, preflightStatusColor, preflightStatusLabel } from './preflightDisplay'
import type { Preflight } from '@/types/qualityGate'

const { Text } = Typography

/**
 * MR 前预检面板：展示 sourceCommit / targetCommit / Dry Run / CQ+1 与 blockers。
 * 预检 PASSED 前不提供可执行的创建 MR 主操作；STALE / FAILED 时给操作引导。
 */
export function PreflightPanel({
  preflight,
  loading,
  error,
  onRefresh,
}: {
  preflight: Preflight | undefined
  loading: boolean
  error: Error | null
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div style={{ padding: 12 }}>
        <Spin size="small" /> <Text type="secondary">正在加载 MR 前预检…</Text>
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={formatApiError(error)}
        action={<Button size="small" onClick={onRefresh}>重试</Button>}
      />
    )
  }

  if (!preflight) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <Tag color={preflightStatusColor(preflight.status)}>{preflightStatusLabel(preflight.status)}</Tag>
        <Text type="secondary">目标分支 </Text>
        <Text code>{preflight.targetBranch || '—'}</Text>
      </div>

      <div>
        <Text type="secondary">源提交 </Text>
        <Text code>{preflight.sourceCommit ? preflight.sourceCommit.slice(0, 7) : '—'}</Text>
        <Text type="secondary"> · 目标提交 </Text>
        <Text code>{preflight.targetCommit ? preflight.targetCommit.slice(0, 7) : '—'}</Text>
      </div>

      {preflight.dryRun ? (
        <div>
          <Text type="secondary">Dry Run </Text>
          <Text code>{preflight.dryRun.status || '—'}</Text>
        </div>
      ) : null}

      {preflight.cqPlusOne ? (
        <div>
          <Text type="secondary">CQ+1 </Text>
          <Text>{cqPlusOneLabel(preflight.cqPlusOne.status)}</Text>
          {preflight.cqPlusOne.reviewerName ? (
            <Text type="secondary">（{preflight.cqPlusOne.reviewerName}）</Text>
          ) : null}
        </div>
      ) : null}

      {preflight.blockers.length > 0 ? (
        <div>
          {preflight.blockers.map((blocker) => (
            <div key={`${blocker.code}-${blocker.message}`} style={{ marginTop: 4 }}>
              <Text type="danger">· {preflightBlockerLabel(blocker.code, blocker.message)}</Text>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function cqPlusOneLabel(status: 'MISSING' | 'APPROVED' | 'REJECTED'): string {
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已拒绝'
  return '缺失'
}
