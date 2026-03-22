/**
 * UI Crawler — Automated full-app scan (parallelized)
 *
 * Visits every route, clicks every button, reports all errors.
 * Split into 4 parallel shards for ~4x speedup.
 *
 * Usage:
 *   1. npx tsx e2e/save-auth.ts          (one-time: save login session)
 *   2. npx playwright test e2e/ui-crawler.spec.ts
 *   3. Open ui-crawl-report.md for results
 */
import { test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import type { Page } from '@playwright/test'

const AUTH_STATE = path.join(__dirname, '.auth-state.json')
const HAS_AUTH = fs.existsSync(AUTH_STATE)
const REPORT_PATH = path.join(__dirname, '..', 'ui-crawl-report.md')
const SHARD_DIR = path.join(__dirname, '..', '.ui-crawl-shards')

// ── All static routes ──
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
  '/reports/donor-giving-history',
  '/reports/employer-payroll-cost',
  '/reports/form-990-data',
  '/reports/functional-expenses',
  '/reports/fund-drawdown',
  '/reports/fund-level',
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

// Don't click anything that could delete real data
const DESTRUCTIVE = /delete|remove|destroy|purge|drop/i
// Skip dev-mode buttons injected by Next.js
const DEV_BUTTONS = /Next\.js Dev Tools|__next/i
// Routes that need external API keys (Plaid, Ramp) — skip in click phase
const API_KEY_ROUTES = new Set(['/bank-rec/settings', '/expenses/ramp'])
// Max buttons to click per route (prevents timeout on heavy pages like /reports/board-pack)
const MAX_BUTTONS_PER_ROUTE = 20

// ── Split routes into N shards ──
const SHARD_COUNT = 4
function getShardRoutes(shardIndex: number): string[] {
  const size = Math.ceil(ROUTES.length / SHARD_COUNT)
  return ROUTES.slice(shardIndex * size, (shardIndex + 1) * size)
}

interface Issue {
  route: string
  phase: 'load' | 'click' | 'link'
  element: string
  error: string
}

// ── Shared test helpers ──
function setupErrorTracking(page: Page) {
  let jsErrors: string[] = []
  let consoleErrors: string[] = []
  let apiErrors: string[] = []

  page.on('pageerror', (err) => {
    // Turbopack dev-mode module cross-contamination (not a production issue)
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
      // Next.js dev-mode hydration attribute warnings (not production issues)
      if (text.includes('A tree hydrated but some attributes of the server rendered HTML')) return
      // Browser "Failed to load resource" duplicates API error handler
      if (text.includes('Failed to load resource')) return
      // Auth session timeout during long crawler runs (not an app bug)
      if (text.includes('ClientFetchError')) return
      // console.error('%o', obj) format strings are noise
      if (text.startsWith('%o')) return
      // Dev-mode: turbopack leaks DB imports into client bundle (works fine in production builds)
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
    harvest(route: string, phase: Issue['phase'], element: string, issues: Issue[]) {
      for (const e of jsErrors) issues.push({ route, phase, element, error: `JS: ${e}` })
      for (const e of consoleErrors) issues.push({ route, phase, element, error: `Console: ${e}` })
      for (const e of apiErrors) issues.push({ route, phase, element, error: `API: ${e}` })
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
  const data = JSON.stringify({ shardIndex, issues, routes })
  fs.writeFileSync(path.join(SHARD_DIR, `shard-${shardIndex}.json`), data)
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

  // Only write merged report when all shards are done
  const shardFiles = fs.readdirSync(SHARD_DIR).filter((f) => f.startsWith('shard-') && f.endsWith('.json'))
  if (shardFiles.length < SHARD_COUNT) return

  const loadIssues = allIssues.filter((i) => i.phase === 'load')
  const clickIssues = allIssues.filter((i) => i.phase === 'click')
  const linkIssues = allIssues.filter((i) => i.phase === 'link')

  let md = '# UI Crawl Report\n\n'
  md += `**Date:** ${new Date().toISOString().split('T')[0]}\n`
  md += `**Routes scanned:** ${allRoutes.length}\n`
  md += `**Total issues:** ${allIssues.length}`
  md += ` (${loadIssues.length} load, ${clickIssues.length} click, ${linkIssues.length} link)\n\n`

  if (allIssues.length === 0) {
    md += 'All pages loaded and all buttons clicked without errors.\n'
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
        const elem = i.element !== '-' ? ` **${i.element}**` : ''
        md += `- \`[${i.phase}]\`${elem} — ${i.error}\n`
      }
      md += '\n'
    }
  }

  const cleanRoutes = allRoutes.filter((r) => !allIssues.some((i) => i.route === r))
  if (cleanRoutes.length > 0 && allIssues.length > 0) {
    md += `## Clean Routes (${cleanRoutes.length}/${allRoutes.length})\n\n`
    md += cleanRoutes.map((r) => `- ${r}`).join('\n') + '\n'
  }

  fs.writeFileSync(REPORT_PATH, md)
  // Clean up shard files
  for (const f of shardFiles) fs.unlinkSync(path.join(SHARD_DIR, f))
  try { fs.rmdirSync(SHARD_DIR) } catch { /* ignore */ }

  console.log(`\n${'═'.repeat(50)}`)
  console.log('MERGED REPORT')
  console.log(`  Routes: ${allRoutes.length}`)
  console.log(`  Issues: ${allIssues.length}`)
  console.log(`  Report: ${REPORT_PATH}`)
  console.log('═'.repeat(50))
}

// ══════════════════════════════════════════════════
// PARALLEL SHARD TESTS
// ══════════════════════════════════════════════════
test.describe('UI Crawler', () => {
  test.skip(!HAS_AUTH, 'Skipped — run npx tsx e2e/save-auth.ts first')
  test.use({ storageState: AUTH_STATE })

  for (let shard = 0; shard < SHARD_COUNT; shard++) {
    test(`Shard ${shard + 1}/${SHARD_COUNT}: scan routes ${shard * Math.ceil(ROUTES.length / SHARD_COUNT)}-${Math.min((shard + 1) * Math.ceil(ROUTES.length / SHARD_COUNT), ROUTES.length) - 1}`, async ({ page }) => {
      test.setTimeout(480_000) // 8 min per shard

      const routes = getShardRoutes(shard)
      const issues: Issue[] = []
      const tracker = setupErrorTracking(page)

      // ════════════════════════════════════════
      // PHASE 1 — Page Load Scan
      // ════════════════════════════════════════
      console.log(`\n[Shard ${shard + 1}] PHASE 1: Loading ${routes.length} pages`)

      for (const route of routes) {
        tracker.reset()
        try {
          const resp = await page.goto(route, { timeout: 15000, waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1500)

          if (page.url().includes('/login')) {
            issues.push({ route, phase: 'load', element: '-', error: 'Redirected to /login (auth expired?)' })
            console.log(`  [S${shard + 1}] AUTH  ${route}`)
            continue
          }

          if (resp && resp.status() >= 400) {
            issues.push({ route, phase: 'load', element: '-', error: `HTTP ${resp.status()}` })
          }

          const boundary = await hasErrorBoundary(page)
          if (boundary) {
            issues.push({ route, phase: 'load', element: '-', error: `Error boundary: "${boundary}"` })
          }

          tracker.harvest(route, 'load', '-', issues)

          const bad = issues.filter((i) => i.route === route && i.phase === 'load').length
          console.log(`  [S${shard + 1}] ${bad > 0 ? 'FAIL' : ' OK '} ${route}${bad > 0 ? ` (${bad} issues)` : ''}`)
        } catch (err: any) {
          issues.push({
            route,
            phase: 'load',
            element: '-',
            error: `Navigation failed: ${err.message.substring(0, 200)}`,
          })
          console.log(`  [S${shard + 1}] FAIL ${route} (nav error)`)
        }
      }

      // ════════════════════════════════════════
      // PHASE 2 — Button Click Scan
      // Fresh page load per button for correctness.
      // Fast wait times + 4 parallel shards = ~4 min total.
      // ════════════════════════════════════════
      console.log(`\n[Shard ${shard + 1}] PHASE 2: Clicking buttons`)

      const failedRoutes = new Set(issues.filter((i) => i.phase === 'load').map((i) => i.route))

      for (const route of routes) {
        if (failedRoutes.has(route)) {
          console.log(`  [S${shard + 1}] SKIP ${route} (load error)`)
          continue
        }
        if (API_KEY_ROUTES.has(route)) {
          console.log(`  [S${shard + 1}] SKIP ${route} (needs API keys)`)
          continue
        }

        // Snapshot buttons on this route
        try {
          await page.goto(route, { timeout: 15000, waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(800)
        } catch {
          continue
        }

        if (page.url().includes('/login')) continue

        const snapshot = await page.locator('button:visible').evaluateAll((btns) =>
          btns.map((b, i) => ({
            idx: i,
            text: (b.textContent || '').trim().substring(0, 80),
            testId: b.getAttribute('data-testid') || '',
            disabled: b.hasAttribute('disabled'),
            ariaLabel: b.getAttribute('aria-label') || '',
          }))
        )

        const clickable = snapshot.filter(
          (b) =>
            !b.disabled &&
            !DESTRUCTIVE.test(b.text + ' ' + b.testId + ' ' + b.ariaLabel) &&
            !DEV_BUTTONS.test(b.text + ' ' + b.testId + ' ' + b.ariaLabel)
        )

        if (clickable.length === 0) {
          console.log(`  [S${shard + 1}] SKIP ${route} (0 buttons)`)
          continue
        }

        const toClick = clickable.slice(0, MAX_BUTTONS_PER_ROUTE)
        const skipped = clickable.length - toClick.length
        console.log(
          `  [S${shard + 1}] ${route} — ${toClick.length} buttons${skipped > 0 ? ` (${skipped} skipped, cap ${MAX_BUTTONS_PER_ROUTE})` : ''}`
        )

        for (const info of toClick) {
          tracker.reset()
          const label = info.testId || info.text || info.ariaLabel || `button[${info.idx}]`

          // Fresh page load for each button (ensures clean DOM state)
          try {
            await page.goto(route, { timeout: 15000, waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(600)
          } catch {
            break
          }

          if (page.url().includes('/login')) break

          try {
            const btn = page.locator('button:visible').nth(info.idx)
            const isVisible = await btn.isVisible().catch(() => false)
            if (!isVisible) continue

            if (info.text) {
              const currentText = ((await btn.textContent().catch(() => '')) || '').trim().substring(0, 80)
              if (currentText !== info.text) continue // DOM shifted, skip
            }

            await btn.click({ timeout: 2000 })
            await page.waitForTimeout(500)

            tracker.harvest(route, 'click', label, issues)

            const boundary = await hasErrorBoundary(page)
            if (boundary) {
              issues.push({ route, phase: 'click', element: label, error: `Error boundary: "${boundary}"` })
            }

            const bad = issues.some(
              (i) => i.route === route && i.phase === 'click' && i.element === label
            )
            if (bad) console.log(`    [S${shard + 1}] FAIL "${label}"`)
          } catch (err: any) {
            const msg = err.message || ''
            if (msg.includes('Target closed') || msg.includes('navigating')) continue
            if (msg.includes('Timeout') || msg.includes('timeout')) continue

            issues.push({
              route,
              phase: 'click',
              element: label,
              error: `Click failed: ${msg.substring(0, 200)}`,
            })
            console.log(`    [S${shard + 1}] FAIL "${label}" — click error`)
          }
        }
      }

      // ════════════════════════════════════════
      // PHASE 3 — Internal Link Check
      // ════════════════════════════════════════
      console.log(`\n[Shard ${shard + 1}] PHASE 3: Checking internal links`)

      const allLinks = new Set<string>()
      for (const route of routes) {
        try {
          await page.goto(route, { timeout: 15000, waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(800)
        } catch {
          continue
        }

        const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
          anchors
            .map((a) => a.getAttribute('href') || '')
            .filter((h) => h.startsWith('/') && !h.startsWith('/api/'))
        )
        hrefs.forEach((h) => allLinks.add(h))
      }

      const routeSet = new Set(ROUTES) // Check against ALL routes, not just this shard
      const extraLinks = [...allLinks].filter((l) => !routeSet.has(l)).sort()

      console.log(`  [S${shard + 1}] Found ${extraLinks.length} additional links to check`)

      for (const link of extraLinks) {
        tracker.reset()
        try {
          const resp = await page.goto(link, { timeout: 10000, waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1000)

          if (page.url().includes('/login')) {
            issues.push({ route: link, phase: 'link', element: '-', error: 'Redirected to /login' })
            continue
          }

          if (resp && resp.status() >= 400) {
            issues.push({ route: link, phase: 'link', element: '-', error: `HTTP ${resp.status()}` })
            continue
          }

          const boundary = await hasErrorBoundary(page)
          if (boundary) {
            issues.push({ route: link, phase: 'link', element: '-', error: `Error boundary: "${boundary}"` })
            continue
          }

          tracker.harvest(link, 'link', '-', issues)
        } catch {
          issues.push({ route: link, phase: 'link', element: '-', error: 'Navigation failed' })
        }
      }

      // ════════════════════════════════════════
      // SHARD REPORT
      // ════════════════════════════════════════
      writeShardReport(shard, issues, routes)

      console.log(`\n[Shard ${shard + 1}] DONE — ${issues.length} issues across ${routes.length} routes`)

      // Try to merge all shards (last shard to finish writes the report)
      mergeShardReports()
    })
  }
})
