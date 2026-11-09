import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Writes asset-list.json with every built asset, lazy chunks included, so the service
 * worker can keep exactly the current build cached (see public/sw.js).
 */
function assetList(): Plugin {
  return {
    name: 'vault-asset-list',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => fileName.startsWith('assets/'))
        .map((fileName) => `/${fileName}`)
      this.emitFile({ type: 'asset', fileName: 'asset-list.json', source: JSON.stringify(assets) })
    },
  }
}

/** The security headers Vercel sends (vercel.json), so `npm run preview` behaves like production. */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8')) as {
    headers: { headers: { key: string; value: string }[] }[]
  }
  return Object.fromEntries(config.headers.flatMap((rule) => rule.headers).map(({ key, value }) => [key, value]))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), assetList()],
  // Fixed port: it must match the OAuth client's authorized JavaScript origins.
  server: {
    port: 5180,
    strictPort: true,
  },
  // Its own port (4173): the preview registers the service worker, which must not take over the dev server's origin.
  preview: {
    headers: productionHeaders(),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
