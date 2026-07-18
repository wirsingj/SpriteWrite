import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getConfiguredPort(): number | undefined {
  const raw = process.env.SPRITEWRITE_PORT
  if (!raw) {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return undefined
  }

  return parsed
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: getConfiguredPort(),
  },
  plugins: [react()],
})
