import { getCategorizationRules } from './actions'
import { getAccountOptions, getFundOptions } from '../actions'
import { RulesClient } from './rules-client'

export default async function RulesPage() {
  const [rules, accountOptions, fundOptions] = await Promise.all([
    getCategorizationRules(),
    getAccountOptions(),
    getFundOptions(),
  ])

  type AccountType = 'ASSET' | 'LIABILITY' | 'NET_ASSET' | 'REVENUE' | 'EXPENSE'
  const accounts = accountOptions.map((a) => ({
    ...a,
    type: a.type as AccountType,
    parentAccountId: null as number | null,
    subType: null as string | null,
    normalBalance: 'DEBIT' as 'DEBIT' | 'CREDIT',
    form990Line: null as string | null,
    isSystemLocked: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const funds = fundOptions.map((f) => ({
    ...f,
    isActive: true,
  }))

  return (
    <RulesClient initialRules={rules} accounts={accounts} funds={funds} />
  )
}
