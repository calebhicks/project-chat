import React, { createContext, useContext, type ReactNode } from 'react'

export interface ThemeConfig {
  mode: 'light' | 'dark'
  accentColor?: string
  fontFamily?: string
  borderRadius?: string
  chatBubbleColor?: string
  userBubbleColor?: string
}

export interface AgentChatConfig {
  /** Backend endpoint URL (e.g., '/api/chat') */
  endpoint: string

  /** Session handling. 'auto' persists to localStorage. Pass an explicit ID to control it. */
  sessionId?: string | 'auto'

  /** Widget position. Defaults to 'bottom-right'. */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

  /** Color theme. Defaults to 'system'. */
  theme?: 'light' | 'dark' | 'system' | ThemeConfig

  /** Initial greeting message from the assistant. */
  greeting?: string

  /** Input placeholder text. */
  placeholder?: string

  /** Panel header title. */
  title?: string

  /** Show tool use indicators. Defaults to true. */
  showToolUse?: boolean

  /** Max input message length. Defaults to 4000. */
  maxMessageLength?: number

  /** Called on error. */
  onError?: (error: Error) => void
}

const AgentChatContext = createContext<AgentChatConfig | null>(null)

export function useAgentChatConfig(): AgentChatConfig {
  const config = useContext(AgentChatContext)
  if (!config) {
    throw new Error('useAgentChatConfig must be used within <AgentChatProvider>')
  }
  return config
}

export function AgentChatProvider({
  config,
  children,
}: {
  config: AgentChatConfig
  children: ReactNode
}) {
  return (
    <AgentChatContext.Provider value={config}>
      {children}
    </AgentChatContext.Provider>
  )
}
