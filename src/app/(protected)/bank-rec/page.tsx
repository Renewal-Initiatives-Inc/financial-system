import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts, accounts, funds } from '@/lib/db/schema'
import { BankRecClient } from './bank-rec-client'

export default async function BankReconciliationPage() {
  const [bankAccountsList, accountOptions, fundOptions] = await Promise.all([
    db
      .select({
        id: bankAccounts.id,
        name: bankAccounts.name,
        institution: bankAccounts.institution,
        last4: bankAccounts.last4,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.isActive, true))
      .orderBy(bankAccounts.name),
    db
      .select({ id: accounts.id, name: accounts.name, code: accounts.code })
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.code),
    db
      .select({ id: funds.id, name: funds.name })
      .from(funds)
      .where(eq(funds.isActive, true))
      .orderBy(funds.name),
  ])

  return (
    <BankRecClient
      bankAccounts={bankAccountsList}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />
  )
}
