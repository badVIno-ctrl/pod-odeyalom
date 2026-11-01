# itch.io: всё для страницы игры

| Что | Где |
|---|---|
| Тексты страницы, теги, настройки | `страница-ru.md`, `page-en.md` |
| Обложка (Cover image) | `обложка/cover-630x500-ru.png` (и `-en`), крупная — `cover-1260x1000-*.png` |
| Скриншоты 1920×1080 | `скриншоты/ru/`, `скриншоты/en/` |
| GIF для описания | `gif/` |
| План трейлера | `трейлер-план.md` |

## Загрузка — по шагам

1. Соберите архив: дважды щёлкните **`СОБРАТЬ ДЛЯ ITCH.bat`** → `pyat-dney-zhara-itch.zip`.
2. itch.io → *Upload new project*.
   - *Title* — «Под одеялом» (или «Under the Blanket»), *Project URL* — например `pod-odeyalom`.
   - *Short description* — из `страница-ru.md`.
   - *Classification* — **Games**, *Kind of project* — **HTML**.
   - *Release status* — Released (или In development, пока голоса временные).
   - *Pricing* — **No payments** или *Donations*. Продавать нельзя, пока голоса Silero (CC BY-NC-SA).
3. *Uploads* — загрузите zip, отметьте **This file will be played in the browser**.
4. *Embed options*:
   - *Viewport dimensions* — **1280 × 720**;
   - ✅ *Mobile friendly*, ориентация **Landscape**;
   - ✅ *Fullscreen button*;
   - ❌ *Automatically start on page load* (звуку всё равно нужен первый клик);
   - ❌ *Enable scrollbars*, ❌ *SharedArrayBuffer support* — не нужны.
5. *Details*: описание — из `страница-ru.md` (Markdown вставляется как есть), *Genre* — Interactive Fiction,
   *Tags* — из того же файла, *Cover image* — `обложка/cover-630x500-ru.png`, *Screenshots* — 5–8 штук
   из `скриншоты/ru/` (первыми — 05, 08, 06, 10, 12).
6. *Visibility* — сначала **Draft**: откройте страницу, проверьте игру во встроенном окне и на телефоне,
   потом *Public*.
7. Для английской страницы (или второго языка в описании) — `page-en.md`, `скриншоты/en/`, `cover-*-en.png`.
   Ссылка на английскую версию сразу: `…/index.html?lang=en` — или кнопка «English» в меню.

## Оформление страницы (Edit theme)

Фон `#141a2e`, фон блока `#1f2740`, текст `#efe6d2`, ссылки и кнопки `#e09a3e`. Шрифт заголовков — любой
с засечками (Georgia). Так страница совпадает с меню игры.

## Как пересъёмить скриншоты

Скриншоты сняты самой игрой в WebGL, 1920×1080, в «виртуальном времени» (кадр в кадр, без пропусков):

```
cd tools/capture
VW=1920 VH=1080 node capture.mjs ../../docs/itch/_снимки ./shots-stills.mjs "debug=1&lang=ru"
```

Нужны Node.js, ffmpeg (`ffprobe` меряет реплики), Playwright с Chromium
(`npm i --no-save playwright && npx playwright install chromium`) и запущенная сборка
(`npm run build`, затем `npm run preview` — порт 4173, другой — `PORT=…`). Подробнее — в шапке
`tools/capture/capture.mjs`.
