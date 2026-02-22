import React from 'react'

interface ChatBubbleProps {
  onClick: () => void
  isOpen: boolean
  accentColor: string
}

export function ChatBubble({ onClick, isOpen, accentColor }: ChatBubbleProps) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: accentColor,
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: isOpen ? 'scale(0.9)' : 'scale(1)',
      }}
      onMouseEnter={e => {
        ;(e.target as HTMLElement).style.transform = isOpen ? 'scale(0.95)' : 'scale(1.05)'
        ;(e.target as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
      }}
      onMouseLeave={e => {
        ;(e.target as HTMLElement).style.transform = isOpen ? 'scale(0.9)' : 'scale(1)'
        ;(e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isOpen ? (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        ) : (
          <>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </>
        )}
      </svg>
    </button>
  )
}
