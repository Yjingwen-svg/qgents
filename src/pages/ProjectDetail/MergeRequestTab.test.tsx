import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergeRequestSummary } from '@/types/task-model'
import { MergeRequestTab } from './MergeRequestTab'

const useMergeRequestsMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/task-model', () => ({
  useMergeRequests: useMergeRequestsMock,
}))

const items: MergeRequestSummary[] = [
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
    headCommit: 'abc123456789',
    webUrl: 'https://github.com/mock/demo/pull/42',
    qualityGate: { status: 'PENDING', requiredChecks: ['TESTSET'] },
  },
  {
    id: 'mr-2',
    repositoryId: 'bound-demo-web-console',
    groupIds: ['group-1'],
    provider: 'GITHUB',
    number: 18,
    title: '登录页接入',
    sourceBranch: 'feat/login-api',
    targetBranch: 'main',
    status: 'MERGED',
    headCommit: 'def456789012',
    webUrl: null,
    qualityGate: { status: 'PASSED', requiredChecks: ['TESTSET'] },
  },
]

function renderTab(path = '/code?tab=mr') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MergeRequestTab
        projectId="demo-project"
        repositories={[
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
        ]}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useMergeRequestsMock.mockReturnValue({
    data: { data: items, page: { nextCursor: null, hasMore: false }, requestId: 'r1' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('MergeRequestTab', () => {
  it('loads merge requests through the documented list hook', () => {
    renderTab()
    expect(useMergeRequestsMock).toHaveBeenCalledWith('demo-project', {
      repositoryId: undefined,
      status: undefined,
      limit: 50,
    })
    expect(screen.getByText('实现邮箱登录')).toBeInTheDocument()
    expect(screen.getByText('auth-service')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '实现邮箱登录' })).toHaveAttribute(
      'href',
      '/app/projects/demo-project/code/mr/mr-1',
    )
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mock/demo/pull/42',
    )
  })

  it('forwards repository and status filters from the query string', () => {
    renderTab('/code?tab=mr&repositoryId=bound-demo-auth-service&status=OPEN')
    expect(useMergeRequestsMock).toHaveBeenCalledWith('demo-project', {
      repositoryId: 'bound-demo-auth-service',
      status: 'OPEN',
      limit: 50,
    })
  })
})
