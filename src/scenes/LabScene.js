// Стенд для проверки кукол (?lab=rig): тело без руки, рука отдельно (тянется за курсором),
// собранный мальчик с перебором поз, мама: ходьба, наклон, поднос.
import * as Phaser from 'phaser';
import { CSS, text } from '../config/theme.js';
import { BoyRig } from '../systems/rig/BoyRig.js';
import { MomRig } from '../systems/rig/MomRig.js';
import { drawingTexture, specKey, DRAW_W, DRAW_H } from '../systems/drawings.js';
import { TEX_REGISTRY, makeCanvas } from '../systems/paint.js';
import { PAINTERS, SPIDER_PARTS } from '../systems/placeholders.js';
import { Assets } from '../systems/assets.js';

export class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  create() {
    this.cameras.main.setBackgroundColor('#2a3550');
    const lab = new URLSearchParams(window.location.search).get('lab');
    if (lab === 'parts') { this.sheet(); return; }
    if (lab === 'export') { this.exportArt(); return; }
    if (lab === 'world') { this.world(); return; }
    if (lab === 'drawings') { this.drawings(); return; }
    const label = (x, y, t) => this.add.text(x, y, t, text('heading-5', { color: CSS.paper })).setResolution(2);
    const S = 0.62;
    // 1. тело без ближней руки
    const a = new BoyRig(this, 10, 60).setScale(S);
    for (const n of ['nUp', 'nFo', 'nHand']) a.part(n).img.setVisible(false);
    label(30, 20, '1. Тело без ближней руки');
    // 2. рука отдельно
    const b = new BoyRig(this, 640, 60).setScale(S);
    for (const p of b.parts) if (!['nUp', 'nFo', 'nHand'].includes(p.name)) p.img.setVisible(false);
    this.armRig = b;
    label(660, 20, '2. Рука отдельно (IK за курсором)');
    const dot = this.add.circle(0, 0, 6, 0xffcc66);
    this.input.on('pointermove', (p) => { b.reachTo(p.x, p.y, 'near', 12); dot.setPosition(p.x, p.y); });
    b.reachTo(1000, 200, 'near', 12); dot.setPosition(1000, 200);
    // 3. собранный
    const c = new BoyRig(this, 1270, 60).setScale(S);
    label(1290, 20, '3. Собранный: позы');
    const poseText = label(1290, 400, '');
    const seq = [['rest'], ['cough'], ['cheer'], ['hide'], ['mouth'], ['wave'], ['forehead']];
    let i = 0;
    const next = () => {
      const [n] = seq[i % seq.length]; i += 1;
      c.hide(0); c.setFace(null);
      if (n === 'hide') c.hide(1); else if (n === 'cough') c.cough(true); else if (n === 'cheer') c.cheer(1400); else c.setPose(n);
      if (n === 'mouth') c.holdProp('prop_cup', { scale: 0.5 }); else c.holdProp(null);
      poseText.setText(`поза: ${n}`);
    };
    next();
    this.time.addEvent({ delay: 1700, loop: true, callback: next });
    this.boyC = c;
    // мама
    this.add.rectangle(960, 1010, 1920, 4, 0x1a2133);
    const m1 = new MomRig(this, 200, 1010).setScale(0.62);
    label(30, 440, '4. Мама: ходьба');
    const walk = async () => { for (;;) { await m1.walkTo(820, { speed: 230 }); await m1.wait(500); await m1.walkTo(200, { speed: 230 }); await m1.wait(500); } };
    walk();
    const m2 = new MomRig(this, 1000, 1010).setScale(0.62);
    label(900, 440, '5. Наклон');
    const tgt = this.add.circle(1180, 830, 8, 0xff6b6b);
    this.time.addEvent({ delay: 1600, loop: true, callback: () => {
      const on = !m2.armTargets.near;
      m2.setLean(on ? 0.35 : 0).setCrouch(on ? 0.4 : 0).tiltHead(on ? 0.2 : 0);
      if (on) m2.reach('near', tgt.x, tgt.y); else m2.reach('near', null);
    } });
    const m3 = new MomRig(this, 1390, 1010).setScale(0.62);
    label(1280, 480, '6. С подносом');
    m3.hold('torso', 'prop_tray', { dx: 64, dy: -70, z: 9.5 });
    m3.reachLocal('near', 150, -96).reachLocal('far', 0, -90);
    m3.setFace({ eyes: 'happy', mouth: 'smile' });
    // 7. сидит в кресле и дремлет
    this.add.image(1760, 1010, 'armchair').setOrigin(0.5, 1).setScale(0.62 * 1.0);
    const m4 = new MomRig(this, 1745, 1010).setScale(0.62).face(-1).setSit(1, true);
    label(1600, 480, '7. В кресле');
    this.time.addEvent({ delay: 2200, loop: true, callback: () => m4.setSleep(!m4.asleep) });
    this.moms = [m1, m2, m3, m4];
    window.__lab = this;
  }

  // Все рисунки мальчика: дни 1–5 × победа/поражение и финальные (?lab=drawings).
  drawings() {
    this.cameras.main.setBackgroundColor('#3a4150');
    const games = ['tictactoe', 'battleship', 'hangman', 'dots', 'checkers'];
    const specs = [];
    games.forEach((g, i) => ['win', 'loss'].forEach((r) => specs.push({ kind: 'day', day: i + 1, game: g, result: r, wins: r === 'win' ? Math.min(3, i + 1) : 1, losses: r === 'loss' ? 1 : 0, seed: 1000 + (i + 1) * 37 })));
    specs.push({ kind: 'final_recovered', day: 5, seed: 5 }, { kind: 'final_hospital', day: 5, seed: 6 }, { kind: 'anya', day: 0, seed: 7 });
    const s = 0.4; const cols = 5;
    specs.forEach((sp, i) => {
      const x = 30 + (i % cols) * (DRAW_W * s + 20); const y = 20 + Math.floor(i / cols) * (DRAW_H * s + 34);
      this.add.image(x, y, drawingTexture(this, specKey(sp), sp)).setOrigin(0).setScale(s);
      this.add.text(x, y + DRAW_H * s + 2, `${sp.kind} ${sp.game || ''} ${sp.result || ''}`, text('caption-1', { color: CSS.fog }));
    });
  }

  // Временные сюжетные текстуры (paintWorld.js) на одном листе.
  world() {
    const keys = ['moth_fire', 'moth_white', 'ice_web', 'silver_net', 'armchair', 'plaid', 'bullfinch', 'prop_phone', 'prop_bottle',
      'socks_peek', 'drawing_tikhon', 'ambulance', 'ambulance_open', 'ambulance_wheel', 'corner_shadow', 'fx_beam_soft'];
    this.cameras.main.setBackgroundColor('#181818');
    let x = 20; let y = 20; let rowH = 0;
    for (const k of keys) {
      const f = this.textures.getFrame(k); const s = Math.min(1, 330 / Math.max(f.width, f.height));
      if (x + f.width * s > 1900) { x = 20; y += rowH + 40; rowH = 0; }
      this.add.rectangle(x, y, f.width * s, f.height * s, 0x313131).setOrigin(0);
      this.add.image(x, y, k).setOrigin(0).setScale(s);
      this.add.text(x, y + f.height * s + 4, k, text('caption-1', { color: CSS.fog }));
      x += f.width * s + 24; rowH = Math.max(rowH, f.height * s);
    }
  }

  // Пивоты деталей кукол: где картинка крепится к кости (в пикселях картинки). Варианты одной детали
  // (глаза, рты, головы по состояниям) крепятся так же, как деталь, надетая по умолчанию.
  rigPivots() {
    const out = {};
    const rigs = [['boy', new BoyRig(this, -2000, -2000)], ['mom', new MomRig(this, -2000, -2000)]];
    for (const [rig, r] of rigs) {
      for (const p of r.parts) {
        const f = p.img.frame;
        const piv = { rig, bone: p.bone ? p.bone.name : '', ox: Math.round(p.img.originX * f.width), oy: Math.round(p.img.originY * f.height) };
        const key = p.img.texture.key;
        out[key] = out[key] || piv;
        const fam = (k) => (/^(boy_head|boy_eyes|boy_mouth|boy_hand|mom_eyes|mom_mouth)_/.exec(k) || [])[1];
        const f0 = fam(key);
        if (f0) for (const k of TEX_REGISTRY.keys()) if (!out[k] && fam(k) === f0) out[k] = { ...piv, variantOf: key };
      }
      r.destroy();
    }
    for (const [k, d] of Object.entries(SPIDER_PARTS)) out[k] = { rig: 'spider', bone: d.face ? 'head' : 'body', ox: d.ox, oy: d.oy };
    return out;
  }

  // Все детали кукол (мальчик, мама, кровать, реквизит, паук) в натуральную величину с пивотами (?lab=parts).
  sheet() {
    this.cameras.main.setBackgroundColor('#2a3550');
    const piv = this.rigPivots();
    const groups = ['boy', 'mom', 'bed', 'props', 'spider'];
    const keys = [...TEX_REGISTRY.entries()].filter(([, d]) => groups.includes(d.group)).sort((a, b) => groups.indexOf(a[1].group) - groups.indexOf(b[1].group));
    const s = 0.5; let x = 16; let y = 16; let rowH = 0;
    const g = this.add.graphics().setDepth(5);
    for (const [k] of keys) {
      const f = this.textures.getFrame(k);
      const w = Math.max(f.width * s, 92);
      if (x + w > 1904) { x = 16; y += rowH + 30; rowH = 0; }
      this.add.rectangle(x, y, f.width * s, f.height * s, 0x3a4a6a).setOrigin(0);
      this.add.image(x, y, k).setOrigin(0).setScale(s);
      const p = piv[k];
      if (p) { const px = x + p.ox * s; const py = y + p.oy * s; g.lineStyle(2, 0xff5a5a, 1).lineBetween(px - 6, py, px + 6, py).lineBetween(px, py - 6, px, py + 6); }
      this.add.text(x, y + f.height * s + 2, `${k} ${f.width}×${f.height}`, text('caption-4')).setScale(0.8);
      x += w + 14; rowH = Math.max(rowH, f.height * s + 14);
    }
  }

  // Выгрузка всех нарисованных кодом картинок для художника (tools/export-art.mjs): список и PNG по запросу.
  exportArt() {
    this.cameras.main.setBackgroundColor('#202020');
    for (const [k, d] of Object.entries(PAINTERS)) if (d.lazy) Assets.ensure(this, k);
    const piv = this.rigPivots();
    const list = [];
    const seen = new Set();
    const add = (key, group, extra = {}) => {
      if (seen.has(key) || !this.textures.exists(key)) return;
      seen.add(key);
      const src = this.textures.get(key).getSourceImage();
      list.push({ key, group, w: src.width, h: src.height, real: Assets.isReal(key), pivot: piv[key] || null, ...extra });
    };
    const bgGroup = (k) => (/^(menu_bg|road_|porch|bedroom_)/.test(k) ? 'backgrounds' : /^spider_/.test(k) ? 'spider' : 'characters');
    for (const [k, d] of Object.entries(PAINTERS)) add(k, bgGroup(k), d.frames ? { frames: d.frames } : {});
    for (const [k, d] of TEX_REGISTRY) add(k, d.group);
    window.__artExport = list;
    // большие непрозрачные фоны — JPEG (шаблону точность цвета до бита не нужна), остальное — PNG с прозрачностью
    window.__artPng = (key) => {
      const src = this.textures.get(key).getSourceImage();
      const c = makeCanvas(src.width, src.height); const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);
      let opaque = src.width * src.height >= 600000;
      if (opaque) {
        const d = ctx.getImageData(0, 0, src.width, src.height).data;
        for (let i = 3; i < d.length; i += 16) if (d[i] < 255) { opaque = false; break; }
      }
      return opaque ? { ext: 'jpg', url: c.toDataURL('image/jpeg', 0.9) } : { ext: 'png', url: c.toDataURL('image/png') };
    };
    this.add.text(40, 40, `Экспорт: ${list.length} картинок`, text('heading-5', { color: CSS.paper }));
  }
}
