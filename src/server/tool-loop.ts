/**
 * Agentic tool loop using the Anthropic Messages API.
 *
 * Calls the API with streaming, handles tool_use responses by executing
 * tools via ProjectChatMcpServer.callTool(), feeds results back, repeats
 * until the model says stop or we hit the turn limit.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ContentBlockParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { ChatEvent } from '../shared/protocol.js'
import type { ProjectChatMcpServer, AnthropicToolDefinition } from '../mcp/types.js'

export interface ToolLoopConfig {
  client: Anthropic
  model: string
  systemPrompt: string
  messages: MessageParam[]
  tools: AnthropicToolDefinition[]
  servers: Record<string, ProjectChatMcpServer>
  maxTokens: number
  maxToolTurns: number
}

/**
 * Parse a namespaced tool name back to server + tool.
 * "project__search_docs" → ["project", "search_docs"]
 */
function parseToolName(name: string): [string, string] {
  const idx = name.indexOf('__')
  if (idx === -1) return ['', name]
  return [name.slice(0, idx), name.slice(idx + 2)]
}

export async function* runToolLoop(config: ToolLoopConfig): AsyncGenerator<ChatEvent> {
  const { client, model, systemPrompt, messages, tools, servers, maxTokens, maxToolTurns } = config

  let turnCount = 0

  while (turnCount < maxToolTurns) {
    turnCount++

    // Call Messages API with streaming
    const stream = client.messages.stream({
      model,
      system: systemPrompt,
      messages,
      tools: tools as any,
      max_tokens: maxTokens,
    })

    // Track tool use blocks for this turn
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    let currentToolId: string | null = null

    for await (const event of stream) {
      // Stream text deltas immediately
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { event: 'content_delta', data: { text: event.delta.text } }
      }

      // Track tool use starts
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        currentToolId = event.content_block.id
        yield {
          event: 'tool_use_start',
          data: { id: event.content_block.id, tool: event.content_block.name },
        }
      }

      // Collect tool input from deltas
      if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
        // Input is accumulated by the SDK; we just track it's happening
      }
    }

    // Get the final message
    const finalMessage = await stream.finalMessage()

    // Add assistant message to history
    messages.push({ role: 'assistant', content: finalMessage.content })

    // Yield message end
    yield { event: 'message_end', data: { id: finalMessage.id } }

    // Check if we're done (no tool use)
    if (finalMessage.stop_reason === 'end_turn' || finalMessage.stop_reason === 'max_tokens') {
      break
    }

    // Execute any tool calls
    const toolResults: ToolResultBlockParam[] = []
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        const [serverName, toolName] = parseToolName(block.name)
        const server = servers[serverName]

        let result
        if (server) {
          result = await server.callTool(toolName, block.input as Record<string, unknown>)
        } else {
          result = {
            content: [{ type: 'text' as const, text: `Unknown server: ${serverName}` }],
            isError: true,
          }
        }

        yield { event: 'tool_use_end', data: { id: block.id, tool: block.name } }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.content.map(c => ({ type: 'text' as const, text: c.text })),
          is_error: result.isError,
        })
      }
    }

    if (toolResults.length === 0) {
      break // No tools were called, we're done
    }

    // Add tool results and loop
    messages.push({ role: 'user', content: toolResults as ContentBlockParam[] })
  }
}
