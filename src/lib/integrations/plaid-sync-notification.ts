/**
 * Plaid sync failure notification via Postmark (INT-P0-017).
 */

export async function sendPlaidSyncFailureEmail(
  error: string,
  bankAccountName?: string
): Promise<void> {
  const apiKey = process.env.POSTMARK_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL

  if (!apiKey || !adminEmail) {
    console.error(
      'Postmark or admin email not configured — skipping Plaid sync failure notification'
    )
    return
  }

  const subject = bankAccountName
    ? `Plaid sync failed for ${bankAccountName} — ${new Date().toISOString().substring(0, 10)}`
    : `Plaid sync failed — ${new Date().toISOString().substring(0, 10)}`

  try {
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiKey,
      },
      body: JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL ?? adminEmail,
        To: adminEmail,
        Subject: subject,
        TextBody: [
          'Plaid daily bank sync failed.',
          '',
          ...(bankAccountName ? [`Bank Account: ${bankAccountName}`] : []),
          `Error: ${error}`,
          `Timestamp: ${new Date().toISOString()}`,
          '',
          'The sync will retry on the next daily poll. Bank transaction data is not lost.',
        ].join('\n'),
      }),
    })
  } catch (notifyErr) {
    console.error('Failed to send Plaid sync failure notification:', notifyErr)
  }
}
