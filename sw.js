/* 家庭资产配置仪表盘 Service Worker
 * v2 变更：HTML 文档改为「网络优先」，确保每次打开都拿到最新页面；
 *          静态资源仍「缓存优先 + 后台更新」，兼顾离线可用与更新及时。
 */
const CACHE = 'pf-cache-v3';
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
  if (req.method !== 'GET') return;                       // 非 GET 直接走网络
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // 跨域(如 CDN echarts)走网络
  if (url.pathname.indexOf('/api/') === 0) return;        // 不缓存 API

  const isHtml = req.mode === 'navigate'
    || url.pathname.endsWith('/index.html')
    || url.pathname === '/';

  // HTML：网络优先，离线才回退缓存（保证功能更新立即可见）
  if (isHtml){
    e.respondWith(
      fetch(req).then(function(res){
        const copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(h){ return h || caches.match('/index.html'); });
      })
    );
    return;
  }

  // 其余静态资源：缓存优先 + 后台静默更新
  e.respondWith(
    caches.match(req).then(function(hit){
      const net = fetch(req).then(function(res){
        if (res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
