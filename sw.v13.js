
const CACHE = "pr-expenses-v13";
const CORE  = ["./","./index.html","./styles.v13.css","./app.v13.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => { clients.claim(); e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x))))); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  const isHTML = e.request.destination === "document" || (e.request.headers.get("accept")||"").includes("text/html");
  const isApp  = u.pathname.endsWith("/app.v13.js");
  if (isHTML || isApp) {
    e.respondWith(fetch(e.request).then(r => (caches.open(CACHE).then(c=>c.put(e.request,r.clone())), r)).catch(_ => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
