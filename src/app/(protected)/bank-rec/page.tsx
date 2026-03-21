import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts } from '@/lib/db/schema'
import { BankReconcileClient } from './bank-reconcile-client'

export default async function BankReconciliationPage() {
  const bankAccountsList = await db
    .select({
      id: bankAccounts.id,
      name: bankAccounts.name,
      institution: bankAccounts.institution,
      last4: bankAccounts.last4,
    })
    .from(bankAccounts)
    .where(eq(bankAccounts.isActive, true))
    .orderBy(bankAccounts.name)

  return <BankReconcileClient bankAccounts={bankAccountsList} />
}
