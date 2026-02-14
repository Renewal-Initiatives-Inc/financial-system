import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

/**
 * Phase 8 E2E: Purchase Order → Invoice → GL → Payables workflow.
 *
 * Prerequisites:
 *   1. Dev server running (Playwright config auto-starts it)
 *   2. Auth state saved — run `npx playwright test --headed` once,
 *      manually log in via Zitadel, then save cookies to e2e/.auth-state.json
 *   3. Seed data loaded (vendors, accounts, funds, CIP cost codes)
 */
test.describe('Purchase Order workflow', () => {
  // Skip entire suite if no auth state file exists
  test.beforeAll(() => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      test.skip()
    }
  })

  test.use({ storageState: AUTH_STATE_PATH })

  let poId: string

  test('navigate to expenses hub', async ({ page }) => {
    await page.goto('/expenses')
    await expect(page.getByText('Purchase Orders')).toBeVisible()
    await expect(page.getByText('Outstanding Payables')).toBeVisible()
  })

  test('navigate to purchase orders list', async ({ page }) => {
    await page.goto('/expenses/purchase-orders')
    await expect(page.getByTestId('po-new-btn')).toBeVisible()
    await expect(page.getByTestId('po-table')).toBeVisible()
  })

  test('create a new purchase order', async ({ page }) => {
    await page.goto('/expenses/purchase-orders/new')

    // Select a vendor
    await page.getByTestId('po-vendor-select').click()
    await page.getByRole('option').first().click()

    // Fill description
    await page.getByTestId('po-description').fill('E2E Test PO — CIP Construction')

    // Set total amount
    await page.getByTestId('po-total-amount').fill('25000.00')

    // Select GL destination account (pick first available)
    await page.getByTestId('po-gl-account').click()
    await page.getByRole('option').first().click()

    // Select fund
    await page.getByTestId('po-fund').click()
    await page.getByRole('option').first().click()

    // Save as Draft
    await page.getByTestId('po-save-draft-btn').click()

    // Should redirect to detail page
    await page.waitForURL(/\/expenses\/purchase-orders\/\d+/)
    poId = page.url().split('/').pop()!

    // Verify PO details are shown
    await expect(page.getByText('E2E Test PO — CIP Construction')).toBeVisible()
  })

  test('activate the purchase order', async ({ page }) => {
    test.skip(!poId, 'No PO created in previous test')

    await page.goto(`/expenses/purchase-orders/${poId}`)
    await page.getByTestId('po-activate-btn').click()

    // Status should change to ACTIVE
    await expect(page.getByText('ACTIVE')).toBeVisible()
  })

  test('create an invoice against the PO', async ({ page }) => {
    test.skip(!poId, 'No PO created in previous test')

    await page.goto(`/expenses/purchase-orders/${poId}`)
    await page.getByTestId('po-add-invoice-btn').click()

    // Should navigate to invoice creation form
    await page.waitForURL(new RegExp(`/expenses/purchase-orders/${poId}/invoices/new`))

    // Fill invoice form
    await page.getByTestId('invoice-number').fill('E2E-INV-001')
    await page.getByTestId('invoice-amount').fill('5000.00')
    await page.getByTestId('invoice-date').fill('2026-02-14')

    // Submit
    await page.getByTestId('invoice-submit-btn').click()

    // Should redirect back to PO detail
    await page.waitForURL(new RegExp(`/expenses/purchase-orders/${poId}`))

    // Verify invoice appears in the list
    await expect(page.getByText('E2E-INV-001')).toBeVisible()
    await expect(page.getByText('$5,000.00')).toBeVisible()
  })

  test('verify GL entry was created for the invoice', async ({ page }) => {
    test.skip(!poId, 'No PO created in previous test')

    await page.goto(`/expenses/purchase-orders/${poId}`)

    // Invoice row should show POSTED status
    await expect(page.getByText('POSTED')).toBeVisible()
  })

  test('verify PO remaining budget updated', async ({ page }) => {
    test.skip(!poId, 'No PO created in previous test')

    await page.goto(`/expenses/purchase-orders/${poId}`)

    // Remaining should be $20,000 (25000 - 5000)
    await expect(page.getByText('$20,000.00')).toBeVisible()
  })

  test('mark invoice as payment in process', async ({ page }) => {
    test.skip(!poId, 'No PO created in previous test')

    await page.goto(`/expenses/purchase-orders/${poId}`)

    // Find and click the mark payment button for the invoice
    const markPaymentBtn = page.locator('[data-testid^="mark-payment-btn-"]').first()
    await markPaymentBtn.click()

    // Status should update
    await expect(page.getByText('PAYMENT_IN_PROCESS')).toBeVisible()
  })

  test('verify outstanding payables page shows the payable', async ({ page }) => {
    await page.goto('/expenses/payables')

    // Should show the AP payable from our invoice
    await expect(page.getByText('E2E-INV-001')).toBeVisible()
    await expect(page.getByText('PAYMENT_IN_PROCESS')).toBeVisible()
  })

  test('filter payables by type', async ({ page }) => {
    await page.goto('/expenses/payables')

    // Click AP filter
    await page.getByTestId('payables-filter-ap').click()
    await expect(page.getByText('E2E-INV-001')).toBeVisible()

    // Switch to Credit Card filter — our invoice should not appear
    await page.getByTestId('payables-filter-credit_card').click()
    await expect(page.getByText('E2E-INV-001')).not.toBeVisible()
  })
})
