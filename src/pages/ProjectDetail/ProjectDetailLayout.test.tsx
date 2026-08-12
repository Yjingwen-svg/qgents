import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProjectDetailLayout } from './ProjectDetailLayout'

vi.mock('@/pages/ProjectDetail/requirements', () => ({ PROJECT_REQUIREMENTS: [] }))

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

describe('ProjectDetailLayout deliverables navigation', () => {
  it('shows the delivery center entry and navigates with the project path', () => {
    render(
      <MemoryRouter initialEntries={['/app/projects/project-1/overview']}>
        <Routes><Route path="/app/projects/:projectId/*" element={<ProjectDetailLayout />} /></Routes>
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByText('交付中心'))

    expect(screen.getByTestId('location')).toHaveTextContent('/app/projects/project-1/deliverables')
  })

  it('keeps delivery center selected on the detail route', () => {
    render(
      <MemoryRouter initialEntries={['/app/projects/project-1/deliverables/deliverable-1']}>
        <Routes><Route path="/app/projects/:projectId/*" element={<ProjectDetailLayout />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('menuitem', { name: /交付中心/ })).toHaveClass('ant-menu-item-selected')
  })
})
