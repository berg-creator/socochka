// Карыч: Доставка — мини-игра раздела 🧻 (index.html грузит этот файл только по кнопке «🎮»).
// Всё рисуется на одном canvas поверх страницы. Мир: три полосы (−1, 0, 1) уходят к горизонту,
// z — сколько метров до предмета впереди Карыча, e.at — его место на дороге (z = at − dist).
// Черты Карыча: разносит письма (тап — бросок в ящик), вечно спит (шкала 😪, кровать 🛏️),
// срывает спину (частые наклоны → прострел), бросил курить (обходишь 🚬 — растёт множитель). Гонятся: бабушка, Жёлтый Король, Димон
(() => {
const FAR = 60, D = 4, LANES = [-1, 0, 1], JUMP = .75, BED = 7;
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const load = k => { try { return localStorage[k] || ''; } catch { return ''; } };
const save = (k, v) => { try { localStorage[k] = v; } catch {} };
const buzz = ms => navigator.vibrate?.(ms);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const ITEMS = {bag: '📨', roll: '🧻', pillow: '🛏️', cig: '🚬', lolly: '🍭'};
// преследователи: mult — множитель очков (кто сложнее, тот дороже), back — как быстро отстаёт, пока бежишь чисто
const CHASERS = {
  baba: {face: '👵', name: 'Бабушка', got: 'Бабушка догнала!', mult: 1, back: .02, note: 'Не устаёт и кидает тапок 🩴 — уйди с красной метки'},
  king: {face: '🤴', name: 'Жёлтый Король', got: 'Жёлтый Король догнал!', mult: 1.5, back: .03, note: 'Держится далеко, но ставит 🚧 прямо перед тобой'},
  dimon: {face: '👴', name: 'Димон', got: 'Димон догнал!', mult: 2, back: .03, note: 'Каждый удар его злит 😡 и он быстрее. Бежишь чисто — выдыхается'},
};

// paper() — бумага в квартире ({rolls} или null), boss() — староста; me() — кто вошёл (или ''),
// week() — рекорды этой недели {имя: очки}, submit(очки) — сохранить свой рекорд недели (true — сохранилось)
window.karych = ({paper, boss, me, week, submit}) => {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#24325f;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:none';
  root.innerHTML = `<canvas style="display:block;width:100%;height:100%"></canvas>
    <button data-x aria-label="Закрыть" style="position:absolute;top:10px;right:10px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0006;color:#fff;font-size:18px">✕</button>
    <div data-panel style="position:absolute;left:16px;right:16px;top:50%;transform:translateY(-50%);max-width:360px;max-height:calc(100% - 32px);overflow:auto;margin:auto;background:#fffbf3;color:#1d1d1f;border-radius:18px;padding:18px;font:15px/1.45 system-ui,sans-serif;box-shadow:0 10px 40px #0008"></div>`;
  document.body.append(root);
  const cv = root.querySelector('canvas'), cx = cv.getContext('2d'), panel = root.querySelector('[data-panel]');
  const was = document.body.style.overflow; document.body.style.overflow = 'hidden';

  let W, H, U; // U — «метр» у ног Карыча в пикселях; ширина полосы
  const fit = () => { const r = devicePixelRatio || 1; W = root.clientWidth; H = root.clientHeight; cv.width = W * r; cv.height = H * r; cx.setTransform(r, 0, 0, r, 0, 0); U = Math.min(W * .3, H * .17); };
  fit();

  // перспектива: k(z) — масштаб предмета на расстоянии z, sy/sx — где он на экране
  const k = z => D / (Math.max(z, -D * .8) + D);
  const hy = () => H * .3, gy = () => H * .8;
  const sy = z => hy() + (gy() - hy()) * k(z), sx = (l, z) => W / 2 + (l - px * .3) * U * k(z); // камера чуть следует за Карычем

  let st = 'intro', paused = false, best = +load('karychBest') || 0, last = 0, raf;
  let who = CHASERS[load('karychWho')] ? load('karychWho') : 'baba', CH = CHASERS[who];
  let t, dist, ents, nextRow, nextBox, lane, px, gx, jump, duck, sleep, doze, bed, beds, letters, rolls, pts, sent, gap, slow, cont, toasts, flies, queue;
  let back, cramp, streak, smokeAt, slip, slipT, kingT, rage, calm, shake, hurt, sparks;
  function reset() {
    t = dist = jump = duck = sleep = doze = bed = beds = rolls = pts = sent = slow = back = cramp = streak = smokeAt = rage = calm = 0;
    ents = []; toasts = []; flies = []; queue = []; nextRow = 28; nextBox = 14; lane = px = gx = 0;
    shake = hurt = 0; sparks = [];
    letters = 8; gap = .55; slip = null; slipT = 12; kingT = 15; cont = false;
  }
  const mult = () => Math.min(5, 1 + Math.floor(streak / 2)); // «Держусь»: каждые две обойдённые сигареты — +1
  const score = () => Math.max(0, Math.floor((dist / 2 + pts) * CH.mult));
  const toast = s => toasts.push({s, t: 1.3});
  const jy = () => bed > 0 ? .7 : jump > 0 ? Math.sin(Math.PI * (1 - jump / JUMP)) * 1.3 : 0;
  const mine = () => Math.round(px);

  // дорога впереди: ряд препятствий через каждые 7–11 м, хотя бы одна полоса свободна — на ней и лежат предметы
  // (сигарета на свободной полосе — соблазн: её надо перепрыгнуть или уйти в сторону); ящики — отдельно, по обочинам
  function spawn() {
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
  }
  function toss() {
    if (bed > 0) return;
    if (!letters) return toast('Письма кончились — лови 📨');
    throwAt(ents.filter(e => e.k === 'box' && reach(e, mine())).sort((a, b) => a.at - b.at)[0]);
  }
  function rest() {
    if (!beds || bed > 0) return;
    beds--; bed = BED; doze = jump = duck = cramp = 0; sleep = 0; toast('🛏️ Хр-р-р…');
  }
  const move = d => { lane = Math.max(-1, Math.min(1, lane + d)); };
  const up = () => { if (bed <= 0 && cramp <= 0 && jump <= 0) { jump = JUMP; duck = 0; } };
  // наклон грузит спину: 3–4 подряд — прострел
  function down() {
    if (bed > 0 || cramp > 0) return;
    jump = 0; duck = .6;
    if ((back += .3) >= 1) { back = 0; cramp = 3; duck = 0; buzz(150); toast('🦴 Прострел! Не нагнуться'); }
  }
  // уснул на ходу — руки слушаются с опозданием
  const act = f => doze > 0 ? queue.push([t + .35, f]) : f();

  function hit(n, msg) {
    if (bed > 0 || st !== 'run') return;
    if (who === 'dimon') { n *= 1 + rage * .25; if (rage < 3) { rage++; msg += ' Димон звереет 😡'; } calm = 0; }
    gap -= n; slow = .8; shake = .35; hurt = .5; buzz(60); toast(msg);
    if (doze > 0) { doze = 0; sleep = .35; }
    if (gap <= 0) over();
  }
  // искры: разлетаются из точки и падают
  const burst = (x, y, c) => { for (let i = 0; i < 14; i++) { const a = Math.random() * 7, v = rnd(120, 320); sparks.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, r: rnd(2, 5), l: 1, c}); } };
  function take(e) {
    e.gone = true; burst(sx(e.lane, 0), sy(0) - U * .4, e.k === 'cig' ? '#ff7a5a' : '#ffe08a');
    if (e.k === 'bag') { letters = Math.min(15, letters + 5); toast('📨 +5 писем'); }
    if (e.k === 'roll') { rolls++; toast('🧻 рулон'); }
    if (e.k === 'pillow') { beds = Math.min(2, beds + 1); toast('🛏️ кровать — жми кнопку'); }
    if (e.k === 'lolly') { sleep = Math.max(0, sleep - .35); toast('🍭 Полегчало'); }
    if (e.k === 'cig') { sleep = 0; gap = Math.min(1, gap + .15); toast(streak > 1 ? '🚬 Сорвался… множитель ×1' : '🚬 Затянулся… бодрит, но не гордись'); streak = 0; smokeAt = dist; }
  }
  function avoid() { const m = mult(); streak++; if (mult() > m) toast(`🚭 Держусь ×${mult()}`); }

  function step(dt) {
    t += dt;
    const v = Math.min(26, 11 + t * .12) * (slow > 0 || cramp > 0 ? .6 : 1);
    slow -= dt; dist += v * dt;
    if (bed > 0) bed -= dt;
    if (cramp > 0) cramp -= dt;
    back = Math.max(0, back - dt * .12);
    if (doze > 0 && (doze -= dt) <= 0) sleep = .35;
    if (bed <= 0 && doze <= 0 && (sleep += dt / 28) >= 1) { sleep = 1; doze = 4; buzz(200); toast('😴 Уснул на ходу!'); }
    // погоня: бежишь чисто — отстаёт, уснул или прострел — нагоняет
    const away = who === 'dimon' ? CH.back - rage * .015 : CH.back;
    gap = Math.min(1, gap + dt * (bed > 0 ? .06 : doze > 0 ? -.07 : cramp > 0 ? -.05 : away));
    if (gap <= 0) return over();
    if (who === 'dimon' && rage && (calm += dt) > 7) { rage--; calm = 0; toast('👴 Димон выдыхается'); }
    px += Math.sign(lane - px) * Math.min(Math.abs(lane - px), dt * 9);
    gx += (px - gx) * Math.min(1, dt * 3);
    if (jump > 0) jump -= dt;
    if (duck > 0) duck -= dt;
    queue = queue.filter(([at, f]) => at > t || (f(), false));

    // бабушка близко — метка на полосе Карыча, через секунду туда прилетает 🩴
    if (who === 'baba' && t > 20 && gap < .85 && bed <= 0 && (slipT -= dt) <= 0) { slip = {lane: mine(), t: 1.1}; slipT = rnd(9, 14); }
    if (slip && (slip.t -= dt) <= 0) { if (mine() === slip.lane) hit(.2, '🩴 Тапком!'); slip = null; }
    // Король ставит 🚧 на полосу Карыча метрах в 26 впереди, там, где рядом нет других преград
    if (who === 'king' && t > 15 && bed <= 0 && (kingT -= dt) <= 0) {
      const at = dist + 26;
      if (!ents.some(e => !(e.k in ITEMS) && e.k !== 'box' && Math.abs(e.at - at) < 3)) { ents.push({k: 'wall', lane: mine(), at, king: true}); toast('🤴 Король ставит преграду!'); }
      kingT = rnd(6, 9);
    }

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
      if (f.box) { const p = (f.box.reg ? 30 : 10) * mult(); pts += p; sent++; f.box.ok = true; { const z = f.box.at - dist; burst(sx(f.box.side * 2.35, z), sy(z) - U * .7 * k(z), f.box.reg ? '#ff5a4a' : '#7fb2ff'); } toast(`${f.box.reg ? '📮' : '📫'} +${p}`); buzz(15); }
      else { pts -= 5; toast('Мимо — жалоба −5'); }
    }
    flies = flies.filter(f => f.t < .5);
    toasts = toasts.filter(s => (s.t -= dt) > 0);
    shake = Math.max(0, shake - dt); hurt = Math.max(0, hurt - dt);
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.l -= dt * 1.6; }
    sparks = sparks.filter(p => p.l > 0);
  }

  // ——— рисование ———
  // свой стиль: двор из панелек на рассвете, Карыч — нарисованный почтальон (вид со спины), препятствия объёмные
  const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const WALLS = ['#e9b8a4', '#f1d49c', '#a9c7e6', '#c9b8e0', '#b9dcb2', '#efe6d6'], SIDES = ['#c99682', '#cfb27c', '#87a5c4', '#a796be', '#97ba90', '#cdc4b4'];
  function emoji(ch, x, y, size, sq = 1, rot = 0) {
    cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(1, sq);
    cx.fillStyle = '#000'; // цветной эмодзи берёт прозрачность из fillStyle — иначе он полупрозрачный
    cx.font = `${size}px system-ui,"Apple Color Emoji","Noto Color Emoji",sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'bottom';
    cx.fillText(ch, 0, 0); cx.restore();
  }
  const poly = (pts, c) => { cx.fillStyle = c; cx.beginPath(); pts.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); cx.closePath(); cx.fill(); };
  // плоскость на земле между полосами a..b и расстояниями z1 (дальше) .. z0 (ближе)
  const quad = (a, b, z1, z0, c) => poly([[sx(a, z1), sy(z1)], [sx(b, z1), sy(z1)], [sx(b, z0), sy(z0)], [sx(a, z0), sy(z0)]], c);
  // вертикальная стенка вдоль дороги на полосе x, высота от h0 до h1 «метров»
  const side = (x, z1, z0, h0, h1, c) => poly([[sx(x, z1), sy(z1) - h0 * U * k(z1)], [sx(x, z1), sy(z1) - h1 * U * k(z1)], [sx(x, z0), sy(z0) - h1 * U * k(z0)], [sx(x, z0), sy(z0) - h0 * U * k(z0)]], c);
  const rrect = (x, y, w, h, r, c) => { cx.fillStyle = c; cx.beginPath(); cx.roundRect(x, y, w, h, r); cx.fill(); };
  const shadow = (x, y, w) => { cx.fillStyle = '#0003'; cx.beginPath(); cx.ellipse(x, y, w, w * .28, 0, 0, 7); cx.fill(); };

  function sky() {
    const g = cx.createLinearGradient(0, 0, 0, hy());
    g.addColorStop(0, '#3b5ba8'); g.addColorStop(.6, '#8fb3e8'); g.addColorStop(1, '#ffd2a1');
    cx.fillStyle = g; cx.fillRect(0, 0, W, hy() + 2);
    const sun = cx.createRadialGradient(W * .7, hy() * .75, 0, W * .7, hy() * .75, U * 1.4);
    sun.addColorStop(0, '#fff6d8'); sun.addColorStop(.25, '#ffe08a'); sun.addColorStop(1, '#ffe08a00');
    cx.fillStyle = sun; cx.fillRect(0, 0, W, hy());
    cx.fillStyle = '#ffffffcc';
    for (let i = 0; i < 5; i++) { // облака плывут медленнее дороги — глубина
      const x = ((hsh(i) * W * 1.6 - t * (6 + i * 2) - dist * .3) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * .3, y = hy() * (.15 + hsh(i + 9) * .5), r = U * (.25 + hsh(i + 3) * .2);
      cx.beginPath(); cx.ellipse(x, y, r * 2, r * .7, 0, 0, 7); cx.ellipse(x + r, y - r * .4, r * 1.1, r * .7, 0, 0, 7); cx.ellipse(x - r * .9, y - r * .2, r, r * .55, 0, 0, 7); cx.fill();
    }
    cx.fillStyle = '#9aa7c2'; cx.fillRect(0, hy(), W, H); // дальний город в дымке
  }
  function ground() {
    for (let b = Math.floor((dist + FAR) / 2) * 2; b > dist - 4; b -= 2) {
      const z1 = b - dist, z0 = z1 - 2, odd = (b / 2) % 2;
      quad(-3, -1.75, z1, z0, odd ? '#cfc6b8' : '#c5bcad'); quad(1.75, 3, z1, z0, odd ? '#cfc6b8' : '#c5bcad'); // плитка тротуара
      quad(-1.75, -1.55, z1, z0, '#e8e2d6'); quad(1.55, 1.75, z1, z0, '#e8e2d6'); // бордюр
      quad(-1.55, 1.55, z1, z0, odd ? '#4f5260' : '#4a4d5a'); // асфальт
      if (odd) for (const m of [-.5, .5]) quad(m - .035, m + .035, z1 - .4, z0 + .4, '#f2f2f2');
      if (hsh(b) > .86) quad(hsh(b + 1) * 2 - 1.2, hsh(b + 1) * 2 - .7, z1 - .5, z0 + .8, '#3c3f4c'); // лужа или заплатка
    }
  }
  // панельки по обе стороны: квартал 8 м, между кварталами — проход во двор
  function houses() {
    for (let i = Math.floor((dist + FAR) / 8); i * 8 + 7 > dist - 2; i--) for (const s of [-1, 1]) {
      const zf = i * 8 + 7 - dist, zn = i * 8 - dist, n = i * 2 + (s > 0), c = Math.floor(hsh(n) * 6), h = 3 + Math.floor(hsh(n + 50) * 4) * .9;
      if (zf > FAR || zf < -1) continue;
      const x = s * 3.1;
      side(x, zf, Math.max(zn, -1.5), 0, h, SIDES[c]);
      for (let f = 0; f < Math.floor(h / .9) - 0; f++) for (let w = 0; w < 4; w++) {
        const za = zn + (w + .25) / 4 * 7, zb = zn + (w + .7) / 4 * 7;
        if (za < -1.2) continue;
        side(x, zb, za, .35 + f * .9, .8 + f * .9, hsh(n * 31 + f * 7 + w) > .7 ? '#ffe7a3' : '#46547a');
      }
      side(x, zf, Math.max(zn, -1.5), h - .12, h, '#00000026');
      if (zn > -1.2) { // торец, смотрящий на камеру
        const y0 = sy(zn), kk = k(zn), xa = sx(x, zn), xb = sx(s * 9, zn);
        poly([[xa, y0], [xb, y0], [xb, y0 - h * U * kk], [xa, y0 - h * U * kk]], WALLS[c]);
        cx.fillStyle = '#46547a';
        for (let f = 0; f < Math.floor(h / .9); f++) for (let w = 0; w < 2; w++) {
          const wx = sx(x + s * (.5 + w * 1.1), zn), wy = y0 - (.8 + f * .9) * U * kk;
          cx.fillStyle = hsh(n * 13 + f * 3 + w) > .65 ? '#ffe7a3' : '#46547a';
          cx.fillRect(Math.min(wx, wx + s * .5 * U * kk), wy, .5 * U * kk, .45 * U * kk);
        }
      }
    }
  }

  function box3d(x, y, w, h, s, c, top) { // коробка: перед + крышка
    rrect(x - w / 2, y - h, w, h, 2 * s, c);
    poly([[x - w / 2, y - h], [x + w / 2, y - h], [x + w * .42, y - h - h * .22], [x - w * .42, y - h - h * .22]], top);
  }
  function drawEnt(e) {
    const z = e.at - dist, s = k(z);
    if (e.gone || z < -.8 || z > FAR) return;
    if (e.k === 'box') {
      const x = sx(e.side * 2.35, z), y = sy(z), u = U * s;
      if (st === 'run' && reach(e, mine()) && bed <= 0) { cx.fillStyle = `rgba(255,216,74,${.45 + .25 * Math.sin(t * 10)})`; cx.beginPath(); cx.ellipse(x, y, u * .5, u * .16, 0, 0, 7); cx.fill(); }
      cx.fillStyle = '#555'; cx.fillRect(x - u * .04, y - u * .6, u * .08, u * .6); // столбик
      rrect(x - u * .3, y - u * 1.05, u * .6, u * .5, u * .08, e.reg ? '#d8342c' : '#2f6fd6');
      rrect(x - u * .3, y - u * 1.05, u * .6, u * .1, u * .06, e.reg ? '#ff6a5a' : '#5b93f0');
      rrect(x - u * .18, y - u * .9, u * .36, u * .06, u * .03, '#1b1b1b');
      if (e.reg) emoji('⭐', x, y - u * .6, u * .24);
      if (e.ok) emoji('✅', x, y - u * 1.05, u * .34);
      return;
    }
    const x = sx(e.lane, z), y = sy(z), u = U * s;
    if (e.k === 'wall') { // дорожный барьер — только обойти
      shadow(x, y, u * .45);
      for (const d of [-.36, .36]) rrect(x + d * u - u * .04, y - u * .95, u * .08, u * .95, u * .02, '#6b6b6b');
      for (const [hy0, hh] of [[.9, .28], [.5, .28]]) {
        cx.save(); cx.beginPath(); cx.roundRect(x - u * .46, y - u * hy0, u * .92, u * hh, u * .04); cx.clip();
        cx.fillStyle = e.king ? '#ffd23f' : '#fff'; cx.fillRect(x - u * .5, y - u * hy0, u, u * hh);
        cx.fillStyle = e.king ? '#7a5c00' : '#e5392f';
        for (let i = -4; i < 5; i++) poly([[x + i * u * .16, y - u * hy0], [x + (i + .5) * u * .16, y - u * hy0], [x + (i + .5) * u * .16 - u * .1, y - u * (hy0 - hh)], [x + i * u * .16 - u * .1, y - u * (hy0 - hh)]], cx.fillStyle);
        cx.restore();
      }
      cx.fillStyle = Math.floor(t * 4) % 2 ? '#ffb300' : '#ff6a00'; cx.beginPath(); cx.arc(x, y - u * 1, u * .06, 0, 7); cx.fill();
      if (e.king) emoji('👑', x, y - u * 1.05, u * .4);
    } else if (e.k === 'low') { // коробки с посылками — перепрыгнуть
      shadow(x, y, u * .4);
      box3d(x - u * .12, y, u * .5, u * .36, s, '#c8955a', '#ddb07a');
      box3d(x + u * .2, y, u * .34, u * .26, s, '#b98349', '#d4a46c');
      cx.fillStyle = '#e9d6b0'; cx.fillRect(x - u * .14, y - u * .36, u * .05, u * .36);
    } else if (e.k === 'line') { // бельевая верёвка — нагнуться
      const h = y - u * 1.05, a = sx(e.lane - .48, z), b = sx(e.lane + .48, z);
      cx.strokeStyle = '#8a6a4a'; cx.lineWidth = Math.max(1.5, 5 * s);
      cx.beginPath(); cx.moveTo(a, y); cx.lineTo(a, h - u * .05); cx.moveTo(b, y); cx.lineTo(b, h - u * .05); cx.stroke();
      cx.strokeStyle = '#f4f4f4'; cx.lineWidth = Math.max(1, 2 * s);
      cx.beginPath(); cx.moveTo(a, h); cx.quadraticCurveTo(x, h + u * .08, b, h); cx.stroke();
      const sw = Math.sin(t * 4 + e.at) * .05;
      [['#e94b6a', -.28, .26, .3], ['#4bb3e9', 0, .3, .34], ['#f2c84b', .27, .22, .24]].forEach(([c, dx, w, hh]) => {
        cx.save(); cx.translate(x + dx * u, h + u * .06); cx.rotate(sw);
        rrect(-w * u / 2, 0, w * u, hh * u, u * .03, c); cx.restore();
      });
    } else { // предметы: светящийся ореол и покачивание
      const yy = y - u * (.35 + .08 * Math.sin(t * 5 + e.at));
      shadow(x, y, u * .2);
      const gl = cx.createRadialGradient(x, yy - u * .2, 0, x, yy - u * .2, u * .45);
      gl.addColorStop(0, e.k === 'cig' ? '#ff6a4a88' : '#fff6b088'); gl.addColorStop(1, '#fff6b000');
      cx.fillStyle = gl; cx.fillRect(x - u * .5, yy - u * .7, u, u);
      emoji(ITEMS[e.k], x, yy, u * .5, 1, Math.sin(t * 3 + e.at) * .15);
    }
  }
  // Карыч со спины: форма, кепка, сумка через плечо; ноги и руки машут в такт бегу
  function karych(x, y, u, sq, rot) {
    const ph = Math.sin(dist * 1.6), run = jump > 0 ? .3 : 1;
    cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(1, sq);
    for (const s of [-1, 1]) { // ноги
      const sw = ph * s * run;
      cx.save(); cx.translate(s * u * .08, -u * .36); cx.rotate(sw * .5);
      rrect(-u * .055, 0, u * .11, u * .32, u * .05, '#2b3557'); rrect(-u * .07, u * .28, u * .14, u * .08, u * .04, '#222'); cx.restore();
    }
    for (const s of [-1, 1]) { // руки
      cx.save(); cx.translate(s * u * .2, -u * .7); cx.rotate(-ph * s * run * .6 + s * .15);
      rrect(-u * .045, 0, u * .09, u * .28, u * .045, '#2f5fbf'); cx.fillStyle = '#f0c08a'; cx.beginPath(); cx.arc(0, u * .3, u * .05, 0, 7); cx.fill(); cx.restore();
    }
    rrect(-u * .2, -u * .76, u * .4, u * .44, u * .1, '#3a72d8'); // куртка
    rrect(-u * .2, -u * .4, u * .4, u * .07, u * .03, '#2b5bb5');
    cx.strokeStyle = '#7a4a22'; cx.lineWidth = u * .045; cx.beginPath(); cx.moveTo(-u * .17, -u * .74); cx.lineTo(u * .18, -u * .42); cx.stroke(); // ремень
    rrect(u * .1, -u * .5, u * .2, u * .17, u * .04, '#9a5e2c'); rrect(u * .13, -u * .47, u * .14, u * .05, u * .02, '#f4efe2'); // сумка с письмами
    rrect(-u * .05, -u * .8, u * .1, u * .06, u * .02, '#e2ad78'); // шея
    cx.fillStyle = '#f0c08a'; for (const s of [-1, 1]) { cx.beginPath(); cx.ellipse(s * u * .125, -u * .86, u * .03, u * .045, 0, 0, 7); cx.fill(); } // уши
    cx.fillStyle = '#3a2a1e'; cx.beginPath(); cx.arc(0, -u * .87, u * .125, 0, 7); cx.fill(); // затылок — мы видим Карыча со спины
    rrect(-u * .14, -u * 1.0, u * .28, u * .1, u * .05, '#1f3a7a'); rrect(-u * .15, -u * .93, u * .3, u * .035, u * .02, '#16295a'); // кепка
    cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.arc(0, -u * .97, u * .025, 0, 7); cx.fill();
    cx.restore();
  }
  function drawPlayer() {
    const x = sx(px, 0), y = sy(0), lift = jy() * U;
    shadow(x, y, U * (.3 - lift / U * .08));
    if (bed > 0) { // кровать летит, Карыч спит под одеялом
      if (bed < 1.5 && Math.floor(t * 8) % 2) return;
      const yy = y - lift + Math.sin(t * 3) * U * .04;
      rrect(x - U * .45, yy - U * .22, U * .9, U * .14, U * .04, '#7a4a28');
      rrect(x - U * .45, yy - U * .46, U * .08, U * .36, U * .03, '#6b3f20'); rrect(x + U * .37, yy - U * .36, U * .08, U * .26, U * .03, '#6b3f20');
      rrect(x - U * .4, yy - U * .32, U * .8, U * .12, U * .05, '#f6f1e6');
      rrect(x - U * .1, yy - U * .4, U * .52, U * .16, U * .07, '#5d8be8');
      rrect(x - U * .38, yy - U * .42, U * .24, U * .13, U * .06, '#fff');
      cx.fillStyle = '#f0c08a'; cx.beginPath(); cx.arc(x - U * .2, yy - U * .42, U * .09, 0, 7); cx.fill();
      rrect(x - U * .3, yy - U * .52, U * .2, U * .07, U * .035, '#1f3a7a');
      cx.fillStyle = '#fff'; cx.font = `bold ${U * .2}px system-ui,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'bottom';
      cx.fillText('z', x + U * .05, yy - U * .55 - Math.sin(t * 2) * 4); cx.fillText('Z', x + U * .2, yy - U * .7 - Math.cos(t * 2) * 4);
      return;
    }
    karych(x, y - lift, U * .95, duck > 0 ? .6 : 1, cramp > 0 ? .35 : 0);
    if (cramp > 0) emoji('💢', x - U * .3, y - lift - U * .6, U * .35);
    if (doze > 0) emoji('💤', x + U * .3, y - lift - U * .9, U * .35);
  }
  function pill(x, y, w, h) { rrect(x, y, w, h, h / 2, '#0b1430a0'); }
  function bar(x, y, w, v, c, label) {
    pill(x - 26, y - 6, w + 34, 20);
    cx.fillStyle = '#ffffff22'; cx.beginPath(); cx.roundRect(x, y, w, 8, 4); cx.fill();
    cx.fillStyle = c; cx.beginPath(); cx.roundRect(x, y, Math.max(4, w * Math.max(0, Math.min(1, v))), 8, 4); cx.fill();
    emoji(label, x - 13, y + 13, 15);
  }
  function draw() {
    cx.save();
    if (shake > 0) cx.translate((Math.random() - .5) * shake * 30, (Math.random() - .5) * shake * 30);
    sky(); ground(); houses();
    ents.filter(e => e.at - dist > 0).sort((a, b) => b.at - a.at).forEach(drawEnt);
    if (slip) {
      const x = sx(slip.lane, 0), y = sy(0);
      if (Math.floor(t * 10) % 2) { cx.strokeStyle = '#ff3b30'; cx.lineWidth = 4; cx.beginPath(); cx.ellipse(x, y, U * .4, U * .12, 0, 0, 7); cx.stroke(); }
      if (slip.t < .3) emoji('🩴', x, y - U * .4 - (slip.t / .3) * H * .6, U * .5);
    }
    drawPlayer();
    ents.filter(e => e.at - dist <= 0).forEach(drawEnt);
    for (const f of flies) if (f.t < .3) {
      const q = f.t / .3, tz = f.box ? f.box.at - dist : 10, tx = f.box ? sx(f.box.side * 2.35, tz) : sx(f.dir * 3, tz), x0 = sx(f.x, 0), y0 = sy(0) - U * (.6 + f.y), ty = sy(tz) - U * .7 * k(tz);
      emoji('✉️', x0 + (tx - x0) * q, y0 + (ty - y0) * q - Math.sin(q * Math.PI) * U * .4, U * (.35 - .2 * q), 1, q * 6);
    }
    // искры от подборов и попаданий
    for (const p of sparks) { cx.globalAlpha = Math.max(0, p.l); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
    cx.globalAlpha = 1;
    // преследователь сзади: чем ближе, тем выше вылезает из-под края экрана
    const cy = gy() + U * .5 + gap * U * 1.6, cxp = sx(gx, 0);
    shadow(cxp, cy, U * .4);
    emoji(CH.face, cxp, cy + Math.abs(Math.sin(t * 8)) * -U * .06, U * .85);
    if (who === 'dimon' && rage) emoji('😡'.repeat(rage), cxp, cy - U * .95, U * .3);
    // линии скорости по краям
    const sp = Math.min(1, Math.max(0, (t - 25) / 60));
    if (sp > 0 && st === 'run') { cx.strokeStyle = `rgba(255,255,255,${.25 * sp})`; cx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = hsh(i + Math.floor(t * 12) * 8) * Math.PI * 2, r0 = Math.max(W, H) * .45; cx.beginPath(); cx.moveTo(W / 2 + Math.cos(a) * r0, hy() + Math.sin(a) * r0); cx.lineTo(W / 2 + Math.cos(a) * r0 * 1.4, hy() + Math.sin(a) * r0 * 1.4); cx.stroke(); } }
    if (doze > 0) { const v = cx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75); v.addColorStop(0, '#0a0a1e55'); v.addColorStop(1, '#0a0a1ee0'); cx.fillStyle = v; cx.fillRect(0, 0, W, H); }
    if (bed > 0) { cx.fillStyle = '#4a7dff1c'; cx.fillRect(0, 0, W, H); }
    if (hurt > 0) { cx.fillStyle = `rgba(255,40,40,${hurt * .5})`; cx.fillRect(0, 0, W, H); }
    cx.restore();

    // HUD
    pill(10, 10, 150, 64);
    cx.fillStyle = '#fff'; cx.textAlign = 'left'; cx.textBaseline = 'top';
    cx.font = 'bold 28px system-ui,sans-serif'; cx.fillText(score(), 22, 14);
    cx.font = '12px system-ui,sans-serif'; cx.fillStyle = '#ffffffb0'; cx.fillText('рекорд ' + best, 22, 48);
    pill(10, 80, 190, 24); cx.fillStyle = '#fff'; cx.font = '13px system-ui,sans-serif';
    cx.fillText(`✉️ ${letters}   🧻 ${rolls}   🚭 ×${mult()}${CH.mult > 1 ? `   ${CH.face}×${CH.mult}` : ''}`, 20, 85);
    const bw = Math.min(130, W * .32);
    bar(36, 118, bw, sleep, sleep > .75 ? '#ff9f0a' : '#b4a7ff', '😪');
    bar(36, 142, bw, cramp > 0 ? cramp / 3 : back, cramp > 0 || back > .65 ? '#ff3b30' : '#8fd18f', '🦴');
    bar(36, 166, bw, 1 - gap, gap < .35 ? '#ff3b30' : '#ffcc00', CH.face);
    if (bed > 0) bar(36, 190, bw, bed / BED, '#6ea8ff', '🛏️');
    // кнопка кровати
    const bx = W - 52, by = H - 62, on = beds && bed <= 0;
    cx.globalAlpha = on ? 1 : .4;
    if (on) { cx.fillStyle = `rgba(255,224,138,${.35 + .25 * Math.sin(t * 6)})`; cx.beginPath(); cx.arc(bx, by, 42, 0, 7); cx.fill(); }
    cx.fillStyle = '#ffffffe0'; cx.beginPath(); cx.arc(bx, by, 34, 0, 7); cx.fill();
    emoji('🛏️', bx, by + 16, 32);
    cx.fillStyle = '#1d1d1f'; cx.font = 'bold 14px system-ui,sans-serif'; cx.textAlign = 'center'; cx.fillText('×' + beds, bx + 22, by + 14);
    cx.globalAlpha = 1;
    // всплывающие надписи
    cx.textAlign = 'center'; cx.font = 'bold 22px system-ui,sans-serif'; cx.lineJoin = 'round';
    toasts.slice(-3).forEach((s, i, a) => {
      const y = H * .4 + (i - a.length) * 30 - (1.3 - s.t) * 24, sc = 1 + Math.max(0, s.t - 1.1) * 2;
      cx.globalAlpha = Math.min(1, s.t * 2); cx.save(); cx.translate(W / 2, y); cx.scale(sc, sc);
      cx.strokeStyle = '#0b1430'; cx.lineWidth = 5; cx.strokeText(s.s, 0, 0); cx.fillStyle = '#fff'; cx.fillText(s.s, 0, 0); cx.restore();
    });
    cx.globalAlpha = 1;
    cx.font = 'bold 14px system-ui,sans-serif'; cx.strokeStyle = '#0b1430'; cx.lineWidth = 4; cx.fillStyle = '#fff';
    const say = (s, y) => { cx.strokeText(s, W / 2, y); cx.fillText(s, W / 2, y); };
    if (st === 'run' && t < 7) { say('свайп ← → ↑ ↓ — бежать', 218); say('тап — письмо в подсвеченный ящик', 238); }
    if (doze > 0) { cx.font = 'bold 20px system-ui,sans-serif'; say(beds ? 'Уснул! Жми 🛏️' : 'Уснул на ходу…', H * .47); }
  }

  // ——— экраны ———
  const btn = (a, s, main, v = '') => `<button data-a="${a}" data-v="${v}" style="font:inherit;font-weight:600;padding:12px;border:0;border-radius:12px;background:${main ? '#c8940e' : '#ece6da'};color:${main ? '#fff' : '#1d1d1f'};text-align:left">${s}</button>`;
  function show(html) { panel.innerHTML = html; panel.hidden = !html; }
  function intro() {
    show(`<div style="font-size:24px;font-weight:700">📬 Карыч: Доставка</div>
      <p style="margin:6px 0">Карыч опять проспал смену. Разнеси письма, пока тебя не догнали.</p>
      <div style="font-size:14px;display:grid;gap:4px;margin-bottom:12px">
        <div>👆 Свайп ← → — полоса, ↑ — прыжок через 📦, ↓ — нагнуться под бельё</div>
        <div>✉️ Тап — письмо в подсвеченный ящик. Со своей стороны дороги кидает дальше</div>
        <div>😪 Шкала полная — уснёт на ходу. 🛏️ Кровать (кнопка справа) — летит во сне, неуязвим, разносит сам</div>
        <div>🦴 Часто нагибаешься — прострел: хромает и не может ни прыгнуть, ни нагнуться</div>
        <div>🚬 Карыч бросил курить: перепрыгнул или обошёл сигарету — растёт множитель за письма. Взял — бодрит, но множитель сгорает. 🍭 — честно снимает сонливость</div>
        <div>🧻 Рулоны — чтобы продолжить, когда поймали</div>
      </div>
      <div style="font-weight:700;margin-bottom:6px">Кто гонится?</div>
      <div style="display:grid;gap:8px">${Object.entries(CHASERS).map(([id, c]) => btn('go', `${c.face} ${c.name}${c.mult > 1 ? ` · очки ×${c.mult}` : ''}<br><span style="font-weight:400;font-size:13px;opacity:.85">${c.note}</span>`, id === who, id)).join('')}</div>`);
  }
  // рекорды недели: у кого больше — выше; свой выделен
  function table() {
    const r = Object.entries(week() || {}).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
    return `<div style="font-weight:700;margin:4px 0">📬 Рекорды недели</div>` + (r.length
      ? r.map(([n, v], i) => `<div style="display:flex;justify-content:space-between;${n === me() ? 'font-weight:700' : ''}"><span>${i ? i + 1 + '.' : '👑'} ${esc(n)}</span><span>${v}</span></div>`).join('')
      : '<div style="color:#6e6e73">Пока никого — будь первым</div>');
  }
  function over() {
    st = 'over'; buzz([80, 60, 80]);
    const s = score(), rec = s > best, my = (week() || {})[me()] || 0;
    if (rec) save('karychBest', best = s);
    const p = paper();
    const note = !me() ? 'Войди в Соцочку — попадёшь в рекорды недели' : s > my ? 'Сохраняю рекорд недели…' : '';
    show(`<div style="font-size:22px;font-weight:700">${CH.face} ${CH.got}</div>
      <p style="margin:8px 0"><b style="font-size:28px">${s}</b> ${rec ? '— личный рекорд! 🎉' : `· личный рекорд ${best}`}<br><span style="color:#6e6e73">Разнёс писем: ${sent} · не курил ${Math.floor((dist - smokeAt) / 2)} м</span></p>
      ${p && p.rolls <= 2 ? `<p style="margin:0 0 12px;color:#e5484d;font-weight:600">🧻 Ты тут сидишь, а бумаги осталось ${p.rolls}. Староста — ${esc(boss())}</p>` : ''}
      <div data-top style="font-size:14px;margin-bottom:12px">${table()}${note ? `<div style="color:#6e6e73;margin-top:4px">${note}</div>` : ''}</div>
      <div style="display:grid;gap:8px">${rolls && !cont ? btn('cont', `Продолжить за 🧻 (есть ${rolls})`, 1) : ''}${btn('go', 'Ещё раз', !(rolls && !cont), who)}${btn('menu', 'Сменить преследователя')}</div>`);
    if (me() && s > my) submit(s).then(ok => { const el = panel.querySelector('[data-top]'); if (el) el.innerHTML = table() + (ok ? '' : '<div style="color:#e5484d;margin-top:4px">Не сохранилось — нет связи</div>'); });
  }
  function go(id) { if (CHASERS[id]) save('karychWho', who = id); CH = CHASERS[who]; reset(); st = 'run'; paused = false; show(''); }

  panel.onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'go') go(b.dataset.v);
    if (a === 'menu') { st = 'intro'; intro(); }
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
  const hide = () => { if (document.hidden && st === 'run' && !paused) { paused = true; show(`<div style="font-size:22px;font-weight:700;margin-bottom:12px">⏸ Пауза</div>${btn('resume', 'Продолжить', 1)}`); } };
  addEventListener('resize', fit); addEventListener('keydown', keys); document.addEventListener('visibilitychange', hide);
  function close() {
    cancelAnimationFrame(raf); root.remove(); document.body.style.overflow = was;
    removeEventListener('resize', fit); removeEventListener('keydown', keys); document.removeEventListener('visibilitychange', hide);
  }

  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (st === 'run' && !paused) { spawn(); step(dt); }
    draw(); raf = requestAnimationFrame(loop);
  };
  reset(); spawn(); intro(); raf = requestAnimationFrame(loop);
};
})();
