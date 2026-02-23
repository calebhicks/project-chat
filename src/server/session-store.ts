/**
 * Session management for chat conversations.
 *
 * Supports both handler modes:
 * - Messages handler: stores conversation history in `history` field
 * - Agent SDK handler: stores SDK session ID in `sdkSessionId` field
 */

export interface SessionData {
  /** Agent SDK session ID (agent handler mode) */
  sdkSessionId?: string
  /** Conversation history (messages handler mode) */
  history?: Array<{ role: string; content: unknown }>
  createdAt: number
  lastActiveAt: number
  messageCount: number
}

export interface SessionStore {
  get(id: string): Promise<SessionData | null>
  set(id: string, data: SessionData): Promise<void>
  delete(id: string): Promise<void>
}

/**
 * In-memory session store. Fine for single-process deployments.
 * For production with multiple servers, implement SessionStore with Redis or a database.
 */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionData>()
  private maxAge: number

  constructor(opts?: { maxAgeMs?: number }) {
    this.maxAge = opts?.maxAgeMs ?? 24 * 60 * 60 * 1000 // 24h default
  }

  async get(id: string): Promise<SessionData | null> {
    const session = this.sessions.get(id)
    if (!session) return null
    if (Date.now() - session.lastActiveAt > this.maxAge) {
      this.sessions.delete(id)
      return null
    }
    return session
  }

  async set(id: string, data: SessionData): Promise<void> {
    this.sessions.set(id, data)
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id)
  }
}
