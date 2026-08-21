import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffDetail, DiffFile, DiffListItem } from '@/types/task-model'
import DiffCenterPage from './DiffCenterPage'

const useInfiniteDiffsMock = vi.hoisted(() => vi.fn())
const useDiffMock = vi.hoisted(() => vi.fn())
const useDiffFilesMock = vi.hoisted(() => vi.fn())
const useTaskMock = vi.hoisted(() => vi.fn())
const useAcceptDiffMock = vi.hoisted(() => vi.fn())
const useRejectDiffMock = vi.hoisted(() => vi.fn())
const useTaskDiffReviewMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/task-model', () => ({ useInfiniteDiffs: useInfiniteDiffsMock, useDiff: useDiffMock, useDiffFiles: useDiffFilesMock, useTask: useTaskMock, useTaskDiffReview: useTaskDiffReviewMock, useAcceptDiff: useAcceptDiffMock, useRejectDiff: useRejectDiffMock }))
vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api')
  return {
    ...actual,
    githubApi: { listProjectRepositories: vi.fn().mockResolvedValue([]) },
  }
})

const diff: DiffDetail = { id: 'diff-1', projectId: 'project-1', taskId: 'task-1', taskRunId: 'run-1', taskStepId: 'step-1', requirementGroupId: 'group-1', workspaceId: 'workspace-1', repositoryId: 'repo-1', baseCommit: 'base-1', sourceBranch: 'feature/login', headCommit: 'head-1', status: 'PENDING_REVIEW', changeStats: { files: 2, additions: 4, deletions: 1 }, createdAt: '2026-08-12T08:00:00Z', workingTreeHash: 'tree-1', snapshotKey: 'snapshot-1', reviewedBy: null, reviewReason: null, reviewedAt: null, updatedAt: '2026-08-12T08:01:00Z' }
const page = { data: [diff as DiffListItem], page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }
const diffFiles: DiffFile[] = [
  {
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
        id: 'hunk-1',
        header: '@@ -10,3 +10,4 @@',
        lines: [
          { kind: 'CONTEXT', oldLine: 10, newLine: 10, text: 'const x = 1' },
          { kind: 'DEL', oldLine: 11, newLine: null, text: 'const y = 2' },
          { kind: 'ADD', oldLine: null, newLine: 11, text: 'const z = 3' },
        ],
      },
    ],
  },
]
const filesPage = { data: diffFiles, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function renderPage(path = '/app/projects/project-1/diffs/diff-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/diffs" element={<><DiffCenterPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/diffs/:diffId" element={<><DiffCenterPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/tasks/:taskId" element={<LocationProbe />} /></Routes></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  useInfiniteDiffsMock.mockReturnValue({ data: { pages: [page] }, isLoading: false, isPending: false, isError: false, error: null, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() })
  useDiffMock.mockReturnValue({ data: diff, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
  useDiffFilesMock.mockReturnValue({ data: filesPage, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
  useAcceptDiffMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  useRejectDiffMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  useTaskMock.mockReturnValue({ data: undefined, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
  useTaskDiffReviewMock.mockReturnValue({ data: undefined, isLoading: false, isPending: false, isError: true, error: null, refetch: vi.fn() })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('DiffCenterPage', () => {
  it('restores diffId and renders formal associations without unsupported filters', () => {
    useTaskMock.mockReturnValue({ data: { id: 'task-1', title: '登录任务' }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('登录任务')).toBeInTheDocument()
    expect(useInfiniteDiffsMock).toHaveBeenCalledWith('project-1', { taskId: undefined, limit: 20 })
  })

  it('filters only by taskId when query string provides one', () => {
    renderPage('/app/projects/project-1/diffs?taskId=task-1')
    expect(useInfiniteDiffsMock).toHaveBeenCalledWith('project-1', { taskId: 'task-1', limit: 20 })
  })

  it('requires a rejection reason and does not call comments or merge features', async () => {
    const reject = vi.fn()
    useRejectDiffMock.mockReturnValue({ mutate: reject, isPending: false, error: null })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'reject-diff' }))
    expect(reject).not.toHaveBeenCalled()
    await user.type(screen.getByPlaceholderText('请输入拒绝原因'), '需要补充测试')
    await user.click(screen.getByRole('button', { name: 'reject-diff' }))
    expect(reject).toHaveBeenCalledWith({ diffId: 'diff-1', input: { reason: '需要补充测试' } }, expect.any(Object))
    expect(screen.getByText(/不代表已合并 MR/)).toBeInTheDocument()
  })

  it('renders file list and line-level red/green hunks from useDiffFiles', () => {
    renderPage()
    expect(useDiffFilesMock).toHaveBeenCalledWith('project-1', 'diff-1', { limit: 100 })
    expect(screen.getByText('文件变更')).toBeInTheDocument()
    expect(screen.getByText('src/auth/AuthController.ts')).toBeInTheDocument()
    expect(screen.getByText('@@ -10,3 +10,4 @@')).toBeInTheDocument()
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
    expect(screen.getByText('const y = 2')).toBeInTheDocument()
    expect(screen.getByText('const z = 3')).toBeInTheDocument()
  })

  it('hides the file panel when the diff has no files', () => {
    useDiffFilesMock.mockReturnValue({ data: { ...filesPage, data: [] }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(screen.queryByText('文件变更')).not.toBeInTheDocument()
  })

  it('renders processed diffs as read-only', () => {
    useDiffMock.mockReturnValue({ data: { ...diff, status: 'ACCEPTED' }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('该 Diff 已处理，只读。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '验收 Diff' })).not.toBeInTheDocument()
  })

  it('uses the task-level batch review entry when a final Diff batch exists', async () => {
    useTaskDiffReviewMock.mockReturnValue({ data: { id: 'batch-1', taskId: 'task-1' }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(screen.queryByRole('button', { name: '验收 Diff' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '进入总 Diff 验收' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-1/tasks/task-1')
  })

  it('requires confirmation before accepting and prevents cross-project detail display', async () => {
    const accept = vi.fn()
    useAcceptDiffMock.mockReturnValue({ mutate: accept, isPending: false, error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'accept-diff' }))
    expect(accept).not.toHaveBeenCalled()
    useDiffMock.mockReturnValue({ data: { ...diff, projectId: 'other-project' }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('Diff 不存在或不可见')).toBeInTheDocument()
  })
})
