import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Convenience only, for LAN/other-device testing: lets the browser
      // call /api/llm/complete on the dev server's own origin instead of
      // directly on http://127.0.0.1:8787. The proxy process must still be
      // running; this does not change what it does or how it validates
      // requests. See src/mission-003/root-artifacts/vite.config.ts.snippet.txt.
      '/api/llm': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: true,
  },
})
