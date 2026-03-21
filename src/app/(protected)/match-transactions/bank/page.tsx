import { eq, and, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts, accounts, funds } from '@/lib/db/schema'
import { BankMatchClient } from './bank-match-client'

export default async function BankMatchPage() {
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
      .select({ id: accounts.id, name: accounts.name, code: accounts.code, type: accounts.type })
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.code),
    db
      .select({ id: funds.id, name: funds.name })
      .from(funds)
      .where(
        and(
          eq(funds.isActive, true),
          or(eq(funds.isSystemLocked, true), eq(funds.restrictionType, 'RESTRICTED'))
        )
      )
      .orderBy(funds.name),
  ])

  return (
    <BankMatchClient
      bankAccounts={bankAccountsList}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />
  )
}
