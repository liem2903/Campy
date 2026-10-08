import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Keep in sync with the Express server, which also reads PORT.
      '/api': `http://localhost:${process.env.PORT ?? 3000}`,
    },
  },
})
