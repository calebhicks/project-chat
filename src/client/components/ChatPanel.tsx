import React from 'react'
import type { ChatMessage } from '../../shared/protocol.js'
import { MessageList } from './MessageList.js'
import { ChatInput } from './ChatInput.js'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  isDark: boolean
  accentColor: string
  title: string
  placeholder: string
  maxMessageLength: number
  showToolUse: boolean
  greeting?: string
  onClose: () => void
}

export function ChatPanel({
  messages,
  onSend,
  onStop,
  isStreaming,
  isDark,
  accentColor,
  title,
  placeholder,
  maxMessageLength,
  showToolUse,
  greeting,
  onClose,
}: ChatPanelProps) {
  // Prepend greeting as a system message if present and no messages yet
  const displayMessages: ChatMessage[] = greeting && messages.length === 0
    ? [{
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
      }, ...messages]
    : messages

  return (
    <div style={{
      width: 380,
      maxWidth: 'calc(100vw - 32px)',
      height: 520,
      maxHeight: 'calc(100vh - 100px)',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isDark ? '#0f172a' : '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: accentColor,
        color: '#fff',
      }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            opacity: 0.8,
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.8' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <MessageList
        messages={displayMessages}
        isDark={isDark}
        accentColor={accentColor}
        showToolUse={showToolUse}
        isStreaming={isStreaming}
      />

      {/* Input */}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        placeholder={placeholder}
        maxLength={maxMessageLength}
        isDark={isDark}
        accentColor={accentColor}
      />
    </div>
  )
}
