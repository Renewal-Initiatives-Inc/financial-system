import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('unauthenticated user is redirected to login page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders sign-in button', async ({ page }) => {
    await page.goto('/login')
    const signInButton = page.getByTestId('login-signin-btn')
    await expect(signInButton).toBeVisible()
    await expect(signInButton).toHaveText('Sign in with Zitadel')
  })

  test('login page shows app title', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Financial System')).toBeVisible()
    await expect(page.getByText('Renewal Initiatives, Inc.')).toBeVisible()
  })
})
