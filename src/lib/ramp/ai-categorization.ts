/**
 * AI-assisted categorization for Ramp credit card transactions (TXN-P0-027).
 *
 * When no categorization rule matches, uses Claude Haiku to suggest
 * GL account + fund based on merchant, amount, cardholder, and history.
 */

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  rampTransactions,
  accounts,
  funds,
  categorizationRules,
} from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export interface AiCategorizationSuggestion {
  accountId: number
  accountName: string
  fundId: number
  fundName: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

const aiResponseSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  fundId: z.number(),
  fundName: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
})

// --- AI Categorization ---

/**
 * Get an AI-powered categorization suggestion for a Ramp transaction.
 * Returns null if AI is unavailable or response is invalid.
 */
export async function getAiSuggestion(
  rampTxnId: number
): Promise<AiCategorizationSuggestion | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null
  }

  // Fetch the transaction
  const [txn] = await db
    .select()
    .from(rampTransactions)
    .where(eq(rampTransactions.id, rampTxnId))

  if (!txn) return null

  // Build context
  const [expenseAccounts, activeFunds, recentSimilar, rules] = await Promise.all([
    getExpenseAccounts(),
    getActiveFunds(),
    getRecentSimilarTransactions(txn.merchantName),
    getCategorizationRules(),
  ])

  const prompt = buildPrompt(txn, expenseAccounts, activeFunds, recentSimilar, rules)

  try {
    const client = new Anthropic()
    const startTime = Date.now()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const elapsed = Date.now() - startTime

    // Extract text content
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    // Parse JSON from response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = aiResponseSchema.safeParse(JSON.parse(jsonMatch[0]))
    if (!parsed.success) return null

    // Validate that the suggested account and fund actually exist
    const accountExists = expenseAccounts.some((a) => a.id === parsed.data.accountId)
    const fundExists = activeFunds.some((f) => f.id === parsed.data.fundId)

    if (!accountExists || !fundExists) return null

    // Log API usage to audit_log
    await logAudit(db as unknown as NeonDatabase<any>, {
      userId: 'system-ai-categorization',
      action: 'created',
      entityType: 'ai_categorization',
      entityId: rampTxnId,
      afterState: {
        model: 'claude-haiku-4-5-20251001',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        elapsedMs: elapsed,
        suggestion: parsed.data,
      },
    })

    return parsed.data
  } catch {
    // Graceful degradation — AI failure should never crash the flow
    return null
  }
}

/**
 * Batch AI categorization for multiple transactions.
 */
export async function batchAiCategorize(
  rampTxnIds: number[]
): Promise<Map<number, AiCategorizationSuggestion>> {
  const results = new Map<number, AiCategorizationSuggestion>()

  for (const id of rampTxnIds) {
    const suggestion = await getAiSuggestion(id)
    if (suggestion) {
      results.set(id, suggestion)
    }
  }

  return results
}

// --- Helpers ---

async function getExpenseAccounts() {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.isActive, true), eq(accounts.type, 'EXPENSE')))
    .orderBy(accounts.code)
}

async function getActiveFunds() {
  return db
    .select({ id: funds.id, name: funds.name, restrictionType: funds.restrictionType })
    .from(funds)
    .where(eq(funds.isActive, true))
    .orderBy(funds.name)
}

async function getRecentSimilarTransactions(merchantName: string) {
  return db
    .select({
      merchantName: rampTransactions.merchantName,
      amount: rampTransactions.amount,
      date: rampTransactions.date,
      glAccountName: accounts.name,
      fundName: funds.name,
    })
    .from(rampTransactions)
    .leftJoin(accounts, eq(rampTransactions.glAccountId, accounts.id))
    .leftJoin(funds, eq(rampTransactions.fundId, funds.id))
    .where(
      and(
        sql`LOWER(${rampTransactions.merchantName}) LIKE LOWER(${'%' + merchantName.substring(0, 10) + '%'})`,
        eq(rampTransactions.status, 'posted')
      )
    )
    .orderBy(desc(rampTransactions.date))
    .limit(20)
}

async function getCategorizationRules() {
  return db
    .select({
      criteria: categorizationRules.criteria,
      glAccountId: categorizationRules.glAccountId,
      fundId: categorizationRules.fundId,
    })
    .from(categorizationRules)
    .where(eq(categorizationRules.autoApply, true))
}

function buildPrompt(
  txn: typeof rampTransactions.$inferSelect,
  expenseAccounts: { id: number; name: string; code: string }[],
  activeFunds: { id: number; name: string; restrictionType: string }[],
  recentSimilar: {
    merchantName: string
    amount: string
    date: string
    glAccountName: string | null
    fundName: string | null
  }[],
  rules: { criteria: unknown; glAccountId: number; fundId: number }[]
): string {
  const accountList = expenseAccounts
    .map((a) => `  ${a.code} - ${a.name} (id: ${a.id})`)
    .join('\n')

  const fundList = activeFunds
    .map((f) => `  ${f.name} [${f.restrictionType}] (id: ${f.id})`)
    .join('\n')

  const historyList =
    recentSimilar.length > 0
      ? recentSimilar
          .map(
            (t) =>
              `  ${t.date} ${t.merchantName} $${t.amount} → ${t.glAccountName ?? 'N/A'}, ${t.fundName ?? 'N/A'}`
          )
          .join('\n')
      : '  No prior transactions from this merchant'

  const ruleList =
    rules.length > 0
      ? rules
          .map(
            (r) =>
              `  Pattern: ${JSON.stringify(r.criteria)} → Account ${r.glAccountId}, Fund ${r.fundId}`
          )
          .join('\n')
      : '  No existing rules'

  return `You are categorizing a credit card transaction for a nonprofit organization.

Transaction:
- Merchant: ${txn.merchantName}
- Amount: $${txn.amount}
- Date: ${txn.date}
- Cardholder: ${txn.cardholder}
- Description: ${txn.description ?? 'N/A'}

Chart of Accounts (expense accounts only):
${accountList}

Available Funds:
${fundList}

Recent similar transactions (last 20 from this merchant or similar merchants):
${historyList}

Existing categorization rules:
${ruleList}

Respond with JSON only — no other text:
{
  "accountId": number,
  "accountName": string,
  "fundId": number,
  "fundName": string,
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence explanation"
}`
}
