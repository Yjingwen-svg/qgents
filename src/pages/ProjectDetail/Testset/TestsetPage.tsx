import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfigProvider, Result, Spin, Typography } from 'antd'
import { useMergeRequests, useMergeRequestChecks } from '@/hooks/task-model'
import { PATHS } from '@/routes/paths'
import { FlowStepper } from '../components/FlowStepper/FlowStepper'
import styles from './TestsetPage.module.scss'

const { Title } = Typography

const pageTheme = {
  algorithm: undefined,
  token: {
    colorPrimary: '#0d9b9b',
    colorBgBase: '#ffffff',
    colorText: '#12213d',
    colorTextSecondary: '#6d7d95',
    colorBorder: '#e4eaf2',
    borderRadius: 8,
  },
}

/** 当前展开的详情面板 */
type ExpandedPanel = 'gate' | 'cq' | null

/**
 * MR 与质量门禁页（Testset Page 重构版）。
 * 仅展示三节点流程图：质量门禁 → CQ+1 → 创建 MR
 * - 点击「质量门禁」展开门禁节点详情
 * - 点击「CQ+1」展开 CQ 审查记录
 * - 「创建 MR」按钮仅在门禁通过 + CQ 盖章后亮起
 */
export function TestsetPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [expanded, setExpanded] = useState<ExpandedPanel>(null)

  const mrsQuery = useMergeRequests(projectId)
  const mrList = mrsQuery.data?.data ?? []

  const openMrs = mrList.filter((mr) => mr.status === 'OPEN')

  /** 取最新一条 OPEN 的 MR 作为主状态来源 */
  const primaryMr = openMrs[0]

  const checksQuery = useMergeRequestChecks(projectId, primaryMr?.id ?? '')
  const checks = checksQuery.data ?? []

  const gateStatus =
    checks.length > 0 && checks.every((c) => c.status === 'PASSED')
      ? 'passed'
      : checks.some((c) => c.status === 'FAILED')
        ? 'failed'
        : 'pending'

  const cqCheck = checks.find((c) => c.type === 'CQ_PLUS_ONE')
  const cqStatus =
    cqCheck?.status === 'PASSED'
      ? 'approved'
      : cqCheck?.status === 'FAILED'
        ? 'rejected'
        : 'pending'

  function handleCreateMr() {
    window.location.href = `${PATHS.projectDiffs(projectId)}?tab=mr`
  }

  if (mrsQuery.isLoading) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Spin />
          </div>
        </div>
      </ConfigProvider>
    )
  }

  if (mrsQuery.isError) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <Result
            status="error"
            title="加载失败"
            subTitle={mrsQuery.error?.message ?? '未知错误'}
            extra={
              <button onClick={() => void mrsQuery.refetch()}>重新加载</button>
            }
          />
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={pageTheme}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Title level={2} className={styles.title}>
              MR 与质量门禁
            </Title>
          </div>
        </header>

        <div className={styles.flowArea}>
          <FlowStepper
            projectId={projectId}
            status={{
              gate: gateStatus,
              cq: cqStatus,
              createMr: gateStatus === 'passed' && cqStatus === 'approved',
            }}
            onClickGate={() => setExpanded(expanded === 'gate' ? null : 'gate')}
            onClickCq={() => setExpanded(expanded === 'cq' ? null : 'cq')}
            onClickCreateMr={handleCreateMr}
          />
        </div>

        {expanded === 'gate' && primaryMr ? (
          <GateDetail
            mrLabel={`MR #${primaryMr.number}`}
            checks={checks}
            loading={checksQuery.isLoading}
            onClose={() => setExpanded(null)}
          />
        ) : null}

        {expanded === 'cq' && primaryMr ? (
          <CqDetail
            mrLabel={`MR #${primaryMr.number}`}
            cqCheck={cqCheck}
            onClose={() => setExpanded(null)}
          />
        ) : null}
      </div>
    </ConfigProvider>
  )
}

function GateDetail({
  mrLabel,
  checks,
  loading,
  onClose,
}: {
  mrLabel: string
  checks: ReturnType<typeof useMergeRequestChecks>['data']
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <span>{mrLabel} · 质量门禁节点</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>
      {loading ? (
        <div className={styles.detailState}><Spin /></div>
      ) : checks && checks.length > 0 ? (
        <div className={styles.gateNodes}>
          {checks.map((check) => (
            <div key={check.type} className={styles.gateNode}>
              <span className={`${styles.dot} ${styles[`dot_${check.status.toLowerCase()}`]}`} />
              <span className={styles.gateNodeName}>{check.type}</span>
              <span className={styles.gateNodeStatus}>
                {check.status === 'PASSED' ? '通过' : check.status === 'FAILED' ? '未通过' : '待检查'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.detailState}>暂无门禁检查记录</div>
      )}
    </div>
  )
}

function CqDetail({
  mrLabel,
  cqCheck,
  onClose,
}: {
  mrLabel: string
  cqCheck: ReturnType<typeof useMergeRequestChecks>['data'][number] | undefined
  onClose: () => void
}) {
  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <span>{mrLabel} · CQ+1 审查</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className={styles.cqContent}>
        {cqCheck?.status === 'PASSED' ? (
          <div className={styles.cqApproved}>
            <span className={`${styles.dot} ${styles.dot_passed}`}>✓</span>
            <div>
              <strong>已盖章</strong>
              {cqCheck.reviewedByName ? (
                <p className={styles.cqMeta}>by {cqCheck.reviewedByName}</p>
              ) : null}
              {cqCheck.reviewReason ? (
                <p className={styles.cqReason}>{cqCheck.reviewReason}</p>
              ) : null}
            </div>
          </div>
        ) : cqCheck?.status === 'FAILED' ? (
          <div className={styles.cqRejected}>
            <span className={`${styles.dot} ${styles.dot_failed}`}>✗</span>
            <div>
              <strong>已拒绝</strong>
              {cqCheck.reviewReason ? (
                <p className={styles.cqReason}>{cqCheck.reviewReason}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={styles.cqPending}>
            <span className={`${styles.dot} ${styles.dot_pending}`}>◐</span>
            <div>
              <strong>待盖章</strong>
              <p className={styles.cqMeta}>CQ+1 审查尚未进行</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
