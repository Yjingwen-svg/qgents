import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Deliverable } from '@/types'
import { DeliverablesPage } from './DeliverablesPage'

Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) })
class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = TestResizeObserver

const useAcceptDeliverableMock = vi.hoisted(() => vi.fn())
const useDeliverableMock = vi.hoisted(() => vi.fn())
const useProjectDeliverablesMock = vi.hoisted(() => vi.fn())
const useRejectDeliverableMock = vi.hoisted(() => vi.fn())
const useOrchestrationRunsMock = vi.hoisted(() => vi.fn())
const useWorkPackagesMock = vi.hoisted(() => vi.fn())
const useWorkPackageMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks', () => ({ useAcceptDeliverable: useAcceptDeliverableMock, useDeliverable: useDeliverableMock, useProjectDeliverables: useProjectDeliverablesMock, useRejectDeliverable: useRejectDeliverableMock, useOrchestrationRuns: useOrchestrationRunsMock, useWorkPackages: useWorkPackagesMock, useWorkPackage: useWorkPackageMock }))

const pending: Deliverable = { id: 'deliverable-1', projectId: 'project-1', workPackageId: 'work-package-1', taskRunId: 'task-run-1', title: 'Login API delivery', type: 'CODE', version: 1, status: 'PENDING_REVIEW', repositoryId: 'repo-1', sourceRef: 'feature/login', diffId: 'diff-1', mergeRequestId: null, rejectionReason: null, summary: 'Implementation summary', createdAt: '2026-08-12T08:00:00Z', updatedAt: '2026-08-12T08:00:00Z' }
const accepted: Deliverable = { ...pending, status: 'ACCEPTED' }
const emptyPage = { data: [], page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }
function page(deliverable: Deliverable = pending) { return { data: { data: [deliverable], page: { nextCursor: null, hasMore: false }, requestId: 'request-1' }, error: null, isError: false, isLoading: false, refetch: vi.fn() } }
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output> }
function renderPage() { render(<MemoryRouter initialEntries={['/app/projects/project-1/deliverables/deliverable-1']}><Routes><Route path="/app/projects/:projectId/deliverables/:deliverableId" element={<DeliverablesPage />} /></Routes><LocationProbe /></MemoryRouter>) }

beforeEach(() => {
  cleanup()
  useProjectDeliverablesMock.mockReturnValue(page())
  useDeliverableMock.mockReturnValue({ data: pending, error: null, isError: false, isLoading: false, refetch: vi.fn() })
  useOrchestrationRunsMock.mockReturnValue({ data: emptyPage, error: null, isError: false, isLoading: false })
  useWorkPackagesMock.mockReturnValue({ data: emptyPage, error: null, isError: false, isLoading: false })
  useWorkPackageMock.mockReturnValue({ data: { title: 'Login API', id: 'work-package-1' } })
  useAcceptDeliverableMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
  useRejectDeliverableMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: false })
})

describe('DeliverablesPage', () => {
  it('shows actions for pending review and accepts after confirmation callback', async () => {
    const accept = vi.fn((_input: unknown, options: { onSuccess: () => void }) => options.onSuccess())
    useAcceptDeliverableMock.mockReturnValue({ mutate: accept, error: null, isPending: false })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: '接受交付物' })[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /确定|OK/ }))
    await waitFor(() => expect(accept).toHaveBeenCalledWith({ deliverableId: 'deliverable-1' }, expect.any(Object)))
  })

  it('requires a rejection reason and preserves it after validation failure', async () => {
    const reject = vi.fn()
    useRejectDeliverableMock.mockReturnValue({ mutate: reject, error: null, isPending: false })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: '拒绝交付物' })[0])
    fireEvent.click(screen.getByRole('button', { name: '确认拒绝' }))
    expect(reject).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('请输入拒绝原因'), { target: { value: 'Missing checks' } })
    fireEvent.click(screen.getByRole('button', { name: '确认拒绝' }))
    await waitFor(() => expect(reject).toHaveBeenCalledWith({ deliverableId: 'deliverable-1', input: { reason: 'Missing checks' } }, expect.any(Object)))
  })

  it('prevents duplicate submission and makes processed deliverables read-only', () => {
    useAcceptDeliverableMock.mockReturnValue({ mutate: vi.fn(), error: null, isPending: true })
    renderPage()
    expect(screen.getAllByRole('button', { name: '接受交付物' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '拒绝交付物' })[0]).toBeDisabled()
    cleanup()
    useDeliverableMock.mockReturnValue({ data: accepted, error: null, isError: false, isLoading: false, refetch: vi.fn() })
    useProjectDeliverablesMock.mockReturnValue(page(accepted))
    renderPage()
    expect(screen.queryByRole('button', { name: '接受交付物' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '拒绝交付物' })).not.toBeInTheDocument()
    expect(screen.getAllByText('已接受').length).toBeGreaterThan(0)
  })

  it('returns from detail to the delivery center path', () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: '返回交付中心' })[0])
    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-1/deliverables')
  })
})
