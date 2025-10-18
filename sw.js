const CACHE_NAME="pr-expenses-v5";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>{clients.claim();e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))))});
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET" || new URL(req.url).origin!==self.location.origin){
    e.respondWith(fetch(req));
    return;
  }
  e.respondWith(caches.match(req).then(r=>r||fetch(req)));
});