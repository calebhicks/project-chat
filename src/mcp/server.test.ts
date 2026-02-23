import { describe, it, expect, beforeAll } from 'vitest'
import { createProjectChatServer } from './server.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('createProjectChatServer', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcs-test-'))
    const docsDir = path.join(tmpDir, 'docs')
    fs.mkdirSync(docsDir)
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Getting Started\n\nInstall with `npm install mylib`.')
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir)
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export function hello() { return "world" }')
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project\n\nA test project.')
  })

  it('creates a server with name and tools', () => {
    const server = createProjectChatServer({
      name: 'Test',
      docsDir: path.join(tmpDir, 'docs'),
      codeDir: path.join(tmpDir, 'src'),
    })

    expect(server.name).toBe('Test')
    expect(server.tools.length).toBe(5) // search_docs, search_code, read_file, list_files, get_project_summary
    expect(server.fileCount).toBe(2) // guide.md + index.ts
  })

  it('generates a system prompt from name and description', () => {
    const server = createProjectChatServer({
      name: 'MyLib',
      description: 'A library for widgets',
    })
    expect(server.systemPrompt).toContain('MyLib')
    expect(server.systemPrompt).toContain('library for widgets')
  })

  it('uses custom system prompt when provided', () => {
    const server = createProjectChatServer({
      name: 'Test',
      systemPrompt: 'Custom prompt here',
    })
    expect(server.systemPrompt).toBe('Custom prompt here')
  })

  it('callTool executes search_docs', async () => {
    const server = createProjectChatServer({
      name: 'Test',
      docsDir: path.join(tmpDir, 'docs'),
    })
    const result = await server.callTool('search_docs', { query: 'install' })
    expect(result.content[0].text).toContain('npm install')
  })

  it('callTool executes search_code', async () => {
    const server = createProjectChatServer({
      name: 'Test',
      codeDir: path.join(tmpDir, 'src'),
    })
    const result = await server.callTool('search_code', { query: 'hello' })
    expect(result.content[0].text).toContain('function hello')
  })

  it('callTool returns error for unknown tool', async () => {
    const server = createProjectChatServer({ name: 'Test' })
    const result = await server.callTool('nonexistent', {})
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unknown tool')
  })

  it('toAnthropicTools returns correct format', () => {
    const server = createProjectChatServer({
      name: 'Test',
      docsDir: path.join(tmpDir, 'docs'),
    })
    const tools = server.toAnthropicTools()
    expect(tools[0]).toHaveProperty('name')
    expect(tools[0]).toHaveProperty('description')
    expect(tools[0]).toHaveProperty('input_schema')
  })

  it('accepts custom tools', async () => {
    const server = createProjectChatServer({
      name: 'Test',
      tools: [{
        name: 'custom_tool',
        description: 'A custom tool',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ content: [{ type: 'text' as const, text: 'custom result' }] }),
      }],
    })

    expect(server.tools.length).toBe(6) // 5 built-in + 1 custom
    const result = await server.callTool('custom_tool', {})
    expect(result.content[0].text).toBe('custom result')
  })

  it('reindex picks up new files', () => {
    const server = createProjectChatServer({
      name: 'Test',
      codeDir: path.join(tmpDir, 'src'),
    })
    expect(server.fileCount).toBe(1)

    const newFile = path.join(tmpDir, 'src', 'new.ts')
    fs.writeFileSync(newFile, 'export const x = 1')
    server.reindex()
    expect(server.fileCount).toBe(2)

    fs.unlinkSync(newFile)
  })
})
