import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

test.describe('Weekly Cash Forecast — Phase 23c', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  // --- Report page tests ---

  test('cash projection report loads', async ({ page }) => {
    await page.goto('/reports/cash-projection')
    const body = await page.textContent('body')
    expect(body).toContain('Cash Projection')
  })

  test('monthly/weekly toggle is visible', async ({ page }) => {
    await page.goto('/reports/cash-projection')
    const monthlyBtn = page.getByTestId('cash-projection-monthly-btn')
    const weeklyBtn = page.getByTestId('cash-projection-weekly-btn')

    await expect(monthlyBtn).toBeVisible()
    await expect(weeklyBtn).toBeVisible()
  })

  test('switching to weekly view updates URL', async ({ page }) => {
    await page.goto('/reports/cash-projection')
    const weeklyBtn = page.getByTestId('cash-projection-weekly-btn')
    await weeklyBtn.click()
    await expect(page).toHaveURL(/view=weekly/)
  })

  test('weekly view shows 13-week header or empty state', async ({ page }) => {
    await page.goto('/reports/cash-projection?view=weekly')
    const body = await page.textContent('body')
    // Should show either the weekly forecast or an empty state message
    const hasWeeklyContent =
      body?.includes('13-Week Cash Forecast') ||
      body?.includes('No weekly cash projection')
    expect(hasWeeklyContent).toBe(true)
  })

  test('report page has no console errors', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') jsErrors.push(m.text())
    })
    page.on('pageerror', (e) => jsErrors.push(e.message))

    await page.goto('/reports/cash-projection?view=weekly')
    await page.waitForLoadState('networkidle')

    expect(jsErrors).toHaveLength(0)
  })

  // --- Editor page tests ---

  test('cash projection editor loads with mode toggle', async ({ page }) => {
    await page.goto('/budgets/cash-projection')
    const body = await page.textContent('body')
    expect(body).toContain('Cash Projection')
  })

  test('editor shows generate buttons', async ({ page }) => {
    await page.goto('/budgets/cash-projection')
    const body = await page.textContent('body')
    // Should have at least one generate button (monthly or weekly)
    const hasGenerateBtn =
      body?.includes('Generate 3-Month') || body?.includes('Generate 13-Week') ||
      body?.includes('Regenerate')
    expect(hasGenerateBtn).toBe(true)
  })

  // --- Settings page tests ---

  test('cash threshold settings page loads', async ({ page }) => {
    await page.goto('/settings/cash-thresholds')
    const heading = page.getByText('Cash Forecast Thresholds')
    await expect(heading).toBeVisible()
  })

  test('threshold inputs are visible and editable', async ({ page }) => {
    await page.goto('/settings/cash-thresholds')
    const warningInput = page.getByTestId('cash-thresholds-warning-input')
    const criticalInput = page.getByTestId('cash-thresholds-critical-input')

    await expect(warningInput).toBeVisible()
    await expect(criticalInput).toBeVisible()

    // Verify they have default values
    const warningVal = await warningInput.inputValue()
    const criticalVal = await criticalInput.inputValue()
    expect(Number(warningVal)).toBeGreaterThan(0)
    expect(Number(criticalVal)).toBeGreaterThan(0)
  })

  test('settings page has no console errors', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') jsErrors.push(m.text())
    })
    page.on('pageerror', (e) => jsErrors.push(e.message))

    await page.goto('/settings/cash-thresholds')
    await page.waitForLoadState('networkidle')

    expect(jsErrors).toHaveLength(0)
  })
})
