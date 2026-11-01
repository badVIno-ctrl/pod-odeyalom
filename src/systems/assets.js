// Ассеты: assets/manifest.json перечисляет все ключи картинок и звуков.
// asset-list.json (его отдаёт Vite-плагин) говорит, какие файлы реально существуют,
// поэтому отсутствующие файлы даже не запрашиваются: заглушка вместо картинки, тишина вместо звука.
import { createPlaceholder, sliceFrames, PAINTERS } from './placeholders.js';

const IMG_EXT = ['.png', '.webp', '.jpg', '.jpeg'];
// .ogg первым: точные петли без «щелчка» MP3-паддинга; Safari без Vorbis возьмёт .mp3.
const SND_EXT = ['.ogg', '.mp3', '.m4a', '.wav'];

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const stripExt = (f) => f.replace(/\.[a-z0-9]+$/i, '');

export const Assets = {
  manifest: { images: {}, sounds: {} },
  files: new Set(),
  real: new Set(),
  failed: new Set(),

  async init() {
    const [manifest, list] = await Promise.all([fetchJSON('manifest.json'), fetchJSON('asset-list.json')]);
    if (manifest) this.manifest = { images: manifest.images || {}, sounds: manifest.sounds || {} };
    else console.warn('[assets] manifest.json не найден — используются только заглушки');
    this.files = new Set((list && list.files) || []);
  },

  imageKeys() {
    const keys = new Set([...Object.keys(this.manifest.images), ...Object.keys(PAINTERS)]);
    return [...keys];
  },

  resolveImage(key) {
    const entry = this.manifest.images[key];
    const base = stripExt((entry && entry.file) || `img/${key}.png`);
    for (const ext of IMG_EXT) if (this.files.has(base + ext)) return base + ext;
    return null;
  },

  // Все существующие варианты файла звука (Howler сам выберет поддерживаемый формат).
  resolveSound(pathOrKey) {
    const entry = this.manifest.sounds[pathOrKey];
    const base = stripExt((entry && entry.file) || pathOrKey);
    return SND_EXT.map((ext) => base + ext).filter((f) => this.files.has(f));
  },

  soundEntry(key) {
    return this.manifest.sounds[key] || null;
  },

  // Ставит в очередь загрузчика Phaser только существующие картинки.
  queueImages(scene) {
    const keys = new Set(this.imageKeys());
    for (const key of keys) {
      const url = this.resolveImage(key);
      if (url) scene.load.image(key, url);
    }
    // Остальные картинки из assets/img — замены деталей, нарисованных кодом (куклы, паук, реквизит,
    // сцены «глазами мальчика», Огнёвка…): ключ = имя файла. Рисовалка увидит готовую текстуру и пропустит её.
    this.overrides = new Set();
    for (const f of this.files) {
      const m = /^img\/([a-z0-9_]+)\.(png|webp|jpe?g)$/i.exec(f);
      if (!m || keys.has(m[1]) || this.overrides.has(m[1])) continue;
      this.overrides.add(m[1]);
      scene.load.image(m[1], f);
    }
    scene.load.on('loaderror', (file) => {
      this.failed.add(file.key);
      console.warn(`[assets] не удалось загрузить ${file.src} — будет заглушка`);
    });
  },

  // После загрузки: заглушки для всего, чего нет; нарезка спрайтшитов.
  finalize(scene) {
    for (const key of this.imageKeys()) {
      const frames = (this.manifest.images[key] && this.manifest.images[key].frames) || (PAINTERS[key] && PAINTERS[key].frames);
      if (scene.textures.exists(key) && !this.failed.has(key)) {
        this.real.add(key);
        if (frames) sliceFrames(scene.textures.get(key), frames);
      } else {
        if (scene.textures.exists(key)) scene.textures.remove(key);
        if (PAINTERS[key] && PAINTERS[key].lazy) continue; // нарисуем, когда понадобится (ensure)
        createPlaceholder(scene, key);
      }
    }
    for (const key of this.overrides || []) {
      if (scene.textures.exists(key) && !this.failed.has(key)) this.real.add(key);
    }
  },

  // Текстура «по запросу»: настоящая картинка уже загружена при старте, иначе рисуем заглушку сейчас.
  ensure(scene, key) {
    if (!scene.textures.exists(key)) createPlaceholder(scene, key);
    return key;
  },

  isReal(key) {
    return this.real.has(key);
  },
};
