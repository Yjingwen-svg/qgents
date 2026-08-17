import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubApi } from '@/api/github'
import type { MergeRequestSummary } from '@/types/task-model'
import { CodePage } from './CodePage'

const useDiffsMock = vi.hoisted(() => vi.fn())
const useMergeRequestsMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/task-model', () => ({
  useDiffs: useDiffsMock,
  useMergeRequests: useMergeRequestsMock,
}))

vi.mock('@/api/github', () => ({
  githubApi: {
    listProjectRepositories: vi.fn(),
  },
}))

const mergeRequests: MergeRequestSummary[] = [
  {
    id: 'mr-1',
    repositoryId: 'bound-demo-auth-service',
    groupIds: ['group-1'],
    provider: 'GITHUB',
    number: 42,
    title: '实现邮箱登录',
    sourceBranch: 'feat/login-api',
    targetBranch: 'main',
    status: 'OPEN',
    headCommit: 'abc1234',
    webUrl: 'https://github.com/mock/demo/pull/42',
    qualityGate: { status: 'PENDING', requiredChecks: ['TESTSET'] },
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
  useDiffsMock.mockReturnValue({ data: { data: [] }, isLoading: false })
  useMergeRequestsMock.mockReturnValue({
    data: { data: mergeRequests, page: { nextCursor: null, hasMore: false }, requestId: 'r1' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('CodePage', () => {
  it('shows the branch workspace by default', async () => {
    renderPage()
    expect(await screen.findByText('需求过滤')).toBeInTheDocument()
    expect(screen.queryByText('实现邮箱登录')).not.toBeInTheDocument()
  })

  it('opens the MR list tab from the documented query string', async () => {
    renderPage('/app/projects/demo-project/code?tab=mr')
    expect(await screen.findByText('实现邮箱登录')).toBeInTheDocument()
    expect(screen.getByText('#42')).toBeInTheDocument()
    expect(useMergeRequestsMock).toHaveBeenCalledWith('demo-project', {
      repositoryId: undefined,
      status: undefined,
      limit: 50,
    })
    expect(screen.queryByText('需求过滤')).not.toBeInTheDocument()
  })

  it('switches to the MR tab from the page tabs', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('需求过滤')
    await user.click(screen.getByRole('tab', { name: 'MR' }))
    expect(await screen.findByText('实现邮箱登录')).toBeInTheDocument()
  })

  it('keeps zero-diff stats clickable into an empty review shell', async () => {
    renderPage()
    const zeroDiffs = await screen.findAllByTitle('该分支暂无变更，打开空 Diff')
    expect(zeroDiffs.length).toBeGreaterThan(0)
    expect(zeroDiffs[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/\/app\/projects\/demo-project\/code\/diff\/empty-branch/),
    )
  })

  it('syncs Diff changeStats onto the branch Diff column', async () => {
    useDiffsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'diff-login',
            projectId: 'demo-project',
            taskId: 'task-1',
            taskRunId: 'run-1',
            taskStepId: 'step-1',
            requirementGroupId: 'login',
            workspaceId: 'ws-1',
            repositoryId: 'bound-demo-auth-service',
            baseCommit: 'base',
            sourceBranch: 'feat/login-api',
            headCommit: null,
            status: 'PENDING_REVIEW',
            changeStats: { files: 2, additions: 12, deletions: 3 },
            createdAt: '2026-08-12T10:00:00Z',
          },
        ],
        page: { nextCursor: null, hasMore: false },
        requestId: 'r-diffs',
      },
      isLoading: false,
    })
    renderPage()
    expect(await screen.findByTitle('查看该分支 Diff')).toBeInTheDocument()
    expect(screen.getByTitle('查看该分支 Diff')).toHaveTextContent('+12')
    expect(screen.getByTitle('查看该分支 Diff')).toHaveTextContent('-3')
  })
})
