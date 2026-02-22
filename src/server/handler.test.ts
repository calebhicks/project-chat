import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHandler } from './handler.js'
import type { ChatEvent } from '../shared/protocol.js'

// Mock the Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

import { query } from '@anthropic-ai/claude-agent-sdk'
const mockQuery = vi.mocked(query)

async function collectEvents(handler: ReturnType<typeof createHandler>, message: string): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of handler.handleMessage({ message })) {
    events.push(event)
  }
  return events
}

describe('createHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates empty messages', async () => {
    const handler = createHandler({})
    const events = await collectEvents(handler, '')
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error')
    expect((events[0] as any).data.code).toBe('INVALID_INPUT')
  })

  it('validates message length', async () => {
    const handler = createHandler({ maxInputLength: 10 })
    const events = await collectEvents(handler, 'a'.repeat(11))
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error')
    expect((events[0] as any).data.code).toBe('INPUT_TOO_LONG')
  })

  it('emits session event before streaming', async () => {
    // Mock query to return an async generator with a result
    mockQuery.mockReturnValue((async function* () {
      yield { type: 'result', result: 'ok' }
    })() as any)

    const handler = createHandler({})
    const events = await collectEvents(handler, 'Hello')

    expect(events[0].event).toBe('session')
    expect((events[0] as any).data.sessionId).toBeTruthy()
  })

  it('maps assistant messages to content_delta events', async () => {
    mockQuery.mockReturnValue((async function* () {
      yield {
        type: 'assistant',
        message: {
          id: 'msg-1',
          content: [
            { type: 'text', text: 'Hello! I can help with that.' },
          ],
        },
      }
      yield { type: 'result', result: 'ok' }
    })() as any)

    const handler = createHandler({})
    const events = await collectEvents(handler, 'Hi')

    const contentEvents = events.filter(e => e.event === 'content_delta')
    expect(contentEvents).toHaveLength(1)
    expect((contentEvents[0] as any).data.text).toBe('Hello! I can help with that.')
  })

  it('maps tool_use blocks to tool events', async () => {
    mockQuery.mockReturnValue((async function* () {
      yield {
        type: 'assistant',
        message: {
          id: 'msg-1',
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'search_docs', input: { query: 'test' } },
          ],
        },
      }
      yield { type: 'result', result: 'ok' }
    })() as any)

    const handler = createHandler({})
    const events = await collectEvents(handler, 'Search for tests')

    const toolStart = events.filter(e => e.event === 'tool_use_start')
    expect(toolStart).toHaveLength(1)
    expect((toolStart[0] as any).data.tool).toBe('search_docs')
  })

  it('emits done event on result', async () => {
    mockQuery.mockReturnValue((async function* () {
      yield { type: 'result', result: 'ok' }
    })() as any)

    const handler = createHandler({})
    const events = await collectEvents(handler, 'Hello')

    const done = events.filter(e => e.event === 'done')
    expect(done).toHaveLength(1)
  })

  it('handles Agent SDK errors gracefully', async () => {
    mockQuery.mockReturnValue((async function* () {
      throw new Error('API rate limit exceeded')
    })() as any)

    const handler = createHandler({})
    const events = await collectEvents(handler, 'Hello')

    const errorEvents = events.filter(e => e.event === 'error')
    expect(errorEvents).toHaveLength(1)
    expect((errorEvents[0] as any).data.message).toContain('rate limit')
  })

  it('calls lifecycle hooks', async () => {
    const onStart = vi.fn()
    const onEnd = vi.fn()

    mockQuery.mockReturnValue((async function* () {
      yield { type: 'result', result: 'ok' }
    })() as any)

    const handler = createHandler({
      onMessageStart: onStart,
      onMessageEnd: onEnd,
    })
    await collectEvents(handler, 'Hello')

    expect(onStart).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('includes page context in prompt when provided', async () => {
    mockQuery.mockReturnValue((async function* () {
      yield { type: 'result', result: 'ok' }
    })() as any)

    const handler = createHandler({})
    await collectEvents(handler, '')

    // Message was empty, so we get an error — try with valid message + context
    const events: ChatEvent[] = []
    for await (const event of handler.handleMessage({
      message: 'How does this page work?',
      context: {
        page: { url: 'https://example.com/docs', pathname: '/docs', title: 'Documentation' },
      },
    })) {
      events.push(event)
    }

    // Check that query was called with page context in the prompt
    expect(mockQuery).toHaveBeenCalled()
    const callArgs = mockQuery.mock.calls[0][0] as any
    expect(callArgs.prompt).toContain('Documentation')
    expect(callArgs.prompt).toContain('/docs')
  })
})
