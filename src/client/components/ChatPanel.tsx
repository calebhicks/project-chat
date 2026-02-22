import React from 'react'
import type { ChatMessage } from '../../shared/protocol.js'
import { MessageList } from './MessageList.js'
import { ChatInput } from './ChatInput.js'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onStop: () => void
  onClear: () => void
  isStreaming: boolean
  isDark: boolean
  accentColor: string
  title: string
  placeholder: string
  maxMessageLength: number
  showToolUse: boolean
  greeting?: string
  error: Error | null
  onClose: () => void
}

export function ChatPanel({
  messages,
  onSend,
  onStop,
  onClear,
  isStreaming,
  isDark,
  accentColor,
  title,
  placeholder,
  maxMessageLength,
  showToolUse,
  greeting,
  error,
  onClose,
}: ChatPanelProps) {
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
        padding: '12px 16px',
        backgroundColor: accentColor,
        color: '#fff',
      }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {messages.length > 0 && (
            <button
              onClick={onClear}
              aria-label="Clear chat history"
              title="Clear history"
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: isDark ? '#450a0a' : '#fef2f2',
          color: isDark ? '#fca5a5' : '#dc2626',
          fontSize: 13,
          borderBottom: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
        }}>
          {error.message}
        </div>
      )}

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
