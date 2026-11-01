// Сцена 0 — главное меню: сумеречная спальня, паук в паутине в углу. Слева — тёмно-синий картон
// с вышитой рамкой: название, «Играть», сложность, звук и полный экран. Справа — дневник: тетрадный лист
// на скотче, в нём увиденные финалы и открытые секреты (записаны «от руки», открытое отмечено карандашом).
// Первый клик разблокирует звук (см. main.js).
import * as Phaser from 'phaser';
import { PageTurn } from '../systems/pageTurn.js';
import { Save } from '../systems/save.js';
import { Haptics } from '../systems/haptics.js';
import { I18n } from '../i18n/index.js';
import { GAME_TITLE, prefersReducedMotion } from '../config/game.js';
import { CSS, INK, INKN, EASE, S, text, heroGradient } from '../config/theme.js';
import { DIFFICULTY, DIFFICULTY_IDS } from '../config/difficulty.js';
import { GameState } from '../state.js';
import { Journal, SECRETS, SECRETS_W2, ENDINGS } from '../systems/journal.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { voice } from '../systems/voice.js';
import { Button, FocusRing } from '../ui/button.js';
import { paperTexture, inkCheck, inkCircle, inkUnderline } from '../ui/paper.js';
import { drawingTexture, specKey } from '../systems/drawings.js';

const PANEL = { x: S[900], y: S[900], w: 760, h: 1080 - S[900] * 2 };
// Дневник — тетрадный лист: строки линовки через 36 px, первая — на 58 px от верха, поля — 64 px.
const RULE = { first: 58, step: 36, margin: 64 };
const JOURNAL_LINES = 14;
const JOURNAL = { w: 568, h: RULE.first + RULE.step * JOURNAL_LINES + 30 };
JOURNAL.x = 1920 - S[900] - JOURNAL.w + 8;
JOURNAL.y = S[900] + (1080 - S[900] * 2) - JOURNAL.h - 4;

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  // Лист бумаги или картона (текстура рисуется один раз): x, y, w, h — сам лист без тени.
  sheet(x, y, w, h, opts) {
    return this.add.image(x + w / 2, y + h / 2, paperTexture(this, w, h, opts));
  }

  create() {
    const reduced = prefersReducedMotion();
    voice.stop();
    this.starting = false;
    this.add.image(960, 540, 'menu_bg');
    this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.35);

    // Паук в паутине: короткая нить из угла потолка и лёгкое покачивание.
    const rig = this.add.container(1688, 44);
    const thread = this.add.graphics();
    thread.lineStyle(2, 0xe6ecf5, 0.6).lineBetween(0, 0, 0, 92);
    const spider = this.add.image(0, 92, 'spider_corner').setOrigin(0.5, 8 / 170);
    rig.add([thread, spider]);
    if (!reduced) {
      rig.setAngle(-3.5);
      this.tweens.add({ targets: rig, angle: 3.5, duration: 2600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      this.tweens.add({ targets: spider, scaleY: 1.04, duration: 1400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }

    // ---------- главная панель: тёмный картон ----------
    const P = PANEL; const PAD = S[700];
    const card = this.add.container(0, 0);
    card.add(this.sheet(P.x, P.y, P.w, P.h, { kind: 'night', seed: 4, border: true }));
    const L = P.x + PAD; const IW = P.w - PAD * 2;
    let y = P.y + PAD;
    const title = heroGradient(this.add.text(L - 4, y - 10, GAME_TITLE, text('heading-7')).setResolution(2));
    if (title.width > IW + 8) title.setScale((IW + 8) / title.width); // длинное название (английское) — ужать по ширине панели
    y += 96 + S[200];
    const sub = this.add.text(L, y, 'Пять дней жара', text('heading-4', { color: CSS.accent })).setResolution(2);
    y += 36 + S[300];
    const pitch = this.add.text(L, y, 'Мальчик заболел. Мама рядом, а по ночам из угла спускается старый паук Тихон. Он играет честно и знает, кто такая Огнёвка.', text('body-9', {
      color: CSS.fogHi, wordWrap: { width: IW, useAdvancedWrap: true },
    })).setResolution(2);
    card.add([title, sub, pitch]);
    y += pitch.height + S[600];

    // «Продолжить» — если есть сохранённый забег (начинается утро сохранённого дня)
    const save = Save.read();
    let play; let cont = null;
    if (save) {
      const cw = 400; const nw = IW - cw - S[200];
      cont = new Button(this, L + cw / 2, y + 40, {
        label: `Продолжить · день ${save.day}`, width: cw, height: 80, variant: 'primary', style: 'button-xl', onClick: () => this.continueGame(),
      });
      play = new Button(this, L + cw + S[200] + nw / 2, y + 40, {
        label: 'Новая игра', width: nw, height: 80, variant: 'secondary', style: 'button-xl', onClick: () => this.startGame(),
      });
    } else {
      play = new Button(this, L + 210, y + 40, {
        label: 'Играть', width: 420, height: 80, variant: 'primary', style: 'button-2xl', onClick: () => this.startGame(),
      });
    }
    y += 80 + S[500];

    card.add(this.add.text(L, y, 'Сложность', text('heading-6', { color: CSS.paper })).setResolution(2));
    y += 28 + S[200];
    const segW = Math.floor((IW - S[100] * 2) / 3);
    this.diffButtons = DIFFICULTY_IDS.map((id, i) => {
      const x = L + segW / 2 + i * (segW + S[100]);
      const b = new Button(this, x, y + 32, {
        label: DIFFICULTY[id].label, width: segW, height: 64, variant: 'segment', style: 'button-lg',
        onClick: () => this.selectDifficulty(id),
      });
      b.diffId = id;
      b.hint = this.add.text(x, y + 64 + S[100], DIFFICULTY[id].hint, text('hand-1', {
        color: CSS.fog, align: 'center', wordWrap: { width: segW - S[100] },
      })).setOrigin(0.5, 0).setResolution(2);
      card.add(b.hint);
      return b;
    });
    this.selectDifficulty(GameState.difficulty, true);
    y += 64 + S[100] + 24 + S[500];

    // альбом рисунков и писем, титры-книжка; «Вторая зима» — после двух разных финалов (выздоровел и больница)
    const third3 = Math.floor((IW - S[200] * 2) / 3);
    const col3 = (i) => L + third3 / 2 + i * (third3 + S[200]);
    const w2 = Journal.winter2Unlocked();
    this.albumBtn = new Button(this, col3(0), y + 28, {
      label: 'Альбом', width: third3, height: 56, variant: 'secondary', style: 'button-lg', onClick: () => this.openAlbum(),
    });
    this.creditsBtn = new Button(this, col3(1), y + 28, {
      label: 'Титры', width: third3, height: 56, variant: 'secondary', style: 'button-lg', onClick: () => this.openCredits(),
    });
    this.winterBtn = new Button(this, col3(2), y + 28, {
      label: 'Вторая зима', width: third3, height: 56, variant: w2 ? 'primary' : 'secondary', style: 'button-lg', onClick: () => this.startGame('winter2'),
    });
    if (!w2) {
      this.winterBtn.setDisabled(true);
      card.add(this.add.text(col3(2), y + 56 + S[75], 'Откроется после рассвета и скорой', text('hand-1', { color: CSS.fog, align: 'center', wordWrap: { width: third3 + 40 } })).setOrigin(0.5, 0).setResolution(2));
    }
    y += 56 + S[100] + 24 + S[300];

    const third = Math.floor((IW - S[200] * 2) / 3);
    const col = (i) => L + third / 2 + i * (third + S[200]);
    this.soundBtn = new Button(this, col(0), y + 28, {
      label: '', width: third, height: 56, variant: 'secondary', style: 'button-lg', onClick: () => this.toggleSound(),
    });
    this.updateSoundLabel();
    this.fullBtn = new Button(this, col(1), y + 28, {
      label: 'Во весь экран', width: third, height: 56, variant: 'secondary', style: 'button-lg', onClick: () => this.toggleFullscreen(),
    });
    this.langBtn = new Button(this, col(2), y + 28, {
      label: I18n.lang === 'en' ? 'Русский' : 'English', width: third, height: 56, variant: 'secondary', style: 'button-lg', onClick: () => this.toggleLang(),
    });

    const journal = this.makeJournal();
    this.makeAnyaCard();
    const focusables = [...(cont ? [cont] : []), play, ...this.diffButtons, this.albumBtn, this.creditsBtn, this.winterBtn, this.soundBtn, this.fullBtn, this.langBtn, this.anyaBtn];
    new FocusRing(this, focusables);

    if (!PageTurn.active) this.cameras.main.fadeIn(500, 0, 0, 0);
    // Появление: картон поднимается на место, лист дневника ложится чуть позже и с поворотом.
    if (!reduced) {
      const btns = focusables;
      card.setAlpha(0).setY(18);
      btns.forEach((btn) => { btn.setAlpha(0); btn.y += 18; });
      this.tweens.add({ targets: card, alpha: 1, y: 0, duration: 700, ease: EASE, delay: 120 });
      btns.forEach((btn, i) => this.tweens.add({ targets: btn, alpha: 1, y: btn.y - 18, duration: 600, ease: EASE, delay: 220 + i * 40 }));
      const a0 = journal.angle;
      journal.setAlpha(0).setAngle(a0 + 4).setPosition(journal.x + 40, journal.y + 12);
      this.tweens.add({ targets: journal, alpha: 1, angle: a0, x: journal.x - 40, y: journal.y - 12, duration: 800, ease: 'Back.easeOut', delay: 380 });
    }
    Audio.loop('wind_soft', { volume: 0.1, fade: 1600 });
    Music.setFever(0, 600);
    Music.play('mus_menu', { fade: 2500 });
    this.events.once('shutdown', () => Audio.stopLoop('wind_soft', { fade: 600 }));
    window.__menu = this;
    this.game.events.emit('menu-shown');
  }

  // Дневник: тетрадный лист, записи «от руки» на строках линовки. Открытое отмечено галочкой.
  // Когда открыта «Вторая зима», справа из-под листа торчат закладки «I» и «II»: вторая страница —
  // секреты второй зимы.
  makeJournal() {
    const J = JOURNAL;
    Journal.reload();
    // контейнер — в центре листа, чтобы лист можно было чуть повернуть
    const c = this.add.container(J.x + J.w / 2, J.y + J.h / 2).setAngle(-1.2);
    this.journalC = c;
    this.journalTabs = [];
    if (Journal.winter2Unlocked()) {
      [1, 2].forEach((n) => {
        const ty = -J.h / 2 + 96 + (n - 1) * 92;
        const tab = this.add.container(J.w / 2, ty);
        const bg = this.add.graphics();
        const label = this.add.text(22, 0, n === 1 ? 'I' : 'II', text('heading-6', { color: INK.ink })).setOrigin(0.5).setResolution(2);
        const z = this.add.zone(22, 0, 52, 78).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { if (this.journalWhich !== n) { Audio.play('page', { volume: 0.45 }); this.renderJournal(n); } });
        tab.add([bg, label, z]);
        tab.bg = bg; tab.label = label; tab.n = n;
        c.add(tab);
        this.journalTabs.push(tab);
      });
    }
    c.add(this.add.image(0, 0, paperTexture(this, J.w, J.h, { kind: 'light', seed: 6, edge: 'torn', tornSides: 't', ruled: 'lines', tape: 'corners' })));
    this.journalPage = this.add.container(0, 0);
    c.add(this.journalPage);
    this.renderJournal(this.journalWhich === 2 && this.journalTabs.length ? 2 : 1);
    return c;
  }

  renderJournal(which = 1) {
    const J = JOURNAL;
    const j = Journal.data;
    const counts = Journal.counts();
    this.journalWhich = which;
    const c = this.journalPage;
    c.removeAll(true);
    for (const tab of this.journalTabs) {
      const on = tab.n === which;
      tab.bg.clear();
      tab.bg.fillStyle(0x000000, 0.22).fillRoundedRect(-4, -36, 54, 78, 10);
      tab.bg.fillStyle(on ? 0xf6efe0 : (tab.n === 1 ? 0xd9cdb5 : 0xb9c7de), 1).fillRoundedRect(-8, -39, 52 + (on ? 6 : 0), 78, 10);
      tab.label.setX(on ? 25 : 22).setAlpha(on ? 1 : 0.7);
    }
    const ox = -J.w / 2; const oy = -J.h / 2;
    const g = this.add.graphics();
    c.add(g);
    const L = ox + RULE.margin + 16; const R = ox + J.w - 28;
    const line = (k) => oy + RULE.first + RULE.step * k; // y строки k (0 — первая)
    const put = (x, k, str, style, color, origin = 0) => {
      const t = this.add.text(x, line(k) + 5, str, text(style, { color })).setOrigin(origin, 1).setResolution(2);
      c.add(t); return t;
    };
    const w2 = which === 2;
    const head = put(L, 0, w2 ? 'Вторая зима' : 'Дневник', 'heading-4', INK.ink);
    inkUnderline(g, L, line(0) + 9, Math.ceil(head.width) + 8, { seed: w2 ? 5 : 3, color: w2 ? INKN.blue : INKN.red, alpha: 0.6, width: 2.2, passes: 1 });
    if (w2 ? counts.runsW2 : counts.runs) put(R, 0, w2 ? `Пройдено: ${counts.runsW2}` : `Сыграно: ${counts.runs}`, 'hand-1', INK.soft, 1);
    const note = this.add.text(L, line(1) + 5 - 29, w2 ? 'Год спустя. Тихон помнит всё, а игры подросли.' : 'Ответы Тихону открывают секреты. Финалов четыре.', text('hand-2', {
      color: INK.soft, wordWrap: { width: R - L, useAdvancedWrap: true }, lineSpacing: RULE.step - 29,
    })).setResolution(2);
    c.add(note);
    let k = note.height > 40 ? 3 : 2;
    const mark = (x, k2, on, color, seed) => {
      const yy = line(k2) - 11;
      if (on) inkCheck(g, x + 9, yy, 18, { seed, color, alpha: 0.95 });
      else inkCircle(g, x + 9, yy, 6, { seed, color: INKN.faded, alpha: 0.55, width: 1.6, passes: 1 });
    };
    const section = (label, n, total) => {
      put(L, k, label, 'heading-5', INK.ink);
      put(R, k, `${n} из ${total}`, 'hand-2', n ? INK.red : INK.faded, 1);
      k += 1;
    };
    const half = Math.floor((R - L) / 2);
    const secrets = (list) => {
      for (let d = 1; d <= 5; d++) {
        list.filter((s) => s.day === d).forEach((s, i) => {
          const x = L + i * half; const on = j.secrets.includes(s.id);
          mark(x, k, on, INKN.amber, 40 + k * 2 + i);
          put(x + 28, k, on ? s.title : 'Пока не открыт', 'hand-1', on ? INK.ink : INK.faded);
        });
        k += 1;
      }
    };
    if (w2) {
      section('Секреты', counts.secretsW2, counts.secretsW2Total);
      secrets(SECRETS_W2);
      k += 1;
      put(L, k, 'Игры второй зимы', 'heading-5', INK.ink); k += 1;
      const games = [['Пять в ряд', 'Морской бой с минами'], ['Пословицы', 'Точки: пять на пять'], ['Поддавки', '']];
      games.forEach((row) => {
        row.forEach((name, i) => { if (name) put(L + i * half, k, `· ${name}`, 'hand-1', INK.soft); });
        k += 1;
      });
      return;
    }
    section('Финалы', counts.endings, counts.endingsTotal);
    for (const e of ENDINGS) {
      const on = j.endings.includes(e.id);
      mark(L, k, on, e.group === 'recovered' ? INKN.green : INKN.blue, 10 + k);
      put(L + 30, k, on ? e.title : 'Пока не открыт', 'hand-2', on ? INK.ink : INK.faded);
      k += 1;
    }
    k += 1;
    section('Секреты', counts.secrets, counts.secretsTotal);
    secrets(SECRETS);
  }

  selectDifficulty(id, silent = false) {
    GameState.setDifficulty(id);
    for (const b of this.diffButtons) {
      const on = b.diffId === GameState.difficulty;
      b.setSelected(on);
      b.hint.setColor(on ? CSS.accent : CSS.fog);
    }
    if (!silent) Audio.play('move', { volume: 0.5 });
  }

  toggleSound() {
    GameState.soundOn = !GameState.soundOn;
    Audio.setMuted(!GameState.soundOn);
    this.updateSoundLabel();
  }

  toggleFullscreen() {
    const sc = this.scale;
    if (sc.isFullscreen) sc.stopFullscreen(); else sc.startFullscreen();
    // в полноэкранном режиме на телефоне просим альбомную ориентацию
    try { if (window.screen.orientation && window.screen.orientation.lock) window.screen.orientation.lock('landscape').catch(() => {}); } catch { /* */ }
  }

  updateSoundLabel() {
    this.soundBtn.setLabel(GameState.soundOn ? 'Звук включён' : 'Звук выключен');
  }

  // Каждый запуск из меню — новый забег (сохранение стирается), сложность сохраняется.
  // Обложка-меню перелистывается, как картонная крышка книжки.
  startGame(mode = 'main') {
    if (this.starting) return;
    this.starting = true;
    Audio.unlock();
    Save.clear();
    GameState.reset(GameState.difficulty, mode);
    Haptics.tap();
    Audio.play('page', { volume: 0.55 });
    PageTurn.go(this, 'Prologue', {}, { back: 'night', ms: 1500 });
  }

  // Продолжить сохранённый забег: утро сохранённого дня.
  continueGame() {
    if (this.starting) return;
    if (!Save.restore(GameState)) { this.scene.restart(); return; }
    this.starting = true;
    Audio.unlock();
    Haptics.tap();
    Audio.play('page', { volume: 0.55 });
    PageTurn.go(this, 'Bedroom', { day: GameState.day }, { back: 'night', ms: 1500 });
  }

  // Тайная глава «Аня»: старая фотокарточка на стене между маминым рисунком и паутиной.
  // Пока собраны не все секреты — карточка перевёрнута (виден только счёт), кнопка неактивна.
  makeAnyaCard() {
    const open = Journal.anyaUnlocked();
    const seen = !!Journal.data.anyaSeen;
    const counts = Journal.counts();
    const x = 1478; const y = 232; const W = 176; const H = 138;
    const c = this.add.container(x, y).setAngle(open ? 3 : -2);
    c.add(this.add.rectangle(6, 8, W, H, 0x000000, 0.35));
    c.add(this.add.image(0, 0, paperTexture(this, W, H, { kind: open ? 'cream' : 'light', seed: 21 })));
    if (open) {
      const key = drawingTexture(this, specKey({ kind: 'anya', day: 0, seed: 7 }), { kind: 'anya', day: 0, seed: 7 });
      c.add(this.add.image(0, -6, key).setScale((W - 22) / 640));
    } else {
      c.add(this.add.text(0, -12, '?', text('heading-7', { color: INK.faded })).setOrigin(0.5).setResolution(2));
      c.add(this.add.text(0, 40, `${counts.secrets} из ${counts.secretsTotal}`, text('hand-2', { color: INK.soft })).setOrigin(0.5).setResolution(2));
    }
    c.add(this.add.rectangle(0, -H / 2 + 2, 70, 22, 0xf3e6c0, 0.75).setAngle(-4));
    if (seen) { const g = this.add.graphics(); c.add(g); inkCheck(g, W / 2 - 20, H / 2 - 18, 22, { seed: 9, color: INKN.green, alpha: 0.95 }); }
    this.anyaCard = c;
    this.anyaBtn = new Button(this, x, y + H / 2 + 34, {
      label: 'Тайная глава', width: 220, height: 46, variant: open ? 'primary' : 'ghost', style: 'button-lg', onClick: () => this.openAnya(),
    });
    if (!open) this.anyaBtn.setDisabled(true);
    if (open) {
      const z = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.openAnya());
    }
  }

  openAnya(force = false) {
    if (this.starting || (!force && !Journal.anyaUnlocked())) return;
    this.starting = true;
    Audio.unlock();
    Haptics.tap();
    Audio.play('page', { volume: 0.55 });
    PageTurn.go(this, 'Anya', { from: 'Menu' }, { back: 'night', ms: 1500 });
  }

  openCredits() {
    if (this.starting) return;
    this.starting = true;
    Audio.play('page', { volume: 0.5 });
    PageTurn.go(this, 'Credits', { from: 'Menu' }, { back: 'night', ms: 1300 });
  }

  openAlbum() {
    if (this.starting) return;
    this.scene.pause();
    this.scene.launch('Album', { from: 'Menu' });
    this.scene.bringToTop('Album');
  }

  // Язык меняется перезагрузкой: надписи на нарисованных текстурах (календарь, банка малины, рисунки)
  // и слова «Паутинки» собираются при загрузке. ?lang= в адресе тоже обновляем, иначе он победит выбор.
  toggleLang() {
    I18n.set(I18n.lang === 'en' ? 'ru' : 'en');
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('lang')) { u.searchParams.set('lang', I18n.lang); window.history.replaceState(null, '', u.toString()); }
      window.location.reload();
    } catch { this.scene.restart(); }
  }
}
