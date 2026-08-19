import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConfigProvider, Empty, Button, Tabs, Typography, Spin, Space } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { githubApi, projectApi } from '@/api'
import { useMergeRequests, useMergeRequestChecks, useTestsets } from '@/hooks'
import { PATHS } from '@/routes/paths'
import { queryKeys } from '@/query'
import { FlowStepper } from '../components/FlowStepper/FlowStepper'
import { MergeRequestTab } from '../MergeRequestTab'
import { QualityGateConfigDrawer } from './QualityGateConfigDrawer'
import styles from './TestsetPage.module.scss'

const { Title, Text } = Typography

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

type TabKey = 'gate' | 'mr'

/**
 * MR 与质量门禁页。
 * 包含两个标签页：
 * - 质量门禁：流程图
 * - MR：MR 列表
 */
export function TestsetPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [configOpen, setConfigOpen] = useState(false)

  const activeTab: TabKey = searchParams.get('tab') === 'mr' ? 'mr' : 'gate'

  function switchTab(key: string) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  // 项目信息（获取角色等）
  const projectQuery = useQuery({
    queryKey: queryKeys.projects(projectId),
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })

  const isAdmin = projectQuery.data?.role === 'PROJECT_ADMIN'

  const testsetsQuery = useTestsets(projectId)

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

  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  function handleCreateMr() {
    window.location.href = `${PATHS.projectDiffs(projectId)}?tab=mr`
  }

  function handleClickCq() {
    const mrParam = primaryMr ? `?mr=${encodeURIComponent(primaryMr.id)}` : ''
    navigate(`${PATHS.projectCqReview(projectId)}${mrParam}`)
  }

  function handleClickGate() {
    const mrParam = primaryMr ? `?mr=${encodeURIComponent(primaryMr.id)}` : ''
    navigate(`${PATHS.projectQualityGate(projectId)}${mrParam}`)
  }

  const isLoading = mrsQuery.isLoading || reposQuery.isLoading || projectQuery.isLoading

  if (isLoading) {
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

  if (mrsQuery.isError || reposQuery.isError) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.page}>
          <div className={styles.state}>
            <Empty
              description={mrsQuery.error?.message ?? '加载失败'}
            >
              <Button onClick={() => void mrsQuery.refetch()}>重新加载</Button>
            </Empty>
          </div>
        </div>
      </ConfigProvider>
    )
  }

  const tabItems = [
    {
      key: 'gate',
      label: '质量门禁',
      children: (
        <div className={styles.gateTab}>
          <div className={styles.flowArea}>
            <FlowStepper
              projectId={projectId}
              status={{
                gate: gateStatus,
                cq: cqStatus,
                createMr: gateStatus === 'passed' && cqStatus === 'approved',
              }}
              onClickGate={handleClickGate}
              onClickCq={handleClickCq}
              onClickCreateMr={handleCreateMr}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'mr',
      label: 'MR',
      children: (
        <div className={styles.mrTab}>
          <MergeRequestTab projectId={projectId} repositories={reposQuery.data ?? []} />
        </div>
      ),
    },
  ]

  return (
    <ConfigProvider theme={pageTheme}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Title level={2} className={styles.title}>
              质量门禁和 MR
            </Title>
            <Text type="secondary">
              发起测试或 Dry-run；测试配方在「管理测试集」中维护
            </Text>
          </div>
          <Space>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setConfigOpen(true)}
              disabled={!isAdmin}
              title={isAdmin ? '配置分支策略与质量门禁' : '仅 Project Admin 可配置'}
            >
              分支策略与门禁
            </Button>
          </Space>
        </header>

        <Tabs
          activeKey={activeTab}
          onChange={switchTab}
          items={tabItems}
          className={styles.tabs}
        />

        <QualityGateConfigDrawer
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          projectId={projectId}
          isAdmin={isAdmin}
          repositories={reposQuery.data ?? []}
          testsets={testsetsQuery.data ?? []}
        />
      </div>
    </ConfigProvider>
  )
}
