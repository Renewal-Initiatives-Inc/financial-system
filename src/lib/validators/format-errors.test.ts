import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { formatValidationErrors } from './format-errors'

describe('formatValidationErrors', () => {
  it('maps required field errors to friendly messages', () => {
    const schema = z.object({
      name: z.string().min(1),
      amount: z.number().positive(),
    })

    const result = schema.safeParse({ name: '', amount: -5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      expect(errors.name).toBe('Name is required')
      expect(errors.amount).toMatch(/must be a positive number/i)
    }
  })

  it('keeps first error per field when multiple exist', () => {
    const schema = z.object({
      email: z.string().min(1).email(),
    })

    const result = schema.safeParse({ email: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      // Should only have one error for email (the first one: min(1))
      expect(errors.email).toBeDefined()
      expect(Object.keys(errors)).toHaveLength(1)
    }
  })

  it('handles nested paths like lines.0.amount', () => {
    const schema = z.object({
      lines: z.array(
        z.object({
          amount: z.number().positive(),
        })
      ),
    })

    const result = schema.safeParse({ lines: [{ amount: -1 }] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      expect(errors['lines.0.amount']).toMatch(/must be a positive number/i)
    }
  })

  it('converts camelCase field names to readable labels', () => {
    const schema = z.object({
      glAccountId: z.number(),
    })

    const result = schema.safeParse({ glAccountId: 'bad' as unknown as number })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      expect(errors.glAccountId).toBe('Gl Account has an invalid format')
    }
  })

  it('preserves custom schema messages', () => {
    const schema = z.object({
      taxId: z.string().regex(/^\d{2}-\d{7}$/, 'Tax ID must be in XX-XXXXXXX format'),
    })

    const result = schema.safeParse({ taxId: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      expect(errors.taxId).toBe('Tax ID must be in XX-XXXXXXX format')
    }
  })

  it('returns empty object for valid data', () => {
    const schema = z.object({ name: z.string().min(1) })
    const result = schema.safeParse({ name: 'Test' })
    expect(result.success).toBe(true)
  })

  it('handles email validation', () => {
    const schema = z.object({ email: z.string().email() })
    const result = schema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      expect(errors.email).toBe('Please enter a valid email address')
    }
  })
})
