
const CACHE = "pr-expenses-v8";
const CORE  = ["./","./index.html","./styles.v8.css","./app.v8.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];

self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => { clients.claim(); e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) { e.respondWith(fetch(req)); return; }
  const isHTML = req.destination === "document" || (req.headers.get("accept")||"").includes("text/html");
  const isApp  = url.pathname.endsWith("/app.v8.js");
  if (isHTML || isApp) {
    e.respondWith(fetch(req).then(r => (caches.open(CACHE).then(c=>c.put(req,r.clone())), r)).catch(_ => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
