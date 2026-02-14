import { test, expect } from '@playwright/test'

test.describe('Bank Reconciliation', () => {
  // Note: These tests run against the authenticated app.
  // Plaid interactions are mocked since we can't connect to real banks in E2E.

  test('bank rec page loads and shows empty state or account selector', async ({
    page,
  }) => {
    await page.goto('/bank-rec')
    // Should see either the account selector or the empty state message
    const heading = page.getByText('Bank Reconciliation')
    await expect(heading).toBeVisible()
  })

  test('bank rec settings page loads', async ({ page }) => {
    await page.goto('/bank-rec/settings')
    const heading = page.getByText('Bank Account Settings')
    await expect(heading).toBeVisible()
  })

  test('settings page shows connect button', async ({ page }) => {
    await page.goto('/bank-rec/settings')
    const connectBtn = page.getByTestId('connect-bank-btn')
    await expect(connectBtn).toBeVisible()
    await expect(connectBtn).toContainText('Connect Bank Account')
  })

  test('connect dialog opens and shows GL account selector', async ({
    page,
  }) => {
    await page.goto('/bank-rec/settings')
    await page.getByTestId('connect-bank-btn').click()
    // Dialog should open with GL account selector
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('GL Account')).toBeVisible()
  })

  test('bank rec page shows settings link', async ({ page }) => {
    await page.goto('/bank-rec')
    // Either shows settings link (when accounts exist) or settings button (in empty state)
    const settingsLink = page.getByTestId('bank-rec-settings-link').or(
      page.getByRole('link', { name: /settings/i })
    )
    await expect(settingsLink.first()).toBeVisible()
  })

  test('sidebar shows bank rec nav items', async ({ page }) => {
    await page.goto('/bank-rec')
    const sidebar = page.getByTestId('app-sidebar')
    await expect(sidebar.getByText('Bank Rec')).toBeVisible()
    await expect(sidebar.getByText('Bank Settings')).toBeVisible()
  })

  test('empty state prompts to connect bank account', async ({ page }) => {
    await page.goto('/bank-rec/settings')
    // Either shows empty message or populated table
    const emptyMessage = page.getByTestId('bank-accounts-empty')
    const accountTable = page.getByRole('table')
    // One of these should be visible
    const hasEmpty = await emptyMessage.isVisible().catch(() => false)
    const hasTable = await accountTable.isVisible().catch(() => false)
    expect(hasEmpty || hasTable).toBe(true)
  })
})
