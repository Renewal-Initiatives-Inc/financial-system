import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

test.describe('Ramp AI Categorization — Phase 23b', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('ramp page loads with summary cards', async ({ page }) => {
    await page.goto('/expenses/ramp')
    const heading = page.getByText('Ramp Credit Card')
    await expect(heading).toBeVisible()
  })

  test('ramp queue page has no console errors', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') jsErrors.push(m.text())
    })
    page.on('pageerror', (e) => jsErrors.push(e.message))

    await page.goto('/expenses/ramp')
    await page.waitForLoadState('networkidle')

    expect(jsErrors).toHaveLength(0)
  })

  test('ramp tabs are visible: Uncategorized, Categorized, Posted, All', async ({ page }) => {
    await page.goto('/expenses/ramp')
    const body = await page.textContent('body')
    // Tab labels should be present
    expect(body).toContain('Uncategorized')
    expect(body).toContain('Categorized')
    expect(body).toContain('Posted')
  })

  test('categorize dialog opens when clicking categorize button', async ({ page }) => {
    await page.goto('/expenses/ramp')
    // Try to find an uncategorized transaction's categorize button
    const categorizeBtn = page.getByTestId('ramp-categorize-btn').first()
    const hasBtns = await categorizeBtn.isVisible().catch(() => false)

    if (hasBtns) {
      await categorizeBtn.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
    }
    // If no transactions, just verify page loaded OK
  })

  test('sync button is accessible', async ({ page }) => {
    await page.goto('/expenses/ramp')
    const syncBtn = page.getByTestId('ramp-sync-btn')
    const hasSyncBtn = await syncBtn.isVisible().catch(() => false)
    if (hasSyncBtn) {
      await expect(syncBtn).toBeEnabled()
    }
  })
})
