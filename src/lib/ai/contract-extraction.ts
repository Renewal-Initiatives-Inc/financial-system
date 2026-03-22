import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export type ExtractedMilestone = {
  name: string
  date: string | null
  description: string
}

export type ExtractedPaymentTerm = {
  schedule: string
  amount: string | null
  conditions: string | null
}

export type ExtractedCovenant = {
  type: string
  description: string
  deadline: string | null
}

export type ExtractedTerms = {
  milestones: ExtractedMilestone[]
  paymentTerms: ExtractedPaymentTerm[]
  deliverables: string[]
  covenants: ExtractedCovenant[]
  revenueClassification: 'GRANT_REVENUE' | 'EARNED_INCOME'
  classificationRationale: string
  fundingCategory: 'GRANT' | 'CONTRACT' | 'LOAN'
  classificationWasDefaulted: boolean
  categoryWasDefaulted: boolean
}

// Zod schema for validating AI-extracted contract terms
const extractedTermsSchema = z.object({
  milestones: z.array(z.object({
    name: z.string(),
    date: z.string().nullable().default(null),
    description: z.string().default(''),
  })).default([]),
  paymentTerms: z.array(z.object({
    schedule: z.string(),
    amount: z.string().nullable().default(null),
    conditions: z.string().nullable().default(null),
  })).default([]),
  deliverables: z.array(z.string()).default([]),
  covenants: z.array(z.object({
    type: z.string(),
    description: z.string(),
    deadline: z.string().nullable().default(null),
  })).default([]),
  revenueClassification: z.string().default(''),
  classificationRationale: z.string().default(''),
  fundingCategory: z.string().default(''),
})

const EXTRACTION_PROMPT = `You are analyzing a construction/vendor contract or purchase order for a nonprofit housing organization. Extract the following structured information from the document:

1. **Milestones**: Key dates, deadlines, and project phases. For each milestone, provide:
   - name: Short description
   - date: ISO date string (YYYY-MM-DD) if mentioned, or null
   - description: Detailed description

2. **Payment Terms**: This is the MOST IMPORTANT section. Look specifically for sections with headers like "Terms", "Payment Terms", "Terms and Conditions", "Terms & Conditions", "Invoicing", "Billing", "Payment Schedule", "Net 30", or similar. Extract:
   - schedule: When payment is due (e.g., "Net 30 from invoice date", "Due upon completion of Phase 1", "Monthly on the 1st")
   - amount: Dollar amount or percentage if specified, or null
   - conditions: Required documentation or conditions that must accompany an invoice for payment (e.g., "Must include receipts", "Requires lien waiver", "Progress photos required", "Signed timesheet required", "Certificate of insurance must be current"). This is critical — capture ALL requirements for what must be submitted WITH an invoice to receive payment.

3. **Deliverables**: List of specific deliverables or work products

4. **Covenants**: Insurance requirements, bonding, reporting obligations, or other ongoing obligations. For each:
   - type: Category (e.g., "Insurance", "Bonding", "Reporting", "Compliance")
   - description: What is required
   - deadline: When it must be provided/maintained, or null

5. **Revenue Classification**: Determine whether this funding should be classified as Grant Revenue or Earned Income for the nonprofit. Apply the distinction between ASC 958-605 (contributions) and ASC 606 (exchange transactions):
   - If the funder receives only public benefit and reporting (no commensurate value in return) → "GRANT_REVENUE"
   - If the funder receives direct value in return (services, deliverables for the funder's own benefit) → "EARNED_INCOME"
   - revenueClassification: Either "GRANT_REVENUE" or "EARNED_INCOME"
   - classificationRationale: 2-3 sentence explanation of why this classification applies

6. **Funding Category**: Classify the type of financial instrument:
   - "GRANT" — A contribution or award where no direct value is returned to the funder (grants, donations, awards)
   - "CONTRACT" — An exchange transaction where the organization delivers value to the contracting party (fee-for-service, construction contracts)
   - "LOAN" — A debt instrument creating a liability (credit facilities, mortgages, lines of credit)
   - fundingCategory: One of "GRANT", "CONTRACT", or "LOAN"

Return ONLY a valid JSON object with this exact structure:
{
  "milestones": [...],
  "paymentTerms": [...],
  "deliverables": [...],
  "covenants": [...],
  "revenueClassification": "GRANT_REVENUE" or "EARNED_INCOME",
  "classificationRationale": "...",
  "fundingCategory": "GRANT" or "CONTRACT" or "LOAN"
}

If a section has no relevant content, return an empty array for that section.`

export async function extractContractTerms(
  pdfBase64: string
): Promise<ExtractedTerms> {
  const client = new Anthropic()

  let response
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('Claude API error during contract extraction:', err)
    throw new Error(
      'Failed to extract contract terms. You can enter terms manually or retry your upload. The file may be too large or the request timed out.'
    )
  }

  // Check if response was truncated
  if (response.stop_reason === 'max_tokens') {
    console.error('Contract extraction truncated — response hit max_tokens')
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(
      'Failed to extract contract terms — no text in response. You can enter terms manually.'
    )
  }

  // Parse JSON from response, handling markdown code blocks and preamble text
  let jsonStr = textBlock.text.trim()

  // Strip markdown code fences (```json ... ```)
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  // If still not valid JSON, try to find the first { ... last }
  if (!jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
    }
  }

  try {
    const raw = JSON.parse(jsonStr)
    const parsed = extractedTermsSchema.parse(raw)

    const classificationWasDefaulted =
      parsed.revenueClassification !== 'GRANT_REVENUE' &&
      parsed.revenueClassification !== 'EARNED_INCOME'
    const categoryWasDefaulted =
      parsed.fundingCategory !== 'GRANT' &&
      parsed.fundingCategory !== 'CONTRACT' &&
      parsed.fundingCategory !== 'LOAN'

    return {
      milestones: parsed.milestones,
      paymentTerms: parsed.paymentTerms,
      deliverables: parsed.deliverables,
      covenants: parsed.covenants,
      revenueClassification:
        parsed.revenueClassification === 'EARNED_INCOME'
          ? 'EARNED_INCOME' as const
          : 'GRANT_REVENUE' as const,
      classificationRationale: parsed.classificationRationale,
      fundingCategory:
        parsed.fundingCategory === 'CONTRACT'
          ? 'CONTRACT' as const
          : parsed.fundingCategory === 'LOAN'
            ? 'LOAN' as const
            : 'GRANT' as const,
      classificationWasDefaulted,
      categoryWasDefaulted,
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('Failed to parse extraction JSON:', jsonStr.slice(0, 200))
      throw new Error(
        'Failed to parse extracted terms. You can enter terms manually or retry your upload.'
      )
    }
    // Zod validation error — log and re-throw as user-friendly message
    console.error('Extraction validation error:', err)
    throw new Error(
      'Failed to parse extracted terms. You can enter terms manually or retry your upload.'
    )
  }
}
