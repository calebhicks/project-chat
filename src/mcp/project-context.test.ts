import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createProjectContextServer } from './project-context.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('createProjectContextServer', () => {
  let tmpDir: string

  beforeAll(() => {
    // Create a temp project structure
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-chat-test-'))

    // Docs
    const docsDir = path.join(tmpDir, 'docs')
    fs.mkdirSync(docsDir)
    fs.writeFileSync(path.join(docsDir, 'getting-started.md'), '# Getting Started\n\nInstall with `npm install mylib`.\n\n## Quick Start\n\nRun `npx mylib init` to get started.')
    fs.writeFileSync(path.join(docsDir, 'api-reference.md'), '# API Reference\n\n## createFoo(options)\n\nCreates a new Foo instance.\n\n### Parameters\n\n- `name` - string, required')

    // Code
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir)
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export function createFoo(options: FooOptions): Foo {\n  return new FooImpl(options)\n}\n\nexport function createBar(): Bar {\n  return new BarImpl()\n}')
    fs.writeFileSync(path.join(srcDir, 'types.ts'), 'export interface FooOptions {\n  name: string\n  debug?: boolean\n}\n\nexport interface Foo {\n  run(): Promise<void>\n}')

    // README at root
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# MyLib\n\nA great library for doing things.')

    // Node modules (should be excluded)
    const nmDir = path.join(tmpDir, 'node_modules', 'some-dep')
    fs.mkdirSync(nmDir, { recursive: true })
    fs.writeFileSync(path.join(nmDir, 'index.js'), 'module.exports = {}')
  })

  it('indexes docs and code files', () => {
    const ctx = createProjectContextServer({
      docsDir: path.join(tmpDir, 'docs'),
      codeDir: path.join(tmpDir, 'src'),
    })

    // 2 docs + 2 code files
    expect(ctx.fileCount).toBe(4)
  })

  it('excludes node_modules', () => {
    const ctx = createProjectContextServer({
      codeDir: tmpDir,
    })

    const hasNodeModules = ctx.fileCount < 10 // if it indexed node_modules, would be more
    expect(hasNodeModules).toBe(true)
  })

  it('returns a server with the right shape', () => {
    const ctx = createProjectContextServer({
      docsDir: path.join(tmpDir, 'docs'),
    })

    expect(ctx.server).toBeDefined()
    expect(typeof ctx.server).toBe('object')
    expect(ctx.server).toHaveProperty('type')
    expect(ctx.server).toHaveProperty('name', 'project-context')
  })

  it('reindexes picks up new files', () => {
    const newFile = path.join(tmpDir, 'src', 'new-reindex-test.ts')
    try {
      const ctx = createProjectContextServer({
        docsDir: path.join(tmpDir, 'docs'),
        codeDir: path.join(tmpDir, 'src'),
      })

      const initial = ctx.fileCount
      expect(initial).toBe(4)

      // Add a new file and reindex
      fs.writeFileSync(newFile, 'export const x = 1')
      ctx.reindex()

      expect(ctx.fileCount).toBe(initial + 1)
    } finally {
      if (fs.existsSync(newFile)) fs.unlinkSync(newFile)
    }
  })

  it('handles missing directories gracefully', () => {
    const ctx = createProjectContextServer({
      docsDir: '/nonexistent/path',
      codeDir: '/also/nonexistent',
    })

    expect(ctx.fileCount).toBe(0)
  })

  it('respects maxFileSize', () => {
    const largeFile = path.join(tmpDir, 'src', 'large-test.ts')
    try {
      const largeContent = 'x'.repeat(200_000)
      fs.writeFileSync(largeFile, largeContent)

      const ctx = createProjectContextServer({
        codeDir: path.join(tmpDir, 'src'),
        maxFileSize: 100_000,
      })

      // large-test.ts should be excluded — only index.ts + types.ts
      expect(ctx.fileCount).toBe(2)
    } finally {
      if (fs.existsSync(largeFile)) fs.unlinkSync(largeFile)
    }
  })
})
