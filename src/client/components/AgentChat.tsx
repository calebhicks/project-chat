/**
 * The full chat widget: floating bubble + slide-out panel.
 *
 * Drop this inside an <AgentChatProvider> and you get an intercom-style
 * chat widget in the corner of the page.
 */

import React, { useState, useMemo } from 'react'
import { useAgentChatConfig, type ThemeConfig } from '../context/AgentChatProvider.js'
import { useAgentChat } from '../hooks/useAgentChat.js'
import { ChatBubble } from './ChatBubble.js'
import { ChatPanel } from './ChatPanel.js'

function resolveTheme(theme: 'light' | 'dark' | 'system' | ThemeConfig | undefined): {
  isDark: boolean
  accentColor: string
  fontFamily: string
} {
  if (typeof theme === 'object') {
    return {
      isDark: theme.mode === 'dark',
      accentColor: theme.accentColor ?? '#6366f1',
      fontFamily: theme.fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }
  }

  const prefersDark = typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
    : false

  const isDark = theme === 'dark' || (theme !== 'light' && prefersDark)

  return {
    isDark,
    accentColor: '#6366f1',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }
}

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  'bottom-right': { bottom: 20, right: 20 },
  'bottom-left': { bottom: 20, left: 20 },
  'top-right': { top: 20, right: 20 },
  'top-left': { top: 20, left: 20 },
}

const PANEL_POSITIONS: Record<string, React.CSSProperties> = {
  'bottom-right': { bottom: 76, right: 0 },
  'bottom-left': { bottom: 76, left: 0 },
  'top-right': { top: 76, right: 0 },
  'top-left': { top: 76, left: 0 },
}

// Keyframe animations injected once
const STYLE_ID = 'project-chat-styles'

function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes project-chat-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes project-chat-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    @keyframes project-chat-slide-in {
      from { opacity: 0; transform: translateY(8px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `
  document.head.appendChild(style)
}

export function AgentChat() {
  const config = useAgentChatConfig()
  const [isOpen, setIsOpen] = useState(false)

  const { isDark, accentColor } = useMemo(
    () => resolveTheme(config.theme),
    [config.theme]
  )

  const chat = useAgentChat({
    endpoint: config.endpoint,
    sessionId: config.sessionId,
    onError: config.onError,
  })

  // Inject CSS animations
  ensureStyles()

  const position = config.position ?? 'bottom-right'

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 2147483647,
        ...POSITION_STYLES[position],
      }}
    >
      {/* Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...PANEL_POSITIONS[position],
            animation: 'project-chat-slide-in 0.2s ease-out',
          }}
        >
          <ChatPanel
            messages={chat.messages}
            onSend={chat.send}
            onStop={chat.stop}
            isStreaming={chat.isStreaming}
            isDark={isDark}
            accentColor={accentColor}
            title={config.title ?? 'Chat'}
            placeholder={config.placeholder ?? 'Ask a question...'}
            maxMessageLength={config.maxMessageLength ?? 4000}
            showToolUse={config.showToolUse ?? true}
            greeting={config.greeting}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      {/* Bubble */}
      <ChatBubble
        onClick={() => setIsOpen(prev => !prev)}
        isOpen={isOpen}
        accentColor={accentColor}
      />
    </div>
  )
}
