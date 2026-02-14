import type { CopilotMessage } from './types'

const PREFIX = 'copilot'
const EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface StoredConversation {
  messages: CopilotMessage[]
  lastUpdated: string
}

function getKey(userId: string, pageId: string): string {
  return `${PREFIX}:${userId}:${pageId}`
}

export function loadConversation(userId: string, pageId: string): CopilotMessage[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(getKey(userId, pageId))
    if (!raw) return []

    const stored: StoredConversation = JSON.parse(raw)
    const lastUpdated = new Date(stored.lastUpdated).getTime()

    // Auto-clear if stale (24h inactivity)
    if (Date.now() - lastUpdated > EXPIRY_MS) {
      localStorage.removeItem(getKey(userId, pageId))
      return []
    }

    return stored.messages
  } catch {
    return []
  }
}

export function saveConversation(
  userId: string,
  pageId: string,
  messages: CopilotMessage[]
): void {
  if (typeof window === 'undefined') return

  try {
    const stored: StoredConversation = {
      messages,
      lastUpdated: new Date().toISOString(),
    }
    localStorage.setItem(getKey(userId, pageId), JSON.stringify(stored))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

export function clearConversation(userId: string, pageId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getKey(userId, pageId))
}
