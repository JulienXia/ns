import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward API calls to the Express server during development,
      // so the frontend can simply call `/api/...`.
      '/api': 'http://localhost:3001',
    },
  },
})
