import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackTop, Button, Card, ConfigProvider, Empty, Space, Spin, Tag, Typography, List, App } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useMergeRequest, useTestRuns, useDryRuns } from '@/hooks'
import { githubApi } from '@/api'
import { queryKeys } from '@/query'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import DryRunCreateModal from './DryRunCreateModal'
import TestRunCreateModal from './TestRunCreateModal'
import styles from './QualityGateReviewPage.module.scss'

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
 * 质量门禁审查页。
 * 入口：MR 与质量门禁 → 流程图点击「质量门禁」节点
 *
 * 功能：
 * - 当前运行（Test Run / Dry Run）
 * - 本设备最近运行
 * - 管理测试集（跳转 TestsetPage）
 * - 运行测试（打开 TestRunCreateModal）
 * - 新建 Dry-run（打开 DryRunCreateModal）
 */
export default function QualityGateReviewPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const mergeRequestId = searchParams.get('mr')?.trim() || undefined

  // 弹窗状态
  const [dryRunModalOpen, setDryRunModalOpen] = useState(false)
  const [testRunModalOpen, setTestRunModalOpen] = useState(false)

  // MR 是可选的：质量门禁操作页不依赖 MR，MR 存在时额外加载
  const mrQuery = useMergeRequest(projectId, mergeRequestId ?? '')

  // 加载仓库列表（用于 DryRun/TestRun 创建表单）
  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  const mr = mrQuery.data
  const repositories = reposQuery.data ?? []

  function goBack() {
    navigate(PATHS.projectTestset(projectId))
  }

  function goToTestsetPage() {
    navigate(PATHS.projectTestsetsManage(projectId))
  }

  // MR 查询仅在有 mergeRequestId 时启用；页面核心功能不依赖 MR
  const isMrError = !!mergeRequestId && mrQuery.isError

  if (isMrError) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Empty description={`MR 加载失败：${formatApiError(mrQuery.error)}`}>
              <Button onClick={() => void mrQuery.refetch()}>重试</Button>
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
              质量门禁
              {mergeRequestId && mr ? (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  MR: {mr.number}
                </Tag>
              ) : null}
            </Title>
            <Paragraph className={styles.subtitle}>
              {mergeRequestId && !mr ? '正在加载 MR…' : '发起测试或 Dry-run；测试配方在「管理测试集」中维护'}
            </Paragraph>
          </div>
          <Space>
            <Button onClick={goToTestsetPage}>
              管理测试集
            </Button>
            <Button onClick={() => setTestRunModalOpen(true)} disabled={repositories.length === 0}>
              运行测试
            </Button>
            <Button
              type="primary"
              onClick={() => setDryRunModalOpen(true)}
              disabled={repositories.length === 0}
            >
              新建 Dry-run
            </Button>
          </Space>
        </header>

        <div className={styles.runRow}>
          <div className={styles.runColumn}>
            <CurrentRunCard projectId={projectId} />
          </div>
          <div className={styles.runColumn}>
            <HistoryRunsCard projectId={projectId} />
          </div>
        </div>

        {/* Dry Run 创建弹窗 */}
        <DryRunCreateModal
          open={dryRunModalOpen}
          projectId={projectId}
          repositories={repositories}
          onClose={() => setDryRunModalOpen(false)}
          onCreated={(report) => {
            message.success(`Dry Run 已创建: ${report.id.slice(0, 8)}`)
          }}
        />

        {/* Test Run 创建弹窗 */}
        <TestRunCreateModal
          open={testRunModalOpen}
          projectId={projectId}
          repositories={repositories}
          onClose={() => setTestRunModalOpen(false)}
          onCreated={(run) => {
            message.success(`Test Run 已创建: ${run.id.slice(0, 8)}`)
          }}
        />
      </div>
    </ConfigProvider>
  )
}

function CurrentRunCard({ projectId }: { projectId: string }) {
  const testRunsQuery = useTestRuns(projectId)
  const dryRunsQuery = useDryRuns(projectId)

  const currentTestRun = useMemo(() => {
    const runs = testRunsQuery.data ?? []
    return runs.find((r) => r.status === 'QUEUED' || r.status === 'RUNNING')
  }, [testRunsQuery.data])

  const currentDryRun = useMemo(() => {
    const runs = dryRunsQuery.data ?? []
    return runs.find((r) => r.status === 'QUEUED' || r.status === 'RUNNING')
  }, [dryRunsQuery.data])

  return (
    <Card className={styles.runCard}>
      <Title level={5} className={styles.runCardTitle}>当前运行</Title>
      {(testRunsQuery.isLoading || dryRunsQuery.isLoading) ? (
        <div className={styles.state} style={{ padding: 16 }}><Spin size="small" /></div>
      ) : currentTestRun || currentDryRun ? (
        <div className={styles.currentRunList}>
          {currentTestRun ? (
            <div className={styles.currentRunItem}>
              <Tag color="processing">测试运行</Tag>
              <Text strong>{currentTestRun.id.slice(0, 8)}</Text>
              <Text type="secondary">{currentTestRun.status}</Text>
            </div>
          ) : null}
          {currentDryRun ? (
            <div className={styles.currentRunItem}>
              <Tag color="purple">Dry-run</Tag>
              <Text strong>{currentDryRun.id.slice(0, 8)}</Text>
              <Text type="secondary">{currentDryRun.status}</Text>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未发起或选择运行。用右上角发起测试 / Dry-run；测试配方请到「管理测试集」。"
        />
      )}
    </Card>
  )
}

function HistoryRunsCard({ projectId }: { projectId: string }) {
  const testRunsQuery = useTestRuns(projectId)
  const dryRunsQuery = useDryRuns(projectId)

  const recentRuns = useMemo(() => {
    const testRuns = testRunsQuery.data ?? []
    const dryRuns = dryRunsQuery.data ?? []
    const all = [
      ...testRuns.map((r) => ({ kind: 'test-run' as const, id: r.id, status: r.status, createdAt: r.createdAt })),
      ...dryRuns.map((r) => ({ kind: 'dry-run' as const, id: r.id, status: r.status, createdAt: r.createdAt })),
    ]
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  }, [testRunsQuery.data, dryRunsQuery.data])

  return (
    <Card className={styles.runCard}>
      <Title level={5} className={styles.runCardTitle}>本设备最近运行</Title>
      <Text type="secondary" className={styles.sideHint}>
        仅保存在本浏览器，不是跨设备权威历史。
      </Text>
      {(testRunsQuery.isLoading || dryRunsQuery.isLoading) ? (
        <div className={styles.state} style={{ padding: 16 }}><Spin size="small" /></div>
      ) : recentRuns.length === 0 ? (
        <Empty description="暂无运行记录" />
      ) : (
        <List
          size="small"
          dataSource={recentRuns}
          renderItem={(item) => (
            <List.Item>
              <div className={styles.recentRunItem}>
                <Tag color={item.kind === 'test-run' ? 'blue' : 'purple'}>
                  {item.kind === 'test-run' ? 'test-run' : 'dry-run'}
                </Tag>
                <Text strong>{item.id.slice(0, 7)}</Text>
                <Text type="secondary" className={styles.recentRunStatus}>{item.status}</Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
