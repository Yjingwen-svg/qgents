import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import type { TaskListItem, TaskModelPage } from '@/types/task-model'

const useInfiniteTasksMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/task-model', () => ({ useInfiniteTasks: useInfiniteTasksMock }))

import { TaskCenterPage } from './TaskCenterPage'

const task: TaskListItem = { id: 'task-1', displayCode: 'T-1', projectId: 'project-test', title: '新任务', requirementSummary: '实现功能', status: 'RUNNING', deliveryMode: 'DIFF_FIRST', requirementGroup: { id: 'group-1', name: '登录', status: 'ACTIVE' }, createdByUser: { id: 'creator-1', displayName: 'Creator', avatarUrl: null }, repositories: [], executionSummary: { totalSteps: 0, pendingSteps: 0, runningSteps: 1, waitingSteps: 0, blockedSteps: 0, succeededSteps: 0, failedSteps: 0, currentStage: null, currentStageTitle: null, requiresUserAction: false }, attention: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
function page(data: TaskListItem[]): TaskModelPage<TaskListItem> { return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' } }
function renderPage(entry = '/app/projects/project-test/tasks') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/app/projects/:projectId/tasks" element={<><TaskCenterPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/tasks/:taskId" element={<><output data-testid="detail-route">detail</output><LocationProbe /></>} /></Routes></MemoryRouter>)
}
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function result(overrides: Record<string, unknown> = {}) { return { data: { pages: [page([task])], pageParams: [undefined] }, error: null, isError: false, isFetching: false, isLoading: false, hasNextPage: false, isFetchNextPageError: false, refetch: vi.fn(), fetchNextPage: vi.fn(), ...overrides } }

beforeEach(() => { useInfiniteTasksMock.mockReset(); useInfiniteTasksMock.mockReturnValue(result()) })

describe('TaskCenterPage', () => {
  it('uses the Task query with official filters', () => {
    renderPage('/app/projects/project-test/tasks?groupId=group-1&status=RUNNING&createdBy=creator-1')
    expect(useInfiniteTasksMock).toHaveBeenCalledWith('project-test', { groupId: 'group-1', status: 'RUNNING', createdBy: 'creator-1', limit: 20 })
    expect(screen.getByText('新任务')).toBeInTheDocument()
  })

  it('restores and updates taskId selection', async () => {
    const user = userEvent.setup(); renderPage('/app/projects/project-test/tasks?taskId=task-1')
    expect(screen.getByText('任务 ID：task-1')).toBeInTheDocument()
    await user.click(screen.getByText('新任务'))
    expect(screen.getByTestId('location')).toHaveTextContent('taskId=task-1')
  })

  it('restores the new Task detail entry without navigating to old detail', async () => {
    const user = userEvent.setup(); renderPage()
    expect(screen.queryByText(/executionPreview/)).not.toBeInTheDocument()
    const detailButton = screen.getAllByText('查看完整任务详情')[0]
    await user.click(detailButton)
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-test/tasks/task-1')
  })

  it('shows loading and permission states', () => {
    useInfiniteTasksMock.mockReturnValue(result({ data: undefined, isLoading: true, isFetching: true }))
    const { rerender } = renderPage(); expect(screen.getByText('正在加载任务')).toBeInTheDocument()
    useInfiniteTasksMock.mockReturnValue(result({ data: undefined, isLoading: false, isError: true, error: new ApiError('forbidden', 403) }))
    rerender(<MemoryRouter initialEntries={['/app/projects/project-test/tasks']}><Routes><Route path="/app/projects/:projectId/tasks" element={<TaskCenterPage />} /></Routes></MemoryRouter>)
    expect(screen.getByText('暂无权限查看任务')).toBeInTheDocument()
  })

  it('does not use orchestration run hooks', async () => {
    renderPage(); await waitFor(() => expect(useInfiniteTasksMock).toHaveBeenCalled())
    expect(useInfiniteTasksMock).toHaveBeenCalledTimes(1)
  })
})
