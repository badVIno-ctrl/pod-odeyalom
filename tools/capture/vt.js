// Виртуальное время для покадровой съёмки: пока __vt.on, performance.now/Date.now/rAF/setTimeout/setInterval
// живут по виртуальным часам, а кадры двигает только __vt.step(ms). Так анимация снимается ровно 30 к/с
// при любой скорости машины. Звук не снимается (его накладываем отдельно).
(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const realST = window.setTimeout.bind(window); const realCT = window.clearTimeout.bind(window);
  const realSI = window.setInterval.bind(window); const realCI = window.clearInterval.bind(window);
  const realDate = Date.now;
  const VT = { on: false, t: 0, base: 0, dateBase: 0, raf: new Map(), rid: 1e7, timers: new Map(), tid: 1e7, frames: 0 };
  window.__vt = VT;
  performance.now = () => (VT.on ? VT.base + VT.t : realNow());
  Date.now = () => (VT.on ? VT.dateBase + VT.t : realDate());
  window.requestAnimationFrame = (cb) => { if (!VT.on) return realRaf(cb); const id = ++VT.rid; VT.raf.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { if (VT.raf.has(id)) VT.raf.delete(id); else realCaf(id); };
  window.setTimeout = (fn, ms = 0, ...a) => {
    if (!VT.on) return realST(fn, ms, ...a);
    const id = ++VT.tid; VT.timers.set(id, { at: VT.t + Math.max(0, Number(ms) || 0), fn, a }); return id;
  };
  window.clearTimeout = (id) => { if (VT.timers.has(id)) VT.timers.delete(id); else realCT(id); };
  window.setInterval = (fn, ms = 0, ...a) => {
    if (!VT.on) return realSI(fn, ms, ...a);
    const every = Math.max(4, Number(ms) || 0);
    const id = ++VT.tid; VT.timers.set(id, { at: VT.t + every, fn, a, every }); return id;
  };
  window.clearInterval = (id) => { if (VT.timers.has(id)) VT.timers.delete(id); else realCI(id); };
  VT.enable = () => { if (VT.on) return; VT.base = realNow(); VT.dateBase = realDate(); VT.t = 0; VT.on = true; };
  const runTimers = (end) => {
    for (let guard = 0; guard < 5000; guard++) {
      let id = null; let tm = null;
      for (const [k, v] of VT.timers) if (v.at <= end && (!tm || v.at < tm.at)) { id = k; tm = v; }
      if (!tm) return;
      VT.t = Math.max(VT.t, tm.at);
      if (tm.every) tm.at += tm.every; else VT.timers.delete(id);
      try { if (typeof tm.fn === 'function') tm.fn(...tm.a); } catch (e) { console.error('[vt] timer', e); }
    }
  };
  VT.step = (ms) => {
    const end = VT.t + ms;
    runTimers(end);
    VT.t = end;
    const cbs = [...VT.raf.values()]; VT.raf.clear();
    for (const cb of cbs) { try { cb(VT.base + VT.t); } catch (e) { console.error('[vt] raf', e); } }
    VT.frames++;
    return VT.t;
  };
})();
