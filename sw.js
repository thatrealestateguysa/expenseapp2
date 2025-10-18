
// SW v6: network-first for HTML and app.js; cache-first for others
const CACHE_NAME="pr-expenses-v6";
const CORE=["./","./index.html","./styles.v6.css","./app.v6.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];

self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)))});
self.addEventListener("activate",e=>{clients.claim();e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))))});

self.addEventListener("fetch",e=>{
  const req=e.request;
  const url=new URL(req.url);
  const isOurOrigin=url.origin===self.location.origin;
  const isHTML = req.destination==="document" || (req.headers.get("accept")||"").includes("text/html");
  const isAppJS = url.pathname.endsWith("app.v6.js");
  if(req.method!=="GET" || !isOurOrigin){ e.respondWith(fetch(req)); return; }
  if(isHTML || isAppJS){
    e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));return r;})
      .catch(_=>caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(r=>r||fetch(req)));
});
