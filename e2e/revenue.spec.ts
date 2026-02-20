import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

/**
 * Phase 7 E2E: Revenue Recording workflows.
 *
 * Prerequisites:
 *   1. Dev server running (Playwright config auto-starts it)
 *   2. Auth state saved — run `npx playwright test --headed` once,
 *      manually log in via Zitadel, then save cookies to e2e/.auth-state.json
 *   3. Seed data loaded (accounts, funds, donors, vendors/funders)
 */
test.describe('Revenue hub', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to revenue hub and see navigation cards', async ({ page }) => {
    await page.goto('/revenue')
    await expect(page.getByText('Revenue')).toBeVisible()
    await expect(page.getByText('Rent')).toBeVisible()
    await expect(page.getByText('Funding Sources')).toBeVisible()
    await expect(page.getByText('Donations')).toBeVisible()
    await expect(page.getByText('Pledges')).toBeVisible()
  })
})

test.describe('Donation workflow', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to donations page', async ({ page }) => {
    await page.goto('/revenue/donations')
    await expect(page.getByText('Donations')).toBeVisible()
    await expect(page.getByText('Record Donation')).toBeVisible()
  })

  test('record a donation with all required fields', async ({ page }) => {
    await page.goto('/revenue/donations')

    // Select donor
    await page.getByTestId('donation-donor-select').click()
    await page.getByRole('option').first().click()

    // Enter amount > $250 for acknowledgment trigger
    await page.getByTestId('donation-amount').fill('500.00')

    // Set date
    await page.getByTestId('donation-date').fill('2026-02-14')

    // Select fund
    await page.getByTestId('donation-fund-select').click()
    await page.getByRole('option').first().click()

    // Select contribution source type
    await page.getByTestId('donation-source-type-select').click()
    await page.getByRole('option').first().click()

    // Submit
    await page.getByTestId('donation-submit').click()

    // Verify success toast
    await expect(page.getByText('Donation recorded')).toBeVisible()
  })

  test('donation form shows acknowledgment notice for amounts > $250', async ({ page }) => {
    await page.goto('/revenue/donations')

    // Enter amount > $250
    await page.getByTestId('donation-amount').fill('300.00')

    // Should show acknowledgment notice
    await expect(page.getByText('Acknowledgment letter will be sent')).toBeVisible()
  })

  test('donation form does not show acknowledgment for amounts <= $250', async ({ page }) => {
    await page.goto('/revenue/donations')

    // Enter amount <= $250
    await page.getByTestId('donation-amount').fill('200.00')

    // Should not show acknowledgment notice
    await expect(page.getByText('Acknowledgment letter will be sent')).not.toBeVisible()
  })
})

test.describe('Funding Source workflow', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to funding sources list', async ({ page }) => {
    await page.goto('/revenue/funding-sources')
    await expect(page.getByText('Funding Sources')).toBeVisible()
    await expect(page.getByTestId('create-funding-source-btn')).toBeVisible()
  })

  test('create a restricted funding source', async ({ page }) => {
    await page.goto('/revenue/funding-sources/new')

    // Enter name
    await page.getByTestId('funding-source-name').fill('Test Grant Fund')

    // Select restriction type (Restricted)
    await page.getByTestId('funding-source-restriction-select').click()
    await page.getByRole('option', { name: 'Restricted' }).click()

    // Select funder (vendor)
    await page.getByTestId('funding-source-funder-select').click()
    await page.getByRole('option').first().click()

    // Enter amount
    await page.getByTestId('funding-source-amount').fill('50000.00')

    // Select type (unconditional)
    await page.getByTestId('funding-source-type-select').click()
    await page.getByRole('option', { name: 'Unconditional' }).click()

    // Submit
    await page.getByTestId('funding-source-submit').click()

    // Should redirect to funding sources list or show success
    await expect(page.getByText('Funding source created')).toBeVisible()
  })
})

test.describe('Pledge workflow', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to pledges page', async ({ page }) => {
    await page.goto('/revenue/pledges')
    await expect(page.getByText('Pledges')).toBeVisible()
    await expect(page.getByText('Record New Pledge')).toBeVisible()
  })

  test('create a pledge', async ({ page }) => {
    await page.goto('/revenue/pledges')

    // Select donor
    await page.getByTestId('pledge-donor-select').click()
    await page.getByRole('option').first().click()

    // Enter amount
    await page.getByTestId('pledge-amount').fill('1000.00')

    // Set expected date
    await page.getByTestId('pledge-expected-date').fill('2026-06-30')

    // Select fund
    await page.getByTestId('pledge-fund-select').click()
    await page.getByRole('option').first().click()

    // Submit
    await page.getByTestId('pledge-submit').click()

    // Verify success
    await expect(page.getByText('Pledge recorded')).toBeVisible()
  })
})

test.describe('Other revenue pages', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('navigate to rent overview', async ({ page }) => {
    await page.goto('/revenue/rent')
    await expect(page.getByText('Rent')).toBeVisible()
  })

  test('navigate to earned income page', async ({ page }) => {
    await page.goto('/revenue/earned-income')
    await expect(page.getByText('Earned Income')).toBeVisible()
  })

  test('navigate to investment income page', async ({ page }) => {
    await page.goto('/revenue/investment-income')
    await expect(page.getByText('Investment Income')).toBeVisible()
  })

  test('navigate to AHP forgiveness page', async ({ page }) => {
    await page.goto('/revenue/ahp-forgiveness')
    await expect(page.getByText('AHP Loan Forgiveness')).toBeVisible()
  })

  test('navigate to in-kind contributions page', async ({ page }) => {
    await page.goto('/revenue/in-kind')
    await expect(page.getByText('In-Kind Contributions')).toBeVisible()
  })
})
