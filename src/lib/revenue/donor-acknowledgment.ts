/**
 * Donor acknowledgment logic per IRS IRC § 170(f)(8).
 *
 * Written acknowledgment required for donations >$250.
 */

export interface DonorAcknowledgmentData {
  donorName: string
  donorEmail: string | null
  donationDate: string
  donationAmount: string
  fundName: string
  noGoodsOrServicesStatement: string
}

/**
 * Determine if a donor acknowledgment letter should be sent.
 * Per IRS rules, acknowledgment is required for donations strictly greater than $250.
 */
export function shouldSendAcknowledgment(amount: number): boolean {
  return amount > 250
}

/**
 * Build the data payload for a donor acknowledgment email.
 */
export function buildAcknowledgmentData(
  donorName: string,
  donorEmail: string | null,
  donationDate: string,
  donationAmount: string,
  fundName: string
): DonorAcknowledgmentData {
  return {
    donorName,
    donorEmail,
    donationDate,
    donationAmount,
    fundName,
    noGoodsOrServicesStatement:
      'No goods or services were provided in exchange for this contribution.',
  }
}
