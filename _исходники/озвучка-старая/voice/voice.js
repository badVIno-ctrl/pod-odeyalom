/* Плеер заранее озвученных фраз одного голоса.
 * Звук — готовые wav-файлы, синтезированные офлайн-движком VoiceEngine из папки shorts,
 * поэтому страница звучит одинаково в любом браузере и работает без интернета. */
(function () {
  "use strict";

  function build(cfg) {
    document.documentElement.style.setProperty("--accent", cfg.accent);
    document.title = cfg.title + " — озвучка";
    document.getElementById("title").textContent = cfg.title;
    document.getElementById("subtitle").textContent = cfg.subtitle;
    document.getElementById("attrs").textContent = "голос движка: " + cfg.attrs;

    var audio = new Audio();
    var list = document.getElementById("list");
    var current = null;   // кнопка играющей фразы
    var queue = [];       // очередь при «проиграть всё»

    function stop() {
      audio.pause();
      audio.currentTime = 0;
      queue = [];
      if (current) { current.classList.remove("playing"); current.querySelector(".play").textContent = "▶"; }
      current = null;
    }

    function play(btn) {
      if (current === btn && !audio.paused) { stop(); return; }
      if (current) { current.classList.remove("playing"); current.querySelector(".play").textContent = "▶"; }
      current = btn;
      btn.classList.add("playing");
      btn.querySelector(".play").textContent = "■";
      audio.src = btn.dataset.file;
      var started = audio.play();
      if (started && started.catch) {
        started.catch(function (e) {
          // «Стоп» или клик по другой фразе обрывает ещё не начавшееся воспроизведение — это не ошибка.
          if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) { return; }
          console.error("не удалось проиграть", btn.dataset.file, e);
        });
      }
    }

    audio.addEventListener("ended", function () {
      if (current) { current.classList.remove("playing"); current.querySelector(".play").textContent = "▶"; }
      current = null;
      var next = queue.shift();
      if (next) { play(next); }
    });

    cfg.lines.forEach(function (line) {
      var btn = document.createElement("button");
      btn.className = "line";
      btn.type = "button";
      btn.dataset.file = line.file;
      btn.innerHTML = '<span class="play">▶</span>'
        + '<span class="text"></span>'
        + '<span class="dur"></span>';
      btn.querySelector(".text").textContent = line.text;
      if (line.tone) {
        var tone = document.createElement("span");
        tone.className = "tone";
        tone.textContent = "подача: " + line.tone;
        btn.querySelector(".text").appendChild(tone);
      }
      btn.querySelector(".dur").textContent = line.duration.toFixed(1) + " с";
      btn.addEventListener("click", function () { queue = []; play(btn); });
      list.appendChild(btn);
    });

    document.getElementById("all").addEventListener("click", function () {
      stop();
      var items = Array.prototype.slice.call(list.querySelectorAll(".line"));
      queue = items.slice(1);
      play(items[0]);
    });
    document.getElementById("stop").addEventListener("click", stop);
  }

  window.initVoicePage = build;
})();
