import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentAssignmentSummary, AgentDetail, AgentTaskRunSummary } from '@/types'

const hooks = vi.hoisted(() => ({ useAgents: vi.fn(), useAgent: vi.fn(), useAgentSkillBindings: vi.fn(), useAgentAssignments: vi.fn(), useAgentTaskRuns: vi.fn(), useCreateAgent: vi.fn(), useUpdateAgent: vi.fn(), usePublishAgent: vi.fn(), useUnpublishAgent: vi.fn(), useArchiveAgent: vi.fn() }))
const projectGet = vi.hoisted(() => vi.fn())
vi.mock('@/hooks', () => hooks)
vi.mock('@/api', () => ({ projectApi: { getById: projectGet } }))
import { AgentTeamPage } from './AgentTeamPage'

const agent: AgentDetail = { id: 'agent-one', name: 'Agent One', avatar: null, role: 'DEVELOPER', capabilities: ['TypeScript'], visibility: 'PRIVATE', status: 'ACTIVE', createdBy: 'user-001', description: '负责接口实现', runtime: { status: 'RUNNING', activeRunCount: 1, concurrencyLimit: 2, assignmentUsage: { requirementGroups: { assignedCount: 1, assignableCount: 2 }, workflows: { assignedCount: 1, assignableCount: 1 } } }, prompt: 'private prompt', tools: ['测试运行'], memoryAccess: ['当前项目共享 Memory'] }
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null }
const assignment: AgentAssignmentSummary = { type: 'REQUIREMENT_GROUP', resourceId: 'group-one', resourceName: '登录功能', status: 'ACTIVE' }
const run: AgentTaskRunSummary = { id: 'run-one', projectId: 'project-one', taskId: 'task-one', taskStepId: 'step-one', agentId: agent.id, role: 'DEVELOPER', status: 'FAILED', retryOfTaskRunId: null, createdAt: '2026-08-14T08:00:00Z', startedAt: '2026-08-14T08:01:00Z', finishedAt: '2026-08-14T08:03:00Z', durationMs: 120000, task: { id: 'task-one', displayId: 'TASK-1', title: '实现登录' }, taskStep: { id: 'step-one', title: '实现接口', role: 'DEVELOPER' }, requirementGroup: { id: 'group-one', name: '登录功能' }, repository: { id: 'repo-one', displayName: 'qgents-web' }, statusReason: { code: 'TEST_FAILED', summary: '测试未通过。' } }

function renderPage(url = '/app/projects/project-one/agents?agentId=agent-one') { render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><Routes><Route path="/app/projects/:projectId/agents" element={<AgentTeamPage />} /></Routes></MemoryRouter></QueryClientProvider>) }

beforeEach(() => {
  vi.clearAllMocks()
  projectGet.mockResolvedValue({ teamId: 'team-one' })
  hooks.useAgents.mockReturnValue({ data: { data: [agent] }, isLoading: false, isError: false, refetch: vi.fn() })
  hooks.useAgent.mockReturnValue({ data: agent, isLoading: false, isError: false, refetch: vi.fn() })
  hooks.useAgentSkillBindings.mockReturnValue({ data: { agentId: agent.id, skillIds: ['skill-one'], skills: [{ id: 'skill-one', name: 'TypeScript', visibility: 'PROJECT_SHARED', status: 'PUBLISHED' }], updatedAt: '2026-08-13T00:00:00Z' }, isError: false, isLoading: false })
  hooks.useAgentAssignments.mockReturnValue({ data: { data: [assignment], page: { nextCursor: null, hasMore: false } }, isError: false, isLoading: false })
  hooks.useAgentTaskRuns.mockReturnValue({ data: { data: [run], page: { nextCursor: null, hasMore: false } }, isError: false, isLoading: false })
  hooks.useCreateAgent.mockReturnValue(mutation); hooks.useUpdateAgent.mockReturnValue(mutation); hooks.usePublishAgent.mockReturnValue(mutation); hooks.useUnpublishAgent.mockReturnValue(mutation); hooks.useArchiveAgent.mockReturnValue(mutation)
})

describe('AgentTeamPage', () => {
  it('uses project teamId and renders the list, selection and overview', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Agent One').length).toBeGreaterThan(0))
    expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
    expect(hooks.useAgents).toHaveBeenLastCalledWith('project-one', 'team-one')
    expect(hooks.useAgent).toHaveBeenLastCalledWith('project-one', 'team-one', 'agent-one')
    expect(hooks.useAgentAssignments).toHaveBeenCalledWith('project-one', 'agent-one', 'REQUIREMENT_GROUP', false)
    expect(hooks.useAgentTaskRuns).toHaveBeenCalledWith('project-one', 'agent-one', undefined, true)
    expect(hooks.useAgentSkillBindings).toHaveBeenCalledWith('project-one', 'agent-one', false)
  })

  it('shows independent assignment and run tabs', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Agent One').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '分配详情' }))
    expect(screen.getAllByText('登录功能').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '运行记录' }))
    expect(screen.getByText('TASK-1')).toBeInTheDocument()
    expect(screen.getByText('测试未通过。')).toBeInTheDocument()
  })

  it('keeps assignment errors independent and shows capability empty states', async () => {
    hooks.useAgentAssignments.mockImplementation((_projectId: string, _agentId: string, type: string) => type === 'REQUIREMENT_GROUP'
      ? { data: undefined, isError: true, isLoading: false }
      : { data: { data: [], page: { nextCursor: null, hasMore: false } }, isError: false, isLoading: false })
    hooks.useAgent.mockReturnValue({ data: { ...agent, tools: [], memoryAccess: [] }, isLoading: false, isError: false, refetch: vi.fn() })
    hooks.useAgentSkillBindings.mockReturnValue({ data: { agentId: agent.id, skillIds: [], skills: [], updatedAt: '2026-08-13T00:00:00Z' }, isError: false, isLoading: false })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Agent One').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '分配详情' }))
    expect(screen.getByText('分配详情加载失败')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '能力与工具' }))
    expect(screen.getByText('暂无 Skill')).toBeInTheDocument()
    expect(screen.getByText('暂无 Memory 范围数据')).toBeInTheDocument()
    expect(screen.getByText('暂无正式工具信息')).toBeInTheDocument()
  })

  it('shows empty and error states without treating them as the same', async () => {
    hooks.useAgents.mockImplementation(() => ({ data: { data: [] }, isLoading: false, isError: false, refetch: vi.fn() }))
    renderPage('/app/projects/project-one/agents')
    await waitFor(() => expect(screen.getAllByText('暂无 Agent').length).toBeGreaterThan(0))
  })

  it('replaces an invalid URL Agent with the first valid Agent', async () => {
    renderPage('/app/projects/project-one/agents?agentId=missing-agent')
    await waitFor(() => expect(hooks.useAgent).toHaveBeenLastCalledWith('project-one', 'team-one', 'agent-one'))
  })

  it('reloads a failed list query', async () => {
    const refetch = vi.fn()
    hooks.useAgents.mockImplementation(() => ({ data: undefined, isLoading: false, isError: true, error: { status: 500 }, refetch }))
    renderPage()
    await waitFor(() => expect(screen.getByText('Agent 服务暂时不可用')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the custom Agent entry available', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: '添加 Agent' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '配置' }))
    expect(screen.getByText(/不新增保存字段/)).toBeInTheDocument()
  })
})
