/* CoachTomAsh Studio 1.5: versioned offline application shell.
   User practices remain in localStorage/IndexedDB, never in Cache Storage. */
const CACHE_NAME = 'coachtomash-studio-assets-v1-8-3-audio-alerts';
const APP_FILES = [
 './', './index.html', './app.css', './coach-tomash-logo.png',
 './storage-engine.js', './app-core.js', './pwa-install.js',
 './v11-enhancements.js?v=1711', './starter-sessions.js', './v14-enhancements.js',
 './pro-editor.js?v=164', './animation-pro.js?v=170', './uefa-a-up-back-through.js?v=171', './multi-select.js', './storage-ui.js', './manifest.webmanifest',
 './live-timer-audio.js?v=183', './live-coaching.js?v=183', './live-coaching.css?v=183',
 './icons/icon-192.png','./icons/icon-512.png',
 './icons/icon-maskable-512.png','./icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)));
 self.skipWaiting();
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys
  .filter(k=>k.startsWith('coachtomash-studio-assets-')&&k!==CACHE_NAME)
  .map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
 if(event.request.mode==='navigate'){
   event.respondWith(fetch(event.request).then(response=>{
     if(response.ok){const cloned=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',cloned)));}
     return response;
   }).catch(()=>caches.match('./index.html')));
   return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
  if(response.ok){const cloned=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,cloned)));}
  return response;
 })));
});
