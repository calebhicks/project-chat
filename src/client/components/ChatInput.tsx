import React, { useState, useCallback, useRef } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
  isStreaming: boolean
  placeholder: string
  maxLength: number
  isDark: boolean
  accentColor: string
}

export function ChatInput({ onSend, isStreaming, placeholder, maxLength, isDark, accentColor }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isStreaming, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setValue(textarea.value)
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      padding: '12px 16px',
      borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={isStreaming}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 14,
          lineHeight: 1.5,
          fontFamily: 'inherit',
          backgroundColor: isDark ? '#0f172a' : '#fff',
          color: isDark ? '#e2e8f0' : '#1e293b',
          outline: 'none',
          overflow: 'hidden',
        }}
        onFocus={e => {
          e.target.style.borderColor = accentColor
          e.target.style.boxShadow = `0 0 0 1px ${accentColor}`
        }}
        onBlur={e => {
          e.target.style.borderColor = isDark ? '#334155' : '#d1d5db'
          e.target.style.boxShadow = 'none'
        }}
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || isStreaming}
        aria-label="Send message"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: 'none',
          backgroundColor: !value.trim() || isStreaming
            ? isDark ? '#334155' : '#e2e8f0'
            : accentColor,
          color: !value.trim() || isStreaming
            ? isDark ? '#64748b' : '#94a3b8'
            : '#fff',
          cursor: !value.trim() || isStreaming ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background-color 0.15s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
