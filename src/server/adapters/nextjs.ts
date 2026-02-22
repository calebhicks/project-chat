/**
 * Next.js App Router adapter.
 *
 * Usage:
 *   // app/api/chat/route.ts
 *   import { createHandler } from 'project-chat/server'
 *   import { createNextHandler } from 'project-chat/server'
 *   const handler = createHandler({ ... })
 *   export const { POST } = createNextHandler(handler)
 */

import type { AgentChatHandler } from '../handler.js'
import type { ChatRequest } from '../../shared/protocol.js'
import { serializeSSE } from '../../shared/protocol.js'

export function createNextHandler(handler: AgentChatHandler) {
  async function POST(request: Request): Promise<Response> {
    let body: ChatRequest
    try {
      body = await request.json() as ChatRequest
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

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

  return { POST }
}
