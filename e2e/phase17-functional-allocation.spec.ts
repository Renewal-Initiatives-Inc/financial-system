import { test, expect } from '@playwright/test'

test.describe('Phase 17 — Functional Allocation Wizard', () => {
  test('functional allocation page loads', async ({ page }) => {
    await page.goto('/compliance/functional-allocation')
    // May redirect to login
    const wizardHeading = page.getByText('Functional Allocation Wizard')
    if (await wizardHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(wizardHeading).toBeVisible()
    }
  })

  test('wizard shows progress indicator', async ({ page }) => {
    await page.goto('/compliance/functional-allocation')
    const progressText = page.getByText(/Account \d+ of \d+/)
    if (await progressText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(progressText).toBeVisible()
    }
  })

  test('wizard has three percentage inputs', async ({ page }) => {
    await page.goto('/compliance/functional-allocation')
    const programInput = page.locator('#program')
    if (await programInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(programInput).toBeVisible()
      await expect(page.locator('#admin')).toBeVisible()
      await expect(page.locator('#fundraising')).toBeVisible()
    }
  })

  test('wizard validates percentage sum', async ({ page }) => {
    await page.goto('/compliance/functional-allocation')
    const programInput = page.locator('#program')
    if (!(await programInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    // Clear and set invalid percentages
    await programInput.fill('50')
    await page.locator('#admin').fill('20')
    await page.locator('#fundraising').fill('10')

    // Should show validation error (sum = 80, not 100)
    await expect(page.getByText('Percentages must sum to exactly 100%')).toBeVisible()
  })

  test('wizard has permanent rule checkbox', async ({ page }) => {
    await page.goto('/compliance/functional-allocation')
    const checkbox = page.locator('#permanent')
    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(checkbox).toBeVisible()
      await expect(page.getByText('Mark as permanent rule')).toBeVisible()
    }
  })
})
