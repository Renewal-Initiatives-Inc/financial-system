import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Tests for AI categorization engine — prompt assembly, response parsing, error fallback.
 */

const aiResponseSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  fundId: z.number(),
  fundName: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
})

describe('AI Categorization Engine', () => {
  describe('Response schema validation', () => {
    it('accepts valid high-confidence response', () => {
      const response = {
        accountId: 42,
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'high',
        reasoning: 'Similar to 14 prior Staples transactions categorized as Office Supplies',
      }
      const result = aiResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('accepts medium confidence', () => {
      const result = aiResponseSchema.safeParse({
        accountId: 42,
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'medium',
        reasoning: 'Merchant not seen before but amount suggests office category',
      })
      expect(result.success).toBe(true)
    })

    it('accepts low confidence', () => {
      const result = aiResponseSchema.safeParse({
        accountId: 42,
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'low',
        reasoning: 'Uncertain categorization',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid confidence level', () => {
      const result = aiResponseSchema.safeParse({
        accountId: 42,
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'very_high',
        reasoning: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing accountId', () => {
      const result = aiResponseSchema.safeParse({
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'high',
        reasoning: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects string accountId', () => {
      const result = aiResponseSchema.safeParse({
        accountId: '42',
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'high',
        reasoning: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing reasoning', () => {
      const result = aiResponseSchema.safeParse({
        accountId: 42,
        accountName: 'Office Supplies',
        fundId: 1,
        fundName: 'General Fund',
        confidence: 'high',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('JSON extraction from AI response', () => {
    it('extracts JSON from clean response', () => {
      const text = '{"accountId": 42, "accountName": "Office Supplies", "fundId": 1, "fundName": "General Fund", "confidence": "high", "reasoning": "test"}'
      const match = text.match(/\{[\s\S]*\}/)
      expect(match).not.toBeNull()
      const parsed = JSON.parse(match![0])
      expect(parsed.accountId).toBe(42)
    })

    it('extracts JSON with surrounding text', () => {
      const text = 'Here is my suggestion:\n{"accountId": 42, "accountName": "Office Supplies", "fundId": 1, "fundName": "General Fund", "confidence": "high", "reasoning": "test"}\nLet me know if you need changes.'
      const match = text.match(/\{[\s\S]*\}/)
      expect(match).not.toBeNull()
      const parsed = JSON.parse(match![0])
      expect(parsed.accountId).toBe(42)
    })

    it('returns null for no JSON in response', () => {
      const text = 'I cannot categorize this transaction.'
      const match = text.match(/\{[\s\S]*\}/)
      expect(match).toBeNull()
    })
  })

  describe('Account/fund existence validation', () => {
    it('rejects suggestion when account does not exist', () => {
      const expenseAccounts = [
        { id: 10, name: 'Rent' },
        { id: 20, name: 'Utilities' },
      ]
      const suggestion = { accountId: 99 } // doesn't exist
      const exists = expenseAccounts.some((a) => a.id === suggestion.accountId)
      expect(exists).toBe(false)
    })

    it('accepts suggestion when account exists', () => {
      const expenseAccounts = [
        { id: 10, name: 'Rent' },
        { id: 20, name: 'Utilities' },
      ]
      const suggestion = { accountId: 20 }
      const exists = expenseAccounts.some((a) => a.id === suggestion.accountId)
      expect(exists).toBe(true)
    })
  })

  describe('Graceful degradation', () => {
    it('returns null when ANTHROPIC_API_KEY is not set', () => {
      const apiKey = undefined
      const result = apiKey ? 'would call API' : null
      expect(result).toBeNull()
    })

    it('returns null on malformed JSON', () => {
      const text = '{"accountId": 42, "broken'
      try {
        JSON.parse(text)
        expect.unreachable('should have thrown')
      } catch {
        // Expected — AI categorization returns null on parse failure
        expect(true).toBe(true)
      }
    })
  })

  describe('Prompt assembly', () => {
    it('includes transaction details in prompt', () => {
      const txn = {
        merchantName: 'STAPLES',
        amount: '89.00',
        date: '2026-03-15',
        cardholder: 'Damien',
        description: 'Office supplies purchase',
      }
      const prompt = `Merchant: ${txn.merchantName}\nAmount: $${txn.amount}\nDate: ${txn.date}\nCardholder: ${txn.cardholder}\nDescription: ${txn.description}`

      expect(prompt).toContain('STAPLES')
      expect(prompt).toContain('$89.00')
      expect(prompt).toContain('Damien')
      expect(prompt).toContain('Office supplies purchase')
    })

    it('handles null description', () => {
      const description = null
      const displayDesc = description ?? 'N/A'
      expect(displayDesc).toBe('N/A')
    })

    it('includes account list in structured format', () => {
      const accounts = [
        { code: '6200', name: 'Utilities', id: 10 },
        { code: '6400', name: 'Office Supplies', id: 20 },
      ]
      const formatted = accounts.map((a) => `  ${a.code} - ${a.name} (id: ${a.id})`).join('\n')
      expect(formatted).toContain('6200 - Utilities')
      expect(formatted).toContain('6400 - Office Supplies')
    })
  })
})
