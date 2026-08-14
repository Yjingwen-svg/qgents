import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import type { Task, TaskModelPage, TaskRunSummary, TaskStep } from '@/types/task-model'

const useTaskMock = vi.hoisted(() => vi.fn())
const useTaskStepsMock = vi.hoisted(() => vi.fn())
const useTaskRunsMock = vi.hoisted(() => vi.fn())
const useCancelTaskMock = vi.hoisted(() => vi.fn())
const useDiffsMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/task-model', () => ({ useTask: useTaskMock, useTaskSteps: useTaskStepsMock, useTaskRuns: useTaskRunsMock, useCancelTask: useCancelTaskMock, useDiffs: useDiffsMock }))

import { TaskDetailPage } from './TaskDetailPage'

const task: Task = { id: 'task-1', projectId: 'project-test', requirementGroupId: 'group-1', triggerMessageId: 'message-1', title: '登录任务', requirement: '实现登录功能', status: 'RUNNING', workspaceId: 'workspace-1', workspaceStatus: 'READY', continuationOfTaskId: null, repositoryIds: ['repo-1'], repositories: [{ repositoryId: 'repo-1', baseCommit: 'base-1', sourceBranch: 'main', headCommit: 'head-1' }], createdBy: 'user-1', createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
const step: TaskStep = { id: 'step-1', taskId: 'task-1', role: 'DEVELOPER', agentId: 'agent-1', repositoryId: 'repo-1', baseRef: 'main', dependencies: [], testsetIds: ['testset-1'], status: 'RUNNING', acceptanceNotes: '覆盖登录场景' }
const run: TaskRunSummary = { id: 'run-1', projectId: 'project-test', taskId: 'task-1', taskStepId: 'step-1', agentId: 'agent-1', role: 'DEVELOPER', status: 'RUNNING', retryOfTaskRunId: null, createdAt: '2026-08-11T08:00:00Z', updatedAt: '2026-08-11T08:30:00Z' }
function page<T>(data: T[]): TaskModelPage<T> { return { data, page: { nextCursor: null, hasMore: false }, requestId: 'request-1' } }
function renderPage(path = '/app/projects/project-test/tasks/task-1') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/projects/:projectId/tasks/:taskId" element={<><TaskDetailPage /><LocationProbe /></>} /><Route path="/app/projects/:projectId/tasks/:taskId/executions/:taskRunId" element={<div>execution-route</div>} /></Routes></MemoryRouter>) }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
beforeEach(() => { useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch: vi.fn() }); useTaskStepsMock.mockReturnValue({ data: page([step]), error: null, isError: false, isLoading: false }); useTaskRunsMock.mockReturnValue({ data: page([run]), error: null, isError: false, isLoading: false }); useCancelTaskMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false }); useDiffsMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false }) })

describe('TaskDetailPage', () => {
  it('loads Task, steps and task runs without legacy resources', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /任务 ID：task-1登录任务/ })).toBeInTheDocument()
    expect(screen.getByText('实现登录功能')).toBeInTheDocument()
    expect(screen.getByText(/Agent：agent-1/)).toBeInTheDocument()
    expect(screen.getByText('查看最新 TaskRun：run-1')).toBeInTheDocument()
    expect(useTaskMock).toHaveBeenCalledWith('project-test', 'task-1')
    expect(useTaskStepsMock).toHaveBeenCalledWith('project-test', 'task-1', { limit: 100 })
    expect(useTaskRunsMock).toHaveBeenCalledWith('project-test', 'task-1', { limit: 100 })
  })

  it('routes the latest run by taskStepId and does not route an unrun step', async () => {
    const user = userEvent.setup(); renderPage(); await user.click(screen.getByText('查看最新 TaskRun：run-1')); expect(screen.getByText('execution-route')).toBeInTheDocument()
    useTaskRunsMock.mockReturnValue({ data: page([]), error: null, isError: false, isLoading: false })
    renderPage('/app/projects/project-test/tasks/task-1')
    expect(screen.getByText('尚未运行')).toBeInTheDocument()
  })

  it('cancels Task through the new mutation and refreshes after conflict', async () => {
    const user = userEvent.setup(); const refetch = vi.fn(); const mutate = vi.fn((_id: string, options: { onError: (error: Error) => void }) => options.onError(new ApiError('conflict', 409))); useTaskMock.mockReturnValue({ data: task, error: null, isError: false, isLoading: false, refetch }); useCancelTaskMock.mockReturnValue({ mutate, error: new ApiError('conflict', 409), isPending: false }); vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage(); await user.click(screen.getByRole('button', { name: '取消任务' })); await waitFor(() => expect(mutate).toHaveBeenCalledWith('task-1', expect.any(Object))); expect(refetch).toHaveBeenCalled()
  })

  it('keeps a task from another project out of the page', () => { useTaskMock.mockReturnValue({ data: { ...task, projectId: 'other-project' }, error: null, isError: false, isLoading: false }); renderPage(); expect(screen.getByText('任务不存在或不可见')).toBeInTheDocument() })
})
