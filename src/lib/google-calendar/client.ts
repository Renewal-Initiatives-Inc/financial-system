import { google } from 'googleapis'
import type { GoogleCalendarEvent } from './types'

function getAuth() {
  // Prefer OAuth2 refresh token if available (avoids service account sharing issues)
  if (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    )
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN })
    oauth2.quotaProjectId = 'renewal-initiatives-apps'
    return oauth2
  }

  // Fallback: service account key
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyBase64) {
    throw new Error(
      'Neither GOOGLE_CALENDAR_REFRESH_TOKEN nor GOOGLE_SERVICE_ACCOUNT_KEY is set.'
    )
  }

  const key = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'))
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
}

function getCalendarClient() {
  return google.calendar({ version: 'v3', auth: getAuth() })
}

export async function createEvent(
  calendarId: string,
  event: GoogleCalendarEvent
): Promise<string> {
  const calendar = getCalendarClient()
  const res = await calendar.events.insert({
    calendarId,
    requestBody: event,
  })
  if (!res.data.id) {
    throw new Error('Google Calendar createEvent: no event ID returned')
  }
  return res.data.id
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEvent
): Promise<void> {
  const calendar = getCalendarClient()
  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  })
}

export async function deleteEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient()
  await calendar.events.delete({ calendarId, eventId })
}

export async function listEvents(
  calendarId: string
): Promise<Array<{ id: string }>> {
  const calendar = getCalendarClient()
  const res = await calendar.events.list({
    calendarId,
    singleEvents: true,
    maxResults: 2500,
  })
  return (res.data.items ?? []).filter((e): e is { id: string } => Boolean(e.id))
}
