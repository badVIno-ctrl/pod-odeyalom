// Языки интерфейса и субтитров: русский (основной) и английский. Озвучка остаётся русской,
// английские — субтитры и все надписи. Переводится на лету: Phaser.Text.setText пропускает строку
// через tr() — точное совпадение по словарю (en.js), затем шаблоны с числами. Непереведённое — как есть.
// Язык: ?lang=en или переключатель в меню (выбор сохраняется); по умолчанию — русский.
import { EN_EXACT, EN_PATTERNS } from './en.js';
import { EN_LINES } from './lines.en.js';

const KEY = 'pod-odeyalom:lang';

function detect() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'ru') return q;
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'ru') return saved;
    return 'ru'; // игра озвучена по-русски; английский — кнопкой в меню или ?lang=en
  } catch { return 'ru'; }
}

export const I18n = {
  lang: typeof window !== 'undefined' ? detect() : 'ru',
  set(l) {
    this.lang = l === 'en' ? 'en' : 'ru';
    try { localStorage.setItem(KEY, this.lang); document.documentElement.lang = this.lang; } catch { /* */ }
  },
  get en() { return this.lang === 'en'; },
};

const CYR = /[А-Яа-яЁё]/;

// Текст реплики на текущем языке (субтитры, варианты ответа). Озвучка — всегда русская.
export function lineText(line) {
  if (!line) return '';
  return I18n.lang === 'en' ? (EN_LINES[line.id] || line.text) : line.text;
}

// Выбор строки по языку прямо в коде: L('Привет', 'Hello').
export function L(ru, en) { return I18n.lang === 'en' ? en : ru; }

export function tr(s) {
  if (I18n.lang !== 'en' || typeof s !== 'string' || !CYR.test(s)) return s;
  const hit = EN_EXACT[s];
  if (hit !== undefined) return hit;
  // многострочный текст: переводим построчно
  if (s.includes('\n')) {
    const parts = s.split('\n');
    if (parts.length > 1) return parts.map((p) => tr(p)).join('\n');
  }
  for (const [re, fn] of EN_PATTERNS) {
    const m = s.match(re);
    if (m) return typeof fn === 'function' ? fn(...m.slice(1)) : fn;
  }
  return s;
}

// Подключить перевод ко всем текстам Phaser (вызывается один раз до создания игры).
export function installTextHook(Phaser) {
  const proto = Phaser.GameObjects.Text.prototype;
  if (proto.__trHooked) return;
  const orig = proto.setText;
  proto.setText = function setText(value) {
    if (I18n.lang === 'en' && !this.noTranslate) {
      if (typeof value === 'string') value = tr(value);
      else if (Array.isArray(value)) value = value.map((v) => tr(String(v)));
    }
    return orig.call(this, value);
  };
  proto.__trHooked = true;
}
