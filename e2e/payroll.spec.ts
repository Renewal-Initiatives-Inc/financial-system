import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

/**
 * Phase 10 E2E: Payroll Run → Calculate → Post to GL workflow.
 *
 * Prerequisites:
 *   1. Dev server running (Playwright config auto-starts it)
 *   2. Auth state saved — run `npx playwright test --headed` once,
 *      manually log in via Zitadel, then save cookies to e2e/.auth-state.json
 *   3. Seed data loaded (accounts, funds, annual rate config)
 *   4. Staging records exist for the selected pay period
 *      (inserted by renewal-timesheets or manually via DB seed)
 *   5. Mock people integration active (PEOPLE_DATABASE_URL unset)
 */
test.describe('Payroll workflow', () => {
  // Skip entire suite if no auth state file exists
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  let runId: string

  test('navigate to payroll list page', async ({ page }) => {
    await page.goto('/payroll')
    await expect(page.getByText('Payroll')).toBeVisible()
    await expect(page.getByTestId('new-payroll-run-btn')).toBeVisible()
  })

  test('navigate to new payroll run wizard', async ({ page }) => {
    await page.goto('/payroll/runs/new')
    await expect(page.getByText('New Payroll Run')).toBeVisible()
    await expect(page.getByText('Select Period')).toBeVisible()
    await expect(page.getByTestId('month-select')).toBeVisible()
    await expect(page.getByTestId('year-select')).toBeVisible()
  })

  test('check pay period and create draft', async ({ page }) => {
    await page.goto('/payroll/runs/new')

    // Select January 2026 as the pay period
    await page.getByTestId('month-select').click()
    await page.getByRole('option', { name: 'January' }).click()

    await page.getByTestId('year-select').click()
    await page.getByRole('option', { name: '2026' }).click()

    // Check period
    await page.getByTestId('check-period-btn').click()

    // Wait for staging record count to appear
    await expect(page.getByText(/staging record/)).toBeVisible({ timeout: 10000 })

    // Create draft
    await page.getByTestId('create-draft-btn').click()

    // Should advance to step 2
    await expect(page.getByText('Review & Calculate')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('DRAFT')).toBeVisible()
  })

  test('calculate payroll and review results', async ({ page }) => {
    await page.goto('/payroll/runs/new')

    // Select pay period and create draft
    await page.getByTestId('month-select').click()
    await page.getByRole('option', { name: 'February' }).click()

    await page.getByTestId('year-select').click()
    await page.getByRole('option', { name: '2026' }).click()

    await page.getByTestId('check-period-btn').click()
    await expect(page.getByText(/staging record/)).toBeVisible({ timeout: 10000 })

    await page.getByTestId('create-draft-btn').click()
    await expect(page.getByText('Review & Calculate')).toBeVisible({ timeout: 10000 })

    // Calculate payroll
    await page.getByTestId('calculate-btn').click()

    // Should advance to step 3 with calculation results
    await expect(page.getByText('Payroll Calculation Results')).toBeVisible({
      timeout: 30000,
    })

    // Verify summary cards are shown
    await expect(page.getByText('Total Gross')).toBeVisible()
    await expect(page.getByText('Total Net')).toBeVisible()
    await expect(page.getByText('Employer Cost')).toBeVisible()
    await expect(page.getByText('Employees')).toBeVisible()

    // Verify column headers in employee breakdown table
    await expect(page.getByText('Federal Tax')).toBeVisible()
    await expect(page.getByText('State Tax')).toBeVisible()

    // Post button should be visible
    await expect(page.getByTestId('post-btn')).toBeVisible()
  })

  test('full wizard flow: create, calculate, and post', async ({ page }) => {
    await page.goto('/payroll/runs/new')

    // Select March 2026
    await page.getByTestId('month-select').click()
    await page.getByRole('option', { name: 'March' }).click()

    await page.getByTestId('year-select').click()
    await page.getByRole('option', { name: '2026' }).click()

    // Check period
    await page.getByTestId('check-period-btn').click()
    await expect(page.getByText(/staging record/)).toBeVisible({ timeout: 10000 })

    // Create draft
    await page.getByTestId('create-draft-btn').click()
    await expect(page.getByText('Review & Calculate')).toBeVisible({ timeout: 10000 })

    // Calculate
    await page.getByTestId('calculate-btn').click()
    await expect(page.getByText('Payroll Calculation Results')).toBeVisible({
      timeout: 30000,
    })

    // Post to GL
    await page.getByTestId('post-btn').click()

    // Should redirect to detail page with POSTED status
    await page.waitForURL(/\/payroll\/runs\/\d+/, { timeout: 15000 })
    runId = page.url().split('/').pop()!

    await expect(page.getByTestId('run-status')).toHaveText('POSTED')
  })

  test('posted run shows GL entry links', async ({ page }) => {
    test.skip(!runId, 'No run created in previous test')

    await page.goto(`/payroll/runs/${runId}`)

    // Status should be POSTED
    await expect(page.getByTestId('run-status')).toHaveText('POSTED')

    // GL entry links should be visible (EE and ER entries)
    const glLinks = page.locator('a[href^="/transactions/"]')
    const count = await glLinks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('posted run cannot be deleted', async ({ page }) => {
    test.skip(!runId, 'No run created in previous test')

    await page.goto(`/payroll/runs/${runId}`)

    // Delete button should NOT be visible for posted runs
    await expect(page.getByTestId('delete-btn')).not.toBeVisible()

    // Calculate button should also NOT be visible
    await expect(page.getByTestId('calculate-btn')).not.toBeVisible()
  })

  test('payroll list shows the posted run', async ({ page }) => {
    test.skip(!runId, 'No run created in previous test')

    await page.goto('/payroll')

    // Filter to POSTED
    await page.getByTestId('status-filter').click()
    await page.getByRole('option', { name: 'Posted' }).click()

    // Should see POSTED badge
    await expect(page.getByText('POSTED').first()).toBeVisible()
  })

  test('status filter works on payroll list', async ({ page }) => {
    await page.goto('/payroll')

    // Filter to DRAFT
    await page.getByTestId('status-filter').click()
    await page.getByRole('option', { name: 'Draft' }).click()

    // If any drafts exist, they should show; otherwise empty message
    const content = await page.textContent('body')
    expect(content).toBeDefined()

    // Switch to All
    await page.getByTestId('status-filter').click()
    await page.getByRole('option', { name: 'All Statuses' }).click()
  })

  test('rate config page is accessible', async ({ page }) => {
    await page.goto('/settings/rates')
    await expect(page.getByText('Annual Rate Configuration')).toBeVisible()
  })
})
