import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDetail, AgentSummary } from '@/types'
import { AgentTeamPage } from './AgentTeamPage'

const useAgentsMock = vi.hoisted(() => vi.fn())
const useAgentMock = vi.hoisted(() => vi.fn())
const useProjectSkillOptionsMock = vi.hoisted(() => vi.fn())
const useCreateAgentMock = vi.hoisted(() => vi.fn())
const useUpdateAgentMock = vi.hoisted(() => vi.fn())
const usePublishAgentMock = vi.hoisted(() => vi.fn())
const useUnpublishAgentMock = vi.hoisted(() => vi.fn())
const useArchiveAgentMock = vi.hoisted(() => vi.fn())
const useBindAgentSkillsMock = vi.hoisted(() => vi.fn())
const projectGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({ useAgents: useAgentsMock, useAgent: useAgentMock, useProjectSkillOptions: useProjectSkillOptionsMock, useCreateAgent: useCreateAgentMock, useUpdateAgent: useUpdateAgentMock, usePublishAgent: usePublishAgentMock, useUnpublishAgent: useUnpublishAgentMock, useArchiveAgent: useArchiveAgentMock, useBindAgentSkills: useBindAgentSkillsMock }))
vi.mock('@/api', () => ({ projectApi: { getById: projectGetMock } }))

const presentation = { concurrencyLimit: 2, requirementUsage: { used: 1, total: 3 }, workflowUsage: { used: 1, total: 2 }, skillScope: 'PROJECT' as const, memoryScope: 'PROJECT' as const, assignmentDetails: [], runningTasks: [], runRecords: [] }
const permissions = { canEdit: true, canPublish: true, canUnpublish: true, canArchive: true, canBindSkills: true, canViewPrivateConfig: true }
const summary: AgentSummary = { id: 'agent-one', teamId: 'team-one', name: 'Agent One', avatar: null, role: 'DEVELOPER', capabilities: ['TypeScript'], description: 'Frontend', visibility: 'PRIVATE', availability: 'IDLE', createdBy: 'demo-user', permissions, presentation }
const detail: AgentDetail = { ...summary, prompt: 'private prompt', config: { temperature: 0.2 }, skillBindings: [] }

function mutation() { return { mutate: vi.fn(), mutateAsync: vi.fn(async () => detail), error: null, isPending: false } }
function renderPage(initialEntry = '/app/projects/project-one/agents') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/app/projects/:projectId/agents" element={<AgentTeamPage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  projectGetMock.mockResolvedValue({ id: 'project-one', teamId: 'team-one', name: 'Project One' })
  useAgentsMock.mockReturnValue({ data: { data: [summary], page: { nextCursor: null, hasMore: false } }, isPending: false, isSuccess: true, isError: false })
  useAgentMock.mockReturnValue({ data: detail, isPending: false, isError: false })
  useProjectSkillOptionsMock.mockReturnValue({ data: [], isPending: false })
  useCreateAgentMock.mockReturnValue(mutation()); useUpdateAgentMock.mockReturnValue(mutation()); usePublishAgentMock.mockReturnValue(mutation()); useUnpublishAgentMock.mockReturnValue(mutation()); useArchiveAgentMock.mockReturnValue(mutation()); useBindAgentSkillsMock.mockReturnValue(mutation())
})

describe('AgentTeamPage', () => {
  it('shows a team-context loading state before the project teamId is available', () => {
    projectGetMock.mockImplementation(() => new Promise(() => undefined))
    useAgentsMock.mockReturnValue({ data: undefined, isPending: true, isLoading: false, isError: false, fetchStatus: 'idle' })

    renderPage()

    expect(screen.getByText('团队信息加载中')).toBeInTheDocument()
    expect(useAgentsMock).toHaveBeenCalledWith('')
  })

  it('does not treat a disabled Agent Query as an active list request', async () => {
    projectGetMock.mockResolvedValue({ id: 'project-one', teamId: '', name: 'Project One' })
    useAgentsMock.mockReturnValue({ data: undefined, isPending: true, isLoading: false, isError: false, fetchStatus: 'idle' })

    renderPage()

    expect(await screen.findByText('项目未提供团队信息，无法加载 Agent 团队。')).toBeInTheDocument()
    expect(screen.queryByText('正在加载 Agent 列表')).not.toBeInTheDocument()
  })

  it('renders Query data and restores selected Agent from URL', async () => {
    renderPage('/app/projects/project-one/agents?agentId=agent-one')
    expect((await screen.findAllByText('Agent One')).length).toBeGreaterThan(0)
    expect(screen.getByText(/private prompt/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布为 TEAM_SHARED' })).toBeInTheDocument()
  })

  it('does not expose private prompt or actions for an Agent returned as read-only', async () => {
    const readOnly = { ...detail, permissions: { ...permissions, canEdit: false, canPublish: false, canUnpublish: false, canArchive: false, canBindSkills: false, canViewPrivateConfig: false }, prompt: undefined }
    useAgentsMock.mockReturnValue({ data: { data: [readOnly], page: { nextCursor: null, hasMore: false } }, isPending: false, isSuccess: true, isError: false })
    useAgentMock.mockReturnValue({ data: readOnly, isPending: false, isError: false })
    renderPage('/app/projects/project-one/agents?agentId=agent-one')
    expect(await screen.findByText('Prompt 为私有配置，当前用户无权查看。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发布为 TEAM_SHARED' })).not.toBeInTheDocument()
  })

  it('submits create form and uses the update mutation for edit', async () => {
    const user = userEvent.setup()
    const create = mutation(); const update = mutation(); useCreateAgentMock.mockReturnValue(create); useUpdateAgentMock.mockReturnValue(update)
    renderPage('/app/projects/project-one/agents?agentId=agent-one')
    await user.click((await screen.findByText('添加 Agent')).closest('button') as HTMLElement)
    await user.type(screen.getByLabelText('名称'), ' Created')
    await user.type(screen.getByLabelText('Prompt'), 'prompt')
    await user.type(screen.getByLabelText('能力'), 'docs{enter}')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalled())
    cleanup()
    renderPage('/app/projects/project-one/agents?agentId=agent-one')
    await user.click(await screen.findByRole('button', { name: /编辑/ }))
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalled())
  })
})
