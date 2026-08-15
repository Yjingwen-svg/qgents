import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubApi } from '@/api/github'
import { projectApi } from '@/api/project'
import type { DiffComment, DiffFile, DiffListItem, MergeRequestCheck, MergeRequestSummary } from '@/types/task-model'
import { MergeRequestDetailPage } from './MergeRequestDetailPage'

const useMergeRequestMock = vi.hoisted(() => vi.fn())
const useMergeRequestChecksMock = vi.hoisted(() => vi.fn())
const useMergeMergeRequestMock = vi.hoisted(() => vi.fn())
const useDiffsMock = vi.hoisted(() => vi.fn())
const useDiffFilesMock = vi.hoisted(() => vi.fn())
const useDiffCommentsMock = vi.hoisted(() => vi.fn())
const useAddDiffCommentMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/task-model', () => ({
  useMergeRequest: useMergeRequestMock,
  useMergeRequestChecks: useMergeRequestChecksMock,
  useMergeMergeRequest: useMergeMergeRequestMock,
  useDiffs: useDiffsMock,
  useDiffFiles: useDiffFilesMock,
  useDiffComments: useDiffCommentsMock,
  useAddDiffComment: useAddDiffCommentMock,
}))

vi.mock('@/api/project', () => ({
  projectApi: {
    getById: vi.fn(),
    listMembers: vi.fn(),
  },
}))

vi.mock('@/api/github', () => ({
  githubApi: {
    listProjectRepositories: vi.fn(),
  },
}))

const mr: MergeRequestSummary = {
  id: 'mr-1',
  repositoryId: 'bound-demo-auth-service',
  groupIds: ['group-1'],
  provider: 'GITHUB',
  number: 42,
  title: '实现邮箱登录',
  description: '实现登录接口，包含参数校验、账号校验、密码校验、JWT 鉴权及响应返回。',
  sourceBranch: 'feat/login-api',
  targetBranch: 'main',
  status: 'OPEN',
  headCommit: 'a1b2c3d4e5f67890',
  webUrl: 'https://github.com/mock/demo/pull/42',
  qualityGate: {
    status: 'PENDING',
    requiredChecks: ['TESTSET', 'AI_REVIEW', 'DRY_RUN', 'CQ_PLUS_ONE', 'CR_BLOCKING_COMMENTS'],
  },
}

const checks: MergeRequestCheck[] = [
  { id: 'ck-1', type: 'TESTSET', status: 'PASSED', attemptNo: 1 },
  { id: 'ck-2', type: 'AI_REVIEW', status: 'PENDING', attemptNo: 1 },
  { id: 'ck-3', type: 'DRY_RUN', status: 'PASSED', attemptNo: 1 },
  { id: 'ck-4', type: 'CQ_PLUS_ONE', status: 'PENDING', attemptNo: 1 },
]

const relatedDiff: DiffListItem = {
  id: 'diff-1',
  projectId: 'project-1',
  taskId: 'task-1',
  taskRunId: 'run-1',
  taskStepId: 'step-1',
  requirementGroupId: 'group-1',
  workspaceId: 'workspace-1',
  repositoryId: 'bound-demo-auth-service',
  baseCommit: 'base-1',
  sourceBranch: 'feat/login-api',
  headCommit: 'a1b2c3d',
  status: 'ACCEPTED',
  changeStats: { files: 1, additions: 2, deletions: 1 },
  createdAt: '2026-08-12T08:00:00Z',
}

const file: DiffFile = {
  id: 'file-1',
  sequence: 1,
  path: 'src/auth/AuthController.ts',
  changeType: 'MODIFIED',
  status: 'MODIFIED',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [
    {
      id: 'hunk-login',
      header: '@@ -17,3 +17,4 @@',
      lines: [
        { kind: 'DEL', oldLine: 20, newLine: null, text: '    return this.authService.loginByPhone(dto)' },
        { kind: 'ADD', oldLine: null, newLine: 20, text: '    return this.authService.loginByEmail(dto)' },
      ],
    },
  ],
}

const comment: DiffComment = {
  id: 'comment-1',
  diffId: 'diff-1',
  path: 'src/auth/AuthController.ts',
  side: 'RIGHT',
  line: 20,
  hunkId: 'hunk-login',
  body: '密码有做哈希吗？',
  authorUserId: 'user-002',
  authorName: null,
  createdAt: '2026-05-16T11:20:00Z',
}

function idleMutation(mutateAsync = vi.fn()) {
  return { mutate: vi.fn(), mutateAsync, isPending: false }
}

function renderPage(path = '/app/projects/project-1/code/mr/mr-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/code/mr/:mergeRequestId" element={<MergeRequestDetailPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(projectApi.getById).mockResolvedValue({
    id: 'project-1',
    teamId: 'team-1',
    name: 'Demo',
    role: 'PROJECT_ADMIN',
  })
  vi.mocked(projectApi.listMembers).mockResolvedValue([
    { userId: 'user-002', displayName: '李同学', email: 'li@example.com', role: 'PROJECT_MEMBER' },
  ])
  vi.mocked(githubApi.listProjectRepositories).mockResolvedValue([
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
  ])
  useMergeRequestMock.mockReturnValue({
    data: mr,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  useMergeRequestChecksMock.mockReturnValue({
    data: checks,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  useMergeMergeRequestMock.mockReturnValue(idleMutation())
  useDiffsMock.mockReturnValue({
    data: { data: [relatedDiff], page: { nextCursor: null, hasMore: false }, requestId: 'r1' },
    isLoading: false,
    isError: false,
    error: null,
  })
  useDiffFilesMock.mockReturnValue({
    data: { data: [file], page: { nextCursor: null, hasMore: false }, requestId: 'r2' },
    isLoading: false,
    isError: false,
    error: null,
  })
  useDiffCommentsMock.mockReturnValue({
    data: { data: [comment], page: { nextCursor: null, hasMore: false }, requestId: 'r3' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  useAddDiffCommentMock.mockReturnValue(idleMutation())
})

describe('MergeRequestDetailPage', () => {
  it('loads MR detail and the four frozen quality-gate checks', async () => {
    renderPage()
    expect(useMergeRequestMock).toHaveBeenCalledWith('project-1', 'mr-1')
    expect(useMergeRequestChecksMock).toHaveBeenCalledWith('project-1', 'mr-1')
    expect(screen.getByRole('heading', { name: /MR #42/ })).toBeInTheDocument()
    expect(screen.getByText('实现登录接口，包含参数校验、账号校验、密码校验、JWT 鉴权及响应返回。')).toBeInTheDocument()
    expect(screen.getByText('Testset')).toBeInTheDocument()
    expect(screen.getByText('AI Review')).toBeInTheDocument()
    expect(screen.getByText('Dry-run')).toBeInTheDocument()
    expect(screen.getByText('CQ+1')).toBeInTheDocument()
    expect(screen.queryByText('仍有阻塞型评论')).not.toBeInTheDocument()
    expect(screen.getAllByText('通过').length).toBeGreaterThan(0)
    expect(screen.queryByRole('tab', { name: '检查' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'merge-merge-request' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /返回 MR 列表/ })).toHaveAttribute(
      'href',
      '/app/projects/project-1/code?tab=mr',
    )
  })

  it('shows merge only for Project Admin when the gate has passed and the MR is open', async () => {
    useMergeRequestMock.mockReturnValue({
      data: { ...mr, qualityGate: { ...mr.qualityGate!, status: 'PASSED' } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'merge-merge-request' })).toBeEnabled()
  })

  it('hides merge from project members even when the gate has passed', async () => {
    vi.mocked(projectApi.getById).mockResolvedValue({
      id: 'project-1',
      teamId: 'team-1',
      name: 'Demo',
      role: 'PROJECT_MEMBER',
    })
    useMergeRequestMock.mockReturnValue({
      data: { ...mr, qualityGate: { ...mr.qualityGate!, status: 'PASSED' } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByRole('heading', { name: /MR #42/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'merge-merge-request' })).not.toBeInTheDocument()
    expect(screen.queryByText(/质量门禁未全部通过前不显示合并/)).not.toBeInTheDocument()
  })

  it('hides merge after the MR is already merged', async () => {
    useMergeRequestMock.mockReturnValue({
      data: {
        ...mr,
        status: 'MERGED',
        qualityGate: { ...mr.qualityGate!, status: 'PASSED' },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByText('已合并')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'merge-merge-request' })).not.toBeInTheDocument()
  })

  it('asks the admin to confirm before merging', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ...mr, status: 'MERGED', qualityGate: { ...mr.qualityGate!, status: 'PASSED' } })
    useMergeRequestMock.mockReturnValue({
      data: { ...mr, qualityGate: { ...mr.qualityGate!, status: 'PASSED' } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    useMergeMergeRequestMock.mockReturnValue(idleMutation(mutateAsync))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'merge-merge-request' }))
    await user.click(await screen.findByRole('button', { name: '确认合并' }))
    expect(mutateAsync).toHaveBeenCalledWith('mr-1')
  })

  it('puts comments and changes on the detail tabs, not the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: '变更' }))
    expect(await screen.findByText('AuthController.ts')).toBeInTheDocument()
    expect(screen.getByText(/loginByEmail/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '评论' }))
    expect(await screen.findByText('密码有做哈希吗？')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('在本 MR 详情页发表评论')).toBeInTheDocument()
  })
})
