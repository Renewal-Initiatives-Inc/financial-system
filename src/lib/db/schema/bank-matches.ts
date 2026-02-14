import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { bankMatchTypeEnum } from './enums'
import { bankTransactions } from './bank-transactions'
import { transactionLines } from './transaction-lines'
import { matchingRules } from './matching-rules'
import { reconciliationSessions } from './reconciliation-sessions'

export const bankMatches = pgTable(
  'bank_matches',
  {
    id: serial('id').primaryKey(),
    bankTransactionId: integer('bank_transaction_id')
      .notNull()
      .references(() => bankTransactions.id),
    glTransactionLineId: integer('gl_transaction_line_id')
      .notNull()
      .references(() => transactionLines.id),
    matchType: bankMatchTypeEnum('match_type').notNull(),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 2 }),
    confirmedBy: varchar('confirmed_by', { length: 255 }),
    confirmedAt: timestamp('confirmed_at'),
    ruleId: integer('rule_id').references(() => matchingRules.id),
    reconciliationSessionId: integer('reconciliation_session_id').references(
      () => reconciliationSessions.id
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('bank_matches_bank_transaction_id_idx').on(table.bankTransactionId),
    index('bank_matches_gl_line_id_idx').on(table.glTransactionLineId),
    index('bank_matches_session_id_idx').on(table.reconciliationSessionId),
  ]
)
