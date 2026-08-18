import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubApi } from '@/api/github'
import { teamApi } from '@/api/team'
import type { DiffComment, DiffDetail, DiffFile, MergeRequestSummary } from '@/types/task-model'
import { projectApi } from '@/api/project'
import DiffReviewPage from './DiffReviewPage'

const useDiffMock = vi.hoisted(() => vi.fn())
const useDiffFilesMock = vi.hoisted(() => vi.fn())
const useDiffCommentsMock = vi.hoisted(() => vi.fn())
const useAddDiffCommentMock = vi.hoisted(() => vi.fn())
const useAcceptDiffMock = vi.hoisted(() => vi.fn())
const useRejectDiffMock = vi.hoisted(() => vi.fn())
const useTaskMock = vi.hoisted(() => vi.fn())
const useDiffsMock = vi.hoisted(() => vi.fn())
const useCreateMergeRequestMock = vi.hoisted(() => vi.fn())
const useMergeRequestsMock = vi.hoisted(() => vi.fn())
const usePreflightMock = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'demo@qgents.dev', displayName: '陈同学' },
}))

vi.mock('@/hooks/task-model', () => ({
  useDiff: useDiffMock,
  useDiffFiles: useDiffFilesMock,
  useDiffComments: useDiffCommentsMock,
  useDiffs: useDiffsMock,
  useAddDiffComment: useAddDiffCommentMock,
  useAcceptDiff: useAcceptDiffMock,
  useRejectDiff: useRejectDiffMock,
  useTask: useTaskMock,
  useCreateMergeRequest: useCreateMergeRequestMock,
  useMergeRequests: useMergeRequestsMock,
}))

vi.mock('@/hooks/qualityGate', () => ({
  usePreflight: usePreflightMock,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
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

vi.mock('@/api/team', () => ({
  teamApi: {
    getById: vi.fn(),
  },
}))

const diff: DiffDetail = {
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
  status: 'PENDING_REVIEW',
  changeStats: { files: 1, additions: 2, deletions: 1 },
  createdAt: '2026-08-12T08:00:00Z',
  workingTreeHash: null,
  snapshotKey: null,
  reviewedBy: null,
  reviewReason: null,
  reviewedAt: null,
  updatedAt: '2026-08-12T08:01:00Z',
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

const listedMr: MergeRequestSummary = {
  id: 'mr-1',
  repositoryId: 'bound-demo-auth-service',
  groupIds: ['group-1'],
  provider: 'GITHUB',
  number: 42,
  title: '实现邮箱登录',
  sourceBranch: 'feat/login-api',
  targetBranch: 'main',
  status: 'OPEN',
  headCommit: 'a1b2c3d',
  webUrl: 'https://github.com/mock/auth-service/pull/42',
  taskId: 'task-1',
}

function idleMutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }
}

function renderPage(path = '/app/projects/project-1/code/diff/diff-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/code/diff/:diffId" element={<DiffReviewPage />} />
            <Route
              path="/app/projects/:projectId/code/mr/:mergeRequestId"
              element={<div>MR detail stub</div>}
            />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  authState.user = { id: 'user-1', email: 'demo@qgents.dev', displayName: '陈同学' }
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
  vi.mocked(teamApi.getById).mockResolvedValue({
    id: 'team-1',
    name: 'Demo team',
    role: 'TEAM_MEMBER',
  })
  useDiffMock.mockReturnValue({
    data: diff,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  useDiffFilesMock.mockReturnValue({
    data: { data: [file], page: { nextCursor: null, hasMore: false }, requestId: 'r1' },
    isLoading: false,
    isError: false,
    error: null,
  })
  useDiffCommentsMock.mockReturnValue({
    data: { data: [comment], page: { nextCursor: null, hasMore: false }, requestId: 'r2' },
    isLoading: false,
    isError: false,
    error: null,
  })
  useDiffsMock.mockReturnValue({
    data: { data: [diff], page: { nextCursor: null, hasMore: false }, requestId: 'r3' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  useAddDiffCommentMock.mockReturnValue(idleMutation())
  useAcceptDiffMock.mockReturnValue(idleMutation())
  useRejectDiffMock.mockReturnValue(idleMutation())
  useCreateMergeRequestMock.mockReturnValue(idleMutation())
  useMergeRequestsMock.mockReturnValue({
    data: { data: [], page: { nextCursor: null, hasMore: false }, requestId: 'r4' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  useTaskMock.mockReturnValue({
    data: {
      id: 'task-1',
      title: '登录任务',
      createdByUser: { id: 'user-1', displayName: 'Mock User', avatarUrl: null },
      repositories: [{ repositoryId: 'bound-demo-auth-service', defaultBranch: 'main', baseRef: 'main' }],
    },
    isLoading: false,
  })
  usePreflightMock.mockReturnValue({
    data: {
      taskId: 'task-1',
      repositoryId: 'bound-demo-auth-service',
      targetBranch: 'main',
      sourceCommit: 'a1b2c3d',
      targetCommit: 'bbbbbbbb',
      status: 'PASSED',
      blockers: [],
      dryRun: { id: 'dryrun-1', status: 'PASSED', sourceCommit: 'a1b2c3d', targetCommit: 'bbbbbbbb' },
      cqPlusOne: { status: 'APPROVED', reviewerUserId: 'user-2', reviewerName: '李同学', reason: 'ok', reviewedAt: null },
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('DiffReviewPage', () => {
  it('loads Diff detail, files and comments through the documented hooks', async () => {
    renderPage()
    expect(useDiffMock).toHaveBeenCalledWith('project-1', 'diff-1')
    expect(useDiffFilesMock).toHaveBeenCalledWith('project-1', 'diff-1', { limit: 100 })
    expect(useDiffCommentsMock).toHaveBeenCalledWith('project-1', 'diff-1', { limit: 100 })
    expect(await screen.findByRole('heading', { name: 'Diff-登录任务' })).toBeInTheDocument()
    expect(screen.getByText('feat/login-api')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加评论' })).not.toBeInTheDocument()
    expect(screen.getByText(/基准/)).toBeInTheDocument()
    expect(screen.getByTitle('base-1')).toHaveTextContent('base-1')
    expect(screen.getByText(/提交结果/)).toBeInTheDocument()
    expect(screen.getByTitle('a1b2c3d')).toHaveTextContent('a1b2c3d')
    expect(screen.getByText('AuthController.ts')).toBeInTheDocument()
    expect(screen.getByText(/loginByEmail/)).toBeInTheDocument()
    expect(screen.getByText('密码有做哈希吗？')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'accept-diff' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'create-merge-request' })).not.toBeInTheDocument()
  })

  it('opens the file from the file query string', async () => {
    const extra: DiffFile = {
      ...file,
      id: 'file-a',
      path: 'a.ts',
      hunks: [{ id: 'hunk-a', header: '@@ -1,1 +1,1 @@', lines: [{ kind: 'ADD', oldLine: null, newLine: 1, text: 'x' }] }],
    }
    useDiffFilesMock.mockReturnValue({
      data: { data: [file, extra], page: { nextCursor: null, hasMore: false }, requestId: 'r1' },
      isLoading: false,
      isError: false,
      error: null,
    })
    renderPage('/app/projects/project-1/code/diff/diff-1?file=a.ts')
    expect(await screen.findByText('2/2 个文件')).toBeInTheDocument()
  })

  it('does not import demo fixtures when the API returns no Diff', () => {
    useDiffMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Diff 不存在'),
      refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('Diff 不存在')).toBeInTheDocument()
    expect(screen.queryByText('loginByPhone')).not.toBeInTheDocument()
  })

  it('hides accept and reject for a project member who is not the initiator', async () => {
    vi.mocked(projectApi.getById).mockResolvedValue({
      id: 'project-1',
      teamId: 'team-1',
      name: 'Demo',
      role: 'PROJECT_MEMBER',
    })
    authState.user = { id: 'user-2', email: 'member@qgents.dev', displayName: '成员' }
    renderPage()
    expect(await screen.findByRole('button', { name: 'create-merge-request' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'accept-diff' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reject-diff' })).not.toBeInTheDocument()
    expect(screen.getByText('请先通过该 Diff')).toBeInTheDocument()
  })

  it('hides accept for a task initiator who is only a project member', async () => {
    vi.mocked(projectApi.getById).mockResolvedValue({
      id: 'project-1',
      teamId: 'team-1',
      name: 'Demo',
      role: 'PROJECT_MEMBER',
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'create-merge-request' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'accept-diff' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reject-diff' })).not.toBeInTheDocument()
  })

  it('shows accept for a Team Owner who is only a project member', async () => {
    vi.mocked(projectApi.getById).mockResolvedValue({
      id: 'project-1',
      teamId: 'team-1',
      name: 'Demo',
      role: 'PROJECT_MEMBER',
    })
    vi.mocked(teamApi.getById).mockResolvedValue({
      id: 'team-1',
      name: 'Demo team',
      role: 'TEAM_OWNER',
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'accept-diff' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'reject-diff' })).toBeEnabled()
  })

  it('enables create MR after the Diff is accepted and remotely verified', async () => {
    useDiffMock.mockReturnValue({
      data: { ...diff, status: 'ACCEPTED' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'create-merge-request' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'accept-diff' })).not.toBeInTheDocument()
    expect(screen.getByText('创建 MR 会发起合并请求，不会直接合入目标分支')).toBeInTheDocument()
  })

  it('navigates to MR detail after create succeeds', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({
      id: 'mr-1',
      number: 42,
      webUrl: 'https://github.com/mock/auth-service/pull/42',
    })
    useDiffMock.mockReturnValue({
      data: { ...diff, status: 'ACCEPTED' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    useCreateMergeRequestMock.mockReturnValue({ mutate: vi.fn(), mutateAsync, isPending: false })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'create-merge-request' }))
    await user.click(await screen.findByRole('button', { name: '创建 MR' }))
    expect(await screen.findByText('MR detail stub')).toBeInTheDocument()
  })

  it('restores an existing OPEN MR after refresh and disables create', async () => {
    useDiffMock.mockReturnValue({
      data: { ...diff, status: 'ACCEPTED' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    useMergeRequestsMock.mockReturnValue({
      data: { data: [listedMr], page: { nextCursor: null, hasMore: false }, requestId: 'r4' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'create-merge-request' })).toBeDisabled()
    expect(screen.getByText('该 Diff 已创建过 MR')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: '打开 MR #42' })
    expect(link).toHaveAttribute('href', 'https://github.com/mock/auth-service/pull/42')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('builds a GitHub link when the listed MR has no webUrl', async () => {
    useDiffMock.mockReturnValue({
      data: { ...diff, status: 'ACCEPTED' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    useMergeRequestsMock.mockReturnValue({
      data: {
        data: [{ ...listedMr, webUrl: null }],
        page: { nextCursor: null, hasMore: false },
        requestId: 'r4',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    const link = await screen.findByRole('link', { name: '打开 MR #42' })
    expect(link).toHaveAttribute('href', 'https://github.com/mock/auth-service/pull/42')
  })

  it('keeps create MR disabled if an accepted Diff is missing headCommit', async () => {
    useDiffMock.mockReturnValue({
      data: { ...diff, status: 'ACCEPTED', headCommit: null },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'create-merge-request' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'accept-diff' })).not.toBeInTheDocument()
    expect(screen.getByText('等待远端提交核验完成')).toBeInTheDocument()
    expect(screen.getByText(/提交结果/).closest('p')).toHaveTextContent('提交结果 -')
  })

  it('shows an empty hunk state when files have no structured lines', async () => {
    useDiffFilesMock.mockReturnValue({
      data: {
        data: [{ ...file, hunks: [] }],
        page: { nextCursor: null, hasMore: false },
        requestId: 'r1',
      },
      isLoading: false,
      isError: false,
      error: null,
    })
    renderPage()
    expect(await screen.findByText(/本轮未返回结构化 hunk/)).toBeInTheDocument()
  })

  it('opens the newer snapshot for the same branch instead of keeping the stale Diff', async () => {
    useDiffsMock.mockReturnValue({
      data: {
        data: [diff, { ...diff, id: 'diff-2', createdAt: '2026-08-12T10:00:00Z' }],
        page: { nextCursor: null, hasMore: false },
        requestId: 'r3',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    await waitFor(() => expect(useDiffMock).toHaveBeenCalledWith('project-1', 'diff-2'))
  })

  it('renders an empty shell for zero-change branch entry without calling live Diff APIs', async () => {
    renderPage('/app/projects/project-1/code/diff/empty-branch%3Abr-auth-main')
    expect(await screen.findByText('没有文件')).toBeInTheDocument()
    expect(screen.getByText('该分支当前没有可查看的代码变更')).toBeInTheDocument()
    expect(useDiffMock).toHaveBeenCalledWith('project-1', '')
    expect(useDiffFilesMock).toHaveBeenCalledWith('project-1', '', { limit: 100 })
  })
})
