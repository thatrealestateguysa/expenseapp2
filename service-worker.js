const CACHE='prfa-brand-v2';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./manifest.json',
  './icons/icon-16.png','./icons/icon-32.png','./icons/icon-180.png',
  './icons/icon-192.png','./icons/icon-256.png','./icons/icon-384.png','./icons/icon-512.png',
  './icons/maskable-192.png','./icons/maskable-512.png','./assets/logo-banner.png'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
