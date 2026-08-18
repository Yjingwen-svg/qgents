import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
  type ThemeConfig,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { diffsApi, githubApi, projectApi } from '@/api'
import { isTestsetEnabled } from '@/api/testset'
import { tasksApi } from '@/api/taskModel'
import { ApiError } from '@/api/client'
import { formatApiError } from '@/utils/formatApiError'
import { queryKeys, taskModelQueryKeys } from '@/query'
import { PATHS } from '@/routes/paths'
import {
  useCreateDryRun,
  useCreateTestRun,
  useCreateTestset,
  useDeleteTestset,
  useDisableTestset,
  useDryRunReport,
  useEnableTestset,
  useTestRun,
  useTestsets,
  useUpdateTestset,
} from '@/hooks/testset'
import type { ProjectBoundRepository } from '@/types/github'
import type { DiffListItem } from '@/types/task-model'
import type {
  CreateDryRunPayload,
  CreateTestRunPayload,
  CreateTestsetPayload,
  DryRunReport,
  LocalRunHistoryItem,
  TestCaseDetail,
  TestRunArtifactRef,
  TestRunExecutionSummary,
  TestRunResultItem,
  Testset,
  TestsetStatus,
} from '@/types/testset'
import { dryRunHasMergeConflict, isDryRunTestsSkipped } from '@/types/testset'
import {
  caseStatusColor,
  caseStatusLabel,
  dryRunStatusLabel,
  formatDateTime,
  formatDuration,
  formatDurationMs,
  resolveDurationSeconds,
  runStatusColor,
  testRunStatusLabel,
  testsetStatusLabel,
} from './testsetDisplay'
import { pushRunHistory, readRunHistory, removeRunHistory } from './runHistory'
import { isTestsetRunTab } from '../qualityGateNav'
import styles from './TestsetPage.module.scss'

const { Title, Text, Paragraph } = Typography

const pageTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#0d9b9b',
    colorBgBase: '#ffffff',
    colorText: '#12213d',
    colorTextSecondary: '#6d7d95',
    colorBorder: '#e4eaf2',
    borderRadius: 8,
  },
}

const SEARCH_KEYS = new Set(['repositoryId', 'status', 'testsetId', 'testRunId', 'dryRunId', 'taskId', 'runTab'])
const EMPTY_TESTSETS: Testset[] = []
const EMPTY_REPOS: ProjectBoundRepository[] = []

interface TestsetFormValues {
  name: string
  repositoryId: string
  scopeTags: string
  command: string
  timeoutSeconds: number
  passExpected: number
  acceptanceNotes: string
}

/** 运行测试时「测哪一版代码」：Task 与 git ref 互斥 */
type RunTestTargetMode = 'TASK' | 'REF'

interface RunTestFormValues {
  repositoryId: string
  testsetIds: string[]
  targetMode: RunTestTargetMode
  taskId?: string
  ref?: string
}

interface DryRunFormValues {
  repositoryId: string
  sourceRef: string
  targetBranch: string
  taskId?: string
}

/** Dry-run 选任务时用来带出 sourceBranch 的最小字段 */
interface DryRunTaskOption {
  id: string
  title: string
  repositories: Array<{ repositoryId: string; sourceBranch: string }>
}

/**
 * Testset 与 Dry-run 页（分工 C §4）。
 * 列表/创建/启停/运行均走 testsetApi；历史列表接口文档没有，用本地会话记录。
 */
export function TestsetPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { message, modal } = App.useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Testset | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageRepoId, setManageRepoId] = useState<string | undefined>()
  const [manageStatus, setManageStatus] = useState<TestsetStatus | undefined>()
  const [runOpen, setRunOpen] = useState(false)
  const [dryOpen, setDryOpen] = useState(false)
  const [history, setHistory] = useState<LocalRunHistoryItem[]>(() => readRunHistory(projectId))

  useEffect(() => {
    setHistory(readRunHistory(projectId))
  }, [projectId])

  const repositoryId = searchParams.get('repositoryId')?.trim() || undefined
  const selectedTestsetId = searchParams.get('testsetId')?.trim() || undefined
  const testRunId = searchParams.get('testRunId')?.trim() || undefined
  const dryRunId = searchParams.get('dryRunId')?.trim() || undefined
  const taskId = searchParams.get('taskId')?.trim() || undefined
  const runTabParam = searchParams.get('runTab')?.trim()
  const runTab = isTestsetRunTab(runTabParam) ? runTabParam : 'overview'

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const isAdmin = project?.role === 'PROJECT_ADMIN'

  const reposQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })
  const repositories = reposQuery.data ?? EMPTY_REPOS

  const testsetsQuery = useTestsets(projectId, {})
  const testsets = testsetsQuery.data ?? EMPTY_TESTSETS
  const selected = testsets.find((item) => item.id === selectedTestsetId)

  const testRunQuery = useTestRun(projectId, testRunId)
  const dryRunQuery = useDryRunReport(projectId, dryRunId)
  const dryRunDiffsQuery = useQuery({
    queryKey: taskModelQueryKeys.diffs.list(projectId, {
      taskId: dryRunQuery.data?.taskId ?? undefined,
      limit: 50,
    }),
    queryFn: () =>
      diffsApi.list(projectId, {
        taskId: dryRunQuery.data?.taskId ?? undefined,
        limit: 50,
      }),
    enabled: Boolean(projectId && dryRunId),
  })
  const relatedDiff = useMemo(
    () => pickRelatedDiff(dryRunDiffsQuery.data?.data ?? [], dryRunQuery.data),
    [dryRunDiffsQuery.data, dryRunQuery.data],
  )

  const tasksQuery = useQuery({
    queryKey: taskModelQueryKeys.tasks.list(projectId, { limit: 20 }),
    queryFn: () => tasksApi.list(projectId, { limit: 20 }),
    enabled: Boolean(projectId),
  })
  const tasks = tasksQuery.data?.data ?? []

  const createTestset = useCreateTestset(projectId)
  const updateTestset = useUpdateTestset(projectId)
  const enableTestset = useEnableTestset(projectId)
  const disableTestset = useDisableTestset(projectId)
  const deleteTestset = useDeleteTestset(projectId)
  const createTestRun = useCreateTestRun(projectId)
  const createDryRun = useCreateDryRun(projectId)

  const grouped = useMemo(() => {
    const filtered = testsets.filter((item) => {
      if (manageRepoId && item.repositoryId !== manageRepoId) return false
      if (manageStatus && item.status !== manageStatus) return false
      return true
    })
    return groupTestsetsByRepo(filtered, repositories)
  }, [testsets, manageRepoId, manageStatus, repositories])

  const relatedTestsets = useMemo(() => {
    const ids = testRunQuery.data?.testsetIds?.length
      ? testRunQuery.data.testsetIds
      : (dryRunQuery.data?.testsetIds ?? [])
    return pickRelatedTestsets(ids, testsets)
  }, [testRunQuery.data, dryRunQuery.data, testsets])

  const defaultRepositoryId =
    testRunQuery.data?.repositoryId ??
    dryRunQuery.data?.repositoryId ??
    selected?.repositoryId ??
    repositoryId

  /** 只保留本页认识的 URL 参数并写入 */
  function updateParams(patch: Record<string, string | undefined>): void {
    const next = new URLSearchParams(searchParams)
    for (const key of Array.from(next.keys())) {
      if (!SEARCH_KEYS.has(key)) next.delete(key)
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  /** 把一次运行写入本地历史并选中到 URL */
  function rememberRun(item: LocalRunHistoryItem, kind: 'TEST_RUN' | 'DRY_RUN'): void {
    setHistory(pushRunHistory(projectId, item))
    if (kind === 'TEST_RUN') updateParams({ testRunId: item.id, dryRunId: undefined })
    else updateParams({ dryRunId: item.id, testRunId: undefined })
  }

  /** 删除本地历史项；若正打开该运行，一并清掉 URL 选中 */
  function forgetRun(item: LocalRunHistoryItem): void {
    setHistory(removeRunHistory(projectId, item.id))
    if (item.kind === 'TEST_RUN' && testRunId === item.id) {
      updateParams({ testRunId: undefined, runTab: undefined })
    }
    if (item.kind === 'DRY_RUN' && dryRunId === item.id) {
      updateParams({ dryRunId: undefined, runTab: undefined })
    }
  }

  async function handleSaveTestset(values: TestsetFormValues): Promise<void> {
    const payload = toCreatePayload(values)
    try {
      if (editing) {
        await updateTestset.mutateAsync({ testsetId: editing.id, payload })
        message.success('已更新 Testset')
      } else {
        const created = await createTestset.mutateAsync(payload)
        message.success('已创建 Testset')
        updateParams({ testsetId: created.id, repositoryId: created.repositoryId })
      }
      setFormOpen(false)
      setEditing(null)
    } catch (error) {
      message.error(formatApiError(error))
    }
  }

  async function handleToggle(item: Testset): Promise<void> {
    try {
      if (isTestsetEnabled(item)) await disableTestset.mutateAsync(item.id)
      else await enableTestset.mutateAsync(item.id)
      message.success(isTestsetEnabled(item) ? '已停用' : '已启用')
    } catch (error) {
      message.error(formatApiError(error))
    }
  }

  function handleDelete(item: Testset): void {
    modal.confirm({
      title: `删除 Testset「${item.name}」？`,
      content: '仅当未被质量门禁引用时才能删除。',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteTestset.mutateAsync(item.id)
          if (selectedTestsetId === item.id) updateParams({ testsetId: undefined })
          message.success('已删除')
        } catch (error) {
          message.error(formatApiError(error))
          throw error
        }
      },
    })
  }

  async function handleRunTest(values: RunTestFormValues): Promise<void> {
    const payload = toTestRunPayload(values)
    if (!payload) {
      message.error(values.targetMode === 'REF' ? '请填写 git ref' : '请选择任务')
      return
    }
    try {
      const run = await createTestRun.mutateAsync(payload)
      if (!run.id) {
        message.error('后端未返回 testRunId')
        return
      }
      rememberRun(
        {
          kind: 'TEST_RUN',
          id: run.id,
          repositoryId: run.repositoryId,
          createdAt: run.createdAt || new Date().toISOString(),
          label: `Test run · ${run.id.slice(0, 8)}`,
        },
        'TEST_RUN',
      )
      setRunOpen(false)
      message.success('已发起测试运行')
    } catch (error) {
      message.error(formatApiError(error))
    }
  }

  async function handleDryRun(values: DryRunFormValues): Promise<void> {
    const payload: CreateDryRunPayload = {
      repositoryId: values.repositoryId,
      sourceRef: values.sourceRef.trim(),
      targetBranch: values.targetBranch.trim(),
    }
    if (values.taskId) payload.taskId = values.taskId
    try {
      const report = await createDryRun.mutateAsync(payload)
      if (!report.id) {
        message.error('后端未返回 dryRunId')
        return
      }
      rememberRun(
        {
          kind: 'DRY_RUN',
          id: report.id,
          repositoryId: report.repositoryId,
          createdAt: report.createdAt || new Date().toISOString(),
          label: `Dry-run · ${report.sourceRef || report.id.slice(0, 8)}`,
        },
        'DRY_RUN',
      )
      setDryOpen(false)
      message.success('已发起 Dry-run')
    } catch (error) {
      message.error(formatApiError(error))
    }
  }

  if (testsetsQuery.isLoading) {
    return (
      <ConfigProvider theme={pageTheme}>
        <div className={styles.state} role="status">
          <Spin description="正在加载 Testset" />
        </div>
      </ConfigProvider>
    )
  }

  if (testsetsQuery.isError && !testsetsQuery.data) {
    const forbidden = testsetsQuery.error instanceof ApiError && testsetsQuery.error.status === 403
    return (
      <ConfigProvider theme={pageTheme}>
        <Result
          status={forbidden ? '403' : 'error'}
          title={forbidden ? '暂无权限查看 Testset' : 'Testset 加载失败'}
          subTitle={formatApiError(testsetsQuery.error)}
          extra={<Button onClick={() => void testsetsQuery.refetch()}>重新加载</Button>}
        />
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={pageTheme}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Title level={2} className={styles.title}>
              Testset
            </Title>
            <Text type="secondary">发起测试或 Dry-run；测试配方在「管理测试集」中维护</Text>
          </div>
          <Space>
            <Button onClick={() => setManageOpen(true)}>管理测试集</Button>
            <Button onClick={() => setRunOpen(true)}>运行测试</Button>
            <Button type="primary" onClick={() => setDryOpen(true)}>
              新建 Dry-run
            </Button>
          </Space>
        </header>

        <div className={`${styles.layout} ${relatedTestsets.length > 0 ? styles.layoutWithRecipes : styles.layoutRunOnly}`}>
          {relatedTestsets.length > 0 ? (
            <section>
              <div className={styles.columnTitle}>
                <Text strong>本次测试集</Text>
                <Text type="secondary">{relatedTestsets.length} 项</Text>
              </div>
              <div className={styles.cardList}>
                {relatedTestsets.map((item) => (
                  <TestsetCard
                    key={item.id}
                    item={item}
                    selected={item.id === selected?.id}
                    showActions={false}
                    onSelect={() => {
                      updateParams({ testsetId: item.id, repositoryId: item.repositoryId })
                      setManageOpen(true)
                    }}
                  />
                ))}
              </div>
              <Button type="link" className={styles.manageLink} onClick={() => setManageOpen(true)}>
                管理全部测试集
              </Button>
            </section>
          ) : null}

          <section className={styles.panel}>
            <CurrentRunPanel
              projectId={projectId}
              testRun={testRunQuery.data}
              dryRun={dryRunQuery.data}
              relatedDiff={relatedDiff}
              testRunLoading={Boolean(testRunId) && testRunQuery.isLoading}
              dryRunLoading={Boolean(dryRunId) && dryRunQuery.isLoading}
              repositories={repositories}
              testsets={testsets}
              runTab={runTab}
              onRunTabChange={(key) => updateParams({ runTab: key === 'overview' ? undefined : key })}
            />
          </section>

          <aside className={styles.panel}>
            <RunHistoryPanel
              history={history}
              onSelect={(item) => {
                if (item.kind === 'TEST_RUN') updateParams({ testRunId: item.id, dryRunId: undefined })
                else updateParams({ dryRunId: item.id, testRunId: undefined })
              }}
              onDelete={(item) => {
                forgetRun(item)
                message.success('已从历史记录移除')
              }}
            />
            <Text strong>权限</Text>
            <Paragraph className={styles.sideText}>
              项目成员可查看和发起运行；Project Admin 才能创建、修改、启用/停用和删除。
            </Paragraph>
          </aside>
        </div>

        <ManageTestsetsDrawer
          open={manageOpen}
          isAdmin={Boolean(isAdmin)}
          repositories={repositories}
          grouped={grouped}
          selectedId={selected?.id}
          repoFilter={manageRepoId}
          statusFilter={manageStatus}
          emptyHint={manageRepoId || manageStatus ? '当前筛选暂无 Testset' : '项目暂无 Testset'}
          onClose={() => setManageOpen(false)}
          onRepoFilter={setManageRepoId}
          onStatusFilter={setManageStatus}
          onCreate={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          onSelect={(item) => updateParams({ testsetId: item.id, repositoryId: item.repositoryId })}
          onEdit={(item) => {
            setEditing(item)
            setFormOpen(true)
          }}
          onToggle={(item) => void handleToggle(item)}
          onDelete={handleDelete}
        />
        <TestsetFormModal
          open={formOpen}
          editing={editing}
          repositories={repositories}
          confirmLoading={createTestset.isPending || updateTestset.isPending}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSubmit={(values) => void handleSaveTestset(values)}
        />
        <RunTestModal
          open={runOpen}
          repositories={repositories}
          testsets={testsets}
          tasks={tasks.map((task) => ({ id: task.id, title: `${task.displayCode} ${task.title}` }))}
          defaultRepositoryId={defaultRepositoryId}
          defaultTaskId={taskId}
          confirmLoading={createTestRun.isPending}
          onCancel={() => setRunOpen(false)}
          onSubmit={(values) => void handleRunTest(values)}
        />
        <DryRunModal
          open={dryOpen}
          repositories={repositories}
          tasks={tasks.map((task) => ({
            id: task.id,
            title: `${task.displayCode} ${task.title}`,
            repositories: task.repositories.map((repo) => ({
              repositoryId: repo.repositoryId,
              sourceBranch: repo.sourceBranch,
            })),
          }))}
          defaultRepositoryId={defaultRepositoryId}
          defaultTaskId={taskId}
          confirmLoading={createDryRun.isPending}
          onCancel={() => setDryOpen(false)}
          onSubmit={(values) => void handleDryRun(values)}
        />
      </div>
    </ConfigProvider>
  )
}

/** 绑定仓展示名：displayName 优先，否则 fullName */
function repoLabel(repo: ProjectBoundRepository): string {
  return repo.displayName?.trim() || repo.fullName || repo.id
}

/** 按 repositoryId 分组，方便左侧按仓库浏览 */
function groupTestsetsByRepo(
  items: Testset[],
  repositories: ProjectBoundRepository[],
): Array<{ repositoryId: string; label: string; items: Testset[] }> {
  const labels = new Map(repositories.map((repo) => [repo.id, repoLabel(repo)]))
  const groups = new Map<string, Testset[]>()
  for (const item of items) {
    const list = groups.get(item.repositoryId) ?? []
    list.push(item)
    groups.set(item.repositoryId, list)
  }
  return [...groups.entries()].map(([repositoryId, groupedItems]) => ({
    repositoryId,
    label: labels.get(repositoryId) || repositoryId,
    items: groupedItems,
  }))
}

/** 按运行返回的 testsetIds 顺序挑出本次配方，其它卡片不出现在运行页 */
function pickRelatedTestsets(ids: string[], items: Testset[]): Testset[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return ids.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
}

/** 表单值转创建/修改请求体（scopeTags 用逗号分隔输入） */
function toCreatePayload(values: TestsetFormValues): CreateTestsetPayload {
  return {
    name: values.name.trim(),
    repositoryId: values.repositoryId,
    scopeTags: values.scopeTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    command: values.command.trim(),
    timeoutSeconds: values.timeoutSeconds,
    passRule: { type: 'EXIT_CODE', expected: values.passExpected },
    acceptanceNotes: values.acceptanceNotes?.trim() ?? '',
  }
}

/** 按当前 Radio 模式只带 taskId 或 ref，避免两种都传 */
function toTestRunPayload(values: RunTestFormValues): CreateTestRunPayload | null {
  const payload: CreateTestRunPayload = {
    repositoryId: values.repositoryId,
    testsetIds: values.testsetIds,
  }
  if (values.targetMode === 'REF') {
    const ref = values.ref?.trim()
    if (!ref) return null
    payload.ref = ref
    return payload
  }
  const taskId = values.taskId?.trim()
  if (!taskId) return null
  payload.taskId = taskId
  return payload
}

/** 单张 Testset 卡片：管理抽屉里带 Admin 操作，运行页只展示本次用到的配方 */
function TestsetCard({
  item,
  selected,
  showActions,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: Testset
  selected: boolean
  showActions: boolean
  onSelect?: () => void
  onEdit?: () => void
  onToggle?: () => void
  onDelete?: () => void
}) {
  const enabled = isTestsetEnabled(item)
  return (
    <Card
      className={`${styles.testsetCard} ${selected ? styles.testsetCardSelected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.cardHeading}>
        <div>
          <Text strong>{item.name}</Text>
          <div>
            {item.scopeTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>
        <Tag color={enabled ? 'success' : 'default'}>{testsetStatusLabel(item.status)}</Tag>
      </div>
      <div className={styles.meta}>
        <span>命令 {item.command || '—'}</span>
        <span>超时 {item.timeoutSeconds}s</span>
        <span>更新 {item.updatedAt ? item.updatedAt.slice(0, 10) : '—'}</span>
        <span>通过规则 EXIT_CODE={item.passRule.expected}</span>
      </div>
      {showActions && onEdit && onToggle && onDelete ? (
        <Space className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
          <Button size="small" onClick={onEdit}>
            修改
          </Button>
          <Button size="small" aria-label={enabled ? '停用 Testset' : '启用 Testset'} onClick={onToggle}>
            {enabled ? '停用' : '启用'}
          </Button>
          <Button size="small" danger onClick={onDelete}>
            删除
          </Button>
        </Space>
      ) : null}
    </Card>
  )
}

function ManageTestsetsDrawer({
  open,
  isAdmin,
  repositories,
  grouped,
  selectedId,
  repoFilter,
  statusFilter,
  emptyHint,
  onClose,
  onRepoFilter,
  onStatusFilter,
  onCreate,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
}: {
  open: boolean
  isAdmin: boolean
  repositories: ProjectBoundRepository[]
  grouped: Array<{ repositoryId: string; label: string; items: Testset[] }>
  selectedId: string | undefined
  repoFilter: string | undefined
  statusFilter: TestsetStatus | undefined
  emptyHint: string
  onClose: () => void
  onRepoFilter: (value: string | undefined) => void
  onStatusFilter: (value: TestsetStatus | undefined) => void
  onCreate: () => void
  onSelect: (item: Testset) => void
  onEdit: (item: Testset) => void
  onToggle: (item: Testset) => void
  onDelete: (item: Testset) => void
}) {
  const total = grouped.reduce((sum, group) => sum + group.items.length, 0)
  return (
    <Drawer
      title="管理测试集"
      placement="right"
      size={520}
      open={open}
      onClose={onClose}
      destroyOnHidden
      extra={
        isAdmin ? (
          <Button type="primary" onClick={onCreate}>
            新建 Testset
          </Button>
        ) : null
      }
    >
      <div className={styles.filters}>
        <Select
          className={styles.filterControl}
          value={repoFilter ?? 'ALL'}
          options={[
            { value: 'ALL', label: '全部仓库' },
            ...repositories.map((repo) => ({
              value: repo.id,
              label: repoLabel(repo),
            })),
          ]}
          onChange={(value) => onRepoFilter(value === 'ALL' ? undefined : value)}
        />
        <Select
          className={styles.filterControl}
          value={statusFilter ?? 'ALL'}
          options={[
            { value: 'ALL', label: '全部状态' },
            { value: 'ENABLED', label: '已启用' },
            { value: 'DISABLED', label: '已停用' },
          ]}
          onChange={(value) =>
            onStatusFilter(value === 'ENABLED' || value === 'DISABLED' ? value : undefined)
          }
        />
      </div>
      <div className={styles.columnTitle}>
        <Text strong>项目测试集（按仓库）</Text>
        <Text type="secondary">{total} 项</Text>
      </div>
      {total === 0 ? (
        <Empty description={emptyHint} />
      ) : (
        <div className={styles.cardList}>
          {grouped.map((group) => (
            <div key={group.repositoryId}>
              <Text type="secondary">{group.label}</Text>
              {group.items.map((item) => (
                <TestsetCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  showActions={isAdmin}
                  onSelect={() => onSelect(item)}
                  onEdit={() => onEdit(item)}
                  onToggle={() => onToggle(item)}
                  onDelete={() => onDelete(item)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}

/** 当前 Test run / Dry-run 结果、冲突、报告 */
function CurrentRunPanel({
  projectId,
  testRun,
  dryRun,
  relatedDiff,
  testRunLoading,
  dryRunLoading,
  repositories,
  testsets,
  runTab,
  onRunTabChange,
}: {
  projectId: string
  testRun: ReturnType<typeof useTestRun>['data']
  dryRun: ReturnType<typeof useDryRunReport>['data']
  relatedDiff: DiffListItem | undefined
  testRunLoading: boolean
  dryRunLoading: boolean
  repositories: ProjectBoundRepository[]
  testsets: Testset[]
  runTab: string
  onRunTabChange: (key: string) => void
}) {
  if (testRunLoading || dryRunLoading) {
    return (
      <div className={styles.state} role="status">
        <Spin description="正在加载运行结果" />
      </div>
    )
  }

  const summary = dryRun?.caseSummary ?? testRun?.caseSummary
  const cases = dryRun?.cases ?? testRun?.cases ?? []
  const passRate =
    summary && summary.total > 0 ? `${((summary.passed / summary.total) * 100).toFixed(1)}%` : '—'
  const runKind = dryRun ? 'dry-run' : testRun ? 'test-run' : null
  const activeRun = dryRun ?? testRun
  const duration = activeRun
    ? resolveDurationSeconds(
        activeRun.startedAt,
        activeRun.finishedAt,
        dryRun?.durationSeconds ?? null,
      )
    : null

  const dryConflict = dryRun ? dryRunHasMergeConflict(dryRun) : false
  const dryStatusForTag = dryConflict ? 'CONFLICT' : dryRun?.status
  const executionSummary: TestRunExecutionSummary | null = testRun?.executionSummary ?? null
  const dryTests = dryRun?.report?.tests ?? null
  const dryExecutionSummary =
    dryTests && !isDryRunTestsSkipped(dryTests) ? dryTests : null
  const resultRows: TestRunResultItem[] =
    dryExecutionSummary?.results ?? executionSummary?.results ?? []
  const resolvedCommit =
    dryRun?.report?.targetCommit ??
    dryExecutionSummary?.resolvedHeadCommit ??
    executionSummary?.resolvedHeadCommit ??
    null

  const tabItems = [
    {
      key: 'overview',
      label: '结果总览',
      children: (
        <>
          {activeRun ? (
            <RunOverviewMeta
              startedAt={activeRun.startedAt}
              finishedAt={activeRun.finishedAt}
              durationSeconds={duration}
              sandboxId={activeRun.sandboxId}
              repositoryLabel={resolveRepoName(activeRun.repositoryId, repositories)}
              testsetLabel={resolveTestsetNames(
                dryRun?.testsetIds?.length ? dryRun.testsetIds : (testRun?.testsetIds ?? []),
                testsets,
              )}
            />
          ) : null}
          <Descriptions size="small" column={3} className={styles.contextTable}>
            {dryRun ? (
              <>
                <Descriptions.Item label="状态">
                  <Tag color={runStatusColor(dryStatusForTag ?? dryRun.status)}>
                    {dryConflict
                      ? '冲突'
                      : dryRunStatusLabel(dryRun.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="源">{dryRun.sourceRef || '—'}</Descriptions.Item>
                <Descriptions.Item label="目标分支">{dryRun.targetBranch || '—'}</Descriptions.Item>
                <Descriptions.Item label="目标提交">
                  {dryRun.report?.targetCommit ? (
                    <Text code>{dryRun.report.targetCommit.slice(0, 12)}</Text>
                  ) : (
                    '—'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="可合并">
                  {dryRun.report?.mergeable == null
                    ? '—'
                    : dryRun.report.mergeable
                      ? '是'
                      : '否（冲突）'}
                </Descriptions.Item>
                <Descriptions.Item label="报告失败码">
                  {dryRun.report?.failureCode || '—'}
                </Descriptions.Item>
              </>
            ) : testRun ? (
              <>
                <Descriptions.Item label="状态">
                  <Tag color={runStatusColor(testRun.status)}>{testRunStatusLabel(testRun.status)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="ref">{testRun.ref || '—'}</Descriptions.Item>
                <Descriptions.Item label="Task">{testRun.taskId || '—'}</Descriptions.Item>
                <Descriptions.Item label="执行提交" span={2}>
                  {resolvedCommit ? <Text code>{resolvedCommit.slice(0, 12)}</Text> : '—'}
                </Descriptions.Item>
              </>
            ) : null}
          </Descriptions>

          {dryConflict ? (
            <Alert
              type="warning"
              showIcon
              className={styles.alert}
              message="合并冲突（不是测试失败）"
              description="源提交合入目标分支时无法自动合并。冲突未解决前不会执行门禁 Testset；请勿将状态理解为用例未通过。"
            />
          ) : null}

          {dryTests && isDryRunTestsSkipped(dryTests) ? (
            <Alert
              type="info"
              showIcon
              className={styles.alert}
              message={
                dryTests.status === 'NOT_REQUIRED'
                  ? '本目标分支未配置必选 Testset'
                  : '因合并冲突跳过测试'
              }
              description={
                dryTests.status === 'NOT_REQUIRED'
                  ? 'NOT_REQUIRED 仅表示该目标分支没有必选 Testset，不等于整个项目无需质量门禁。'
                  : 'tests.status=SKIPPED 且 reason=MERGE_CONFLICT：测试未执行，不得视为通过。'
              }
            />
          ) : null}

          {resultRows.length > 0 ? (
            <TestsetResultsTable results={resultRows} testsets={testsets} />
          ) : !dryConflict && !(dryTests && isDryRunTestsSkipped(dryTests)) ? (
            <Text type="secondary">
              暂无按 Testset 的执行摘要（summary.results）。排队/运行中时可能仍为空；本轮也不提供
              caseSummary 用例计数。
            </Text>
          ) : null}

          {summary ? (
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>通过率</span>
                <span className={styles.metricValue}>{passRate}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>通过</span>
                <span className={styles.metricValue}>{summary.passed}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>失败</span>
                <span className={`${styles.metricValue} ${summary.failed > 0 ? styles.metricFail : ''}`}>
                  {summary.failed}
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>总计</span>
                <span className={styles.metricValue}>{summary.total}</span>
              </div>
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: 'cases',
      label: '用例详情',
      children: <CaseDetailsPanel cases={cases} testsets={testsets} />,
    },
    ...(dryRun
      ? [
          {
            key: 'conflicts',
            label: '冲突结果',
            children: (
              <DryRunConflictsPanel
                projectId={projectId}
                dryRun={dryRun}
                relatedDiff={relatedDiff}
              />
            ),
          },
        ]
      : []),
    {
      key: 'report',
      label: '测试报告',
      children: (
        <RunReportPanel
          kind={dryRun ? 'dry-run' : 'test-run'}
          reportUrl={dryRun?.reportUrl ?? testRun?.reportUrl ?? null}
          pdfUrl={dryRun?.pdfUrl ?? testRun?.pdfUrl ?? null}
          artifacts={testRun?.artifacts ?? []}
        />
      ),
    },
  ]

  return (
    <>
      <div className={styles.columnTitle}>
        <div className={styles.runTitle}>
          <Text strong>当前运行</Text>
          {runKind ? <Tag>{runKind}</Tag> : null}
        </div>
      </div>
      {!testRun && !dryRun ? (
        <Empty description="尚未发起或选择运行。用右上角发起测试 / Dry-run；测试配方请到「管理测试集」。" />
      ) : (
        <Tabs
          activeKey={tabItems.some((item) => item.key === runTab) ? runTab : 'overview'}
          onChange={onRunTabChange}
          items={tabItems}
        />
      )}
    </>
  )
}

function DryRunConflictsPanel({
  projectId,
  dryRun,
  relatedDiff,
}: {
  projectId: string
  dryRun: DryRunReport
  relatedDiff: DiffListItem | undefined
}) {
  const reviewTo = relatedDiff
    ? PATHS.projectCodeDiff(projectId, relatedDiff.id)
    : null

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Text type="secondary">
        这里是试合并 {dryRun.sourceRef} → {dryRun.targetBranch} 时后端返回的 Git 冲突，不是手工填写项。
      </Text>
      {reviewTo ? <Link to={reviewTo}>打开关联 Diff</Link> : <Text type="secondary">暂无匹配的 Diff 评审</Text>}
      {dryRun.conflicts.length === 0 ? (
        <Empty description="暂无冲突明细。若状态为冲突但此处为空，请看结果总览的 mergeable / tests 说明。" />
      ) : (
        <Table
          size="small"
          pagination={false}
          rowKey={(row) => `${row.path}-${row.message}`}
          dataSource={dryRun.conflicts}
          columns={[
            { title: '路径', dataIndex: 'path', ellipsis: true },
            { title: '说明', dataIndex: 'message', ellipsis: true, render: (value: string) => value || '—' },
            {
              title: 'Diff',
              key: 'diff',
              width: 120,
              render: (_: unknown, row: { path: string; message: string }) =>
                reviewTo ? (
                  <Link to={`${reviewTo}?file=${encodeURIComponent(row.path)}`}>查看该文件</Link>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      )}
    </Space>
  )
}

/** 优先用 dry-run 的 taskId 对 Diff；否则用同一仓库 + 源分支 */
function pickRelatedDiff(diffs: DiffListItem[], dryRun: DryRunReport | undefined): DiffListItem | undefined {
  if (!dryRun || diffs.length === 0) return undefined
  const byTask = dryRun.taskId ? diffs.find((item) => item.taskId === dryRun.taskId) : undefined
  if (byTask) return byTask
  return diffs.find(
    (item) => item.repositoryId === dryRun.repositoryId && item.sourceBranch === dryRun.sourceRef,
  )
}

function CaseDetailsPanel({
  cases,
  testsets,
}: {
  cases: TestCaseDetail[]
  testsets: Testset[]
}) {
  if (cases.length === 0) {
    return (
      <Empty
        description="本轮不提供逐条用例结果（cases[]）。用例详情保持空表，不要把缺失当 Bug。"
      />
    )
  }

  return (
    <Table
      size="small"
      pagination={false}
      rowKey="id"
      dataSource={cases}
      columns={[
        { title: '用例', dataIndex: 'name', ellipsis: true },
        {
          title: '测试集',
          dataIndex: 'testsetId',
          width: 140,
          render: (id: string | null) => (id ? testsets.find((item) => item.id === id)?.name || id : '—'),
        },
        { title: '套件', dataIndex: 'suite', width: 140, render: (value: string | null) => value || '—' },
        {
          title: '状态',
          dataIndex: 'status',
          width: 88,
          render: (status: TestCaseDetail['status']) => (
            <Tag color={caseStatusColor(status)}>{caseStatusLabel(status)}</Tag>
          ),
        },
        {
          title: '耗时',
          dataIndex: 'durationMs',
          width: 100,
          render: (value: number | null) => formatDurationMs(value),
        },
        { title: '说明', dataIndex: 'message', ellipsis: true, render: (value: string | null) => value || '—' },
        { title: '文件', dataIndex: 'filePath', ellipsis: true, render: (value: string | null) => value || '—' },
      ]}
    />
  )
}

function TestsetResultsTable({
  results,
  testsets,
}: {
  results: TestRunResultItem[]
  testsets: Testset[]
}) {
  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(row) => `${row.testsetId}-${row.status}-${row.exitCode ?? 'x'}`}
      dataSource={results}
      style={{ marginTop: 12 }}
      columns={[
        {
          title: 'Testset',
          dataIndex: 'testsetId',
          render: (id: string) => testsets.find((item) => item.id === id)?.name || id,
        },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (status: TestRunResultItem['status']) => (
            <Tag color={runStatusColor(status)}>{testRunStatusLabel(status)}</Tag>
          ),
        },
        {
          title: 'exitCode',
          dataIndex: 'exitCode',
          width: 96,
          render: (value: number | null) => (value == null ? '—' : value),
        },
        {
          title: 'failureCode',
          dataIndex: 'failureCode',
          width: 180,
          ellipsis: true,
          render: (value: string | null) => value || '—',
        },
        {
          title: '耗时',
          dataIndex: 'durationMs',
          width: 100,
          render: (value: number | null) => formatDurationMs(value),
        },
      ]}
    />
  )
}

function RunReportPanel({
  kind,
  reportUrl,
  pdfUrl,
  artifacts,
}: {
  kind: 'test-run' | 'dry-run'
  reportUrl: string | null
  pdfUrl: string | null
  artifacts: TestRunArtifactRef[]
}) {
  const hasAnything = Boolean(reportUrl || pdfUrl || artifacts.length > 0)
  if (!hasAnything) {
    return (
      <Empty
        description={
          <span>
            {kind === 'test-run'
              ? '本轮不提供测试报告产物（reportUrl / pdfUrl）。执行摘要见「结果总览」。'
              : '本轮不提供 Dry-run 报告产物 URL。冲突与门禁 Testset 摘要见「结果总览」。'}
          </span>
        }
      />
    )
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        {reportUrl ? (
          <Button href={reportUrl} target="_blank" rel="noreferrer">
            打开报告
          </Button>
        ) : null}
        {pdfUrl ? (
          <Button type="primary" href={pdfUrl} target="_blank" rel="noreferrer">
            下载 PDF
          </Button>
        ) : (
          <Text type="secondary">PDF 尚未生成（本轮不提供 pdfUrl）</Text>
        )}
      </Space>
      {artifacts.length > 0 ? (
        <Table
          size="small"
          pagination={false}
          rowKey={(row) => row.url}
          dataSource={artifacts}
          columns={[
            { title: '产物', dataIndex: 'name' },
            { title: '类型', dataIndex: 'contentType', render: (value: string | null) => value || '—' },
            {
              title: '链接',
              dataIndex: 'url',
              render: (url: string) => (
                <Button type="link" href={url} target="_blank" rel="noreferrer">
                  打开
                </Button>
              ),
            },
          ]}
        />
      ) : null}
    </Space>
  )
}

function RunOverviewMeta({
  startedAt,
  finishedAt,
  durationSeconds,
  sandboxId,
  repositoryLabel,
  testsetLabel,
}: {
  startedAt: string | null
  finishedAt: string | null
  durationSeconds: number | null
  sandboxId: string | null
  repositoryLabel: string
  testsetLabel: string
}) {
  return (
    <div className={styles.metaGrid}>
      <MetaCell label="开始时间" value={formatDateTime(startedAt)} />
      <MetaCell label="结束时间" value={formatDateTime(finishedAt)} />
      <MetaCell label="运行时长" value={formatDuration(durationSeconds)} />
      <MetaCell label="Sandbox" value={sandboxId || '本轮不提供'} copyable={Boolean(sandboxId)} />
      <MetaCell label="当前仓库" value={repositoryLabel} />
      <MetaCell label="当前测试集" value={testsetLabel} />
    </div>
  )
}

function MetaCell({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <div className={styles.metaCell}>
      <span className={styles.metaLabel}>{label}</span>
      {copyable ? (
        <Text className={styles.metaHighlight} copyable>
          {value}
        </Text>
      ) : (
        <span className={styles.metaHighlight}>{value}</span>
      )}
    </div>
  )
}

function RunHistoryPanel({
  history,
  onSelect,
  onDelete,
}: {
  history: LocalRunHistoryItem[]
  onSelect: (item: LocalRunHistoryItem) => void
  onDelete: (item: LocalRunHistoryItem) => void
}) {
  return (
    <div className={styles.historyPanel}>
      <Text strong>本设备最近运行</Text>
      <Text type="secondary" className={styles.historyHint}>
        仅保存在本浏览器，不是跨设备权威历史。
      </Text>
      {history.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="本页发起的运行记在本设备。服务端历史列表本轮不做。"
        />
      ) : (
        <div className={styles.historyList}>
          {history.map((item) => (
            <div key={item.id} className={styles.historyItem}>
              <button
                type="button"
                className={styles.historyHit}
                onClick={() => onSelect(item)}
                aria-label={`open-run-${item.id}`}
              >
                <div className={styles.historyHeading}>
                  <Tag>{item.kind === 'DRY_RUN' ? 'dry-run' : 'test-run'}</Tag>
                  <Text ellipsis>{item.label}</Text>
                </div>
                <span className={styles.historyTime}>{formatDateTime(item.createdAt)}</span>
              </button>
              <Button
                type="text"
                size="small"
                danger
                className={styles.historyDelete}
                icon={<DeleteOutlined />}
                aria-label={`delete-run-${item.id}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(item)
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function resolveRepoName(repositoryId: string, repositories: ProjectBoundRepository[]): string {
  const match = repositories.find((repo) => repo.id === repositoryId)
  return match ? repoLabel(match) : repositoryId || '—'
}

function resolveTestsetNames(ids: string[], testsets: Testset[]): string {
  if (ids.length === 0) return '—'
  return ids.map((id) => testsets.find((item) => item.id === id)?.name || id).join('、')
}

/** 创建或修改 Testset 配置（不含 status，启停走独立接口） */
function TestsetFormModal({
  open,
  editing,
  repositories,
  confirmLoading,
  onCancel,
  onSubmit,
}: {
  open: boolean
  editing: Testset | null
  repositories: ProjectBoundRepository[]
  confirmLoading: boolean
  onCancel: () => void
  onSubmit: (values: TestsetFormValues) => void
}) {
  return (
    <Modal
      title={editing ? '修改 Testset' : '新建 Testset'}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      zIndex={1100}
    >
      <Form<TestsetFormValues>
        layout="vertical"
        initialValues={
          editing
            ? {
                name: editing.name,
                repositoryId: editing.repositoryId,
                scopeTags: editing.scopeTags.join(', '),
                command: editing.command,
                timeoutSeconds: editing.timeoutSeconds,
                passExpected: editing.passRule.expected,
                acceptanceNotes: editing.acceptanceNotes,
              }
            : { timeoutSeconds: 900, passExpected: 0, scopeTags: '', acceptanceNotes: '' }
        }
        onFinish={onSubmit}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="repositoryId" label="关联仓库" rules={[{ required: true, message: '请选择仓库' }]}>
          <Select options={repositories.map((repo) => ({ value: repo.id, label: repoLabel(repo) }))} />
        </Form.Item>
        <Form.Item name="command" label="命令" rules={[{ required: true, message: '请输入命令' }]}>
          <Input placeholder="./mvnw test" />
        </Form.Item>
        <Form.Item name="timeoutSeconds" label="超时（秒）" rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="passExpected" label="通过规则 EXIT_CODE">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="scopeTags" label="范围标签">
          <Input placeholder="backend, unit" />
        </Form.Item>
        <Form.Item name="acceptanceNotes" label="验收说明">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={confirmLoading}>
              保存
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** 发起受控测试运行：仓库 + ENABLED testsetIds + taskId/ref */
function RunTestModal({
  open,
  repositories,
  testsets,
  tasks,
  defaultRepositoryId,
  defaultTaskId,
  confirmLoading,
  onCancel,
  onSubmit,
}: {
  open: boolean
  repositories: ProjectBoundRepository[]
  testsets: Testset[]
  tasks: Array<{ id: string; title: string }>
  defaultRepositoryId?: string
  defaultTaskId?: string
  confirmLoading: boolean
  onCancel: () => void
  onSubmit: (values: RunTestFormValues) => void
}) {
  const [form] = Form.useForm<RunTestFormValues>()
  const enabled = testsets.filter(isTestsetEnabled)
  const defaultMode: RunTestTargetMode = 'TASK'

  /** 切换 Task / ref 时清掉隐藏项，保证请求里只有一种 */
  function handleTargetModeChange(mode: RunTestTargetMode): void {
    if (mode === 'TASK') form.setFieldValue('ref', undefined)
    else form.setFieldValue('taskId', undefined)
  }

  return (
    <Modal title="运行测试" open={open} onCancel={onCancel} footer={null} destroyOnHidden>
      <Alert
        className={styles.alert}
        type="info"
        showIcon
        title="必须指定仓库，并提供 taskId 或 git ref 之一；testsetIds 必须属于该仓库且为 ENABLED。"
      />
      <Form<RunTestFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          repositoryId: defaultRepositoryId,
          testsetIds: enabled.filter((item) => item.repositoryId === defaultRepositoryId).map((item) => item.id),
          targetMode: defaultMode,
          taskId: defaultTaskId,
        }}
        onFinish={onSubmit}
      >
        <Form.Item name="repositoryId" label="仓库" rules={[{ required: true }]}>
          <Select options={repositories.map((repo) => ({ value: repo.id, label: repoLabel(repo) }))} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.repositoryId !== next.repositoryId}>
          {({ getFieldValue }) => {
            const repoId = getFieldValue('repositoryId') as string | undefined
            const options = enabled
              .filter((item) => item.repositoryId === repoId)
              .map((item) => ({ value: item.id, label: item.name }))
            return (
              <Form.Item name="testsetIds" label="Testset" rules={[{ required: true, message: '请选择已启用的 Testset' }]}>
                <Select mode="multiple" options={options} />
              </Form.Item>
            )
          }}
        </Form.Item>
        <Form.Item
          name="targetMode"
          label="测哪一版代码"
          rules={[{ required: true, message: '请选择 Task 或 git ref' }]}
        >
          <Radio.Group
            onChange={(event) => handleTargetModeChange(event.target.value as RunTestTargetMode)}
          >
            <Radio value="TASK">使用已有代码任务 Task</Radio>
            <Radio value="REF">git ref</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.targetMode !== next.targetMode}>
          {({ getFieldValue }) =>
            getFieldValue('targetMode') === 'REF' ? (
              <Form.Item name="ref" label="git ref" rules={[{ required: true, message: '请填写分支或 commit' }]}>
                <Input placeholder="feat/login-api 或 commit SHA" />
              </Form.Item>
            ) : (
              <Form.Item name="taskId" label="关联 Task" rules={[{ required: true, message: '请选择任务' }]}>
                <Select options={tasks.map((task) => ({ value: task.id, label: task.title }))} />
              </Form.Item>
            )
          }
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={confirmLoading}>
              开始运行
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** 从任务在该仓上登记的 sourceBranch 带出 Dry-run 源分支；请求里仍要传 sourceRef */
function sourceRefFromTask(
  tasks: DryRunTaskOption[],
  taskId: string | undefined,
  repo: ProjectBoundRepository | undefined,
): string {
  if (!taskId || !repo) return ''
  const task = tasks.find((item) => item.id === taskId)
  const row = task?.repositories.find(
    (item) => item.repositoryId === repo.id || item.repositoryId === repo.repositoryId,
  )
  return row?.sourceBranch.trim() ?? ''
}

/** 发起 Dry-run：仓库 + sourceRef + targetBranch；选任务时自动填 sourceRef */
function DryRunModal({
  open,
  repositories,
  tasks,
  defaultRepositoryId,
  defaultTaskId,
  confirmLoading,
  onCancel,
  onSubmit,
}: {
  open: boolean
  repositories: ProjectBoundRepository[]
  tasks: DryRunTaskOption[]
  defaultRepositoryId?: string
  defaultTaskId?: string
  confirmLoading: boolean
  onCancel: () => void
  onSubmit: (values: DryRunFormValues) => void
}) {
  const [form] = Form.useForm<DryRunFormValues>()
  const defaultRepo = repositories.find((repo) => repo.id === defaultRepositoryId) ?? repositories[0]
  const initialSourceRef = sourceRefFromTask(tasks, defaultTaskId, defaultRepo)

  /** 换仓库或选任务时，用任务已登记的开发分支填 sourceRef；目标分支跟仓库默认分支 */
  function syncRefsFromTask(repositoryId: string | undefined, taskId: string | undefined): void {
    const repo = repositories.find((item) => item.id === repositoryId)
    const sourceRef = sourceRefFromTask(tasks, taskId, repo)
    if (sourceRef) form.setFieldValue('sourceRef', sourceRef)
    if (repo?.defaultBranch) form.setFieldValue('targetBranch', repo.defaultBranch)
  }

  return (
    <Modal title="新建 Dry-run" open={open} onCancel={onCancel} footer={null} destroyOnHidden>
      <Form<DryRunFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          repositoryId: defaultRepo?.id,
          sourceRef: initialSourceRef,
          targetBranch: defaultRepo?.defaultBranch || '',
          taskId: defaultTaskId,
        }}
        onValuesChange={(changed, all) => {
          if ('taskId' in changed || 'repositoryId' in changed) {
            syncRefsFromTask(all.repositoryId, all.taskId)
          }
        }}
        onFinish={onSubmit}
      >
        <Form.Item name="repositoryId" label="仓库" rules={[{ required: true }]}>
          <Select options={repositories.map((repo) => ({ value: repo.id, label: repoLabel(repo) }))} />
        </Form.Item>
        <Form.Item name="taskId" label="关联 Task（可选，选后自动带出源分支）">
          <Select allowClear options={tasks.map((task) => ({ value: task.id, label: task.title }))} />
        </Form.Item>
        <Form.Item
          name="sourceRef"
          label="源分支 / ref"
          extra="选任务后会填入该任务在此仓库的开发分支，提交时仍携带 sourceRef。"
          rules={[{ required: true, message: '请填写源分支' }]}
        >
          <Input placeholder="feat/login-api" />
        </Form.Item>
        <Form.Item name="targetBranch" label="目标分支" rules={[{ required: true }]}>
          <Input placeholder="main" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={confirmLoading}>
              发起 Dry-run
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
