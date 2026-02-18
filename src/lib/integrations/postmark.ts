/**
 * Postmark integration for donor acknowledgment letters.
 *
 * Sends templated emails via Postmark API.
 * Errors are logged but do not block GL entry creation.
 */

import { ServerClient } from 'postmark'
import type { DonorAcknowledgmentData } from '@/lib/revenue/donor-acknowledgment'

/** Format ISO date (2026-02-15) as "February 15, 2026" */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Format raw amount (5000.00) as "5,000.00" */
function formatCurrency(amount: string): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

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
        donation_date: formatDate(data.donationDate),
        donation_amount: formatCurrency(data.donationAmount),
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
