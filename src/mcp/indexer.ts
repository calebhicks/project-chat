/**
 * Shared file indexing logic.
 *
 * Used by both createProjectChatServer() and createProjectContextServer().
 * Pure functions — no side effects, no MCP dependency.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface IndexedFile {
  path: string
  content: string
  type: 'doc' | 'code'
  searchContent: string
}

export const DEFAULT_DOC_EXTENSIONS = ['.md', '.mdx', '.txt', '.rst']
export const DEFAULT_CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
  '.rb', '.php', '.vue', '.svelte', '.astro', '.css', '.scss',
  '.yaml', '.yml', '.toml', '.json',
]
export const DEFAULT_EXCLUDE_DIRS = [
  'node_modules', 'dist', '.git', 'build', '.next', '__pycache__',
  '.venv', 'vendor', '.turbo', '.cache', 'coverage',
]

export function walkDir(dir: string, basePath: string, excludeDirs: string[]): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue
        results.push(...walkDir(path.join(dir, entry.name), basePath, excludeDirs))
      } else {
        results.push(path.relative(basePath, path.join(dir, entry.name)))
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results
}

export function indexDir(
  dir: string,
  type: 'doc' | 'code',
  extensions: string[],
  excludeDirs: string[],
  maxFileSize: number,
): IndexedFile[] {
  if (!dir) return []
  const resolvedDir = path.resolve(dir)
  const allFiles = walkDir(resolvedDir, resolvedDir, excludeDirs)
  const results: IndexedFile[] = []

  for (const relPath of allFiles) {
    const ext = path.extname(relPath).toLowerCase()
    if (!extensions.includes(ext)) continue

    const fullPath = path.join(resolvedDir, relPath)
    try {
      const stat = fs.statSync(fullPath)
      if (stat.size > maxFileSize) continue

      const content = fs.readFileSync(fullPath, 'utf-8')
      results.push({
        path: relPath,
        content,
        type,
        searchContent: content.toLowerCase(),
      })
    } catch {
      // Skip unreadable files
    }
  }
  return results
}

export function searchIndex(files: IndexedFile[], query: string, maxResults: number = 5): IndexedFile[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const scored = files.map(file => {
    let score = 0
    for (const term of terms) {
      let idx = -1
      while ((idx = file.searchContent.indexOf(term, idx + 1)) !== -1) {
        score++
      }
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

export function extractSnippet(content: string, query: string, contextLines: number = 3): string {
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

  return lines.slice(0, contextLines * 2 + 1).join('\n')
}
