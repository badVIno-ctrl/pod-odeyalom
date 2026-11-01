// Загрузка: манифест → реальные картинки из assets/img → заглушки для остального → меню.
import * as Phaser from 'phaser';
import { Assets } from '../systems/assets.js';
import { createSpiderParts, createUtilityTextures } from '../systems/placeholders.js';
import { CSS, text as textStyle } from '../config/theme.js';
import { createRigTextures } from '../systems/rig/parts.js';
import { createPovTextures } from '../systems/paintPov.js';
import { createWorldTextures } from '../systems/paintWorld.js';
import { LiveFX } from '../systems/livefx.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.cameras.main.setBackgroundColor('#0b101c');
    // Тихон плетёт паутинку: сначала радиусы, потом спираль — по мере загрузки (как HTML-заставка до запуска игры)
    const web = this.add.graphics();
    const spider = this.add.graphics();
    const text = this.add.text(960, 790, 'Тихон плетёт паутинку…', textStyle('hand-3', { color: CSS.fog })).setOrigin(0.5).setResolution(2);
    const CX = 960; const CY = 470; const R = 230; const SPOKES = 12;
    const ang = (k) => (k / SPOKES) * Math.PI * 2 + 0.13;
    const spiral = [];
    for (let k = 0, r = 26; r < R - 12; k++, r += 1.7) spiral.push({ x: CX + Math.cos(ang(k)) * r, y: CY + Math.sin(ang(k)) * r });
    const drawWeb = (p) => {
      web.clear();
      const ps = Math.min(1, p / 0.25);
      for (let k = 0; k < SPOKES; k++) {
        const kk = Math.max(0, Math.min(1, ps * SPOKES - k));
        if (kk <= 0) continue;
        web.lineStyle(2.4, 0xcfd6e6, 0.7).lineBetween(CX, CY, CX + Math.cos(ang(k)) * R * kk, CY + Math.sin(ang(k)) * R * kk);
      }
      const n = Math.floor(Math.max(0, (p - 0.25) / 0.75) * spiral.length);
      if (n > 1) { web.lineStyle(2.2, 0xe8ecf3, 0.85); web.strokePoints(spiral.slice(0, n)); }
    };
    const drawSpider = (t) => {
      const y = CY + 150 + Math.sin(t / 420) * 10;
      spider.clear();
      spider.lineStyle(1.6, 0xcfd6e6, 0.7).lineBetween(CX, CY, CX, y - 20);
      spider.lineStyle(5, 0x6b4426, 1);
      for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
        const y0 = y - 4 + i * 7;
        spider.beginPath(); spider.moveTo(CX, y0); spider.lineTo(CX + d * 30, y0 - 12 + i * 5); spider.lineTo(CX + d * 50, y0 + 10 + i * 9); spider.strokePath();
      }
      spider.fillStyle(0x8a5a3a, 1).fillEllipse(CX, y + 12, 50, 58);
      spider.fillStyle(0x9c6a44, 1).fillCircle(CX, y - 18, 19);
      spider.fillStyle(0xffffff, 1).fillCircle(CX - 7, y - 21, 5.5).fillCircle(CX + 7, y - 21, 5.5);
      spider.fillStyle(0x1a1410, 1).fillCircle(CX - 6, y - 20, 2.8).fillCircle(CX + 8, y - 20, 2.8);
    };
    drawWeb(0); drawSpider(0);
    const tick = (time) => drawSpider(time);
    this.events.on('update', tick);
    const drawBar = drawWeb;

    Assets.init().then(() => {
      Assets.queueImages(this);
      this.load.on('progress', drawBar);
      this.load.once('complete', () => {
        Assets.finalize(this);
        createSpiderParts(this);
        createUtilityTextures(this);
        createRigTextures(this);
        createPovTextures(this);
        createWorldTextures(this);
        LiveFX.init(this);
        this.events.off('update', tick);
        web.destroy(); spider.destroy(); text.destroy();
        this.scene.launch('Overlay');
        const lab = new URLSearchParams(window.location.search).get('lab');
        if (lab === 'pov') {
          const mode = new URLSearchParams(window.location.search).get('mode') || 'medicine';
          const game = this.game;
          const again = () => game.scene.start('Pov', { mode, onDone: () => setTimeout(again, 500) });
          again();
        } else this.scene.start(lab ? 'Lab' : 'Menu');
      });
      this.load.start();
    });
  }
}
