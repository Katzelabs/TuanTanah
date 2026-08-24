import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In dev, proxy API + websocket traffic to the backend on :3000.
//
// DEV_SERVER_PORT / DEV_CLIENT_PORT override those defaults so several git
// worktrees can run their own dev stack side by side without fighting over
// ports (see docs/PARALLEL_TICKETS.md). Read from process.env rather than
// loadEnv so prod builds are untouched.
export default defineConfig(({ mode }) => {
  // Absolute origin for social-share (og:/twitter:) tags, e.g.
  // https://tuantanah.com. Leave VITE_PUBLIC_URL blank to emit root-relative
  // URLs (most crawlers resolve those against the page, but Facebook's debugger
  // prefers absolute — set it for prod).
  const env = loadEnv(mode, process.cwd(), '')
  const publicUrl = (env.VITE_PUBLIC_URL ?? '').replace(/\/$/, '')
  const backendPort = process.env.DEV_SERVER_PORT ?? '3000'
  const backend = `http://localhost:${backendPort}`

  return {
    resolve: {
      // `@/` -> client/src. Keep in sync with tsconfig.json compilerOptions.paths.
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      {
        name: 'inject-public-url',
        transformIndexHtml: (html) => html.replaceAll('%PUBLIC_URL%', publicUrl),
      },
    ],
    server: {
      port: Number(process.env.DEV_CLIENT_PORT ?? 5173),
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/socket.io': { target: backend, ws: true, changeOrigin: true },
      },
    },
  }
})
