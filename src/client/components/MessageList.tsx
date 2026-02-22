import React, { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../shared/protocol.js'
import { MessageBubble } from './MessageBubble.js'

interface MessageListProps {
  messages: ChatMessage[]
  isDark: boolean
  accentColor: string
  showToolUse: boolean
  isStreaming: boolean
}

export function MessageList({ messages, isDark, accentColor, showToolUse, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isDark={isDark}
          accentColor={accentColor}
          showToolUse={showToolUse}
        />
      ))}
      {isStreaming && messages.length > 0 && messages[messages.length - 1]?.content === '' && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '8px 14px',
        }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: isDark ? '#475569' : '#94a3b8',
                animation: `project-chat-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
              }}
            />
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
