import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDetail } from '@/types'

const hooks = vi.hoisted(() => ({ useAgents: vi.fn(), useAgent: vi.fn(), useAgentSkillBindings: vi.fn(), useCreateAgent: vi.fn(), useUpdateAgent: vi.fn(), usePublishAgent: vi.fn(), useUnpublishAgent: vi.fn(), useArchiveAgent: vi.fn() }))
const projectGet = vi.hoisted(() => vi.fn())
vi.mock('@/hooks', () => hooks)
vi.mock('@/api', () => ({ projectApi: { getById: projectGet } }))
import { AgentTeamPage } from './AgentTeamPage'

const agent: AgentDetail = { id: 'agent-one', name: 'Agent One', avatar: null, role: 'DEVELOPER', capabilities: ['TypeScript'], visibility: 'PRIVATE', status: 'ACTIVE', createdBy: 'user', prompt: 'private prompt' }
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null }
function renderPage(url = '/app/projects/project-one/agents?agentId=agent-one') { render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><Routes><Route path="/app/projects/:projectId/agents" element={<AgentTeamPage />} /></Routes></MemoryRouter></QueryClientProvider>) }
beforeEach(() => { vi.clearAllMocks(); projectGet.mockResolvedValue({ teamId: 'team-one' }); hooks.useAgents.mockReturnValue({ data: { data: [agent] }, isLoading: false, isError: false }); hooks.useAgent.mockReturnValue({ data: agent, isLoading: false, isError: false, refetch: vi.fn() }); hooks.useAgentSkillBindings.mockReturnValue({ data: { agentId: agent.id, skillIds: ['skill-one'], skills: [{ id: 'skill-one', name: 'TypeScript', visibility: 'PROJECT_SHARED', status: 'PUBLISHED' }], updatedAt: '2026-08-13T00:00:00Z' }, isError: false }); hooks.useCreateAgent.mockReturnValue(mutation); hooks.useUpdateAgent.mockReturnValue(mutation); hooks.usePublishAgent.mockReturnValue(mutation); hooks.useUnpublishAgent.mockReturnValue(mutation); hooks.useArchiveAgent.mockReturnValue(mutation) })
describe('AgentTeamPage', () => {
  it('restores the selected Agent from URL and uses documented DTO fields', async () => { renderPage(); await waitFor(() => expect(screen.getAllByText('Agent One').length).toBeGreaterThan(0)); expect(screen.getByText('运行状态：暂无数据')).toBeInTheDocument(); expect(screen.getByRole('button', { name: '发布为 TEAM' })).toBeInTheDocument() })
  it('does not use a Prompt fallback when the detail omits it', async () => { hooks.useAgent.mockReturnValue({ data: { ...agent, prompt: undefined }, isLoading: false, isError: false, refetch: vi.fn() }); renderPage(); await waitFor(() => expect(screen.getByText('Prompt：未提供或无权限查看')).toBeInTheDocument()) })
  it('renders read-only Skill data without binding controls', async () => { renderPage(); await waitFor(() => expect(screen.getByText('Skill：TypeScript')).toBeInTheDocument()); expect(screen.queryByRole('button', { name: /绑定 Skill/ })).not.toBeInTheDocument() })
  it('keeps Agent details visible when Skill data is unavailable or fails', async () => { hooks.useAgentSkillBindings.mockReturnValue({ data: undefined, isError: true }); renderPage(); await waitFor(() => expect(screen.getByText('Skill：Skill 模块尚未接入')).toBeInTheDocument()); expect(screen.getByText('Prompt：private prompt')).toBeInTheDocument() })
  it('shows a safe error for an invalid URL agentId', async () => { renderPage('/app/projects/project-one/agents?agentId=missing'); await waitFor(() => expect(screen.getByText('Agent 不存在或当前不可见')).toBeInTheDocument()) })
})
