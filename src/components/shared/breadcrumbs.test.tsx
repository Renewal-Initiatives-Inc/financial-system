import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumbs } from './breadcrumbs'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

import { usePathname } from 'next/navigation'

const mockedUsePathname = vi.mocked(usePathname)

describe('Breadcrumbs', () => {
  it('renders "Dashboard" for root path', () => {
    mockedUsePathname.mockReturnValue('/')
    render(<Breadcrumbs />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders breadcrumb for /vendors', () => {
    mockedUsePathname.mockReturnValue('/vendors')
    render(<Breadcrumbs />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Vendors')).toBeInTheDocument()
  })

  it('renders breadcrumb for /bank-rec with display name', () => {
    mockedUsePathname.mockReturnValue('/bank-rec')
    render(<Breadcrumbs />)
    expect(screen.getByText('Bank Reconciliation')).toBeInTheDocument()
  })

  it('Dashboard is a link when not on root', () => {
    mockedUsePathname.mockReturnValue('/vendors')
    render(<Breadcrumbs />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink).toHaveAttribute('href', '/')
  })

  it('last segment is not a link', () => {
    mockedUsePathname.mockReturnValue('/vendors')
    render(<Breadcrumbs />)
    const vendorsElement = screen.getByText('Vendors')
    expect(vendorsElement.closest('a')).toBeNull()
  })
})
