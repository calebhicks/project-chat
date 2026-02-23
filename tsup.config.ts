import { defineConfig } from 'tsup'

export default defineConfig([
  // Server + MCP + shared + CLI (Node.js)
  {
    entry: {
      'server/index': 'src/server/index.ts',
      'mcp/index': 'src/mcp/index.ts',
      'mcp/cli': 'src/mcp/cli.ts',
      'shared/protocol': 'src/shared/protocol.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: false,
    outDir: 'dist',
    external: ['react', 'react-dom', 'zod', '@anthropic-ai/claude-agent-sdk'],
    noExternal: [],
  },
  // Client (React)
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
    external: ['react', 'react-dom', 'react/jsx-runtime', '@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk'],
    esbuildOptions(options) {
      options.jsx = 'automatic'
    },
  },
])
