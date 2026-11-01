// Подписка на кадр сцены, которая снимается при остановке сцены.
// Phaser не очищает scene.events при shutdown: без отписки после повторного запуска сцены
// старые обработчики продолжают работать с уничтоженными объектами (и могут остановить кадр ошибкой).
export function onUpdate(scene, fn, ctx) {
  scene.events.on('update', fn, ctx);
  scene.events.once('shutdown', () => scene.events.off('update', fn, ctx));
}
