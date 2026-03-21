#!/usr/bin/env node
/**
 * One-time script to get a Google OAuth2 refresh token for calendar access.
 * Run: node scripts/get-google-refresh-token.mjs
 */
import { createServer } from 'http'
import { google } from 'googleapis'
import { exec } from 'child_process'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3333/callback'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars first.')
  console.error('Example:')
  console.error('  GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy node scripts/get-google-refresh-token.mjs')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar'],
})

console.log('\nOpening browser for Google authorization...')
exec(`open "${authUrl}"`)
console.log('If browser did not open, visit:\n', authUrl)
console.log('\nWaiting for callback...')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3333`)
  const code = url.searchParams.get('code')

  if (!code) {
    res.writeHead(400)
    res.end('No code received.')
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h2>Success! You can close this tab and return to your terminal.</h2>')

    console.log('\n✅ Got refresh token!\n')
    console.log('Run these commands to store it in Vercel:\n')
    console.log(`printf '%s' '${tokens.refresh_token}' | vercel env add GOOGLE_CALENDAR_REFRESH_TOKEN production`)
    console.log(`printf '%s' '${tokens.refresh_token}' | vercel env add GOOGLE_CALENDAR_REFRESH_TOKEN development`)
    console.log(`printf '%s' '${CLIENT_ID}' | vercel env add GOOGLE_OAUTH_CLIENT_ID production`)
    console.log(`printf '%s' '${CLIENT_ID}' | vercel env add GOOGLE_OAUTH_CLIENT_ID development`)
    console.log(`printf '%s' '${CLIENT_SECRET}' | vercel env add GOOGLE_OAUTH_CLIENT_SECRET production`)
    console.log(`printf '%s' '${CLIENT_SECRET}' | vercel env add GOOGLE_OAUTH_CLIENT_SECRET development`)

    server.close()
  } catch (err) {
    res.writeHead(500)
    res.end('Error getting token: ' + err.message)
    console.error('Error:', err)
    server.close()
  }
})

server.listen(3333)
