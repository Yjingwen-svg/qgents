import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import type { OrchestrationRun } from '@/types'

const navigateMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null as Error | null,
}))

vi.mock('@/hooks', () => ({
  useCreateOrchestrationRun: () => mutationMock,
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import { TaskTriggerModal } from './TaskTriggerModal'

const run: OrchestrationRun = {
  id: 'orchestration-created',
  projectId: 'project-test',
  groupId: 'group-test',
  instruction: 'implement feature',
  workflowId: 'system-default-code-delivery',
  startMode: 'AUTO',
  status: 'PLANNING',
  createdBy: 'demo-user',
  workPackageIds: [],
  createdAt: '2026-08-12T08:00:00Z',
  updatedAt: '2026-08-12T08:00:00Z',
}

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TaskTriggerModal
          open
          projectId="project-test"
          groupId="group-test"
          initialInstruction="initial requirement"
          onClose={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mutationMock.mutateAsync.mockReset()
  mutationMock.reset.mockReset()
  mutationMock.isPending = false
  mutationMock.error = null
  navigateMock.mockReset()
})

describe('TaskTriggerModal', () => {
  it('requires a non-empty instruction', async () => {
    const user = userEvent.setup()
    renderModal()
    const instruction = screen.getByLabelText('任务说明')
    await user.clear(instruction)
    await user.click(screen.getByRole('button', { name: '创建任务' }))
    expect(await screen.findByText('请输入任务说明')).toBeInTheDocument()
    expect(mutationMock.mutateAsync).not.toHaveBeenCalled()
  })

  it.each([
    ['AUTO', 'AUTO：计划完成后自动启动'],
    ['MANUAL', 'MANUAL：只生成计划，后续手动启动 WorkPackage'],
  ] as const)('submits the %s start mode and fixed workflow', async (startMode, radioLabel) => {
    const user = userEvent.setup()
    mutationMock.mutateAsync.mockResolvedValue(run)
    renderModal()
    await user.click(screen.getByLabelText(radioLabel))
    await user.click(screen.getByRole('button', { name: '创建任务' }))
    await waitFor(() => expect(mutationMock.mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutationMock.mutateAsync).toHaveBeenCalledWith({
      groupId: 'group-test',
      instruction: 'initial requirement',
      workflowId: 'system-default-code-delivery',
      startMode,
    })
  })

  it('prevents duplicate submissions and navigates after success', async () => {
    const user = userEvent.setup()
    let resolveMutation: (value: OrchestrationRun) => void = () => undefined
    mutationMock.mutateAsync.mockReturnValue(new Promise<OrchestrationRun>((resolve) => {
      resolveMutation = resolve
    }))
    renderModal()
    const submitButton = screen.getByRole('button', { name: '创建任务' })
    await user.click(submitButton)
    await user.click(submitButton)
    expect(mutationMock.mutateAsync).toHaveBeenCalledTimes(1)

    resolveMutation(run)
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app/projects/project-test/tasks/orchestration-created'))
  })

  it('keeps the edited instruction after a failed request', async () => {
    const user = userEvent.setup()
    mutationMock.mutateAsync.mockRejectedValue(new ApiError('forbidden', 403))
    renderModal()
    const instruction = screen.getByLabelText('任务说明')
    await user.clear(instruction)
    await user.type(instruction, 'edited requirement')
    await user.click(screen.getByRole('button', { name: '创建任务' }))
    await waitFor(() => expect(mutationMock.mutateAsync).toHaveBeenCalledTimes(1))
    expect(instruction).toHaveValue('edited requirement')
  })

  it.each([
    [403, '暂无权限从该需求群发起任务。'],
    [409, '任务状态或幂等请求发生冲突，请刷新后重试。'],
    [422, '任务说明或启动参数未通过校验，请检查后重试。'],
  ] as const)('shows a distinct message for HTTP %s', (status, message) => {
    mutationMock.error = new ApiError('request failed', status)
    renderModal()
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})
