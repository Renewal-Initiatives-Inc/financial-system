import { describe, it, expect } from 'vitest'

/**
 * Tests for AI categorization acceptance/override tracking logic.
 *
 * The actual audit log write happens in the server action via logAudit().
 * Here we test the logic that determines whether the user accepted or
 * overrode the AI suggestion, and what metadata gets logged.
 */

interface AiSuggestion {
  accountId: number
  fundId: number
  confidence: 'high' | 'medium' | 'low'
}

function buildAiTrackingMetadata(
  userChoice: { glAccountId: number; fundId: number },
  aiSuggestion: AiSuggestion | null
): Record<string, unknown> | null {
  if (!aiSuggestion) return null

  const aiAccepted =
    aiSuggestion.accountId === userChoice.glAccountId &&
    aiSuggestion.fundId === userChoice.fundId

  return {
    glAccountId: userChoice.glAccountId,
    fundId: userChoice.fundId,
    aiConfidence: aiSuggestion.confidence,
    aiAccepted,
    ...(!aiAccepted && {
      aiSuggestedAccountId: aiSuggestion.accountId,
      aiSuggestedFundId: aiSuggestion.fundId,
    }),
  }
}

describe('AI categorization tracking', () => {
  it('logs aiAccepted: true when user accepts AI suggestion', () => {
    const metadata = buildAiTrackingMetadata(
      { glAccountId: 10, fundId: 1 },
      { accountId: 10, fundId: 1, confidence: 'high' }
    )

    expect(metadata).toEqual({
      glAccountId: 10,
      fundId: 1,
      aiConfidence: 'high',
      aiAccepted: true,
    })
  })

  it('logs aiAccepted: false with AI suggestion when user overrides account', () => {
    const metadata = buildAiTrackingMetadata(
      { glAccountId: 20, fundId: 1 },
      { accountId: 10, fundId: 1, confidence: 'medium' }
    )

    expect(metadata).toEqual({
      glAccountId: 20,
      fundId: 1,
      aiConfidence: 'medium',
      aiAccepted: false,
      aiSuggestedAccountId: 10,
      aiSuggestedFundId: 1,
    })
  })

  it('logs aiAccepted: false with AI suggestion when user overrides fund', () => {
    const metadata = buildAiTrackingMetadata(
      { glAccountId: 10, fundId: 2 },
      { accountId: 10, fundId: 1, confidence: 'low' }
    )

    expect(metadata).toEqual({
      glAccountId: 10,
      fundId: 2,
      aiConfidence: 'low',
      aiAccepted: false,
      aiSuggestedAccountId: 10,
      aiSuggestedFundId: 1,
    })
  })

  it('returns null when no AI suggestion was provided', () => {
    const metadata = buildAiTrackingMetadata(
      { glAccountId: 10, fundId: 1 },
      null
    )

    expect(metadata).toBeNull()
  })

  it('does not include aiSuggestedAccountId/FundId when accepted', () => {
    const metadata = buildAiTrackingMetadata(
      { glAccountId: 10, fundId: 1 },
      { accountId: 10, fundId: 1, confidence: 'high' }
    )

    expect(metadata).not.toHaveProperty('aiSuggestedAccountId')
    expect(metadata).not.toHaveProperty('aiSuggestedFundId')
  })
})
