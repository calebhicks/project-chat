/**
 * Project context MCP server.
 *
 * Indexes a project's docs and source code at startup. Exposes search tools
 * so the agent can find relevant content to answer user questions.
 *
 * Uses a simple keyword index (no external dependencies). For projects under
 * 10MB of docs/code, this runs comfortably in memory.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface ProjectContextConfig {
  /** Directory containing documentation files (markdown, etc.) */
  docsDir?: string

  /** Directory containing source code */
  codeDir?: string

  /** Glob patterns to include. Defaults to ['**\/*.md', '**\/*.ts', '**\/*.tsx', '**\/*.js', '**\/*.jsx'] */
  include?: string[]

  /** Glob patterns to exclude. Defaults to ['**\/node_modules\/**', '**\/dist\/**', '**\/.git\/**'] */
  exclude?: string[]

  /** Skip files larger than this (bytes). Defaults to 100KB. */
  maxFileSize?: number

  /** Path to OpenAPI/Swagger spec file. */
  apiSpec?: string
}

interface IndexedFile {
  path: string
  content: string
  type: 'doc' | 'code'
  /** Lowercase content for search */
  searchContent: string
}

function matchesPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Simple glob matching: ** matches any path, * matches any filename
    const regex = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\./g, '\\.')
    return new RegExp(`^${regex}$`).test(filePath)
  })
}

function walkDir(dir: string, basePath: string = dir): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, basePath))
    } else {
      results.push(path.relative(basePath, fullPath))
    }
  }
  return results
}

function searchIndex(files: IndexedFile[], query: string, maxResults: number = 5): IndexedFile[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const scored = files.map(file => {
    let score = 0
    for (const term of terms) {
      // Count occurrences
      let idx = -1
      while ((idx = file.searchContent.indexOf(term, idx + 1)) !== -1) {
        score++
      }
      // Bonus for filename match
      if (file.path.toLowerCase().includes(term)) {
        score += 5
      }
    }
    return { file, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.file)
}

function extractSnippet(content: string, query: string, contextLines: number = 3): string {
  const lines = content.split('\n')
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (terms.some(t => lower.includes(t))) {
      const start = Math.max(0, i - contextLines)
      const end = Math.min(lines.length, i + contextLines + 1)
      return lines.slice(start, end).join('\n')
    }
  }

  // Fallback: return first N lines
  return lines.slice(0, contextLines * 2 + 1).join('\n')
}

export function createProjectContextServer(config: ProjectContextConfig) {
  const {
    docsDir,
    codeDir,
    include = ['**/*.md', '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.go', '**/*.rs'],
    exclude = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**', '**/.next/**'],
    maxFileSize = 100_000,
    apiSpec,
  } = config

  // Build the file index at creation time
  const files: IndexedFile[] = []

  function indexDir(dir: string, type: 'doc' | 'code') {
    if (!dir) return
    const resolvedDir = path.resolve(dir)
    const allFiles = walkDir(resolvedDir)

    for (const relPath of allFiles) {
      if (matchesPattern(relPath, exclude)) continue
      if (!matchesPattern(relPath, include)) continue

      const fullPath = path.join(resolvedDir, relPath)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.size > maxFileSize) continue

        const content = fs.readFileSync(fullPath, 'utf-8')
        files.push({
          path: relPath,
          content,
          type,
          searchContent: content.toLowerCase(),
        })
      } catch {
        // Skip unreadable files
      }
    }
  }

  if (docsDir) indexDir(docsDir, 'doc')
  if (codeDir) indexDir(codeDir, 'code')

  // Load API spec if provided
  let apiSpecContent: string | null = null
  if (apiSpec && fs.existsSync(apiSpec)) {
    try {
      apiSpecContent = fs.readFileSync(apiSpec, 'utf-8')
    } catch {
      // Skip if unreadable
    }
  }

  const server = createSdkMcpServer({
    name: 'project-context',
    tools: [
      tool(
        'search_docs',
        'Search project documentation for relevant content. Returns matching excerpts with file paths.',
        { query: z.string().describe('Search query — what are you looking for in the docs?') },
        async ({ query: q }) => {
          const docFiles = files.filter(f => f.type === 'doc')
          if (docFiles.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No documentation files have been indexed.' }] }
          }
          const results = searchIndex(docFiles, q)
          if (results.length === 0) {
            return { content: [{ type: 'text' as const, text: `No documentation matches for: "${q}"` }] }
          }
          const text = results.map(f => {
            const snippet = extractSnippet(f.content, q)
            return `### ${f.path}\n\`\`\`\n${snippet}\n\`\`\``
          }).join('\n\n')
          return { content: [{ type: 'text' as const, text }] }
        }
      ),

      tool(
        'search_code',
        'Search project source code for relevant content. Returns matching code snippets with file paths.',
        { query: z.string().describe('Search query — function name, concept, or keyword to find in code') },
        async ({ query: q }) => {
          const codeFiles = files.filter(f => f.type === 'code')
          if (codeFiles.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No source code files have been indexed.' }] }
          }
          const results = searchIndex(codeFiles, q)
          if (results.length === 0) {
            return { content: [{ type: 'text' as const, text: `No code matches for: "${q}"` }] }
          }
          const text = results.map(f => {
            const snippet = extractSnippet(f.content, q, 5)
            return `### ${f.path}\n\`\`\`\n${snippet}\n\`\`\``
          }).join('\n\n')
          return { content: [{ type: 'text' as const, text }] }
        }
      ),

      tool(
        'read_file',
        'Read the full contents of a specific file in the project.',
        { path: z.string().describe('File path relative to the project root') },
        async ({ path: filePath }) => {
          const file = files.find(f => f.path === filePath)
          if (!file) {
            return { content: [{ type: 'text' as const, text: `File not found: ${filePath}` }] }
          }
          return { content: [{ type: 'text' as const, text: `# ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\`` }] }
        }
      ),

      tool(
        'list_files',
        'List all indexed project files, optionally filtered by a search term.',
        { filter: z.string().optional().describe('Optional: filter files by name substring') },
        async ({ filter }) => {
          let matching = files
          if (filter) {
            const lower = filter.toLowerCase()
            matching = files.filter(f => f.path.toLowerCase().includes(lower))
          }
          if (matching.length === 0) {
            return { content: [{ type: 'text' as const, text: filter ? `No files matching: "${filter}"` : 'No files indexed.' }] }
          }
          const grouped = {
            docs: matching.filter(f => f.type === 'doc').map(f => f.path),
            code: matching.filter(f => f.type === 'code').map(f => f.path),
          }
          const parts: string[] = []
          if (grouped.docs.length) parts.push(`## Documentation (${grouped.docs.length})\n${grouped.docs.map(p => `- ${p}`).join('\n')}`)
          if (grouped.code.length) parts.push(`## Source Code (${grouped.code.length})\n${grouped.code.map(p => `- ${p}`).join('\n')}`)
          return { content: [{ type: 'text' as const, text: parts.join('\n\n') }] }
        }
      ),

      tool(
        'get_project_summary',
        'Get a high-level summary of the project: README content, file structure overview, and total indexed files.',
        {},
        async () => {
          const readme = files.find(f => f.path.toLowerCase() === 'readme.md')
          const parts: string[] = []

          parts.push(`**Indexed files:** ${files.length} total (${files.filter(f => f.type === 'doc').length} docs, ${files.filter(f => f.type === 'code').length} code)`)

          if (readme) {
            parts.push(`## README\n\n${readme.content}`)
          }

          if (apiSpecContent) {
            // Just show the first 50 lines of the spec
            const specPreview = apiSpecContent.split('\n').slice(0, 50).join('\n')
            parts.push(`## API Spec (preview)\n\`\`\`\n${specPreview}\n\`\`\``)
          }

          return { content: [{ type: 'text' as const, text: parts.join('\n\n') }] }
        }
      ),
    ],
  })

  return {
    /** The MCP server instance. Pass to handler config as mcpServers value. */
    server,

    /** Number of indexed files. */
    fileCount: files.length,

    /** Re-index files (e.g., after a deploy). */
    reindex() {
      files.length = 0
      if (docsDir) indexDir(docsDir, 'doc')
      if (codeDir) indexDir(codeDir, 'code')
    },
  }
}
