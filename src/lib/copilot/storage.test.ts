import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadConversation, saveConversation, clearConversation } from './storage'
import type { CopilotMessage } from './types'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
}

Object.defineProperty(globalThis, 'window', { value: {} })
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('Conversation storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.clearAllMocks()
  })

  it('returns empty array when no conversation exists', () => {
    const messages = loadConversation('user1', 'accounts')
    expect(messages).toEqual([])
  })

  it('saves and loads conversation', () => {
    const msgs: CopilotMessage[] = [
      { role: 'user', content: 'What is fund accounting?' },
      { role: 'assistant', content: 'Fund accounting tracks...' },
    ]
    saveConversation('user1', 'accounts', msgs)
    const loaded = loadConversation('user1', 'accounts')
    expect(loaded).toEqual(msgs)
  })

  it('separates conversations by page', () => {
    saveConversation('user1', 'accounts', [{ role: 'user', content: 'Q1' }])
    saveConversation('user1', 'funds', [{ role: 'user', content: 'Q2' }])

    const accts = loadConversation('user1', 'accounts')
    const funds = loadConversation('user1', 'funds')
    expect(accts[0].content).toBe('Q1')
    expect(funds[0].content).toBe('Q2')
  })

  it('clears conversation', () => {
    saveConversation('user1', 'accounts', [{ role: 'user', content: 'test' }])
    clearConversation('user1', 'accounts')
    const loaded = loadConversation('user1', 'accounts')
    expect(loaded).toEqual([])
  })

  it('auto-clears stale conversations (>24h)', () => {
    // Manually store a stale conversation
    const stale = {
      messages: [{ role: 'user', content: 'old' }],
      lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    }
    store['copilot:user1:test'] = JSON.stringify(stale)

    const loaded = loadConversation('user1', 'test')
    expect(loaded).toEqual([])
  })
})
