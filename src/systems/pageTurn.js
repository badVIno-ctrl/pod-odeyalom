// Переход «перелистнуть страницу»: снимок текущего кадра → TurnScene поверх → новая сцена под ним.
// back: 'paper' (тетрадный лист) | 'night' (картон обложки). Пока идёт переход, новые сцены не
// делают своё затемнение-проявление (PageTurn.active).
export const PageTurn = {
  active: false,

  go(scene, key, data = {}, { back = 'paper', ms = 1250 } = {}) {
    const game = scene.game;
    return new Promise((resolve) => {
      const start = (img) => {
        const tex = game.textures;
        if (tex.exists('turn_snap')) tex.remove('turn_snap');
        if (img) tex.addImage('turn_snap', img);
        if (!img) { this.active = false; scene.scene.start(key, data); resolve(); return; }
        this.active = true;
        const sm = game.scene;
        sm.run('Turn', { snap: 'turn_snap', back, ms, waitFor: key, onDone: () => { this.active = false; resolve(); } });
        sm.bringToTop('Turn');
        if (sm.getScene('Overlay')) sm.bringToTop('Overlay');
        scene.scene.start(key, data);
      };
      try {
        game.renderer.snapshot((img) => start(img instanceof HTMLImageElement ? img : null));
      } catch (e) { console.warn('turn', e); start(null); }
    });
  },
};
