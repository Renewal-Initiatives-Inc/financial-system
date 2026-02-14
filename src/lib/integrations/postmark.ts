/**
 * Postmark integration for donor acknowledgment letters.
 *
 * Sends templated emails via Postmark API.
 * Errors are logged but do not block GL entry creation.
 */

import { ServerClient } from 'postmark'
import type { DonorAcknowledgmentData } from '@/lib/revenue/donor-acknowledgment'

function getClient(): ServerClient | null {
  const apiKey = process.env.POSTMARK_API_KEY
  if (!apiKey) {
    console.warn('POSTMARK_API_KEY not configured — email sending disabled')
    return null
  }
  return new ServerClient(apiKey)
}

export async function sendDonorAcknowledgmentEmail(
  to: string,
  data: DonorAcknowledgmentData
): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  const templateAlias =
    process.env.POSTMARK_DONOR_ACK_TEMPLATE ?? 'donor-acknowledgment'

  try {
    await client.sendEmailWithTemplate({
      From: process.env.POSTMARK_FROM_EMAIL ?? 'finance@renewalinitiatives.org',
      To: to,
      TemplateAlias: templateAlias,
      TemplateModel: {
        donor_name: data.donorName,
        donation_date: data.donationDate,
        donation_amount: data.donationAmount,
        fund_name: data.fundName,
        no_goods_or_services_statement: data.noGoodsOrServicesStatement,
      },
    })
    return true
  } catch (err) {
    console.error('Failed to send donor acknowledgment email:', err)
    return false
  }
}
