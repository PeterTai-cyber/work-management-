/* 工作管理助手 — Service Worker
   只負責讓 app 外殼離線可開啟。資料一律在 IndexedDB,這裡不碰。
   改版時把 CACHE 的版本號往上加,舊快取會在 activate 時清掉。 */
const CACHE = 'workmate-shell-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 單一檔案抓不到不該讓整包安裝失敗,外殼少一個圖示還是能開
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // 後端 API 不快取

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // ignoreSearch:帶 ?demo 之類的參數也要吃到同一份外殼
    const hit = await c.match(req, { ignoreSearch: true });

    if (hit) {
      // 先給快取(離線也秒開),背景默默更新下一次要用的版本
      fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()) }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const fb = await c.match('./index.html', { ignoreSearch: true });
        if (fb) return fb;
      }
      return new Response('離線中,且此資源未快取。', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
