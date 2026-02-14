/**
 * Ramp sync failure notification via Postmark (INT-P0-017).
 */

export async function sendSyncFailureEmail(error: string): Promise<void> {
  const apiKey = process.env.POSTMARK_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL

  if (!apiKey || !adminEmail) {
    console.error('Postmark or admin email not configured — skipping sync failure notification')
    return
  }

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
        Subject: `Ramp sync failed — ${new Date().toISOString().substring(0, 10)}`,
        TextBody: [
          'Ramp daily sync failed.',
          '',
          `Error: ${error}`,
          `Timestamp: ${new Date().toISOString()}`,
          '',
          'The sync will retry on the next daily poll. No transactions were lost — they persist in Ramp.',
        ].join('\n'),
      }),
    })
  } catch (notifyErr) {
    console.error('Failed to send sync failure notification:', notifyErr)
  }
}
