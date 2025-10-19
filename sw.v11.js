
// Service worker v11 (static offline). Never intercept cross-origin (Apps Script).
const CACHE = "pr-expenses-v11";
const CORE  = ["./","./index.html","./styles.v11.css","./app.v11.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => { clients.claim(); e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin
  const isHTML = e.request.destination === "document" || (e.request.headers.get("accept")||"").includes("text/html");
  const isApp  = url.pathname.endsWith("/app.v11.js");
  if (isHTML || isApp) {
    e.respondWith(fetch(e.request).then(r => (caches.open(CACHE).then(c=>c.put(e.request,r.clone())), r)).catch(_ => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
