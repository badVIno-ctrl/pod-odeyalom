// День 3 — «Паутинка» (виселица). Ночь, окно в морозных узорах, тихо играет музыкальная шкатулка.
// Паук загадал слово; за каждую ошибку он вплетает в паутину новую ниточку вокруг бумажной мушки.
// Ошибок можно сделать: лёгкий — 8, средний — 7, сложный — 6. Повторная буква не стоит ошибки, Е = Ё.
// «Вторая зима» (variant.proverbs): паук загадывает пословицу в две строки, ниточек больше (10/9/8),
// пробелы и знаки препинания видны сразу.
import * as Phaser from 'phaser';
import { CSS, FONT, INK, INKN, EASE, text } from '../../config/theme.js';
import { paperTexture, inkCircle, inkCross } from '../../ui/paper.js';
import { MiniGameBase, sleep } from './MiniGameBase.js';
import { alphabetFor, pickWord, pickProverb, wrapPhrase, isLetter, letterCount, createHangman, guess, status, revealed, hintLetter, letterFromKey, norm } from '../../ai/hangman.js';
import { I18n } from '../../i18n/index.js';
import { Audio } from '../../systems/audio.js';
import { count } from '../../systems/plural.js';
import { GameState } from '../../state.js';
import { makeCanvas, rng as seeded } from '../../systems/paint.js';
import { Quality } from '../../systems/quality.js';

const WEB = { x: 360, y: 470, r: 250 };
const KEY = { w: 128, h: 96, gap: 12, top: 742 };
const INFO_X = 1130; // «Ниточек осталось» и клубочки (левее центра листа, чтобы справа поместилась плашка смелости)

export class HangmanScene extends MiniGameBase {
  constructor() { super('Hangman'); }

  init(data) {
    super.init(data);
    this.phrase = !!(data.variant && data.variant.proverbs);
    this.word = data.word || (this.phrase
      ? pickProverb(this.difficulty, Math.random, [], I18n.lang)
      : pickWord(this.difficulty, Math.random, [], I18n.lang));
    this.st = createHangman(this.word, this.difficulty, { phrase: this.phrase });
    this.keys = new Map();
  }

  create() {
    this.makeTextures();
    this.setupFrame({
      title: this.phrase ? 'Паутинка: пословицы' : 'Паутинка',
      rules: [
        this.phrase
          ? 'Паук загадал пословицу. Угадывай её по одной букве: нажимай буквы на экране или на клавиатуре.'
          : 'Паук загадал слово. Угадывай его по одной букве: нажимай буквы на экране или на клавиатуре.',
        this.phrase
          ? 'Если буква есть в пословице, она откроется везде, где встречается. Пробелы, запятые и тире видны сразу.'
          : 'Если буква есть в слове, она откроется везде, где встречается.',
        `Если буквы нет, паук вплетает ниточку. Можно ошибиться ${count(this.st.max, 'раз', 'раза', 'раз')}, на последней ниточке мушка попадётся.`,
        'Буква, которую ты уже называл, ошибкой не считается. Е и Ё считаются одной буквой.',
        `Мамина подсказка открывает букву, которая встречается в ${this.phrase ? 'пословице' : 'слове'} чаще всего.`,
      ],
      ambient: [{ key: 'clock', volume: 0.12 }],
      music: 'mus_tikhon', // загадки Тихона — под его тему
      spider: { x: WEB.x + 40, y: 150, scale: 0.42 },
      // одно слово — плашка на листке под словом; пословица в две строки — справа от заголовка, над листком
      subtitles: this.phrase ? { x: 1580, bottom: 188, width: 600 } : { x: 1270, bottom: 488, width: 1080 },
      hint: { label: 'Мамина\nподсказка', key: false },
    });
    // Плашка смелости справа от счётчика ниточек: раньше она наезжала на последний клубочек и на клавиши Й и К.
    this.courageBox.setPosition(1478, 652);
    this.makeWorld();
    this.makeWord();
    this.makeKeyboard();
    this.web = this.add.graphics();
    this.fly = this.makeFly();
    this.root.add([this.web, this.fly]);
    this.drawWeb(0);
    this.updateInfo();
    this.setScore(0, 0, this.phrase ? 'Угадай пословицу паука' : 'Угадай слово паука');
    this.setStatus(this.phrase
      ? `Пословица: ${count(letterCount(this.word), 'буква', 'буквы', 'букв')} · нажимай буквы`
      : `${count(this.word.length, 'буква', 'буквы', 'букв')} · нажимай буквы`, 'boy');
    this.input.keyboard.on('keydown', (e) => {
      if (e.repeat) return;
      const ch = letterFromKey(e, I18n.lang);
      if (ch) this.press(ch);
    });
    this.events.on('update', this.animate, this);
    this.events.once('shutdown', () => this.events.off('update', this.animate, this));
    this.time.delayedCall(700, () => { this.busy = false; });
  }

  makeTextures() {
    if (this.textures.exists('hm_bg')) return;
    const c = makeCanvas(1920, 1080); const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, '#0a1020'); g.addColorStop(1, '#141c33');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    // большое окно за паутиной
    const wx = 70; const wy = 150; const ww = 600; const wh = 660;
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#1b2b52'); sky.addColorStop(1, '#2e4778');
    ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
    const r = seeded(33);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; ctx.fillRect(wx + r() * ww, wy + r() * wh * 0.6, 2, 2); }
    ctx.fillStyle = '#dfe8f5';
    ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.quadraticCurveTo(wx + 200, wy + wh - 120, wx + 380, wy + wh - 60); ctx.quadraticCurveTo(wx + 500, wy + wh - 30, wx + ww, wy + wh - 90); ctx.lineTo(wx + ww, wy + wh); ctx.fill();
    // морозные узоры по углам
    ctx.strokeStyle = 'rgba(220,235,255,0.45)'; ctx.lineWidth = 2;
    const frost = (x, y, dir, n) => {
      for (let k = 0; k < n; k++) {
        const a = dir + (r() - 0.5) * 1.4; const len = 60 + r() * 140;
        let px = x; let py = y;
        ctx.beginPath(); ctx.moveTo(px, py);
        for (let s = 0; s < 6; s++) {
          px += Math.cos(a + (r() - 0.5) * 0.6) * len / 6; py += Math.sin(a + (r() - 0.5) * 0.6) * len / 6; ctx.lineTo(px, py);
          if (r() < 0.6) { ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + 0.9) * 14, py + Math.sin(a + 0.9) * 14); ctx.moveTo(px, py); }
        }
        ctx.stroke();
      }
    };
    frost(wx, wy, Math.PI / 4, 26); frost(wx + ww, wy, Math.PI * 0.75, 26); frost(wx, wy + wh, -Math.PI / 4, 20); frost(wx + ww, wy + wh, -Math.PI * 0.75, 20);
    // рама
    ctx.strokeStyle = '#5a3d27'; ctx.lineWidth = 26; ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh * 0.42); ctx.lineTo(wx + ww, wy + wh * 0.42); ctx.stroke();
    ctx.fillStyle = '#6e4b31'; ctx.fillRect(wx - 40, wy + wh + 6, ww + 80, 30);
    // ночник справа
    const n = ctx.createRadialGradient(1700, 980, 10, 1700, 980, 700);
    n.addColorStop(0, 'rgba(255,190,110,0.28)'); n.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = n; ctx.fillRect(0, 0, 1920, 1080);
    this.textures.addImage('hm_bg', c);

    // тетрадный лист для слова
    const p = makeCanvas(1180, 330); const pc = p.getContext('2d');
    pc.fillStyle = '#f7f3ea'; pc.beginPath(); pc.roundRect(0, 0, 1180, 330, 14); pc.fill();
    pc.strokeStyle = 'rgba(80,130,200,0.22)'; pc.lineWidth = 1.5;
    for (let x = 0; x < 1180; x += 36) { pc.beginPath(); pc.moveTo(x, 0); pc.lineTo(x, 330); pc.stroke(); }
    for (let y = 0; y < 330; y += 36) { pc.beginPath(); pc.moveTo(0, y); pc.lineTo(1180, y); pc.stroke(); }
    pc.strokeStyle = 'rgba(200,64,46,0.5)'; pc.lineWidth = 3; pc.beginPath(); pc.moveTo(70, 0); pc.lineTo(70, 330); pc.stroke();
    pc.fillStyle = 'rgba(240,226,180,0.75)';
    pc.save(); pc.translate(590, 6); pc.rotate(0.03); pc.fillRect(-70, -16, 140, 32); pc.restore();
    this.textures.addImage('hm_paper', p);
  }

  makeWorld() {
    this.world.add(this.add.image(960, 540, 'hm_bg'));
    // снег за окном
    const n = Math.round(60 * Quality.particles) || 10;
    this.snow = this.add.particles(0, 0, 'fx_snow', {
      x: { min: 80, max: 660 }, y: 150, lifespan: 7000, speedY: { min: 30, max: 70 }, speedX: { min: -12, max: 12 },
      scale: { min: 0.2, max: 0.6 }, alpha: 0.8, frequency: Math.round(7000 / n), quantity: 1,
    });
    this.world.add(this.snow);
  }

  makeWord() {
    const cx = 1270; const y = 330;
    this.root.add(this.add.image(cx, y, 'hm_paper').setAngle(-0.6));
    // слово — одна строка; пословица — до двух строк (перенос по пробелу)
    const lines = this.phrase ? wrapPhrase(this.word) : [this.word];
    const maxLen = Math.max(...lines.map((l) => l.length));
    const slot = Math.min(this.phrase ? 66 : 100, Math.floor(1040 / maxLen));
    const ys = lines.length === 1 ? [y] : [y - 66, y + 62];
    const ul = this.phrase ? Math.round(slot * 0.62) : 52;
    this.slots = [];
    let ptr = 0;
    lines.forEach((ln, li) => {
      const start = this.word.indexOf(ln, ptr); ptr = start + ln.length;
      const ly = ys[li];
      [...ln].forEach((ch, j) => {
        const x = cx - (slot * ln.length) / 2 + slot * j + slot / 2;
        const letter = isLetter(ch);
        const t = this.add.text(x, ly + 6, letter ? '' : ch, { fontFamily: FONT.hand, fontSize: `${Math.round(slot * 1.05)}px`, fontStyle: '700', color: '#2a4a8a' }).setOrigin(0.5).setResolution(2);
        if (letter) {
          const line = this.add.graphics();
          line.lineStyle(this.phrase ? 4 : 5, 0x2a4a8a, 0.8).lineBetween(x - slot * 0.36, ly + ul, x + slot * 0.36, ly + ul);
          this.root.add(line);
        }
        this.root.add(t);
        this.slots.push({ t, x, ch, i: start + j, letter });
      });
    });
    this.info = this.add.text(INFO_X, 540, '', text('heading-4', { align: 'center' })).setOrigin(0.5).setResolution(2);
    this.threads = this.add.graphics();
    this.root.add([this.info, this.threads]);
  }

  // Клавиши — картонные карточки с буквами (как детская азбука). Угаданная буква обведена зелёным
  // карандашом, неверная зачёркнута красным.
  makeKeyboard() {
    const AB = alphabetFor(I18n.lang);
    // 33 русские буквы — три ряда по 11; 26 английских — 9, 9 и 8 (по алфавиту, как детская азбука)
    const rows = AB.length > 26 ? [AB.slice(0, 11), AB.slice(11, 22), AB.slice(22)] : [AB.slice(0, 9), AB.slice(9, 18), AB.slice(18)];
    let n = 0;
    rows.forEach((row, ri) => {
      const total = row.length * KEY.w + (row.length - 1) * KEY.gap;
      row.forEach((ch, i) => {
        const x = 960 - total / 2 + i * (KEY.w + KEY.gap) + KEY.w / 2;
        const y = KEY.top + ri * (KEY.h + KEY.gap);
        const seed = (n++ % 4) + 1;
        const c = this.add.container(x, y);
        const card = this.add.container(0, 0);
        const img = this.add.image(0, 0, paperTexture(this, KEY.w, KEY.h, { kind: 'cream', seed, edge: 'soft', radius: 12 }));
        const g = this.add.graphics();
        const t = this.add.text(0, 2, ch, text('heading-2', { color: INK.ink })).setOrigin(0.5).setResolution(2);
        const z = this.add.zone(0, 0, KEY.w, KEY.h).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { if (!this.reduced) this.tweens.add({ targets: c, scale: { from: 0.96, to: 1 }, duration: 220, ease: EASE }); this.press(ch); });
        z.on('pointerover', () => { if (!this.keys.get(ch).state) this.drawKey(ch, 'hover'); });
        z.on('pointerout', () => { if (!this.keys.get(ch).state) this.drawKey(ch, null); });
        card.add([img, g, t]);
        c.add([card, z]);
        this.root.add(c);
        this.keys.set(ch, { c, card, img, g, t, seed, state: null });
        this.drawKey(ch, null, this.keys.get(ch));
      });
    });
  }

  drawKey(ch, state, k = this.keys.get(ch)) {
    const g = k.g; g.clear();
    const kind = state === 'hover' ? 'light' : 'cream';
    k.img.setTexture(paperTexture(this, KEY.w, KEY.h, { kind, seed: k.seed, edge: 'soft', radius: 12 }));
    if (!this.reduced) {
      this.tweens.killTweensOf(k.card);
      this.tweens.add({ targets: k.card, y: state === 'hover' ? -4 : 0, duration: 160, ease: EASE });
    }
    if (state === 'hit') inkCircle(g, 0, 2, 34, { squash: 0.9, color: INKN.green, width: 3, seed: k.seed + 3 });
    if (state === 'miss') inkCross(g, 0, 2, 44, { color: INKN.red, width: 3.4, seed: k.seed + 5 });
    k.t.setColor(state === 'hit' ? INK.green : INK.ink).setAlpha(state === 'miss' ? 0.35 : 1);
    k.img.setAlpha(state === 'miss' ? 0.72 : 1);
    if (state === 'hit' || state === 'miss') k.state = state;
  }

  makeFly() {
    // бумажная мушка: тельце, крылышки, глазки
    const c = this.add.container(WEB.x, WEB.y + 10);
    const g = this.add.graphics();
    g.fillStyle(0xdfe8f5, 0.75).fillEllipse(-26, -22, 46, 30).fillEllipse(26, -22, 46, 30);
    g.lineStyle(3, 0x24170f, 1).strokeEllipse(-26, -22, 46, 30).strokeEllipse(26, -22, 46, 30);
    g.fillStyle(0x3b4252, 1).fillEllipse(0, 0, 34, 50).lineStyle(4, 0x24170f, 1).strokeEllipse(0, 0, 34, 50);
    g.fillStyle(0xffffff, 1).fillCircle(-8, -18, 7).fillCircle(8, -18, 7);
    g.fillStyle(0x24170f, 1).fillCircle(-7, -17, 3.5).fillCircle(9, -17, 3.5);
    g.lineStyle(2, 0x9aa6b8, 0.8).lineBetween(-12, 6, 12, 6).lineBetween(-12, 14, 12, 14);
    this.cocoon = this.add.graphics().setAlpha(0);
    this.cocoon.fillStyle(0xe8eef6, 0.92).fillEllipse(0, 0, 70, 96);
    this.cocoon.lineStyle(2, 0xb9c4d4, 1);
    for (let k = -40; k < 44; k += 9) this.cocoon.lineBetween(-34, k, 34, k + 10);
    c.add([g, this.cocoon]);
    return c;
  }

  // Паутина: 8 лучей + 6 витков; стадия k из max ошибок рисует пропорциональную часть.
  drawWeb(stage) {
    const g = this.web; g.clear();
    const parts = 14;
    const show = Math.round((parts * stage) / this.st.max);
    const spokes = 8;
    const r = seeded(77);
    const angles = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2 + (r() - 0.5) * 0.25);
    g.lineStyle(3, 0xe6ecf5, 0.85);
    for (let i = 0; i < Math.min(show, spokes); i++) {
      const a = angles[i];
      g.lineBetween(WEB.x, WEB.y, WEB.x + Math.cos(a) * WEB.r, WEB.y + Math.sin(a) * WEB.r * 0.95);
    }
    const rings = Math.max(0, show - spokes);
    for (let k = 0; k < rings; k++) {
      const rr = WEB.r * (0.28 + k * 0.13);
      g.lineStyle(2.5, 0xe6ecf5, 0.75);
      g.beginPath();
      angles.forEach((a, i) => {
        const sag = 0.94;
        const x = WEB.x + Math.cos(a) * rr; const y = WEB.y + Math.sin(a) * rr * 0.95;
        if (i === 0) g.moveTo(x, y); else {
          const pa = angles[i - 1]; const mx = WEB.x + Math.cos((a + pa) / 2) * rr * sag; const my = WEB.y + Math.sin((a + pa) / 2) * rr * sag * 0.95;
          g.lineTo(mx, my); g.lineTo(x, y);
        }
      });
      const a0 = angles[0]; const al = angles[spokes - 1];
      g.lineTo(WEB.x + Math.cos((a0 + al + Math.PI * 2) / 2) * rr * 0.94, WEB.y + Math.sin((a0 + al + Math.PI * 2) / 2) * rr * 0.9);
      g.lineTo(WEB.x + Math.cos(a0) * rr, WEB.y + Math.sin(a0) * rr * 0.95);
      g.strokePath();
    }
    // ниточки к мушке
    if (stage > 0) {
      g.lineStyle(2, 0xffffff, 0.6);
      for (let i = 0; i < Math.min(stage, 6); i++) { const a = angles[i]; g.lineBetween(this.fly ? this.fly.x : WEB.x, WEB.y + 10, WEB.x + Math.cos(a) * 70, WEB.y + Math.sin(a) * 70); }
    }
  }

  updateInfo() {
    const left = this.st.max - this.st.misses;
    this.info.setText(`Ниточек осталось: ${left} из ${this.st.max}`);
    this.info.setColor(left <= 1 ? '#E0574F' : left <= 3 ? '#F2A65A' : CSS.paper);
    // индикатор-клубочки
    const g = this.threads; g.clear();
    const w = this.st.max * 46; const x0 = INFO_X - w / 2 + 23;
    for (let i = 0; i < this.st.max; i++) {
      const used = i < this.st.misses;
      g.fillStyle(used ? 0x5a2a2a : 0xe6ecf5, used ? 0.6 : 0.95).fillCircle(x0 + i * 46, 596, 15);
      if (!used) g.lineStyle(2, 0x8c97a8, 0.8).strokeCircle(x0 + i * 46, 596, 9);
    }
  }

  animate(time) {
    const t = time / 1000;
    const fear = this.st.misses / this.st.max;
    if (this.fly && !this.flyGone) {
      this.fly.x = WEB.x + Math.sin(t * (6 + fear * 30)) * (2 + fear * 6);
      this.fly.rotation = Math.sin(t * 3) * 0.08;
    }
  }

  async press(chRaw) {
    if (this.busy || this.finished) return;
    const ch = norm(chRaw);
    const res = guess(this.st, ch);
    if (res === 'invalid') return;
    if (res === 'repeat') {
      this.setStatus(`Букву «${ch}» ты уже называл, это не ошибка`, 'normal');
      this.quip('S35', { cooldown: 6000 });
      return;
    }
    GameState.stats.moves += 1;
    this.busy = true;
    if (res === 'hit') {
      this.drawKey(ch, 'hit');
      Audio.play('pencil', { volume: 0.55 });
      const n = [...this.word].filter((w) => norm(w) === ch).length; // Ё считается как Е
      this.revealLetters();
      this.goodMove(this.keys.get(ch).c.x, this.keys.get(ch).c.y - 70, 10 + n * 6, n > 1 ? `×${n}` : null);
      this.setStatus(n > 1 ? `Есть: буква «${ch}» встречается ${count(n, 'раз', 'раза', 'раз')}` : `Есть буква «${ch}»`, 'good');
      if (status(this.st) === 'win') { await this.endGame('win'); return; }
      this.quip('S31', { chance: 0.3 });
    } else {
      this.drawKey(ch, 'miss');
      this.badMove();
      Audio.play('web', { volume: 0.5 });
      Audio.play('buzz', { volume: 0.25 });
      await this.spiderWeave();
      this.drawWeb(this.st.misses);
      this.updateInfo();
      this.shake(160, 0.003);
      const left = this.st.max - this.st.misses;
      this.setStatus(`Буквы «${ch}» нет`, 'bad');
      if (status(this.st) === 'loss') { await this.endGame('loss'); return; }
      if (left === 1) this.quip('S33', { force: true });
      else this.quip(Math.random() < 0.5 ? 'S32' : 'S34', { chance: 0.6, cooldown: 7000 });
    }
    this.busy = false;
  }

  spiderWeave() {
    const s = this.spider;
    this.spiderThink(true);
    return new Promise((res) => this.tweens.add({
      targets: s, y: this.spiderHome.y + 120, duration: 260, yoyo: true, ease: 'Sine.easeInOut',
      onComplete: () => { this.spiderThink(false); res(); },
    }));
  }

  // Буква, вышитая ниткой: по форме буквы — косые стежки в два слоя, по краю — тонкий шов.
  wovenLetter(ch, color, fontSize) {
    const key = `hm_woven_${ch}_${color}_${fontSize}`;
    if (this.textures.exists(key)) return key;
    const size = parseInt(fontSize, 10) || 90;
    const W = Math.ceil(size * 0.95); const H = Math.ceil(size * 1.25);
    const R = 2; // текстура вдвое крупнее показа — стежки остаются чёткими
    const font = `700 ${size}px ${FONT.hand}`;
    const tx = W / 2; const ty = H / 2 + size * 0.04;
    // 1) стежки на отдельном холсте: плотная косая гладь + блик + редкий встречный стежок
    const st = document.createElement('canvas'); st.width = W * R; st.height = H * R;
    const s = st.getContext('2d'); s.scale(R, R);
    s.fillStyle = color; s.globalAlpha = 0.55; s.fillRect(0, 0, W, H); s.globalAlpha = 1;
    s.lineCap = 'round';
    s.strokeStyle = color; s.lineWidth = 3.2;
    for (let k = -H; k < W + H; k += 4.2) { s.beginPath(); s.moveTo(k, 0); s.lineTo(k + H * 0.8, H); s.stroke(); }
    s.strokeStyle = 'rgba(255,255,255,0.42)'; s.lineWidth = 1;
    for (let k = -H; k < W + H; k += 4.2) { s.beginPath(); s.moveTo(k + 1.1, 0); s.lineTo(k + 1.1 + H * 0.8, H); s.stroke(); }
    s.strokeStyle = 'rgba(0,0,0,0.28)'; s.lineWidth = 0.8;
    for (let k = -H; k < W + H; k += 4.2) { s.beginPath(); s.moveTo(k - 1.3, 0); s.lineTo(k - 1.3 + H * 0.8, H); s.stroke(); }
    // вырезаем по форме буквы (чуть толще самой буквы — нитка ложится с запасом)
    s.globalCompositeOperation = 'destination-in';
    s.font = font; s.textAlign = 'center'; s.textBaseline = 'middle';
    s.lineJoin = 'round'; s.lineWidth = size * 0.05; s.strokeStyle = '#000';
    s.fillStyle = '#000';
    const mask = document.createElement('canvas'); mask.width = W * R; mask.height = H * R;
    const m = mask.getContext('2d'); m.scale(R, R);
    m.font = font; m.textAlign = 'center'; m.textBaseline = 'middle'; m.lineJoin = 'round';
    m.fillStyle = '#000'; m.fillText(ch, tx, ty);
    m.lineWidth = size * 0.05; m.strokeStyle = '#000'; m.strokeText(ch, tx, ty);
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.drawImage(mask, 0, 0);
    // 2) итог: мягкая тень от нитки → стежки → пунктирный шов по контуру
    const c = document.createElement('canvas'); c.width = W * R; c.height = H * R;
    const ctx = c.getContext('2d');
    ctx.globalAlpha = 0.22; ctx.drawImage(mask, 1.5 * R, 2 * R); ctx.globalAlpha = 1;
    ctx.drawImage(st, 0, 0);
    ctx.scale(R, R);
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.setLineDash([4.5, 2.8]); ctx.lineWidth = 1.6; ctx.strokeStyle = color;
    ctx.strokeText(ch, tx, ty);
    this.textures.addCanvas(key, c);
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return key;
  }

  revealLetters(all = false, color = '#2a4a8a') {
    const rv = revealed(this.st);
    this.slots.forEach((s, n) => {
      if (!s.letter) return; // пробелы и знаки видны с самого начала
      const i = s.i;
      const show = all ? s.ch : rv[i];
      if (show && !s.t.text) {
        // буква вышивается ниткой: под текстом — стежки (текстура с косой штриховкой по форме буквы)
        const col = rv[i] ? '#2a4a8a' : color;
        s.t.setText(show).setColor(col).setAlpha(0);
        const key = this.wovenLetter(show, col, s.t.style.fontSize);
        const img = this.add.image(s.x, s.t.y, key).setOrigin(0.5).setScale(0.5);
        this.root.add(img);
        s.img = img;
        const w = img.width;
        img.setCrop(0, 0, 0, img.height);
        const prog = { k: 0 };
        this.tweens.add({
          targets: prog, k: 1, duration: this.reduced ? 1 : 520, delay: (this.phrase ? n * 18 : i * 40), ease: 'Sine.easeInOut',
          onUpdate: () => img.setCrop(0, 0, w * prog.k, img.height),
          onComplete: () => img.setCrop(),
        });
      }
    });
  }

  highlightData() { return { word: this.word, phrase: this.phrase, misses: this.st.misses, max: this.st.max }; }

  async endGame(result) {
    this.busy = true;
    if (result === 'win') {
      this.setStatus(this.phrase ? 'Пословица угадана, мушка улетает' : 'Слово угадано, мушка улетает', 'good');
      Audio.play('win', { volume: 0.7 });
      this.flyGone = true;
      this.tweens.add({ targets: this.fly, x: WEB.x + 700, y: WEB.y - 500, angle: 30, scale: 0.5, duration: 1600, ease: 'Sine.easeIn' });
      this.burst(1270, 330, 0xffd27a, 40);
    } else {
      this.setStatus(this.phrase ? 'Паутинка сплетена. Пословицу паук открыл сам' : `Паутинка сплетена. Слово было: ${this.word}`, 'bad');
      this.revealLetters(true, '#C8402E');
      Audio.play('lose', { volume: 0.6 });
      this.tweens.add({ targets: this.cocoon, alpha: 1, duration: 700 });
      this.spiderLaugh(1200);
    }
    if (result === 'win' && this.phrase) {
      // «Теперь и ты знаешь эту пословицу. Береги её» — дослушать, но не дольше 5 секунд
      await sleep(this, 900);
      await Promise.race([this.quip('S235', { force: true }), sleep(this, 5000)]);
      await sleep(this, 500);
    } else await sleep(this, 2600);
    this.finish(result);
  }

  computeHint() { return status(this.st) === 'play' ? hintLetter(this.st) : null; }

  showHint(ch) {
    this.setStatus(`Мама шепчет: «Попробуй букву ${ch}»`, 'good');
    const k = this.keys.get(ch);
    if (k) this.tweens.add({ targets: k.c, scale: { from: 1.25, to: 1 }, duration: 400, repeat: 2 });
    // пока мама «шепчет», другие буквы не нажимаются — иначе подсказанная буква могла потеряться
    this.busy = true;
    this.time.delayedCall(700, () => { this.busy = false; this.press(ch); });
  }
}
