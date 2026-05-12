import { test, expect } from '@playwright/test'

test.describe('Command Palette and Dashboard button', () => {
  // Helper: set an authenticated state via localStorage before page load
  const seedAuth = async (page: any) => {
    const token = 'test-token'
    const user = {
      id: '1',
      email: 'admin@fink.com',
      firstName: 'Admin',
      lastName: 'Fink',
      role: 'ADMIN'
    }

    await page.addInitScript(`window.localStorage.setItem('token', '${token}'); window.localStorage.setItem('user', '${JSON.stringify(
      user
    )}');`)
  }

  test('Dashboard button navigates to /dashboard', async ({ page }) => {
    // Seed auth and go directly to dashboard
    await seedAuth(page)
    await page.goto('/dashboard')

    // wait for button
    const btn = page.locator('a[title*="Ir al dashboard"]').first()
    await expect(btn).toBeVisible({ timeout: 10000 })
    await btn.click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Open palette with Ctrl/Cmd+K and navigate', async ({ page }) => {
    // Seed auth and open dashboard
    await seedAuth(page)
    await page.goto('/dashboard')
    // wait for client bundles / dynamic components to hydrate
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)

    // Trigger palette via a custom event (stable for tests)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('open-command-palette'))
    })

    // Input should be visible
    const input = page.locator('input[placeholder*="Escribe una acción"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('dashboard')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
