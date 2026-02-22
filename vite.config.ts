import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/client/index.ts'),
      formats: ['es'],
      fileName: () => 'client/index.js',
    },
    outDir: 'dist',
    emptyOutDir: false, // tsup handles server dirs
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    sourcemap: true,
  },
})
