import { defineConfig } from 'tsup'

export default defineConfig([
  // Server + MCP + shared (Node.js)
  {
    entry: {
      'server/index': 'src/server/index.ts',
      'mcp/index': 'src/mcp/index.ts',
      'shared/protocol': 'src/shared/protocol.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: false,
    outDir: 'dist',
    external: ['react', 'react-dom', 'zod'],
    noExternal: [],
  },
  // Client (React) — built by tsup for proper .d.ts output
  {
    entry: {
      'client/index': 'src/client/index.ts',
      'client/embed': 'src/client/embed.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: false,
    outDir: 'dist',
    external: ['react', 'react-dom', 'react/jsx-runtime', '@anthropic-ai/claude-agent-sdk'],
    esbuildOptions(options) {
      options.jsx = 'automatic'
    },
  },
])
