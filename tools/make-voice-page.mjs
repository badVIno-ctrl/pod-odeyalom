// Генерирует «ПРОСЛУШАТЬ ГОЛОСА.html» из data/dialogue.json: node tools/make-voice-page.mjs
// Оформление как в игре: Literata (текст), Kurale (заголовки), ночной синий фон, строки — как карточки.
import fs from 'fs';
const lines = JSON.parse(fs.readFileSync(new URL('../data/dialogue.json', import.meta.url)));
const COLORS = { 'Мама': '#F2B98A', 'Мальчик': '#A9CCF2', 'Паук': '#E9A45A', 'Врач': '#9FD3C7', 'Фельдшер': '#9FB8FF' };
const GROUPS = [
  ['Мама', (l) => l.speaker === 'Мама'],
  ['Мальчик', (l) => l.speaker === 'Мальчик'],
  ['Паук Тихон', (l) => l.speaker === 'Паук'],
  ['Врач и фельдшеры', (l) => l.speaker === 'Врач' || l.speaker === 'Фельдшер'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const row = (l) => `<div class="row"><span class="id">${l.id}</span><span class="who" style="color:${COLORS[l.speaker] || '#ddd'}">${esc(l.speaker)}</span><span class="text">${esc(l.text)}</span><audio controls preload="none" src="assets/${l.audio}"></audio></div>`;
let body = '';
for (const [title, f] of GROUPS) {
  const list = lines.filter(f);
  body += `<section><h2>${title} <span class="count">${list.length}</span></h2>${list.map(row).join('\n')}</section>`;
}
body += `<section><h2>Звуки паука</h2><div class="row"><span class="id">sfx</span><span class="who" style="color:#E58A4E">Паук</span><span class="text">Смешок паука (spider_laugh)</span><audio controls preload="none" src="assets/audio/sfx/spider_laugh.mp3"></audio></div></section>`;
const CYR = 'unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;';
const face = (fam, file, w, sub) => `@font-face{font-family:${fam};font-style:normal;font-weight:${w};font-display:swap;src:url(assets/fonts/${file}-${sub}-${w}-normal.woff2) format('woff2');${sub === 'cyrillic' ? CYR : ''}}`;
const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Под одеялом: прослушать голоса</title>
<style>
${face('Literata', 'literata', 400, 'latin')}${face('Literata', 'literata', 400, 'cyrillic')}${face('Literata', 'literata', 600, 'latin')}${face('Literata', 'literata', 600, 'cyrillic')}${face('Kurale', 'kurale', 400, 'latin')}${face('Kurale', 'kurale', 400, 'cyrillic')}
*{box-sizing:border-box}
body{background:#141a33 radial-gradient(ellipse at 50% 0,#26305a 0,#141a33 60%) fixed;color:#F3EBDD;font-family:Literata,Georgia,serif;font-size:16px;line-height:24px;font-weight:400;margin:0;padding:48px}
main{max-width:1200px;margin:0 auto}
h1{font-family:Kurale,Georgia,serif;font-size:52px;line-height:60px;font-weight:400;margin:0 0 16px;background:linear-gradient(180deg,#FFF1D6,#E9A45A);-webkit-background-clip:text;background-clip:text;color:transparent}
p{color:#B9B3C8;margin:0 0 32px;max-width:880px}
code{font-family:Literata,Georgia,serif;font-weight:600;color:#F3D9AE}
section{margin:0 0 32px}
h2{font-family:Kurale,Georgia,serif;font-size:26px;line-height:32px;font-weight:400;margin:0 0 12px;color:#F2B766}
.count{color:#8E93B3;font-family:Literata,Georgia,serif;font-size:16px;margin-left:8px}
.row{display:grid;grid-template-columns:64px 112px 1fr 320px;gap:16px;align-items:center;padding:12px 16px;margin:0 0 8px;background:#1d2643;border:1px solid #2f3b6b;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:background-color 300ms cubic-bezier(0.22,1,0.36,1),transform 300ms cubic-bezier(0.22,1,0.36,1)}
.row:hover{background:#24305a;transform:translateY(-1px)}
.id{color:#8E93B3;font-weight:600;font-size:14px;line-height:20px}
.who{font-weight:600;font-size:14px;line-height:20px}
audio{width:320px;height:32px}
@media (max-width:900px){body{padding:24px}.row{grid-template-columns:56px 1fr}.row .text{grid-column:1 / -1}.row audio{grid-column:1 / -1;width:100%}}
</style></head><body><main>
<h1>Прослушать голоса</h1>
<p>Все ${lines.length} реплик игры. Файлы лежат в <code>assets/audio/voice/ID.mp3</code>, тексты субтитров в <code>data/dialogue.json</code>.
Чтобы заменить реплику, положите свой mp3 с тем же именем. Если не нравится ударение или интонация, запишите ID: реплику можно переозвучить отдельно,
инструкция в <code>_исходники/голоса/README.md</code>.</p>
${body}
</main></body></html>
`;
fs.writeFileSync(new URL('../ПРОСЛУШАТЬ ГОЛОСА.html', import.meta.url), html);
console.log('ok', lines.length);
