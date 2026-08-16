import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubApi } from '@/api/github'
import type { GithubInstallation } from '@/types/github'
import { GitHubIntegrationPage } from './GitHubIntegrationPage'

const deleteMutateAsync = vi.hoisted(() => vi.fn())

vi.mock('@/api/github', () => ({
  githubApi: {
    listInstallations: vi.fn(),
    listTeamRepositories: vi.fn(),
    deleteInstallation: vi.fn(),
  },
}))

vi.mock('@/hooks/useGithubInstall', () => ({
  useGithubInstallRedirect: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteGithubInstallation: () => ({
    mutate: vi.fn(),
    mutateAsync: deleteMutateAsync,
    isPending: false,
    variables: undefined,
  }),
}))

const installation: GithubInstallation = {
  id: 'inst-1',
  providerInstallationId: 12345678,
  accountLogin: 'octocat',
  accountType: 'USER',
  installedAt: '2026-08-01T08:00:00Z',
  status: 'ACTIVE',
  metadataSyncedAt: '2026-08-13T10:00:00Z',
}

function QueryStringProbe() {
  const [searchParams] = useSearchParams()
  return <div data-testid="query-string">{searchParams.toString()}</div>
}

function renderPage(search: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <MemoryRouter initialEntries={[`/app/integrations/github?${search}`]}>
          <Routes>
            <Route
              path="/app/integrations/github"
              element={
                <>
                  <GitHubIntegrationPage />
                  <QueryStringProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  deleteMutateAsync.mockReset()
  deleteMutateAsync.mockResolvedValue(undefined)
  vi.mocked(githubApi.listInstallations).mockResolvedValue([])
  vi.mocked(githubApi.listTeamRepositories).mockResolvedValue([])
})

describe('GitHubIntegrationPage callback redirect', () => {
  it('shows the backend conflict message and strips one-shot query params', async () => {
    const conflictMessage =
      '该 GitHub 账号已绑定到其他团队，一个账号只能授权给一个团队。如需更换，请先到原团队解绑或卸载 GitHub App 后重新安装。'
    renderPage(
      `teamId=team-b&installed=0&conflict=GITHUB_INSTALLATION_TEAM_CONFLICT&message=${encodeURIComponent(conflictMessage)}`,
    )

    expect(await screen.findByText(conflictMessage)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('query-string').textContent).toBe('teamId=team-b')
    })
    expect(screen.queryByText('GitHub App 安装/授权已完成')).not.toBeInTheDocument()
  })

  it('still shows the success toast when installed=1 and no conflict', async () => {
    renderPage('teamId=team-b&installed=1')

    expect(await screen.findByText('GitHub App 安装/授权已完成')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('query-string').textContent).toBe('teamId=team-b')
    })
  })
})

describe('GitHubIntegrationPage uninstall', () => {
  it('asks for confirmation then uninstalls the installation without leaving the page', async () => {
    const user = userEvent.setup()
    vi.mocked(githubApi.listInstallations).mockResolvedValue([installation])
    renderPage('teamId=team-b')

    expect(await screen.findByText('octocat')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /卸载/ }))
    expect(await screen.findByText(/确定卸载「octocat」吗/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认卸载' }))
    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalledWith('inst-1')
    })
  })

  it('does not count a DELETED installation as still associated', async () => {
    vi.mocked(githubApi.listInstallations).mockResolvedValue([
      { ...installation, status: 'DELETED' },
    ])
    renderPage('teamId=team-b')

    expect(await screen.findByText('octocat')).toBeInTheDocument()
    expect(screen.getByText('当前团队已关联 0 个安装')).toBeInTheDocument()
    expect(screen.getByText('已卸载')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /卸载/ })).not.toBeInTheDocument()
  })
})
