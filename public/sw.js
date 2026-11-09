/*
 * Vault service worker: keeps the app shell available offline.
 *
 * - Pages (navigations): network first, so a deploy shows up on the next open;
 *   falls back to the cached index.html when offline.
 * - Built assets (/assets/*, hashed names) and icons: cache first, they never change.
 *   After each online page load, the cache is synced with the build's asset-list.json:
 *   old bundles are dropped and every current one is fetched, lazy chunks included
 *   (like the book reader), so screens never opened online still work offline.
 * - Anything cross-origin (Google sign-in, Drive API) is never touched: data always
 *   comes fresh from Drive.
 */
const CACHE = 'vault-shell'
const SHELL = ['/', '/theme.js', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/** Makes the cached assets match the current build: drops old ones, fetches missing ones. */
async function syncAssets() {
  const res = await fetch('/asset-list.json', { cache: 'no-store' })
  if (!res.ok) return
  const assets = new Set(await res.json())
  const cache = await caches.open(CACHE)
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/assets/') && !assets.has(path)) await cache.delete(request)
  }
  for (const path of assets) {
    // One failed file only means it is fetched when first used, as before.
    if (!(await cache.match(path))) await cache.add(path).catch(() => {})
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put('/', response.clone())
      syncAssets().catch(() => {})
    }
    return response
  } catch {
    // Offline: every route is the same single-page app.
    return (await caches.match('/')) ?? Response.error()
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
  } else if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(handleAsset(request))
  }
})
