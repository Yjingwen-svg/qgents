import { Alert, App, Button, Card, Input, Space, Typography } from 'antd'
import { readApiErrorCode } from '@/api/qualityGate'
import { useApproveDryRunCq, useRejectDryRunCq } from '@/hooks/qualityGate'
import { queryClient, queryKeys } from '@/query'
import { formatApiError } from '@/utils/formatApiError'
import type { DryRunReport } from '@/types/testset'

const { Text, Paragraph } = Typography

/**
 * Dry Run 的 MR 前 CQ+1 操作区。
 * 仅当 Dry Run 为 PASSED 时展示；Task 发起人不可自审（前端禁用 + 后端 403 兜底）。
 * 后端仍是资格与提交一致性的唯一裁决者。
 */
export function DryRunCqPanel({
  projectId,
  dryRun,
  isAuthor,
}: {
  projectId: string
  dryRun: DryRunReport
  isAuthor: boolean
}) {
  const { message, modal } = App.useApp()
  const approveCq = useApproveDryRunCq(projectId)
  const rejectCq = useRejectDryRunCq(projectId)

  if (dryRun.status !== 'PASSED') return null

  function refreshPreflight(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.preflight.all(projectId) })
  }

  function submit(kind: 'approve' | 'reject'): void {
    let reason = ''
    const rejecting = kind === 'reject'
    modal.confirm({
      title: rejecting ? '拒绝该 Dry Run？' : '给该 Dry Run 盖 CQ+1？',
      content: (
        <Input.TextArea
          placeholder={rejecting ? '请填写修改意见（必填）' : '请填写审查理由'}
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(event) => {
            reason = event.target.value
          }}
        />
      ),
      okText: rejecting ? '拒绝' : '盖章',
      okButtonProps: rejecting ? { danger: true } : undefined,
      onOk: () => {
        if (rejecting && !reason.trim()) {
          message.warning('修改意见不能为空')
          return Promise.reject(new Error('reason required'))
        }
        const mutate = rejecting ? rejectCq.mutateAsync : approveCq.mutateAsync
        return mutate({ dryRunId: dryRun.id, input: { reason: reason.trim() } }).then(
          () => {
            message.success(rejecting ? '已拒绝该 Dry Run' : '已盖 CQ+1')
            refreshPreflight()
          },
          (error: unknown) => {
            const code = readApiErrorCode(error)
            if (code === 'PREFLIGHT_CQ_AUTHOR_FORBIDDEN') {
              message.error('Task 发起人不可自审，请由独立成员审批该 Dry Run')
            } else if (code === 'PREFLIGHT_CONTEXT_STALE' || code === 'PREFLIGHT_TASK_NOT_READY') {
              refreshPreflight()
              message.error('预检上下文已变化，已刷新预检，请重新确认')
            } else {
              message.error(formatApiError(error))
            }
            return Promise.reject(error)
          },
        )
      },
    })
  }

  return (
    <Card size="small" title="MR 前 CQ+1">
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          由独立成员（非 Task 发起人）对当前通过的 Dry Run 进行人工审查；审查结果参与 MR 前预检。
        </Paragraph>
        {isAuthor ? (
          <Alert
            type="warning"
            showIcon
            message="Task 发起人不可自审"
            description="请由项目内其他成员对当前 Dry Run 盖 CQ+1 或拒绝。"
          />
        ) : (
          <Space>
            <Button type="primary" loading={approveCq.isPending} onClick={() => submit('approve')}>
              通过（CQ+1）
            </Button>
            <Button danger loading={rejectCq.isPending} onClick={() => submit('reject')}>
              拒绝
            </Button>
          </Space>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          后端仍是资格与提交一致性的唯一裁决者。
        </Text>
      </Space>
    </Card>
  )
}
