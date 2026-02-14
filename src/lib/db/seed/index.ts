import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../schema'
import { seedAccounts } from './accounts'
import { seedFunds } from './funds'
import { seedCipCostCodes } from './cip-cost-codes'
import { seedAhpLoanConfig } from './ahp-loan-config'

async function seed() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Cannot seed.')
  }

  const sql = neon(connectionString)
  const db = drizzle(sql, { schema })

  console.log('Starting seed...\n')

  // --- Seed Accounts (two passes) ---
  console.log('Seeding accounts...')

  // Pass 1: Insert all accounts without parent references
  const accountsWithoutParent = seedAccounts.map(
    ({ parentCode: _parentCode, ...account }) => account
  )

  for (const account of accountsWithoutParent) {
    const existing = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.code, account.code))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.accounts).values(account)
    }
  }

  // Pass 2: Set parent_account_id for CIP sub-accounts
  const cipParent = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.code, '1500'))
    .limit(1)

  if (cipParent.length > 0) {
    const cipParentId = cipParent[0].id
    const cipChildren = seedAccounts.filter((a) => a.parentCode === '1500')

    for (const child of cipChildren) {
      await db
        .update(schema.accounts)
        .set({ parentAccountId: cipParentId })
        .where(eq(schema.accounts.code, child.code))
    }
  }

  console.log(`  Seeded ${accountsWithoutParent.length} accounts`)

  // --- Seed Funds ---
  console.log('Seeding funds...')

  for (const fund of seedFunds) {
    const existing = await db
      .select({ id: schema.funds.id })
      .from(schema.funds)
      .where(eq(schema.funds.name, fund.name))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.funds).values(fund)
    }
  }

  console.log(`  Seeded ${seedFunds.length} funds`)

  // --- Seed CIP Cost Codes ---
  console.log('Seeding CIP cost codes...')

  for (const costCode of seedCipCostCodes) {
    const existing = await db
      .select({ id: schema.cipCostCodes.id })
      .from(schema.cipCostCodes)
      .where(eq(schema.cipCostCodes.code, costCode.code))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.cipCostCodes).values(costCode)
    }
  }

  console.log(`  Seeded ${seedCipCostCodes.length} CIP cost codes`)

  // --- Seed AHP Loan Config ---
  console.log('Seeding AHP loan config...')

  const existingLoanConfig = await db
    .select({ id: schema.ahpLoanConfig.id })
    .from(schema.ahpLoanConfig)
    .limit(1)

  if (existingLoanConfig.length === 0) {
    await db.insert(schema.ahpLoanConfig).values(seedAhpLoanConfig)
    console.log('  Seeded AHP loan config')
  } else {
    console.log('  AHP loan config already exists, skipping')
  }

  console.log('\nSeed complete!')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
