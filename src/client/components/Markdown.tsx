/**
 * Lightweight markdown renderer for chat messages.
 *
 * Handles the common patterns that show up in Claude's responses:
 * - Code blocks (```language\ncode\n```)
 * - Inline code (`code`)
 * - Bold (**text**)
 * - Italic (*text*)
 * - Links ([text](url))
 * - Headers (## text)
 * - Bullet lists (- item)
 * - Numbered lists (1. item)
 *
 * No external dependencies. Not a full markdown parser — just enough for chat.
 */

import React, { useMemo } from 'react'

interface MarkdownProps {
  content: string
  isDark: boolean
}

interface ParsedBlock {
  type: 'paragraph' | 'code' | 'heading' | 'list'
  content: string
  language?: string
  level?: number
  items?: string[]
  ordered?: boolean
}

function parseBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code', content: codeLines.join('\n'), language })
      i++ // skip closing ```
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[2], level: headingMatch[1].length })
      i++
      continue
    }

    // List (bullet or numbered)
    if (line.match(/^[\s]*[-*]\s/) || line.match(/^[\s]*\d+\.\s/)) {
      const items: string[] = []
      const ordered = !!line.match(/^[\s]*\d+\.\s/)
      while (i < lines.length && (lines[i].match(/^[\s]*[-*]\s/) || lines[i].match(/^[\s]*\d+\.\s/))) {
        items.push(lines[i].replace(/^[\s]*[-*]\s/, '').replace(/^[\s]*\d+\.\s/, ''))
        i++
      }
      blocks.push({ type: 'list', content: '', items, ordered })
      continue
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !lines[i].match(/^#{1,4}\s/) && !lines[i].match(/^[\s]*[-*]\s/) && !lines[i].match(/^[\s]*\d+\.\s/)) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') })
    }
  }

  return blocks
}

function renderInline(text: string, isDark: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Combined regex for inline patterns
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|\[([^\]]+)\]\(([^)]+)\)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      // Inline code
      const code = match[1].slice(1, -1)
      nodes.push(
        <code key={match.index} style={{
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          padding: '1px 5px',
          borderRadius: 3,
          fontSize: '0.9em',
          fontFamily: 'ui-monospace, "Cascadia Mono", Menlo, Monaco, monospace',
        }}>{code}</code>
      )
    } else if (match[2]) {
      // Bold
      nodes.push(<strong key={match.index}>{match[2].slice(2, -2)}</strong>)
    } else if (match[3]) {
      // Italic
      nodes.push(<em key={match.index}>{match[3].slice(1, -1)}</em>)
    } else if (match[4] && match[5]) {
      // Link
      nodes.push(
        <a key={match.index} href={match[5]} target="_blank" rel="noopener noreferrer" style={{
          color: isDark ? '#93c5fd' : '#2563eb',
          textDecoration: 'underline',
        }}>{match[4]}</a>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}

export function Markdown({ content, isDark }: MarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'code':
            return (
              <div key={i} style={{
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                borderRadius: 6,
                overflow: 'hidden',
              }}>
                {block.language && (
                  <div style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    color: isDark ? '#64748b' : '#94a3b8',
                    borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                  }}>
                    {block.language}
                  </div>
                )}
                <pre style={{
                  margin: 0,
                  padding: '8px 10px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: 'ui-monospace, "Cascadia Mono", Menlo, Monaco, monospace',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                }}>
                  {block.content}
                </pre>
              </div>
            )

          case 'heading':
            return (
              <div key={i} style={{
                fontWeight: 600,
                fontSize: block.level === 1 ? 18 : block.level === 2 ? 16 : 14,
                marginTop: i > 0 ? 4 : 0,
              }}>
                {renderInline(block.content, isDark)}
              </div>
            )

          case 'list':
            const ListTag = block.ordered ? 'ol' : 'ul'
            return (
              <ListTag key={i} style={{
                margin: 0,
                paddingLeft: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                {block.items?.map((item, j) => (
                  <li key={j}>{renderInline(item, isDark)}</li>
                ))}
              </ListTag>
            )

          case 'paragraph':
          default:
            return (
              <div key={i}>
                {renderInline(block.content, isDark)}
              </div>
            )
        }
      })}
    </div>
  )
}
