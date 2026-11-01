// Дневник между забегами (localStorage): сколько раз пройдена игра, последний финал,
// открытые секреты (по одному за каждую реплику-выбор) и увиденные финалы.
const KEY = 'pod-odeyalom:journal';

export const SECRETS = [
  { id: 'ogonek', day: 1, title: 'Огонёк за окном', text: 'Огнёвка смотрит на тех, кто горит. Тихон просит на неё не смотреть.' },
  { id: 'strashny', day: 1, title: 'Страшный, но не злой', text: 'Тихон не обиделся. Он вообще обижается редко, только на сквозняки.' },
  { id: 'anya', day: 2, title: 'Мама жульничала', text: 'Маленькая Аня ставила два крестика за раз. Тихон делал вид, что не замечает.' },
  { id: 'domovoy', day: 2, title: 'Домовой паук', text: 'Домовые пауки живут, пока в доме топят печь и рассказывают сказки.' },
  { id: 'nit', day: 3, title: 'Честная нить', text: 'Нить из жалости не держит. Поэтому Тихон никогда не поддаётся.' },
  { id: 'hitrost', day: 3, title: 'Смех паука', text: 'Тихон смеётся, чтобы Огнёвка думала, будто он на её стороне.' },
  { id: 'strah', day: 4, title: 'Тихон тоже боится', text: 'Огнёвка жжёт паутину, и Тихону страшно. Но бояться ещё не значит бросить друга.' },
  { id: 'babochka', day: 4, title: 'Белая бабочка', text: 'Пойманная Огнёвка остывает и становится обычной белой бабочкой.' },
  { id: 'spasibo', day: 5, title: 'Спасибо потом', text: 'Спасибо Тихон просит сказать потом, когда она попадётся.' },
  { id: 'tkachi', day: 5, title: 'Врачи тоже ткачи', text: 'Если нитей не хватит, помогут врачи. Нитки у них просто другие.' },
];

// Секреты «Второй зимы» — отдельная страница дневника (закладка «II»); для тайной главы «Аня» не нужны.
export const SECRETS_W2 = [
  { id: 'rosa', day: 1, title: 'Роса, а не слёзы', text: 'Тихон скучал целый год. Пауки не плачут, говорит он. Это была роса.' },
  { id: 'ugol', day: 1, title: 'Тёплый угол', text: 'Пауки уходят, только когда дом пустеет. Этот дом не пустеет.' },
  { id: 'flagman', day: 2, title: 'Флагман «Тихон»', text: 'Главный корабль мальчика назван в честь паука. Тихон делает вид, что ему всё равно.' },
  { id: 'mina', day: 2, title: 'Бумажные мины', text: 'Самое страшное на бумажной мине — пропустить ход. Иногда надо просто переждать.' },
  { id: 'tishe', day: 3, title: 'Тише едешь', text: 'За год Тихон прополз вокруг окна четыре раза. Тише едешь — дальше будешь.' },
  { id: 'umnee', day: 3, title: 'Терпение пауков', text: 'Пауки не умнее людей. Они просто терпеливее.' },
  { id: 'vsegda', day: 4, title: 'Пока видишь', text: 'Тихон живёт в уголке, пока его видят.' },
  { id: 'zhar', day: 4, title: 'Мотылёк на лампу', text: 'Огнёвка прилетает на жар. Выздоровеешь, и ей тут нечего делать.' },
  { id: 'chestno', day: 5, title: 'Нитка не врёт', text: 'Нечестная нитка сразу путается. Поэтому Тихон и честный.' },
  { id: 'putanitsa', day: 5, title: 'Путаница поддавков', text: 'В поддавках проиграть — значит выиграть. Тихон сам запутался.' },
];
export const secretById = (id) => SECRETS.find((s) => s.id === id) || SECRETS_W2.find((s) => s.id === id) || null;

export const ENDINGS = [
  { id: 'dawn', group: 'recovered', title: 'Рассвет', text: 'Жар отступил, Огнёвка поймана, мама рядом.' },
  { id: 'tikhon', group: 'recovered', title: 'Тихон', text: 'Мама вспомнила паука из своего детства. Значит, не приснилось.' },
  { id: 'ambulance', group: 'hospital', title: 'Скорая', text: 'Врачи увезли мальчика в больницу, мама поехала с ним.' },
  { id: 'companion', group: 'hospital', title: 'Попутчик', text: 'Тихон поймал Огнёвку на крыше скорой и поехал следом.' },
];

// drawings — альбом: рисунки мальчика из всех забегов (последние ALBUM_MAX), letters — письма Тихона
const ALBUM_MAX = 24;
const blank = () => ({ runs: 0, runsW2: 0, lastEnding: null, secrets: [], endings: [], drawings: [], letters: [], anyaSeen: false });

function read() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
    if (!raw) return blank();
    const j = JSON.parse(raw);
    return {
      ...blank(), ...j, secrets: [...new Set(j.secrets || [])], endings: [...new Set(j.endings || [])],
      drawings: Array.isArray(j.drawings) ? j.drawings.slice(-ALBUM_MAX) : [], letters: Array.isArray(j.letters) ? j.letters.slice(-8) : [],
    };
  } catch { return blank(); }
}

export const Journal = {
  data: read(),

  save() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* приватный режим */ }
  },

  reload() { this.data = read(); return this.data; },

  // Секрет открыт впервые → true.
  unlock(id) {
    if (!secretById(id) || this.data.secrets.includes(id)) return false;
    this.data.secrets.push(id); this.save();
    return true;
  },

  // Финал увиден: считается один раз за забег (вызывать после GameState.finish()).
  recordEnding(id, mode = 'main') {
    const e = ENDINGS.find((x) => x.id === id);
    if (!e) return false;
    const fresh = !this.data.endings.includes(id);
    if (fresh) this.data.endings.push(id);
    this.data.runs += 1;
    if (mode === 'winter2') this.data.runsW2 = (this.data.runsW2 || 0) + 1;
    this.data.lastEnding = id;
    this.save();
    return fresh;
  },

  // Рисунок в альбом (спецификация, см. systems/drawings.js).
  addDrawing(spec) {
    this.data.drawings.push({ ...spec, run: this.data.runs + 1 });
    if (this.data.drawings.length > ALBUM_MAX) this.data.drawings.splice(0, this.data.drawings.length - ALBUM_MAX);
    this.save();
  },

  // Письмо Тихона из финала (текст целиком, чтобы перечитать в меню).
  addLetter(letter) {
    this.data.letters.push(letter);
    if (this.data.letters.length > 8) this.data.letters.splice(0, this.data.letters.length - 8);
    this.save();
  },

  lastGroup() {
    const e = ENDINGS.find((x) => x.id === this.data.lastEnding);
    return e ? e.group : null;
  },

  counts() {
    const has = (list) => list.filter((s) => this.data.secrets.includes(s.id)).length;
    return {
      secrets: has(SECRETS), secretsTotal: SECRETS.length, secretsW2: has(SECRETS_W2), secretsW2Total: SECRETS_W2.length,
      endings: this.data.endings.length, endingsTotal: ENDINGS.length, runs: this.data.runs, runsW2: this.data.runsW2 || 0,
    };
  },

  hasSecret(id) { return this.data.secrets.includes(id); },

  // «Вторая зима» — когда увиден хотя бы один финал выздоровления и хотя бы один больничный.
  winter2Unlocked() {
    const g = new Set(this.data.endings.map((id) => (ENDINGS.find((e) => e.id === id) || {}).group));
    return g.has('recovered') && g.has('hospital');
  },
  hasEnding(id) { return this.data.endings.includes(id); },

  // Тайная глава «Аня» — когда открыты все секреты. anyaSeen — глава уже прочитана (галочка в меню).
  anyaUnlocked() { return SECRETS.every((s) => this.data.secrets.includes(s.id)); },
  markAnya() { this.data.anyaSeen = true; this.save(); },

  // только для отладки и тестов
  clear() { this.data = blank(); this.save(); },
};
