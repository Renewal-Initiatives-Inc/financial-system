/**
 * UI Smoke Test — Phase 1 only: page load checks
 *
 * Visits every static route and reports load errors, error boundaries,
 * and 4xx/5xx responses. Skips button clicking and link traversal.
 *
 * Fast: ~30 seconds with 4 parallel shards.
 *
 * Usage:
 *   1. npx tsx e2e/save-auth.ts          (one-time: save login session)
 *   2. npx playwright test e2e/ui-smoke.spec.ts
 *
 * Or via /ui-smoke skill.
 */
import { test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import type { Page } from '@playwright/test'

const AUTH_STATE = path.join(__dirname, '.auth-state.json')
const HAS_AUTH = fs.existsSync(AUTH_STATE)
const REPORT_PATH = path.join(__dirname, '..', 'ui-smoke-report.md')
const SHARD_DIR = path.join(__dirname, '..', '.ui-smoke-shards')

const ROUTES = [
  '/',
  '/accounts',
  '/assets',
  '/assets/cip',
  '/assets/cip/convert',
  '/assets/developer-fee',
  '/assets/prepaid',
  '/bank-rec',
  '/bank-rec/settings',
  '/budgets',
  '/budgets/new',
  '/budgets/cash-projection',
  '/compliance',
  '/compliance/1099-prep',
  '/compliance/990-readiness',
  '/compliance/functional-allocation',
  '/donors',
  '/expenses',
  '/expenses/payables',
  '/expenses/purchase-orders',
  '/expenses/purchase-orders/new',
  '/expenses/ramp',
  '/expenses/ramp/rules',
  '/migration-review',
  '/payroll',
  '/payroll/runs/new',
  '/reports',
  '/reports/activities',
  '/reports/amortization-schedule',
  '/reports/ar-aging',
  '/reports/audit-log',
  '/reports/balance-sheet',
  '/reports/board-pack',
  '/reports/capital-budget',
  '/reports/cash-flows',
  '/reports/cash-position',
  '/reports/cash-projection',
  '/reports/compliance-calendar',
  '/reports/donor-giving-history',
  '/reports/employer-payroll-cost',
  '/reports/form-990-data',
  '/reports/functional-expenses',
  '/reports/fund-drawdown',
  '/reports/fund-level',
  '/reports/grant-compliance',
  '/reports/late-entries',
  '/reports/outstanding-payables',
  '/reports/payroll-register',
  '/reports/payroll-tax-liability',
  '/reports/property-expenses',
  '/reports/quarterly-tax-prep',
  '/reports/rent-collection',
  '/reports/security-deposit-register',
  '/reports/transaction-history',
  '/reports/utility-trends',
  '/reports/w2-verification',
  '/revenue',
  '/revenue/donations',
  '/revenue/earned-income',
  '/revenue/funding-sources',
  '/revenue/funding-sources/new',
  '/revenue/in-kind',
  '/revenue/investment-income',
  '/revenue/pledges',
  '/revenue/rent',
  '/revenue/rent/adjustment',
  '/revenue/rent/payment',
  '/settings',
  '/settings/data-retention',
  '/settings/rates',
  '/settings/staging',
  '/tenants',
  '/transactions',
  '/transactions/new',
  '/vendors',
]

interface Issue {
  route: string
  error: string
}

const SHARD_COUNT = 4

function getShardRoutes(shardIndex: number): string[] {
  const size = Math.ceil(ROUTES.length / SHARD_COUNT)
  return ROUTES.slice(shardIndex * size, (shardIndex + 1) * size)
}

function setupErrorTracking(page: Page) {
  let jsErrors: string[] = []
  let consoleErrors: string[] = []
  let apiErrors: string[] = []

  page.on('pageerror', (err) => {
    if (err.message.includes('Switched to client rendering because the server rendering errored')) return
    jsErrors.push(err.message)
  })
  page.on('dialog', (d) => d.dismiss())
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (text.includes('Warning:')) return
      if (text.includes('DevTools')) return
      if (text.includes('Download the React DevTools')) return
      if (text.includes('was not wrapped in act')) return
      if (text.includes('A tree hydrated but some attributes of the server rendered HTML')) return
      if (text.includes('Failed to load resource')) return
      if (text.includes('ClientFetchError')) return
      if (text.startsWith('%o')) return
      if (text.includes('Database not configured')) return
      consoleErrors.push(text.substring(0, 300))
    }
  })
  page.on('response', (resp) => {
    if (resp.status() >= 500) {
      try {
        const url = new URL(resp.url())
        apiErrors.push(`${resp.status()} ${url.pathname}`)
      } catch {
        apiErrors.push(`${resp.status()} ${resp.url().substring(0, 100)}`)
      }
    }
  })

  return {
    reset() {
      jsErrors = []
      consoleErrors = []
      apiErrors = []
    },
    harvest(issues: Issue[], route: string) {
      for (const e of jsErrors) issues.push({ route, error: `JS: ${e}` })
      for (const e of consoleErrors) issues.push({ route, error: `Console: ${e}` })
      for (const e of apiErrors) issues.push({ route, error: `API: ${e}` })
    },
  }
}

async function hasErrorBoundary(page: Page): Promise<string | null> {
  const phrases = ['something went wrong', 'application error', 'unhandled runtime error']
  for (const phrase of phrases) {
    const visible = await page.locator(`text=/${phrase}/i`).first().isVisible().catch(() => false)
    if (visible) return phrase
  }
  return null
}

function writeShardReport(shardIndex: number, issues: Issue[], routes: string[]) {
  fs.mkdirSync(SHARD_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(SHARD_DIR, `shard-${shardIndex}.json`),
    JSON.stringify({ shardIndex, issues, routes })
  )
}

function mergeShardReports() {
  if (!fs.existsSync(SHARD_DIR)) return

  const allIssues: Issue[] = []
  const allRoutes: string[] = []

  for (let i = 0; i < SHARD_COUNT; i++) {
    const file = path.join(SHARD_DIR, `shard-${i}.json`)
    if (!fs.existsSync(file)) continue
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    allIssues.push(...data.issues)
    allRoutes.push(...data.routes)
  }

  const shardFiles = fs.readdirSync(SHARD_DIR).filter((f) => f.startsWith('shard-') && f.endsWith('.json'))
  if (shardFiles.length < SHARD_COUNT) return

  let md = '# UI Smoke Report\n\n'
  md += `**Date:** ${new Date().toISOString().split('T')[0]}\n`
  md += `**Routes checked:** ${allRoutes.length}\n`
  md += `**Issues:** ${allIssues.length}\n\n`

  if (allIssues.length === 0) {
    md += 'All pages loaded without errors.\n'
  } else {
    const grouped = new Map<string, Issue[]>()
    for (const issue of allIssues) {
      if (!grouped.has(issue.route)) grouped.set(issue.route, [])
      grouped.get(issue.route)!.push(issue)
    }
    md += '## Issues\n\n'
    for (const [route, routeIssues] of grouped) {
      md += `### \`${route}\`\n\n`
      for (const i of routeIssues) {
        md += `- ${i.error}\n`
      }
      md += '\n'
    }

    const cleanRoutes = allRoutes.filter((r) => !allIssues.some((i) => i.route === r))
    if (cleanRoutes.length > 0) {
      md += `## Clean (${cleanRoutes.length}/${allRoutes.length})\n\n`
      md += cleanRoutes.map((r) => `- ${r}`).join('\n') + '\n'
    }
  }

  fs.writeFileSync(REPORT_PATH, md)
  for (const f of shardFiles) fs.unlinkSync(path.join(SHARD_DIR, f))
  try { fs.rmdirSync(SHARD_DIR) } catch { /* ignore */ }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`UI SMOKE — ${allIssues.length} issues across ${allRoutes.length} routes`)
  console.log(`Report: ${REPORT_PATH}`)
  console.log('═'.repeat(50))
}

// ══════════════════════════════════════════════════
// PARALLEL SHARD TESTS
// ══════════════════════════════════════════════════
test.describe('UI Smoke', () => {
  test.skip(!HAS_AUTH, 'Skipped — run npx tsx e2e/save-auth.ts first')
  test.use({ storageState: AUTH_STATE })

  for (let shard = 0; shard < SHARD_COUNT; shard++) {
    test(`Shard ${shard + 1}/${SHARD_COUNT}`, async ({ page }) => {
      test.setTimeout(120_000) // 2 min per shard

      const routes = getShardRoutes(shard)
      const issues: Issue[] = []
      const tracker = setupErrorTracking(page)

      console.log(`\n[Shard ${shard + 1}] Loading ${routes.length} pages`)

      for (const route of routes) {
        tracker.reset()
        try {
          const resp = await page.goto(route, { timeout: 15000, waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1500)

          if (page.url().includes('/login')) {
            issues.push({ route, error: 'Redirected to /login (auth expired — run: npx tsx e2e/save-auth.ts)' })
            console.log(`  [S${shard + 1}] AUTH  ${route}`)
            continue
          }

          if (resp && resp.status() >= 400) {
            issues.push({ route, error: `HTTP ${resp.status()}` })
          }

          const boundary = await hasErrorBoundary(page)
          if (boundary) {
            issues.push({ route, error: `Error boundary: "${boundary}"` })
          }

          tracker.harvest(issues, route)

          const bad = issues.filter((i) => i.route === route).length
          console.log(`  [S${shard + 1}] ${bad > 0 ? 'FAIL' : ' OK '} ${route}${bad > 0 ? ` (${bad})` : ''}`)
        } catch (err: any) {
          issues.push({ route, error: `Navigation failed: ${err.message.substring(0, 200)}` })
          console.log(`  [S${shard + 1}] FAIL ${route} (nav error)`)
        }
      }

      writeShardReport(shard, issues, routes)
      mergeShardReports()
    })
  }
})
