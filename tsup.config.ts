import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'server/index': 'src/server/index.ts',
    'mcp/index': 'src/mcp/index.ts',
    'shared/protocol': 'src/shared/protocol.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: false, // vite handles client dir
  outDir: 'dist',
  external: ['react', 'react-dom'],
})
