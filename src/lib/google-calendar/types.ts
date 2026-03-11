export interface GoogleCalendarEventDateTime {
  date?: string       // YYYY-MM-DD for all-day events
  dateTime?: string   // RFC 3339 for timed events
  timeZone?: string
}

export interface GoogleCalendarEventSource {
  title: string
  url: string
}

export interface GoogleCalendarEvent {
  summary: string
  description?: string
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
  source?: GoogleCalendarEventSource
}

