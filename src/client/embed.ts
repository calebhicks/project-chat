/**
 * Vanilla JS embed script for non-React projects (Astro, static HTML, etc.).
 *
 * Usage in HTML:
 *   <script type="module">
 *     import { mountProjectChat } from 'project-chat/embed'
 *     mountProjectChat({
 *       endpoint: '/api/chat',
 *       title: 'Help',
 *       greeting: 'Ask me anything!',
 *     })
 *   </script>
 *
 * Or load from CDN (once published):
 *   <script src="https://unpkg.com/project-chat/dist/embed.global.js"></script>
 *   <script>
 *     ProjectChat.mount({ endpoint: '/api/chat' })
 *   </script>
 *
 * This creates a React root in a shadow-free container and mounts <AgentChat />.
 * Requires React 18+ to be available (either from the page or bundled).
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { AgentChatProvider, type AgentChatConfig } from './context/AgentChatProvider.js'
import { AgentChat } from './components/AgentChat.js'

let root: ReactDOM.Root | null = null

export function mountProjectChat(config: AgentChatConfig): () => void {
  // Create container
  const container = document.createElement('div')
  container.id = 'project-chat-root'
  document.body.appendChild(container)

  // Mount React
  root = ReactDOM.createRoot(container)
  const agentChat = React.createElement(AgentChat, null)
  root.render(
    React.createElement(AgentChatProvider, { config, children: agentChat })
  )

  // Return cleanup function
  return () => {
    root?.unmount()
    container.remove()
    root = null
  }
}

export function unmountProjectChat() {
  root?.unmount()
  const container = document.getElementById('project-chat-root')
  container?.remove()
  root = null
}
