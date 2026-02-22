/**
 * Session management for Agent SDK conversations.
 *
 * The Agent SDK supports resuming sessions via session ID. We store the mapping
 * between our client-side session IDs and the SDK session IDs, plus metadata.
 */

export interface SessionData {
  /** Agent SDK session ID (returned from query init message) */
  sdkSessionId?: string
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
