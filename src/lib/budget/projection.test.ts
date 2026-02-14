import { describe, it, expect, vi } from 'vitest'

// Test the getStartingCash and getThreeMonthActualAverage are exported
// These require DB so we test the module structure only
describe('projection module', () => {
  it('exports getStartingCash', async () => {
    const mod = await import('./projection')
    expect(typeof mod.getStartingCash).toBe('function')
  })

  it('exports getThreeMonthActualAverage', async () => {
    const mod = await import('./projection')
    expect(typeof mod.getThreeMonthActualAverage).toBe('function')
  })

  it('exports generateProjectionLines', async () => {
    const mod = await import('./projection')
    expect(typeof mod.generateProjectionLines).toBe('function')
  })
})
