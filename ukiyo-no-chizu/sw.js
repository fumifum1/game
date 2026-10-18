// オフラインでも遊べるようにするサービスワーカー
// アプリ本体はバージョンごとのキャッシュ、外部の絵・国旗・フォントは一度見たら保存して使い回す
importScripts('js/version.js');
const CACHE = `ukiyo-no-chizu-v${self.APP_VERSION}`;
const RUNTIME = 'ukiyo-no-chizu-runtime';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/gacha.css', 'css/screens.css',
  'js/version.js', 'js/prefectures.js', 'js/arts.js', 'js/generator.js', 'js/world-arts.js',
  'js/maps/index.js', 'js/maps/countries.js', 'js/maps/globe.js', 'js/globe.js', 'js/country-facts.js', 'js/app.js',
  'js/maps/asia.js', 'js/maps/europe.js', 'js/maps/africa.js', 'js/maps/northamerica.js', 'js/maps/southamerica.js', 'js/maps/oceania.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ukiyo-no-chizu-v') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // アプリ本体: キャッシュ優先(ページを開くときは index.html を返す)
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit
      || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }
  // 外部(名画・国旗・フォント): 一度見たものは保存して、次からはオフラインでも出す
  e.respondWith(caches.open(RUNTIME).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  }))));
});
