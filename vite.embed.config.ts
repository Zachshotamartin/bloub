import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/embed/kumo-logo.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'embed/kumo-logo.js'
    }
  }
})
