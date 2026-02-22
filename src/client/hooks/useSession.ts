/**
 * Session persistence hook.
 *
 * Stores the session ID in localStorage so conversations persist across page loads.
 */

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'project-chat-session-id'

export function useSession(explicitSessionId?: string) {
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (explicitSessionId && explicitSessionId !== 'auto') return explicitSessionId
    if (typeof window === 'undefined') return undefined
    try {
      return localStorage.getItem(STORAGE_KEY) ?? undefined
    } catch {
      return undefined
    }
  })

  const updateSessionId = useCallback((id: string) => {
    setSessionId(id)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, id)
      } catch {
        // localStorage unavailable
      }
    }
  }, [])

  const clearSession = useCallback(() => {
    setSessionId(undefined)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // localStorage unavailable
      }
    }
  }, [])

  return { sessionId, updateSessionId, clearSession }
}
