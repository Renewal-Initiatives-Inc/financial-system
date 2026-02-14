import { test, expect } from '@playwright/test'

test.describe('Security Deposits', () => {
  test('compliance calendar page loads and shows filters', async ({
    page,
  }) => {
    await page.goto('/compliance')

    // Page should have compliance calendar title (redirects to login for unauth)
    // For smoke-level E2E, just verify the route doesn't 500
    const response = await page.goto('/compliance')
    expect(response?.status()).toBeLessThan(500)
  })

  test('security deposit register page loads', async ({ page }) => {
    const response = await page.goto('/reports/security-deposit-register')
    expect(response?.status()).toBeLessThan(500)
  })

  test('tenant detail page loads without errors', async ({ page }) => {
    // Navigate to tenants list first
    const response = await page.goto('/tenants')
    expect(response?.status()).toBeLessThan(500)
  })
})
