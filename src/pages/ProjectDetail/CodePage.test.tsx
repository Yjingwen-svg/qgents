import { render, screen } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubApi } from '@/api/github'
import { groupApi } from '@/api/group'
import { workBranchesApi } from '@/api/workBranches'
import type { WorkBranch } from '@/types/workBranch'
import { CodePage } from './CodePage'

vi.mock('@/api/github', () => ({
  githubApi: {
    listProjectRepositories: vi.fn(),
  },
}))

vi.mock('@/api/group', () => ({
  groupApi: {
    listByProject: vi.fn(),
  },
}))

vi.mock('@/api/workBranches', () => ({
  workBranchesApi: {
    list: vi.fn(),
  },
}))

const workBranches: WorkBranch[] = [
  {
    id: 'wb-1',
    projectRepositoryId: 'bound-demo-auth-service',
    name: 'feat/login-api',
    workspaceId: 'ws-1',
    lastKnownHead: 'a1b2c3d',
    latestTask: { id: 'task-1', displayCode: 'T-1024', title: '登录接口开发' },
    requirementGroups: [{ id: 'group-login', title: '登录功能' }],
    latestDiff: {
      id: 'diff-login',
      taskId: 'task-1',
      status: 'PENDING_REVIEW',
      changeStats: { additions: 12, deletions: 3 },
    },
    openMergeRequest: { id: 'mr-1', number: 42, status: 'OPEN' },
    lastVerification: {
      kind: 'TEST_RUN',
      status: 'PASSED',
      commitSha: 'a1b2c3d',
      completedAt: '2026-08-17T12:00:00Z',
    },
  },
  {
    id: 'wb-2',
    projectRepositoryId: 'bound-demo-auth-service',
    name: 'feat/no-diff',
    workspaceId: 'ws-2',
    lastKnownHead: null,
    latestTask: null,
    requirementGroups: [],
    latestDiff: null,
    openMergeRequest: null,
    lastVerification: null,
  },
]

function renderPage(path = '/app/projects/demo-project/code') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/code" element={<CodePage />} />
            <Route path="/app/projects/:projectId/tasks/:taskId" element={<div>task detail</div>} />
            <Route path="/app/projects/:projectId/code/diff/:diffId" element={<div>diff detail</div>} />
            <Route path="/app/projects/:projectId/code/mr/:mergeRequestId" element={<div>mr detail</div>} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
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
  vi.mocked(groupApi.listByProject).mockResolvedValue([
    {
      id: 'group-login',
      projectId: 'demo-project',
      type: 'REQUIREMENT',
      title: '登录功能',
      status: 'ACTIVE',
      latestActivityAt: '2026-08-12T10:00:00Z',
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
    },
  ])
  vi.mocked(workBranchesApi.list).mockResolvedValue({
    data: workBranches,
    page: { nextCursor: null, hasMore: false },
    requestId: 'req_work_branches',
  })
})

describe('CodePage', () => {
  it('shows the branch workspace by default', async () => {
    renderPage()
    expect(await screen.findByText('需求过滤')).toBeInTheDocument()
    expect(await screen.findByText('feat/login-api')).toBeInTheDocument()
    expect(screen.queryByText('实现邮箱登录')).not.toBeInTheDocument()
  })

  it('loads requirement filters from groups API', async () => {
    renderPage()
    await screen.findByText('需求过滤')
    expect(groupApi.listByProject).toHaveBeenCalledWith('demo-project')
  })

  it('links Diff only when latestDiff.id is present', async () => {
    renderPage()
    const linked = await screen.findByTitle('查看该分支最新 Diff')
    expect(linked).toHaveAttribute('href', '/app/projects/demo-project/code/diff/diff-login')
    expect(linked).toHaveTextContent('+12')
    expect(linked).toHaveTextContent('-3')
    expect(screen.queryByTitle('该分支暂无变更，打开空 Diff')).not.toBeInTheDocument()
    expect(screen.getByTitle('该工作分支暂无 Diff 快照')).toBeInTheDocument()
  })

  it('shows open MR from the work-branch row', async () => {
    renderPage()
    const mr = await screen.findByRole('link', { name: '#42' })
    expect(mr).toHaveAttribute('href', '/app/projects/demo-project/code/mr/mr-1')
  })
})
