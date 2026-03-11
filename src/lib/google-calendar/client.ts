import { google } from 'googleapis'
import type { GoogleCalendarEvent } from './types'

function getAuth() {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyBase64) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. ' +
      'See docs/google-calendar-setup.md for setup instructions.'
    )
  }

  const keyJson = Buffer.from(keyBase64, 'base64').toString('utf-8')
  const key = JSON.parse(keyJson)

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
