import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpTooltip } from './help-tooltip'

describe('HelpTooltip', () => {
  it('renders the help icon for a known term', () => {
    render(<HelpTooltip term="fund" />)
    const icon = screen.getByTestId('help-tooltip-fund')
    expect(icon).toBeInTheDocument()
  })

  it('returns null for an unknown term', () => {
    const { container } = render(<HelpTooltip term="nonexistent-term-xyz" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders for multiple known terms', () => {
    const { rerender } = render(<HelpTooltip term="normal-balance" />)
    expect(screen.getByTestId('help-tooltip-normal-balance')).toBeInTheDocument()

    rerender(<HelpTooltip term="system-locked" />)
    expect(screen.getByTestId('help-tooltip-system-locked')).toBeInTheDocument()

    rerender(<HelpTooltip term="form-990-line" />)
    expect(screen.getByTestId('help-tooltip-form-990-line')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<HelpTooltip term="fund" className="ml-2" />)
    const icon = screen.getByTestId('help-tooltip-fund')
    expect(icon).toHaveClass('ml-2')
  })
})
