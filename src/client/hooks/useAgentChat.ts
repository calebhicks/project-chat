/**
 * Core chat hook.
 *
 * Manages the connection to the backend, message state, and streaming.
 * Use this directly if you're building a custom UI instead of <AgentChat />.
 */

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatRequest, ChatEvent, ToolUseRecord } from '../../shared/protocol.js'
import { parseSSEStream } from './useStreamParser.js'
import { useSession } from './useSession.js'

export interface UseAgentChatOptions {
  /** Backend endpoint URL (e.g., '/api/chat') */
  endpoint: string

  /** Session ID. 'auto' uses localStorage. Pass an explicit ID to control it yourself. */
  sessionId?: string | 'auto'

  /** Called when an error occurs. */
  onError?: (error: Error) => void
}

export interface UseAgentChatReturn {
  messages: ChatMessage[]
  send: (text: string) => void
  isStreaming: boolean
  activeTools: ToolUseRecord[]
  sessionId: string | undefined
  clearHistory: () => void
  error: Error | null
}

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { endpoint, onError } = options
  const { sessionId, updateSessionId, clearSession } = useSession(options.sessionId)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolUseRecord[]>([])
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])
    setIsStreaming(true)
    setError(null)
    setActiveTools([])

    // Build request
    const body: ChatRequest = {
      message: text.trim(),
      sessionId,
      context: typeof window !== 'undefined' ? {
        page: {
          url: window.location.href,
          pathname: window.location.pathname,
          title: document.title,
          referrer: document.referrer || undefined,
        },
      } : undefined,
    }

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolUses: [],
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      abortRef.current = new AbortController()

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()

      parseSSEStream(
        reader,
        (event: ChatEvent) => {
          switch (event.event) {
            case 'session':
              updateSessionId(event.data.sessionId)
              break

            case 'content_delta':
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.data.text }
                  : m
              ))
              break

            case 'tool_use_start': {
              const toolUse: ToolUseRecord = {
                id: event.data.id,
                tool: event.data.tool,
                status: 'running',
              }
              setActiveTools(prev => [...prev, toolUse])
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolUses: [...(m.toolUses ?? []), toolUse] }
                  : m
              ))
              break
            }

            case 'tool_use_end':
              setActiveTools(prev => prev.filter(t => t.id !== event.data.id))
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolUses: m.toolUses?.map(t =>
                        t.id === event.data.id ? { ...t, status: 'complete' as const } : t
                      ),
                    }
                  : m
              ))
              break

            case 'error':
              setError(new Error(event.data.message))
              onError?.(new Error(event.data.message))
              break

            case 'done':
              // Stream complete
              break
          }
        },
        () => {
          setIsStreaming(false)
          setActiveTools([])
        },
        (err) => {
          setIsStreaming(false)
          setActiveTools([])
          setError(err)
          onError?.(err)
        },
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const error = err instanceof Error ? err : new Error(String(err))
      setIsStreaming(false)
      setError(error)
      onError?.(error)
    }
  }, [endpoint, sessionId, isStreaming, updateSessionId, onError])

  const clearHistory = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setIsStreaming(false)
    setActiveTools([])
    setError(null)
    clearSession()
  }, [clearSession])

  return {
    messages,
    send,
    isStreaming,
    activeTools,
    sessionId,
    clearHistory,
    error,
  }
}
