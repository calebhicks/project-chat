/**
 * Hono adapter.
 *
 * Usage:
 *   import { Hono } from 'hono'
 *   import { createHandler } from 'project-chat/server'
 *   import { createHonoHandler } from 'project-chat/server'
 *   const handler = createHandler({ ... })
 *   app.post('/api/chat', createHonoHandler(handler))
 */

import type { AgentChatHandler } from '../handler.js'
import type { ChatRequest } from '../../shared/protocol.js'
import { serializeSSE } from '../../shared/protocol.js'

/**
 * Returns a Hono-compatible request handler.
 */
export function createHonoHandler(handler: AgentChatHandler) {
  return async function honoHandler(c: any) {
    const body: ChatRequest = await c.req.json()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of handler.handleMessage(body)) {
            controller.enqueue(new TextEncoder().encode(serializeSSE(event)))
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Internal error'
          controller.enqueue(
            new TextEncoder().encode(
              serializeSSE({ event: 'error', data: { message: msg } })
            )
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }
}
