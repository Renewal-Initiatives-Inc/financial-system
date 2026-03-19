import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the parsing/validation logic by mocking the Anthropic API
// and exercising extractContractTerms end-to-end.

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { extractContractTerms } from './contract-extraction'

function makeResponse(jsonStr: string) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: jsonStr }],
  }
}

describe('extractContractTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses valid AI response with correct enums — wasDefaulted: false', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          milestones: [{ name: 'Phase 1', date: '2026-06-01', description: 'Foundation' }],
          paymentTerms: [{ schedule: 'Monthly', amount: '5000', conditions: null }],
          deliverables: ['Report'],
          covenants: [{ type: 'Insurance', description: 'GL policy', deadline: null }],
          revenueClassification: 'EARNED_INCOME',
          classificationRationale: 'Exchange transaction per ASC 606',
          fundingCategory: 'CONTRACT',
        })
      )
    )

    const result = await extractContractTerms('dummybase64')

    expect(result.revenueClassification).toBe('EARNED_INCOME')
    expect(result.fundingCategory).toBe('CONTRACT')
    expect(result.classificationWasDefaulted).toBe(false)
    expect(result.categoryWasDefaulted).toBe(false)
    expect(result.milestones).toHaveLength(1)
    expect(result.paymentTerms).toHaveLength(1)
    expect(result.deliverables).toEqual(['Report'])
    expect(result.covenants).toHaveLength(1)
  })

  it('defaults unrecognized revenueClassification to GRANT_REVENUE with wasDefaulted: true', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          milestones: [],
          paymentTerms: [],
          deliverables: [],
          covenants: [],
          revenueClassification: 'SOMETHING_INVALID',
          classificationRationale: '',
          fundingCategory: 'GRANT',
        })
      )
    )

    const result = await extractContractTerms('dummybase64')

    expect(result.revenueClassification).toBe('GRANT_REVENUE')
    expect(result.classificationWasDefaulted).toBe(true)
    expect(result.categoryWasDefaulted).toBe(false)
  })

  it('defaults unrecognized fundingCategory to GRANT with wasDefaulted: true', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          milestones: [],
          paymentTerms: [],
          deliverables: [],
          covenants: [],
          revenueClassification: 'GRANT_REVENUE',
          classificationRationale: '',
          fundingCategory: 'UNKNOWN_TYPE',
        })
      )
    )

    const result = await extractContractTerms('dummybase64')

    expect(result.fundingCategory).toBe('GRANT')
    expect(result.categoryWasDefaulted).toBe(true)
    expect(result.classificationWasDefaulted).toBe(false)
  })

  it('defaults both enums when both are unrecognized', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          milestones: [],
          paymentTerms: [],
          deliverables: [],
          covenants: [],
          revenueClassification: '',
          classificationRationale: '',
          fundingCategory: '',
        })
      )
    )

    const result = await extractContractTerms('dummybase64')

    expect(result.revenueClassification).toBe('GRANT_REVENUE')
    expect(result.fundingCategory).toBe('GRANT')
    expect(result.classificationWasDefaulted).toBe(true)
    expect(result.categoryWasDefaulted).toBe(true)
  })

  it('handles missing optional arrays gracefully', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          revenueClassification: 'GRANT_REVENUE',
          classificationRationale: 'Contribution',
          fundingCategory: 'GRANT',
        })
      )
    )

    const result = await extractContractTerms('dummybase64')

    expect(result.milestones).toEqual([])
    expect(result.paymentTerms).toEqual([])
    expect(result.deliverables).toEqual([])
    expect(result.covenants).toEqual([])
    expect(result.classificationWasDefaulted).toBe(false)
    expect(result.categoryWasDefaulted).toBe(false)
  })

  it('handles markdown-fenced JSON response', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        '```json\n' +
          JSON.stringify({
            milestones: [],
            paymentTerms: [],
            deliverables: [],
            covenants: [],
            revenueClassification: 'EARNED_INCOME',
            classificationRationale: 'ASC 606',
            fundingCategory: 'CONTRACT',
          }) +
          '\n```'
      )
    )

    const result = await extractContractTerms('dummybase64')
    expect(result.revenueClassification).toBe('EARNED_INCOME')
    expect(result.fundingCategory).toBe('CONTRACT')
    expect(result.classificationWasDefaulted).toBe(false)
    expect(result.categoryWasDefaulted).toBe(false)
  })

  it('throws user-friendly error on malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('not valid json at all'))

    await expect(extractContractTerms('dummybase64')).rejects.toThrow(
      'Failed to parse extracted terms'
    )
  })

  it('throws user-friendly error when no text block in response', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [],
    })

    await expect(extractContractTerms('dummybase64')).rejects.toThrow(
      'Failed to extract contract terms'
    )
  })

  it('LOAN classification produces wasDefaulted: false', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          milestones: [],
          paymentTerms: [],
          deliverables: [],
          covenants: [],
          revenueClassification: 'GRANT_REVENUE',
          classificationRationale: '',
          fundingCategory: 'LOAN',
        })
      )
    )

    const result = await extractContractTerms('dummybase64')
    expect(result.fundingCategory).toBe('LOAN')
    expect(result.categoryWasDefaulted).toBe(false)
  })
})
