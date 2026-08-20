import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackTop, Button, Card, ConfigProvider, Empty, List, Space, Tag, Typography, App, Tabs, Descriptions, Table } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useMergeRequest, useTestRun, useDryRunReport, useTestsets } from '@/hooks'
import type { TestRun, DryRunReport, LocalRunHistoryItem, Testset } from '@/types/testset'
import type { ColumnsType } from 'antd/es/table'
import { githubApi } from '@/api'
import { queryKeys } from '@/query'
import { PATHS } from '@/routes/paths'
import { readRunHistory, pushRunHistory, removeRunHistory } from './runHistory'
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
 * 注意：后端本轮未实现 GET /test-runs 和 GET /dry-runs 列表接口（P1+），
 * 按文档要求使用 localStorage 维护本设备运行历史。
 * 当前运行状态通过单条查询（useTestRun / useDryRunReport）轮询获取。
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

  // 本地运行历史（从 localStorage 读取）
  const [localRuns, setLocalRuns] = useState<LocalRunHistoryItem[]>(() => readRunHistory(projectId))

  // 选中的历史记录 ID（为 null 时默认显示最新一条）
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

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

  // 创建成功回调：写入 localStorage 并刷新状态
  const handleTestRunCreated = useCallback((run: TestRun) => {
    const item: LocalRunHistoryItem = {
      kind: 'TEST_RUN',
      id: run.id,
      repositoryId: run.repositoryId,
      createdAt: run.createdAt,
      label: `Test run · ${run.testsetIds.length} 个测试集`,
    }
    setLocalRuns(pushRunHistory(projectId, item))
    message.success('Test Run 已创建')
  }, [projectId, message])

  const handleDryRunCreated = useCallback((report: DryRunReport) => {
    const item: LocalRunHistoryItem = {
      kind: 'DRY_RUN',
      id: report.id,
      repositoryId: report.repositoryId,
      createdAt: report.createdAt,
      label: `Dry-run · ${report.status}`,
    }
    setLocalRuns(pushRunHistory(projectId, item))
    message.success('Dry Run 已创建')
  }, [projectId, message])

  // 删除本地历史项
  const handleDeleteRun = useCallback((runId: string) => {
    setLocalRuns(removeRunHistory(projectId, runId))
  }, [projectId])

  function goBack() {
    navigate(PATHS.projectTestset(projectId))
  }

  // MR 查询仅在有 mergeRequestId 时启用；页面核心功能不依赖 MR
  const isMrError = !!mergeRequestId && mrQuery.isError

  if (isMrError) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Empty description={`MR 加载失败：${mrQuery.error?.message ?? '未知错误'}`}>
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
              {mergeRequestId && !mr ? '正在加载 MR…' : '发起测试或 Dry-run'}
            </Paragraph>
          </div>
          <Space>
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
            <CurrentRunCard
              projectId={projectId}
              localRuns={localRuns}
              selectedRunId={selectedRunId}
            />
          </div>
          <div className={styles.runColumn}>
            <HistoryRunsCard
              localRuns={localRuns}
              selectedRunId={selectedRunId}
              onSelect={setSelectedRunId}
              onDelete={handleDeleteRun}
            />
          </div>
        </div>

        {/* Dry Run 创建弹窗 */}
        <DryRunCreateModal
          open={dryRunModalOpen}
          projectId={projectId}
          repositories={repositories}
          onClose={() => setDryRunModalOpen(false)}
          onCreated={handleDryRunCreated}
        />

        {/* Test Run 创建弹窗 */}
        <TestRunCreateModal
          open={testRunModalOpen}
          projectId={projectId}
          repositories={repositories}
          onClose={() => setTestRunModalOpen(false)}
          onCreated={handleTestRunCreated}
        />
      </div>
    </ConfigProvider>
  )
}

interface CurrentRunCardProps {
  projectId: string
  localRuns: LocalRunHistoryItem[]
  selectedRunId: string | null
}

function CurrentRunCard({ projectId, localRuns, selectedRunId }: CurrentRunCardProps) {
  // 根据选中 ID 或默认取最新一条
  const current = useMemo(() => {
    if (selectedRunId) {
      return localRuns.find(r => r.id === selectedRunId) ?? null
    }
    return localRuns[0] ?? null
  }, [localRuns, selectedRunId])

  // 获取运行状态（单条接口轮询）
  const testRunQuery = useTestRun(
    projectId,
    current?.kind === 'TEST_RUN' ? current.id : undefined,
  )
  const dryRunQuery = useDryRunReport(
    projectId,
    current?.kind === 'DRY_RUN' ? current.id : undefined,
  )

  // 加载测试集用于名称映射
  const { data: allTestsets = [] } = useTestsets(projectId, {})
  const testsetNameMap = useMemo(() => {
    const map = new Map<string, string>()
    allTestsets.forEach((t: Testset) => map.set(t.id, t.name))
    return map
  }, [allTestsets])

  const currentStatus: string | undefined =
    current?.kind === 'TEST_RUN'
      ? testRunQuery.data?.status
      : current?.kind === 'DRY_RUN'
        ? dryRunQuery.data?.status
        : undefined

  const isActive = currentStatus === 'QUEUED' || currentStatus === 'RUNNING'
  const isLoading = testRunQuery.isLoading || dryRunQuery.isLoading

  // ============ Dry Run 详情（所有 hooks 必须在顶层无条件调用） ============
  const report = dryRunQuery.data
  const testRunData = testRunQuery.data

  // --- Dry Run 计算 ---
  const dryRunDurationText = useMemo(() => {
    if (!report) return '—'
    if (report.durationSeconds != null) {
      return `${report.durationSeconds}s`
    }
    if (report.startedAt && report.finishedAt) {
      const ms = new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime()
      return `${Math.round(ms / 1000)}s`
    }
    if (report.startedAt) {
      return '进行中…'
    }
    return '—'
  }, [report])

  const dryRunStatusColor = useMemo(() => {
    if (!report) return 'default'
    switch (report.status) {
      case 'PASSED': return 'success'
      case 'FAILED': return 'error'
      case 'CONFLICT': return 'warning'
      case 'CANCELLED': return 'default'
      case 'RUNNING': return 'processing'
      default: return 'default'
    }
  }, [report])

  // --- TestRun 计算 ---
  const testRunDurationText = useMemo(() => {
    if (!testRunData) return '—'
    if (testRunData.startedAt && testRunData.finishedAt) {
      const ms = new Date(testRunData.finishedAt).getTime() - new Date(testRunData.startedAt).getTime()
      if (Number.isFinite(ms) && ms > 0) return `${Math.round(ms / 1000)}s`
      return '进行中…'
    }
    if (testRunData.startedAt) {
      return '进行中…'
    }
    return '—'
  }, [testRunData])

  const testRunStatusColor = useMemo(() => {
    if (!testRunData) return 'default'
    // 类型定义滞后于后端实际状态值（文档允许 CONFLICT 等扩展值，此处先兼容）
    const status: string = testRunData.status as string
    switch (status) {
      case 'PASSED': return 'success'
      case 'FAILED': return 'error'
      case 'CANCELLED': return 'default'
      case 'RUNNING': return 'processing'
      case 'QUEUED': return 'processing'
      case 'CONFLICT': return 'warning'
      default: return 'default'
    }
  }, [testRunData])

  const testsetColumns: ColumnsType<{ key: string; name: string; status: string; durationMs: number | null; failureCode: string | null }> = [
    { title: '测试集', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const color = v === 'PASSED' ? 'success' : v === 'FAILED' ? 'error' : v === 'RUNNING' ? 'processing' : 'default'
        return <Tag color={color}>{v}</Tag>
      },
    },
    {
      title: '执行耗时 (ms)', dataIndex: 'durationMs', key: 'durationMs',
      render: (v: number | null) => v != null ? v : '—',
    },
    {
      title: '失败码', dataIndex: 'failureCode', key: 'failureCode',
      render: (v: string | null) => v ?? <Text type="secondary">null</Text>,
    },
  ]

  // --- DryRun 表格数据 ---
  const dryRunTableData = useMemo(() => {
    if (!report) return []
    const results = report.report?.tests && 'results' in report.report.tests
      ? report.report.tests.results
      : []
    if (results.length > 0) {
      return results.map((item) => ({
        key: item.testsetId,
        name: testsetNameMap.get(item.testsetId) ?? item.testsetId.slice(0, 8),
        status: item.status,
        durationMs: item.durationMs,
        failureCode: item.failureCode,
      }))
    }
    return (report.testsetIds || []).map((id) => ({
      key: id,
      name: testsetNameMap.get(id) ?? id.slice(0, 8),
      status: report.status,
      durationMs: null,
      failureCode: null,
    }))
  }, [report, testsetNameMap])

  // --- TestRun 表格数据 ---
  const testRunTableData = useMemo(() => {
    if (!testRunData) return []
    const results = testRunData.executionSummary?.results ?? []
    if (results.length > 0) {
      return results.map((item) => ({
        key: item.testsetId,
        name: testsetNameMap.get(item.testsetId) ?? item.testsetId.slice(0, 8),
        status: item.status,
        durationMs: item.durationMs,
        failureCode: item.failureCode,
      }))
    }
    return (testRunData.testsetIds || []).map((id) => ({
      key: id,
      name: testsetNameMap.get(id) ?? id.slice(0, 8),
      status: testRunData.status,
      durationMs: null,
      failureCode: null,
    }))
  }, [testRunData, testsetNameMap])

  const dryRunTestsetNames = useMemo(() => {
    if (!report) return '无'
    return (report.testsetIds || [])
      .map((id) => testsetNameMap.get(id) ?? id.slice(0, 8))
      .join('、') || '无'
  }, [report, testsetNameMap])

  const testRunTestsetNames = useMemo(() => {
    if (!testRunData) return '无'
    return (testRunData.testsetIds || [])
      .map((id) => testsetNameMap.get(id) ?? id.slice(0, 8))
      .join('、') || '无'
  }, [testRunData, testsetNameMap])

  // --- DryRun Tab 视图 ---
  const dryRunTabItems = useMemo(() => {
    if (!report) return []
    return [
      {
        key: 'overview',
        label: '概览',
        children: (
          <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
            <Descriptions.Item label="本轮测试集">
              {dryRunTestsetNames}
            </Descriptions.Item>
            <Descriptions.Item label="发起人">
              {report.createdBy || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="源分支">
              <Tag>{report.sourceRef}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="目标分支">
              <Tag color="blue">{report.targetBranch}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="运行状态">
              <Tag color={dryRunStatusColor}>{report.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {report.startedAt ? new Date(report.startedAt).toLocaleString() : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="运行时长">
              {dryRunDurationText}
            </Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'testcases',
        label: '测试用例详情',
        children: (
          <Table
            columns={testsetColumns}
            dataSource={dryRunTableData}
            size="small"
            pagination={false}
            style={{ marginTop: 8 }}
            locale={{ emptyText: '暂无测试结果' }}
          />
        ),
      },
      {
        key: 'report',
        label: '报告',
        children: (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#6d7d95' }}>
            <Empty description="报告功能暂未开放" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ),
      },
    ]
  }, [report, dryRunTestsetNames, dryRunStatusColor, dryRunDurationText, dryRunTableData])

  // --- TestRun Tab 视图 ---
  const testRunTabItems = useMemo(() => {
    if (!testRunData) return []
    return [
      {
        key: 'overview',
        label: '概览',
        children: (
          <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
            <Descriptions.Item label="本轮测试集">
              {testRunTestsetNames}
            </Descriptions.Item>
            <Descriptions.Item label="发起人">
              {testRunData.createdBy || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="引用分支">
              {testRunData.ref ? <Tag>{testRunData.ref}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="运行状态">
              <Tag color={testRunStatusColor}>{testRunData.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="通过/失败/总计">
              {testRunData.caseSummary
                ? `${testRunData.caseSummary.passed} 通过 / ${testRunData.caseSummary.failed} 失败 / ${testRunData.caseSummary.total} 总计`
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {testRunData.startedAt ? new Date(testRunData.startedAt).toLocaleString() : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="运行时长">
              {testRunDurationText}
            </Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'testcases',
        label: '测试用例详情',
        children: (
          <Table
            columns={testsetColumns}
            dataSource={testRunTableData}
            size="small"
            pagination={false}
            style={{ marginTop: 8 }}
            locale={{ emptyText: '暂无测试结果' }}
          />
        ),
      },
      {
        key: 'report',
        label: '报告',
        children: testRunData.pdfUrl ? (
          <div style={{ padding: '16px 0' }}>
            <Button type="link" href={testRunData.pdfUrl} target="_blank">
              下载 PDF 报告
            </Button>
          </div>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#6d7d95' }}>
            <Empty description="报告功能暂未开放" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ),
      },
    ]
  }, [testRunData, testRunTestsetNames, testRunStatusColor, testRunDurationText, testRunTableData])

  // ============ 渲染 ============
  const isDryRun = current?.kind === 'DRY_RUN' && report
  const isTestRun = current?.kind === 'TEST_RUN' && testRunData

  return (
    <Card className={styles.runCard}>
      <Title level={5} className={styles.runCardTitle}>当前运行</Title>
      {localRuns.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未发起或选择运行。用右上角发起测试 / Dry-run。"
        />
      ) : current && isDryRun ? (
        <div>
          <div className={styles.currentRunItem} style={{ marginBottom: 12 }}>
            <Tag color="purple">Dry-run</Tag>
            <Text strong>{report!.id.slice(0, 8)}</Text>
            <Tag color={dryRunStatusColor}>{report!.status}</Tag>
          </div>
          <Tabs defaultActiveKey="overview" items={dryRunTabItems} size="small" />
        </div>
      ) : current && isTestRun ? (
        <div>
          <div className={styles.currentRunItem} style={{ marginBottom: 12 }}>
            <Tag color="blue">测试运行</Tag>
            <Text strong>{testRunData!.id.slice(0, 8)}</Text>
            <Tag color={testRunStatusColor}>{testRunData!.status}</Tag>
          </div>
          <Tabs defaultActiveKey="overview" items={testRunTabItems} size="small" />
        </div>
      ) : current ? (
        <div className={styles.currentRunList}>
          <div className={styles.currentRunItem}>
            <Tag color={current.kind === 'TEST_RUN' ? 'processing' : 'purple'}>
              {current.kind === 'TEST_RUN' ? '测试运行' : 'Dry-run'}
            </Tag>
            <Text strong>{current.id.slice(0, 8)}</Text>
            <Text type="secondary">
              {isLoading ? '加载状态…' : currentStatus ?? '已提交'}
            </Text>
            {isActive ? (
              <Tag color="processing" style={{ marginLeft: 4 }}>运行中</Tag>
            ) : currentStatus ? (
              <Tag color={currentStatus === 'PASSED' ? 'success' : 'default'} style={{ marginLeft: 4 }}>
                {currentStatus}
              </Tag>
            ) : null}
          </div>
        </div>
      ) : (
        <Empty description="暂无运行中的任务" />
      )}
    </Card>
  )
}

interface HistoryRunsCardProps {
  localRuns: LocalRunHistoryItem[]
  selectedRunId: string | null
  onSelect: (runId: string | null) => void
  onDelete: (runId: string) => void
}

function HistoryRunsCard({ localRuns, selectedRunId, onSelect, onDelete }: HistoryRunsCardProps) {
  const sorted = useMemo(() => {
    return [...localRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [localRuns])

  return (
    <Card className={styles.runCard}>
      <Title level={5} className={styles.runCardTitle}>本设备最近运行</Title>
      <Text type="secondary" className={styles.sideHint}>
        仅保存在本浏览器，不是跨设备权威历史。
      </Text>
      {sorted.length === 0 ? (
        <Empty description="暂无运行记录" />
      ) : (
        <List
          size="small"
          dataSource={sorted}
          renderItem={(item) => {
            const isSelected = item.id === selectedRunId
            return (
              <List.Item
                className={isSelected ? styles.selectedListItem : undefined}
                onClick={() => onSelect(isSelected ? null : item.id)}
                actions={[
                  <Button
                    key="delete"
                    type="link"
                    size="small"
                    danger
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                      if (selectedRunId === item.id) onSelect(null)
                    }}
                  >
                    删除
                  </Button>,
                ]}
              >
                <div className={styles.recentRunItem}>
                  <Tag color={item.kind === 'TEST_RUN' ? 'blue' : 'purple'}>
                    {item.kind === 'TEST_RUN' ? 'test-run' : 'dry-run'}
                  </Tag>
                  <Text strong>{item.label}</Text>
                  <Text type="secondary" className={styles.recentRunStatus}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </div>
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}
