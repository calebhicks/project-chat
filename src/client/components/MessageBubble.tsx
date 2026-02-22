import React from 'react'
import type { ChatMessage } from '../../shared/protocol.js'
import { ToolIndicator } from './ToolIndicator.js'
import { Markdown } from './Markdown.js'

interface MessageBubbleProps {
  message: ChatMessage
  isDark: boolean
  accentColor: string
  showToolUse: boolean
}

export function MessageBubble({ message, isDark, accentColor, showToolUse }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 4,
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: 12,
        backgroundColor: isUser
          ? accentColor
          : isDark ? '#1e293b' : '#f1f5f9',
        color: isUser
          ? '#fff'
          : isDark ? '#e2e8f0' : '#1e293b',
        fontSize: 14,
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {message.content
          ? (isUser
              ? <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
              : <Markdown content={message.content} isDark={isDark} />)
          : (message.toolUses?.length ? null : '\u00A0')
        }
      </div>
      {showToolUse && message.toolUses && message.toolUses.length > 0 && (
        <ToolIndicator tools={message.toolUses} isDark={isDark} />
      )}
    </div>
  )
}
