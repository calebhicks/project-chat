/**
 * Express adapter.
 *
 * Usage:
 *   import express from 'express'
 *   import { createHandler } from 'project-chat/server'
 *   import { createExpressRouter } from 'project-chat/server'
 *   const handler = createHandler({ ... })
 *   app.use('/api/chat', createExpressRouter(handler))
 */

import type { AgentChatHandler } from '../handler.js'
import type { ChatRequest } from '../../shared/protocol.js'
import { serializeSSE } from '../../shared/protocol.js'

/**
 * Returns an Express-compatible request handler function.
 * Expects JSON body parsing middleware to be applied upstream.
 */
export function createExpressHandler(handler: AgentChatHandler) {
  return async function expressHandler(req: any, res: any) {
    const body: ChatRequest = req.body

    if (!body?.message) {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    try {
      for await (const event of handler.handleMessage(body)) {
        res.write(serializeSSE(event))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error'
      res.write(serializeSSE({ event: 'error', data: { message: msg } }))
    } finally {
      res.end()
    }
  }
}
