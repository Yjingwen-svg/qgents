import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { App, BackTop, Button, Card, ConfigProvider, Empty, Input, Space, Spin, Tag, Typography } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, ClockCircleFilled, LeftOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useApproveMergeRequestCq, useMergeRequest, useMergeRequestChecks, useRejectMergeRequestCq, useTask } from '@/hooks/task-model'
import { PATHS } from '@/routes/paths'
import { findCqCheck, isMergeRequestAuthor } from '../cqSeal'
import { CqSealCard } from '../MergeRequestDetail/CqSealCard'
import { formatApiError } from '@/utils/formatApiError'
import styles from './CqReviewPage.module.scss'

const { Title, Text, Paragraph } = Typography

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

/**
 * CQ+1 审查页。
 * 入口：MR 与质量门禁 → 流程图点击 CQ+1 节点
 */
export default function CqReviewPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { message, modal } = App.useApp()

  const mergeRequestId = searchParams.get('mr')?.trim() ?? ''

  const mrQuery = useMergeRequest(projectId, mergeRequestId)
  const checksQuery = useMergeRequestChecks(projectId, mergeRequestId)
  const approveCq = useApproveMergeRequestCq(projectId)
  const rejectCq = useRejectMergeRequestCq(projectId)

  const mr = mrQuery.data
  const taskQuery = useTask(projectId, mr?.taskId ?? '')
  const checks = checksQuery.data ?? []
  const cqCheck = useMemo(() => findCqCheck(checks), [checks])

  const isAuthor = isMergeRequestAuthor(user?.id, taskQuery.data?.createdByUser?.id)
  const cqStatus = cqCheck?.status ?? 'PENDING'

  function goBack() {
    navigate(PATHS.projectTestset(projectId))
  }

  function submitCq(kind: 'approve' | 'reject') {
    if (!mr || mr.status !== 'OPEN') {
      message.warning('仅可对进行中的 MR 进行 CQ 审查')
      return
    }
    if (isAuthor) {
      message.warning('不能审核自己的 MR')
      return
    }

    let reason = ''
    const rejecting = kind === 'reject'
    modal.confirm({
      title: rejecting ? '拒绝 CQ' : '盖 CQ+1？',
      content: (
        <Input.TextArea
          placeholder={rejecting ? '请填写拒绝理由' : '请填写审查意见'}
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(event) => {
            reason = event.target.value
          }}
        />
      ),
      okText: rejecting ? '拒绝' : '盖章',
      okButtonProps: rejecting ? { danger: true } : undefined,
      onOk: () => {
        if (!reason.trim()) {
          message.warning(rejecting ? '拒绝理由不能为空' : '审查意见不能为空')
          return Promise.reject(new Error('reason required'))
        }
        const mutate = rejecting ? rejectCq.mutateAsync : approveCq.mutateAsync
        return mutate({ mergeRequestId: mr.id, input: { reason: reason.trim() } }).then(
          () => {
            message.success(rejecting ? '已拒绝 CQ+1' : '已盖 CQ+1')
            void checksQuery.refetch()
            void mrQuery.refetch()
          },
          (error: unknown) => {
            message.error(formatApiError(error))
            return Promise.reject(error)
          },
        )
      },
    })
  }

  if (!mergeRequestId) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Empty description="缺少 MR 标识，无法加载 CQ+1 审查">
              <Button type="primary" onClick={goBack}>返回质量门禁页</Button>
            </Empty>
          </div>
        </div>
      </ConfigProvider>
    )
  }

  if (mrQuery.isLoading || checksQuery.isLoading || taskQuery.isLoading) {
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

  if (mrQuery.isError) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Empty description={formatApiError(mrQuery.error)}>
              <Button onClick={() => void mrQuery.refetch()}>重试</Button>
              <Button onClick={goBack}>返回</Button>
            </Empty>
          </div>
        </div>
      </ConfigProvider>
    )
  }

  if (!mr) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Empty description="未找到该 MR，无法进行 CQ+1 审查">
              <Button onClick={goBack}>返回</Button>
            </Empty>
          </div>
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={pageTheme}>
      <div className={styles.page}>
        <BackTop />
        <button type="button" className={styles.backLink} onClick={goBack}>
          <LeftOutlined /> 返回质量门禁页
        </button>

        <header className={styles.header}>
          <div>
            <Title level={2} className={styles.title}>
              CQ+1 审查
            </Title>
            <Paragraph className={styles.subtitle}>
              MR #{mr.number} · {mr.title?.trim() || `${mr.sourceBranch} → ${mr.targetBranch}`}
            </Paragraph>
          </div>
          <Space>
            <Tag color={mr.status === 'OPEN' ? 'blue' : mr.status === 'MERGED' ? 'green' : 'default'}>
              {mr.status === 'OPEN' ? '进行中' : mr.status === 'MERGED' ? '已合并' : '已关闭'}
            </Tag>
            <Tag color={cqStatus === 'PASSED' ? 'success' : cqStatus === 'FAILED' ? 'error' : 'default'}>
              CQ+1：{cqStatus === 'PASSED' ? '已盖章' : cqStatus === 'FAILED' ? '已拒绝' : '待审查'}
            </Tag>
          </Space>
        </header>

        {checksQuery.isError ? (
          <Card className={styles.content}>
            <Empty description={formatApiError(checksQuery.error)}>
              <Button onClick={() => void checksQuery.refetch()}>重试</Button>
            </Empty>
          </Card>
        ) : (
          <Card className={styles.content}>
            <div className={styles.sealBlock}>
              <CqSealCard
                projectId={projectId}
                mergeRequestId={mr.id}
                check={cqCheck}
                headCommit={mr.headCommit}
                mrStatus={mr.status}
                isAuthor={isAuthor}
                busy={approveCq.isPending || rejectCq.isPending}
                onApprove={() => submitCq('approve')}
                onReject={() => submitCq('reject')}
              />
            </div>

            <div className={styles.submitSection}>
              <div className={styles.submitHeader}>
                <Text strong>提交记录</Text>
              </div>
              <SubmitHistoryList
                isAuthor={isAuthor}
                cqStatus={cqStatus}
                cqCheck={cqCheck}
                busy={approveCq.isPending || rejectCq.isPending}
                onApprove={() => submitCq('approve')}
                onReject={() => submitCq('reject')}
              />
            </div>
          </Card>
        )}
      </div>
    </ConfigProvider>
  )
}

function SubmitHistoryList({
  isAuthor,
  cqStatus,
  cqCheck,
  busy,
  onApprove,
  onReject,
}: {
  isAuthor: boolean
  cqStatus: string
  cqCheck: ReturnType<typeof findCqCheck>
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const canAct = cqStatus === 'PENDING' && !isAuthor

  return (
    <div className={styles.submitList}>
      {canAct ? (
        <div className={styles.submitActions}>
          <Button type="primary" loading={busy} onClick={onApprove}>
            盖 CQ+1
          </Button>
          <Button danger loading={busy} onClick={onReject}>
            拒绝
          </Button>
          <Text type="secondary">请在上方印章处确认审查</Text>
        </div>
      ) : cqStatus === 'PASSED' ? (
        <div className={styles.submitSuccess}>
          <CheckCircleFilled style={{ color: '#16a34a', fontSize: 24 }} />
          <div>
            <Text strong>CQ+1 已通过</Text>
            {cqCheck?.reviewedByName ? (
              <Text type="secondary"> · by {cqCheck.reviewedByName}</Text>
            ) : null}
          </div>
        </div>
      ) : cqStatus === 'FAILED' ? (
        <div className={styles.submitFailed}>
          <CloseCircleFilled style={{ color: '#dc2626', fontSize: 24 }} />
          <div>
            <Text strong>CQ+1 已拒绝</Text>
            {cqCheck?.reviewReason ? (
              <Paragraph type="secondary" style={{ marginTop: 4 }}>
                拒绝理由：{cqCheck.reviewReason}
              </Paragraph>
            ) : null}
          </div>
        </div>
      ) : isAuthor ? (
        <div className={styles.submitLocked}>
          <LockOutlined style={{ color: '#94a3b8', fontSize: 20 }} />
          <Text type="secondary">不能审核自己的 MR，请等待他人审查</Text>
        </div>
      ) : (
        <div className={styles.submitPending}>
          <ClockCircleFilled style={{ color: '#94a3b8', fontSize: 20 }} />
          <Text type="secondary">等待 CQ+1 审查</Text>
        </div>
      )}
    </div>
  )
}
