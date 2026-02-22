import React from 'react'
import type { ToolUseRecord } from '../../shared/protocol.js'

const TOOL_LABELS: Record<string, string> = {
  search_docs: 'Searching docs',
  search_code: 'Searching code',
  read_file: 'Reading file',
  list_files: 'Listing files',
  get_project_summary: 'Reading project summary',
  get_current_page: 'Checking page context',
  get_page_content: 'Reading page content',
  Read: 'Reading file',
  Glob: 'Finding files',
  Grep: 'Searching code',
}

interface ToolIndicatorProps {
  tools: ToolUseRecord[]
  isDark: boolean
}

export function ToolIndicator({ tools, isDark }: ToolIndicatorProps) {
  const running = tools.filter(t => t.status === 'running')
  if (running.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      padding: '4px 0',
    }}>
      {running.map(t => (
        <span
          key={t.id}
          style={{
            fontSize: 12,
            color: isDark ? '#94a3b8' : '#64748b',
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            borderRadius: 4,
            padding: '2px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            animation: 'project-chat-pulse 1.5s ease-in-out infinite',
          }} />
          {TOOL_LABELS[t.tool] ?? t.tool}
        </span>
      ))}
    </div>
  )
}
