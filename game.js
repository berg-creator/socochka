// Карыч: Доставка — мини-игра раздела 🧻 (index.html грузит этот файл только по кнопке «🎮»).
// Мир в 3D: three.js с CDN подгружается вместе с игрой. Три полосы (−1, 0, 1), Карыч всегда стоит в z = 0, дорога едет навстречу:
// e.at — место предмета на дороге в метрах, z = at − dist — сколько до него впереди (в сцене это −z). HUD и экраны — 2D/HTML поверх.
// Черты Карыча: разносит письма (тап — бросок в ящик), вечно спит (шкала 😪, кровать 🛏️),
// срывает спину (частые наклоны → прострел), бросил курить (обходишь 🚬 — растёт множитель). Гонятся: бабушка, Жёлтый Король, Димон.
// Первый забег — обучение прямо в игре: перед препятствием время замирает, пока не сделаешь нужный жест
(() => {
const LIB = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
let lib, busy;
window.karych = api => {
  if (busy) return; busy = true;
  (lib ||= import(LIB)).then(T => { busy = false; game(T, api); }, () => { lib = busy = null; alert('Игра не загрузилась — проверь интернет'); });
};

const FAR = 60, LANES = [-1, 0, 1], JUMP = .75, BED = 7;
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const load = k => { try { return localStorage[k] || ''; } catch { return ''; } };
const save = (k, v) => { try { localStorage[k] = v; } catch {} };
const buzz = ms => navigator.vibrate?.(ms);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ITEMS = {bag: '📨', roll: '🧻', pillow: '🛏️', cig: '🚬', lolly: '🍭'};
// преследователи: mult — множитель очков (кто сложнее, тот дороже), back — как быстро отстаёт, пока бежишь чисто
const CHASERS = {
  baba: {face: '👵', name: 'Бабушка', got: 'Бабушка догнала!', mult: 1, back: .02, note: 'кидает тапок'},
  king: {face: '🤴', name: 'Жёлтый Король', got: 'Жёлтый Король догнал!', mult: 1.5, back: .03, note: 'ставит барьеры'},
  dimon: {face: '👴', name: 'Димон', got: 'Димон догнал!', mult: 2, back: .03, note: 'звереет от ударов'},
};
const touch = matchMedia('(pointer: coarse)').matches;
// обучение: что поставить на дорогу и какой жест ждать
const TUT = [
  {k: 'wall', need: 'move', g: 'lr', s: touch ? 'Свайп влево или вправо — обеги барьер' : 'Стрелка ← или → — обеги барьер'},
  {k: 'low', need: 'up', g: 'up', s: touch ? 'Свайп вверх — перепрыгни коробки' : 'Стрелка ↑ — перепрыгни коробки'},
  {k: 'line', need: 'down', g: 'down', s: touch ? 'Свайп вниз — пригнись под бельём' : 'Стрелка ↓ — пригнись под бельём'},
  {k: 'box', need: 'toss', g: 'tap', s: touch ? 'Тап по экрану — брось письмо в ящик' : 'Пробел — брось письмо в ящик'},
];

// звуки синтезируем на лету — без файлов
let ac, muted = load('karychMute') === '1';
function tone(f, d, type = 'sine', vol = .1, f2, delay = 0) {
  if (muted) return;
  try {
    ac ||= new AudioContext(); if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, n); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + d);
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(.0008, n + d);
    o.connect(g).connect(ac.destination); o.start(n); o.stop(n + d + .02);
  } catch {}
}
const sfx = {
  move: () => tone(520, .07, 'triangle', .05, 760), jump: () => tone(260, .2, 'square', .045, 620), duck: () => tone(240, .14, 'triangle', .07, 130),
  toss: () => tone(1100, .12, 'sine', .04, 500), land: () => tone(120, .08, 'triangle', .08, 70),
  mail: big => { tone(880, .12, 'triangle', .09); tone(1320, .18, 'triangle', .08, 0, .07); if (big) tone(1760, .25, 'triangle', .07, 0, .15); },
  pick: () => { tone(660, .1, 'sine', .08, 990); tone(990, .14, 'sine', .06, 1480, .06); },
  bad: () => tone(300, .3, 'sawtooth', .05, 160), hit: () => { tone(150, .32, 'sawtooth', .12, 45); tone(90, .2, 'square', .08, 40); },
  bed: () => { tone(392, .4, 'sine', .07); tone(523, .5, 'sine', .06, 0, .15); tone(659, .6, 'sine', .05, 0, .3); },
  rec: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .08, 0, i * .09)),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, .3, 'triangle', .09, 0, i * .16)),
  ok: () => { tone(660, .1, 'triangle', .07); tone(990, .16, 'triangle', .07, 0, .08); },
};

function game(T, {paper, boss, me, week, submit}) {
  const gl = document.createElement('canvas');
  let R;
  try { R = new T.WebGLRenderer({canvas: gl, antialias: true, powerPreference: 'high-performance'}); } catch { return alert('Игре нужен WebGL — обнови браузер'); }

  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#f2c4a0;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:none;font:15px/1.4 system-ui,sans-serif';
  root.innerHTML = `<style>
      .kr-p{position:absolute;left:12px;right:12px;margin:auto;max-width:400px;max-height:calc(100% - 24px);overflow:auto;color:#1d1d1f}
      .kr-p button{font:inherit;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s}
      .kr-p button:active{transform:scale(.96)}
      .kr-sheet{bottom:16px;padding:16px;border-radius:24px;background:#fffbf3f2;box-shadow:0 12px 40px #3a1d0a55}
      .kr-card{top:50%;transform:translateY(-50%);padding:20px;border-radius:24px;background:#fffbf3f5;box-shadow:0 12px 40px #3a1d0a66;text-align:center}
      .kr-who{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .kr-who button{position:relative;padding:12px 4px 10px;border-radius:18px;background:#fff;box-shadow:0 2px 0 #e3d6bf,0 4px 14px #0000000f;display:grid;gap:2px;justify-items:center}
      .kr-who button.on{box-shadow:0 0 0 3px #f5a524,0 4px 14px #f5a52455}
      .kr-who b{font-size:40px;line-height:1.1}.kr-who span{font-weight:700;font-size:13px;line-height:1.15}.kr-who i{font-style:normal;font-size:11.5px;color:#7a6f63;line-height:1.2}
      .kr-who em{position:absolute;top:6px;right:6px;font-style:normal;font-size:11px;font-weight:700;background:#f5a524;color:#fff;border-radius:8px;padding:1px 5px}
      .kr-big{width:100%;padding:15px;border-radius:16px;background:linear-gradient(#ffb93a,#f08c0c);color:#fff;font-weight:800!important;font-size:18px!important;box-shadow:0 4px 0 #c46a00,0 8px 20px #f08c0c55}
      .kr-sec{width:100%;padding:12px;border-radius:14px;background:#efe7d8;color:#1d1d1f;font-weight:600}
      .kr-link{background:none!important;color:#8a6d4a;font-weight:600;padding:8px}
    </style>
    <canvas data-hud style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
    <div data-logo style="position:absolute;left:0;right:0;top:7%;text-align:center;color:#fff;pointer-events:none;text-shadow:0 3px 0 #b8562a,0 6px 24px #7a2e1088">
      <div style="font:900 48px/1 system-ui,sans-serif;letter-spacing:-1px">Карыч</div>
      <div style="font:800 17px/1.6 system-ui,sans-serif;letter-spacing:6px;text-transform:uppercase">доставка</div></div>
    <button data-snd aria-label="Звук" style="position:absolute;top:10px;right:58px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0005;color:#fff;font-size:17px"></button>
    <button data-x aria-label="Закрыть" style="position:absolute;top:10px;right:10px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0005;color:#fff;font-size:18px">✕</button>
    <div data-panel class="kr-p"></div>`;
  root.prepend(gl); gl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  document.body.append(root);
  const cv = root.querySelector('[data-hud]'), cx = cv.getContext('2d'), panel = root.querySelector('[data-panel]'), logo = root.querySelector('[data-logo]'), snd = root.querySelector('[data-snd]');
  const was = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const sndIcon = () => { snd.textContent = muted ? '🔇' : '🔊'; };
  sndIcon();
  snd.onclick = () => { muted = !muted; save('karychMute', muted ? '1' : ''); sndIcon(); };

  // качество подстраивается под телефон: не тянет 50 кадров/с — меньше пикселей, потом без теней
  const DPR = [2, 1.5, 1, 1];
  let W, H, q = 0, fr = 0, ft = 0;
  const cam = new T.PerspectiveCamera(60, 1, .1, 400);
  const fit = () => {
    const r = devicePixelRatio || 1; W = root.clientWidth; H = root.clientHeight;
    cv.width = W * r; cv.height = H * r; cx.setTransform(r, 0, 0, r, 0, 0);
    R.setPixelRatio(Math.min(r, DPR[q])); R.setSize(W, H, false); cam.aspect = W / H;
  };
  fit();

  let st = 'intro', paused = false, best = +load('karychBest') || 0, last = 0, raf;
  let who = CHASERS[load('karychWho')] ? load('karychWho') : 'baba', CH = CHASERS[who];
  let t, dist, ents, nextRow, nextBox, lane, px, gx, jump, duck, sleep, doze, bed, beds, letters, rolls, pts, sent, gap, slow, cont, toasts, flies, queue;
  let back, cramp, streak, smokeAt, slip, slipT, kingT, rage, calm, shake, hurt, sparks;
  let tut = -1, tutE, tutOk, hint, slo = 1, recT, land = 0, seen = load('karychSeen'), learn = false;
  function reset() {
    t = dist = jump = duck = sleep = doze = bed = beds = rolls = pts = sent = slow = back = cramp = streak = smokeAt = rage = calm = 0;
    ents = []; toasts = []; flies = []; queue = []; nextRow = 28; nextBox = 14; lane = px = gx = 0;
    shake = hurt = 0; sparks = [];
    letters = 8; gap = .55; slip = null; slipT = 12; kingT = 15; cont = false;
    tut = learn || !load('karychTut') ? 0 : -1; tutE = null; hint = null; slo = 1; recT = false;
    if (tut === 0) gap = 1;
  }
  const mult = () => Math.min(5, 1 + Math.floor(streak / 2)); // «Держусь»: каждые две обойдённые сигареты — +1
  const score = () => Math.max(0, Math.floor((dist / 2 + pts) * CH.mult));
  const toast = s => toasts.push({s, t: 1.3});
  const jy = () => bed > 0 ? .7 : jump > 0 ? Math.sin(Math.PI * (1 - jump / JUMP)) * 1.3 : 0;
  const mine = () => Math.round(px);
  // сделан жест, которого ждёт обучение
  const did = k => { if (tut >= 0 && hint && TUT[tut].need === k) { tutOk = true; hint = null; slo = 1; } };

  // дорога впереди: ряд препятствий через каждые 7–11 м, хотя бы одна полоса свободна — на ней и лежат предметы
  // (сигарета на свободной полосе — соблазн: её надо перепрыгнуть или уйти в сторону); ящики — отдельно, по обочинам
  function spawn() {
    if (tut >= 0) return; // в обучении дорогу заполняет teach()
    while (nextRow < dist + FAR) {
      const calm = t < 20, free = [...LANES].sort(() => Math.random() - .5);
      if (Math.random() < (calm ? .55 : .8))
        for (const l of free.splice(0, !calm && Math.random() < .45 ? 2 : 1)) ents.push({k: pick(['wall', 'low', 'low', 'line', 'line']), lane: l, at: nextRow});
      if (Math.random() < .35) { const r = Math.random(); ents.push({k: r < .35 ? 'bag' : r < .52 ? 'roll' : r < .64 ? 'pillow' : r < .88 ? 'cig' : 'lolly', lane: free[0], at: nextRow}); }
      nextRow += rnd(7, 11) * (calm ? 1.4 : 1);
    }
    while (nextBox < dist + FAR) { ents.push({k: 'box', side: pick([-1, 1]), reg: Math.random() < .15, at: nextBox}); nextBox += rnd(9, 16); }
  }

  // докуда долетит письмо: со своей стороны — 16 м, с середины — 8, с дальней полосы — никак. Заказное 📮 — окно вдвое короче
  const reach = (e, l) => { const z = e.at - dist, far = l === e.side ? 16 : l === 0 ? 8 : 0; return !e.done && z > .8 && z < far * (e.reg ? .5 : 1); };
  function throwAt(box) {
    letters--;
    if (box) box.done = true;
    flies.push({x: px, y: jy(), box, t: 0, dir: box ? box.side : lane || pick([-1, 1])});
    sfx.toss();
  }
  function toss() {
    if (bed > 0) return;
    if (!letters) return toast('Письма кончились — лови 📨');
    const box = ents.filter(e => e.k === 'box' && reach(e, mine())).sort((a, b) => a.at - b.at)[0];
    if (tut >= 0 && !box) return; // в обучении мимо не кидаем
    if (box) did('toss');
    throwAt(box);
  }
  function rest() {
    if (!beds || bed > 0) return;
    beds--; bed = BED; doze = jump = duck = cramp = 0; sleep = 0; toast('🛏️ Хр-р-р…'); sfx.bed();
    if (hint?.g === 'bed') hint = null;
  }
  const move = d => { const l = Math.max(-1, Math.min(1, lane + d)); if (l !== lane) { lane = l; sfx.move(); did('move'); } };
  const up = () => { if (bed <= 0 && cramp <= 0 && jump <= 0) { jump = JUMP; duck = 0; sfx.jump(); did('up'); } };
  // наклон грузит спину: 3–4 подряд — прострел
  function down() {
    if (bed > 0 || cramp > 0) return;
    jump = 0; duck = .6; sfx.duck(); did('down');
    if ((back += .3) >= 1) { back = 0; cramp = 3; duck = 0; buzz(150); sfx.bad(); toast('🦴 Прострел! Не нагнуться'); }
  }
  // уснул на ходу — руки слушаются с опозданием
  const act = f => doze > 0 ? queue.push([t + .35, f]) : f();

  function hit(n, msg) {
    if (bed > 0 || st !== 'run') return;
    slow = .8; shake = .35; hurt = .5; buzz(60); sfx.hit();
    if (tut >= 0) return toast('Ой! Ещё разок');
    if (who === 'dimon') { n *= 1 + rage * .25; if (rage < 3) { rage++; msg += ' Димон звереет 😡'; } calm = 0; }
    gap -= n; toast(msg);
    if (doze > 0) { doze = 0; sleep = .35; }
    if (gap <= 0) over();
  }
  // искры — в координатах дороги (x, высота y, at), летят и падают
  const burst = (x, y, at, c, n = 16) => { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = rnd(1.5, 4); sparks.push({x, y, at, vx: Math.cos(a) * v, vy: rnd(2, 5.5), va: Math.sin(a) * v, r: rnd(.6, 1.4), l: 1, c}); } };
  function take(e) {
    e.gone = true; burst(e.lane, .5, e.at, e.k === 'cig' ? '#ff7a5a' : '#ffe08a');
    e.k === 'cig' ? sfx.bad() : sfx.pick();
    if (e.k === 'bag') { letters = Math.min(15, letters + 5); toast('📨 +5 писем'); }
    if (e.k === 'roll') { rolls++; toast('🧻 рулон'); }
    if (e.k === 'pillow') { beds = Math.min(2, beds + 1); toast('🛏️ кровать — жми кнопку'); }
    if (e.k === 'lolly') { sleep = Math.max(0, sleep - .35); toast('🍭 Полегчало'); }
    if (e.k === 'cig') { sleep = 0; gap = Math.min(1, gap + .15); toast(streak > 1 ? '🚬 Сорвался… множитель ×1' : '🚬 Затянулся… бодрит, но не гордись'); streak = 0; smokeAt = dist; }
  }
  function avoid() { const m = mult(); streak++; if (mult() > m) { toast(`🚭 Держусь ×${mult()}`); sfx.ok(); } }

  // обучение: по одному препятствию; близко к нему время замирает, пока не сделаешь жест. Ошибся — то же ещё раз
  function teach() {
    const s = TUT[tut];
    if (!tutE) { tutE = s.k === 'box' ? {k: 'box', side: lane < 0 ? -1 : 1, at: dist + 18} : {k: s.k, lane: mine(), at: dist + 22}; ents.push(tutE); tutOk = false; }
    const z = tutE.at - dist, box = s.k === 'box';
    hint = !tutOk && z < (box ? 10 : 6) ? (box && !reach(tutE, mine()) && z < 8 ? {g: 'lr', s: 'Подойди к ящику поближе'} : s) : null;
    slo = hint ? (z > (box ? 7 : 3) ? .2 : 0) : 1;
    const okk = box ? tutE.ok : z < -1 && !tutE.gone, fail = box ? z < .6 && !tutE.done : tutE.gone;
    if (fail) tutE = null;
    if (!okk) return;
    tutE = null; tut++; sfx.ok(); toast(['👍 Есть!', '👍 Красиво!', '👍 Ловко!', '📫 В яблочко!'][tut - 1]);
    if (tut < TUT.length) return;
    tut = -1; learn = false; save('karychTut', '1'); t = 0; nextRow = dist + 20; nextBox = dist + 12; gap = .75;
    hint = {s: `${CH.face} ${CH.name} гонится — беги и разноси письма!`, g: '', t: 2.4};
  }
  // остальное объясняем, когда встречается впервые — коротко и с лёгким замедлением
  function tips(rdt) {
    if (hint && (hint.t -= rdt) <= 0) hint = null;
    slo = hint && hint.slow !== false ? .4 : 1;
    if (hint) return;
    const tip = (id, s, g = '') => { if (seen.includes(id)) return false; seen += id; save('karychSeen', seen); hint = {s, g, t: 2.6}; return true; };
    const near = (k, d, f = () => true) => ents.some(e => e.k === k && !e.gone && !e.passed && e.at - dist < d && f(e));
    near('cig', 14) && tip('c', '🚬 Сигарету не бери! Обойди или перепрыгни — растёт множитель') ||
    near('box', 16, e => e.reg) && tip('r', '📮 Красный ящик — заказное: ×3, но кидать надо ближе') ||
    near('bag', 12) && tip('l', '📨 Пачка писем — хватай, письма кончаются') ||
    beds && bed <= 0 && tip('b', 'Есть кровать! Жми 🛏️ — полетишь во сне, никто не тронет', 'bed') ||
    sleep > .55 && tip('s', '😪 Клонит в сон. Лови 🍭 или ложись на 🛏️') ||
    back > .55 && tip('k', '🦴 Спина ноет — нагибайся реже, а то прострел') ||
    (who === 'king' && near('wall', 30, e => e.king) && tip('K', '🤴 Король ставит барьеры прямо перед тобой')) ||
    (who === 'baba' && slip && tip('B', '🩴 Красная метка — сейчас прилетит тапок, уходи!'));
  }

  function step(dt) {
    const rdt = dt; dt *= slo;
    t += dt;
    const v = tut >= 0 ? 10 : Math.min(26, 11 + t * .12) * (slow > 0 || cramp > 0 ? .6 : 1);
    slow -= dt; dist += v * dt;
    if (bed > 0) bed -= dt;
    if (cramp > 0) cramp -= dt;
    back = Math.max(0, back - dt * .12);
    if (doze > 0 && (doze -= dt) <= 0) sleep = .35;
    if (tut < 0 && bed <= 0 && doze <= 0 && (sleep += dt / 28) >= 1) { sleep = 1; doze = 4; buzz(200); sfx.bad(); toast('😴 Уснул на ходу!'); }
    // погоня: бежишь чисто — отстаёт, уснул или прострел — нагоняет
    if (tut < 0) {
      const away = who === 'dimon' ? CH.back - rage * .015 : CH.back;
      gap = Math.min(1, gap + dt * (bed > 0 ? .06 : doze > 0 ? -.07 : cramp > 0 ? -.05 : away));
      if (gap <= 0) return over();
      if (who === 'dimon' && rage && (calm += dt) > 7) { rage--; calm = 0; toast('👴 Димон выдыхается'); }
    }
    px += Math.sign(lane - px) * Math.min(Math.abs(lane - px), dt * 9);
    gx += (px - gx) * Math.min(1, dt * 3);
    if (jump > 0 && (jump -= dt) <= 0) { land = .2; sfx.land(); burst(px, .05, dist, '#e8dccb', 8); }
    if (duck > 0) duck -= dt;
    queue = queue.filter(([at, f]) => at > t || (f(), false));

    if (tut < 0) {
      // бабушка близко — метка на полосе Карыча, через секунду туда прилетает 🩴
      if (who === 'baba' && t > 20 && gap < .85 && bed <= 0 && (slipT -= dt) <= 0) { slip = {lane: mine(), t: 1.1}; slipT = rnd(9, 14); }
      // Король ставит 🚧 на полосу Карыча метрах в 26 впереди, там, где рядом нет других преград
      if (who === 'king' && t > 15 && bed <= 0 && (kingT -= dt) <= 0) {
        const at = dist + 26;
        if (!ents.some(e => !(e.k in ITEMS) && e.k !== 'box' && Math.abs(e.at - at) < 3)) { ents.push({k: 'wall', lane: mine(), at, king: true}); toast('🤴 Король ставит преграду!'); }
        kingT = rnd(6, 9);
      }
    }
    if (slip && (slip.t -= dt) <= 0) { if (mine() === slip.lane) hit(.2, '🩴 Тапком!'); slip = null; }

    // поравнялись с предметом — проверяем один раз
    const l = mine(), y = jy();
    for (const e of ents) {
      if (e.k === 'box') { if (bed > 0 && letters && reach(e, e.side)) throwAt(e); continue; } // во сне разносит сам
      if (e.passed || e.at - dist > .3) continue;
      e.passed = true;
      if (e.k === 'cig') { bed <= 0 && e.lane === l && y < .5 ? take(e) : avoid(); continue; }
      if (e.k in ITEMS) { if (bed > 0 || e.lane === l) take(e); continue; } // во сне собирает со всех полос
      if (e.lane !== l || bed > 0) continue;
      if (e.k === 'wall') { e.gone = true; hit(.45, '💥 Врезался!'); }
      else if (e.k === 'low' && y < .5) { e.gone = true; hit(.3, '📦 Споткнулся!'); }
      else if (e.k === 'line' && duck <= 0) { e.gone = true; hit(.3, '👕 Бельё в лицо!'); }
    }
    ents = ents.filter(e => e.at - dist > -3);

    for (const f of flies) if ((f.t += dt) >= .3 && !f.end) {
      f.end = true;
      if (f.box) { const p = (f.box.reg ? 30 : 10) * mult(); pts += p; sent++; f.box.ok = true; burst(f.box.side * 2.35, 1, f.box.at, f.box.reg ? '#ff5a4a' : '#7fb2ff', 22); toast(`${f.box.reg ? '📮' : '📫'} +${p}`); buzz(15); sfx.mail(f.box.reg); }
      else { pts -= 5; toast('Мимо — жалоба −5'); }
    }
    flies = flies.filter(f => f.t < .5);
    toasts = toasts.filter(s => (s.t -= rdt) > 0);
    shake = Math.max(0, shake - dt); hurt = Math.max(0, hurt - dt); land = Math.max(0, land - dt);
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.at += p.va * dt; p.vy -= 14 * dt; if (p.y < 0) { p.y = 0; p.vy *= -.4; } p.l -= dt * 1.5; }
    sparks = sparks.filter(p => p.l > 0);
    if (!recT && best > 0 && score() > best) { recT = true; toast('🎉 Новый рекорд!'); sfx.rec(); buzz([30, 40, 30]); }
    if (tut >= 0) teach(); else tips(rdt);
  }

  // ——— рисование: низкополигональный двор на рассвете (three.js) ———
  // модели собраны кодом из примитивов: части с цветами вершин сливаются в одну сетку — один вызов отрисовки на модель
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new T.Scene(), FOG = '#f4c9a8';
  scene.fog = new T.Fog(FOG, 26, FAR + 4);
  const SUN = new T.Vector3(.55, .32, -1).normalize();
  const V = (x, y, z) => new T.Vector3(x, y, z), C = new T.Color();
  const BX = (w, h, d) => new T.BoxGeometry(w, h, d), CY = (a, b, h, s = 10) => new T.CylinderGeometry(a, b, h, s), SP = (r, w = 10, h = 7, ...a) => new T.SphereGeometry(r, w, h, ...a);
  const IC = (r, d = 0) => new T.IcosahedronGeometry(r, d), CO = (r, h, s = 6) => new T.ConeGeometry(r, h, s);
  // деталь: геометрия, цвет, положение, поворот, масштаб
  function P(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    g.applyMatrix4(new T.Matrix4().compose(V(...p), new T.Quaternion().setFromEuler(new T.Euler(...r)), V(...s)));
    C.set(color); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([C.r, C.g, C.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(a, 3)); return g;
  }
  function merge(parts) {
    const g = new T.BufferGeometry();
    for (const [k, w] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
      const a = new Float32Array(parts.reduce((n, p) => n + p.attributes[k].array.length, 0)); let o = 0;
      for (const p of parts) { a.set(p.attributes[k].array, o); o += p.attributes[k].array.length; }
      g.setAttribute(k, new T.BufferAttribute(a, w));
    }
    parts.forEach(p => p.dispose()); g.computeBoundingSphere(); return g;
  }
  const VC = new T.MeshLambertMaterial({vertexColors: true, flatShading: true});
  const M = (parts, mat = VC, cast = true) => { const m = new T.Mesh(merge(parts), mat); m.castShadow = cast; return m; };
  const G = (...o) => { const g = new T.Group(); g.add(...o); return g; };
  const cnv = (w, h, f) => { const c = Object.assign(document.createElement('canvas'), {width: w, height: h}); f(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const spr = (map, color, size, add) => { const s = new T.Sprite(new T.SpriteMaterial({map, color, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending})); s.scale.set(size, size, 1); return s; };

  // небо: градиент с солнцем у горизонта, город в дымке, облака
  const sky = new T.Mesh(SP(300, 24, 12), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: {top: {value: new T.Color('#3657a6')}, mid: {value: new T.Color('#9db8e6')}, low: {value: new T.Color(FOG)}, warm: {value: new T.Color('#ffae72')}, sun: {value: SUN}},
    vertexShader: 'varying vec3 p; void main() { p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top, mid, low, warm, sun; varying vec3 p;
      void main() {
        vec3 d = normalize(p); float h = d.y, s = max(dot(d, sun), 0.);
        vec3 c = mix(low, mid, smoothstep(0., .22, h)); c = mix(c, top, smoothstep(.22, .75, h));
        c = mix(c, warm, pow(s, 5.) * (1. - smoothstep(0., .45, h)) * .7);
        c += vec3(1., .93, .75) * (smoothstep(.9985, .9992, s) * 1.6 + pow(s, 40.) * .35);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; scene.add(sky);
  const haze = new T.MeshBasicMaterial({vertexColors: true, fog: false});
  { const p = [];
    for (let i = 0; i < 46; i++) { const x = -150 + i * 6.6 + hsh(i) * 4, h = 6 + hsh(i + 3) * 22, w = 4 + hsh(i + 7) * 5; p.push(P(BX(w, h, 4), hsh(i + 1) > .5 ? '#c9a6b0' : '#bf9ead', [x, h / 2 - 2, -150 - hsh(i + 5) * 20])); }
    p.push(P(CY(.6, 1.4, 46, 6), '#bb98a8', [38, 21, -162]), P(SP(2.6, 8, 6), '#bb98a8', [38, 36, -162]), P(CY(.2, .2, 14, 4), '#bb98a8', [38, 50, -162]));
    scene.add(M(p, haze, false)); }
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const p = [];
    for (let j = 0; j < 5; j++) p.push(P(IC(4 + hsh(i * 9 + j) * 3, 1), j < 3 ? '#fff6ee' : '#ffd9cc', [j * 5 - 10, (j % 2) * 2.5 - (j > 2 ? 1.5 : 0), hsh(j) * 3], [0, 0, 0], [1.4, .6, 1]));
    const c = M(p, haze, false); c.position.set(-120 + i * 50, 38 + hsh(i) * 30, -190 + hsh(i + 2) * 40); clouds.push(c); scene.add(c);
  }

  scene.add(new T.HemisphereLight('#c8dbff', '#c49a7a', 1.7));
  const sun = new T.DirectionalLight('#ffd0a0', 2.4);
  sun.target.position.set(0, 0, -6); sun.position.copy(SUN).multiplyScalar(35).add(sun.target.position);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, {left: -9, right: 9, top: 14, bottom: -14, near: 5, far: 80}).updateProjectionMatrix();
  const fill = new T.DirectionalLight('#ffe9dc', .9); fill.position.set(-.4, .9, 1);
  scene.add(sun, sun.target, fill);

  // земля: двор, улица с разметкой (текстура едет вместе с дорогой), бордюры
  const yard = new T.Mesh(new T.PlaneGeometry(80, 160), new T.MeshLambertMaterial({color: '#b3a684'}));
  yard.rotation.x = -Math.PI / 2; yard.position.set(0, -.02, -60); yard.receiveShadow = true;
  const roadTex = cnv(384, 256, (g, w, h) => {
    const X = x => (x + 3) * 64;
    for (const [a, b] of [[-3, -1.75], [1.75, 3]]) {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = ['#d6ccbc', '#cdc2b0', '#d2c7b6'][(r + c) % 3]; g.fillRect(X(a) + c * 27, r * 64, 27, 64); }
      g.fillStyle = '#00000022'; for (let y = 0; y < h; y += 64) g.fillRect(X(a), y, (b - a) * 64, 2);
      for (let c = 1; c < 3; c++) g.fillRect(X(a) + c * 27, 0, 2, h);
    }
    g.fillStyle = '#545866'; g.fillRect(X(-1.55), 0, 3.1 * 64, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < .5 ? '#ffffff14' : '#0000001c'; g.fillRect(X(-1.55) + Math.random() * 3.1 * 64, Math.random() * h, 2, 2); }
    g.fillStyle = '#4a4d5a'; g.fillRect(X(.9), 150, 40, 26); g.fillRect(X(-1.3), 30, 28, 18); // заплатки
    g.fillStyle = '#f4f1e8'; for (const x of [-.5, .5]) g.fillRect(X(x) - 3, 60, 6, 77);
  });
  roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(1, 120 / 4); roadTex.anisotropy = R.capabilities.getMaxAnisotropy();
  const street = new T.Mesh(new T.PlaneGeometry(6, 120), new T.MeshLambertMaterial({map: roadTex}));
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -54); street.receiveShadow = true;
  const curbs = M([-1, 1].map(s => P(BX(.22, .12, 120), '#ece5d8', [s * 1.66, .06, -54])), VC, false); curbs.receiveShadow = true;
  scene.add(yard, street, curbs);

  // панельки: окна — текстура (часть горит — светится в полумраке рассвета), цвет и этажность — по номеру квартала
  const FLOOR = 1.45, HL = 6.6, HD = 6;
  const winMap = cnv(512, 512, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); }), glow = [];
  { const g = winMap.image.getContext('2d'), e = document.createElement('canvas'); e.width = e.height = 512; const h = e.getContext('2d');
    h.fillStyle = '#000'; h.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const x = i * 64, y = j * 64, lit = hsh(i * 8 + j + .5) > .74, balc = hsh(i * 13 + j * 7) > .78;
      g.fillStyle = '#0000001a'; g.fillRect(x, y + 62, 64, 2); g.fillRect(x + 63, y, 1, 64);
      g.fillStyle = '#f4efe6'; g.fillRect(x + 13, y + 10, 38, 36);
      g.fillStyle = lit ? '#ffe2a0' : hsh(i + j * 3) > .5 ? '#3a4a6e' : '#2f3c5c'; g.fillRect(x + 16, y + 13, 32, 30);
      g.fillStyle = lit ? '#e2ad62' : '#55688f'; g.fillRect(x + 31, y + 13, 2, 30); g.fillRect(x + 16, y + 24, 32, 2);
      if (lit) { h.fillStyle = hsh(i + j) > .5 ? '#ffb257' : '#ffc977'; h.fillRect(x + 16, y + 13, 32, 30); }
      if (balc) { g.fillStyle = '#00000030'; g.fillRect(x + 8, y + 40, 48, 16); g.fillStyle = '#ffffff70'; g.fillRect(x + 8, y + 40, 48, 3); }
    }
    glow.push(new T.CanvasTexture(e)); glow[0].colorSpace = T.SRGBColorSpace; }
  winMap.wrapS = winMap.wrapT = glow[0].wrapS = glow[0].wrapT = T.RepeatWrapping;
  winMap.anisotropy = glow[0].anisotropy = 4;
  const houseGeo = [4, 5, 5, 9].map(fl => {
    const g = BX(HD, fl * FLOOR, HL), uv = g.attributes.uv;
    for (let i = 0; i < 24; i++) { const f = i >> 2, w = f < 2 ? HL : HD; uv.setXY(i, uv.getX(i) * w / 1.65 / 8, uv.getY(i) * fl / 8); }
    g.translate(0, fl * FLOOR / 2, 0); return g;
  });
  const houseMat = ['#efb9a2', '#f3d59a', '#a9c6e8', '#cbb9e2', '#b7dbb0', '#f1e7d5'].map(c => new T.MeshLambertMaterial({color: c, map: winMap, emissive: '#ffffff', emissiveMap: glow[0], emissiveIntensity: .9}));
  // крыльцо подъезда: дверь, козырёк, лампа
  const porchGeo = merge([P(BX(.06, 1.15, .9), '#6e4a32', [0, .575, 0]), P(BX(.7, .07, 1.3), '#d9d2c4', [.32, 1.3, 0]), P(BX(.04, .1, .04), '#ffe6a6', [.05, 1.22, 0]), P(BX(.5, .12, 1.1), '#bdb3a4', [.25, .06, 0])]);
  // деревья — осень: зелёные, жёлтые, рыжие; фонари горят с ночи
  const treeGeo = ['#7ca452', '#e0b13c', '#e0813a'].map((c, i) => merge([P(CY(.06, .1, 1.3, 6), '#6b4a34', [0, .65, 0]), P(IC(.62), c, [0, 1.6, 0]), P(IC(.45), i ? '#d6973a' : '#8fb862', [.25, 2.05, .1]), P(IC(.38), c, [-.3, 1.95, -.15])]));
  const lampHead = new T.MeshBasicMaterial({color: '#ffe3a0'});
  const glowTex = cnv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#ffffffff'); r.addColorStop(.35, '#ffffff66'); r.addColorStop(1, '#ffffff00'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

  // пулы: каждый кадр раздаём объекты заново, лишние прячем — ничего не создаётся во время игры
  const pools = [];
  function pool(make) {
    const list = []; let n = 0;
    const p = {get() { let o = list[n++]; if (!o) { o = make(); scene.add(o); list.push(o); } o.visible = true; return o; }, start() { n = 0; }, end() { for (let i = n; i < list.length; i++) list[i].visible = false; }};
    pools.push(p); return p;
  }
  const pHouse = pool(() => new T.Mesh(houseGeo[0], houseMat[0]));
  const pPorch = pool(() => new T.Mesh(porchGeo, VC));
  const pTree = pool(() => { const m = new T.Mesh(treeGeo[0], VC); m.castShadow = true; return m; });
  const pLamp = pool(() => {
    const g = G(M([P(CY(.035, .05, 2.7, 6), '#3d4250', [0, 1.35, 0]), P(BX(.6, .05, .05), '#3d4250', [-.28, 2.68, 0]), P(BX(.22, .08, .14), '#3d4250', [-.55, 2.64, 0])], VC, false));
    const b = new T.Mesh(BX(.16, .03, .1), lampHead); b.position.set(-.55, 2.59, 0);
    const s = spr(glowTex, '#ffc870', 1.3, true); s.position.set(-.55, 2.5, 0);
    g.add(b, s); return g;
  });

  // ——— модели ———
  const SKIN = '#f0c08a';
  // человечек: тело одной сеткой, ноги и руки — отдельно, на шарнирах (бедро, плечо)
  function rig({body, leg, shoe, arm, hand = SKIN, hip = .36, sh = .74, ax = .25, armExtra = [], legW = .12}) {
    const b = M(body);
    const legs = [-1, 1].map(s => { const m = M([P(BX(legW, .3, .13), leg, [0, -.15, 0]), P(BX(legW + .02, .07, .21), shoe, [0, -.32, -.03])]); m.position.set(s * .09, hip, 0); return m; });
    const arms = [-1, 1].map(s => { const m = M([P(BX(.09, .28, .09), arm, [0, -.14, 0]), P(SP(.055, 6, 5), hand, [0, -.31, 0]), ...(s > 0 ? armExtra : [])]); m.position.set(s * ax, sh, 0); return m; });
    const root = G(b, ...legs, ...arms); scene.add(root);
    return {root, body: b, legs, arms};
  }
  // бег: ноги и руки в противофазе, корпус подпрыгивает
  function runPose(r, ph, a = 1) {
    const s = Math.sin(ph);
    r.legs[0].rotation.x = s * .85 * a; r.legs[1].rotation.x = -s * .85 * a;
    r.arms[0].rotation.x = -s * .9 * a; r.arms[1].rotation.x = s * .9 * a;
  }
  // Карыч со спины: синяя форма, кепка, сумка через плечо
  const kar = rig({
    leg: '#2b3557', shoe: '#1d1d22', arm: '#2f62c4',
    body: [
      P(BX(.42, .42, .26), '#3a72d8', [0, .56, 0]), P(BX(.43, .06, .27), '#2b5bb5', [0, .37, 0]), P(BX(.22, .05, .2), '#2b5bb5', [0, .78, 0]),
      P(BX(.05, .64, .02), '#7a4a22', [0, .57, .135], [0, 0, .74]), P(BX(.05, .3, .02), '#7a4a22', [0, .62, -.135], [0, 0, -.74]),
      P(BX(.2, .19, .11), '#9a5e2c', [.27, .42, .02]), P(BX(.205, .07, .115), '#7f4a20', [.27, .48, .02]), P(BX(.15, .03, .06), '#f4efe2', [.27, .53, .01]),
      P(CY(.06, .06, .07, 8), '#e2ad78', [0, .81, 0]), P(SP(.14), SKIN, [0, .94, 0]), P(SP(.147, 10, 7, 0, Math.PI), '#3a2a1e', [0, .945, .005]),
      P(SP(.036, 6, 4), SKIN, [-.14, .93, 0]), P(SP(.036, 6, 4), SKIN, [.14, .93, 0]),
      P(CY(.15, .156, .09, 12), '#1f3a7a', [0, 1.06, 0]), P(CY(.158, .158, .03, 12), '#16295a', [0, 1.025, 0]), P(BX(.22, .025, .14), '#16295a', [0, 1.02, -.17]),
      P(SP(.025, 6, 4), '#ffd23f', [0, 1.11, 0]),
    ],
  });
  // кровать: летит, Карыч спит под одеялом
  const bedParts = () => [
    P(BX(1.1, .12, .58), '#8a5530', [0, .17, 0]), P(BX(.08, .55, .62), '#6b3f20', [-.57, .32, 0]), P(BX(.08, .36, .62), '#6b3f20', [.57, .23, 0]),
    ...[[-.5, -.24], [-.5, .24], [.5, -.24], [.5, .24]].map(([x, z]) => P(BX(.07, .12, .07), '#5a3418', [x, .06, z])),
    P(BX(1.04, .1, .52), '#f6f1e6', [0, .28, 0]), P(BX(.64, .13, .54), '#5d8be8', [.18, .34, 0]), P(BX(.66, .03, .545), '#f6f1e6', [.18, .41, 0]),
    P(BX(.27, .11, .38), '#ffffff', [-.37, .38, 0]),
  ];
  const bedG = G(M([...bedParts(), P(SP(.2, 8, 6), '#5d8be8', [.14, .4, 0], [0, 0, 0], [1.7, .5, 1.1]), P(SP(.12), SKIN, [-.34, .5, 0]), P(SP(.125, 10, 7, 0, Math.PI), '#3a2a1e', [-.37, .5, 0], [0, -Math.PI / 2, 0]),
    P(CY(.13, .135, .08, 10), '#1f3a7a', [-.43, .55, 0], [0, 0, .9]), P(BX(.16, .02, .12), '#16295a', [-.4, .63, 0], [0, 0, .9])]));
  const zTex = cnv(64, 64, g => { g.font = 'bold 54px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#2d3c78'; g.strokeText('Z', 32, 34); g.fillStyle = '#fff'; g.fillText('Z', 32, 34); });
  const zz = [0, 1, 2].map(() => { const s = spr(zTex, '#fff', .3); scene.add(s); return s; });
  const angerTex = cnv(64, 64, g => { g.strokeStyle = '#ff2d2d'; g.lineWidth = 9; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.save(); g.translate(32, 32); g.rotate(i * Math.PI / 2); g.beginPath(); g.arc(17, 17, 12, Math.PI, Math.PI * 1.5); g.stroke(); g.restore(); } });
  const anger = spr(angerTex, '#fff', .42); scene.add(bedG, anger);

  // преследователи — их видно сзади-сверху, узнаются по силуэту
  const slipperParts = (c, p, r = [0, 0, 0]) => [P(BX(.13, .035, .3), c, p, r), P(BX(.14, .07, .06), '#ffcf3f', [p[0], p[1] + .04, p[2] - .05], r)];
  const CH3 = {
    baba: rig({
      leg: '#c9a38a', shoe: '#4a3a30', arm: '#7b4a8e', legW: .1, hip: .3, sh: .76, ax: .22,
      armExtra: slipperParts('#3f78d6', [0, -.36, -.05], [.4, 0, 0]),
      body: [
        P(CY(.17, .29, .5, 10), '#7b4a8e', [0, .5, 0]), P(SP(.2, 10, 7), '#7b4a8e', [0, .76, 0], [0, 0, 0], [1, .55, .85]), P(CY(.29, .3, .06, 10), '#5d3570', [0, .26, 0]),
        P(SP(.13), SKIN, [0, .95, 0]), P(SP(.155, 10, 8), '#d94a3a', [0, .98, .015]), P(CO(.09, .2, 4), '#d94a3a', [0, .84, .14], [Math.PI + .3, 0, 0]),
        ...[[.06, 1.08, .1], [-.08, 1.02, .12], [.1, .95, .12], [-.03, .92, .15], [0, 1.12, 0]].map(p => P(SP(.025, 5, 4), '#fff3d6', p)),
        P(BX(.2, .16, .07), '#3b2a22', [-.24, .5, 0]),
      ],
    }),
    king: rig({
      leg: '#a07a10', shoe: '#c0262d', arm: '#f2c230', hip: .34,
      armExtra: [P(CY(.02, .02, .55, 6), '#ffcc33', [0, -.32, -.15], [1.2, 0, 0]), P(SP(.05, 6, 5), '#e0303a', [0, -.2, -.4])],
      body: [
        P(CY(.2, .3, .58, 10), '#f2c230', [0, .52, 0]), P(BX(.52, .66, .04), '#c0262d', [0, .52, .22], [.12, 0, 0]),
        P(BX(.54, .08, .08), '#fffaf0', [0, .85, .19]), ...[-.15, 0, .15].map(x => P(BX(.03, .04, .01), '#111', [x, .85, .235])),
        P(SP(.13), SKIN, [0, .97, 0]), P(SP(.137, 10, 7, 0, Math.PI), '#e3a33a', [0, .96, .01]),
        P(CY(.135, .125, .09, 8), '#ffcc33', [0, 1.1, 0]), ...[0, 1, 2, 3, 4, 5].map(i => P(CO(.035, .11, 4), '#ffcc33', [Math.sin(i * 1.05) * .12, 1.19, Math.cos(i * 1.05) * .12])),
        ...[0, 2, 4].map(i => P(SP(.025, 5, 4), '#e0303a', [Math.sin(i * 1.05) * .135, 1.1, Math.cos(i * 1.05) * .135])),
      ],
    }),
    dimon: rig({
      leg: '#26324f', shoe: '#f0f0f0', arm: '#26324f',
      armExtra: [P(BX(.02, .26, .095), '#fff', [.045, -.14, 0])],
      body: [
        P(BX(.44, .44, .28), '#26324f', [0, .57, 0]), P(SP(.22, 10, 7), '#26324f', [0, .5, -.07], [0, 0, 0], [1, .9, .9]),
        P(BX(.02, .44, .02), '#fff', [-.2, .57, .141]), P(BX(.02, .44, .02), '#fff', [.2, .57, .141]), P(BX(.2, .06, .2), '#fff', [0, .8, 0]),
        P(SP(.145, 10, 7, 0, Math.PI * 2, Math.PI * .5, Math.PI * .22), '#c4c4c4', [0, .96, .005]),
        P(SP(.04, 6, 4), SKIN, [-.15, .95, 0]), P(SP(.04, 6, 4), SKIN, [.15, .95, 0]),
      ],
    }),
  };
  // голова Димона отдельно — краснеет, когда звереет
  const dimHead = new T.MeshLambertMaterial({color: SKIN, flatShading: true});
  { const h = new T.Mesh(SP(.14, 10, 8), dimHead); h.position.set(0, .96, 0); h.castShadow = true; CH3.dimon.root.add(h); }
  const steam = [0, 1, 2, 3].map(() => { const s = spr(glowTex, '#ffffff', .3); s.material.opacity = .6; scene.add(s); return s; });
  const slipper = M(slipperParts('#3f78d6', [0, 0, 0]));
  const redMat = new T.MeshBasicMaterial({color: '#ff3b30', transparent: true, opacity: .9, depthWrite: false});
  const slipMark = new T.Mesh(new T.RingGeometry(.36, .5, 28), redMat); slipMark.rotation.x = -Math.PI / 2;
  scene.add(slipper, slipMark);

  // почтовый ящик на столбике: синий или красный (заказное). Подсветка — кольцо на земле, доставлено — галочка
  const ringMat = new T.MeshBasicMaterial({color: '#ffd84a', transparent: true, depthWrite: false});
  const checkTex = cnv(64, 64, g => { g.fillStyle = '#2fbf5b'; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(18, 33); g.lineTo(28, 43); g.lineTo(46, 22); g.stroke(); });
  function mailbox(reg) {
    const [a, b] = reg ? ['#d8342c', '#ff7a66'] : ['#2f6fd6', '#6aa0f4'];
    const m = M([P(CY(.04, .045, .64, 6), '#4a4d57', [0, .32, 0]), P(BX(.5, .4, .38), a, [0, .82, 0]), P(new T.CylinderGeometry(.25, .25, .38, 12, 1, false, -Math.PI / 2, Math.PI), b, [0, 1.02, 0], [-Math.PI / 2, 0, 0]),
      P(BX(.02, .05, .24), '#141414', [-.255, .9, 0]), P(BX(.02, .2, .26), b, [-.255, .74, 0]),
      ...(reg ? [P(new T.OctahedronGeometry(.08), '#ffd23f', [-.27, .74, 0], [0, 0, 0], [.3, 1, 1]), P(new T.OctahedronGeometry(.08), '#ffd23f', [0, .78, .195], [0, 0, 0], [1, 1, .3])] : [P(BX(.16, .1, .02), '#fff', [0, .8, .195])])]);
    const ring = new T.Mesh(new T.RingGeometry(.34, .5, 28), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .03;
    const ok = spr(checkTex, '#fff', .42); ok.position.y = 1.5;
    const g = G(m, ring, ok); g.userData = {ring, ok}; return g;
  }
  // барьер: полосатые доски на ножках, мигалка. Королевский — жёлтый с короной
  const stripes = king => cnv(128, 32, g => { g.fillStyle = king ? '#ffd23f' : '#fff'; g.fillRect(0, 0, 128, 32); g.fillStyle = king ? '#3a2a00' : '#e5392f'; for (let i = -1; i < 9; i++) { g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 + 20, 0); g.lineTo(i * 16 + 12, 0); g.fill(); } });
  const boardMat = [stripes(false), stripes(true)].map(map => new T.MeshLambertMaterial({map}));
  const blink = new T.MeshBasicMaterial({color: '#ffb300'});
  function barrier(king) {
    const legs = M([-.42, .42].flatMap(x => [P(BX(.07, 1, .07), king ? '#6a5520' : '#6b6b6b', [x, .5, 0]), P(BX(.1, .05, .44), '#3b3b3b', [x, .025, 0])]));
    const boards = M([P(BX(.98, .26, .06), '#fff', [0, .82, 0]), P(BX(.98, .26, .06), '#fff', [0, .42, 0])], boardMat[+king]);
    const lamp = new T.Mesh(SP(.065, 8, 6), blink); lamp.position.set(-.42, 1.06, 0);
    const g = G(legs, boards, lamp);
    if (king) g.add(M([P(CY(.17, .15, .1, 8), '#ffcc33', [0, 1.08, 0]), ...[0, 1, 2, 3, 4, 5].map(i => P(CO(.045, .14, 4), '#ffcc33', [Math.sin(i * 1.05) * .15, 1.2, Math.cos(i * 1.05) * .15])), P(SP(.04, 6, 4), '#e0303a', [0, 1.08, .17])]));
    return g;
  }
  // бельевая верёвка: столбики, верёвка, вещи качаются на ветру
  function laundry() {
    const g = G(M([P(CY(.03, .035, 1.22, 6), '#8a6a4a', [-.5, .61, 0]), P(CY(.03, .035, 1.22, 6), '#8a6a4a', [.5, .61, 0]),
      P(new T.TubeGeometry(new T.QuadraticBezierCurve3(V(-.5, 1.16, 0), V(0, 1.02, 0), V(.5, 1.16, 0)), 10, .012, 4), '#f4f4f4')]));
    const cl = [
      M([P(BX(.24, .26, .02), '#e94b6a', [0, -.17, 0]), P(BX(.38, .09, .021), '#e94b6a', [0, -.07, 0])]),
      M([P(BX(.1, .3, .02), '#4bb3e9', [-.06, -.2, 0]), P(BX(.1, .3, .02), '#4bb3e9', [.06, -.2, 0]), P(BX(.22, .07, .021), '#3a96c9', [0, -.05, 0])]),
      M([P(BX(.2, .3, .02), '#f2c84b', [0, -.17, 0]), P(BX(.2, .04, .021), '#fff', [0, -.26, 0])]),
    ];
    cl.forEach((c, i) => { c.position.set([-.28, 0, .27][i], [1.1, 1.04, 1.1][i], 0); g.add(c); });
    g.userData.cl = cl; return g;
  }
  // предметы: крутятся над дорогой в ореоле
  const ITEM3 = {
    bag: () => [P(BX(.36, .24, .03), '#f6f1e6', [0, 0, 0], [0, 0, .15]), P(BX(.36, .24, .03), '#fffaf0', [0, .03, .035], [0, 0, -.1]),
      P(BX(.38, .03, .033), '#2f6fd6', [0, -.07, .036], [0, 0, -.1]), P(CY(.045, .045, .02, 8), '#c8312a', [0, .03, .055], [Math.PI / 2, 0, 0])],
    roll: () => [P(CY(.14, .14, .22, 14), '#fbfbf8', [0, 0, 0], [0, 0, Math.PI / 2]), P(CY(.05, .05, .225, 10), '#b9a58a', [0, 0, 0], [0, 0, Math.PI / 2]), P(BX(.2, .18, .008), '#f2f2ee', [0, -.1, .14], [.2, 0, 0])],
    pillow: () => bedParts().map(g => g.translate(0, -.3, 0).scale(.42, .42, .42)),
    cig: () => [P(CY(.035, .035, .32, 8), '#f7f4ee', [.05, 0, 0], [0, 0, Math.PI / 2]), P(CY(.037, .037, .12, 8), '#e0913a', [-.17, 0, 0], [0, 0, Math.PI / 2])],
    lolly: () => [P(CY(.15, .15, .05, 16), '#ff5fa2', [0, .1, 0], [Math.PI / 2, 0, 0]), P(new T.TorusGeometry(.085, .02, 5, 16), '#fff', [0, .1, .028]), P(new T.TorusGeometry(.085, .02, 5, 16), '#fff', [0, .1, -.028]), P(CY(.013, .013, .32, 6), '#fff', [0, -.12, 0])],
  };
  const tipMat = new T.MeshBasicMaterial({color: '#ff5a1a'});
  function item(k) {
    const spin = G(M(ITEM3[k]())), g = G(spin), s = spr(glowTex, k === 'cig' ? '#ff5a3a' : '#ffe9a0', 1, true);
    s.material.opacity = .75; g.add(s);
    if (k === 'cig') { const tip = new T.Mesh(CY(.038, .038, .03, 8), tipMat); tip.rotation.z = Math.PI / 2; tip.position.x = .225; spin.add(tip);
      g.userData.smoke = [0, 1, 2].map(() => { const p = spr(glowTex, '#e8e8f0', .18); p.material.opacity = .5; g.add(p); return p; }); }
    g.userData.spin = spin; return g;
  }
  const lowBoxes = () => M([P(BX(.5, .38, .42), '#c8955a', [-.12, .19, 0]), P(BX(.08, .006, .43), '#ecd9b0', [-.12, .383, 0]), P(BX(.51, .06, .01), '#ecd9b0', [-.12, .3, .21]),
    P(BX(.36, .28, .32), '#b98349', [.24, .14, .05], [0, .35, 0]), P(BX(.06, .006, .33), '#e6cfa0', [.24, .283, .05], [0, .35, 0]), P(BX(.24, .16, .2), '#d4a46c', [-.1, .46, .02], [0, -.3, 0])]);
  const P3 = {
    box: pool(() => mailbox(false)), reg: pool(() => mailbox(true)), wall: pool(() => barrier(false)), kwall: pool(() => barrier(true)),
    low: pool(lowBoxes), line: pool(laundry), fly: pool(() => M([P(BX(.24, .16, .02), '#f6f1e6'), P(BX(.08, .08, .022), '#d8342c', [0, 0, 0], [0, 0, Math.PI / 4])], VC, false)),
  };
  for (const k in ITEM3) P3[k] = pool(() => item(k));
  // искры — один InstancedMesh
  const NSP = 220, spk = new T.InstancedMesh(new T.OctahedronGeometry(.055), new T.MeshBasicMaterial(), NSP), mx = new T.Matrix4(), q0 = new T.Quaternion();
  spk.frustumCulled = false; for (let i = 0; i < NSP; i++) spk.setColorAt(i, C.set('#fff')); scene.add(spk);

  function draw() {
    const z0 = at => -(at - dist), now = performance.now() / 1000;
    for (const p of pools) p.start();
    // кварталы: дом 6.6 м, между домами — дерево или фонарь
    for (let i = Math.floor((dist - 10) / 8); i * 8 < dist + FAR + 4; i++) for (const s of [-1, 1]) {
      const n = i * 2 + (s > 0), h = pHouse.get();
      h.geometry = houseGeo[Math.floor(hsh(n + 50) * 4)]; h.material = houseMat[Math.floor(hsh(n) * 6)];
      h.position.set(s * (3.1 + HD / 2), 0, z0(i * 8 + HL / 2));
      if (hsh(n + 21) > .45) { const p = pPorch.get(); p.position.set(s * 3.1, 0, z0(i * 8 + 1.4 + hsh(n + 4) * 3.8)); p.rotation.y = s > 0 ? Math.PI : 0; }
      if (hsh(n + 7) > .3) { const tr = pTree.get(); tr.geometry = treeGeo[Math.floor(hsh(n + 9) * 3)]; tr.position.set(s * 2.55, 0, z0(i * 8 + 7.3)); tr.rotation.y = n; }
      else { const l = pLamp.get(); l.position.set(s * 2.45, 0, z0(i * 8 + 7.3)); l.rotation.y = s > 0 ? 0 : Math.PI; }
    }
    roadTex.offset.y = dist / 4;
    blink.color.set(Math.floor(now * 4) % 2 ? '#ffb300' : '#ff4a00');
    ringMat.opacity = .55 + .35 * Math.sin(now * 10);
    for (const e of ents) {
      const z = e.at - dist; if (e.gone || z < -4 || z > FAR + 4) continue;
      if (e.k === 'box') {
        const o = (e.reg ? P3.reg : P3.box).get(); o.position.set(e.side * 2.35, 0, -z); o.rotation.y = e.side > 0 ? 0 : Math.PI;
        o.userData.ring.visible = st === 'run' && bed <= 0 && reach(e, mine()); o.userData.ok.visible = !!e.ok;
        continue;
      }
      const o = (e.k === 'wall' && e.king ? P3.kwall : P3[e.k]).get();
      o.position.set(e.lane, 0, -z);
      if (e.k === 'line') o.userData.cl.forEach((c, i) => { c.rotation.x = .25 + Math.sin(now * 4 + e.at + i * 1.7) * .22; c.rotation.z = Math.sin(now * 3 + i) * .08; });
      if (e.k in ITEMS) {
        o.position.y = .5 + .08 * Math.sin(now * 5 + e.at); o.userData.spin.rotation.y = now * 2.4 + e.at;
        o.userData.smoke?.forEach((p, i) => { const q = (now * .7 + i / 3) % 1; p.position.set(.2 + q * .1, q * .7, 0); p.material.opacity = .5 * (1 - q); p.scale.setScalar(.12 + q * .3); });
      }
    }
    // письма в полёте — дугой к ящику
    for (const f of flies) if (f.t < .3) {
      const q = f.t / .3, o = P3.fly.get(), tz = f.box ? -(f.box.at - dist) : -10, tx = f.box ? f.box.side * 2.35 : f.dir * 3.2;
      o.position.set(f.x + (tx - f.x) * q, .7 + f.y + (.95 - .7 - f.y) * q + Math.sin(q * Math.PI) * .9, tz * q);
      o.rotation.set(q * 3, q * 9, 0);
    }
    for (const p of pools) p.end();

    // Карыч
    const y = jy(), running = st === 'run' && !paused, ph = dist * 1.6;
    kar.root.visible = bed <= 0; bedG.visible = bed > 0 && !(bed < 1.5 && Math.floor(now * 8) % 2);
    if (bed > 0) { bedG.position.set(px, .45 + Math.sin(now * 3) * .06, 0); bedG.rotation.set(Math.sin(now * 2) * .05, 0, Math.sin(now * 2.6) * .04); }
    else {
      const r = kar.root, a = running && jump <= 0 ? 1 : 0;
      runPose(kar, ph, a);
      if (jump > 0) { kar.legs[0].rotation.x = 1.1; kar.legs[1].rotation.x = -.4; kar.arms[0].rotation.x = kar.arms[1].rotation.x = 2.6; }
      kar.arms[0].rotation.z = -.12; kar.arms[1].rotation.z = .12;
      if (st === 'intro') { kar.arms[0].rotation.x = kar.arms[1].rotation.x = Math.sin(now * 1.5) * .05; }
      r.position.set(px, y + Math.abs(Math.sin(ph)) * .06 * a, 0);
      r.rotation.set(-.14 * a - (duck > 0 ? .45 : 0) - (cramp > 0 ? .35 : 0) + (doze > 0 || st === 'intro' ? Math.sin(now * 2.2) * .08 : 0), 0, cramp > 0 ? -.35 : -(lane - px) * .35);
      const sq = duck > 0 ? .62 : land > 0 ? 1 - land * 1.2 : jump > 0 ? 1.08 : 1;
      r.scale.set(sq < 1 ? 1 + (1 - sq) * .5 : 1, sq, 1);
    }
    // сон: Z поднимаются над головой
    const zOn = bed > 0 || doze > 0 || st === 'intro';
    zz.forEach((s, i) => { const q = (now * .6 + i / 3) % 1; s.visible = zOn; s.position.set(px + .2 + q * .35 + Math.sin(q * 6) * .05, (bed > 0 ? 1 : 1.2 + y) + q * .8, 0); s.material.opacity = Math.min(1, (1 - q) * 2); s.scale.setScalar(.18 + q * .22); });
    anger.visible = cramp > 0 && bed <= 0; anger.position.set(px - .3, y + 1.15, 0); anger.scale.setScalar(.35 + Math.sin(now * 12) * .05);

    // преследователь сзади: чем ближе, тем выше вылезает из-под края экрана
    const cz = 1 + gap * 2.4;
    for (const id in CH3) CH3[id].root.visible = id === who && st !== 'intro';
    const c = CH3[who];
    runPose(c, now * (who === 'baba' ? 14 : 11), st === 'run' ? .9 : .3);
    c.root.position.set(gx * .9, Math.abs(Math.sin(now * (who === 'baba' ? 14 : 11))) * .07, cz);
    c.root.rotation.set(-.1, gx * .15, 0);
    if (who === 'baba') { c.arms[1].rotation.set(-2.5 + Math.sin(now * 9) * .5, 0, .2); }
    if (who === 'king') { c.arms[1].rotation.set(1.3, 0, 0); }
    if (who === 'dimon') dimHead.color.set(SKIN).lerp(C.set('#ff3a2a'), rage / 3 * .8 + (rage ? Math.sin(now * 8) * .08 : 0));
    steam.forEach((s, i) => { const q = (now * 1.2 + i / 4) % 1; s.visible = who === 'dimon' && rage > 0 && st !== 'intro'; s.position.set(gx * .9 + (i % 2 ? .12 : -.12) * (1 + q), 1.15 + q * .6, cz); s.material.opacity = .7 * (1 - q); s.scale.setScalar(.15 + q * .35); });

    // тапок бабушки: мигающая метка и падение сверху
    slipMark.visible = !!slip && Math.floor(now * 10) % 2 === 0; slipper.visible = !!slip && slip.t < .35;
    if (slip) { slipMark.position.set(slip.lane, .03, 0); const q = Math.max(0, slip.t / .35); slipper.position.set(slip.lane + q * .5, .1 + q * 5, -q * 2); slipper.rotation.set(q * 8, q * 4, 0); }

    // искры
    spk.count = Math.min(NSP, sparks.length);
    for (let i = 0; i < spk.count; i++) {
      const p = sparks[i]; mx.compose(V(p.x, p.y, -(p.at - dist)), q0, V(1, 1, 1).multiplyScalar(Math.max(0, p.l) * p.r));
      spk.setMatrixAt(i, mx); spk.setColorAt(i, C.set(p.c));
    }
    spk.instanceMatrix.needsUpdate = true; if (spk.instanceColor) spk.instanceColor.needsUpdate = true;

    // облака плывут, камера идёт за Карычем; на скорости шире угол и тряска
    clouds.forEach((c, i) => { c.position.x = ((-120 + i * 50 + now * (1 + i * .3)) % 300 + 300) % 300 - 150; });
    const v = st === 'run' && tut < 0 ? Math.min(26, 11 + t * .12) : 10, hf = (st === 'intro' ? 46 : 41 + (v - 11) / 15 * 9) * Math.PI / 180;
    cam.fov = Math.max(48, Math.min(84, 2 * Math.atan(Math.tan(hf / 2) / cam.aspect) * 180 / Math.PI));
    const sh = shake * .25, ix = st === 'intro' ? Math.sin(now * .3) * .5 : 0;
    cam.position.set(gx * .45 + ix + (Math.random() - .5) * sh, (st === 'intro' ? 2.1 : 2.4) + (Math.random() - .5) * sh, st === 'intro' ? 3.4 : 3.8);
    cam.lookAt(gx * .6, st === 'intro' ? .9 : .5, -6);
    cam.updateProjectionMatrix();
    sky.position.copy(cam.position);
    R.render(scene, cam);
  }

  // ——— HUD поверх 3D ———
  function emoji(ch, x, y, size, sq = 1, rot = 0) {
    cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(1, sq);
    cx.fillStyle = '#000'; // цветной эмодзи берёт прозрачность из fillStyle — иначе он полупрозрачный
    cx.font = `${size}px system-ui,"Apple Color Emoji","Noto Color Emoji",sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'bottom';
    cx.fillText(ch, 0, 0); cx.restore();
  }
  const rrect = (x, y, w, h, r, c) => { cx.fillStyle = c; cx.beginPath(); cx.roundRect(x, y, w, h, r); cx.fill(); };
  function pill(x, y, w, h) { rrect(x, y, w, h, h / 2, '#0b1430a0'); }
  function bar(x, y, w, v, c, label) {
    pill(x - 26, y - 6, w + 34, 20);
    cx.fillStyle = '#ffffff22'; cx.beginPath(); cx.roundRect(x, y, w, 8, 4); cx.fill();
    cx.fillStyle = c; cx.beginPath(); cx.roundRect(x, y, Math.max(4, w * Math.max(0, Math.min(1, v))), 8, 4); cx.fill();
    emoji(label, x - 13, y + 13, 15);
  }
  // подсказка: крупная плашка и жест, который надо сделать (анимация идёт и в замершем времени)
  function drawHint(now) {
    if (!hint) return;
    cx.font = 'bold 19px system-ui,sans-serif';
    const words = hint.s.split(' '), lines = [];
    for (const w of words) { const l = lines.length ? lines[lines.length - 1] + ' ' + w : w; if (lines.length && cx.measureText(l).width < W - 72) lines[lines.length - 1] = l; else lines.push(w); }
    const bw = Math.min(W - 32, Math.max(...lines.map(l => cx.measureText(l).width)) + 40), bh = 22 + lines.length * 25, y = Math.max(150, H * .2);
    rrect(W / 2 - bw / 2, y, bw, bh, 18, '#0b1430d8');
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'top';
    lines.forEach((l, i) => cx.fillText(l, W / 2, y + 13 + i * 25));
    const q = (now * 1.1) % 1, e = 1 - (1 - q) ** 3, g = hint.g, hy = y + bh + 150;
    cx.globalAlpha = Math.min(1, (1 - q) * 3);
    if (g === 'lr') { const d = Math.sin(now * 3.5) * 70; emoji('👆', W / 2 + d, hy + 10, 46); }
    if (g === 'up') { cx.strokeStyle = '#ffffffaa'; cx.lineWidth = 6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(W / 2, hy); cx.lineTo(W / 2, hy - e * 80); cx.stroke(); emoji('👆', W / 2, hy + 10 - e * 80, 46); }
    if (g === 'down') { cx.strokeStyle = '#ffffffaa'; cx.lineWidth = 6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(W / 2, hy - 90); cx.lineTo(W / 2, hy - 90 + e * 80); cx.stroke(); emoji('👇', W / 2, hy + 10 - 90 + e * 80, 46); }
    if (g === 'tap') { cx.strokeStyle = '#fff'; cx.lineWidth = 4; cx.globalAlpha = 1 - q; cx.beginPath(); cx.arc(W / 2, hy - 50, 12 + q * 40, 0, 7); cx.stroke(); cx.globalAlpha = 1; emoji('👆', W / 2 + 6, hy + 10 - (q < .3 ? 8 : 0), 46); }
    if (g === 'bed') { const d = Math.abs(Math.sin(now * 5)) * 16; emoji('👉', W - 112 - d, H - 40, 40); }
    cx.globalAlpha = 1;
  }
  function hud() {
    const now = performance.now() / 1000;
    cx.clearRect(0, 0, W, H);
    if (st === 'intro') return;
    // линии скорости по краям
    const sp = Math.min(1, Math.max(0, (t - 25) / 60));
    if (sp > 0 && st === 'run' && tut < 0) { cx.strokeStyle = `rgba(255,255,255,${.3 * sp})`; cx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const a = hsh(i + Math.floor(t * 12) * 10) * Math.PI * 2, r0 = Math.max(W, H) * .42; cx.beginPath(); cx.moveTo(W / 2 + Math.cos(a) * r0, H * .38 + Math.sin(a) * r0); cx.lineTo(W / 2 + Math.cos(a) * r0 * 1.4, H * .38 + Math.sin(a) * r0 * 1.4); cx.stroke(); } }
    if (doze > 0) { const v = cx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75); v.addColorStop(0, '#0a0a1e44'); v.addColorStop(1, '#0a0a1ee0'); cx.fillStyle = v; cx.fillRect(0, 0, W, H); }
    if (bed > 0) { cx.fillStyle = '#4a7dff1c'; cx.fillRect(0, 0, W, H); }
    if (tut >= 0 && slo < 1) { const v = cx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8); v.addColorStop(0, '#0b143000'); v.addColorStop(1, '#0b143070'); cx.fillStyle = v; cx.fillRect(0, 0, W, H); }
    if (hurt > 0) { cx.fillStyle = `rgba(255,40,40,${hurt * .5})`; cx.fillRect(0, 0, W, H); }

    pill(10, 10, 150, 64);
    cx.fillStyle = '#fff'; cx.textAlign = 'left'; cx.textBaseline = 'top';
    cx.font = 'bold 28px system-ui,sans-serif'; cx.fillText(score(), 22, 14);
    cx.font = '12px system-ui,sans-serif'; cx.fillStyle = recT ? '#ffd84a' : '#ffffffb0'; cx.fillText(recT ? 'новый рекорд!' : 'рекорд ' + best, 22, 48);
    pill(10, 80, 190, 24); cx.fillStyle = '#fff'; cx.font = '13px system-ui,sans-serif';
    cx.fillText(`✉️ ${letters}   🧻 ${rolls}   🚭 ×${mult()}${CH.mult > 1 ? `   ${CH.face}×${CH.mult}` : ''}`, 20, 85);
    if (tut < 0) {
      const bw = Math.min(130, W * .32);
      bar(36, 118, bw, sleep, sleep > .75 ? '#ff9f0a' : '#b4a7ff', '😪');
      bar(36, 142, bw, cramp > 0 ? cramp / 3 : back, cramp > 0 || back > .65 ? '#ff3b30' : '#8fd18f', '🦴');
      bar(36, 166, bw, 1 - gap, gap < .35 ? '#ff3b30' : '#ffcc00', CH.face);
      if (bed > 0) bar(36, 190, bw, bed / BED, '#6ea8ff', '🛏️');
    } else { pill(10, 110, 150, 24); cx.fillStyle = '#fff'; cx.font = 'bold 13px system-ui,sans-serif'; cx.fillText(`Обучение ${tut + 1} из ${TUT.length}`, 22, 115); }
    // кнопка кровати
    const bx = W - 52, by = H - 62, on = beds && bed <= 0;
    cx.globalAlpha = on ? 1 : .4;
    if (on) { cx.fillStyle = `rgba(255,224,138,${.35 + .25 * Math.sin(now * 6)})`; cx.beginPath(); cx.arc(bx, by, 42, 0, 7); cx.fill(); }
    cx.fillStyle = '#ffffffe0'; cx.beginPath(); cx.arc(bx, by, 34, 0, 7); cx.fill();
    emoji('🛏️', bx, by + 16, 32);
    cx.fillStyle = '#1d1d1f'; cx.font = 'bold 14px system-ui,sans-serif'; cx.textAlign = 'center'; cx.fillText('×' + beds, bx + 22, by + 14);
    cx.globalAlpha = 1;
    // всплывающие надписи
    cx.textAlign = 'center'; cx.textBaseline = 'bottom'; cx.font = 'bold 22px system-ui,sans-serif'; cx.lineJoin = 'round';
    toasts.slice(-3).forEach((s, i, a) => {
      const y = H * .36 + (i - a.length) * 30 - (1.3 - s.t) * 24, sc = 1 + Math.max(0, s.t - 1.1) * 2;
      cx.globalAlpha = Math.min(1, s.t * 2); cx.save(); cx.translate(W / 2, y); cx.scale(sc, sc);
      cx.strokeStyle = '#0b1430'; cx.lineWidth = 5; cx.strokeText(s.s, 0, 0); cx.fillStyle = '#fff'; cx.fillText(s.s, 0, 0); cx.restore();
    });
    cx.globalAlpha = 1;
    if (st === 'run') drawHint(now);
    if (doze > 0) { cx.font = 'bold 20px system-ui,sans-serif'; cx.strokeStyle = '#0b1430'; cx.lineWidth = 4; cx.fillStyle = '#fff'; const s = beds ? 'Уснул! Жми 🛏️' : 'Уснул на ходу…'; cx.strokeText(s, W / 2, H * .5); cx.fillText(s, W / 2, H * .5); }
  }

  // ——— экраны ———
  function show(html, kind = 'kr-card') { panel.className = 'kr-p ' + kind; panel.innerHTML = html; panel.hidden = !html; logo.hidden = st !== 'intro'; }
  function intro() {
    show(`${best ? `<div style="text-align:center;font-weight:700;color:#8a6d4a;margin:-2px 0 10px">🏆 рекорд ${best}</div>` : ''}
      <div style="text-align:center;font-weight:800;font-size:17px;margin-bottom:10px">От кого бежим?</div>
      <div class="kr-who">${Object.entries(CHASERS).map(([id, c]) => `<button data-a="go" data-v="${id}" class="${id === who ? 'on' : ''}">${c.mult > 1 ? `<em>×${c.mult}</em>` : ''}<b>${c.face}</b><span>${c.name}</span><i>${c.note}</i></button>`).join('')}</div>
      <div style="text-align:center;margin-top:6px"><button data-a="learn" class="kr-link">🎓 Как играть</button></div>`, 'kr-sheet');
  }
  // рекорды недели: у кого больше — выше; свой выделен
  function table() {
    const r = Object.entries(week() || {}).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
    return `<div style="font-weight:700;margin:4px 0">📬 Рекорды недели</div>` + (r.length
      ? r.slice(0, 6).map(([n, v], i) => `<div style="display:flex;justify-content:space-between;${n === me() ? 'font-weight:700;color:#c46a00' : ''}"><span>${i ? i + 1 + '.' : '👑'} ${esc(n)}</span><span>${v}</span></div>`).join('')
      : '<div style="color:#6e6e73">Пока никого — будь первым</div>');
  }
  function over() {
    st = 'over'; buzz([80, 60, 80]); sfx.over(); hint = null;
    const s = score(), rec = s > best, my = (week() || {})[me()] || 0;
    if (rec) save('karychBest', best = s);
    const p = paper();
    const note = !me() ? 'Войди в Соцочку — попадёшь в рекорды недели' : s > my ? 'Сохраняю рекорд недели…' : '';
    show(`<div style="font-size:15px;font-weight:700;color:#8a6d4a">${CH.face} ${CH.got}</div>
      <div style="font:900 56px/1.1 system-ui,sans-serif;margin:4px 0;color:${rec ? '#e07800' : '#1d1d1f'}">${s}</div>
      <div style="font-weight:700;margin-bottom:4px">${rec ? '🎉 Личный рекорд!' : `рекорд ${best} · ещё ${best - s + 1} до нового`}</div>
      <div style="color:#6e6e73;font-size:14px;margin-bottom:12px">✉️ ${sent} писем · 🚭 ${Math.floor((dist - smokeAt) / 2)} м без сигарет</div>
      ${p && p.rolls <= 2 ? `<p style="margin:0 0 12px;color:#e5484d;font-weight:600">🧻 Ты тут сидишь, а бумаги осталось ${p.rolls}. Староста — ${esc(boss())}</p>` : ''}
      <div style="display:grid;gap:8px;margin-bottom:12px">
        <button data-a="go" data-v="${who}" class="kr-big">▶ Ещё раз</button>
        ${rolls && !cont ? `<button data-a="cont" class="kr-sec">Продолжить за 🧻 (есть ${rolls})</button>` : ''}
      </div>
      <div data-top style="font-size:14px;text-align:left;background:#f3ecdf;border-radius:14px;padding:10px 12px">${table()}${note ? `<div style="color:#6e6e73;margin-top:4px">${note}</div>` : ''}</div>
      <button data-a="menu" class="kr-link" style="margin-top:6px">Сменить преследователя</button>`);
    if (me() && s > my) submit(s).then(ok => { const el = panel.querySelector('[data-top]'); if (el) el.innerHTML = table() + (ok ? '' : '<div style="color:#e5484d;margin-top:4px">Не сохранилось — нет связи</div>'); });
  }
  function go(id) { if (CHASERS[id]) save('karychWho', who = id); CH = CHASERS[who]; reset(); st = 'run'; paused = false; show(''); tone(1, .01, 'sine', .0001); }

  panel.onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'go') go(b.dataset.v);
    if (a === 'learn') { learn = true; seen = ''; save('karychSeen', ''); go(who); }
    if (a === 'menu') { st = 'intro'; reset(); intro(); }
    if (a === 'cont') { rolls--; cont = true; gap = .6; doze = cramp = rage = 0; sleep = Math.min(sleep, .5); ents = ents.filter(e => e.k === 'box' || e.at - dist > 15); st = 'run'; show(''); }
    if (a === 'resume') { paused = false; show(''); }
  };
  root.querySelector('[data-x]').onclick = close;

  // управление: свайп срабатывает сразу, как палец ушёл на 24 px; короткое касание — бросок или кнопка кровати
  let p0 = null;
  cv.onpointerdown = e => { p0 = [e.clientX, e.clientY]; };
  cv.onpointermove = e => {
    if (!p0 || st !== 'run' || paused) return;
    const dx = e.clientX - p0[0], dy = e.clientY - p0[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    p0 = null;
    act(Math.abs(dx) > Math.abs(dy) ? () => move(Math.sign(dx)) : dy < 0 ? up : down);
  };
  cv.onpointerup = e => {
    if (!p0 || st !== 'run' || paused) return;
    p0 = null;
    Math.hypot(e.clientX - (W - 52), e.clientY - (H - 62)) < 44 ? act(rest) : act(toss);
  };
  const keys = e => {
    if (e.key === 'Escape') return close();
    if (st !== 'run' || paused) return;
    const f = {ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: up, ArrowDown: down, ' ': toss, b: rest, и: rest}[e.key];
    if (f) { e.preventDefault(); act(f); }
  };
  // свернул приложение или погас экран — пауза
  const hide = () => { if (document.hidden && st === 'run' && !paused) { paused = true; show(`<div style="font-size:22px;font-weight:800;margin-bottom:14px">⏸ Пауза</div><button data-a="resume" class="kr-big">▶ Продолжить</button>`); } };
  addEventListener('resize', fit); addEventListener('keydown', keys); document.addEventListener('visibilitychange', hide);
  function close() {
    cancelAnimationFrame(raf); root.remove(); document.body.style.overflow = was;
    removeEventListener('resize', fit); removeEventListener('keydown', keys); document.removeEventListener('visibilitychange', hide);
    scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); });
    R.dispose(); R.forceContextLoss();
  }

  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (!document.hidden && dt > 0 && (ft += dt, ++fr) >= 90) { if (ft / fr > 1 / 50 && q < 3) { q++; if (q === 3) R.shadowMap.enabled = false, scene.traverse(o => o.material && (o.material.needsUpdate = true)); fit(); } fr = ft = 0; }
    if (st === 'run' && !paused) { spawn(); step(dt); }
    draw(); hud(); raf = requestAnimationFrame(loop);
    const w = st === 'run' && tut >= 0 && hint ? TUT[tut].need : st; // для автотеста: чего ждёт игра
    if (root.dataset.wait !== w) root.dataset.wait = w;
  };
  reset(); spawn(); intro(); raf = requestAnimationFrame(loop);
}
})();
