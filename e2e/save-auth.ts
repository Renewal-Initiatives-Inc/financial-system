import { chromium } from '@playwright/test'
import * as path from 'path'
import * as readline from 'readline'

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json')

async function saveAuth() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: false, slowMo: 500 })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('Navigating to login page...')
  try {
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
  } catch (err) {
    console.error('Failed to load login page:', err)
    await browser.close()
    return
  }

  console.log('\n========================================')
  console.log('Log in via Zitadel in the browser window.')
  console.log('Once you see the dashboard, come back')
  console.log('here and press Enter to save auth state.')
  console.log('========================================\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>((resolve) => {
    rl.question('Press Enter when logged in...', () => {
      rl.close()
      resolve()
    })
  })

  const url = page.url()
  console.log(`Current page URL: ${url}`)

  await context.storageState({ path: AUTH_STATE_PATH })
  console.log(`\nAuth state saved to ${AUTH_STATE_PATH}`)

  await browser.close()
}

saveAuth().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
