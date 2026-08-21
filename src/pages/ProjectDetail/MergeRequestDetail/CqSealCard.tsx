import { useState } from 'react'
import { Alert, Button, Empty, Modal, Space, Spin, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useMergeRequestReviews } from '@/hooks/task-model'
import { formatApiError } from '@/utils/formatApiError'
import type { MergeRequestCheck, MergeRequestCqReview, MergeRequestStatus } from '@/types/task-model'
import { cqSealAppearance, formatCqTime, shortCommitSha } from '../cqSeal'
import styles from './MergeRequestDetailPage.module.scss'

const { Text } = Typography

export function CqSealCard({
  projectId,
  mergeRequestId,
  check,
  headCommit,
  mrStatus,
  isAuthor,
  busy,
  onApprove,
  onReject,
  rootRef,
}: {
  projectId: string
  mergeRequestId: string
  check: MergeRequestCheck | undefined
  headCommit: string | null
  mrStatus: MergeRequestStatus
  isAuthor: boolean
  busy: boolean
  onApprove: () => void
  onReject: () => void
  rootRef?: React.RefObject<HTMLDivElement | null>
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const reviewsQuery = useMergeRequestReviews(projectId, mergeRequestId, historyOpen)
  const status = check?.status ?? 'PENDING'
  const appearance = cqSealAppearance({
    status,
    isAuthor,
    stampedSha: check?.commitSha,
    headCommit,
  })
  const displaySha = shortCommitSha(
    appearance === 'cracked' ? check?.commitSha ?? headCommit : headCommit ?? check?.commitSha,
  )
  // 同一提交一旦已有决定，不允许重复盖章或重复拒绝；新提交进入 cracked 状态时允许重新盖章。
  const canAct = mrStatus === 'OPEN' && !isAuthor && (status === 'PENDING' || appearance === 'cracked')
  const approveLabel = appearance === 'cracked' ? '重新盖章' : '盖 CQ+1'
  const showApprove = canAct && appearance !== 'stamped'
  const showReject = canAct && status === 'PENDING'

  return (
    <div ref={rootRef} className={styles.sealBlock} aria-label="CQ+1 印章">
      <div
        className={`${styles.seal} ${sealClass(appearance)}`}
        data-appearance={appearance}
        aria-hidden="true"
      >
        <div className={styles.sealRing}>
          <div className={styles.sealInner}>
            {appearance === 'locked' ? <LockOutlined className={styles.sealLock} /> : null}
            <span className={styles.sealMark}>CQ+1</span>
            <span className={styles.sealSha}>{displaySha}</span>
            <span className={styles.sealState}>{sealStateLabel(appearance)}</span>
          </div>
        </div>
      </div>
      <div className={styles.sealMeta}>
        {appearance === 'locked' ? (
          <p className={styles.sealDenied}>不能给自己盖章</p>
        ) : (
          <p>{sealCaption(appearance, check)}</p>
        )}
        {check?.reviewReason && (appearance === 'stamped' || appearance === 'failed') ? (
          <Text type="secondary">{check.reviewReason}</Text>
        ) : null}
      </div>
      {showApprove || showReject ? (
        <Space>
          {showApprove ? (
            <Button type="primary" loading={busy} onClick={onApprove} aria-label="approve-cq">
              {approveLabel}
            </Button>
          ) : null}
          {showReject ? (
            <Button danger loading={busy} onClick={onReject} aria-label="reject-cq">
              拒绝
            </Button>
          ) : null}
        </Space>
      ) : null}
      <Button
        type="link"
        className={styles.sealHistory}
        onClick={() => setHistoryOpen(true)}
        aria-label="view-cq-history"
      >
        查看历史
      </Button>
      <Modal
        title="CQ+1 审查历史"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <CqHistoryBody
          loading={reviewsQuery.isLoading}
          error={reviewsQuery.error}
          isError={reviewsQuery.isError}
          items={reviewsQuery.data ?? []}
          onRetry={() => void reviewsQuery.refetch()}
        />
      </Modal>
    </div>
  )
}

function CqHistoryBody({
  loading,
  error,
  isError,
  items,
  onRetry,
}: {
  loading: boolean
  error: Error | null
  isError: boolean
  items: MergeRequestCqReview[]
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className={styles.sealHistoryState}>
        <Spin />
      </div>
    )
  }
  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={error ? formatApiError(error) : '加载审查历史失败'}
        action={
          <Button size="small" onClick={onRetry}>
            重试
          </Button>
        }
      />
    )
  }
  if (items.length === 0) {
    return <Empty description="暂无 CQ 审查记录" />
  }
  return (
    <ul className={styles.sealHistoryList}>
      {items.map((item) => (
        <li key={item.id} className={styles.sealHistoryItem}>
          <div className={styles.sealHistoryHead}>
            <strong>{item.reviewerName}</strong>
            <span className={item.decision === 'APPROVED' ? styles.isApproved : styles.isRejected}>
              {item.decision === 'APPROVED' ? '接受' : '拒绝'}
            </span>
          </div>
          <p className={styles.sealHistoryReason}>
            原因：{item.reason?.trim() || '—'}
          </p>
          <p className={styles.sealHistoryTime}>
            时间：{formatCqTime(item.createdAt) || '—'}
            {item.commitSha ? ` · ${shortCommitSha(item.commitSha)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

function sealClass(appearance: ReturnType<typeof cqSealAppearance>): string {
  if (appearance === 'stamped') return styles.isStamped
  if (appearance === 'cracked') return styles.isCracked
  if (appearance === 'failed') return styles.isFailed
  if (appearance === 'locked') return styles.isLocked
  return styles.isEmpty
}

function sealStateLabel(appearance: ReturnType<typeof cqSealAppearance>): string {
  if (appearance === 'stamped') return '有效'
  if (appearance === 'cracked') return '已失效'
  if (appearance === 'failed') return '未通过'
  if (appearance === 'locked') return '锁定'
  return '未盖章'
}

function sealCaption(
  appearance: ReturnType<typeof cqSealAppearance>,
  check: MergeRequestCheck | undefined,
): string {
  if (appearance === 'cracked') return 'HEAD 已更新，旧 CQ+1 可能作废'
  if (appearance === 'failed') return check?.reviewedByName ? `${check.reviewedByName} 已拒绝` : '已拒绝本次 CQ'
  if (appearance === 'stamped') {
    const who = check?.reviewedByName?.trim() || '已盖章'
    const when = formatCqTime(check?.completedAt)
    return when ? `${who} · ${when}` : who
  }
  return '尚未有人在当前 HEAD 上盖章'
}
