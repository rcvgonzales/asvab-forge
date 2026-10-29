// App-shell cache: makes the PWA genuinely work offline.
// API calls are never cached; drills run offline from the localStorage question bank.
const CACHE = 'asvab-forge-v3'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // never touch generation calls or anything that isn't a plain GET
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return

  // navigations: serve the cached shell instantly (cache-first), refresh it in the
  // background so the next launch picks up a new deploy
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/').then((hit) => {
        const net = fetch(e.request).then((res) => put('/', res)).catch(() => hit)
        return hit || net
      })
    )
    return
  }

  // hashed assets, fonts, icons: cache-first
  e.respondWith(
    caches.match(e.request).then(
      (hit) => hit || fetch(e.request).then((res) => put(e.request, res)).catch(() => caches.match('/'))
    )
  )
})
