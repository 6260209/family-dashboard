/* 家庭资产配置仪表盘 Service Worker
 * v4 变更：HTML 文档改为「强制回源 + 不缓存」——给请求追加 _sw 版本号，
 *          使任意 CDN 边缘节点都视为缓存未命中而回源，杜绝旧版本 HTML 长时间滞留。
 * v2 变更：HTML 文档改为「网络优先」，确保每次打开都拿到最新页面；
 *          静态资源仍「缓存优先 + 后台更新」，兼顾离线可用与更新及时。
 */
const SW_VER = '4';
const CACHE = 'pf-cache-v4';
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

  // HTML：强制回源 + 不缓存。追加 _sw 版本号使 CDN 边缘必定回源，
  // 从源头拿到最新 index.html，避免旧边缘缓存导致的“修好了却还报错”。
  if (isHtml){
    const u = new URL(req.url);
    u.searchParams.set('_sw', SW_VER);
    e.respondWith(
      fetch(u.toString(), {cache:'no-store'}).then(function(res){ return res; })
      .catch(function(){
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
