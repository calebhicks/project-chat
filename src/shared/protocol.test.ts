import { describe, it, expect } from 'vitest'
import { serializeSSE, parseSSELine } from './protocol.js'
import type { ChatEvent } from './protocol.js'

describe('serializeSSE', () => {
  it('serializes a content_delta event', () => {
    const event: ChatEvent = { event: 'content_delta', data: { text: 'Hello' } }
    const result = serializeSSE(event)
    expect(result).toBe('event: content_delta\ndata: {"text":"Hello"}\n\n')
  })

  it('serializes an error event', () => {
    const event: ChatEvent = { event: 'error', data: { message: 'Bad request', code: 'INVALID_INPUT' } }
    const result = serializeSSE(event)
    expect(result).toContain('event: error')
    expect(result).toContain('"message":"Bad request"')
    expect(result).toContain('"code":"INVALID_INPUT"')
  })

  it('serializes a session event', () => {
    const event: ChatEvent = { event: 'session', data: { sessionId: 'abc-123' } }
    const result = serializeSSE(event)
    expect(result).toContain('"sessionId":"abc-123"')
  })
})

describe('parseSSELine', () => {
  it('parses an event line', () => {
    expect(parseSSELine('event: content_delta')).toEqual({
      field: 'event',
      value: 'content_delta',
    })
  })

  it('parses a data line', () => {
    expect(parseSSELine('data: {"text":"hi"}')).toEqual({
      field: 'data',
      value: '{"text":"hi"}',
    })
  })

  it('returns null for lines without colon', () => {
    expect(parseSSELine('nofield')).toBeNull()
  })
})
