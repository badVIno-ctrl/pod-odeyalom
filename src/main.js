// Точка входа: шрифты → Phaser 4 (1920×1080, Scale.FIT по центру) → сцены.
// Шрифты (см. config/theme.js): Kurale — заголовки и кнопки, Literata — текст, Neucha — записки от руки,
// Caveat — рукописные буквы внутри мира. Подключены только кириллица и латиница.
import '@fontsource/kurale/cyrillic-400.css';
import '@fontsource/kurale/latin-400.css';
import '@fontsource/literata/cyrillic-400.css';
import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/cyrillic-500.css';
import '@fontsource/literata/latin-500.css';
import '@fontsource/literata/cyrillic-600.css';
import '@fontsource/literata/latin-600.css';
import '@fontsource/literata/cyrillic-700.css';
import '@fontsource/literata/latin-700.css';
import '@fontsource/neucha/cyrillic-400.css';
import '@fontsource/neucha/latin-400.css';
import '@fontsource/caveat/700.css';
import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, isDebug } from './config/game.js';
import { COLORS } from './config/theme.js';
import { GameState } from './state.js';
import { Debug } from './systems/debug.js';
import { Audio } from './systems/audio.js';
import { Assets } from './systems/assets.js';
import { voice } from './systems/voice.js';
import { BootScene } from './scenes/BootScene.js';
import { OverlayScene } from './scenes/OverlayScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { PrologueScene } from './scenes/PrologueScene.js';
import { BedroomScene } from './scenes/BedroomScene.js';
import { TicTacToeScene } from './scenes/TicTacToeScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { LabScene } from './scenes/LabScene.js';
import { PovScene } from './scenes/PovScene.js';
import { SeaBattleScene } from './scenes/games/SeaBattleScene.js';
import { HangmanScene } from './scenes/games/HangmanScene.js';
import { DotsScene } from './scenes/games/DotsScene.js';
import { CheckersScene } from './scenes/games/CheckersScene.js';
import { GomokuScene } from './scenes/games/GomokuScene.js';
import { Quality } from './systems/quality.js';
import { AlbumScene } from './scenes/AlbumScene.js';
import { TurnScene } from './scenes/TurnScene.js';
import { CreditsScene } from './scenes/CreditsScene.js';
import { AnyaScene } from './scenes/AnyaScene.js';
import { I18n, installTextHook } from './i18n/index.js';
import { Offline } from './systems/offline.js';

const SAMPLE = 'Пять дней жара 0123456789 «Играть» Ты : Паук°';

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const faces = ['400 32px Kurale', '400 32px Literata', '500 32px Literata', '600 32px Literata', '700 32px Literata', '400 32px Neucha', '700 32px Caveat'];
  const timeout = new Promise((r) => setTimeout(r, 4000));
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, SAMPLE).catch(() => null))), timeout]);
}

// Сцены, которые можно останавливать при отладочном прыжке по дням (Overlay живёт всегда).
const GAMEPLAY_SCENES = ['Menu', 'Prologue', 'Bedroom', 'TicTacToe', 'SeaBattle', 'Hangman', 'Dots', 'Checkers', 'Gomoku', 'Pov', 'Ending', 'Lab', 'Album', 'Turn', 'Credits', 'Anya'];

function jumpToDay(game, n) {
  const sm = game.scene;
  if (!sm.isActive('Overlay')) return; // ещё идёт загрузка
  for (const key of GAMEPLAY_SCENES) if (sm.isActive(key) || sm.isPaused(key) || sm.isSleeping(key)) sm.stop(key);
  GameState.jumpToDay(n);
  sm.start('Bedroom', { day: GameState.day });
  console.info(`[debug] переход к дню ${GameState.day}`);
}

async function start() {
  installTextHook(Phaser);
  try { document.documentElement.lang = I18n.lang; } catch { /* */ }
  await loadFonts();
  const note = document.getElementById('boot-note');
  if (note) note.remove();
  const game = new Phaser.Game({
    // ?renderer=canvas — запасной Canvas-рендер (для отладки и браузеров без WebGL).
    type: new URLSearchParams(window.location.search).get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: COLORS.ink,
    banner: false,
    audio: { noAudio: true }, // весь звук — через Howler
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // maxTextures: 1 — один текстурный юнит на батч. На программном GL (SwiftShader) и части мобильных GPU
    // мульти-текстурный батч Phaser 4 «выкусывал» треугольники из спрайтов; FPS при этом не меняется.
    // ?mt=N — переопределить для диагностики (-1 = все юниты).
    render: { antialias: true, roundPixels: false, maxTextures: Number(new URLSearchParams(window.location.search).get('mt')) || 1 },
    scene: [BootScene, OverlayScene, MenuScene, PrologueScene, BedroomScene, TicTacToeScene, SeaBattleScene, HangmanScene, DotsScene, CheckersScene, GomokuScene, PovScene, EndingScene, LabScene, AlbumScene, TurnScene, CreditsScene, AnyaScene],
  });
  Quality.init(game);
  // ?debug=1&speed=N — ускорить таймеры и твины (для автотестов на медленных машинах).
  const speed = Number(new URLSearchParams(window.location.search).get('speed')) || 1;
  if (speed !== 1 && isDebug()) {
    game.events.once('ready', () => game.scene.scenes.forEach((sc) => sc.events.on('create', () => {
      sc.time.timeScale = speed; sc.tweens.timeScale = speed;
    })));
  }
  Debug.init((n) => jumpToDay(game, n));
  Offline.init(game);
  // Первый клик или клавиша разблокирует звук (политика автозапуска браузеров).
  const unlock = () => Audio.unlock();
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  // Игра на паузе, пока вкладка скрыта (так делает Phaser), — звук тоже.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { voice.pause(); Audio.suspend(); } else { Audio.resume(); voice.resume(); }
  });
  // Для автотестов и отладки из консоли браузера.
  window.__game = game;
  window.__state = GameState;
  window.__assets = Assets;
  window.__voice = voice;
  window.__audio = Audio;
  window.__quality = Quality;
}

start();
