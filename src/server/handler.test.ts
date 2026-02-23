import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHandler } from './handler.js'
import { createMessagesHandler } from './messages-handler.js'
import type { ChatEvent } from '../shared/protocol.js'
import type { ProjectChatMcpServer } from '../mcp/types.js'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn(),
      },
    })),
  }
})

import Anthropic from '@anthropic-ai/sdk'
const MockAnthropic = vi.mocked(Anthropic)

function mockServer(overrides?: Partial<ProjectChatMcpServer>): ProjectChatMcpServer {
  return {
    name: 'test',
    tools: [],
    systemPrompt: 'Test prompt',
    fileCount: 0,
    callTool: vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'result' }] })),
    toAnthropicTools: vi.fn(() => []),
    reindex: vi.fn(),
    ...overrides,
  }
}

function mockStreamResponse(content: string, stopReason: string = 'end_turn') {
  const events = [
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: content } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
  ]
  return {
    [Symbol.asyncIterator]: async function* () { for (const e of events) yield e },
    finalMessage: async () => ({
      id: 'msg-test',
      content: [{ type: 'text', text: content }],
      stop_reason: stopReason,
    }),
  }
}

async function collectEvents(handler: { handleMessage: (req: any) => AsyncGenerator<ChatEvent> }, message: string): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of handler.handleMessage({ message })) {
    events.push(event)
  }
  return events
}

describe('createHandler (routing)', () => {
  it('routes to messages handler for ProjectChatMcpServer', () => {
    const handler = createHandler({ mcpServers: { test: mockServer() } })
    expect(handler).toBeDefined()
    expect(handler.handleMessage).toBeDefined()
  })

  it('routes to agent handler for Agent SDK configs', () => {
    const handler = createHandler({
      mcpServers: { test: { command: 'npx', args: ['something'] } },
    })
    expect(handler).toBeDefined()
  })
})

describe('createMessagesHandler', () => {
  let mockClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = { messages: { stream: vi.fn() } }
    MockAnthropic.mockImplementation(() => mockClient)
  })

  it('validates empty messages', async () => {
    const handler = createMessagesHandler({ servers: {} })
    const events = await collectEvents(handler, '')
    expect(events[0].event).toBe('error')
    expect((events[0] as any).data.code).toBe('INVALID_INPUT')
  })

  it('validates message length', async () => {
    const handler = createMessagesHandler({ servers: {}, maxInputLength: 10 })
    const events = await collectEvents(handler, 'a'.repeat(11))
    expect(events[0].event).toBe('error')
    expect((events[0] as any).data.code).toBe('INPUT_TOO_LONG')
  })

  it('emits session event before streaming', async () => {
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Hello'))
    const handler = createMessagesHandler({ servers: { test: mockServer() } })
    const events = await collectEvents(handler, 'Hi')
    expect(events[0].event).toBe('session')
    expect((events[0] as any).data.sessionId).toBeTruthy()
  })

  it('streams content deltas', async () => {
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Hello! I can help.'))
    const handler = createMessagesHandler({ servers: { test: mockServer() } })
    const events = await collectEvents(handler, 'Hi')

    const content = events.filter(e => e.event === 'content_delta')
    expect(content).toHaveLength(1)
    expect((content[0] as any).data.text).toBe('Hello! I can help.')
  })

  it('emits done on completion', async () => {
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Done'))
    const handler = createMessagesHandler({ servers: { test: mockServer() } })
    const events = await collectEvents(handler, 'Hi')
    expect(events.some(e => e.event === 'done')).toBe(true)
  })

  it('handles API errors', async () => {
    mockClient.messages.stream.mockImplementation(() => { throw new Error('Rate limit exceeded') })
    const handler = createMessagesHandler({ servers: { test: mockServer() } })
    const events = await collectEvents(handler, 'Hi')
    const errors = events.filter(e => e.event === 'error')
    expect(errors).toHaveLength(1)
    expect((errors[0] as any).data.message).toContain('Rate limit')
  })

  it('calls lifecycle hooks', async () => {
    const onStart = vi.fn()
    const onEnd = vi.fn()
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Hello'))
    const handler = createMessagesHandler({
      servers: { test: mockServer() },
      onMessageStart: onStart,
      onMessageEnd: onEnd,
    })
    await collectEvents(handler, 'Hi')
    expect(onStart).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('namespaces tools from multiple servers', async () => {
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Hello'))
    const s1 = mockServer({ toAnthropicTools: () => [{ name: 'search', description: 'search docs', input_schema: { type: 'object' as const, properties: {} } }] })
    const s2 = mockServer({ toAnthropicTools: () => [{ name: 'search', description: 'search code', input_schema: { type: 'object' as const, properties: {} } }] })
    const handler = createMessagesHandler({ servers: { docs: s1, code: s2 } })
    await collectEvents(handler, 'Hi')

    const callArgs = mockClient.messages.stream.mock.calls[0][0]
    const names = callArgs.tools.map((t: any) => t.name)
    expect(names).toContain('docs__search')
    expect(names).toContain('code__search')
  })

  it('includes page context in user message', async () => {
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Page info'))
    const handler = createMessagesHandler({ servers: { test: mockServer() } })
    const events: ChatEvent[] = []
    for await (const e of handler.handleMessage({
      message: 'What is this?',
      context: { page: { url: 'https://x.com/docs', pathname: '/docs', title: 'Docs' } },
    })) { events.push(e) }

    const callArgs = mockClient.messages.stream.mock.calls[0][0]
    // The user message is the first one sent to the API
    const userMsg = callArgs.messages.find((m: any) => m.role === 'user')
    expect(JSON.stringify(userMsg.content)).toContain('Docs')
  })

  it('preserves conversation history', async () => {
    mockClient.messages.stream.mockReturnValue(mockStreamResponse('First'))
    const handler = createMessagesHandler({ servers: { test: mockServer() } })

    for await (const _ of handler.handleMessage({ message: 'Hello', sessionId: 'sess' })) {}

    mockClient.messages.stream.mockReturnValue(mockStreamResponse('Second'))
    for await (const _ of handler.handleMessage({ message: 'Follow up', sessionId: 'sess' })) {}

    const secondCall = mockClient.messages.stream.mock.calls[1][0]
    expect(secondCall.messages.length).toBeGreaterThan(1)
  })
})
