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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), assetList()],
  // Fixed port: it must match the OAuth client's authorized JavaScript origins.
  server: {
    port: 5180,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
