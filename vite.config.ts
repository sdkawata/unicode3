import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'

// DBファイルのハッシュを計算（キャッシュバスティング用）
function getDbVersion(): string {
  const dbPath = 'public/unicode.db'
  if (existsSync(dbPath)) {
    return createHash('md5')
      .update(readFileSync(dbPath))
      .digest('hex')
      .slice(0, 8)
  }
  return 'dev'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_URL || '/',
  define: {
    __DB_VERSION__: JSON.stringify(getDbVersion()),
  },
})
