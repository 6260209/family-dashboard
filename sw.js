/* 家庭资产配置仪表盘 Service Worker：缓存静态资源，离线可看内置快照 */
const CACHE = 'pf-cache-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;
  if (req.method !== 'GET') return;                 // 非 GET（写操作）直接走网络
  const url = new URL(req.url);
  if (url.pathname.indexOf('/api/') === 0) return;  // 不缓存 API，避免离线返回陈旧聚合数据

  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit;
      return fetch(req).then(function(res){
        if (res && res.ok && url.origin === self.location.origin){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        // 离线兜底：返回已缓存的页面（页面内有内置 data-store 快照，可照常渲染）
        return caches.match('/index.html');
      });
    })
  );
});
