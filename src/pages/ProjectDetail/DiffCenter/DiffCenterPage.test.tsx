import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffDetail, DiffListItem } from '@/types/task-model'
import { DiffCenterPage } from './DiffCenterPage'

const useInfiniteDiffsMock = vi.hoisted(() => vi.fn())
const useDiffMock = vi.hoisted(() => vi.fn())
const useAcceptDiffMock = vi.hoisted(() => vi.fn())
const useRejectDiffMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/task-model', () => ({ useInfiniteDiffs: useInfiniteDiffsMock, useDiff: useDiffMock, useAcceptDiff: useAcceptDiffMock, useRejectDiff: useRejectDiffMock }))

const diff: DiffDetail = { id: 'diff-1', projectId: 'project-1', taskId: 'task-1', taskRunId: 'run-1', taskStepId: 'step-1', requirementGroupId: 'group-1', workspaceId: 'workspace-1', repositoryId: 'repo-1', baseCommit: 'base-1', sourceBranch: 'feature/login', headCommit: 'head-1', status: 'PENDING_REVIEW', changeStats: { files: 2, additions: 4, deletions: 1 }, createdAt: '2026-08-12T08:00:00Z', workingTreeHash: 'tree-1', snapshotKey: 'snapshot-1', reviewedBy: null, reviewReason: null, reviewedAt: null, updatedAt: '2026-08-12T08:01:00Z' }
const page = { data: [diff as DiffListItem], page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function renderPage(path = '/app/projects/project-1/diffs/diff-1') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/diffs" element={<><DiffCenterPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/diffs/:diffId" element={<><DiffCenterPage /><LocationProbe /></>} /></Routes></MemoryRouter>) }

beforeEach(() => {
  useInfiniteDiffsMock.mockReturnValue({ data: { pages: [page] }, isLoading: false, isPending: false, isError: false, error: null, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() })
  useDiffMock.mockReturnValue({ data: diff, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
  useAcceptDiffMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  useRejectDiffMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
})

describe('DiffCenterPage', () => {
  it('restores diffId and renders formal associations without unsupported filters', () => {
    renderPage()
    expect(screen.getAllByText('diff-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('task-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('step-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('run-1').length).toBeGreaterThan(0)
    expect(screen.getByText(/接口暂未支持/)).toBeInTheDocument()
    expect(useInfiniteDiffsMock).toHaveBeenCalledWith('project-1', { taskId: undefined, limit: 20 })
  })

  it('filters only by taskId and navigates from a task-filtered list', async () => {
    renderPage('/app/projects/project-1/diffs?taskId=task-1')
    expect(useInfiniteDiffsMock).toHaveBeenCalledWith('project-1', { taskId: 'task-1', limit: 20 })
    await userEvent.click(screen.getByRole('button', { name: '查看摘要' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/diffs/diff-1?taskId=task-1'))
  })

  it('requires a rejection reason and does not call files, comments, or merge features', async () => {
    const reject = vi.fn()
    useRejectDiffMock.mockReturnValue({ mutate: reject, isPending: false, error: null })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'reject-diff' }))
    expect(reject).not.toHaveBeenCalled()
    await user.type(screen.getByPlaceholderText('请输入拒绝原因'), '需要补充测试')
    await user.click(screen.getByRole('button', { name: 'reject-diff' }))
    expect(reject).toHaveBeenCalledWith({ diffId: 'diff-1', input: { reason: '需要补充测试' } }, expect.any(Object))
    expect(screen.queryByText(/文件树|行级评论/)).not.toBeInTheDocument()
    expect(screen.getByText(/不代表已合并 MR/)).toBeInTheDocument()
  })

  it('renders processed diffs as read-only', () => {
    useDiffMock.mockReturnValue({ data: { ...diff, status: 'ACCEPTED' }, isLoading: false, isPending: false, isError: false, error: null, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('该 Diff 已处理，只读。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '验收 Diff' })).not.toBeInTheDocument()
  })
})
