/**
 * Seed script: populate dev DB with data that drives a realistic 13-week cash projection.
 *
 * Run: export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/seed-cash-projection.ts
 *
 * Creates: starting cash balance, vendors, donors, tenants, AR/AP invoices,
 * pledges, payroll runs, recurring expectations, and a FY2026 budget.
 */

import { db } from '../src/lib/db'
import {
  transactions,
  transactionLines,
  vendors,
  donors,
  tenants,
  invoices,
  pledges,
  payrollRuns,
  payrollEntries,
  recurringExpectations,
  budgets,
  budgetLines,
} from '../src/lib/db/schema'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(base: Date, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const TODAY = new Date('2026-03-22')
const SEED_USER = 'seed-script'

// Account IDs (from chart of accounts)
const ACCT = {
  CHECKING: 1,    // 1000
  SAVINGS: 2,     // 1010
  AR: 7,          // 1100
  AP: 25,         // 2000
  RETAINED: 42,   // 3000 Retained Earnings
  RENTAL_INC: 44, // 4000
  GRANT_REV: 49,  // 4100
  DONATION: 50,   // 4200
  EARNED_INC: 51, // 4300
  INVEST_INC: 52, // 4400
  SALARIES: 56,   // 5000
  INTEREST: 57,   // 5100
  PROP_TAX: 60,   // 5400
  PROP_INS: 61,   // 5410
  MGMT_FEES: 62,  // 5420
  LANDSCAPE: 64,  // 5440
  REPAIRS: 65,    // 5450
  ELECTRIC: 66,   // 5500
  GAS: 67,        // 5510
  WATER: 68,      // 5520
  INTERNET: 69,   // 5530
  TRASH: 71,      // 5550
  OTHER_OP: 72,   // 5600
}

const FUND = { GENERAL: 1, AHP: 2, CPA: 3, MASSDEV: 4 }

async function main() {
  console.log('Seeding cash projection data into dev DB...\n')

  // -----------------------------------------------------------------------
  // 1. Starting cash balance — JE: Dr Savings $45,000  /  Cr Retained Earnings $45,000
  // -----------------------------------------------------------------------
  console.log('1. Creating starting cash balance ($45,000)...')
  const [cashTxn] = await db
    .insert(transactions)
    .values({
      date: '2026-01-01',
      memo: 'Opening balance — cash in savings',
      sourceType: 'MANUAL',
      createdBy: SEED_USER,
    })
    .returning({ id: transactions.id })

  await db.insert(transactionLines).values([
    { transactionId: cashTxn.id, accountId: ACCT.SAVINGS, fundId: FUND.GENERAL, debit: '45000.00' },
    { transactionId: cashTxn.id, accountId: ACCT.RETAINED, fundId: FUND.GENERAL, credit: '45000.00' },
  ])

  // -----------------------------------------------------------------------
  // 2. Vendors
  // -----------------------------------------------------------------------
  console.log('2. Creating vendors...')
  const newVendors = await db
    .insert(vendors)
    .values([
      { name: 'National Grid', type: 'COMPANY', isActive: true },
      { name: 'Berkshire Roofing', type: 'COMPANY', isActive: true },
      { name: 'Pioneer Valley Landscaping', type: 'COMPANY', isActive: true },
      { name: 'Greenfield Insurance Agency', type: 'COMPANY', isActive: true },
      { name: 'Turners Falls IT Services', type: 'COMPANY', isActive: true },
    ])
    .returning({ id: vendors.id, name: vendors.name })

  const vendorMap: Record<string, number> = {}
  for (const v of newVendors) vendorMap[v.name] = v.id

  // -----------------------------------------------------------------------
  // 3. Donors
  // -----------------------------------------------------------------------
  console.log('3. Creating donors...')
  const newDonors = await db
    .insert(donors)
    .values([
      { name: 'Community Foundation of Western MA', type: 'FOUNDATION', isActive: true },
      { name: 'MassHousing Partnership', type: 'GOVERNMENT', isActive: true },
      { name: 'Margaret Chen', type: 'INDIVIDUAL', isActive: true },
    ])
    .returning({ id: donors.id, name: donors.name })

  const donorMap: Record<string, number> = {}
  for (const d of newDonors) donorMap[d.name] = d.id

  // -----------------------------------------------------------------------
  // 4. Tenants (4 active, monthly rent)
  // -----------------------------------------------------------------------
  console.log('4. Creating tenants...')
  await db.insert(tenants).values([
    { name: 'Sarah Johnson', unitNumber: '1A', monthlyRent: '1200.00', fundingSourceType: 'SECTION_8', leaseStart: '2025-07-01', isActive: true },
    { name: 'Michael Rodriguez', unitNumber: '1B', monthlyRent: '1100.00', fundingSourceType: 'MRVP', leaseStart: '2025-09-01', isActive: true },
    { name: 'Emily Nguyen', unitNumber: '2A', monthlyRent: '1350.00', fundingSourceType: 'TENANT_DIRECT', leaseStart: '2025-06-01', isActive: true },
    { name: 'David Thompson', unitNumber: '2B', monthlyRent: '1150.00', fundingSourceType: 'VASH', leaseStart: '2025-11-01', isActive: true },
  ])

  // -----------------------------------------------------------------------
  // 5. AR Invoices — due in weeks 1-4 (HIGH/MODERATE inflows)
  // -----------------------------------------------------------------------
  console.log('5. Creating AR invoices...')
  await db.insert(invoices).values([
    // Week 1 — grant draw
    { direction: 'AR', vendorId: null, fundId: FUND.AHP, invoiceNumber: 'AHP-2026-Q1', amount: '12500.00', invoiceDate: '2026-03-15', dueDate: addDays(TODAY, 3), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 2 — earned income
    { direction: 'AR', vendorId: null, fundId: FUND.GENERAL, invoiceNumber: 'EI-2026-03', amount: '3200.00', invoiceDate: '2026-03-10', dueDate: addDays(TODAY, 10), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 3
    { direction: 'AR', vendorId: null, fundId: FUND.CPA, invoiceNumber: 'CPA-2026-Q1', amount: '8750.00', invoiceDate: '2026-03-20', dueDate: addDays(TODAY, 17), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 4
    { direction: 'AR', vendorId: null, fundId: FUND.MASSDEV, invoiceNumber: 'MD-2026-04', amount: '15000.00', invoiceDate: '2026-03-22', dueDate: addDays(TODAY, 28), paymentStatus: 'POSTED', createdBy: SEED_USER },
  ])

  // -----------------------------------------------------------------------
  // 6. AP Invoices — due in weeks 1-4 (HIGH/MODERATE outflows)
  // -----------------------------------------------------------------------
  console.log('6. Creating AP invoices...')
  await db.insert(invoices).values([
    // Week 1 — utility bill
    { direction: 'AP', vendorId: vendorMap['National Grid'], fundId: FUND.GENERAL, invoiceNumber: 'NG-03-2026', amount: '1850.00', invoiceDate: '2026-03-05', dueDate: addDays(TODAY, 4), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 1 — insurance
    { direction: 'AP', vendorId: vendorMap['Greenfield Insurance Agency'], fundId: FUND.GENERAL, invoiceNumber: 'GIA-Q1-2026', amount: '2400.00', invoiceDate: '2026-03-10', dueDate: addDays(TODAY, 5), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 2 — landscaping
    { direction: 'AP', vendorId: vendorMap['Pioneer Valley Landscaping'], fundId: FUND.GENERAL, invoiceNumber: 'PVL-03-2026', amount: '950.00', invoiceDate: '2026-03-12', dueDate: addDays(TODAY, 12), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 2 — IT services
    { direction: 'AP', vendorId: vendorMap['Turners Falls IT Services'], fundId: FUND.GENERAL, invoiceNumber: 'TFIT-03-2026', amount: '750.00', invoiceDate: '2026-03-15', dueDate: addDays(TODAY, 13), paymentStatus: 'POSTED', createdBy: SEED_USER },
    // Week 3 — roof repair
    { direction: 'AP', vendorId: vendorMap['Berkshire Roofing'], fundId: FUND.GENERAL, invoiceNumber: 'BR-2026-001', amount: '4200.00', invoiceDate: '2026-03-18', dueDate: addDays(TODAY, 20), paymentStatus: 'POSTED', createdBy: SEED_USER },
  ])

  // -----------------------------------------------------------------------
  // 7. Pledges — expected in weeks 1-3
  // -----------------------------------------------------------------------
  console.log('7. Creating pledges...')
  await db.insert(pledges).values([
    { donorId: donorMap['Community Foundation of Western MA'], amount: '5000.00', expectedDate: addDays(TODAY, 5), fundId: FUND.GENERAL, status: 'PLEDGED' },
    { donorId: donorMap['MassHousing Partnership'], amount: '10000.00', expectedDate: addDays(TODAY, 12), fundId: FUND.AHP, status: 'PLEDGED' },
    { donorId: donorMap['Margaret Chen'], amount: '2500.00', expectedDate: addDays(TODAY, 18), fundId: FUND.GENERAL, status: 'PLEDGED' },
  ])

  // -----------------------------------------------------------------------
  // 8. Payroll runs — DRAFT, pay periods in weeks 1-2
  // -----------------------------------------------------------------------
  console.log('8. Creating payroll runs...')
  const [payRun1] = await db
    .insert(payrollRuns)
    .values({
      payPeriodStart: addDays(TODAY, 1),   // Mar 23
      payPeriodEnd: addDays(TODAY, 7),     // Mar 29 (week 1)
      status: 'CALCULATED',
      createdBy: SEED_USER,
    })
    .returning({ id: payrollRuns.id })

  await db.insert(payrollEntries).values([
    {
      payrollRunId: payRun1.id,
      employeeId: 'EMP-001',
      employeeName: 'Alice Martinez',
      grossPay: '2800.00',
      federalWithholding: '336.00',
      stateWithholding: '140.00',
      socialSecurityEmployee: '173.60',
      medicareEmployee: '40.60',
      socialSecurityEmployer: '173.60',
      medicareEmployer: '40.60',
      netPay: '2109.80',
      fundAllocations: { '1': 2800 },
    },
    {
      payrollRunId: payRun1.id,
      employeeId: 'EMP-002',
      employeeName: 'James Wilson',
      grossPay: '2400.00',
      federalWithholding: '288.00',
      stateWithholding: '120.00',
      socialSecurityEmployee: '148.80',
      medicareEmployee: '34.80',
      socialSecurityEmployer: '148.80',
      medicareEmployer: '34.80',
      netPay: '1808.40',
      fundAllocations: { '1': 2400 },
    },
  ])

  const [payRun2] = await db
    .insert(payrollRuns)
    .values({
      payPeriodStart: addDays(TODAY, 8),   // Mar 30
      payPeriodEnd: addDays(TODAY, 14),    // Apr 5 (week 2)
      status: 'DRAFT',
      createdBy: SEED_USER,
    })
    .returning({ id: payrollRuns.id })

  await db.insert(payrollEntries).values([
    {
      payrollRunId: payRun2.id,
      employeeId: 'EMP-001',
      employeeName: 'Alice Martinez',
      grossPay: '2800.00',
      federalWithholding: '336.00',
      stateWithholding: '140.00',
      socialSecurityEmployee: '173.60',
      medicareEmployee: '40.60',
      socialSecurityEmployer: '173.60',
      medicareEmployer: '40.60',
      netPay: '2109.80',
      fundAllocations: { '1': 2800 },
    },
    {
      payrollRunId: payRun2.id,
      employeeId: 'EMP-002',
      employeeName: 'James Wilson',
      grossPay: '2400.00',
      federalWithholding: '288.00',
      stateWithholding: '120.00',
      socialSecurityEmployee: '148.80',
      medicareEmployee: '34.80',
      socialSecurityEmployer: '148.80',
      medicareEmployer: '34.80',
      netPay: '1808.40',
      fundAllocations: { '1': 2400 },
    },
  ])

  // -----------------------------------------------------------------------
  // 9. Recurring Expectations (monthly bills)
  // -----------------------------------------------------------------------
  console.log('9. Creating recurring expectations...')
  await db.insert(recurringExpectations).values([
    { merchantPattern: 'NATIONAL GRID%', description: 'Electric — National Grid', expectedAmount: '1800.00', frequency: 'monthly', expectedDay: 15, glAccountId: ACCT.ELECTRIC, fundId: FUND.GENERAL, bankAccountId: 1, isActive: true },
    { merchantPattern: 'BERKSHIRE GAS%', description: 'Gas — Berkshire Gas', expectedAmount: '650.00', frequency: 'monthly', expectedDay: 20, glAccountId: ACCT.GAS, fundId: FUND.GENERAL, bankAccountId: 1, isActive: true },
    { merchantPattern: 'GREENFIELD WATER%', description: 'Water/Sewer — Greenfield', expectedAmount: '420.00', frequency: 'monthly', expectedDay: 1, glAccountId: ACCT.WATER, fundId: FUND.GENERAL, bankAccountId: 1, isActive: true },
    { merchantPattern: 'COMCAST%', description: 'Internet — Comcast Business', expectedAmount: '189.00', frequency: 'monthly', expectedDay: 5, glAccountId: ACCT.INTERNET, fundId: FUND.GENERAL, bankAccountId: 1, isActive: true },
    { merchantPattern: 'REPUBLIC SERVICES%', description: 'Trash — Republic Services', expectedAmount: '275.00', frequency: 'monthly', expectedDay: 10, glAccountId: ACCT.TRASH, fundId: FUND.GENERAL, bankAccountId: 1, isActive: true },
    { merchantPattern: 'PIONEER VALLEY LAND%', description: 'Landscaping — monthly', expectedAmount: '900.00', frequency: 'monthly', expectedDay: 15, glAccountId: ACCT.LANDSCAPE, fundId: FUND.GENERAL, bankAccountId: 1, isActive: true },
  ])

  // -----------------------------------------------------------------------
  // 10. Budget for FY2026 with monthly amounts
  // -----------------------------------------------------------------------
  console.log('10. Creating FY2026 budget...')
  const [budget] = await db
    .insert(budgets)
    .values({ fiscalYear: 2026, status: 'APPROVED', createdBy: SEED_USER })
    .returning({ id: budgets.id })

  // Revenue lines
  const revLines = [
    { accountId: ACCT.RENTAL_INC, fundId: FUND.GENERAL, annual: 57600, monthly: Array(12).fill(4800) },         // $4,800/mo rent
    { accountId: ACCT.GRANT_REV, fundId: FUND.AHP, annual: 60000, monthly: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000] },
    { accountId: ACCT.GRANT_REV, fundId: FUND.CPA, annual: 36000, monthly: [0, 0, 0, 9000, 0, 0, 9000, 0, 0, 9000, 0, 9000] },  // quarterly draws
    { accountId: ACCT.DONATION, fundId: FUND.GENERAL, annual: 24000, monthly: [1000, 1000, 1500, 2000, 2000, 2500, 2000, 2000, 2000, 2000, 3000, 3000] },
    { accountId: ACCT.EARNED_INC, fundId: FUND.GENERAL, annual: 18000, monthly: Array(12).fill(1500) },
    { accountId: ACCT.INVEST_INC, fundId: FUND.GENERAL, annual: 3600, monthly: Array(12).fill(300) },
  ]

  // Expense lines
  const expLines = [
    { accountId: ACCT.SALARIES, fundId: FUND.GENERAL, annual: 135200, monthly: Array(12).fill(11266.67) },     // ~$5,600 biweekly x 2 employees
    { accountId: ACCT.PROP_TAX, fundId: FUND.GENERAL, annual: 8400, monthly: [0, 0, 0, 4200, 0, 0, 0, 0, 0, 4200, 0, 0] },    // semi-annual
    { accountId: ACCT.PROP_INS, fundId: FUND.GENERAL, annual: 9600, monthly: Array(12).fill(800) },
    { accountId: ACCT.MGMT_FEES, fundId: FUND.GENERAL, annual: 6000, monthly: Array(12).fill(500) },
    { accountId: ACCT.LANDSCAPE, fundId: FUND.GENERAL, annual: 10800, monthly: [0, 0, 600, 900, 1200, 1500, 1500, 1200, 900, 900, 600, 0] },  // seasonal
    { accountId: ACCT.REPAIRS, fundId: FUND.GENERAL, annual: 12000, monthly: Array(12).fill(1000) },
    { accountId: ACCT.ELECTRIC, fundId: FUND.GENERAL, annual: 21600, monthly: [2200, 2000, 1800, 1600, 1400, 1400, 1800, 2000, 1800, 1600, 1800, 2200] },
    { accountId: ACCT.GAS, fundId: FUND.GENERAL, annual: 7800, monthly: [1200, 1100, 900, 600, 400, 200, 200, 200, 400, 600, 900, 1100] },
    { accountId: ACCT.WATER, fundId: FUND.GENERAL, annual: 5040, monthly: Array(12).fill(420) },
    { accountId: ACCT.INTERNET, fundId: FUND.GENERAL, annual: 2268, monthly: Array(12).fill(189) },
    { accountId: ACCT.TRASH, fundId: FUND.GENERAL, annual: 3300, monthly: Array(12).fill(275) },
    { accountId: ACCT.INTEREST, fundId: FUND.GENERAL, annual: 14400, monthly: Array(12).fill(1200) },
    { accountId: ACCT.OTHER_OP, fundId: FUND.GENERAL, annual: 6000, monthly: Array(12).fill(500) },
  ]

  const allBudgetLines = [...revLines, ...expLines].map((l) => ({
    budgetId: budget.id,
    accountId: l.accountId,
    fundId: l.fundId,
    annualAmount: l.annual.toFixed(2),
    spreadMethod: 'CUSTOM' as const,
    monthlyAmounts: l.monthly,
  }))

  await db.insert(budgetLines).values(allBudgetLines)

  // -----------------------------------------------------------------------
  // 11. GL history (3-month actuals for fallback projection source)
  //     Create journal entries for Dec 2025, Jan 2026, Feb 2026
  // -----------------------------------------------------------------------
  console.log('11. Creating 3-month GL history...')
  const historyMonths = [
    { date: '2025-12-15', label: 'Dec 2025' },
    { date: '2026-01-15', label: 'Jan 2026' },
    { date: '2026-02-15', label: 'Feb 2026' },
  ]

  for (const month of historyMonths) {
    // Revenue entries
    const [revTxn] = await db.insert(transactions).values({
      date: month.date, memo: `${month.label} — revenue summary`, sourceType: 'MANUAL', createdBy: SEED_USER,
    }).returning({ id: transactions.id })

    await db.insert(transactionLines).values([
      { transactionId: revTxn.id, accountId: ACCT.SAVINGS, fundId: FUND.GENERAL, debit: '6600.00' },
      { transactionId: revTxn.id, accountId: ACCT.RENTAL_INC, fundId: FUND.GENERAL, credit: '4800.00' },
      { transactionId: revTxn.id, accountId: ACCT.EARNED_INC, fundId: FUND.GENERAL, credit: '1500.00' },
      { transactionId: revTxn.id, accountId: ACCT.INVEST_INC, fundId: FUND.GENERAL, credit: '300.00' },
    ])

    // Grant revenue (AHP)
    const [grantTxn] = await db.insert(transactions).values({
      date: month.date, memo: `${month.label} — AHP grant draw`, sourceType: 'MANUAL', createdBy: SEED_USER,
    }).returning({ id: transactions.id })

    await db.insert(transactionLines).values([
      { transactionId: grantTxn.id, accountId: ACCT.SAVINGS, fundId: FUND.AHP, debit: '5000.00' },
      { transactionId: grantTxn.id, accountId: ACCT.GRANT_REV, fundId: FUND.AHP, credit: '5000.00' },
    ])

    // Expense entries
    const [expTxn] = await db.insert(transactions).values({
      date: month.date, memo: `${month.label} — operating expenses`, sourceType: 'MANUAL', createdBy: SEED_USER,
    }).returning({ id: transactions.id })

    await db.insert(transactionLines).values([
      { transactionId: expTxn.id, accountId: ACCT.SALARIES, fundId: FUND.GENERAL, debit: '11267.00' },
      { transactionId: expTxn.id, accountId: ACCT.PROP_INS, fundId: FUND.GENERAL, debit: '800.00' },
      { transactionId: expTxn.id, accountId: ACCT.ELECTRIC, fundId: FUND.GENERAL, debit: '1800.00' },
      { transactionId: expTxn.id, accountId: ACCT.GAS, fundId: FUND.GENERAL, debit: '900.00' },
      { transactionId: expTxn.id, accountId: ACCT.WATER, fundId: FUND.GENERAL, debit: '420.00' },
      { transactionId: expTxn.id, accountId: ACCT.INTERNET, fundId: FUND.GENERAL, debit: '189.00' },
      { transactionId: expTxn.id, accountId: ACCT.REPAIRS, fundId: FUND.GENERAL, debit: '1000.00' },
      { transactionId: expTxn.id, accountId: ACCT.INTEREST, fundId: FUND.GENERAL, debit: '1200.00' },
      { transactionId: expTxn.id, accountId: ACCT.OTHER_OP, fundId: FUND.GENERAL, debit: '500.00' },
      { transactionId: expTxn.id, accountId: ACCT.SAVINGS, fundId: FUND.GENERAL, credit: '18076.00' },
    ])
  }

  console.log('\n✅ Seed complete! Summary:')
  console.log('   - Starting cash: $45,000 (account 1010)')
  console.log('   - 5 vendors, 3 donors, 4 tenants')
  console.log('   - 4 AR invoices ($39,450 total, due weeks 1-4)')
  console.log('   - 5 AP invoices ($10,150 total, due weeks 1-3)')
  console.log('   - 3 pledges ($17,500 total, expected weeks 1-3)')
  console.log('   - 2 payroll runs (weeks 1-2, ~$5,598/week)')
  console.log('   - 6 recurring expectations (monthly utilities/services)')
  console.log('   - FY2026 budget (19 line items, revenue + expenses)')
  console.log('   - 3 months GL history (Dec-Feb actuals)')
  console.log('\nNow regenerate the projection in the UI to see results.')

  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
