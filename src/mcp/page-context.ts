/**
 * Page context MCP server.
 *
 * The frontend sends page metadata (URL, title, content) with each request.
 * This in-process MCP server holds that context and exposes it as tools
 * the agent can call to understand where the user is browsing.
 *
 * Uses the Agent SDK's createSdkMcpServer() for zero-overhead in-process MCP.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { PageContext, PageContent } from '../shared/protocol.js'

interface PageState {
  page?: PageContext
  content?: PageContent
  metadata?: Record<string, unknown>
}

export function createPageContextServer() {
  let state: PageState = {}

  const server = createSdkMcpServer({
    name: 'page-context',
    tools: [
      tool(
        'get_current_page',
        'Get information about the page the user is currently viewing: URL, title, pathname',
        {},
        async () => {
          if (!state.page) {
            return {
              content: [{ type: 'text' as const, text: 'No page context available. The user has not provided page information.' }],
            }
          }
          return {
            content: [{
              type: 'text' as const,
              text: [
                `URL: ${state.page.url}`,
                `Title: ${state.page.title}`,
                `Path: ${state.page.pathname}`,
                state.page.referrer ? `Referrer: ${state.page.referrer}` : null,
                state.metadata ? `\nMetadata: ${JSON.stringify(state.metadata, null, 2)}` : null,
              ].filter(Boolean).join('\n'),
            }],
          }
        }
      ),
      tool(
        'get_page_content',
        'Get the text content, headings, and code blocks from the page the user is currently viewing. Only available if the frontend sends page content extraction.',
        {},
        async () => {
          if (!state.content) {
            return {
              content: [{ type: 'text' as const, text: 'No page content available. The frontend has not sent page content extraction.' }],
            }
          }
          const parts: string[] = []
          if (state.content.headings?.length) {
            parts.push('## Headings\n' + state.content.headings.map(h => `- ${h}`).join('\n'))
          }
          if (state.content.text) {
            parts.push('## Text Content\n' + state.content.text)
          }
          if (state.content.codeBlocks?.length) {
            parts.push('## Code Blocks\n' + state.content.codeBlocks.map(c => '```\n' + c + '\n```').join('\n\n'))
          }
          return {
            content: [{ type: 'text' as const, text: parts.join('\n\n') || 'Page content is empty.' }],
          }
        }
      ),
    ],
  })

  return {
    /** The MCP server instance. Pass to handler config as mcpServers value. */
    server,

    /** Update the page context. Called by the handler before each query(). */
    updateContext(page?: PageContext, content?: PageContent, metadata?: Record<string, unknown>) {
      state = { page, content, metadata }
    },
  }
}
