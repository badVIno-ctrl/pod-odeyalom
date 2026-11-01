import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Папка assets/ — публичная: её содержимое копируется в dist как есть.
// Плагин asset-list сообщает игре, какие файлы реально лежат в assets/img и assets/audio.
// Поэтому игра не запрашивает несуществующие картинки и звуки (нет 404 и ошибок в консоли),
// а новая картинка подхватывается простым обновлением страницы.
const PUBLIC_DIR = 'assets';
const SCAN_DIRS = ['img', 'audio'];
const MEDIA = /\.(png|webp|jpe?g|mp3|ogg|wav|m4a)$/i;

function scanAssets(root) {
  const base = path.resolve(root, PUBLIC_DIR);
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (MEDIA.test(entry.name)) out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  };
  for (const d of SCAN_DIRS) walk(path.join(base, d));
  return out.sort();
}

function assetListPlugin() {
  let root = process.cwd();
  return {
    name: 'asset-list',
    configResolved(cfg) { root = cfg.root; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url.endsWith('/asset-list.json')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ files: scanAssets(root) }));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'asset-list.json',
        source: JSON.stringify({ files: scanAssets(root) }, null, 1),
      });
    },
  };
}

// Офлайн: после сборки пишет dist/sw.js из sw-template.js. Версия кэша — хэш всех файлов сборки,
// так что любое изменение (код, звук, картинка) даёт новый кэш, а старый удаляется при активации.
function offlinePlugin() {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'offline-sw',
    apply: 'build',
    configResolved(cfg) { root = cfg.root; outDir = path.resolve(cfg.root, cfg.build.outDir); },
    closeBundle() {
      const files = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(path.relative(outDir, full).split(path.sep).join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.endsWith('.zip')).sort();
      const hash = crypto.createHash('sha1');
      for (const f of list) { hash.update(f); hash.update(fs.readFileSync(path.join(outDir, f))); }
      const version = hash.digest('hex').slice(0, 12);
      const core = list.filter((f) => !f.startsWith('audio/'));
      const audio = list.filter((f) => f.startsWith('audio/'));
      const src = fs.readFileSync(path.resolve(root, 'sw-template.js'), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__CORE__', JSON.stringify(core))
        .replace('__AUDIO__', JSON.stringify(audio));
      fs.writeFileSync(path.join(outDir, 'sw.js'), src);
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: PUBLIC_DIR,
  plugins: [assetListPlugin(), offlinePlugin()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    outDir: 'dist',
    assetsDir: 'bundle',
    chunkSizeWarningLimit: 2500,
  },
});
