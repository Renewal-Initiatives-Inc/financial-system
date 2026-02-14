import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, getAccountBalanceDefinition } from '../tool-definitions'

export function getBankRecContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'bank-rec',
    pageDescription:
      'User is performing bank reconciliation. Help with matching bank transactions to GL entries, identifying outstanding items, resolving reconciliation differences, creating inline GL entries for bank-originated items, and setting up matching rules.',
    data: {
      sessionInfo: data?.sessionInfo ?? null,
      unmatchedBankCount: data?.unmatchedBankCount ?? 0,
      unmatchedGlCount: data?.unmatchedGlCount ?? 0,
      outstandingCount: data?.outstandingCount ?? 0,
      lastSyncStatus: data?.lastSyncStatus ?? 'unknown',
      ...data,
    },
    tools: [searchTransactionsDefinition, getAccountBalanceDefinition],
    knowledge: [
      'fund-accounting',
      'bank-reconciliation',
      'trust-escalation',
      'outstanding-item',
      'gl-only-entry',
      'pending-transaction',
      'split-transaction',
    ],
  }
}
