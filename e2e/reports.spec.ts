import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

test.describe('Reports Index', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('reports page loads with category sections', async ({ page }) => {
    await page.goto('/reports')
    const heading = page.getByRole('heading', { name: 'Reports' })
    await expect(heading).toBeVisible()
  })

  test('shows all 4 category sections', async ({ page }) => {
    await page.goto('/reports')
    await expect(
      page.getByText('Core Financial Statements')
    ).toBeVisible()
    await expect(
      page.getByText('Operational Dashboards')
    ).toBeVisible()
    await expect(page.getByText('Fund & Funding Reports')).toBeVisible()
    await expect(page.getByText('Specialized Reports')).toBeVisible()
  })

  test('shows 14 available report cards as links', async ({ page }) => {
    await page.goto('/reports')
    // Each available report is wrapped in a link to /reports/<slug>
    const reportLinks = page.locator('a[href^="/reports/"]')
    await expect(reportLinks).toHaveCount(14)
  })

  test('shows Coming Soon badges for Phase 16 reports', async ({ page }) => {
    await page.goto('/reports')
    const comingSoon = page.getByText('Coming Soon')
    const count = await comingSoon.count()
    expect(count).toBeGreaterThan(0)
  })

  test('clicking a report card navigates to the report', async ({ page }) => {
    await page.goto('/reports')
    const balanceSheetLink = page.locator(
      'a[href="/reports/balance-sheet"]'
    )
    await expect(balanceSheetLink).toBeVisible()
    await balanceSheetLink.click()
    await expect(page).toHaveURL(/\/reports\/balance-sheet/)
  })
})

test.describe('Report #1 — Balance Sheet', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title and sections', async ({ page }) => {
    await page.goto('/reports/balance-sheet')
    await expect(
      page.getByText('Statement of Financial Position')
    ).toBeVisible()
  })

  test('shows section headers', async ({ page }) => {
    await page.goto('/reports/balance-sheet')
    // Core balance sheet sections should be rendered
    await expect(page.getByText('ASSETS')).toBeVisible()
    await expect(page.getByText('LIABILITIES')).toBeVisible()
    await expect(page.getByText('NET ASSETS')).toBeVisible()
  })

  test('shows "As of" date', async ({ page }) => {
    await page.goto('/reports/balance-sheet')
    await expect(page.getByText(/As of/)).toBeVisible()
  })

  test('shows export buttons', async ({ page }) => {
    await page.goto('/reports/balance-sheet')
    await expect(page.getByTestId('export-pdf-btn')).toBeVisible()
    await expect(page.getByTestId('export-csv-btn')).toBeVisible()
  })

  test('shows generated timestamp', async ({ page }) => {
    await page.goto('/reports/balance-sheet')
    await expect(page.getByText(/Generated:/)).toBeVisible()
  })
})

test.describe('Report #2 — Statement of Activities', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/activities')
    await expect(
      page.getByText('Statement of Activities')
    ).toBeVisible()
  })

  test('shows revenue and expense sections', async ({ page }) => {
    await page.goto('/reports/activities')
    await expect(
      page.getByText('REVENUE').first()
    ).toBeVisible()
    await expect(
      page.getByText('EXPENSES').first()
    ).toBeVisible()
  })
})

test.describe('Report #3 — Cash Flows', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/cash-flows')
    await expect(
      page.getByText('Statement of Cash Flows')
    ).toBeVisible()
  })
})

test.describe('Report #4 — Functional Expenses', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/functional-expenses')
    await expect(
      page.getByText('Statement of Functional Expenses')
    ).toBeVisible()
  })
})

test.describe('Report #5 — Cash Position', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/cash-position')
    await expect(page.getByText('Cash Position Summary')).toBeVisible()
  })
})

test.describe('Report #6 — AR Aging', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/ar-aging')
    await expect(
      page.getByText('Accounts Receivable Aging')
    ).toBeVisible()
  })
})

test.describe('Report #7 — Outstanding Payables', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/outstanding-payables')
    await expect(page.getByText('Outstanding Payables')).toBeVisible()
  })
})

test.describe('Report #8 — Rent Collection', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/rent-collection')
    await expect(
      page.getByText('Rent Collection Status')
    ).toBeVisible()
  })
})

test.describe('Report #9 — Fund Draw-Down', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/fund-drawdown')
    await expect(
      page.getByText('Fund Draw-Down')
    ).toBeVisible()
  })
})

test.describe('Report #10 — Grant Compliance', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/grant-compliance')
    await expect(
      page.getByText('Funding Compliance Tracking')
    ).toBeVisible()
  })
})

test.describe('Report #11 — Fund Level', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/fund-level')
    await expect(
      page.getByText('Fund-Level P&L and Balance Sheet')
    ).toBeVisible()
  })
})

test.describe('Report #12 — Property Expenses', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/property-expenses')
    await expect(
      page.getByText('Property Operating Expense Breakdown')
    ).toBeVisible()
  })
})

test.describe('Report #13 — Utility Trends', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/utility-trends')
    await expect(
      page.getByText('Utility Trend Analysis')
    ).toBeVisible()
  })
})

test.describe('Report #14 — Security Deposit Register', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  test('renders report title', async ({ page }) => {
    await page.goto('/reports/security-deposit-register')
    await expect(
      page.getByText('Security Deposit Register')
    ).toBeVisible()
  })
})
