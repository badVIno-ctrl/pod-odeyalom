// Офлайн-режим «Под одеялом». Этот файл — шаблон: при сборке (vite.config.js → offlinePlugin)
// в него подставляются версия и списки файлов, результат кладётся в dist/sw.js.
// Версия — хэш всех файлов сборки: новая сборка → новый кэш, старый удаляется.
const VERSION = '__VERSION__';
const PREFIX = 'pod-odeyalom-';
const CACHE = PREFIX + VERSION;
// Код, шрифты, иконки и списки — сразу при установке (это ~3 МБ).
const CORE = __CORE__;
// Музыка, звуки и голоса — докачиваются в фоне, когда игра уже открыта (по сигналу 'warm').
const AUDIO = __AUDIO__;
// Эти файлы меняются от сборки к сборке под тем же именем — сначала сеть, без сети — кэш.
const FRESH = /(?:^|\/)(?:index\.html|asset-list\.json|manifest\.json|manifest\.webmanifest)$/;
const NET_TIMEOUT = 4000;

const scoped = (f) => new URL(f, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([scoped('./'), ...CORE.map(scoped)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Фоновая докачка звуков: по три файла за раз; при «экономии трафика» не качаем.
let warming = null;
// ext — формат, который выбрал браузер ('ogg' или 'mp3'): второй вариант того же звука не качаем.
function pickFormat(files, ext) {
  const set = new Set(files);
  const other = ext === 'ogg' ? 'mp3' : 'ogg';
  return files.filter((f) => !(f.endsWith('.' + other) && set.has(f.slice(0, -other.length) + ext)));
}

async function warm(ext) {
  const list = pickFormat(AUDIO, ext === 'mp3' ? 'mp3' : 'ogg');
  const conn = self.navigator && self.navigator.connection;
  if (conn && conn.saveData) return { done: 0, total: list.length, skipped: 'saveData' };
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const todo = list.map(scoped).filter((u) => !have.has(u));
  let i = 0; let done = list.length - todo.length;
  const worker = async () => {
    while (i < todo.length) {
      const url = todo[i++];
      try { const res = await fetch(url); if (res.ok) { await cache.put(url, res); done++; } } catch (e) { /* сеть пропала — докачаем в другой раз */ }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { done, total: list.length };
}

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'warm') return;
  if (!warming) warming = warm(event.data.ext).finally(() => { warming = null; });
  event.waitUntil(warming.then(async (r) => {
    const all = await self.clients.matchAll({ includeUncontrolled: true });
    all.forEach((c) => c.postMessage({ type: 'warmed', version: VERSION, ...r }));
  }));
});

async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(key, res.clone());
    return res;
  });
  const cached = () => cache.match(key, { ignoreSearch: true });
  // медленная сеть («лай-фай»): через NET_TIMEOUT отдаём кэш, если он есть
  const timeout = new Promise((res) => setTimeout(res, NET_TIMEOUT)).then(cached);
  try {
    const first = await Promise.race([net, timeout]);
    if (first) return first;
    return await net;
  } catch (err) {
    const hit = await cached();
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return; // потоковое аудио — мимо кэша
  if (req.mode === 'navigate') {
    // страница игры (с любыми ?lang=… и т. п.) — один ключ без параметров
    event.respondWith(networkFirst(req, url.origin + url.pathname));
    return;
  }
  if (FRESH.test(url.pathname)) { event.respondWith(networkFirst(req, url.origin + url.pathname)); return; }
  event.respondWith(cacheFirst(req));
});
