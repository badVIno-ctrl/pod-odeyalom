// Офлайн-режим: регистрирует сервис-воркер (dist/sw.js собирается при сборке, см. vite.config.js).
// Только в собранной игре, в защищённом контексте и без ?debug / ?nosw.
// ?nosw — ещё и снимает уже установленный воркер и чистит его кэш (на случай отладки).
// Когда игра дошла до меню, просим воркер докачать звуки — тогда во второй раз можно играть без сети.
const PREFIX = 'pod-odeyalom-';

const canOgg = () => {
  try { const a = document.createElement('audio'); return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"')); } catch { return false; }
};

export const Offline = {
  ready: false,
  warmed: null,

  init(game) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const q = new URLSearchParams(window.location.search);
    if (q.has('nosw')) { this.uninstall(); return; }
    if (!import.meta.env.PROD || !window.isSecureContext || q.has('debug')) return;
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'warmed') { this.warmed = e.data; window.__offline = e.data; }
    });
    const register = () => navigator.serviceWorker.register('./sw.js').then(() => { this.ready = true; }).catch(() => {});
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register, { once: true });
    // докачка — когда загрузка позади и показано меню (не мешаем первому экрану)
    const warm = () => navigator.serviceWorker.ready.then((reg) => { if (reg.active) reg.active.postMessage({ type: 'warm', ext: canOgg() ? 'ogg' : 'mp3' }); }).catch(() => {});
    if (game && game.events) game.events.once('menu-shown', () => setTimeout(warm, 4000));
  },

  async uninstall() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) for (const k of await caches.keys()) if (k.startsWith(PREFIX)) await caches.delete(k);
    } catch { /* нет доступа к хранилищу — не страшно */ }
  },
};
