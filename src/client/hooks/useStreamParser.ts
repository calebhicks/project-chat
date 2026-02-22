/**
 * SSE stream parser hook.
 *
 * Takes a ReadableStream from a fetch response and emits typed ChatEvent objects.
 */

import { useCallback } from 'react'
import type { ChatEvent } from '../../shared/protocol.js'

export function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
  onDone: () => void,
  onError: (error: Error) => void,
) {
  const decoder = new TextDecoder()
  let buffer = ''

  async function pump(): Promise<void> {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          onDone()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent: string | null = null
        let currentData: string | null = null

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)
          } else if (line === '' && currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData)
              onEvent({ event: currentEvent, data } as ChatEvent)
            } catch {
              // Skip malformed events
            }
            currentEvent = null
            currentData = null
          }
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  pump()
}
