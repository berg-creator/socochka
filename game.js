// Карыч: Доставка — мини-игра раздела 🧻 (index.html грузит этот файл только по кнопке «🎮»).
// Мир в 3D: three.js (через importmap в index.html — ядро и аддоны одним экземпляром) и модели assets/karych/*.glb грузятся вместе с игрой.
// Три полосы (−1, 0, 1), Карыч всегда стоит в z = 0, дорога едет навстречу:
// e.at — место предмета на дороге в метрах, z = at − dist — сколько до него впереди (в сцене это −z). HUD и экраны — 2D/HTML поверх.
// Черты Карыча: разносит письма (тап — бросок в ящик), вечно спит (шкала 😪, кровать 🛏️),
// срывает спину (частые наклоны → прострел), бросил курить (обходишь 🚬 — растёт множитель). Гонятся: бабушка, Жёлтый Король, Димон.
// Первый забег — обучение прямо в игре: перед препятствием время замирает, пока не сделаешь нужный жест
// Персонажи — Quaternius «Ultimate Animated Character Pack» (CC0, quaternius.com), перекрашены и одеты кодом. Скелет у всех один,
// поэтому клипы (бег, прыжок, кувырок…) лежат только в kar.glb, остальные берут их оттуда. Звук и музыка синтезируются на лету.
(() => {
const MV = 1; // версия моделей: поменял .glb — подними
const MODELS = {kar: 290e3, baba: 120e3, king: 125e3, dimon: 70e3}; // примерный вес — для полосы загрузки, если сервер не скажет
let lib, busy;
window.karych = api => {
  if (busy) return; busy = true;
  A(); // звук будим ещё внутри нажатия — иначе iPhone его не пустит
  const ld = loading();
  (lib ||= loadAll(ld.set)).then(L => { busy = false; game(L, api); ld.done(); },
    e => { console.error(e); lib = busy = null; ld.done(); alert('Игра не загрузилась — проверь интернет'); });
};
// экран загрузки — пока тянутся three.js и модели
function loading() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:1001;background:linear-gradient(#9db8e6,#f4c9a8 55%,#f2c4a0);display:grid;place-content:center;justify-items:center;gap:18px;color:#fff;font:15px/1.4 system-ui,sans-serif;text-shadow:0 3px 0 #b8562a,0 6px 24px #7a2e1088';
  d.innerHTML = `<div style="font:900 48px/1 system-ui,sans-serif;letter-spacing:-1px">Карыч</div><div style="font:800 17px/1 system-ui,sans-serif;letter-spacing:6px;text-transform:uppercase;margin-top:-10px">доставка</div>
    <div style="width:220px;height:12px;border-radius:6px;background:#ffffff55;overflow:hidden;box-shadow:0 2px 8px #7a2e1033"><i style="display:block;height:100%;width:3%;border-radius:6px;background:linear-gradient(#ffb93a,#f08c0c);transition:width .2s"></i></div>
    <div data-pc style="font-weight:700;font-size:14px">Будим Карыча… 0%</div>`;
  document.body.append(d);
  const bar = d.querySelector('i'), pc = d.querySelector('[data-pc]');
  return {set: v => { const p = Math.round(Math.min(1, v) * 100); bar.style.width = Math.max(3, p) + '%'; pc.textContent = `Будим Карыча… ${p}%`; }, done: () => d.remove()};
}
async function loadAll(set) {
  const got = {}, size = {...MODELS}; let mods = 0;
  const tick = () => set(mods / 5 * .3 + .7 * Object.values(got).reduce((a, b) => a + b, 0) / Object.values(size).reduce((a, b) => a + b, 0));
  const mod = p => import(p).then(m => (mods++, tick(), m));
  // модель качаем сами, чтобы видеть прогресс; разбирает её GLTFLoader
  const fetchModel = async n => {
    const r = await fetch(new URL(`assets/karych/${n}.glb?v=${MV}`, document.baseURI)); if (!r.ok) throw new Error(n + ': ' + r.status);
    size[n] = +r.headers.get('content-length') || size[n];
    const rd = r.body.getReader(), parts = []; got[n] = 0;
    for (;;) { const {done, value} = await rd.read(); if (done) break; parts.push(value); got[n] += value.length; tick(); }
    const buf = new Uint8Array(got[n]); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    return buf.buffer;
  };
  const files = Promise.all(Object.keys(MODELS).map(fetchModel));
  const [T, {GLTFLoader}, {MeshoptDecoder}, SU, {RoundedBoxGeometry}] = await Promise.all(['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/libs/meshopt_decoder.module.js', 'three/addons/utils/SkeletonUtils.js', 'three/addons/geometries/RoundedBoxGeometry.js'].map(mod));
  const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), bufs = await files, models = {};
  await Promise.all(Object.keys(MODELS).map((n, i) => gl.parseAsync(bufs[i], '').then(g => { models[n] = g; })));
  return {T, SU, RB: RoundedBoxGeometry, models, clips: models.kar.animations};
}

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

// ——— звук: всё синтезируется WebAudio, без файлов. Шина: эффекты + музыка → компрессор, немного «дворового» эха ———
let ac, out, bus, mbus, musF, nbuf, muted = load('karychMute') === '1', musicOn = load('karychMusic') !== '0';
function A() {
  if (!ac) try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .18;
    out = ac.createGain(); out.gain.value = muted ? 0 : .9; out.connect(comp).connect(ac.destination);
    const len = ac.sampleRate * 1.4 | 0, ir = ac.createBuffer(2, len, ac.sampleRate); // эхо двора: импульс — затухающий шум
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4; }
    const rev = ac.createConvolver(), rg = ac.createGain(); rev.buffer = ir; rg.gain.value = .5; rev.connect(rg).connect(out);
    bus = ac.createGain(); bus.connect(out); const s1 = ac.createGain(); s1.gain.value = .22; bus.connect(s1).connect(rev);
    musF = ac.createBiquadFilter(); musF.type = 'lowpass'; musF.frequency.value = 18000; musF.Q.value = .8;
    mbus = ac.createGain(); mbus.gain.value = .26; mbus.connect(musF).connect(out); const s2 = ac.createGain(); s2.gain.value = .12; musF.connect(s2).connect(rev);
    nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  } catch { ac = null; return null; }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
const now0 = () => !muted && A() ? ac.currentTime + .01 : null;
// частота или кривая [[сдвиг, значение], …] — между точками плавно (по экспоненте)
function curve(p, t, v) {
  if (!Array.isArray(v)) return p.setValueAtTime(v, t);
  v.forEach(([d, x], i) => i ? p.exponentialRampToValueAtTime(x, t + d) : p.setValueAtTime(x, t + d));
}
// огибающая: быстрый вход, дальше затухание (или держим и отпускаем — sus)
function env(g, t, a, dur, v, sus) {
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
  if (sus) { g.gain.setValueAtTime(v, t + Math.max(a, dur - .07)); g.gain.linearRampToValueAtTime(0, t + dur); }
  else g.gain.exponentialRampToValueAtTime(.0001, t + dur);
}
// осциллятор: тип, частота, начало, длина, громкость; vib — вибрато [Гц, глубина], am — «хрип» [Гц, глубина], lp/bp/hp — фильтр
function O(type, f, t, dur, vol, {a = .005, sus, det = 0, vib, am, lp, bp, hp, q = 1, to = bus} = {}) {
  const o = ac.createOscillator(), g = ac.createGain(), end = t + dur + .05;
  o.type = type; curve(o.frequency, t, f); o.detune.value = det;
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg).connect(o.frequency); l.start(t); l.stop(end); }
  let n = o;
  if (lp || bp || hp) { const fl = ac.createBiquadFilter(); fl.type = lp ? 'lowpass' : bp ? 'bandpass' : 'highpass'; curve(fl.frequency, t, lp || bp || hp); fl.Q.value = q; n = n.connect(fl); }
  if (am) { const m = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); m.gain.value = 1 - am[1]; l.frequency.value = am[0]; lg.gain.value = am[1]; l.connect(lg).connect(m.gain); n = n.connect(m); l.start(t); l.stop(end); }
  env(g, t, a, dur, vol, sus); n.connect(g).connect(to); o.start(t); o.stop(end);
}
// шум через фильтр: шорох, удар, шипение
function N(t, dur, vol, {type = 'bandpass', f = 1000, q = 1, a = .003, sus, to = bus} = {}) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nbuf; s.loop = true; fl.type = type; curve(fl.frequency, t, f); fl.Q.value = q;
  env(g, t, a, dur, vol, sus); s.connect(fl).connect(g).connect(to); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}
// голосок: пила через три форманты гласной — «ой», «ай», «ням». pitch и vow — кривые [[сдвиг, Гц|гласная], …]; k — выше/ниже голос
const VOW = {a: [800, 1200, 2700], o: [480, 850, 2600], u: [330, 700, 2400], e: [450, 1900, 2600], i: [300, 2250, 3000], y: [360, 1450, 2400]};
function voice(t, pitch, vow, dur, vol, {k = 1, to = bus} = {}) {
  const o = ac.createOscillator(), g = ac.createGain(), pre = ac.createGain(), end = t + dur + .05;
  o.type = 'sawtooth'; curve(o.frequency, t, pitch);
  const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6.5; lg.gain.value = 6; l.connect(lg).connect(o.frequency); l.start(t); l.stop(end);
  o.connect(pre);
  [[7, 1], [10, .55], [14, .22]].forEach(([q, v], i) => {
    const b = ac.createBiquadFilter(), bg = ac.createGain(); b.type = 'bandpass'; b.Q.value = q; bg.gain.value = v;
    vow.forEach(([d, w], j) => j ? b.frequency.linearRampToValueAtTime(VOW[w][i] * k, t + d) : b.frequency.setValueAtTime(VOW[w][i] * k, t + d));
    pre.connect(b).connect(bg).connect(g);
  });
  env(g, t, .02, dur, vol, true); g.connect(to); o.start(t); o.stop(end);
}
// колокольчик: неровные обертоны с разным затуханием
function bell(t, f, vol, to = bus) { [[1, 1, 1.1], [2.76, .45, .5], [5.4, .22, .22], [8.9, .1, .12]].forEach(([m, v, d]) => O('sine', f * m, t, d, vol * v, {a: .002, to})); }
// медь: пила, фильтр раскрывается — труба/тромбон
function brass(t, f, dur, vol, {vib, to = bus} = {}) {
  O('sawtooth', f, t, dur, vol, {a: .03, sus: true, vib, lp: [[0, 500], [.06, 2600], [dur, 1100]], q: 1.5, to});
  O('sawtooth', f, t, dur, vol * .5, {a: .03, sus: true, det: 9, lp: 1600, to});
}
const sfx = {
  move: () => { const t = now0(); if (t == null) return; N(t, .13, 1.1, {f: [[0, 500], [.13, 2600]], q: 1.2}); O('sine', [[0, 480], [.08, 1050]], t, .09, .1); },
  // «бо-о-оинг»: пружинка вверх
  jump: () => { const t = now0(); if (t == null) return; O('triangle', [[0, 170], [.1, 520], [.34, 400]], t, .36, .2, {vib: [22, 45]}); O('sine', [[0, 85], [.1, 260]], t, .18, .14); },
  // пригнулся/кувырок: свисток вниз и шорох
  duck: () => { const t = now0(); if (t == null) return; O('sine', [[0, 1600], [.28, 420]], t, .3, .17, {vib: [9, 30]}); N(t, .22, .3, {f: [[0, 3200], [.22, 700]], q: .7}); },
  land: () => { const t = now0(); if (t == null) return; O('sine', [[0, 160], [.1, 55]], t, .12, .4); N(t, .06, .15, {type: 'lowpass', f: 900}); },
  toss: () => { const t = now0(); if (t == null) return; O('sine', [[0, 900], [.15, 2200]], t, .16, .2); N(t, .14, .4, {f: 4200, q: 2}); },
  // в ящик: «бумц» крышки и «дзынь»; заказное — ещё монетки
  mail: big => { const t = now0(); if (t == null) return; N(t, .07, .3, {type: 'lowpass', f: 700}); O('square', [[0, 190], [.06, 95]], t, .07, .07, {lp: 900});
    bell(t + .05, 1568, .16); bell(t + .14, 2093, .14); if (big) [2637, 3136, 4186].forEach((f, i) => bell(t + .24 + i * .07, f, .1)); },
  pick: k => { const t = now0(); if (t == null) return;
    if (k === 'bag') { N(t, .16, .16, {type: 'highpass', f: 2800}); O('sine', [[0, 500], [.08, 1300]], t, .09, .2); bell(t + .07, 1319, .14); }
    else if (k === 'roll') { O('sine', [[0, 280], [.05, 950], [.14, 620]], t, .16, .26); bell(t + .06, 1047, .12); }
    else if (k === 'pillow') { N(t, .3, .22, {type: 'lowpass', f: [[0, 800], [.3, 180]]}); [523, 659, 784, 1047].forEach((f, i) => O('triangle', f, t + .05 + i * .06, .35, .07)); }
    else if (k === 'lolly') { N(t, .06, .2, {f: 2500, q: 3}); [0, .2].forEach(d => voice(t + .06 + d, [[0, 360], [.12, 420]], [[0, 'i'], [.05, 'a']], .14, .9, {k: 1.25})); }
  },
  // «кхе-кхе-кхе»
  cough: () => { const t = now0(); if (t == null) return; for (let i = 0; i < 3; i++) { const d = i * .2; N(t + d, .13, .45, {f: 950 - i * 90, q: 1.6}); voice(t + d, [[0, 190], [.12, 140]], [[0, 'a'], [.1, 'e']], .13, .45); } },
  // удары: у каждого препятствия свой, плюс «ой!»
  hit: k => { const t = now0(); if (t == null) return;
    O('sine', [[0, 540], [.09, 170]], t, .13, .45); N(t, .05, .3, {type: 'lowpass', f: 2200});
    if (k === 'wall') { [523, 769, 1093, 1340].forEach((f, i) => O('triangle', f, t, .5 - i * .08, .07)); voice(t + .06, [[0, 270], [.16, 190]], [[0, 'o'], [.13, 'i']], .24, 1); }
    else if (k === 'low') { for (let i = 0; i < 3; i++) N(t + .06 + i * .08, .08, .3, {f: 380 + i * 160, q: 3}); voice(t + .05, [[0, 210], [.18, 150]], [[0, 'u'], [.12, 'u']], .2, .9); }
    else if (k === 'line') { N(t, .2, .35, {f: [[0, 1300], [.2, 380]], q: .8}); N(t + .22, .1, .25, {type: 'highpass', f: 2500}); voice(t + .26, [[0, 240], [.1, 200]], [[0, 'u'], [.08, 'u']], .12, .8); }
    else if (k === 'slip') { N(t, .05, .6, {type: 'highpass', f: 1600}); voice(t + .04, [[0, 330], [.22, 250]], [[0, 'a'], [.16, 'i']], .26, 1); }
    else voice(t + .05, [[0, 260], [.15, 190]], [[0, 'o'], [.12, 'i']], .22, 1);
  },
  // прострел: хруст и «ай-яй-яй»
  ouch: () => { const t = now0(); if (t == null) return; for (let i = 0; i < 3; i++) N(t + i * .03, .02, .5, {type: 'highpass', f: 3000});
    for (let i = 0; i < 3; i++) voice(t + .1 + i * .17, [[0, 320 - i * 30], [.13, 270 - i * 30]], [[0, i ? 'i' : 'a'], [.04, 'a'], [.1, 'i']], .15, .9); },
  // уснул на ходу: зевок
  yawn: () => { const t = now0(); if (t == null) return; voice(t, [[0, 160], [.45, 235], [1.1, 130]], [[0, 'a'], [.7, 'a'], [1.05, 'o']], 1.15, .75); N(t + .1, 1, .05, {f: 1200, q: .6}); },
  // храп: «хр-р-р» — и свисток «пью»
  snore: () => { const t = now0(); if (t == null) return; O('sawtooth', [[0, 62], [.8, 75]], t, .85, .2, {lp: 420, am: [27, .8], a: .25, sus: true}); N(t, .85, .07, {f: 520, q: 1.2, a: .25, sus: true});
    O('sine', [[0, 650], [.5, 1350]], t + 1, .55, .06, {vib: [6, 18], a: .08}); },
  bed: () => { const t = now0(); if (t == null) return; [392, 523, 659, 784].forEach((f, i) => bell(t + i * .1, f * 2, .08)); N(t, .4, .15, {type: 'lowpass', f: [[0, 900], [.4, 200]]}); },
  // рекорд: фанфара
  rec: () => { const t = now0(); if (t == null) return; [523, 659, 784].forEach((f, i) => brass(t + i * .11, f, .12, .08)); brass(t + .33, 1047, .55, .09, {vib: [6, 8]}); N(t + .33, .7, .05, {type: 'highpass', f: 6000}); },
  // проигрыш: грустный тромбон «уа-уа-уа-уа-а-а»
  over: () => { const t = now0(); if (t == null) return; [392, 370, 349].forEach((f, i) => brass(t + i * .38, f / 2, .34, .14)); brass(t + 1.14, 165, 1.2, .14, {vib: [5.5, 7]}); },
  ok: () => { const t = now0(); if (t == null) return; bell(t, 1319, .14); bell(t + .09, 1760, .14); },
  miss: () => { const t = now0(); if (t == null) return; O('triangle', [[0, 620], [.22, 290]], t, .24, .13); O('triangle', [[0, 470], [.3, 220]], t + .2, .32, .11); },
  // тапок летит: свист падающей бомбы; мимо — шлёп об асфальт
  whistle: () => { const t = now0(); if (t == null) return; O('sine', [[0, 2300], [1, 650]], t, 1, .07, {vib: [7, 22], a: .1, sus: true}); },
  thud: () => { const t = now0(); if (t == null) return; N(t, .06, .4, {type: 'highpass', f: 1200}); O('sine', [[0, 190], [.08, 70]], t, .1, .22); },
  // Король ставит барьер: «ту-ру-ру!»
  fanfare: () => { const t = now0(); if (t == null) return; brass(t, 523, .1, .09); brass(t + .12, 523, .07, .09); brass(t + .21, 784, .32, .1, {vib: [6, 6]}); },
  // Димон звереет: рык и пар из ушей
  growl: () => { const t = now0(); if (t == null) return; O('sawtooth', [[0, 88], [.55, 72]], t, .6, .26, {lp: 700, am: [31, .7], a: .03, sus: true}); voice(t, [[0, 95], [.5, 80]], [[0, 'y'], [.5, 'a']], .55, .6, {k: .85}); N(t + .25, .6, .1, {type: 'highpass', f: 4500}); },
  phew: () => { const t = now0(); if (t == null) return; N(t, .65, .22, {f: [[0, 1300], [.65, 450]], q: .7}); voice(t + .05, [[0, 150], [.5, 105]], [[0, 'u'], [.5, 'u']], .55, .35); },
  // старт погони: судейский свисток с трелью
  start: () => { const t = now0(); if (t == null) return; O('sine', 2950, t, .5, .09, {vib: [32, 140], a: .01, sus: true}); O('sine', 2950, t + .55, .25, .08, {vib: [32, 140], a: .01, sus: true}); },
  tap: () => { const t = now0(); if (t == null) return; O('sine', [[0, 900], [.04, 1300]], t, .05, .25); },
};

// ——— музыка: дворовая полька-погоня собственного сочинения. Туба на раз, аккорд на два, аккордеон ведёт мелодию;
// второй круг мелодию насвистывают. Темп растёт со скоростью, во сне всё глухо (фильтр). В меню — тихий колокольчик ———
const SONG = {
  // бас (тоника, квинта) и аккорд на такт: Am Dm E Am | C G F E
  ch: [[45, 40, [57, 60, 64]], [38, 45, [57, 62, 65]], [40, 47, [56, 59, 64]], [45, 40, [57, 60, 64]], [36, 43, [55, 60, 64]], [43, 38, [55, 59, 62]], [41, 36, [57, 60, 65]], [40, 47, [56, 59, 64]]],
  // мелодия восьмыми: нота MIDI, 0 — тянуть, −1 — пауза
  mel: [[76, 0, 69, 71, 72, 74, 76, 0], [77, 0, 74, 0, 77, 76, 74, 72], [71, 0, 68, 71, 74, 0, 72, 71], [69, 0, 72, 0, 76, 0, -1, -1],
    [72, 74, 76, 72, 79, 0, 76, 0], [74, 76, 77, 74, 79, 0, 74, 0], [77, 76, 74, 72, 81, 0, 77, 0], [76, 0, 75, 76, 80, 0, 83, -1]],
};
const mf = m => 440 * 2 ** ((m - 69) / 12);
const mus = {mode: 'off', step: 0, next: 0};
function music(mode, bpm, dream) {
  if (!ac || muted || !musicOn) mode = 'off';
  if (mode !== mus.mode) { mus.mode = mode; mus.step = 0; mus.next = 0; }
  if (!ac) return;
  if (dream !== mus.dream) { mus.dream = dream; musF.frequency.setTargetAtTime(dream ? 600 : 18000, ac.currentTime, .3); }
  if (mode === 'off' || ac.state !== 'running') return;
  const now = ac.currentTime, sl = 30 / bpm; // длина восьмой
  if (mus.next < now) mus.next = now + .05;
  while (mus.next < now + .2) { beat(mus.step++, mus.next, mode === 'run', sl); mus.next += sl; }
}
function beat(s, t, run, sl) {
  const bar = (s >> 3) % 8, e = s & 7, round = s >> 6, [r, f5, tri] = SONG.ch[bar], to = mbus;
  if (e === 0 || e === 4) { const f = mf(e ? f5 : r); O('sawtooth', f, t, sl * 1.5, run ? .14 : .08, {lp: 380, q: 2, a: .02, sus: true, to}); O('sine', f, t, sl * 1.6, run ? .22 : .14, {a: .01, sus: true, to}); }
  if (run) {
    if (e === 2 || e === 6) tri.forEach(n => O('square', mf(n), t, sl * .6, .022, {lp: 1800, to}));
    if (e === 0 || e === 4) O('sine', [[0, 150], [.1, 48]], t, .14, .32, {to});
    if (e === 2 || e === 6 || (bar === 7 && e > 4)) { N(t, .09, .1, {f: 2100, q: .7, to}); O('triangle', [[0, 250], [.05, 170]], t, .06, .05, {to}); }
    if (e & 1) N(t, .03, .03, {type: 'highpass', f: 7500, to});
  }
  const n = SONG.mel[bar][e]; if (n <= 0) return;
  let len = 1; while (e + len < 8 && SONG.mel[bar][e + len] === 0) len++;
  const f = mf(n), d = len * sl;
  if (!run) { if (round % 2 === 0 || bar < 4) bell(t, f * 2, .05, to); return; }
  if (round % 2) return O('sine', f * 2, t, d * .95, .05, {a: .03, sus: true, vib: [5.5, f * .025], to}); // насвистывает
  O('sawtooth', f, t, d * .95, .035, {det: -8, lp: 2400, a: .025, sus: true, vib: [5.5, f * .006], to}); // аккордеон: два голоса чуть врозь
  O('sawtooth', f, t, d * .95, .035, {det: 8, lp: 2400, a: .025, sus: true, to});
  O('square', f / 2, t, d * .95, .015, {lp: 1100, a: .025, sus: true, to});
}
// ——— конец звука ———

function game(L, {paper, boss, me, week, submit}) {
  const T = L.T;
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
    <button data-mus aria-label="Музыка" style="position:absolute;top:10px;right:106px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0005;color:#fff;font-size:17px">🎵</button>
    <button data-snd aria-label="Звук" style="position:absolute;top:10px;right:58px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0005;color:#fff;font-size:17px"></button>
    <button data-x aria-label="Закрыть" style="position:absolute;top:10px;right:10px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0005;color:#fff;font-size:18px">✕</button>
    <div data-panel class="kr-p"></div>`;
  root.prepend(gl); gl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  document.body.append(root);
  const cv = root.querySelector('[data-hud]'), cx = cv.getContext('2d'), panel = root.querySelector('[data-panel]'), logo = root.querySelector('[data-logo]'), snd = root.querySelector('[data-snd]'), mb = root.querySelector('[data-mus]');
  const was = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const sndIcon = () => { snd.textContent = muted ? '🔇' : '🔊'; mb.style.opacity = musicOn && !muted ? 1 : .45; };
  sndIcon();
  snd.onclick = () => { muted = !muted; save('karychMute', muted ? '1' : ''); sndIcon(); if (A()) out.gain.value = muted ? 0 : .9; };
  mb.onclick = () => { musicOn = !musicOn; save('karychMusic', musicOn ? '' : '0'); sndIcon(); A(); };
  for (const ev of ['pointerdown', 'touchend']) root.addEventListener(ev, () => A()); // телефон пускает звук только после касания

  // качество подстраивается под телефон: не тянет 50 кадров/с — меньше пикселей, потом без теней
  const DPR = [2, 1.5, 1, 1];
  const showFps = /[?&]fps\b/.test(location.search); // ?fps в адресе — счётчик кадров для проверки на телефоне
  let fpsN = 0, fpsT = 0, fpsV = 0, snoreT = 0;
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
  let back, cramp, streak, smokeAt, slip, slipT, kingT, rage, calm, shake, hurt, sparks, pillowT, pillowN;
  let tut = -1, tutE, tutOk, hint, slo = 1, recT, land = 0, seen = load('karychSeen'), learn = false;
  function reset() {
    t = dist = jump = duck = sleep = doze = bed = beds = rolls = pts = sent = slow = back = cramp = streak = smokeAt = rage = calm = 0;
    ents = []; toasts = []; flies = []; queue = []; nextRow = 28; nextBox = 14; lane = px = gx = 0;
    shake = hurt = 0; sparks = []; pillowT = 25; pillowN = 0;
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
      if (Math.random() < .35) {
        const r = Math.random();
        let k = r < .35 ? 'bag' : r < .52 ? 'roll' : r < .64 ? 'pillow' : r < .88 ? 'cig' : 'lolly';
        // кровать — редкость: не раньше 25 с, потом не чаще раза в 30–45 с, и каждая следующая — ещё на 8 с позже (до +40).
        // Иначе на скорости за 7 с сна собирается новая подушка, и забег не кончается
        if (k === 'pillow') { if (t < pillowT || beds >= 2) k = 'lolly'; else pillowT = t + rnd(30, 45) + 8 * Math.min(5, pillowN++); }
        ents.push({k, lane: free[0], at: nextRow});
      }
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
    if ((back += .3) >= 1) { back = 0; cramp = 3; duck = 0; buzz(150); sfx.ouch(); toast('🦴 Прострел! Не нагнуться'); }
  }
  // уснул на ходу — руки слушаются с опозданием
  const act = f => doze > 0 ? queue.push([t + .35, f]) : f();

  function hit(n, msg, kind) {
    if (bed > 0 || st !== 'run') return;
    slow = .8; shake = .35; hurt = .5; buzz(60); sfx.hit(kind);
    if (tut >= 0) return toast('Ой! Ещё разок');
    if (who === 'dimon') { n *= 1 + rage * .25; if (rage < 3) { rage++; msg += ' Димон звереет 😡'; sfx.growl(); } calm = 0; }
    gap -= n; toast(msg);
    if (doze > 0) { doze = 0; sleep = .35; }
    if (gap <= 0) over();
  }
  // искры — в координатах дороги (x, высота y, at), летят и падают
  const burst = (x, y, at, c, n = 16) => { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = rnd(1.5, 4); sparks.push({x, y, at, vx: Math.cos(a) * v, vy: rnd(2, 5.5), va: Math.sin(a) * v, r: rnd(.6, 1.4), l: 1, c}); } };
  function take(e) {
    e.gone = true; burst(e.lane, .5, e.at, e.k === 'cig' ? '#ff7a5a' : '#ffe08a');
    e.k === 'cig' ? sfx.cough() : sfx.pick(e.k);
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
    if (tut < 0 && bed <= 0 && doze <= 0 && (sleep += dt / 28) >= 1) { sleep = 1; doze = 4; buzz(200); sfx.yawn(); toast('😴 Уснул на ходу!'); }
    // погоня: бежишь чисто — отстаёт, уснул или прострел — нагоняет
    if (tut < 0) {
      const away = who === 'dimon' ? CH.back - rage * .015 : CH.back;
      gap = Math.min(1, gap + dt * (bed > 0 ? .06 : doze > 0 ? -.07 : cramp > 0 ? -.05 : away));
      if (gap <= 0) return over();
      if (who === 'dimon' && rage && (calm += dt) > 7) { rage--; calm = 0; toast('👴 Димон выдыхается'); sfx.phew(); }
    }
    px += Math.sign(lane - px) * Math.min(Math.abs(lane - px), dt * 9);
    gx += (px - gx) * Math.min(1, dt * 3);
    if (jump > 0 && (jump -= dt) <= 0) { land = .2; sfx.land(); burst(px, .05, dist, '#e8dccb', 8); }
    if (duck > 0) duck -= dt;
    queue = queue.filter(([at, f]) => at > t || (f(), false));

    if (tut < 0) {
      // бабушка близко — метка на полосе Карыча, через секунду туда прилетает 🩴
      if (who === 'baba' && t > 20 && gap < .85 && bed <= 0 && (slipT -= dt) <= 0) { slip = {lane: mine(), t: 1.1}; slipT = rnd(9, 14); sfx.whistle(); }
      // Король ставит 🚧 на полосу Карыча метрах в 26 впереди, там, где рядом нет других преград
      if (who === 'king' && t > 15 && bed <= 0 && (kingT -= dt) <= 0) {
        const at = dist + 26;
        if (!ents.some(e => !(e.k in ITEMS) && e.k !== 'box' && Math.abs(e.at - at) < 3)) { ents.push({k: 'wall', lane: mine(), at, king: true}); toast('🤴 Король ставит преграду!'); sfx.fanfare(); }
        kingT = rnd(6, 9);
      }
    }
    if (slip && (slip.t -= dt) <= 0) { if (mine() === slip.lane) hit(.2, '🩴 Тапком!', 'slip'); else sfx.thud(); slip = null; }

    // поравнялись с предметом — проверяем один раз
    const l = mine(), y = jy();
    for (const e of ents) {
      if (e.k === 'box') { if (bed > 0 && letters && reach(e, e.side)) throwAt(e); continue; } // во сне разносит сам
      if (e.passed || e.at - dist > .3) continue;
      e.passed = true;
      if (e.k === 'cig') { bed <= 0 && e.lane === l && y < .5 ? take(e) : avoid(); continue; }
      // во сне собирает со всех полос — кроме подушки: её только наяву и только на своей полосе
      if (e.k in ITEMS) { if (e.k === 'pillow' ? bed <= 0 && e.lane === l : bed > 0 || e.lane === l) take(e); continue; }
      if (e.lane !== l || bed > 0) continue;
      if (e.k === 'wall') { e.gone = true; hit(.45, '💥 Врезался!', 'wall'); }
      else if (e.k === 'low' && y < .5) { e.gone = true; hit(.3, '📦 Споткнулся!', 'low'); }
      else if (e.k === 'line' && duck <= 0) { e.gone = true; hit(.3, '👕 Бельё в лицо!', 'line'); }
    }
    ents = ents.filter(e => e.at - dist > -3);

    for (const f of flies) if ((f.t += dt) >= .3 && !f.end) {
      f.end = true;
      if (f.box) { const p = (f.box.reg ? 30 : 10) * mult(); pts += p; sent++; f.box.ok = true; burst(f.box.side * 2.35, 1, f.box.at, f.box.reg ? '#ff5a4a' : '#7fb2ff', 22); toast(`${f.box.reg ? '📮' : '📫'} +${p}`); buzz(15); sfx.mail(f.box.reg); }
      else { pts -= 5; toast('Мимо — жалоба −5'); sfx.miss(); }
    }
    flies = flies.filter(f => f.t < .5);
    toasts = toasts.filter(s => (s.t -= rdt) > 0);
    shake = Math.max(0, shake - dt); hurt = Math.max(0, hurt - dt); land = Math.max(0, land - dt);
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.at += p.va * dt; p.vy -= 14 * dt; if (p.y < 0) { p.y = 0; p.vy *= -.4; } p.l -= dt * 1.5; }
    sparks = sparks.filter(p => p.l > 0);
    if (!recT && best > 0 && score() > best) { recT = true; toast('🎉 Новый рекорд!'); sfx.rec(); buzz([30, 40, 30]); }
    if (tut >= 0) teach(); else tips(rdt);
  }

  // ——— рисование: мультяшный двор на рассвете (three.js) ———
  // свет ступеньками (toon) + тёмный контур у персонажей; предметы собраны кодом из скруглённых примитивов,
  // части с цветами вершин сливаются в одну сетку — один вызов отрисовки на модель; повторяющееся (дома, деревья, фонари) — инстансами
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new T.Scene(), FOG = '#f4c9a8';
  scene.fog = new T.Fog(FOG, 26, FAR + 4);
  const SUN = new T.Vector3(.55, .32, -1).normalize();
  const V = (x, y, z) => new T.Vector3(x, y, z), C = new T.Color(), Y = V(0, 1, 0);
  const BX = (w, h, d) => new T.BoxGeometry(w, h, d), RB = (w, h, d, r = .03) => new L.RB(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  const CY = (a, b, h, s = 12) => new T.CylinderGeometry(a, b, h, s), SP = (r, w = 14, h = 10, ...a) => new T.SphereGeometry(r, w, h, ...a);
  const IC = (r, d = 2) => new T.IcosahedronGeometry(r, d), CO = (r, h, s = 8) => new T.ConeGeometry(r, h, s);
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
  // свет ступеньками: тень, полутень, свет, блик
  const grad = new T.DataTexture(new Uint8Array([105, 165, 220, 255]), 4, 1, T.RedFormat);
  grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true;
  const toon = o => new T.MeshToonMaterial({gradientMap: grad, ...o});
  const VC = toon({vertexColors: true});
  const M = (parts, mat = VC, cast = true) => { const m = new T.Mesh(merge(parts), mat); m.castShadow = cast; return m; };
  const G = (...o) => { const g = new T.Group(); g.add(...o); return g; };
  const cnv = (w, h, f) => { const c = Object.assign(document.createElement('canvas'), {width: w, height: h}); f(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const spr = (map, color, size, add) => { const s = new T.Sprite(new T.SpriteMaterial({map, color, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending})); s.scale.set(size, size, 1); return s; };
  // мягкая тень-пятно под предметом — дешевле настоящей
  const blobTex = cnv(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#000000ff'); r.addColorStop(.5, '#00000099'); r.addColorStop(1, '#00000000'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const blobGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat = new T.MeshBasicMaterial({map: blobTex, color: '#3a2010', transparent: true, opacity: .32, depthWrite: false});
  const blob = (w, d = w) => { const b = new T.Mesh(blobGeo, blobMat); b.scale.set(w, 1, d); b.position.y = .015; b.renderOrder = -1; return b; };

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
    for (let j = 0; j < 5; j++) p.push(P(IC(4 + hsh(i * 9 + j) * 3, 2), j < 3 ? '#fff6ee' : '#ffd9cc', [j * 5 - 10, (j % 2) * 2.5 - (j > 2 ? 1.5 : 0), hsh(j) * 3], [0, 0, 0], [1.4, .6, 1]));
    const c = M(p, haze, false); c.position.set(-120 + i * 50, 38 + hsh(i) * 30, -190 + hsh(i + 2) * 40); clouds.push(c); scene.add(c);
  }

  scene.add(new T.HemisphereLight('#c8dbff', '#c49a7a', 1.6));
  const sun = new T.DirectionalLight('#ffd0a0', 2.3);
  sun.target.position.set(0, 0, -6); sun.position.copy(SUN).multiplyScalar(35).add(sun.target.position);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 12, bottom: -10, near: 5, far: 70}).updateProjectionMatrix();
  const fill = new T.DirectionalLight('#ffe9dc', .8); fill.position.set(-.4, .9, 1);
  scene.add(sun, sun.target, fill);

  // земля: двор, улица с разметкой (текстура едет вместе с дорогой), бордюры
  const yard = new T.Mesh(new T.PlaneGeometry(80, 160), toon({color: '#b3a684'}));
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
    g.fillStyle = '#e8b04a'; for (let i = 0; i < 14; i++) { const x = hsh(i) < .5 ? X(-3) + hsh(i + 1) * 70 : X(1.85) + hsh(i + 1) * 70; g.beginPath(); g.ellipse(x, hsh(i + 2) * h, 5, 3, hsh(i + 3) * 3, 0, 7); g.fill(); g.fillStyle = hsh(i + 4) > .5 ? '#e0813a' : '#e8b04a'; } // листья на тротуаре
    g.fillStyle = '#f4f1e8'; for (const x of [-.5, .5]) g.fillRect(X(x) - 3, 60, 6, 77);
  });
  roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(1, 120 / 4); roadTex.anisotropy = R.capabilities.getMaxAnisotropy();
  const street = new T.Mesh(new T.PlaneGeometry(6, 120), toon({map: roadTex}));
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -54); street.receiveShadow = true;
  const curbs = M([-1, 1].map(s => P(RB(.22, .14, 120, .05), '#ece5d8', [s * 1.66, .05, -54])), VC, false); curbs.receiveShadow = true;
  scene.add(yard, street, curbs);

  // инстансы: каждый кадр раскладываем заново, лишние не рисуем — один вызов отрисовки на вид
  const mx = new T.Matrix4(), q0 = new T.Quaternion(), qy = new T.Quaternion(), v0 = new T.Vector3(), s1 = new T.Vector3(1, 1, 1);
  const ipools = [];
  function ipool(geo, mat, max, cast = false) {
    const m = new T.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = cast; scene.add(m);
    let n = 0;
    const p = {m, start() { n = 0; }, add(x, y, z, ry = 0, col, s = 1) {
      if (n >= max) return; mx.compose(v0.set(x, y, z), qy.setFromAxisAngle(Y, ry), s1.set(s, s, s)); m.setMatrixAt(n, mx);
      if (col) m.setColorAt(n, col); n++;
    }, end() { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }};
    ipools.push(p); return p;
  }

  // панельки: окна — текстура (часть горит — светится в полумраке рассвета), цвет и этажность — по номеру квартала
  const FLOOR = 1.45, HL = 6.6, HD = 6;
  const winMap = cnv(512, 512, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); }), glow = [];
  { const g = winMap.image.getContext('2d'), e = document.createElement('canvas'); e.width = e.height = 512; const h = e.getContext('2d');
    h.fillStyle = '#000'; h.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const x = i * 64, y = j * 64, lit = hsh(i * 8 + j + .5) > .74, balc = hsh(i * 13 + j * 7) > .78;
      g.fillStyle = '#0000001a'; g.fillRect(x, y + 62, 64, 2); g.fillRect(x + 63, y, 1, 64);
      g.fillStyle = '#f4efe6'; g.beginPath(); g.roundRect(x + 13, y + 10, 38, 36, 5); g.fill();
      g.fillStyle = lit ? '#ffe2a0' : hsh(i + j * 3) > .5 ? '#3a4a6e' : '#2f3c5c'; g.beginPath(); g.roundRect(x + 16, y + 13, 32, 30, 3); g.fill();
      g.fillStyle = lit ? '#e2ad62' : '#55688f'; g.fillRect(x + 31, y + 13, 2, 30); g.fillRect(x + 16, y + 24, 32, 2);
      if (!lit) { g.fillStyle = '#ffffff30'; g.fillRect(x + 19, y + 15, 4, 8); }
      if (lit) { h.fillStyle = hsh(i + j) > .5 ? '#ffb257' : '#ffc977'; h.fillRect(x + 16, y + 13, 32, 30); }
      if (balc) { g.fillStyle = '#00000030'; g.fillRect(x + 8, y + 40, 48, 16); g.fillStyle = '#ffffff70'; g.fillRect(x + 8, y + 40, 48, 3); }
    }
    glow.push(new T.CanvasTexture(e)); glow[0].colorSpace = T.SRGBColorSpace; }
  winMap.wrapS = winMap.wrapT = glow[0].wrapS = glow[0].wrapT = T.RepeatWrapping;
  winMap.anisotropy = glow[0].anisotropy = 4;
  const houseMat = toon({color: '#fff', map: winMap, emissive: '#ffffff', emissiveMap: glow[0], emissiveIntensity: .9});
  const houseCol = ['#efb9a2', '#f3d59a', '#a9c6e8', '#cbb9e2', '#b7dbb0', '#f1e7d5'].map(c => new T.Color(c));
  const pHouse = [4, 5, 5, 9].map(fl => {
    const g = BX(HD, fl * FLOOR, HL), uv = g.attributes.uv;
    for (let i = 0; i < 24; i++) { const f = i >> 2, w = f < 2 ? HL : HD; uv.setXY(i, uv.getX(i) * w / 1.65 / 8, uv.getY(i) * fl / 8); }
    g.translate(0, fl * FLOOR / 2, 0); return ipool(g, houseMat, 24);
  });
  const roofs = ipool(merge([P(RB(HD + .3, .25, HL + .3, .08), '#8a7a72', [0, 0, 0])]), VC, 48);
  // крыльцо подъезда: дверь, козырёк, лампа
  const pPorch = ipool(merge([P(RB(.08, 1.15, .9, .03), '#6e4a32', [0, .575, 0]), P(RB(.7, .08, 1.3, .03), '#d9d2c4', [.32, 1.3, 0]), P(SP(.05, 8, 6), '#ffe6a6', [.05, 1.22, 0]), P(RB(.5, .12, 1.1, .04), '#bdb3a4', [.25, .06, 0])]), VC, 24);
  // деревья — осень: зелёные, жёлтые, рыжие; кроны — круглые облачка; фонари горят с ночи
  const pTree = ['#7ca452', '#e0b13c', '#e0813a'].map((c, i) => ipool(merge([P(CY(.06, .1, 1.3, 8), '#6b4a34', [0, .65, 0]), P(IC(.62), c, [0, 1.6, 0]), P(IC(.45), i ? '#d6973a' : '#8fb862', [.25, 2.05, .1]), P(IC(.38), c, [-.3, 1.95, -.15])]), VC, 24));
  const pBlob = ipool(blobGeo, blobMat, 48); pBlob.m.renderOrder = -1;
  const pPole = ipool(merge([P(CY(.035, .05, 2.7, 8), '#3d4250', [0, 1.35, 0]), P(RB(.6, .05, .05, .02), '#3d4250', [-.28, 2.68, 0]), P(RB(.22, .08, .14, .03), '#3d4250', [-.55, 2.64, 0])]), VC, 24);
  const pBulb = ipool(BX(.16, .03, .1).translate(-.55, 2.59, 0), new T.MeshBasicMaterial({color: '#ffe3a0'}), 24);
  const glowTex = cnv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#ffffffff'); r.addColorStop(.35, '#ffffff66'); r.addColorStop(1, '#ffffff00'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

  // пулы: каждый кадр раздаём объекты заново, лишние прячем — ничего не создаётся во время игры
  const pools = [];
  function pool(make) {
    const list = []; let n = 0;
    const p = {get() { let o = list[n++]; if (!o) { o = make(); scene.add(o); list.push(o); } o.visible = true; return o; }, start() { n = 0; }, end() { for (let i = n; i < list.length; i++) list[i].visible = false; }};
    pools.push(p); return p;
  }
  const pGlow = pool(() => spr(glowTex, '#ffc870', 1.3, true));

  // ——— персонажи: модели Quaternius, перекрашены, одеты кодом, контур — вывернутая оболочка ———
  const SKIN = '#f0c08a', SC = .38; // модель ростом ~3 → 1,15 м
  // контур: копия сетки изнанкой наружу, раздута вдоль сглаженных нормалей (у моделей грани плоские — без сглаживания контур рвётся)
  const lineMat = new T.MeshBasicMaterial({color: '#2b1a12', side: T.BackSide});
  lineMat.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec3 onorm;\n' + s.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = onorm;')
      .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);\nmvPosition.xyz += normalize(normalMatrix * objectNormal) * clamp(-mvPosition.z * .0055, .004, .03);\ngl_Position = projectionMatrix * mvPosition;');
  };
  lineMat.customProgramCacheKey = () => 'karych-outline';
  function smoothN(g) {
    if (g.attributes.onorm) return;
    const p = g.attributes.position, n = g.attributes.normal, m = new Map(), o = new Float32Array(p.count * 3);
    const key = i => `${Math.round(p.getX(i) * 500)},${Math.round(p.getY(i) * 500)},${Math.round(p.getZ(i) * 500)}`;
    for (let i = 0; i < p.count; i++) { const k = key(i); let a = m.get(k); if (!a) m.set(k, a = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
    for (let i = 0; i < p.count; i++) { const a = m.get(key(i)), l = Math.hypot(...a) || 1; o[i * 3] = a[0] / l; o[i * 3 + 1] = a[1] / l; o[i * 3 + 2] = a[2] / l; }
    g.setAttribute('onorm', new T.BufferAttribute(o, 3));
  }
  // персонаж: клон рига, свои цвета по именам материалов, аксессуары на кости, микшер анимаций
  function person(id, col, hide = []) {
    const o = L.SU.clone(L.models[id].scene), skins = [], mats = {};
    o.scale.setScalar(SC);
    o.traverse(m => { if (m.isSkinnedMesh) skins.push(m); });
    for (const m of skins) {
      const n = m.material.name;
      if (hide.includes(n)) { m.visible = false; continue; }
      const c = col[n] ? new T.Color(col[n]) : m.material.color.clone();
      m.material = mats[n] = toon({color: c}); m.castShadow = true; m.frustumCulled = false;
      if (n !== 'Face') { smoothN(m.geometry); const l = m.clone(); l.material = lineMat; l.castShadow = false; m.parent.add(l); }
    }
    const mix = new T.AnimationMixer(o), act = {};
    for (const c of L.clips) act[c.name] = mix.clipAction(c);
    const root = G(o); scene.add(root);
    const sh = blob(.75, .55); scene.add(sh);
    return {root, o, mix, act, cur: null, mats, sh, bone: n => o.getObjectByName(n)};
  }
  // аксессуар на кость (в единицах модели: голова ~0,8 шириной, кость головы — у основания шеи)
  const wear = (c, bone, parts, mat = VC) => { const m = M(parts, mat); c.bone(bone).add(m); return m; };
  // сменить анимацию с плавным переходом; once — проиграть раз и замереть на последнем кадре
  function play(c, name, {fade = .15, once = false, speed = 1, from = 0} = {}) {
    const a = c.act[name];
    a.timeScale = speed;
    if (c.cur === a) return a;
    a.reset(); a.time = from; a.setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = once; a.play();
    if (c.cur) a.crossFadeFrom(c.cur, fade, false);
    c.cur = a; return a;
  }
  // повернуть кость вокруг оси персонажа (поверх анимации): поднять руку с тапком, вытянуть скипетр
  const qa = new T.Quaternion(), qb = new T.Quaternion(), ax = new T.Vector3();
  function twist(c, bone, axis, ang) {
    const b = c.bone(bone); b.parent.getWorldQuaternion(qa); c.o.getWorldQuaternion(qb);
    ax.copy(axis).applyQuaternion(qb).applyQuaternion(qa.invert()).normalize();
    b.quaternion.premultiply(qb.setFromAxisAngle(ax, ang));
  }
  const X1 = V(1, 0, 0);

  // Карыч — почтальон: синяя форма, кепка с кокардой, сумка через плечо
  const kar = person('kar', {Skin: SKIN, Shirt: '#3a72d8', Pants: '#2b3557', Belt: '#5a3a1e', Hair: '#5a3620'});
  wear(kar, 'Head', [P(CY(.62, .64, .26, 24), '#1f3a7a', [0, 1.02, -.02], [-.06, 0, 0]), P(SP(.62, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#1f3a7a', [0, 1.14, -.03], [-.06, 0, 0], [1, .38, 1]),
    P(CY(.65, .65, .08, 24), '#16295a', [0, .9, -.01], [-.06, 0, 0]), P(CY(.4, .4, .05, 16, 1, false, -Math.PI / 2, Math.PI), '#16295a', [0, .89, .47], [-.1, 0, 0], [1, 1, 1.25]),
    P(SP(.09, 10, 8), '#ffd23f', [0, 1.03, .63], [0, 0, 0], [1, 1, .5])]);
  wear(kar, 'Hips', [P(RB(.42, .34, .16, .05), '#9a5e2c', [-.42, .12, .02]), P(RB(.43, .13, .17, .04), '#7f4a20', [-.42, .25, .02]), P(RB(.28, .05, .1, .02), '#f4efe2', [-.42, .33, .02])]);
  wear(kar, 'Torso', [P(RB(.1, 1.2, .05, .02), '#7a4a22', [-.05, .08, .33], [0, 0, .78]), P(RB(.1, 1.2, .05, .02), '#7a4a22', [-.05, .08, -.32], [0, 0, .78])]);

  // кровать: летит, Карыч спит под одеялом
  const bedParts = () => [
    P(RB(1.1, .12, .58, .04), '#8a5530', [0, .17, 0]), P(RB(.08, .55, .62, .03), '#6b3f20', [-.57, .32, 0]), P(RB(.08, .36, .62, .03), '#6b3f20', [.57, .23, 0]),
    ...[[-.5, -.24], [-.5, .24], [.5, -.24], [.5, .24]].map(([x, z]) => P(CY(.035, .03, .12, 8), '#5a3418', [x, .06, z])),
    P(RB(1.04, .1, .52, .04), '#f6f1e6', [0, .28, 0]), P(RB(.27, .11, .38, .05), '#ffffff', [-.37, .38, 0]),
  ];
  const bedG = G(M(bedParts().map(g => g.scale(1.25, 1, 1.15))), M([P(RB(.8, .16, .66, .07), '#5d8be8', [.19, .43, 0]), P(RB(.82, .04, .67, .02), '#f6f1e6', [-.2, .49, 0])]));
  const zTex = cnv(64, 64, g => { g.font = 'bold 54px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#2d3c78'; g.strokeText('Z', 32, 34); g.fillStyle = '#fff'; g.fillText('Z', 32, 34); });
  const zz = [0, 1, 2].map(() => { const s = spr(zTex, '#fff', .3); scene.add(s); return s; });
  const angerTex = cnv(64, 64, g => { g.strokeStyle = '#ff2d2d'; g.lineWidth = 9; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.save(); g.translate(32, 32); g.rotate(i * Math.PI / 2); g.beginPath(); g.arc(17, 17, 12, Math.PI, Math.PI * 1.5); g.stroke(); g.restore(); } });
  const anger = spr(angerTex, '#fff', .42); scene.add(bedG, anger);
  // лёжа: голова влево (−x), лицом вверх
  const lieQ = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0)));

  // преследователи — их видно сзади-сверху, узнаются по силуэту
  const slipperParts = (c, p, r = [0, 0, 0], k = 1) => [P(RB(.13 * k, .04 * k, .3 * k, .015), c, p, r), P(RB(.14 * k, .07 * k, .06 * k, .02), '#ffcf3f', [p[0], p[1] + .04 * k, p[2] - .05 * k], r)];
  const crown = (r, y) => [P(CY(r, r * .92, r * .6, 16), '#ffcc33', [0, y, 0]), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => P(CO(r * .22, r * .55, 6), '#ffcc33', [Math.sin(i * .785) * r * .9, y + r * .55, Math.cos(i * .785) * r * .9])),
    ...[0, 2, 4, 6].map(i => P(SP(r * .13, 8, 6), i % 4 ? '#3a7be0' : '#e0303a', [Math.sin(i * .785) * r * 1.01, y, Math.cos(i * .785) * r * 1.01]))];
  const dots = cnv(128, 128, g => { g.fillStyle = '#d94a3a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff3d6'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(i * 16 + (j % 2) * 8 + 4, j * 16 + 8, 3.2, 0, 7); g.fill(); } });
  const CH3 = {
    // бабушка: седая, кофта, платок в горошек, тапок в руке
    baba: person('baba', {Skin: SKIN, Main: '#8a4fa0', Black: '#c9465a', Brown: '#4a3a30', Hair: '#d9d6d0'}),
    // Жёлтый Король: жёлтая мантия с красной каймой, борода, корона, скипетр, плащ
    king: person('king', {Skin: SKIN, Clothes: '#f2c230', Gold: '#c0262d', Belt: '#7a1a1a', Hair: '#f4f0e8'}, ['Hat']),
    // Димон: синий спорткостюм, лысина (краснеет, когда звереет), золотая цепь
    dimon: person('dimon', {Skin: SKIN, Shirt: '#26324f', Pants: '#26324f', Belt: '#f0f0f0'}),
  };
  { const km = toon({map: dots, side: T.DoubleSide});
    for (const g of [SP(.68, 24, 8, 0, Math.PI * 2, 0, Math.PI * .3), SP(.68, 24, 8, Math.PI / 2 + .85, Math.PI * 2 - 1.7, Math.PI * .29, Math.PI * .33)]) {
      const k = new T.Mesh(g, km); k.position.set(0, .5, -.04); k.scale.set(1, .95, 1.08); k.castShadow = true; CH3.baba.bone('Head').add(k); }
    wear(CH3.baba, 'Head', [P(CO(.2, .42, 6), '#d94a3a', [0, .02, -.62], [-2.6, 0, 0]), P(SP(.1, 8, 6), '#d94a3a', [0, -.12, .4])]);
    wear(CH3.baba, 'FistR', slipperParts('#3f78d6', [0, .18, .05], [Math.PI / 2, 0, 0], 2.4)); }
  wear(CH3.king, 'Head', crown(.57, .8));
  wear(CH3.king, 'FistR', [P(CY(.04, .04, 1.3, 8), '#ffcc33', [0, .1, 0], [Math.PI / 2, 0, 0]), P(SP(.12, 10, 8), '#e0303a', [0, .1, .7]), P(CY(.09, .09, .05, 10), '#ffcc33', [0, .1, .58], [Math.PI / 2, 0, 0])]);
  wear(CH3.king, 'Torso', [P(RB(1.15, 1.4, .06, .03), '#c0262d', [0, -.25, -.42], [-.12, 0, 0]), P(RB(1.2, .22, .3, .1), '#fffaf0', [0, .5, -.32]), ...[-.35, 0, .35].map(x => P(SP(.03, 6, 4), '#111', [x, .52, -.47]))]);
  wear(CH3.dimon, 'Torso', [P(new T.TorusGeometry(.2, .04, 8, 24), '#ffcc33', [0, .4, .21], [-.3, 0, 0], [1.1, 1, 1])]);
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
    const m = M([P(CY(.04, .045, .64, 8), '#4a4d57', [0, .32, 0]), P(RB(.5, .4, .38, .06), a, [0, .82, 0]), P(new T.CylinderGeometry(.25, .25, .38, 16, 1, false, -Math.PI / 2, Math.PI), b, [0, 1.02, 0], [-Math.PI / 2, 0, 0]),
      P(RB(.03, .05, .24, .01), '#141414', [-.255, .9, 0]), P(RB(.03, .2, .26, .02), b, [-.255, .74, 0]),
      ...(reg ? [P(new T.OctahedronGeometry(.08), '#ffd23f', [-.27, .74, 0], [0, 0, 0], [.3, 1, 1]), P(new T.OctahedronGeometry(.08), '#ffd23f', [0, .78, .195], [0, 0, 0], [1, 1, .3])] : [P(RB(.16, .1, .02, .008), '#fff', [0, .8, .195])])]);
    const ring = new T.Mesh(new T.RingGeometry(.34, .5, 28), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .03;
    const ok = spr(checkTex, '#fff', .42); ok.position.y = 1.5;
    const g = G(m, ring, ok, blob(.7)); g.userData = {ring, ok}; return g;
  }
  // барьер: полосатые доски на ножках, мигалка. Королевский — жёлтый с короной
  const stripes = king => cnv(128, 32, g => { g.fillStyle = king ? '#ffd23f' : '#fff'; g.fillRect(0, 0, 128, 32); g.fillStyle = king ? '#3a2a00' : '#e5392f'; for (let i = -1; i < 9; i++) { g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 + 20, 0); g.lineTo(i * 16 + 12, 0); g.fill(); } });
  const boardMat = [stripes(false), stripes(true)].map(map => toon({map}));
  const blink = new T.MeshBasicMaterial({color: '#ffb300'});
  function barrier(king) {
    const legs = M([-.42, .42].flatMap(x => [P(RB(.07, 1, .07, .025), king ? '#6a5520' : '#6b6b6b', [x, .5, 0]), P(RB(.12, .06, .44, .03), '#3b3b3b', [x, .03, 0])]));
    const boards = M([P(RB(.98, .26, .06, .03), '#fff', [0, .82, 0]), P(RB(.98, .26, .06, .03), '#fff', [0, .42, 0])], boardMat[+king]);
    const lamp = new T.Mesh(SP(.065, 10, 8), blink); lamp.position.set(-.42, 1.06, 0);
    const g = G(legs, boards, lamp, blob(1.2, .5));
    if (king) g.add(M(crown(.16, 1.1)));
    return g;
  }
  // бельевая верёвка: столбики, верёвка, вещи качаются на ветру
  function laundry() {
    const g = G(M([P(CY(.03, .035, 1.22, 8), '#8a6a4a', [-.5, .61, 0]), P(CY(.03, .035, 1.22, 8), '#8a6a4a', [.5, .61, 0]),
      P(new T.TubeGeometry(new T.QuadraticBezierCurve3(V(-.5, 1.16, 0), V(0, 1.02, 0), V(.5, 1.16, 0)), 10, .012, 4), '#f4f4f4')]), blob(1.1, .3));
    const cl = [
      M([P(RB(.24, .26, .02, .008), '#e94b6a', [0, -.17, 0]), P(RB(.38, .09, .021, .008), '#e94b6a', [0, -.07, 0])]),
      M([P(RB(.1, .3, .02, .008), '#4bb3e9', [-.06, -.2, 0]), P(RB(.1, .3, .02, .008), '#4bb3e9', [.06, -.2, 0]), P(RB(.22, .07, .021, .008), '#3a96c9', [0, -.05, 0])]),
      M([P(RB(.2, .3, .02, .008), '#f2c84b', [0, -.17, 0]), P(RB(.2, .04, .021, .008), '#fff', [0, -.26, 0])]),
    ];
    cl.forEach((c, i) => { c.position.set([-.28, 0, .27][i], [1.1, 1.04, 1.1][i], 0); g.add(c); });
    g.userData.cl = cl; return g;
  }
  // предметы: крутятся над дорогой в ореоле
  const ITEM3 = {
    bag: () => [P(RB(.36, .24, .03, .01), '#f6f1e6', [0, 0, 0], [0, 0, .15]), P(RB(.36, .24, .03, .01), '#fffaf0', [0, .03, .035], [0, 0, -.1]),
      P(RB(.38, .03, .033, .01), '#2f6fd6', [0, -.07, .036], [0, 0, -.1]), P(CY(.045, .045, .02, 10), '#c8312a', [0, .03, .055], [Math.PI / 2, 0, 0])],
    roll: () => [P(CY(.14, .14, .22, 16), '#fbfbf8', [0, 0, 0], [0, 0, Math.PI / 2]), P(CY(.05, .05, .225, 10), '#b9a58a', [0, 0, 0], [0, 0, Math.PI / 2]), P(RB(.2, .18, .008, .003), '#f2f2ee', [0, -.1, .14], [.2, 0, 0])],
    pillow: () => bedParts().map(g => g.translate(0, -.3, 0).scale(.42, .42, .42)),
    cig: () => [P(CY(.035, .035, .32, 10), '#f7f4ee', [.05, 0, 0], [0, 0, Math.PI / 2]), P(CY(.037, .037, .12, 10), '#e0913a', [-.17, 0, 0], [0, 0, Math.PI / 2])],
    lolly: () => [P(CY(.15, .15, .05, 20), '#ff5fa2', [0, .1, 0], [Math.PI / 2, 0, 0]), P(new T.TorusGeometry(.085, .02, 6, 20), '#fff', [0, .1, .028]), P(new T.TorusGeometry(.085, .02, 6, 20), '#fff', [0, .1, -.028]), P(CY(.013, .013, .32, 6), '#fff', [0, -.12, 0])],
  };
  const tipMat = new T.MeshBasicMaterial({color: '#ff5a1a'});
  function item(k) {
    const spin = G(M(ITEM3[k]())), g = G(spin), s = spr(glowTex, k === 'cig' ? '#ff5a3a' : '#ffe9a0', 1, true), sh = blob(.45);
    s.material.opacity = .75; g.add(s, sh);
    if (k === 'cig') { const tip = new T.Mesh(CY(.038, .038, .03, 10), tipMat); tip.rotation.z = Math.PI / 2; tip.position.x = .225; spin.add(tip);
      g.userData.smoke = [0, 1, 2].map(() => { const p = spr(glowTex, '#e8e8f0', .18); p.material.opacity = .5; g.add(p); return p; }); }
    g.userData.spin = spin; g.userData.sh = sh; return g;
  }
  const lowBoxes = () => G(M([P(RB(.5, .38, .42, .04), '#c8955a', [-.12, .19, 0]), P(RB(.08, .006, .43, .002), '#ecd9b0', [-.12, .383, 0]), P(RB(.51, .06, .01, .003), '#ecd9b0', [-.12, .3, .21]),
    P(RB(.36, .28, .32, .04), '#b98349', [.24, .14, .05], [0, .35, 0]), P(RB(.06, .006, .33, .002), '#e6cfa0', [.24, .283, .05], [0, .35, 0]), P(RB(.24, .16, .2, .03), '#d4a46c', [-.1, .46, .02], [0, -.3, 0])]), blob(1, .6));
  const P3 = {
    box: pool(() => mailbox(false)), reg: pool(() => mailbox(true)), wall: pool(() => barrier(false)), kwall: pool(() => barrier(true)),
    low: pool(lowBoxes), line: pool(laundry), fly: pool(() => M([P(RB(.24, .16, .02, .006), '#f6f1e6'), P(BX(.08, .08, .022), '#d8342c', [0, 0, 0], [0, 0, Math.PI / 4])], VC, false)),
  };
  for (const k in ITEM3) P3[k] = pool(() => item(k));
  // искры — один InstancedMesh
  const NSP = 220, spk = new T.InstancedMesh(new T.OctahedronGeometry(.055), new T.MeshBasicMaterial(), NSP);
  spk.frustumCulled = false; for (let i = 0; i < NSP; i++) spk.setColorAt(i, C.set('#fff')); scene.add(spk);

  let wasHurt = 0, karHit = 0;
  function draw(rdt) {
    const z0 = at => -(at - dist), now = performance.now() / 1000, adt = st === 'run' ? (paused ? 0 : rdt * slo) : rdt;
    for (const p of pools) p.start();
    for (const p of ipools) p.start();
    // кварталы: дом 6.6 м, между домами — дерево или фонарь
    for (let i = Math.floor((dist - 10) / 8); i * 8 < dist + FAR + 4; i++) for (const s of [-1, 1]) {
      const n = i * 2 + (s > 0), fl = Math.floor(hsh(n + 50) * 4), hz = z0(i * 8 + HL / 2);
      pHouse[fl].add(s * (3.1 + HD / 2), 0, hz, 0, houseCol[Math.floor(hsh(n) * 6)]);
      roofs.add(s * (3.1 + HD / 2), [4, 5, 5, 9][fl] * FLOOR, hz);
      if (hsh(n + 21) > .45) pPorch.add(s * 3.1, 0, z0(i * 8 + 1.4 + hsh(n + 4) * 3.8), s > 0 ? Math.PI : 0);
      if (hsh(n + 7) > .3) { pTree[Math.floor(hsh(n + 9) * 3)].add(s * 2.55, 0, z0(i * 8 + 7.3), n); pBlob.add(s * 2.55, .012, z0(i * 8 + 7.3), 0, null, 1.5); }
      else { const ry = s > 0 ? 0 : Math.PI, z = z0(i * 8 + 7.3); pPole.add(s * 2.45, 0, z, ry); pBulb.add(s * 2.45, 0, z, ry); pGlow.get().position.set(s * 2.45 - .55 * Math.cos(ry), 2.5, z); }
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
        o.position.y = .5 + .08 * Math.sin(now * 5 + e.at); o.userData.spin.rotation.y = now * 2.4 + e.at; o.userData.sh.position.y = .015 - o.position.y;
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
    for (const p of ipools) p.end();

    // Карыч: какая анимация — по состоянию игры
    const y = jy(), running = st === 'run' && !paused, v = st === 'run' && tut < 0 ? Math.min(26, 11 + t * .12) : 10;
    if (hurt > wasHurt) karHit = .45; wasHurt = hurt; karHit = Math.max(0, karHit - adt);
    const r = kar.root, sleeping = bed > 0;
    bedG.visible = sleeping && !(bed < 1.5 && Math.floor(now * 8) % 2); r.visible = !sleeping || bedG.visible;
    if (st === 'over') play(kar, 'Death', {once: true, fade: .1});
    else if (sleeping) play(kar, 'Idle', {speed: .6});
    else if (st === 'intro') play(kar, 'Idle');
    else if (karHit > 0) play(kar, 'RecieveHit', {once: true, fade: .06, speed: 1.3});
    else if (jump > 0) play(kar, 'Jump', {once: true, fade: .08, speed: 1.25, from: .12});
    else if (duck > 0) play(kar, 'Roll', {once: true, fade: .06, speed: 1.55});
    else if (doze > 0 || cramp > 0) play(kar, 'Walk', {speed: cramp > 0 ? .8 : .6});
    else play(kar, 'Run', {speed: Math.min(1.8, .7 + v / 30)});
    kar.mix.update(adt);
    if (sleeping) {
      bedG.position.set(px, .45 + Math.sin(now * 3) * .06, 0); bedG.rotation.set(Math.sin(now * 2) * .05, 0, Math.sin(now * 2.6) * .04);
      r.position.set(px + .56, bedG.position.y + .5, 0); r.rotation.copy(bedG.rotation); r.scale.set(1, 1, 1); kar.o.quaternion.copy(lieQ);
    } else {
      const face = st === 'intro' ? 0 : Math.PI;
      kar.o.rotation.set(0, kar.o.rotation.y + (face - kar.o.rotation.y) * Math.min(1, rdt * 6), 0);
      r.position.set(px, y, 0);
      r.rotation.set(-.05 * (running ? 1 : 0) - (cramp > 0 ? .3 : 0) + (doze > 0 ? Math.sin(now * 2.2) * .08 : 0), 0, cramp > 0 ? -.35 : -(lane - px) * .35);
      const sq = land > 0 ? 1 - land * .8 : 1; r.scale.set(sq < 1 ? 1 + (1 - sq) * .5 : 1, sq, 1);
    }
    kar.sh.visible = !sleeping; kar.sh.position.set(px, .015, 0); const bk = 1 / (1 + y * .6); kar.sh.scale.set(.75 * bk, 1, .55 * bk);
    // сон: Z поднимаются над головой
    const zOn = bed > 0 || doze > 0 || st === 'intro';
    zz.forEach((s, i) => { const q = (now * .6 + i / 3) % 1; s.visible = zOn; s.position.set((bed > 0 ? px - .35 : px) + .2 + q * .35 + Math.sin(q * 6) * .05, (bed > 0 ? 1.05 : 1.35 + y) + q * .8, 0); s.material.opacity = Math.min(1, (1 - q) * 2); s.scale.setScalar(.18 + q * .22); });
    anger.visible = cramp > 0 && bed <= 0; anger.position.set(px - .3, y + 1.3, 0); anger.scale.setScalar(.35 + Math.sin(now * 12) * .05);

    // преследователь сзади: чем ближе, тем выше вылезает из-под края экрана
    const cz = 1.6 + gap * 2.4, cx0 = gx * .9 + .45; // чуть правее — не заслоняет Карыча
    for (const id in CH3) CH3[id].root.visible = CH3[id].sh.visible = id === who;
    const c = CH3[who];
    if (st === 'intro') { // в меню выбранный преследователь стоит за спиной у Карыча
      play(c, 'Idle'); c.mix.update(adt);
      c.root.position.set(1.05, 0, -1.6); c.root.rotation.x = 0; c.o.rotation.set(0, -.35, 0); c.sh.position.set(1.05, .015, -1.6);
    } else {
      play(c, st === 'over' ? 'Victory' : 'Run', {speed: st === 'over' ? 1 : who === 'baba' ? 1.35 : 1.15});
      c.mix.update(adt);
      c.root.position.set(cx0, 0, cz); c.o.rotation.set(0, Math.PI + gx * .15, 0); c.root.rotation.x = -.06;
      c.sh.position.set(cx0, .015, cz);
      if (st === 'run') {
        if (who === 'baba') twist(c, 'UpperArmR', X1, -2.5 + Math.sin(now * 9) * .5);
        if (who === 'king') twist(c, 'UpperArmR', X1, -2.3 + Math.sin(now * 6) * .3);
      }
    }
    if (who === 'dimon') CH3.dimon.mats.Skin.color.set(SKIN).lerp(C.set('#ff3a2a'), Math.max(0, rage / 3 * .8 + (rage ? Math.sin(now * 8) * .08 : 0)));
    steam.forEach((s, i) => { const q = (now * 1.2 + i / 4) % 1; s.visible = who === 'dimon' && rage > 0 && st !== 'intro'; s.position.set(cx0 + (i % 2 ? .15 : -.15) * (1 + q), 1.2 + q * .6, cz); s.material.opacity = .7 * (1 - q); s.scale.setScalar(.15 + q * .35); });

    // тапок бабушки: мигающая метка и падение сверху
    slipMark.visible = !!slip && Math.floor(now * 10) % 2 === 0; slipper.visible = !!slip && slip.t < .35;
    if (slip) { slipMark.position.set(slip.lane, .03, 0); const q = Math.max(0, slip.t / .35); slipper.position.set(slip.lane + q * .5, .1 + q * 5, -q * 2); slipper.rotation.set(q * 8, q * 4, 0); }

    // искры
    spk.count = Math.min(NSP, sparks.length);
    for (let i = 0; i < spk.count; i++) {
      const p = sparks[i]; mx.compose(v0.set(p.x, p.y, -(p.at - dist)), q0, s1.setScalar(Math.max(0, p.l) * p.r));
      spk.setMatrixAt(i, mx); spk.setColorAt(i, C.set(p.c));
    }
    spk.instanceMatrix.needsUpdate = true; if (spk.instanceColor) spk.instanceColor.needsUpdate = true;

    // облака плывут, камера идёт за Карычем; на скорости шире угол и тряска
    clouds.forEach((c, i) => { c.position.x = ((-120 + i * 50 + now * (1 + i * .3)) % 300 + 300) % 300 - 150; });
    const hf = (st === 'intro' ? 46 : 41 + (v - 11) / 15 * 9) * Math.PI / 180;
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
    if (showFps) { cx.font = 'bold 12px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'top'; rrect(W / 2 - 70, 8, 140, 20, 10, '#000a'); cx.fillStyle = fpsV < 45 ? '#ffb340' : '#7dff9a'; cx.fillText(`${fpsV.toFixed(0)} fps · q${q} · ${R.getPixelRatio()}x`, W / 2, 12); }
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
  function go(id) { if (CHASERS[id]) save('karychWho', who = id); CH = CHASERS[who]; reset(); st = 'run'; paused = false; show(''); A(); sfx.start(); }

  panel.onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a; if (a !== 'go') sfx.tap();
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
    A();
    if (e.key === 'Escape') return close();
    if (st !== 'run' || paused) return;
    const f = {ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: up, ArrowDown: down, ' ': toss, b: rest, и: rest}[e.key];
    if (f) { e.preventDefault(); act(f); }
  };
  // свернул приложение или погас экран — пауза
  const hide = () => { if (document.hidden && st === 'run' && !paused) { paused = true; show(`<div style="font-size:22px;font-weight:800;margin-bottom:14px">⏸ Пауза</div><button data-a="resume" class="kr-big">▶ Продолжить</button>`); } };
  addEventListener('resize', fit); addEventListener('keydown', keys); document.addEventListener('visibilitychange', hide);
  function close() {
    cancelAnimationFrame(raf); music('off'); root.remove(); document.body.style.overflow = was;
    removeEventListener('resize', fit); removeEventListener('keydown', keys); document.removeEventListener('visibilitychange', hide);
    scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); });
    R.dispose(); R.forceContextLoss();
  }

  const loop = now => {
    const raw = (now - last) / 1000 || 0, dt = Math.min(.05, raw); last = now;
    if (showFps && raw > 0) { fpsN++; if ((fpsT += raw) >= .5) { fpsV = fpsN / fpsT; fpsN = fpsT = 0; } }
    if (!document.hidden && dt > 0 && (ft += dt, ++fr) >= 90) { if (ft / fr > 1 / 50 && q < 3) { q++; if (q === 3) R.shadowMap.enabled = false, scene.traverse(o => o.material && (o.material.needsUpdate = true)); fit(); } fr = ft = 0; }
    if (st === 'run' && !paused) { spawn(); step(dt); }
    // звук по состоянию: храп на кровати, музыка (в меню тихая, в забеге темп растёт со скоростью, во сне глухая)
    if (st === 'run' && !paused && bed > 0) { if ((snoreT -= dt) <= 0) { sfx.snore(); snoreT = 2.2; } } else snoreT = .7;
    music(st === 'intro' ? 'menu' : st === 'run' && !paused ? 'run' : 'off', st === 'intro' ? 96 : Math.round(124 + (tut < 0 ? Math.min(26, 11 + t * .12) - 11 : 0) * 2.4), bed > 0 || doze > 0);
    draw(dt); hud(); raf = requestAnimationFrame(loop);
    const w = st === 'run' && tut >= 0 && hint ? TUT[tut].need : st; // для автотеста: чего ждёт игра
    if (root.dataset.wait !== w) root.dataset.wait = w;
  };
  if (/[?&]ktest\b/.test(location.search)) window.karychTest = {over: () => st === 'run' && over(), bed: () => { beds = Math.max(beds, 1); rest(); }, gap: v => { gap = v; }, state: () => ({st, t, gap, dist, q, tut})}; // для автотеста
  reset(); spawn(); intro(); raf = requestAnimationFrame(loop);
}
})();
