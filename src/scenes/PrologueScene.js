// Сцена 1 — пролог (~25 с). Кадры переключаются, когда закончились реплики кадра.
// Клик — ускорить реплику; «Пропустить» (или Esc, или S в debug) — сразу к титру «День 1».
import * as Phaser from 'phaser';
import { PageTurn } from '../systems/pageTurn.js';
import { S, text, CSS } from '../config/theme.js';
import { ROOM, PROLOGUE } from '../config/layout.js';
import { prefersReducedMotion } from '../config/game.js';
import { Director } from '../systems/cutscene.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { calendarCard, COVER_W2 } from '../ui/calendar.js';
import { GameState } from '../state.js';
import { getDay } from '../config/days.js';
import { voice } from '../systems/voice.js';
import { Debug } from '../systems/debug.js';
import { Button } from '../ui/button.js';
import { PAIR_FRAME } from '../systems/paintChars.js';
import { onUpdate } from '../systems/lifecycle.js';

export class PrologueScene extends Phaser.Scene {
  constructor() { super('Prologue'); }

  create() {
    this.d = new Director(this);
    this.reduced = prefersReducedMotion();
    this.cameras.main.setBackgroundColor('#000000');
    this.root = this.add.container(0, 0);

    const skip = new Button(this, 1920 - S[600] - 110, S[500] + 28, {
      label: 'Пропустить', width: 220, height: 56, variant: 'ghost', style: 'button-lg',
      onClick: () => this.skip(),
    });
    skip.setDepth(500);
    this.skipBtn = skip;
    this.input.on('pointerdown', (p, over) => { if (!over.length) voice.skip(); });
    this.input.keyboard.on('keydown-ESC', () => this.skip());
    const off = Debug.on('skip', () => this.skip());
    this.events.once('shutdown', () => { off(); Audio.stopAllLoops(500); });

    if (!this.anims.exists('pair_walk')) {
      this.anims.create({
        key: 'pair_walk', frameRate: 8, repeat: -1,
        frames: Array.from({ length: PAIR_FRAME.frames }, (_, f) => ({ key: 'pair_walk', frame: f })),
      });
    }
    this.run();
  }

  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this.skipBtn.setDisabled(true).setVisible(false);
    this.d.skip();
  }

  loop(key, opts) { if (!this.d.skipping) Audio.loop(key, opts); }

  async run() {
    const d = this.d;
    if (GameState.mode === 'winter2') { await this.runWinter2(); return; }
    await this.shotRoad();
    await this.shotStorm();
    await this.shotPorch();
    await this.shotBedroom();
    // Титр «День 1» показывается всегда, даже после «Пропустить».
    d.resume();
    this.skipBtn.setVisible(false);
    await this.titleCard();
    if (!this.scene.isActive()) return; // сцену уже остановили (отладочный прыжок по дням)
    this.scene.start('Bedroom', { day: 1 });
  }

  // 1.1 Дорога днём: три слоя параллакса, мама с мальчиком идут слева направо, лёгкий снег.
  async shotRoad() {
    const d = this.d;
    this.far = this.add.image(0, 0, 'road_far').setOrigin(0, 0);
    this.farStorm = this.add.image(0, 0, 'road_far_storm').setOrigin(0, 0).setAlpha(0);
    this.mid = this.add.image(0, 0, 'road_mid').setOrigin(0, 0);
    this.sky = this.add.rectangle(960, 540, 1920, 1080, 0x0a1020, 0);
    this.pair = this.add.sprite(240, PROLOGUE.groundY, 'pair_walk', 0).setOrigin(0.5, 1);
    this.scarf = this.add.image(0, 0, 'scarf').setOrigin(0.2, 0.5);
    this.front = this.add.image(0, 0, 'road_front').setOrigin(0, 0);
    this.root.add([this.far, this.farStorm, this.mid, this.sky, this.pair, this.scarf, this.front]);
    this.scarfAttached = true;
    onUpdate(this, this.followScarf, this);

    this.snow = this.add.particles(0, 0, 'fx_snow', {
      x: { min: -100, max: 2000 }, y: -20, lifespan: 11000,
      speedY: { min: 45, max: 95 }, speedX: { min: -30, max: 10 },
      scale: { min: 0.18, max: 0.5 }, alpha: { min: 0.55, max: 0.95 }, frequency: 70, quantity: 1,
    });
    this.snow.fastForward?.(9000);

    this.pair.play('pair_walk');
    Music.setFever(0, 300);
    Music.play('mus_menu', { fade: 2500 }); // тема меню продолжается на дороге
    this.loop('wind_soft', { volume: 0.45 });
    this.loop('snow_steps', { volume: 0.5 });
    if (!PageTurn.active) this.cameras.main.fadeIn(this.d.skipping ? 0 : 900, 0, 0, 0);

    // Параллакс: дальний слой медленно, ближний быстро.
    this.scroll = this.tweens.add({ targets: this.far, x: -380, duration: 17000, ease: 'Linear' });
    this.scrollStorm = this.tweens.add({ targets: this.farStorm, x: -380, duration: 17000, ease: 'Linear' });
    this.tweens.add({ targets: this.mid, x: -1000, duration: 17000, ease: 'Linear' });
    this.tweens.add({ targets: this.front, x: -1880, duration: 17000, ease: 'Linear' });
    this.walk = this.tweens.add({ targets: this.pair, x: 1180, duration: 11000, ease: 'Sine.easeOut' });

    await d.wait(900);
    await d.say('B01');
    await d.wait(250);
    await d.say('M01');
    await d.wait(500);
  }

  followScarf() {
    if (!this.scarfAttached || !this.pair || !this.pair.active) return;
    const bob = (Number(this.pair.frame.name) || 0) % 2 ? -3 : 0;
    this.scarf.setPosition(
      this.pair.x - PAIR_FRAME.w / 2 + PAIR_FRAME.scarfAnchor.x,
      this.pair.y - PAIR_FRAME.h + PAIR_FRAME.scarfAnchor.y + bob,
    );
  }

  // 1.2 Пурга: небо темнеет, дальний слой → road_far_storm, косой густой снег, тряска, шарф улетает.
  async shotStorm() {
    const d = this.d;
    Audio.stopLoop('wind_soft', { fade: 1800 });
    Music.stop({ fade: 2600 }); // в пурге музыки нет — только ветер
    this.loop('blizzard', { volume: 0.7, fade: 1800 });
    d.tween({ targets: this.sky, fillAlpha: 0.38, duration: 2200, ease: 'Sine.easeInOut' });
    d.tween({ targets: this.farStorm, alpha: 1, duration: 2200, ease: 'Sine.easeInOut' });
    this.snow.setConfig?.({
      x: { min: 1700, max: 2100 }, y: { min: -200, max: 1000 }, lifespan: 2600,
      speedX: { min: -1100, max: -700 }, speedY: { min: 80, max: 220 },
      scale: { min: 0.2, max: 0.6 }, alpha: { min: 0.6, max: 1 }, frequency: 12, quantity: 3,
    });
    this.streaks = this.add.particles(0, 0, 'fx_streak', {
      x: { min: 1900, max: 2200 }, y: { min: -100, max: 1080 }, lifespan: 1700,
      speedX: { min: -1900, max: -1300 }, speedY: { min: 100, max: 260 }, rotate: 7,
      scale: { min: 0.6, max: 1.6 }, alpha: { min: 0.25, max: 0.7 }, frequency: 14, quantity: 3,
    });
    this.walk.stop();
    this.tweens.add({ targets: this.pair, x: this.pair.x + 160, duration: 7000, ease: 'Sine.easeOut' });
    this.pair.anims.timeScale = 0.75;
    if (!d.skipping && !this.reduced) this.cameras.main.shake(2600, 0.0035);

    await d.wait(1200);
    await d.say('M02');
    // Шарф сдувает ветром.
    this.scarfAttached = false;
    d.tween({
      targets: this.scarf, x: this.scarf.x - 820, y: this.scarf.y - 260, angle: -260, scale: 1.15, alpha: 0,
      duration: 1900, ease: 'Quad.easeIn',
    });
    await d.wait(500);
    await d.say('B02');
    await d.wait(400);
    await d.tween({ targets: this.root, alpha: 0, duration: 500 });
    this.events.off('update', this.followScarf, this);
    this.tweens.killAll();
    this.snow.destroy(); this.streaks.destroy();
    this.root.removeAll(true);
    this.root.setAlpha(1);
  }

  // 1.3 Крыльцо: подходят к двери, дверь открывается, белая вспышка → темнота.
  async shotPorch() {
    const d = this.d;
    Audio.stopLoop('snow_steps', { fade: 1200 });
    const porch = this.add.image(960, 540, 'porch');
    const open = this.add.image(960, 540, 'porch_door_open').setAlpha(0);
    const glow = this.add.image(PROLOGUE.porchDoor.x, PROLOGUE.porchDoor.y - 230, 'fx_glow')
      .setScale(3.2, 4.2).setTint(0xffc27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const pair = this.add.sprite(180, PROLOGUE.porchDoor.y + 6, 'pair_walk', 0).setOrigin(0.5, 1).setScale(0.94);
    const snow = this.add.particles(0, 0, 'fx_snow', {
      x: { min: 1500, max: 2100 }, y: { min: -200, max: 900 }, lifespan: 3000,
      speedX: { min: -800, max: -450 }, speedY: { min: 90, max: 200 },
      scale: { min: 0.15, max: 0.45 }, alpha: { min: 0.5, max: 0.9 }, frequency: 22, quantity: 2,
    });
    this.root.add([porch, open, glow, pair, snow]);
    pair.play('pair_walk');
    await d.tween({ targets: pair, x: PROLOGUE.porchDoor.x - 170, scale: 0.86, duration: 2600, ease: 'Sine.easeOut' });
    pair.stop(); pair.setFrame(0);
    d.sfx('door');
    d.tween({ targets: open, alpha: 1, duration: 260 });
    d.tween({ targets: glow, alpha: 0.75, duration: 500 });
    await d.wait(250);
    await d.say('M03');
    await d.wait(200);
    Audio.stopLoop('blizzard', { fade: 700 });
    if (!d.skipping) this.cameras.main.flash(380, 255, 250, 240);
    await d.wait(300);
    await d.tween({ targets: this.root, alpha: 0, duration: 700 });
    snow.destroy();
    this.root.removeAll(true);
    this.root.setAlpha(1);
  }

  // 1.4 Спальня ночью: мальчик в кровати, мама у кровати.
  async shotBedroom() {
    const d = this.d;
    const bg = this.add.image(960, 540, 'bedroom_night');
    const lamp = this.add.image(ROOM.nightstand.x + 50, ROOM.nightstand.y - 150, 'fx_glow')
      .setScale(4.5).setTint(0xffb066).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32);
    const mom = this.add.image(PROLOGUE.momAtBedX, ROOM.mom.y, 'mom_stand').setOrigin(0.5, 1);
    const boy = this.add.image(ROOM.bed.x, ROOM.bed.y, 'boy_bed_healthy').setOrigin(0.5, 1);
    this.root.add([bg, lamp, mom, boy]);
    this.root.setAlpha(0);
    Music.play('mus_night', { fade: 2500, volume: 0.85 });
    await d.tween({ targets: this.root, alpha: 1, duration: 900 });
    await d.wait(300);
    await d.say('M04');
    await d.wait(200);
    await d.say('B03');
    await d.wait(500);
    d.tween({ targets: lamp, alpha: 0, duration: 700 });
    await d.tween({ targets: this.root, alpha: 0, duration: 1100 });
    this.root.removeAll(true);
    this.root.setAlpha(1);
  }

  // 1.5 Отрывной календарь: обложку «Пять дней жара» отрывают — под ней «День 1».
  async titleCard() {
    const d = this.d;
    Audio.stopAllLoops(300);
    const def = getDay(1);
    const cover = GameState.mode === 'winter2' ? COVER_W2 : null;
    await calendarCard(this, d, { day: 1, title: def.gameTitle, subtitle: def.subtitle, prev: 'cover', cover, hold: this.skipped ? 1100 : 1700 });
  }

  // «Вторая зима»: без дороги и пурги — год спустя, та же комната. Титр, мама у кровати, календарь.
  async runWinter2() {
    const d = this.d;
    Music.play('mus_night', { fade: 2500, volume: 0.8 });
    this.loop('wind_soft', { volume: 0.25, fade: 1500 });
    const snow = this.add.particles(0, 0, 'fx_snow', {
      x: { min: -40, max: 1960 }, y: -20, lifespan: 9000, speedY: { min: 40, max: 90 }, speedX: { min: -25, max: 10 },
      scale: { min: 0.2, max: 0.7 }, alpha: { start: 0.9, end: 0.2 }, frequency: this.reduced ? 260 : 90, quantity: 1,
    }).setDepth(1);
    const t1 = this.add.text(960, 470, 'Вторая зима', text('heading-7', { color: CSS.paper })).setOrigin(0.5).setAlpha(0).setResolution(2).setDepth(2);
    const t2 = this.add.text(960, 560, 'Год спустя. Снова январь, снова тот же уголок.', text('hand-3', { color: CSS.fogHi })).setOrigin(0.5).setAlpha(0).setResolution(2).setDepth(2);
    await d.wait(500);
    await d.tween({ targets: t1, alpha: 1, duration: 1100 });
    await d.tween({ targets: t2, alpha: 1, duration: 800 });
    await d.wait(2200);
    d.tween({ targets: snow, alpha: 0, duration: 1000 });
    await d.tween({ targets: [t1, t2], alpha: 0, duration: 900 });
    snow.destroy(); t1.destroy(); t2.destroy();
    // спальня: мальчик снова горит, мама у кровати
    const bg = this.add.image(960, 540, 'bedroom_night');
    const lamp = this.add.image(ROOM.nightstand.x + 50, ROOM.nightstand.y - 150, 'fx_glow')
      .setScale(4.5).setTint(0xffb066).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32);
    const mom = this.add.image(PROLOGUE.momAtBedX, ROOM.mom.y, 'mom_stand').setOrigin(0.5, 1);
    const boy = this.add.image(ROOM.bed.x, ROOM.bed.y, 'boy_bed_sick').setOrigin(0.5, 1);
    this.root.add([bg, lamp, mom, boy]);
    this.root.setAlpha(0);
    await d.tween({ targets: this.root, alpha: 1, duration: 1000 });
    await d.wait(300);
    await d.say('M90');
    await d.say('B90');
    await d.say('M91');
    await d.wait(500);
    d.tween({ targets: lamp, alpha: 0, duration: 700 });
    await d.tween({ targets: this.root, alpha: 0, duration: 1100 });
    this.root.removeAll(true);
    this.root.setAlpha(1);
    d.resume();
    this.skipBtn.setVisible(false);
    await this.titleCard();
    if (!this.scene.isActive()) return; // сцену уже остановили (отладочный прыжок по дням)
    this.scene.start('Bedroom', { day: 1 });
  }
}
