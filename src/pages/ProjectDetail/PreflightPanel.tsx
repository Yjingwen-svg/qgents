import { Alert, App, Button, Divider, Spin, Tag, Typography } from 'antd'
import { PullRequestOutlined } from '@ant-design/icons'
import { useCreateMergeRequest } from '@/hooks/task-model'
import { formatApiError } from '@/utils/formatApiError'
import { preflightBlockerLabel, preflightStatusColor, preflightStatusLabel } from './preflightDisplay'
import type { Preflight } from '@/types/qualityGate'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'

const { Text } = Typography

type CreateMrState = 'HIDDEN' | 'DISABLED' | 'READY' | 'CONFIRMING' | 'CREATING'

function computeCreateMrState(preflights: Preflight[], creating: boolean): CreateMrState {
  if (creating) return 'CREATING'
  const hasAny = preflights.length > 0
  if (!hasAny) return 'HIDDEN'
  const allPassed = preflights.every((p) => p.status === 'PASSED')
  if (!allPassed) return 'HIDDEN'
  return 'READY'
}

function createMrButtonLabel(state: CreateMrState): string {
  if (state === 'CREATING') return '正在创建…'
  return '创建 MR'
}

/**
 * MR 前预检面板：展示 sourceCommit / targetCommit / Dry Run / CQ+1 与 blockers。
 * 预检 PASSED 前不提供可执行的创建 MR 主操作；STALE / FAILED 时给操作引导。
 */
export function PreflightPanel({
  projectId,
  preflight,
  allPreflights,
  loading,
  error,
  onRefresh,
}: {
  projectId: string
  preflight: Preflight | undefined
  /** 多仓库时传入全部 Preflight，用于聚合判断「创建 MR」按钮状态；缺省退化为只看 preflight 本身 */
  allPreflights?: Preflight[]
  loading: boolean
  error: Error | null
  onRefresh: () => void
}) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const createMr = useCreateMergeRequest(projectId)

  const mergedPreflights = allPreflights ?? (preflight ? [preflight] : [])
  const createMrState = computeCreateMrState(mergedPreflights, createMr.isPending)

  function submitCreateMr(): void {
    if (!preflight || createMrState !== 'READY') return
    const input = {
      taskId: preflight.taskId,
      repositoryId: preflight.repositoryId,
      targetBranch: preflight.targetBranch,
      title: `MR for task ${preflight.taskId}`,
    }
    createMr.mutate(input, {
      onSuccess: () => {
        message.success('MR 已创建')
        navigate(PATHS.projectCode(projectId) + `?tab=mr`)
      },
    })
  }

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

      <Divider style={{ margin: '8px 0' }} />

      {createMrState !== 'HIDDEN' ? (
        <div>
          <Button
            type="primary"
            icon={<PullRequestOutlined />}
            loading={createMrState === 'CREATING'}
            onClick={submitCreateMr}
            aria-label="create-merge-request"
          >
            {createMrButtonLabel(createMrState)}
          </Button>
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
