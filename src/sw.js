// self.addEventListener('install', ev => {
//   async function onWaitUntil() {
//     const cache = await caches.open('v1');
//     cache.addAll([
//       '/',
//       '/index.js'
//     ])
//   }
//   ev.waitUntil(onWaitUntil())
// });
const CACHE_NAME = 'v1';

self.addEventListener('fetch', async ev => {
  async function onRespond() {
    try {
      const resp = await fetch(ev.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(ev.request, resp.clone()).catch(() => { });
      return resp;
    } catch {
      return caches.match(ev.request);
    }
  }
  ev.respondWith(onRespond());
});
