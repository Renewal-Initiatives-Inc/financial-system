import Anthropic from '@anthropic-ai/sdk'

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
}

const EXTRACTION_PROMPT = `You are analyzing a construction/vendor contract for a nonprofit housing organization. Extract the following structured information from the contract:

1. **Milestones**: Key dates, deadlines, and project phases. For each milestone, provide:
   - name: Short description
   - date: ISO date string (YYYY-MM-DD) if mentioned, or null
   - description: Detailed description

2. **Payment Terms**: Payment schedule and conditions. For each term:
   - schedule: Description of when payment is due
   - amount: Dollar amount or percentage if specified, or null
   - conditions: Any conditions that must be met

3. **Deliverables**: List of specific deliverables or work products

4. **Covenants**: Insurance requirements, bonding, reporting obligations, or other ongoing obligations. For each:
   - type: Category (e.g., "Insurance", "Bonding", "Reporting", "Compliance")
   - description: What is required
   - deadline: When it must be provided/maintained, or null

Return ONLY a valid JSON object with this exact structure:
{
  "milestones": [...],
  "paymentTerms": [...],
  "deliverables": [...],
  "covenants": [...]
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
      max_tokens: 4096,
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

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(
      'Failed to extract contract terms — no text in response. You can enter terms manually.'
    )
  }

  // Parse JSON from response, handling markdown code blocks
  let jsonStr = textBlock.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const parsed = JSON.parse(jsonStr) as ExtractedTerms
    return {
      milestones: parsed.milestones ?? [],
      paymentTerms: parsed.paymentTerms ?? [],
      deliverables: parsed.deliverables ?? [],
      covenants: parsed.covenants ?? [],
    }
  } catch {
    console.error('Failed to parse extraction JSON:', jsonStr.slice(0, 200))
    throw new Error(
      'Failed to parse extracted terms. You can enter terms manually or retry your upload.'
    )
  }
}
