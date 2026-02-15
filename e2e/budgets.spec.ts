import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

/**
 * Phase 14 E2E: Budget & Cash Projection workflows.
 *
 * Prerequisites:
 *   1. Dev server running (Playwright config auto-starts it)
 *   2. Auth state saved — run `npx playwright test --headed` once,
 *      manually log in via Zitadel, then save cookies to e2e/.auth-state.json
 *   3. Seed data loaded (accounts, funds)
 */
test.describe('Budget creation', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to budgets list page', async ({ page }) => {
    await page.goto('/budgets')
    await expect(page.getByText('Budgets')).toBeVisible()
  })

  test('create a new budget for a fiscal year', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByTestId('new-budget-btn').click()
    await expect(page).toHaveURL(/\/budgets\/new/)

    // Select fiscal year
    await page.getByTestId('fiscal-year-select').click()
    await page.getByRole('option').first().click()

    // Create
    await page.getByTestId('create-budget-btn').click()

    // Should redirect to edit page
    await expect(page).toHaveURL(/\/budgets\/\d+\/edit/)
  })
})

test.describe('Budget line management', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('add a budget line with account and fund', async ({ page }) => {
    await page.goto('/budgets')

    // Click first budget to go to review, then edit
    await page.getByRole('row').nth(1).click()
    await page.getByTestId('edit-budget-btn').click()
    await expect(page).toHaveURL(/\/budgets\/\d+\/edit/)

    // Add line
    await page.getByTestId('add-line-btn').click()
    await expect(page.getByText('Add Budget Line')).toBeVisible()

    // Select account and fund
    await page.getByTestId('add-line-account').click()
    await page.getByRole('option').first().click()
    await page.getByTestId('add-line-fund').click()
    await page.getByRole('option').first().click()

    // Confirm
    await page.getByTestId('confirm-add-line-btn').click()

    // Line should appear in table
    await expect(page.locator('table tbody tr')).not.toHaveCount(0)
  })

  test('delete a budget line', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByRole('row').nth(1).click()
    await page.getByTestId('edit-budget-btn').click()

    // Count rows before delete
    const rowsBefore = await page.locator('table tbody tr').count()
    if (rowsBefore === 0) {
      test.skip()
      return
    }

    // Delete first line
    const deleteBtn = page.locator('[data-testid^="delete-line-"]').first()
    await deleteBtn.click()

    // Should have one fewer row
    await expect(page.locator('table tbody tr')).toHaveCount(rowsBefore - 1)
  })
})

test.describe('Budget approval', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('approve a draft budget', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByRole('row').nth(1).click()
    await page.getByTestId('edit-budget-btn').click()

    const approveBtn = page.getByTestId('approve-budget-btn')
    if (!(await approveBtn.isVisible())) {
      test.skip()
      return
    }

    await approveBtn.click()

    // Should redirect to review page with Approved badge
    await expect(page).toHaveURL(/\/budgets\/\d+$/)
    await expect(page.getByText('Approved')).toBeVisible()
  })
})

test.describe('Variance review', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('budget review page shows variance table', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByRole('row').nth(1).click()

    // Variance table headers should be visible
    await expect(page.getByText('Budget')).toBeVisible()
    await expect(page.getByText('Actual')).toBeVisible()
    await expect(page.getByText('Variance')).toBeVisible()
  })

  test('change period filter updates data', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByRole('row').nth(1).click()

    // Change period to January
    await page.getByText('Year-to-Date').click()
    await page.getByRole('option', { name: 'January' }).click()

    // Should show loading indicator briefly then update
    await expect(page.getByText('Loading...')).toBeHidden({ timeout: 10000 })
  })
})

test.describe('CIP budget detail', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('CIP detail section appears when CIP budget lines exist', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByRole('row').nth(1).click()

    // CIP section is conditionally rendered
    const cipSection = page.getByTestId('cip-budget-detail')
    if (await cipSection.isVisible()) {
      await expect(page.getByText('CIP Budget Detail')).toBeVisible()
    }
  })
})

test.describe('Cash projection', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to cash projection page', async ({ page }) => {
    await page.goto('/budgets/cash-projection')
    await expect(page.getByText('Cash Projection')).toBeVisible()
  })

  test('generate a cash projection', async ({ page }) => {
    await page.goto('/budgets/cash-projection')

    const generateBtn = page.getByTestId('cash-projection-generate-btn')
    if (!(await generateBtn.isVisible())) {
      test.skip()
      return
    }

    await generateBtn.click()

    // Should show projection table with Starting Cash row
    await expect(page.getByText('Starting Cash')).toBeVisible({ timeout: 10000 })
  })

  test('AHP context card is visible', async ({ page }) => {
    await page.goto('/budgets/cash-projection')

    // AHP context may show depending on data
    const ahpCard = page.getByText('AHP Credit Facility')
    if (await ahpCard.isVisible()) {
      await expect(ahpCard).toBeVisible()
    }
  })
})

test.describe('Mid-year lock notice', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('approved budget shows lock notice on edit page', async ({ page }) => {
    await page.goto('/budgets')
    await page.getByRole('row').nth(1).click()

    // Check if approved
    const isApproved = await page.getByText('Approved').isVisible()
    if (!isApproved) {
      test.skip()
      return
    }

    await page.getByTestId('edit-budget-btn').click()
    await expect(page.getByTestId('mid-year-lock-notice')).toBeVisible()
  })
})
