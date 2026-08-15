import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Testset } from '@/types/testset'
import { diffsApi, projectApi } from '@/api'
import { tasksApi } from '@/api/taskModel'
import { TestsetPage } from './TestsetPage'

const useTestsetsMock = vi.hoisted(() => vi.fn())
const useTestRunMock = vi.hoisted(() => vi.fn())
const useDryRunReportMock = vi.hoisted(() => vi.fn())
const useCreateTestsetMock = vi.hoisted(() => vi.fn())
const useUpdateTestsetMock = vi.hoisted(() => vi.fn())
const useEnableTestsetMock = vi.hoisted(() => vi.fn())
const useDisableTestsetMock = vi.hoisted(() => vi.fn())
const useDeleteTestsetMock = vi.hoisted(() => vi.fn())
const useCreateTestRunMock = vi.hoisted(() => vi.fn())
const useCreateDryRunMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/testset', () => ({
  useTestsets: useTestsetsMock,
  useTestRun: useTestRunMock,
  useDryRunReport: useDryRunReportMock,
  useCreateTestset: useCreateTestsetMock,
  useUpdateTestset: useUpdateTestsetMock,
  useEnableTestset: useEnableTestsetMock,
  useDisableTestset: useDisableTestsetMock,
  useDeleteTestset: useDeleteTestsetMock,
  useCreateTestRun: useCreateTestRunMock,
  useCreateDryRun: useCreateDryRunMock,
}))

vi.mock('@/api', () => ({
  githubApi: {
    listProjectRepositories: vi.fn(async () => [
      {
        id: 'bound-demo-auth-service',
        repositoryId: 'repo-2',
        installationId: 'install-1',
        providerRepositoryId: 1,
        fullName: 'mock/auth-service',
        githubUrl: 'https://github.com/mock/auth-service',
        displayName: 'auth-service',
        defaultBranch: 'main',
        authorizationStatus: 'AUTHORIZED',
        metadataSyncedAt: '2026-08-15T00:00:00Z',
        boundAt: '2026-08-15T00:00:00Z',
      },
    ]),
  },
  projectApi: {
    getById: vi.fn(async () => ({
      id: 'demo-project',
      teamId: 'team-owned-001',
      name: 'Demo Project',
      role: 'PROJECT_ADMIN',
    })),
  },
  diffsApi: {
    list: vi.fn(async () => ({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })),
  },
}))

vi.mock('@/api/taskModel', () => ({
  tasksApi: {
    list: vi.fn(async () => ({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })),
  },
}))

const testset: Testset = {
  id: 'testset-demo-project-login',
  projectId: 'demo-project',
  name: '登录接口测试',
  repositoryId: 'bound-demo-auth-service',
  scopeTags: ['api'],
  command: './mvnw test',
  timeoutSeconds: 900,
  passRule: { type: 'EXIT_CODE', expected: 0 },
  acceptanceNotes: 'cover login',
  status: 'ENABLED',
  createdAt: '2026-08-15T02:00:00Z',
  updatedAt: '2026-08-15T02:00:00Z',
}

const otherTestset: Testset = {
  ...testset,
  id: 'testset-demo-project-pay',
  name: '支付接口测试',
  scopeTags: ['pay'],
}

function idleMutation() {
  return { mutateAsync: vi.fn(), isPending: false, error: null }
}

function renderPage(path = '/app/projects/demo-project/testset') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/testset" element={<TestsetPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useTestsetsMock.mockReturnValue({ data: [testset], isLoading: false, isError: false, error: null, refetch: vi.fn() })
  useTestRunMock.mockReturnValue({ data: undefined, isLoading: false })
  useDryRunReportMock.mockReturnValue({ data: undefined, isLoading: false })
  useCreateTestsetMock.mockReturnValue(idleMutation())
  useUpdateTestsetMock.mockReturnValue(idleMutation())
  useEnableTestsetMock.mockReturnValue(idleMutation())
  useDisableTestsetMock.mockReturnValue(idleMutation())
  useDeleteTestsetMock.mockReturnValue(idleMutation())
  useCreateTestRunMock.mockReturnValue(idleMutation())
  useCreateDryRunMock.mockReturnValue(idleMutation())
  vi.mocked(tasksApi.list).mockResolvedValue({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })
  vi.mocked(projectApi.getById).mockResolvedValue({
    id: 'demo-project',
    teamId: 'team-owned-001',
    name: 'Demo Project',
    role: 'PROJECT_ADMIN',
  })
  vi.mocked(diffsApi.list).mockResolvedValue({ data: [], page: { nextCursor: null, hasMore: false }, requestId: 'req' })
})

describe('TestsetPage', () => {
  it('keeps the recipe catalog in 管理测试集 and does not list it on the run page', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Testset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '管理测试集' })).toBeInTheDocument()
    expect(screen.queryByText('登录接口测试')).not.toBeInTheDocument()
    expect(screen.queryByText('新建 Testset')).not.toBeInTheDocument()
    expect(useTestsetsMock).toHaveBeenCalledWith('demo-project', {})
  })

  it('opens the manage drawer with status-based testset cards', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Testset' })
    await user.click(screen.getByRole('button', { name: '管理测试集' }))
    expect(await screen.findByText('登录接口测试')).toBeInTheDocument()
    expect(screen.getByText('已启用')).toBeInTheDocument()
    expect(screen.getByText('全部仓库')).toBeInTheDocument()
    expect(screen.getByText('全部状态')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建 Testset' })).toBeInTheDocument()
    expect(screen.queryByText('enabled')).not.toBeInTheDocument()
  })

  it('hides Testset write actions for PROJECT_MEMBER', async () => {
    vi.mocked(projectApi.getById).mockResolvedValue({
      id: 'demo-project',
      teamId: 'team-owned-001',
      name: 'Demo Project',
      role: 'PROJECT_MEMBER',
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Testset' })
    expect(screen.getByRole('button', { name: '运行测试' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建 Dry-run' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '管理测试集' }))
    expect(await screen.findByText('登录接口测试')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '新建 Testset' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停用 Testset' })).not.toBeInTheDocument()
  })

  it('switches run-test target between Task and git ref', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Testset' })
    await user.click(screen.getByRole('button', { name: '运行测试' }))
    expect(await screen.findByRole('radio', { name: '使用已有代码任务 Task' })).toBeChecked()
    expect(screen.getByLabelText('关联 Task')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('feat/login-api 或 commit SHA')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'git ref' }))
    expect(await screen.findByPlaceholderText('feat/login-api 或 commit SHA')).toBeInTheDocument()
    expect(screen.queryByLabelText('关联 Task')).not.toBeInTheDocument()
  })

  it('opens the dry-run dialog from the documented action', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Testset' })
    await user.click(screen.getByRole('button', { name: '新建 Dry-run' }))
    expect(await screen.findByLabelText('源分支 / ref')).toBeInTheDocument()
    expect(screen.getByLabelText('目标分支')).toBeInTheDocument()
  })

  it('fills dry-run sourceRef from the selected task sourceBranch', async () => {
    vi.mocked(tasksApi.list).mockResolvedValue({
      data: [
        {
          id: 'task-1',
          displayCode: 'T-1024',
          title: '登录 API 接口',
          repositories: [{ repositoryId: 'bound-demo-auth-service', sourceBranch: 'feat/login-api' }],
        },
      ],
      page: { nextCursor: null, hasMore: false },
      requestId: 'req',
    } as Awaited<ReturnType<typeof tasksApi.list>>)
    const user = userEvent.setup()
    renderPage('/app/projects/demo-project/testset?taskId=task-1')
    await screen.findByRole('heading', { name: 'Testset' })
    await user.click(screen.getByRole('button', { name: '新建 Dry-run' }))
    expect(await screen.findByDisplayValue('feat/login-api')).toBeInTheDocument()
  })

  it('disables an enabled testset through the status API hook in the manage drawer', async () => {
    const disable = vi.fn().mockResolvedValue(undefined)
    useDisableTestsetMock.mockReturnValue({ mutateAsync: disable, isPending: false, error: null })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Testset' })
    await user.click(screen.getByRole('button', { name: '管理测试集' }))
    await screen.findByRole('button', { name: '新建 Testset' })
    await user.click(screen.getByRole('button', { name: '停用 Testset' }))
    await waitFor(() => expect(disable).toHaveBeenCalledWith('testset-demo-project-login'))
  })

  it('keeps history in the aside and does not tag an empty current run', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Testset' })).toBeInTheDocument()
    expect(screen.getByText('当前运行')).toBeInTheDocument()
    expect(screen.queryByText('test-run')).not.toBeInTheDocument()
    expect(screen.queryByText('dry-run')).not.toBeInTheDocument()
    expect(screen.queryByText('执行说明')).not.toBeInTheDocument()
    expect(screen.getByText('历史运行记录')).toBeInTheDocument()
    expect(screen.getByText('权限')).toBeInTheDocument()
  })

  it('shows only the current run testsets beside a selected test-run', async () => {
    useTestsetsMock.mockReturnValue({
      data: [testset, otherTestset],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    useTestRunMock.mockReturnValue({
      data: {
        id: 'testrun-1',
        projectId: 'demo-project',
        repositoryId: 'bound-demo-auth-service',
        testsetIds: ['testset-demo-project-login'],
        taskId: null,
        ref: 'feat/login-api',
        status: 'PASSED',
        summary: '',
        createdBy: 'user-001',
        createdAt: '2026-08-15T02:00:00Z',
        caseSummary: null,
        cases: [],
        artifacts: [],
        reportUrl: null,
        pdfUrl: null,
        startedAt: null,
        finishedAt: null,
        sandboxId: null,
      },
      isLoading: false,
    })
    renderPage('/app/projects/demo-project/testset?testRunId=testrun-1')
    expect(await screen.findByText('test-run')).toBeInTheDocument()
    expect(screen.getByText('本次测试集')).toBeInTheDocument()
    expect(screen.getAllByText('登录接口测试').length).toBeGreaterThan(0)
    expect(screen.queryByText('支付接口测试')).not.toBeInTheDocument()
    expect(screen.getByText('开始时间')).toBeInTheDocument()
    expect(screen.getByText('本轮不提供')).toBeInTheDocument()
    expect(screen.queryByText('dry-run')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '用例详情' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '冲突结果' })).not.toBeInTheDocument()
  })

  it('shows case detail rows on the 用例详情 tab', async () => {
    useTestRunMock.mockReturnValue({
      data: {
        id: 'testrun-1',
        projectId: 'demo-project',
        repositoryId: 'bound-demo-auth-service',
        testsetIds: ['testset-demo-project-login'],
        taskId: null,
        ref: 'feat/login-api',
        status: 'PASSED',
        summary: '',
        createdBy: 'user-001',
        createdAt: '2026-08-15T02:00:00Z',
        caseSummary: null,
        cases: [],
        artifacts: [],
        reportUrl: null,
        pdfUrl: null,
        startedAt: null,
        finishedAt: null,
        sandboxId: null,
      },
      isLoading: false,
    })
    const user = userEvent.setup()
    renderPage('/app/projects/demo-project/testset?testRunId=testrun-1')
    await screen.findByText('test-run')
    await user.click(screen.getByRole('tab', { name: '用例详情' }))
    expect(await screen.findByText(/本轮不提供逐条用例结果/)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '冲突结果' })).not.toBeInTheDocument()
  })

  it('keeps 冲突结果 only on dry-run and links matching Diff files', async () => {
    vi.mocked(diffsApi.list).mockResolvedValue({
      data: [
        {
          id: 'diff-login',
          projectId: 'demo-project',
          taskId: 'task-1',
          taskRunId: null,
          taskStepId: null,
          requirementGroupId: 'group-1',
          workspaceId: 'ws-1',
          repositoryId: 'bound-demo-auth-service',
          baseCommit: 'base',
          sourceBranch: 'feat/login-api',
          headCommit: null,
          status: 'PENDING_REVIEW',
          changeStats: { files: 1, additions: 1, deletions: 0 },
          createdAt: '2026-08-15T02:00:00Z',
        },
      ],
      page: { nextCursor: null, hasMore: false },
      requestId: 'req',
    })
    useDryRunReportMock.mockReturnValue({
      data: {
        id: 'dryrun-1',
        projectId: 'demo-project',
        repositoryId: 'bound-demo-auth-service',
        sourceRef: 'feat/login-api',
        targetBranch: 'main',
        taskId: null,
        status: 'CONFLICT',
        conflicts: [],
        caseSummary: null,
        cases: [],
        summary: '',
        reportUrl: null,
        pdfUrl: null,
        startedAt: null,
        finishedAt: null,
        durationSeconds: null,
        sandboxId: null,
        testsetIds: [],
        createdAt: '2026-08-15T02:00:00Z',
      },
      isLoading: false,
    })
    const user = userEvent.setup()
    renderPage('/app/projects/demo-project/testset?dryRunId=dryrun-1')
    expect(await screen.findByText('dry-run')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '冲突结果' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '冲突结果' }))
    expect(await screen.findByText(/本轮不提供冲突明细/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '打开交付中心' })).not.toBeInTheDocument()
  })
})
