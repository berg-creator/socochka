// Максоник: ВСЁ ЛОЖНО — вторая мини-игра раздела 🧻 (index.html грузит файл только по кнопке «🕵️»). Point & click в 3D.
// Максим, 3 курс медуниверситета, прогуливает пары так, чтобы деканат ничего не заметил: каждую пару срывает её же предметом.
// Хаб — туалет третьего этажа; пары — сцены-диорамы с фиксированной камерой. Тап по полу — идёт, по предмету — осматривает/берёт,
// предмет из инвентаря → на объект — применить, на другой предмет — соединить. Препод то занят (доска, микроскоп), то смотрит:
// пока смотрит, ходить и рисковать нельзя — растёт «палево»; 100 % — к доске, пару заново. Уйти можно всегда, но это н-ка (−10 % посещаемости).
// Персонажи — те же модели Quaternius (CC0), что в «Карыче» (assets/karych), перекрашены и одеты кодом. Звук синтезируется на лету.
(() => {
const MV = 1, MODELS = {kar: 290e3, baba: 120e3, king: 125e3, dimon: 70e3};
let lib, busy;
window.maks = () => {
  if (busy) return; busy = true;
  A();
  const ld = loading();
  (lib ||= loadAll(ld.set)).then(L => { busy = false; game(L); ld.done(); },
    e => { console.error(e); lib = busy = null; ld.done(); alert('Игра не загрузилась — проверь интернет'); });
};
const BG = 'radial-gradient(120% 80% at 50% 30%,#d43cc4,#7a1a8c 55%,#2a0a3a)';
const LOGO = `<div style="font:900 46px/1 system-ui,sans-serif;letter-spacing:1px;color:#fff;text-shadow:0 3px 0 #5a0f6a,0 0 30px #ff5ce6aa">МАКСОНИК</div>
  <div style="display:inline-block;margin-top:10px;padding:5px 12px;background:#b9b8bd;color:#1c2140;font:900 18px/1 'Arial Narrow',system-ui,sans-serif;letter-spacing:2px;border-radius:4px;box-shadow:0 4px 0 #6e6a78">ВСЁ ЛОЖНО</div>`;
function loading() {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;inset:0;z-index:1001;background:${BG};display:grid;place-content:center;justify-items:center;gap:18px;color:#fff;font:15px/1.4 system-ui,sans-serif;text-align:center`;
  d.innerHTML = `<div>${LOGO}</div>
    <div style="width:220px;height:12px;border-radius:6px;background:#ffffff33;overflow:hidden"><i style="display:block;height:100%;width:3%;border-radius:6px;background:linear-gradient(#ff8af0,#e03ad0);transition:width .2s"></i></div>
    <div data-pc style="font-weight:700;font-size:14px">Максим ищет отмазку… 0%</div>`;
  document.body.append(d);
  const bar = d.querySelector('i'), pc = d.querySelector('[data-pc]');
  return {set: v => { const p = Math.round(Math.min(1, v) * 100); bar.style.width = Math.max(3, p) + '%'; pc.textContent = `Максим ищет отмазку… ${p}%`; }, done: () => d.remove()};
}
async function loadAll(set) {
  const got = {}, size = {...MODELS}; let mods = 0;
  const tick = () => set(mods / 5 * .3 + .7 * Object.values(got).reduce((a, b) => a + b, 0) / Object.values(size).reduce((a, b) => a + b, 0));
  const mod = p => import(p).then(m => (mods++, tick(), m));
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

const pick = a => a[Math.floor(Math.random() * a.length)];
const load = k => { try { return localStorage[k] || ''; } catch { return ''; } };
const save = (k, v) => { try { localStorage[k] = v; } catch {} };
const buzz = ms => navigator.vibrate?.(ms);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ——— звук: короткие синтезированные сигналы, без файлов ———
let ac, out, muted = load('maksMute') === '1';
function A() {
  if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = muted ? 0 : .8; out.connect(ac.destination); } catch { ac = null; }
  if (ac?.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, d, {type = 'sine', v = .2, at = 0, f2, a = .005} = {}) {
  if (muted || !A()) return;
  const t = ac.currentTime + .01 + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(out); o.start(t); o.stop(t + d + .05);
}
let nbuf;
function noise(d, {v = .2, f = 1000, q = 1, at = 0, type = 'bandpass'} = {}) {
  if (muted || !A()) return;
  if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const c = nbuf.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
  const t = ac.currentTime + .01 + at, s = ac.createBufferSource(), b = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nbuf; b.type = type; b.frequency.value = f; b.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(b).connect(g).connect(out); s.start(t, Math.random() * .5); s.stop(t + d + .05);
}
const sfx = {
  tap: () => tone(900, .05, {type: 'triangle', v: .07}),
  pick: () => { tone(660, .09, {type: 'triangle', v: .16}); tone(990, .14, {type: 'triangle', v: .16, at: .07}); },
  combo: () => [523, 784, 1047, 1319].forEach((f, i) => tone(f, .16, {type: 'triangle', v: .12, at: i * .06})),
  no: () => { tone(240, .1, {type: 'square', v: .05}); tone(190, .16, {type: 'square', v: .05, at: .09}); },
  warn: () => tone(1250, .09, {type: 'square', v: .05}),
  alarm: () => { for (let i = 0; i < 3; i++) tone(950, .13, {type: 'sawtooth', v: .07, at: i * .17, f2: 620}); },
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .28, {type: 'triangle', v: .14, at: i * .1})),
  fail: () => [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? .8 : .32, {type: 'sawtooth', v: .06, at: i * .28})),
  door: () => { noise(.18, {f: 250, v: .35}); tone(140, .15, {type: 'sine', v: .2, at: .12}); },
  blinds: () => { for (let i = 0; i < 7; i++) noise(.04, {f: 3500, v: .1, at: i * .05, type: 'highpass'}); },
  click: () => noise(.04, {f: 2200, v: .25, q: 4}),
  step: () => noise(.035, {f: 500, v: .035, q: 2}),
  chalk: () => noise(.07, {f: 4200, v: .025, q: 3}),
  blip: p => tone(p * (.85 + Math.random() * .35), .055, {type: 'square', v: .022}),
};

function game(L) {
  const T = L.T;
  const gl = document.createElement('canvas');
  let R;
  try { R = new T.WebGLRenderer({canvas: gl, antialias: true, alpha: true, powerPreference: 'high-performance'}); } catch { return alert('Игре нужен WebGL — обнови браузер'); }
  const touch = matchMedia('(pointer: coarse)').matches;

  // ——— интерфейс: холст 3D, слой пузырей, HUD сверху, инвентарь снизу, панель для карточек ———
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;z-index:1000;background:${BG};touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:none;font:15px/1.4 system-ui,sans-serif;overflow:hidden`;
  root.innerHTML = `<style>
      .mx-b{position:absolute;top:10px;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#0006;color:#fff;font-size:17px;cursor:pointer}
      .mx-p{position:absolute;left:12px;right:12px;margin:auto;max-width:400px;max-height:calc(100% - 24px);overflow:auto;color:#1d1d1f}
      .mx-p button,.mx-inv button,.mx-ch button{font:inherit;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s}
      .mx-p button:active,.mx-ch button:active{transform:scale(.96)}
      .mx-card{top:50%;transform:translateY(-50%);padding:20px;border-radius:24px;background:#fff8fdf5;box-shadow:0 12px 40px #2a0a3a88;text-align:center}
      .mx-big{width:100%;padding:15px;border-radius:16px;background:linear-gradient(#f05ce0,#b8209f);color:#fff;font-weight:800!important;font-size:18px!important;box-shadow:0 4px 0 #7a1468,0 8px 20px #b8209f55}
      .mx-sec{width:100%;padding:12px;border-radius:14px;background:#f1e6f0;color:#1d1d1f;font-weight:600}
      .mx-link{background:none!important;color:#8a4d80;font-weight:600;padding:8px}
      .mx-row{display:flex;gap:10px;align-items:center;text-align:left;padding:10px 12px;border-radius:14px;background:#f5ecf4;margin-bottom:8px;width:100%;box-sizing:border-box}
      .mx-row b{font-size:26px;width:34px;text-align:center}.mx-row div{flex:1}.mx-row small{display:block;color:#7a6f78}
      .mx-row.go{background:linear-gradient(#ffe9fb,#f8d6f2);box-shadow:0 0 0 2px #e03ad0}
      .mx-row.off{opacity:.5}
      .mx-bub{position:absolute;max-width:230px;padding:8px 12px;border-radius:16px;background:#fff;color:#1d1d1f;font-weight:600;font-size:14.5px;line-height:1.3;box-shadow:0 4px 16px #0004;transform:translate(-50%,-100%);pointer-events:none;transition:opacity .15s}
      .mx-bub::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#fff}
      .mx-bub i{display:block;font-style:normal;font-size:11px;font-weight:800;color:#b8209f;text-transform:uppercase;letter-spacing:.5px}
      .mx-bub.me{background:#2a1c44;color:#fff}.mx-bub.me::after{border-top-color:#2a1c44}.mx-bub.me i{color:#ff9cf0}
      .mx-bub.th{background:#fff;color:#5a4d66;font-style:italic;border:2px dashed #b9a6c8}.mx-bub.th::after{display:none}
      .mx-eye{position:absolute;transform:translate(-50%,-100%);font-size:22px;line-height:1;padding:4px 6px;border-radius:12px;background:#fffc;pointer-events:none;transition:background .2s}
      .mx-eye.watch{background:#ff3b5c;box-shadow:0 0 0 3px #ff3b5c55,0 0 18px #ff3b5c}
      .mx-eye.turn{background:#ffc93a;animation:mxsh .25s infinite}
      @keyframes mxsh{50%{transform:translate(-50%,-100%) rotate(8deg)}}
      .mx-dot{position:absolute;transform:translate(-50%,-50%);pointer-events:none;display:grid;justify-items:center;animation:mxp 1s ease-in-out infinite}
      .mx-dot i{width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px #e03ad0aa,0 0 14px #fff}
      .mx-dot span{margin-top:3px;font-size:11px;font-weight:700;color:#fff;background:#0008;border-radius:6px;padding:1px 5px;white-space:nowrap}
      @keyframes mxp{50%{transform:translate(-50%,-50%) scale(1.15)}}
      .mx-top{position:absolute;left:10px;top:10px;display:grid;gap:6px;pointer-events:none}
      .mx-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:12px;background:#0007;color:#fff;font-weight:700;font-size:13px;width:max-content}
      .mx-pal{width:90px;height:8px;border-radius:4px;background:#ffffff33;overflow:hidden}.mx-pal i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffc93a,#ff3b5c)}
      .mx-inv{position:absolute;left:0;right:0;bottom:0;padding:8px 10px calc(10px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:center;background:linear-gradient(#2a0a3a00,#2a0a3acc 35%)}
      .mx-inv button{flex:none;width:52px;height:52px;border-radius:16px;background:#fff2;color:#fff;font-size:27px;box-shadow:inset 0 0 0 2px #fff3}
      .mx-inv button.on{background:#e03ad0;box-shadow:inset 0 0 0 2px #fff,0 0 16px #e03ad0}
      .mx-inv .tip{flex:1;color:#fff;font-size:12.5px;font-weight:600;line-height:1.25;text-shadow:0 1px 2px #000}
      .mx-ch{position:absolute;left:12px;right:12px;bottom:84px;margin:auto;max-width:400px;display:grid;gap:8px}
      .mx-ch button{padding:13px 14px;border-radius:16px;background:#fff;color:#1d1d1f;font-weight:700;text-align:left;box-shadow:0 4px 16px #0005}
      .mx-toast{position:absolute;left:50%;top:64px;transform:translateX(-50%);max-width:86%;padding:8px 14px;border-radius:14px;background:#2a1c44ee;color:#fff;font-weight:600;font-size:14px;text-align:center;pointer-events:none;transition:opacity .3s}
      .mx-chat{display:grid;gap:8px;text-align:left;margin:10px 0}
      .mx-chat div{padding:8px 11px;border-radius:14px;background:#f1e6f0;font-size:14px;line-height:1.3}.mx-chat div b{display:block;font-size:12px;color:#b8209f}
      .mx-chat div.me{background:#2a1c44;color:#fff;justify-self:end}.mx-chat div.me b{color:#ff9cf0}
    </style>
    <div data-ov style="position:absolute;inset:0;pointer-events:none"></div>
    <div class="mx-top" data-top></div>
    <button class="mx-b" data-a="hint" style="right:154px" aria-label="Подсказка">🔍</button>
    <button class="mx-b" data-a="phone" style="right:106px" aria-label="Телефон">📱</button>
    <button class="mx-b" data-a="snd" style="right:58px" aria-label="Звук"></button>
    <button class="mx-b" data-a="x" style="right:10px" aria-label="Закрыть">✕</button>
    <div class="mx-inv" data-inv></div>
    <div class="mx-ch" data-ch></div>
    <div class="mx-toast" data-toast style="opacity:0"></div>
    <div data-panel class="mx-p"></div>`;
  root.prepend(gl); gl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const ov = $('[data-ov]'), topEl = $('[data-top]'), invEl = $('[data-inv]'), chEl = $('[data-ch]'), toastEl = $('[data-toast]'), panel = $('[data-panel]'), sndB = $('[data-a=snd]');
  const was = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const sndIcon = () => { sndB.textContent = muted ? '🔇' : '🔊'; };
  sndIcon();
  for (const ev of ['pointerdown', 'touchend']) root.addEventListener(ev, () => A());

  const DPR = [2, 1.5, 1.25, 1];
  let W, H, q = 0, fr = 0, ft = 0;
  const cam = new T.PerspectiveCamera(36, 1, .1, 200);
  const fit = () => { const r = devicePixelRatio || 1; W = root.clientWidth; H = root.clientHeight; R.setPixelRatio(Math.min(r, DPR[q])); R.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  fit();

  // ——— 3D-кухня (как в «Карыче»): toon-свет ступеньками, детали из скруглённых примитивов с цветами вершин, контур ———
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  const V = (x, y, z) => new T.Vector3(x, y, z), C = new T.Color();
  const BX = (w, h, d) => new T.BoxGeometry(w, h, d), RB = (w, h, d, r = .03) => new L.RB(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  const CY = (a, b, h, s = 14, ...x) => new T.CylinderGeometry(a, b, h, s, 1, ...x), SP = (r, w = 14, h = 10, ...a) => new T.SphereGeometry(r, w, h, ...a);
  const TO = (r, t, a = 8, b = 16) => new T.TorusGeometry(r, t, a, b);
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
  const grad = new T.DataTexture(new Uint8Array([110, 170, 225, 255]), 4, 1, T.RedFormat);
  grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true;
  const toon = o => new T.MeshToonMaterial({gradientMap: grad, ...o});
  const VC = toon({vertexColors: true});
  const lineMat = new T.MeshBasicMaterial({color: '#2a1630', side: T.BackSide});
  lineMat.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec3 onorm;\n' + s.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = onorm;')
      .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);\n\n#ifdef USE_SKINNING\nvec3 oN = objectNormal;\n#else\nvec3 oN = onorm;\n#endif\nmvPosition.xyz += normalize(normalMatrix * oN) * clamp(-mvPosition.z * .0022, .006, .03);\ngl_Position = projectionMatrix * mvPosition;');
  };
  lineMat.customProgramCacheKey = () => 'maks-outline';
  function smoothN(g) {
    if (g.attributes.onorm) return;
    const p = g.attributes.position, n = g.attributes.normal, m = new Map(), o = new Float32Array(p.count * 3);
    const key = i => `${Math.round(p.getX(i) * 500)},${Math.round(p.getY(i) * 500)},${Math.round(p.getZ(i) * 500)}`;
    for (let i = 0; i < p.count; i++) { const k = key(i); let a = m.get(k); if (!a) m.set(k, a = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
    for (let i = 0; i < p.count; i++) { const a = m.get(key(i)), l = Math.hypot(...a) || 1; o[i * 3] = a[0] / l; o[i * 3 + 1] = a[1] / l; o[i * 3 + 2] = a[2] / l; }
    g.setAttribute('onorm', new T.BufferAttribute(o, 3));
  }
  // сетка из деталей; line — с контуром (для того, что можно трогать, и мебели)
  const M = (parts, {mat = VC, line = true, cast = true, recv = true} = {}) => {
    const m = new T.Mesh(merge(parts), mat); m.castShadow = cast; m.receiveShadow = recv;
    if (line) { smoothN(m.geometry); m.add(new T.Mesh(m.geometry, lineMat)); }
    return m;
  };
  const G = (...o) => { const g = new T.Group(); g.add(...o); return g; };
  const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };
  const cnv = (w, h, f) => { const c = Object.assign(document.createElement('canvas'), {width: w, height: h}); f(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const plane = (w, h, map, o = {}) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), toon({map, ...o})); m.receiveShadow = true; return m; };
  const blobTex = cnv(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#000000ff'); r.addColorStop(.5, '#00000099'); r.addColorStop(1, '#00000000'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const blobGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat = new T.MeshBasicMaterial({map: blobTex, color: '#2a1030', transparent: true, opacity: .3, depthWrite: false});
  const blob = (w, d = w) => { const b = new T.Mesh(blobGeo, blobMat); b.scale.set(w, 1, d); b.position.y = .012; b.renderOrder = -1; return b; };
  // текст мелом/маркером на текстуре: строки [текст, размер, цвет]
  const font = (s, b = 700) => `${b} ${s}px "Segoe Print","Comic Sans MS","Marker Felt",system-ui,sans-serif`;
  function wrapText(g, lines, x, y, maxW) {
    for (const [t, s, c, b, al] of lines) {
      g.font = font(s, b); g.fillStyle = c; g.textAlign = al || 'left';
      let line = '', yy = y;
      for (const w of t.split(' ')) { const tt = line ? line + ' ' + w : w; if (g.measureText(tt).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += s * 1.18; } else line = tt; }
      g.fillText(line, x, yy); y = yy + s * 1.35;
    }
  }

  // ——— персонажи: модели Quaternius (общий скелет, клипы из kar.glb) ———
  const TWB = ['UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'UpperArmL', 'UpperArmR', 'LowerArmR', 'Torso', 'Head'];
  const SC = .38, X1 = V(1, 0, 0), Y1 = V(0, 1, 0), Z1 = V(0, 0, 1);
  function person(id, col, hide = []) {
    const o = L.SU.clone(L.models[id].scene), skins = [], mats = {};
    o.scale.setScalar(SC);
    o.traverse(m => { if (m.isSkinnedMesh) skins.push(m); });
    for (const m of skins) {
      const n = m.material.name;
      if (hide.includes(n)) { m.visible = false; continue; }
      const c = col[n] ? new T.Color(col[n]) : m.material.color.clone();
      m.material = mats[n] = toon({color: c, map: n === 'Face' ? m.material.map : null}); m.castShadow = true; m.frustumCulled = false;
      if (n !== 'Face') { smoothN(m.geometry); const l = m.clone(); l.material = lineMat; l.castShadow = false; m.parent.add(l); }
    }
    const mix = new T.AnimationMixer(o), act = {};
    for (const c of L.clips) act[c.name] = mix.clipAction(c);
    const root = G(o), sh = blob(.7, .55); root.add(sh);
    const c = {root, o, mix, act, cur: null, mats, pose: null, t: Math.random() * 9, bone: n => o.getObjectByName(n.replace('.', ''))};
    c.rest = TWB.map(n => [o.getObjectByName(n), o.getObjectByName(n).quaternion.clone()]); // позы крутят эти кости — каждый кадр с чистого листа
    play(c, 'Idle', {fade: 0}); c.act.Idle.time = Math.random() * 2;
    return c;
  }
  const wear = (c, bone, parts, mat = VC, line = true) => { const m = M(parts, {mat, line}); c.bone(bone).add(m); return m; };
  function play(c, name, {fade = .2, once = false, speed = 1} = {}) {
    const a = c.act[name]; a.timeScale = speed;
    if (c.cur === a) return a;
    a.reset(); a.setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = once; a.play();
    if (c.cur) a.crossFadeFrom(c.cur, fade, false);
    c.cur = a; return a;
  }
  const qa = new T.Quaternion(), qb = new T.Quaternion(), ax = new T.Vector3();
  function twist(c, bone, axis, ang) {
    const b = c.bone(bone); b.parent.getWorldQuaternion(qa); c.o.getWorldQuaternion(qb);
    ax.copy(axis).applyQuaternion(qb).applyQuaternion(qa.invert()).normalize();
    b.quaternion.premultiply(qb.setFromAxisAngle(ax, ang));
  }
  // позы поверх анимации Idle: сидя за партой, спит на парте, пишет на доске, смотрит в микроскоп
  const POSES = {
    sit: (c, k) => { c.o.position.y = -.2 * k; for (const s of ['L', 'R']) { twist(c, 'UpperLeg' + s, X1, -1.45 * k); twist(c, 'LowerLeg' + s, X1, 1.45 * k); } },
    desk: (c, k, t) => { POSES.sit(c, k); for (const s of ['L', 'R']) twist(c, 'UpperArm' + s, X1, -.9 * k); twist(c, 'Head', X1, (.15 + Math.sin(t * 2) * .05) * k); },
    nap: (c, k, t) => { POSES.sit(c, k); twist(c, 'Torso', X1, .55 * k); twist(c, 'Head', X1, (.5 + Math.sin(t * 1.3) * .03) * k); for (const s of ['L', 'R']) twist(c, 'UpperArm' + s, X1, -1.3 * k); },
    write: (c, k, t) => { twist(c, 'UpperArmR', X1, (-2.2 + Math.sin(t * 7) * .15) * k); twist(c, 'UpperArmR', Z1, Math.sin(t * 3.1) * .25 * k); },
    scope: (c, k) => { twist(c, 'Torso', X1, .45 * k); twist(c, 'Head', X1, .35 * k); for (const s of ['L', 'R']) twist(c, 'UpperArm' + s, X1, -.7 * k); },
    hold: (c, k) => { twist(c, 'UpperArmR', X1, -1.3 * k); twist(c, 'LowerArmR', X1, -.4 * k); },
    reach: (c, k) => { twist(c, 'UpperArmR', X1, -2.4 * k); twist(c, 'UpperArmL', X1, -.4 * k); },
    bend: (c, k) => { twist(c, 'Torso', X1, .5 * k); twist(c, 'UpperArmR', X1, -1.2 * k); },
  };
  const face = (c, x, z) => { c.yaw = Math.atan2(x - c.root.position.x, z - c.root.position.z); };
  const angTo = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

  const SKIN = '#f2c59a';
  // Максим: длинные тёмные волнистые волосы, серьга, щетина, серая футболка «ВСЁ ЛОЖНО», тёмные джинсы
  const mx = person('kar', {Skin: SKIN, Shirt: '#a9a8ae', Pants: '#2c3248', Belt: '#1d1d24', Hair: '#3b2418'});
  {
    const H = '#3b2418', H2 = '#4a2e1f';
    const hair = [];
    // каре до подбородка: шапка волос, пряди по бокам и сзади, чёлка на сторону
    hair.push(P(SP(.66, 18, 12, 0, Math.PI * 2, 0, Math.PI * .58), H, [0, .78, -.03], [0, 0, 0], [1.04, 1.02, 1.04]));
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * .5 + (i / 8) * Math.PI * 1.0 + Math.PI * .5; // от левого уха через затылок к правому
      const x = Math.sin(a) * .64, z = Math.cos(a) * .6 - .03, y = .5 + (i % 2) * .05;
      hair.push(P(SP(.2, 10, 8), i % 2 ? H : H2, [x, y, z], [0, 0, (i % 3 - 1) * .3], [1, 1.9, .95]));
      hair.push(P(SP(.15, 10, 8), i % 2 ? H2 : H, [x * 1.04, y - .26, z * 1.03], [0, 0, (i % 2 ? .4 : -.4)], [1, 1.3, .9]));
    }
    hair.push(P(SP(.32, 12, 8), H, [.22, 1.12, .34], [-.5, 0, -.5], [1.4, .55, .9]), P(SP(.26, 12, 8), H2, [-.25, 1.06, .38], [-.6, 0, .4], [1.2, .5, .8]));
    hair.push(P(SP(.2, 10, 8), H, [.5, .75, .38], [0, 0, .3], [.7, 1.4, .7]), P(SP(.18, 10, 8), H, [-.52, .72, .36], [0, 0, -.3], [.7, 1.4, .7]));
    wear(mx, 'Head', hair);
    wear(mx, 'Head', [P(TO(.06, .016, 6, 14), '#d9dbe2', [.66, .36, .02], [0, Math.PI / 2, 0])], VC, false); // серьга в левом ухе
    // щетина: полупрозрачная тень вокруг рта и подбородка
    const stub = new T.Mesh(SP(.5, 16, 8, -Math.PI * .35, Math.PI * .7, Math.PI * .58, Math.PI * .3), new T.MeshBasicMaterial({color: '#3b2a24', transparent: true, opacity: .22, depthWrite: false}));
    stub.position.set(0, .62, .08); stub.scale.set(1.12, 1.05, 1.18); mx.bone('Head').add(stub);
    // надпись на футболке
    const tee = cnv(256, 96, (g, w, h) => { g.font = '900 46px "Arial Narrow",Arial,sans-serif'; g.fillStyle = '#1c2140'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ВСЁ  ЛОЖНО', w / 2, h / 2); });
    const lab = new T.Mesh(new T.PlaneGeometry(.62, .23), new T.MeshBasicMaterial({map: tee, transparent: true, depthWrite: false}));
    lab.position.set(0, .12, .345); mx.bone('Torso').add(lab);
    mx.name = 'Максим'; mx.voice = 150;
  }
  // преподы и одногруппники
  const glasses = (c, y = .64, z = .6, col = '#2a2a30') => wear(c, 'Head', [P(TO(.13, .022, 6, 16), col, [-.2, y, z]), P(TO(.13, .022, 6, 16), col, [.2, y, z]), P(BX(.14, .03, .03), col, [0, y + .02, z])], VC, false);
  function mkSanpinova() { // гигиена: доцент в белом халате и колпаке
    const c = person('baba', {Main: '#f4f3ee', Hair: '#8b8b92', Black: '#3d6b8c', Brown: '#4a3426', Skin: SKIN});
    wear(c, 'Head', [P(CY(.5, .55, .42, 18), '#ffffff', [0, 1.18, -.05]), P(CY(.56, .56, .07, 18), '#e8e8e2', [0, .98, -.05])]);
    glasses(c, .62, .58, '#7a2a50');
    c.name = 'Т. П. Санпинова'; c.voice = 330; return c;
  }
  function mkAllelev() { // медгенетика: профессор с бородой (Wizard без шляпы), халат
    const c = person('king', {Clothes: '#f2f2ec', Belt: '#d8d8d0', Gold: '#5a8ac8', Hair: '#c9c9c9', Skin: SKIN}, ['Hat']);
    glasses(c, .66, .6, '#1d1d24');
    c.name = 'Проф. Аллелев'; c.voice = 110; return c;
  }
  function student(kind, col, extra) {
    const c = kind === 'kar' ? person('kar', {Skin: SKIN, ...col}) : person('dimon', {Skin: SKIN, ...col});
    extra?.(c); return c;
  }
  const S1 = () => student('dimon', {Shirt: '#d65a4a', Pants: '#3a3a48'}, c => { c.name = 'Одногруппник'; c.voice = 120; });
  const S2 = () => student('kar', {Shirt: '#4a9a7a', Pants: '#2b2f45', Hair: '#c9a060'}, c => { glasses(c); c.name = 'Староста'; c.voice = 170; });
  const S3 = () => student('kar', {Shirt: '#e8b04a', Pants: '#45384a', Hair: '#1a1210'}, c => { c.name = 'Одногруппник'; c.voice = 140; });

  // ——— текстуры и мебель ———
  const linoTex = cnv(256, 256, (g, w) => { g.fillStyle = '#b98b5e'; g.fillRect(0, 0, w, w); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#b3845a' : '#bf9366'; g.fillRect(i * 64, j * 64, 64, 64); } for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,50,30,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * w, 2 + Math.random() * 6, 1); } });
  linoTex.wrapS = linoTex.wrapT = T.RepeatWrapping; linoTex.repeat.set(3, 3);
  const tileTex = cnv(256, 256, (g, w) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#e8eef2' : '#9fc0d4'; g.fillRect(i * 64, j * 64, 64, 64); } g.strokeStyle = '#7d93a3'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, w); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } });
  tileTex.wrapS = tileTex.wrapT = T.RepeatWrapping; tileTex.repeat.set(4, 4);
  const wallTileTex = cnv(128, 128, (g, w) => { g.fillStyle = '#d7ecf2'; g.fillRect(0, 0, w, w); g.strokeStyle = '#a9c7d1'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, w); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } });
  wallTileTex.wrapS = wallTileTex.wrapT = T.RepeatWrapping;
  // стена: низ крашеный (классика), верх побелка, плинтус; толщина видна сверху — диорама
  function wall(len, h, lowC, upC, low = .95, tex) {
    const g = new T.Group();
    if (tex) { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(len / .55, low / .55); const m = plane(len, low, t); m.position.y = low / 2; g.add(m); }
    else g.add(M([P(BX(len, low, .02), lowC, [0, low / 2, 0])], {line: false, cast: false}));
    g.add(M([P(BX(len, h - low, .02), upC, [0, low + (h - low) / 2, 0]), P(BX(len, .04, .04), '#ffffff', [0, low, .02])], {line: false, cast: false}));
    g.add(M([P(BX(len, .08, .04), '#6b4a36', [0, .04, .02])], {line: false, cast: false}));
    g.add(M([P(BX(len + .2, .1, .2), '#4a2a54', [0, h + .05, -.09])], {line: false, cast: false}));
    return g;
  }
  // коробка комнаты: пол-плита, задняя стена (z = z0), левая (x = x0), правая (x = x1); передней нет — смотрим внутрь
  function room(x0, x1, z0, z1, {floor = linoTex, h = 2.3, lowC = '#9cc9b5', upC = '#f1ece0', wallTex} = {}) {
    const g = new T.Group(), w = x1 - x0, d = z1 - z0;
    const f = plane(w, d, floor.clone()); f.material.map.needsUpdate = true; f.material.map.repeat.set(w / 1.6, d / 1.6); f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.add(f);
    g.add(M([P(BX(w + .2, .35, d + .1), '#3d1a48', [(x0 + x1) / 2, -.18, (z0 + z1) / 2 - .05])], {line: false, cast: false}));
    const back = wall(w, h, lowC, upC, .95, wallTex); back.position.set((x0 + x1) / 2, 0, z0); g.add(back);
    const left = wall(d, h, lowC, upC, .95, wallTex); left.rotation.y = Math.PI / 2; left.position.set(x0, 0, (z0 + z1) / 2); g.add(left);
    const right = wall(d, h, lowC, upC, .95, wallTex); right.rotation.y = -Math.PI / 2; right.position.set(x1, 0, (z0 + z1) / 2); g.add(right);
    return g;
  }
  const desk = (w = 1.5, d = .55, col = '#d9b483') => M([P(RB(w, .05, d, .02), col, [0, .52, 0]), P(RB(w - .06, .3, .03, .01), '#a5835c', [0, .34, -d / 2 + .04]),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => P(CY(.025, .025, .5, 6), '#5a5a62', [a * (w / 2 - .06), .25, b * (d / 2 - .06)]))]);
  const chair = (col = '#3e6fa8') => M([P(RB(.36, .04, .34, .015), col, [0, .3, 0]), P(RB(.36, .3, .04, .015), col, [0, .5, .17]),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => P(CY(.018, .018, .3, 6), '#4a4a52', [a * .15, .15, b * .14]))]);
  function board(w, h, lines) {
    const t = cnv(512, Math.round(512 * h / w), (g, cw, ch) => { g.fillStyle = '#2f5a45'; g.fillRect(0, 0, cw, ch); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .04})`; g.fillRect(Math.random() * cw, Math.random() * ch, 20, 4); } wrapText(g, lines, 22, 50, cw - 40); });
    const m = new T.Mesh(new T.PlaneGeometry(w, h), toon({map: t}));
    return G(M([P(RB(w + .1, h + .1, .05, .02), '#7a5236', [0, 0, -.02]), P(RB(w, .04, .08, .01), '#7a5236', [0, -h / 2 - .03, .04])]), at(m, 0, 0, .012));
  }
  function poster(w, h, bg, lines, title) {
    const t = cnv(256, Math.round(256 * h / w), (g, cw, ch) => { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); if (title) { g.fillStyle = '#c0283a'; g.fillRect(0, 0, cw, 44); g.font = '900 24px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(title, cw / 2, 31); } g.font = '600 18px system-ui'; wrapText(g, lines, 14, title ? 76 : 34, cw - 26); });
    return G(M([P(BX(w + .04, h + .04, .015), '#ffffff', [0, 0, -.004])], {line: false, cast: false}), at(new T.Mesh(new T.PlaneGeometry(w, h), toon({map: t})), 0, 0, .006));
  }
  const door = (sign) => {
    const g = G(M([P(RB(.9, 1.75, .06, .02), '#c9a272', [0, .875, 0]), P(RB(1.02, 1.85, .03, .01), '#7a5236', [0, .9, -.02]), P(SP(.045), '#d9c06a', [.33, .85, .06]), P(RB(.12, .03, .05, .01), '#d9c06a', [.29, .85, .07])]));
    if (sign) { const t = cnv(128, 64, (c, w, h) => { c.fillStyle = '#1f3a7a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sign, w / 2, h / 2 + 2); }); g.add(at(new T.Mesh(new T.PlaneGeometry(.36, .18), toon({map: t})), 0, 1.48, .035)); }
    return g;
  };
  function windowPane(len, y0, y1) { // окно в стене (вдоль локальной x), стекло светится
    const h = y1 - y0, glass = new T.Mesh(new T.PlaneGeometry(len - .1, h - .1), new T.MeshBasicMaterial({color: '#bfe3ff'}));
    const g = G(M([P(RB(len, .06, .06, .02), '#f2f2f2', [0, y0, 0]), P(RB(len, .06, .06, .02), '#f2f2f2', [0, y1, 0]), P(RB(.06, h, .06, .02), '#f2f2f2', [-len / 2, (y0 + y1) / 2, 0]), P(RB(.06, h, .06, .02), '#f2f2f2', [len / 2, (y0 + y1) / 2, 0]), P(RB(.05, h, .05, .02), '#f2f2f2', [0, (y0 + y1) / 2, 0]),
      P(RB(len + .14, .05, .22, .02), '#f2f2f2', [0, y0 - .02, .08])]), at(glass, 0, (y0 + y1) / 2, -.005));
    g.add(M([P(RB(len * .8, .4, .08, .03), '#e8e8e8', [0, y0 - .35, .1]), ...Array.from({length: 8}, (_, i) => P(BX(.02, .34, .1), '#c8c8c8', [-len * .37 + i * len * .105, y0 - .35, .14]))], {line: false})); // батарея
    return g;
  }

  // ——— навигация: сетка 0,15 м, A*, сглаживание по прямой видимости ———
  function navGrid(b, obs, R = .2) {
    const s = .15, nx = Math.ceil((b[2] - b[0]) / s), nz = Math.ceil((b[3] - b[1]) / s), free = new Uint8Array(nx * nz);
    const X = i => b[0] + (i + .5) * s, Z = j => b[1] + (j + .5) * s;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) free[i + j * nx] = obs.some(o => X(i) > o[0] - R && X(i) < o[2] + R && Z(j) > o[1] - R && Z(j) < o[3] + R) ? 0 : 1;
    const cell = (x, z) => [Math.max(0, Math.min(nx - 1, Math.floor((x - b[0]) / s))), Math.max(0, Math.min(nz - 1, Math.floor((z - b[1]) / s)))];
    const ok = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && free[i + j * nx];
    const near = ([i, j]) => { if (ok(i, j)) return [i, j]; for (let r = 1; r < 30; r++) { let best = null, bd = 1e9; for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) if (Math.max(Math.abs(a), Math.abs(c)) === r && ok(i + a, j + c)) { const d = a * a + c * c; if (d < bd) { bd = d; best = [i + a, j + c]; } } if (best) return best; } return [i, j]; };
    const los = (a, c) => { const d = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.ceil(d / (s * .4)); for (let k = 1; k < n; k++) { const [i, j] = cell(a[0] + (c[0] - a[0]) * k / n, a[1] + (c[1] - a[1]) * k / n); if (!ok(i, j)) return false; } return true; };
    function find(from, to) {
      const s0 = near(cell(...from)), g0 = near(cell(...to)), K = (i, j) => i + j * nx, goal = K(...g0);
      const gs = new Float32Array(nx * nz).fill(1e9), prev = new Int32Array(nx * nz).fill(-1), open = [[0, K(...s0)]];
      gs[K(...s0)] = 0;
      while (open.length) {
        let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
        const [, cur] = open.splice(bi, 1)[0]; if (cur === goal) break;
        const ci = cur % nx, cj = (cur - ci) / nx;
        for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
          if (!a && !c) continue; const i = ci + a, j = cj + c; if (!ok(i, j) || (a && c && (!ok(ci + a, cj) || !ok(ci, cj + c)))) continue;
          const ng = gs[cur] + (a && c ? 1.414 : 1), k = K(i, j);
          if (ng < gs[k]) { gs[k] = ng; prev[k] = cur; const h = Math.hypot(i - g0[0], j - g0[1]); open.push([ng + h, k]); }
        }
      }
      if (prev[goal] < 0 && goal !== K(...s0)) return [to];
      const pts = []; for (let k = goal; k >= 0; k = prev[k]) { const i = k % nx; pts.unshift([X(i), Z((k - i) / nx)]); if (k === K(...s0)) break; }
      pts[pts.length - 1] = ok(...cell(...to)) ? to : pts[pts.length - 1];
      const out = [from]; let i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(out[out.length - 1], pts[j])) j--; out.push(pts[j]); i = j; }
      if (out.length === 1) out.push(pts[pts.length - 1]);
      return out.slice(1);
    }
    return {find};
  }

  // ——— состояние игры: сохраняется в localStorage ———
  const LESSON_ITEMS = {gig: ['soap'], gen: ['jacket', 'tee', 'bust', 'head']};
  const ITEMS = {
    mop: {e: '🧹', n: 'Швабра', d: 'Швабра уборщицы. Кудрявая, как я.'},
    soap: {e: '🧼', n: 'Мыло', d: 'Мыло с кафедры гигиены. Улика.'},
    jacket: {e: '🧥', n: 'Куртка', d: 'Моя куртка. Сейчас у неё начнётся новая жизнь.'},
    tee: {e: '👕', n: 'Футболка «ВСЁ ЛОЖНО»', d: 'Запасная. У меня их семь — по одной на каждый день недели.'},
    bust: {e: '🗿', n: 'Бюст Менделя', d: 'Грегор Мендель, гипс. Смотрит с осуждением.'},
    head: {e: '👨‍🦱', n: 'Голова Максоника', d: 'Мендель в швабре. Вылитый я, если не присматриваться.'},
  };
  const COMBOS = [[['mop', 'bust'], 'head', 'Мендель + швабра = вылитый я. Генетика работает.']];
  let S;
  const fresh = () => ({v: 1, inv: [], f: {}, done: {}, cur: '', seen: {}});
  try { S = JSON.parse(load('maksSave')) || fresh(); if (S.v !== 1) S = fresh(); } catch { S = fresh(); }
  const store = () => save('maksSave', JSON.stringify(S));
  const has = i => S.inv.includes(i);
  const give = i => { if (!has(i)) S.inv.push(i); store(); drawInv(); sfx.pick(); buzz(15); };
  const take = i => { S.inv = S.inv.filter(x => x !== i); if (sel === i) sel = null; store(); drawInv(); };
  const att = () => 100 - 10 * Object.values(S.done).filter(v => v === 'dirty').length;

  // ——— сцены ———
  const scenes = {};
  let cur = null, sc = null; // id и объект текущей сцены
  const npcs = []; // все персонажи текущей сцены (кроме Максима)

  // общий класс: стены, доска, окно с жалюзи и форточкой, раковина, дверь, парты 2×2
  function classroom(id, {boardLines, lowC, posterSpot}) {
    const g = new T.Group();
    const x0 = -2.7, x1 = 2.7, z0 = -3.1, z1 = 2.9;
    g.add(room(x0, x1, z0, z1, {lowC}));
    g.add(at(board(2.5, 1, boardLines), 0, 1.25, z0 + .03));
    // окно на левой стене: жалюзи (опускаются) и форточка сверху
    const win = windowPane(2.4, .75, 2.05); win.rotation.y = Math.PI / 2; win.position.set(x0 + .02, 0, -.8); g.add(win);
    const slats = new T.Group(); for (let i = 0; i < 12; i++) slats.add(at(M([P(BX(.012, .09, 2.3), '#f0e6c8', [0, 0, 0], [0, 0, .5])], {line: false, cast: false}), 0, 1.6 - i * .065, 0));
    const blinds = G(M([P(RB(.08, .08, 2.4, .02), '#e2d6b4', [0, 0, 0])], {line: false}), slats); blinds.position.set(x0 + .09, 1.98, -.8); g.add(blinds);
    const fort = G(M([P(RB(.04, .45, .7, .015), '#f2f2f2', [0, -.23, 0]), P(BX(.01, .38, .62), '#bfe3ff', [0, -.23, 0])], {line: true}));
    fort.position.set(x0 + .05, 2.02, -1.6); g.add(fort);
    // раковина с мылом на правой стене
    const sink = G(M([P(RB(.5, .12, .38, .05), '#f4f6f8', [0, .72, 0]), P(CY(.04, .05, .5, 8), '#f4f6f8', [0, .42, -.08]), P(CY(.018, .018, .2, 8), '#c8ccd2', [0, .9, -.12]), P(CY(.016, .016, .14, 8), '#c8ccd2', [0, .98, -.06], [Math.PI / 2, 0, 0]),
      P(RB(.4, .5, .02, .01), '#bcd8e6', [0, 1.2, -.17])]));
    sink.rotation.y = -Math.PI / 2; sink.position.set(x1 - .2, 0, -1.55); g.add(sink);
    const soap = M([P(RB(.12, .045, .07, .02), '#ff9ac8', [0, 0, 0])]); soap.position.set(x1 - .2, .8, -1.38); g.add(soap);
    const dr = door('214'); dr.rotation.y = -Math.PI / 2; dr.position.set(x1 - .03, 0, 2.05); g.add(dr);
    // парты: колонки x = ±1.35, ряды z = −0.85 и 0.75; стулья позади (лицом к доске)
    const deskPos = [[-1.35, -.85], [1.35, -.85], [-1.35, .75], [1.35, .75]];
    for (const [x, z] of deskPos) { g.add(at(desk(), x, 0, z)); for (const dx of [-.38, .38]) g.add(at(chair(hsh(x + z + dx) > .5 ? '#3e6fa8' : '#c0504a'), x + dx, 0, z + .5)); }
    const obs = [...deskPos.map(([x, z]) => [x - .75, z - .28, x + .75, z + .28])];
    return {g, x0, x1, z0, z1, win, blinds, slats, fort, soap, sink, door: dr, obs, seat: [-.97, 1.2]};
  }
  // свет сцены: небо + солнце из окна; dim — притушить (жалюзи)
  function lights(g, {sunDir = [-1, 1.4, .3], sunC = '#fff1d6', hemi = 1.5, sun = 2.1} = {}) {
    const h = new T.HemisphereLight('#fff6ee', '#8a6a7a', hemi), s = new T.DirectionalLight(sunC, sun);
    s.position.set(...sunDir).multiplyScalar(8); s.target.position.set(0, 0, 0); s.castShadow = true;
    s.shadow.mapSize.set(1024, 1024); const sc = s.shadow.camera; sc.left = sc.bottom = -5; sc.right = sc.top = 5; sc.near = 1; sc.far = 25; s.shadow.bias = -.0015; s.shadow.normalBias = .02;
    g.add(h, s, s.target);
    return {h, s, base: [hemi, sun]};
  }

  // ===== ХАБ: туалет третьего этажа =====
  scenes.hub = () => {
    const g = new T.Group(), x0 = -2.1, x1 = 2.1, z0 = -2.4, z1 = 2.3;
    g.add(room(x0, x1, z0, z1, {floor: tileTex, wallTex: wallTileTex, upC: '#eef1ea', h: 2.3}));
    const L_ = lights(g, {sunDir: [.6, 1.6, .8], sunC: '#f4fbff', hemi: 1.7, sun: 1.6});
    // кабинки у задней стены
    const st = [];
    for (let i = 0; i < 3; i++) {
      const x = -1.75 + i * .95;
      st.push(P(RB(.05, 1.6, 1.15, .015), '#5d86a8', [x - .47, .9, z0 + .58]));
      if (i !== 1) st.push(P(RB(.86, 1.45, .04, .015), '#6e98bb', [x, .88, z0 + 1.15]));
    }
    st.push(P(RB(.05, 1.6, 1.15, .015), '#5d86a8', [-1.75 + 2 * .95 + .47, .9, z0 + .58]));
    g.add(M(st));
    const opened = G(M([P(RB(.86, 1.45, .04, .015), '#6e98bb', [.43, .88, 0])])); opened.position.set(-.8 - .43, 0, z0 + 1.15); opened.rotation.y = -1.1; g.add(opened);
    g.add(at(M([P(CY(.17, .13, .32, 14), '#ffffff', [0, .16, 0]), P(TO(.17, .035, 6, 16), '#ffffff', [0, .34, 0], [Math.PI / 2, 0, 0]), P(RB(.3, .32, .12, .03), '#ffffff', [0, .5, -.2]), P(CY(.06, .06, .1, 10), '#ffffff', [-.32, 1.1, -.28], [0, 0, Math.PI / 2])]), -.8, 0, z0 + .45));
    g.add(at(M([P(CY(.06, .06, .1, 12), '#f4f4f4', [0, 0, 0], [Math.PI / 2, 0, 0])]), -.48, .8, z0 + .3)); // рулон
    // раковины и зеркала на левой стене
    for (const z of [-.6, .5]) {
      const s = G(M([P(RB(.5, .12, .38, .05), '#f4f6f8', [0, .72, 0]), P(CY(.04, .05, .5, 8), '#f4f6f8', [0, .42, -.08]), P(CY(.018, .018, .2, 8), '#c8ccd2', [0, .9, -.12]), P(CY(.016, .016, .14, 8), '#c8ccd2', [0, .98, -.06], [Math.PI / 2, 0, 0])]));
      s.rotation.y = Math.PI / 2; s.position.set(x0 + .2, 0, z); g.add(s);
      const mir = new T.Mesh(new T.PlaneGeometry(.5, .62), new T.MeshBasicMaterial({map: cnv(64, 80, (c, w, h) => { const r = c.createLinearGradient(0, 0, w, h); r.addColorStop(0, '#e9f6ff'); r.addColorStop(.45, '#9fc2d8'); r.addColorStop(.55, '#d6ecf8'); r.addColorStop(1, '#88a9bf'); c.fillStyle = r; c.fillRect(0, 0, w, h); })}));
      g.add(at(G(M([P(RB(.56, .68, .03, .02), '#c8ccd2', [0, 0, -.02])], {line: false}), mir), x0 + .02, 1.3, z, Math.PI / 2));
    }
    // окно на задней стене справа
    const w = windowPane(.9, 1, 1.9); w.position.set(1.4, 0, z0 + .02); g.add(w);
    // дверь в коридор, швабра в ведре, урна
    const dr = door('WC'); dr.rotation.y = -Math.PI / 2; dr.position.set(x1 - .03, 0, 1.3); g.add(dr);
    g.add(at(M([P(CY(.2, .16, .32, 14), '#3d7ad6', [0, .16, 0]), P(TO(.19, .015, 6, 16), '#2a5aa8', [0, .32, 0], [Math.PI / 2, 0, 0])]), 1.7, 0, -1.85));
    const mop = G(M([P(CY(.02, .02, 1.4, 6), '#c9a272', [0, .75, 0]), ...Array.from({length: 9}, (_, i) => P(SP(.08, 8, 6), i % 2 ? '#9a9a90' : '#b4b2a6', [Math.sin(i) * .08, .2 + (i % 3) * .05, Math.cos(i * 1.7) * .08]))]));
    mop.position.set(1.7, 0, -1.85); mop.rotation.z = -.18; g.add(mop);
    g.add(at(M([P(CY(.14, .12, .4, 12), '#5a5a62', [0, .2, 0])]), 1.75, 0, .4));
    const sign = poster(.5, .32, '#fff8e0', [['Не курить!', 22, '#c0283a', 900, 'center'], ['Штраф 500 ₽', 16, '#333', 600, 'center']]); sign.rotation.y = -Math.PI / 2; sign.position.set(x1 - .02, 1.5, -.6); g.add(sign);
    const nav = navGrid([x0 + .1, z0 + 1.25, x1 - .1, z1 - .1], [[1.4, -2.1, 2.1, -1.55], [1.55, .2, 1.95, .6]]);
    return {
      g, nav, lights: L_, enter: [1.6, 1.3], start: [.6, .9],
      cam: {look: [0, .5, .1], el: 1.1, w: 4.4, h: 6.2, pan: .3, dz: -.45},
      sync() { mop.visible = !has('mop'); },
      spots: [
        {id: 'mirror', name: 'Зеркало', box: [x0 + .1, 1.3, -.05, .2, .8, 1.9], at: [-1.55, -.05], face: [x0, -.05], act: () => sayMe(pick(['Всё ложно. Кроме моей причёски.', 'Красавчик. Жаль, деканат не оценит.', 'Если долго смотреть в зеркало, пара закончится сама. Проверял — не работает.', 'Лицо человека, у которого всё под контролем. Почти.']))},
        {id: 'sink', name: 'Раковина', box: [x0 + .25, .8, -.05, .45, .3, 1.9], at: [-1.45, .5], face: [x0, .5], act: async () => { pose(mx, 'bend', .8); await sayMe('Мою руки. Гигиена — это святое. Особенно перед тем, как её прогулять.'); }},
        {id: 'mop', name: 'Швабра', box: [1.7, .6, -1.85, .5, 1.3, .5], at: [1.2, -1.45], face: [1.7, -1.85], act: async () => { if (has('mop')) return sayMe('Пустое ведро. Уборщица будет в ярости. Всё ложно, это не я.'); pose(mx, 'bend', .7); await sleep(350); give('mop'); sc.sync(); await sayMe('Швабра. Кудрявая, как я. Беру — пригодится.'); }},
        {id: 'stall', name: 'Кабинка', box: [-.8, .8, z0 + .6, .9, 1.6, 1.1], at: [-.8, -.75], face: [-.8, z0], act: () => sayMe(pick(['Кабинка №2 — моя вторая аудитория. Посещаемость тут 100%.', 'Здесь меня не найдёт даже деканат.', 'На двери написано «Патан — боль». Подписываюсь.']))},
        {id: 'window', name: 'Окно', box: [1.4, 1.45, z0 + .05, 1, 1, .2], at: [1.25, -1.0], face: [1.4, z0], act: () => sayMe(pick(['Питер. Дождь. Идеальная погода, чтобы никуда не ходить.', 'Отсюда видно кафедру патанатомии. Не смотрю туда.']))},
        {id: 'urn', name: 'Урна', box: [1.75, .25, .4, .35, .5, .35], at: [1.35, .4], face: [1.75, .4], act: () => sayMe('Конспекты по гигиене. Не мои. Мои бы тут не поместились — их нет.')},
        {id: 'door', name: 'Выход: расписание', box: [x1 - .05, .9, 1.3, .15, 1.8, 1], at: [1.65, 1.3], face: [x1, 1.3], act: () => schedule()},
      ],
      people: [],
    };
  };

  // ===== ГИГИЕНА =====
  scenes.gig = () => {
    const cr = classroom('gig', {boardLines: [['Тема: гигиена воздуха', 30, '#ffffff', 700], ['учебных помещений', 30, '#ffffff', 700], ['CO₂ ≤ 1000 ppm', 26, '#ffe98a', 700], ['Освещённость ≥ 300 лк', 26, '#ffe98a', 700], ['Мыть руки!!!', 26, '#ffb3c8', 700]], lowC: '#9cc9b5'});
    const {g} = cr;
    const L_ = lights(g);
    g.add(at(desk(1.2, .6, '#b88a5a'), 1.25, 0, -2.25));
    g.add(at(M([P(RB(.16, .08, .24, .02), '#f2c13a', [0, .58, 0]), P(RB(.1, .1, .02, .01), '#333', [0, .64, .05], [-.6, 0, 0]), P(RB(.14, .16, .1, .02), '#2f6ad0', [.3, .62, 0]), P(CY(.012, .012, .2, 6), '#333', [.3, .78, 0])]), 1.25, 0, -2.25));
    const san = poster(.7, .9, '#fffdf4', [['💡 ≥ 300 лк', 20, '#222', 800], ['🌬 CO₂ ≤ 1000', 20, '#222', 800], ['🧼 мыло у раковины', 18, '#222', 800], ['СанПиН 2.4', 15, '#777', 600]], 'СанПиН'); san.rotation.y = -Math.PI / 2; san.position.set(cr.x1 - .02, 1.4, -.1); g.add(san);
    const hyg = poster(.6, .45, '#e8f6ff', [['Мой руки', 22, '#1f5aa8', 900, 'center'], ['перед едой!', 18, '#1f5aa8', 700, 'center']]); hyg.position.set(1.9, 1.75, cr.z0 + .03); g.add(hyg);
    const tch = mkSanpinova(), dimon = S1(), star = S2(), s3 = S3();
    const people = [
      {c: tch, spot: 'teacher'},
      {c: dimon, at: [-1.73, 1.2], yaw: Math.PI, pose: 'nap'},
      {c: star, at: [.97, -.35], yaw: Math.PI, pose: 'desk'},
      {c: s3, at: [1.73, 1.2], yaw: Math.PI, pose: 'desk'},
    ];
    const T_BOARD = [-.3, -2.75], T_CLASS = [.1, -2.35];
    const nav = navGrid([cr.x0 + .15, cr.z0 + .2, cr.x1 - .15, cr.z1 - .1], [...cr.obs, [.65, -2.55, 1.85, -1.95]]);
    let dim = 0;
    const s = {
      g, nav, lights: L_, enter: [2.3, 2.05], seatAt: cr.seat, teacher: tch, people,
      cam: {look: [0, .45, -.1], el: 1.08, w: 5.6, h: 7.8, pan: .45, dz: -.4},
      cycle: {busy: [4.2, 6.5], watch: [2.6, 4], turn: .85, palRate: 26, busyIcon: '✍️'},
      setTeacher(m) { // busy — пишет на доске спиной к классу, watch — смотрит на класс
        if (m === 'busy') { walkNpc(tch, T_BOARD, () => { tch.yaw = Math.PI; pose(tch, 'write'); }); }
        if (m === 'watch') { pose(tch, null); walkNpc(tch, T_CLASS, () => { tch.yaw = 0; }); }
      },
      tick(dt) {
        const tgt = S.f.blinds ? 1 : 0; dim += (tgt - dim) * Math.min(1, dt * 2);
        L_.h.intensity = L_.base[0] * (1 - dim * .5); L_.s.intensity = L_.base[1] * (1 - dim * .85);
        R.toneMappingExposure = 1.05 - dim * .38; cr.win.children[1].material.color.setRGB(.75 - dim * .45, .89 - dim * .5, 1 - dim * .5);
        cr.slats.children.forEach((sl, i) => { sl.visible = i < 2 + dim * 10; sl.rotation.z = dim * 1.1; });
        cr.fort.rotation.y = S.f.fort ? 0 : -.7;
        if (tch.pose === 'write' && Math.random() < dt * 3) sfx.chalk();
      },
      sync() { cr.soap.visible = !S.f.soap; },
      spots: [
        {id: 'seat', name: 'Моё место', box: [cr.seat[0], .45, cr.seat[1], .45, .8, .45], at: cr.seat, act: () => sitDown()},
        {id: 'blinds', name: 'Жалюзи', box: [cr.x0 + .1, 1.35, -.6, .25, 1.2, 1.9], at: [-2.35, -1.55], face: [cr.x0, -1.2], risky: true,
          act: async () => { if (S.f.blinds) return sayMe('Уже темно. Темнее только на патане.'); pose(mx, 'reach', .9); sfx.blinds(); S.f.blinds = 1; store(); await sayMe('Жалюзи вниз. Темно, как в моём будущем.'); }},
        {id: 'fort', name: 'Форточка', box: [cr.x0 + .1, 1.85, -1.6, .3, .5, .8], at: [-2.35, -1.6], face: [cr.x0, -1.6],
          act: () => S.f.fort ? sayMe('Форточка закрыта. Скоро тут будет душно, как на экзамене.') : sayMe('Форточка открыта. Высоко — рукой не достать.'),
          use: {mop: async () => { if (S.f.fort) return sayMe('Уже закрыта.'); if (!riskOk()) return; pose(mx, 'reach', .9); sfx.click(); S.f.fort = 1; store(); await sayMe('Шваброй — щёлк. Через пять минут тут будет 1500 ppm. Мы дышим громко.'); }}, riskyUse: true},
        {id: 'soap', name: 'Мыло', box: [cr.x1 - .2, .85, -1.45, .4, .35, .5], at: [2.2, -1.5], face: [cr.x1, -1.5], risky: true,
          act: async () => { if (S.f.soap) return sayMe('Раковина без мыла. Санпинова бы такое не простила. Ой.'); pose(mx, 'bend', .7); await sleep(300); S.f.soap = 1; store(); give('soap'); s.sync(); await sayMe('Мыло — в карман. Гигиена, прости.'); }},
        {id: 'poster', name: 'Плакат СанПиН', box: [cr.x1 - .05, 1.4, -.1, .1, .95, .75], at: [2.35, -.1], face: [cr.x1, -.1], act: () => sanpin()},
        {id: 'board', name: 'Доска', box: [0, 1.25, cr.z0 + .05, 2.5, 1, .1], at: [-.5, -1.6], face: [0, cr.z0], act: () => sayMe('«Гигиена воздуха учебных помещений». Иронично: воздуха тут как раз маловато не будет. Пока.')},
        {id: 'tdesk', name: 'Стол препода', box: [1.25, .6, -2.25, 1.2, .3, .6], at: [.4, -1.6], face: [1.25, -2.25], act: () => sayMe('Люксметр и газоанализатор. Она их любит больше, чем студентов. Это можно использовать.')},
        {id: 'teacher', name: 'Санпинова', npc: tch, h: 1.3, at: () => [tch.root.position.x + .2, -1.65], face: () => [tch.root.position.x, tch.root.position.z], act: () => talkSanpinova()},
        {id: 'dimon', name: 'Одногруппник', npc: dimon, h: .9, at: [-1.4, 1.55], face: [-1.73, 1.2], act: () => sayMe('Спит. Профессионал. Его н-ки — моя мотивация.')},
        {id: 'star', name: 'Староста', npc: star, h: .9, at: [.55, -.3], face: [.97, -.35], act: () => talk(star, pick(['Макс, я отмечаю всех, кто дышит. Пока ты дышишь — ты здесь.', 'Если пару отменят — всем присутствие. Это правило Санпиновой, не моё.']))},
        {id: 's3', name: 'Одногруппник', npc: s3, h: .9, at: [1.4, 1.55], face: [1.73, 1.2], act: () => talk(s3, 'Санпинова однажды отменила пару, потому что в аудитории было +17. Легенда.')},
        {id: 'door', name: 'Дверь', box: [cr.x1 - .05, .9, 2.05, .15, 1.8, 1], at: [2.3, 2.05], face: [cr.x1, 2.05], act: () => dirtyExit()},
      ],
    };
    return s;
  };
  async function sanpin() {
    const r = [['💡', 'Освещённость ≥ 300 лк', S.f.blinds], ['🌬', 'CO₂ ≤ 1000 ppm — проветривание', S.f.fort], ['🧼', 'Мыло у раковины', S.f.soap]];
    await card(`<div style="font-size:20px;font-weight:900;margin-bottom:4px">СанПиН учебного помещения</div>
      <div style="color:#7a6f78;font-size:13px;margin-bottom:12px">Нарушить всё — и Санпинова сама закроет аудиторию</div>
      ${r.map(([e, t, b]) => `<div class="mx-row"><b>${e}</b><div>${t}</div><span style="font-size:20px">${b ? '❌' : '✅'}</span></div>`).join('')}
      <div style="color:#7a6f78;font-size:13px;margin:4px 0 12px">❌ — уже нарушено тобой. Потом спроси препода, всё ли в норме 😏</div>
      <button class="mx-big" data-ok>Понял</button>`);
  }
  async function talkSanpinova() {
    const t = sc.teacher;
    const c = await choose(['🙋 А у нас аудитория вообще по СанПиНу?', '🚽 Можно выйти?', 'Ничего, извините']);
    if (c === 0) return checkSanpin();
    if (c === 1) { await talk(t, 'Иди. Только быстро, Максим.'); return goScene('hub', {from: 'gig'}); }
    await talk(t, 'Тогда садись и пиши, Максим.');
  }
  async function checkSanpin() {
    const t = sc.teacher; cut = true;
    await sayMe('Тамара Павловна, а у нас аудитория вообще соответствует СанПиНу?');
    await talk(t, 'Конечно! Сейчас покажу, как надо проверять.');
    await walkNpcP(t, [.3, -1.55]); t.yaw = 0; pose(t, 'hold');
    const res = [[S.f.blinds, 'Освещённость: 180 лк — норма от 300!', 'Освещённость: 420 лк. Норма.'], [S.f.fort, 'CO₂: 1450 ppm — дышать нечем!', 'CO₂: 640 ppm. Свежо.'], [S.f.soap, 'Мыла нет?! Как вы руки моете?!', 'Мыло на месте. Отлично.']];
    for (const [bad, b, g] of res) { sfx.warn(); await talk(t, bad ? '❌ ' + b : '✅ ' + g); }
    const n = res.filter(r => r[0]).length;
    pose(t, null);
    if (n === 3) {
      await talk(t, 'Темно, душно и нет мыла! Это не аудитория, это нарушение! Пару переносим. Всем ставлю присутствие — идите.');
      for (const p of npcs) if (p !== t) { p.pose = null; play(p, 'Victory', {once: true}); }
      play(mx, 'Victory', {once: true}); sfx.win();
      await sayMe('Всё ложно, Тамара Павловна. Я тут вообще ни при чём.');
      cut = false; return win('gig', 'clean');
    }
    pal = Math.min(99, pal + 30); sfx.warn();
    await talk(t, n ? `Нарушение одно-два — ерунда, поправим. А чего это ты интересуешься, Максим? 🤨` : 'Всё в норме. А чего это ты интересуешься, Максим? 🤨');
    await sayMe('Да так. Люблю гигиену.');
    cut = false; tc.m = 'busy'; tc.t = 2; sc.setTeacher('busy');
  }

  // ===== МЕДГЕНЕТИКА =====
  scenes.gen = () => {
    const cr = classroom('gen', {boardLines: [['Тема: наследование', 30, '#ffffff', 700], ['признаков', 30, '#ffffff', 700], ['Аа × Аа → 1 : 2 : 1', 28, '#ffe98a', 700], ['Перекличка по головам!', 26, '#ffb3c8', 700]], lowC: '#b7c4e4'});
    const {g} = cr;
    const L_ = lights(g, {sunC: '#fff6e8'});
    // стол профессора с микроскопом слева у доски, шкаф с бюстом Менделя справа, вешалка у входа
    g.add(at(desk(1.2, .6, '#b88a5a'), -1.3, 0, -2.25));
    const scope = M([P(RB(.2, .04, .16, .02), '#2c2c34', [0, .57, 0]), P(CY(.025, .03, .3, 8), '#e6e6ea', [0, .74, -.04], [.3, 0, 0]), P(CY(.045, .045, .14, 10), '#2c2c34', [0, .9, .02], [.3, 0, 0]), P(RB(.05, .25, .05, .02), '#e6e6ea', [0, .7, -.07])]);
    g.add(at(scope, -1.1, 0, -2.2));
    const shelf = M([P(RB(.9, 1.7, .4, .03), '#9a6c44', [0, .85, 0]), P(RB(.82, .03, .36, .01), '#7a5236', [0, .55, .01]), P(RB(.82, .03, .36, .01), '#7a5236', [0, 1.1, .01]), P(RB(.82, .03, .36, .01), '#7a5236', [0, 1.55, .01]),
      ...[0, 1, 2, 3].map(i => P(CY(.06, .06, .18, 10), ['#cfe6c8', '#e6d8b8', '#cfe0ea', '#e8c8c8'][i], [-.28 + i * .19, .66, .03])), P(RB(.5, .12, .25, .02), '#3a6ab8', [0, 1.19, 0])]);
    g.add(at(shelf, 2.15, 0, -2.85));
    const bust = M([P(CY(.1, .13, .1, 12), '#efece4', [0, 1.62, 0]), P(SP(.12, 14, 10), '#f4f1ea', [0, 1.8, 0], [0, 0, 0], [1, 1.1, 1]), P(SP(.09, 10, 8), '#e2ded4', [0, 1.71, .05], [0, 0, 0], [1, 1, .7]), P(CY(.075, .09, .1, 12), '#efece4', [0, 1.69, 0])]);
    g.add(at(bust, 2.15, 0, -2.83));
    const hanger = M([P(CY(.025, .025, 1.7, 8), '#5a3a22', [0, .85, 0]), P(CY(.18, .2, .04, 12), '#5a3a22', [0, .02, 0]), ...[0, 1, 2].map(i => P(CY(.012, .012, .2, 6), '#5a3a22', [Math.sin(i * 2.1) * .1, 1.62, Math.cos(i * 2.1) * .1], [Math.cos(i * 2.1) * .6, 0, -Math.sin(i * 2.1) * .6]))]);
    g.add(at(hanger, -2.35, 0, 2.45));
    const jacket = M([P(RB(.38, .55, .14, .05), '#3a5a3a', [0, 1.3, .12]), P(RB(.1, .4, .1, .04), '#3a5a3a', [-.2, 1.3, .12]), P(RB(.1, .4, .1, .04), '#3a5a3a', [.2, 1.3, .12])]);
    g.add(at(jacket, -2.35, 0, 2.45));
    const bag = M([P(RB(.3, .32, .16, .05), '#2b2b33', [0, .16, 0]), P(RB(.26, .1, .02, .02), '#e03ad0', [0, .2, .08])]);
    g.add(at(bag, -.62, 0, 1.45, .3));
    const ped = poster(.75, .8, '#fffdf4', [['□—○', 26, '#222', 800, 'center'], ['│', 22, '#222', 800, 'center'], ['■ ○ ■', 26, '#c0283a', 800, 'center'], ['прогулы: аутосомно-доминантный тип', 13, '#555', 600, 'center']], 'Родословная'); ped.rotation.y = -Math.PI / 2; ped.position.set(cr.x1 - .02, 1.4, -.1); g.add(ped);
    const dna = poster(.5, .65, '#eef4ff', [['🧬', 60, '#000', 400, 'center']]); dna.position.set(1.1, 1.6, cr.z0 + .03); g.add(dna);
    // двойник на стуле Максима: собирается по частям
    const dum = {
      tee: M([P(RB(.36, .4, .22, .07), '#a9a8ae', [0, .58, 0])]),
      jacket: M([P(RB(.42, .36, .26, .07), '#3a5a3a', [0, .62, .02]), P(RB(.1, .3, .12, .05), '#3a5a3a', [-.24, .55, -.08], [.6, 0, 0]), P(RB(.1, .3, .12, .05), '#3a5a3a', [.24, .55, -.08], [.6, 0, 0])]),
      head: M([P(SP(.17, 14, 10), '#f4f1ea', [0, 1, 0]), ...Array.from({length: 11}, (_, i) => P(SP(.07, 8, 6), i % 2 ? '#9a9a90' : '#b4b2a6', [Math.sin(i * .9) * .16, 1.1 + Math.cos(i * 1.3) * .05 - (i > 6 ? .1 : 0), Math.cos(i * .9) * .12 + .03]))]),
    };
    const dummy = G(dum.tee, dum.jacket, dum.head); dummy.position.set(cr.seat[0], 0, cr.seat[1]); dummy.rotation.y = Math.PI; g.add(dummy);
    const tch = mkAllelev(), star = S2(), s1 = S1(), s3 = S3();
    const people = [
      {c: tch, at: [-1.3, -2.7], yaw: 0},
      {c: star, at: [.97, -.35], yaw: Math.PI, pose: 'desk'},
      {c: s1, at: [-1.73, -.35], yaw: Math.PI, pose: 'desk'},
      {c: s3, at: [1.73, 1.2], yaw: Math.PI, pose: 'nap'},
    ];
    const nav = navGrid([cr.x0 + .15, cr.z0 + .2, cr.x1 - .15, cr.z1 - .1], [...cr.obs, [-1.95, -2.55, -.65, -1.95], [1.65, -3.1, 2.65, -2.6], [-2.6, 2.2, -2.1, 2.7]]);
    const dummyOk = () => S.f.dTee && S.f.dJacket && S.f.dHead;
    const s = {
      g, nav, lights: L_, enter: [2.3, 2.05], seatAt: cr.seat, teacher: tch, people, dummyOk,
      cam: {look: [0, .45, -.1], el: 1.08, w: 5.6, h: 7.8, pan: .45, dz: -.4},
      cycle: {busy: [5, 7.5], watch: [2.4, 3.6], turn: .85, palRate: 24, busyIcon: '🔬'},
      setTeacher(m) { pose(tch, m === 'busy' ? 'scope' : null, .6); },
      tick() { cr.fort.rotation.y = -.7; cr.slats.children.forEach((sl, i) => { sl.visible = i < 2; }); },
      sync() {
        bust.visible = !S.f.bust; jacket.visible = !S.f.jacket;
        dum.tee.visible = !!S.f.dTee; dum.jacket.visible = !!S.f.dJacket; dum.head.visible = !!S.f.dHead;
        cr.soap.visible = true;
      },
      spots: [
        {id: 'seat', name: 'Моё место', box: [cr.seat[0], .45, cr.seat[1], .45, .8, .45], at: [cr.seat[0] + .3, cr.seat[1] + .35], face: cr.seat,
          act: async () => { if (dummyOk()) return sayMe('Двойник сидит. Я бы сам не отличил. Пора валить — когда Аллелев уткнётся в микроскоп.'); if (S.f.dTee || S.f.dJacket || S.f.dHead) return sayMe(`Двойнику не хватает: ${[!S.f.dJacket && '🧥 куртки', !S.f.dTee && '👕 футболки', !S.f.dHead && 'головы'].filter(Boolean).join(', ')}.`); return sitDown(cr.seat); },
          use: {jacket: () => dress('dJacket', 'jacket', 'Куртка на стуле. Плечи — мои, широкие.'), tee: () => dress('dTee', 'tee', 'Футболка «ВСЁ ЛОЖНО». Теперь это официально я.'), head: () => dress('dHead', 'head', 'Голова на месте. Он даже смотрит в доску внимательнее меня.'),
            bust: () => sayMe('Лысый Мендель на моём месте? Никто не поверит. Нужны мои кудри.'), mop: () => sayMe('Швабра на стуле — это не я. Это просто швабра. Нужна голова.')}},
        {id: 'bag', name: 'Рюкзак', box: [-.62, .2, 1.45, .4, .4, .3], at: [-.45, 1.75], face: [-.62, 1.45], act: async () => { if (S.f.tee) return sayMe('В рюкзаке: зарядка, жвачка и чувство вины.'); pose(mx, 'bend', .7); await sleep(300); S.f.tee = 1; store(); give('tee'); await sayMe('Запасная «ВСЁ ЛОЖНО». У меня их семь — по одной на каждый день недели.'); }},
        {id: 'hanger', name: 'Вешалка', box: [-2.35, 1, 2.45, .5, 1.8, .5], at: [-1.95, 2.1], face: [-2.35, 2.45], risky: true, act: async () => { if (S.f.jacket) return sayMe('Пустая вешалка. Как моя зачётка.'); pose(mx, 'reach', .7); await sleep(300); S.f.jacket = 1; store(); give('jacket'); s.sync(); await sayMe('Моя куртка. Сейчас у неё начнётся новая жизнь.'); }},
        {id: 'bust', name: 'Бюст Менделя', box: [2.15, 1.7, -2.8, .5, .4, .4], at: [2.1, -2.3], face: [2.15, -2.85], risky: true, act: async () => { if (S.f.bust) return sayMe('Полка без Менделя. Генетика осиротела.'); pose(mx, 'reach', .8); await sleep(300); S.f.bust = 1; store(); give('bust'); s.sync(); await sayMe('Прости, Грегор. Ты послужишь науке ещё раз.'); }},
        {id: 'shelf', name: 'Шкаф с препаратами', box: [2.15, .8, -2.8, .9, .9, .45], at: [2.0, -2.3], face: [2.15, -2.85], act: () => sayMe('Горох в банках. Мендель на нём всё и открыл. Горох — опора генетики.')},
        {id: 'scope', name: 'Микроскоп', box: [-1.1, .75, -2.2, .3, .4, .3], at: [-.45, -1.6], face: [-1.1, -2.2], act: () => sayMe('Аллелев смотрит туда минутами. Не моргая. Мне это на руку.')},
        {id: 'poster', name: 'Родословная', box: [cr.x1 - .05, 1.4, -.1, .1, .85, .8], at: [2.35, -.1], face: [cr.x1, -.1], act: () => sayMe('Родословная семьи Максоника: прогулы наследуются по доминантному типу. Я не виноват — это гены.')},
        {id: 'board', name: 'Доска', box: [0, 1.25, cr.z0 + .05, 2.5, 1, .1], at: [.3, -1.6], face: [0, cr.z0], act: () => sayMe('«Перекличка по головам». Значит, мне нужна голова. Не обязательно моя.')},
        {id: 'teacher', name: 'Аллелев', npc: tch, h: 1.4, at: [-.45, -1.65], face: () => [tch.root.position.x, tch.root.position.z], act: () => talkAllelev()},
        {id: 'star', name: 'Староста', npc: star, h: .9, at: [.55, -.3], face: [.97, -.35], act: async () => { await talk(star, S.f.starOk ? 'Если что — отвечу «здесь» за твою голову. Басом.' : 'Перекличка через 10 минут, Макс. Пустой стул я не прикрою.'); if (dummyOk() && !S.f.starOk) { S.f.starOk = 1; store(); await talk(star, '…а вот этого гипсового — прикрою 😂'); } }},
        {id: 's1', name: 'Одногруппник', npc: s1, h: .9, at: [-2.4, -.3], face: [-1.73, -.35], act: () => talk(s1, 'Говорят, Аллелев однажды отметил скелет из анатомички. Тот хотя бы не опаздывал.')},
        {id: 's3', name: 'Одногруппник', npc: s3, h: .9, at: [1.4, 1.55], face: [1.73, 1.2], act: () => sayMe('Спит с открытыми глазами. Генетическая мутация, наверное.')},
        {id: 'door', name: 'Дверь', box: [cr.x1 - .05, .9, 2.05, .15, 1.8, 1], at: [2.3, 2.05], face: [cr.x1, 2.05], act: () => genExit()},
      ],
    };
    return s;
  };
  async function dress(flag, item, line) {
    if (S.f[flag]) return sayMe('Это уже на нём.');
    pose(mx, 'bend', .6); await sleep(300);
    S.f[flag] = 1; take(item); sfx.combo(); sc.sync(); store();
    await sayMe(line);
    if (sc.dummyOk()) { buzz([20, 40, 20]); await sayMe('Двойник готов. Похож. Даже слишком. Теперь — к двери, пока Аллелев в микроскопе.'); }
  }
  async function talkAllelev() {
    const t = sc.teacher;
    const c = await choose(['🧬 Профессор, а клонирование человека возможно?', '🚽 Можно выйти?', 'Ничего, извините']);
    if (c === 0) { await talk(t, 'Теоретически — да. Практически — запрещено. А зачем вам, Максим?'); pal = Math.min(99, pal + 10); await sayMe('Да так. Теоретически.'); return; }
    if (c === 1) { await talk(t, 'Ступайте. Но перекличку я проведу по головам, Максим.'); return goScene('hub', {from: 'gen'}); }
    await talk(t, 'Тогда — к микроскопам.');
  }
  async function genExit() {
    if (!sc.dummyOk()) return dirtyExit();
    if (!riskOk()) return;
    cut = true; sfx.door();
    mx.root.visible = false; await sleep(600);
    const t = sc.teacher; pose(t, null); tc.m = 'watch'; t.yaw = 0;
    await talk(t, 'Так, перекличка. …Максим?');
    const star = npcs.find(p => p.name === 'Староста');
    await talk(star, 'Здесь! 🗿');
    await talk(t, 'Максим, вы сегодня какой-то… гипсовый.');
    await talk(star, 'Это у него наследственное, профессор.');
    await talk(t, 'Хм. Аутосомно-доминантное. Бывает. Отмечаю.');
    sfx.win(); cut = false; mx.root.visible = true;
    return win('gen', 'clean');
  }

  // ——— сборка и смена сцен ———
  const built = {};
  let tc = {m: 'busy', t: 3}, pal = 0, eyeEl = null;
  function goScene(id, {from, fresh: fr} = {}) {
    hideCh(); show(''); sel = null;
    if (sc) { scene.remove(sc.g); for (const p of npcs) sc.g.remove(p.root); }
    if (fr && LESSON_ITEMS[id]) { // пара с нуля: флаги и предметы этой пары сброшены
      for (const k of Object.keys(S.f)) if (k.startsWith(id + ':')) delete S.f[k];
      for (const k of LESSON_FLAGS[id]) delete S.f[k];
      S.inv = S.inv.filter(i => !LESSON_ITEMS[id].includes(i));
      S.cur = id; snap = JSON.stringify(S);
    }
    if (LESSON_ITEMS[id] && !fr && S.cur !== id) { S.cur = id; snap = JSON.stringify(S); }
    cur = id; sc = built[id] ||= scenes[id]();
    scene.add(sc.g); sc.g.add(mx.root);
    npcs.length = 0;
    for (const p of sc.people || []) {
      const c = p.c; sc.g.add(c.root); npcs.push(c);
      if (p.at) { c.root.position.set(p.at[0], 0, p.at[1]); c.yaw = c.root.rotation.y = p.yaw || 0; }
      c.pose = p.pose || null; c.pk = p.pose ? 1 : 0; c.path = null; c.root.visible = true;
      play(c, 'Idle', {fade: 0});
    }
    mx.root.visible = true; mx.path = null; mx.pose = null; mx.pk = 0; play(mx, 'Idle', {fade: 0});
    const e = from === 'gig' || from === 'gen' ? sc.enter : sc.start || sc.enter;
    mx.root.position.set(e[0], 0, e[1]); mx.yaw = mx.root.rotation.y = -Math.PI / 2;
    pal = 0; eyeEl?.remove(); eyeEl = null;
    if (sc.teacher) {
      const t = sc.teacher; t.root.position.set(...(sc.people[0].at ? [sc.people[0].at[0], 0, sc.people[0].at[1]] : [.1, 0, -2.35]));
      tc = {m: 'watch', t: 2.5}; t.yaw = t.root.rotation.y = 0; sc.setTeacher('watch');
      eyeEl = document.createElement('div'); eyeEl.className = 'mx-eye'; ov.append(eyeEl);
    }
    R.toneMappingExposure = 1.05;
    sc.sync(); camX = 0; aim(true); drawInv(); hud();
    if (sc.teacher) enterLesson(); else if (from) sayMe(pick(['Фух. Безопасная зона.', 'Туалет — единственное место, где меня не отметят.']));
  }
  const LESSON_FLAGS = {gig: ['blinds', 'fort', 'soap'], gen: ['tee', 'jacket', 'bust', 'dTee', 'dJacket', 'dHead', 'starOk']};
  let snap = '';
  async function enterLesson() {
    cut = true;
    await walkP(mx, sc.seatAt);
    const first = !S.seen[cur];
    if (cur === 'gig') {
      await talk(sc.teacher, first ? 'Опаздываем, Максим. Садитесь. Сегодня — гигиена воздуха.' : 'Вернулся? Садись.');
      await sitDownNow();
      if (first) { await think('Задача: сорвать пару так, чтобы всем поставили присутствие. Санпинова помешана на СанПиНе…'); toast('Плакат СанПиН на стене подскажет нормы. Рискованное — только когда препод ✍️ спиной!', 5200); }
    } else {
      await talk(sc.teacher, first ? 'Проходите, Максим. Сегодня перекличка — по головам. Кого нет, того нет.' : 'А, Максим. Садитесь.');
      await sitDownNow();
      if (first) { await think('Значит, мне нужен двойник. Генетика же — клонирование и всё такое.'); toast('Собери двойника на своём месте и уйди, пока Аллелев 🔬 в микроскопе', 5200); }
    }
    S.seen[cur] = 1; store();
    tc = {m: 'busy', t: 3}; sc.setTeacher('busy');
    cut = false;
  }

  // ——— Максим: ходьба, поза, сесть ———
  function walkTo(c, to, done) {
    const p = sc.nav.find([c.root.position.x, c.root.position.z], to), prev = c.done;
    c.path = p; c.done = done;
    prev?.(); // прежняя цель отменена — её ожидание отпускаем (там проверят, что путь уже другой)
    if (c.pose === 'sit' || c.pose === 'desk') pose(c, null);
    if (p.length) play(c, 'Walk', {speed: 1.25});
  }
  const walkP = (c, to) => new Promise(r => walkTo(c, to, r));
  function walkNpc(c, to, done) { // препод ходит напрямик в своей зоне
    const prev = c.done; c.path = [to]; c.done = done; play(c, 'Walk', {speed: 1.1}); prev?.();
  }
  const walkNpcP = (c, to) => new Promise(r => walkNpc(c, to, r));
  function pose(c, name, dur) { // dur — поза на время, потом вернуться к прежней
    if (dur) { const prev = c.pose; c.pose = name; c.pk = 0; c.tmp = setTimeout(() => { if (c.pose === name) c.pose = prev; }, dur * 1000); return; }
    clearTimeout(c.tmp); c.pose = name; if (!name) c.pk = Math.min(c.pk || 0, 1);
  }
  const seated = () => mx.pose === 'sit' || mx.pose === 'desk';
  async function sitDown(at = sc.seatAt) { await walkP(mx, at); return sitDownNow(); }
  async function sitDownNow() { mx.yaw = Math.PI; mx.root.position.set(sc.seatAt[0], 0, sc.seatAt[1]); pose(mx, 'desk'); await sleep(250); }

  // ——— реплики: пузыри над головой, тап — дальше ———
  const bubbles = [];
  let skipSay = null;
  function bubble(c, text, cls = '') {
    const b = document.createElement('div'); b.className = 'mx-bub ' + cls;
    b.innerHTML = `${cls === 'th' ? '' : `<i>${c.name}</i>`}${text}`;
    ov.append(b); const o = {c, b}; bubbles.push(o); placeBubbles();
    return () => { b.remove(); bubbles.splice(bubbles.indexOf(o), 1); };
  }
  function say(c, text, cls) {
    return new Promise(res => {
      bubbles.slice().forEach(o => { o.b.remove(); });
      bubbles.length = 0;
      const rm = bubble(c, text, cls);
      const n = Math.min(14, Math.ceil(text.length / 6)); for (let i = 0; i < n; i++) setTimeout(() => !muted && sfx.blip(c.voice || 150), i * 70);
      const t = setTimeout(fin, 1400 + text.length * 55);
      function fin() { clearTimeout(t); rm(); skipSay = null; res(); }
      setTimeout(() => { skipSay = fin; }, 250);
    });
  }
  const sayMe = t => say(mx, t, 'me');
  const think = t => say(mx, t, 'th');
  const talk = (c, t) => { if (c !== mx && !c.path) face(c, mx.root.position.x, mx.root.position.z); return say(c, t); };
  function toast(t, ms = 2600) { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.style.opacity = 0; }, ms); }
  let chRes = null;
  function choose(opts) {
    return new Promise(r => { chRes = r; chEl.innerHTML = opts.map((o, i) => `<button data-c="${i}">${o}</button>`).join(''); invEl.style.visibility = 'hidden'; });
  }
  function hideCh() { chEl.innerHTML = ''; invEl.style.visibility = ''; chRes = null; }
  chEl.onclick = e => { const b = e.target.closest('[data-c]'); if (!b || !chRes) return; sfx.tap(); const r = chRes; hideCh(); r(+b.dataset.c); };
  // карточка по центру; data-ok закрывает, data-a — действия
  function show(h) { panel.innerHTML = h ? `<div class="mx-p mx-card" style="position:relative;left:0;right:0">${h}</div>` : ''; panel.style.inset = h ? '0' : ''; panel.style.position = 'absolute'; panel.style.display = h ? 'grid' : 'none'; panel.style.alignItems = 'center'; panel.style.background = h ? '#2a0a3a66' : ''; }
  let cardRes = null;
  function card(h) { return new Promise(r => { cardRes = r; show(h); }); }

  // ——— риск: препод смотрит → палево ———
  function riskOk() {
    if (tc.m !== 'watch') return true;
    pal = Math.min(100, pal + 34); sfx.alarm(); buzz([40, 30, 40]);
    talk(sc.teacher, pick(['Максим! Ты куда?', 'Максим, сядь на место!', 'Что ты там делаешь, Максим?', 'Я всё вижу, Максим.']));
    return false;
  }
  async function caught() {
    cut = true; sfx.alarm();
    mx.path = null; play(mx, 'RecieveHit', {once: true});
    await talk(sc.teacher, cur === 'gig' ? 'Максим! Раз ты такой активный — к доске! Расскажи нам про СанПиН.' : 'Максим, раз вы так активно гуляете — к доске. Решаем задачу на сцепленное наследование.');
    sfx.fail(); cut = false;
    const h = `<div style="font-size:44px">🚨</div><div style="font:900 26px/1.1 system-ui;margin:6px 0">Спалился</div>
      <div style="color:#5a4d66;margin-bottom:14px">Пришлось отвечать у доски всю пару. Деканат доволен, Максим — нет.</div>
      <button class="mx-big" data-a="retry">↻ Попробовать ещё раз</button><button class="mx-link" data-a="tohub">В туалет (выход)</button>`;
    show(h);
  }
  async function dirtyExit() {
    const c = await choose(['🚪 Уйти без прикрытия (н-ка, посещаемость −10%)', 'Остаться']);
    if (c) return;
    if (!riskOk()) return;
    cut = true; sfx.door(); mx.root.visible = false; await sleep(500); cut = false;
    win(cur, 'dirty');
  }
  function win(id, how) {
    const prev = S.done[id];
    if (!(prev === 'clean' && how === 'dirty')) S.done[id] = how;
    S.inv = S.inv.filter(i => !LESSON_ITEMS[id].includes(i)); sel = null; drawInv(); // улики пары остаются в аудитории
    S.cur = ''; store();
    const next = id === 'gig' ? 'Медгенетика' : null;
    const all = S.done.gig && S.done.gen;
    show(`<div style="font-size:44px">${how === 'clean' ? '✨' : '📝'}</div>
      <div style="font:900 26px/1.1 system-ui;margin:6px 0">${id === 'gig' ? 'Гигиена' : 'Медгенетика'} прогуляна${how === 'clean' ? ' чисто' : ''}</div>
      <div style="color:#5a4d66;margin-bottom:12px">${how === 'clean' ? 'В журнале — присутствие. Деканат ничего не заподозрил.' : 'Н-ка в журнале. Деканат запомнит.' + (prev === 'clean' ? ' (зачтён прошлый чистый прогул)' : '')}</div>
      <div class="mx-row"><b>📋</b><div>Посещаемость по журналу<small>${att() < 70 ? 'ниже 70% — вызов к декану!' : 'порог деканата — 70%'}</small></div><span style="font:900 20px system-ui;color:${att() < 70 ? '#e5484d' : '#30a46c'}">${att()}%</span></div>
      ${all ? '<div style="color:#5a4d66;margin:8px 0 12px">Лучевая диагностика, Патанатомия и Декан — <b>скоро</b>. Декан уже что-то подозревает…</div>' : ''}
      <button class="mx-big" data-a="tohub" style="margin-top:6px">${next ? `Дальше: ${next} →` : 'В туалет →'}</button>`);
  }

  // ——— расписание (дверь туалета) и телефон ———
  function schedule() {
    const st = id => S.done[id] === 'clean' ? '✨ прогуляно чисто' : S.done[id] === 'dirty' ? '📝 н-ка — можно перепройти' : S.cur === id ? '▶ продолжить' : '▶ идти';
    const row = (id, e, n, room, open) => `<button class="mx-row ${open && !S.done[id] ? 'go' : ''} ${open ? '' : 'off'}" ${open ? `data-a="lesson" data-v="${id}"` : 'disabled'}><b>${e}</b><div><span style="font-weight:800">${n}</span><small>${room} · ${open ? st(id) : '🔒 скоро'}</small></div></button>`;
    show(`<div style="font-size:20px;font-weight:900">Расписание · 3 курс</div><div style="color:#7a6f78;font-size:13px;margin-bottom:12px">Посещаемость: <b>${att()}%</b> · порог деканата 70%</div>
      ${row('gig', '🧼', 'Гигиена', 'каб. 214', true)}${row('gen', '🧬', 'Медгенетика', 'каб. 305', !!S.done.gig)}${row('ray', '☢️', 'Лучевая диагностика', 'подвал', false)}${row('pat', '🫙', 'Патанатомия', 'морг-корпус', false)}${row('dean', '👔', 'Декан', 'деканат', false)}
      <button class="mx-link" data-ok>Остаться в туалете</button>`);
  }
  function phone() {
    const m = [
      ['Староста', 'Сегодня: гигиена, медген, лучевая, патан. Отмечаю всех. Кого нет — н-ка, сорян'],
      ['Деканат (переслано)', 'Студенты с посещаемостью ниже 70% будут вызваны к декану.'],
    ];
    if (!S.done.gig) m.push(['Аня', 'на гигиене Санпинова опять с люксметром 🙄 свет, CO₂, мыло — у неё пунктик. Если что-то не по норме — она сразу всех выгоняет']);
    if (!S.done.gig && !has('mop')) m.push(['Димон', 'в туалете на 3 этаже уборщица опять швабру бросила, кто-нибудь заберите она мешает 😂']);
    if (has('mop')) m.push(['Аня', 'кто швабру у уборщицы спёр, она орёт на весь третий этаж']);
    if (S.done.gig === 'clean') m.push(['Димон', 'гигиену отменили?? Макс, это ты? 😳'], ['Максим', 'Всё ложно.', 1]);
    if (S.done.gig && !S.done.gen) m.push(['Староста', 'на медгене Аллелев делает перекличку ПО ГОЛОВАМ 👀 пустой стул = н-ка. Он не смотрит по сторонам только когда в микроскоп уткнулся']);
    if (S.done.gen === 'clean') m.push(['Староста', 'Аллелев сказал, что Максим сегодня какой-то гипсовый 🗿 и что у Менделя на полке пропала голова']);
    if (S.done.gig && S.done.gen) m.push(['Деканат', 'Максим, зайдите в деканат на этой неделе.']);
    show(`<div style="font-size:18px;font-weight:900">💬 Лечфак · 3 курс</div><div class="mx-chat">${m.map(([w, t, me]) => `<div class="${me ? 'me' : ''}"><b>${w}</b>${t}</div>`).join('')}</div>
      <button class="mx-big" data-ok>Убрать телефон</button>`);
  }
  function title() {
    const cont = S.cur || Object.keys(S.done).length || S.seen.intro;
    show(`<div style="margin:-4px 0 10px">${LOGO}</div>
      <div style="color:#5a4d66;margin:10px 0 14px">Максим, 3 курс медуниверситета. Задача — прогулять пары так, чтобы деканат ничего не заметил.</div>
      <div style="display:grid;gap:8px"><button class="mx-big" data-a="play">${cont ? '▶ Продолжить' : '▶ Играть'}</button>
      ${cont ? '<button class="mx-sec" data-a="reset">Начать заново</button>' : ''}</div>
      <div style="color:#7a6f78;font-size:12.5px;margin-top:12px">${touch ? 'Тап' : 'Клик'} по полу — идти, по предмету — осмотреть или взять. Предмет из инвентаря → на объект — применить, на другой предмет — соединить. 🔍 — подсветить, что можно трогать.</div>`);
  }

  // ——— инвентарь ———
  let sel = null;
  function drawInv() {
    invEl.innerHTML = S.inv.map(i => `<button data-i="${i}" class="${sel === i ? 'on' : ''}" aria-label="${ITEMS[i].n}">${ITEMS[i].e}</button>`).join('')
      + `<div class="tip">${sel ? `${ITEMS[sel].e} ${ITEMS[sel].n} → применить к… (ещё тап — описание)` : S.inv.length ? '' : 'Карманы пусты'}</div>`;
  }
  invEl.onclick = e => {
    const b = e.target.closest('[data-i]'); if (!b || cut || panel.innerHTML) return;
    const i = b.dataset.i; sfx.tap();
    if (sel === i) { sel = null; drawInv(); return sayMe(ITEMS[i].d); }
    if (sel) { // соединить
      const r = COMBOS.find(([a]) => a.includes(sel) && a.includes(i));
      if (r) { take(r[0][0]); take(r[0][1]); sel = null; give(r[1]); sfx.combo(); return sayMe(r[2]); }
      sel = null; drawInv(); sfx.no(); return sayMe(pick(['Не, это не соединяется.', 'Всё ложно, но не настолько.']));
    }
    sel = i; drawInv();
  };

  // ——— HUD ———
  function hud() {
    const l = !!sc?.teacher;
    topEl.innerHTML = `<span class="mx-chip">📋 ${att()}%</span>` + (l ? `<span class="mx-chip">😶 Палево <span class="mx-pal"><i data-pal></i></span></span>` : '');
  }
  function hintDots() {
    for (const s of sc.spots) {
      const p = spotPos(s); p.project(cam);
      const d = document.createElement('div'); d.className = 'mx-dot';
      d.style.left = (p.x * .5 + .5) * W + 'px'; d.style.top = (-p.y * .5 + .5) * H + 'px';
      d.innerHTML = `<i></i><span>${s.name}</span>`; ov.append(d); setTimeout(() => d.remove(), 2200);
    }
  }
  const tmpV = new T.Vector3();
  function spotPos(s) {
    if (s.npc) return tmpV.set(s.npc.root.position.x, (s.h || 1) * (s.npc.pose === 'sit' || s.npc.pose === 'desk' || s.npc.pose === 'nap' ? .75 : 1), s.npc.root.position.z);
    return tmpV.set(s.box[0], s.box[1], s.box[2]);
  }

  // ——— ввод: тап по предмету/полу ———
  const ray = new T.Raycaster(), ndc = new T.Vector2(), boxG = new T.BoxGeometry(1, 1, 1), probe = new T.Mesh(boxG);
  let p0 = null, cut = false;
  gl.onpointerdown = e => { p0 = [e.clientX, e.clientY]; };
  gl.onpointerup = e => {
    if (!p0 || Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) > 14) return; p0 = null;
    if (skipSay) return skipSay();
    if (cut || chRes || panel.innerHTML || !sc) return;
    const r = gl.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, cam);
    let best = null, bd = 1e9;
    for (const s of sc.spots) {
      if (s.npc) { const p = s.npc.root.position, k = s.npc.pose && s.npc.pose !== 'hold' && s.npc.pose !== 'write' && s.npc.pose !== 'scope' ? .7 : 1; probe.position.set(p.x, (s.h || 1) * k / 2, p.z); probe.scale.set(.6, (s.h || 1) * k, .6); }
      else { probe.position.set(s.box[0], s.box[1], s.box[2]); probe.scale.set(s.box[3], s.box[4], s.box[5]); }
      probe.updateMatrixWorld(true);
      const h = ray.intersectObject(probe, false)[0];
      if (h && h.distance < bd) { bd = h.distance; best = s; }
    }
    if (best) return interact(best);
    // пол
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (t > 0) { const x = ray.ray.origin.x + ray.ray.direction.x * t, z = ray.ray.origin.z + ray.ray.direction.z * t; sfx.tap(); marker(x, z); if (sel) { sel = null; drawInv(); } walkTo(mx, [x, z]); }
  };
  const ringM = new T.Mesh(new T.RingGeometry(.12, .17, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({color: '#ff6cf0', transparent: true, depthWrite: false})); ringM.visible = false; scene.add(ringM);
  let ringT = 0;
  const marker = (x, z) => { ringM.position.set(x, .02, z); ringM.visible = true; ringT = .6; };
  let busyAct = 0;
  async function interact(s) {
    sfx.tap();
    const item = sel, id = ++busyAct;
    toast((item ? `${ITEMS[item].e} → ` : '') + s.name, 1200);
    const to = typeof s.at === 'function' ? s.at() : s.at;
    if (s.id === 'seat' && !item && !sc.spots.find(x => x.id === 'seat').use) { sel = null; drawInv(); return sitDown(); }
    await walkP(mx, to);
    if (id !== busyAct || mx.path) return; // передумал по дороге
    cut = true; // на время действия ввод и цикл препода стоят
    const f = typeof s.face === 'function' ? s.face() : s.face; if (f) face(mx, ...f);
    try {
      await sleep(150);
      if (item) {
        sel = null; drawInv();
        const u = s.use?.[item];
        if (!u) { sfx.no(); await sayMe(pick([`${ITEMS[item].n} сюда не подходит.`, 'Не, не сработает.', 'Всё ложно, но не настолько.', 'Гениально. Но нет.'])); }
        else await u();
      } else {
        if (s.risky && sc.teacher && !riskOk()) return;
        await s.act();
      }
    } finally { cut = false; }
  }

  // ——— камера: подстраивается под экран, слегка следует за Максимом ———
  let camX = 0, camFix = null;
  function aim(snapNow) {
    const c = sc.cam, vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    const d = Math.max((c.w / 2) / Math.tan(hf / 2), (c.h / 2) / Math.tan(vf / 2));
    const narrow = (c.w / 2) / Math.tan(hf / 2) > (c.h / 2) / Math.tan(vf / 2);
    const tx = narrow ? Math.max(-c.pan, Math.min(c.pan, mx.root.position.x * .3)) : 0;
    camX = snapNow ? tx : camX + (tx - camX) * .04;
    const dd = narrow ? d * .9 : d; // на узком экране почти вся ширина комнаты в кадре, камера чуть ездит за Максимом
    const ry = c.ry || 0;
    cam.position.set(c.look[0] + camX + Math.sin(ry) * Math.cos(c.el) * dd, c.look[1] + Math.sin(c.el) * dd, c.look[2] + Math.cos(ry) * Math.cos(c.el) * dd);
    cam.lookAt(c.look[0] + camX, c.look[1], c.look[2] + (narrow ? c.dz || 0 : 0));
  }

  // ——— кадр ———
  let last = 0, raf;
  function updC(c, dt, speed = 1.35) {
    if (c.path?.length) {
      const [tx, tz] = c.path[0], p = c.root.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      c.yaw = Math.atan2(dx, dz);
      const st = speed * dt;
      if (d <= st) { p.x = tx; p.z = tz; c.path.shift(); } else { p.x += dx / d * st; p.z += dz / d * st; }
      if (c === mx && (c.stepT = (c.stepT || 0) + dt) > .32) { c.stepT = 0; sfx.step(); }
      if (!c.path.length) { c.path = null; play(c, 'Idle'); const f = c.done; c.done = null; f?.(); }
    }
    c.root.rotation.y = angTo(c.root.rotation.y, c.yaw ?? c.root.rotation.y, Math.min(1, dt * 10));
    for (const [b, q0] of c.rest) b.quaternion.copy(q0);
    c.mix.update(dt); c.t += dt;
    const target = c.pose ? 1 : 0; c.pk = (c.pk || 0) + (target - (c.pk || 0)) * Math.min(1, dt * 8);
    if (c.pose) { c.lastPose = c.pose; }
    c.o.position.y = 0;
    if (c.pk > .01 && c.lastPose) POSES[c.lastPose](c, c.pk, c.t);
  }
  function placeBubbles() {
    for (const o of bubbles) {
      const c = o.c, sitting = c.pose === 'sit' || c.pose === 'desk' || c.pose === 'nap';
      tmpV.set(c.root.position.x, sitting ? 1.15 : 1.42, c.root.position.z).applyMatrix4(sc.g.matrixWorld).project(cam);
      let x = (tmpV.x * .5 + .5) * W, y = (-tmpV.y * .5 + .5) * H;
      x = Math.max(125, Math.min(W - 125, x)); y = Math.max(140, y);
      o.b.style.left = x + 'px'; o.b.style.top = y + 'px';
    }
  }
  const loop = now => {
    const raw = (now - last) / 1000 || 0, dt = Math.min(.1, raw); last = now;
    if (!document.hidden && dt > 0 && (ft += dt, ++fr) >= 90) { if (ft / fr > 1 / 45 && q < 3) { q++; if (q === 3) { R.shadowMap.enabled = false; scene.traverse(o => o.material && (o.material.needsUpdate = true)); } fit(); } fr = ft = 0; }
    if (sc) {
      updC(mx, dt);
      for (const c of npcs) updC(c, dt, 1.1);
      sc.tick?.(dt);
      // препод: занят → поворачивается → смотрит → снова занят
      if (sc.teacher && !cut && !panel.innerHTML && !chRes) {
        const cy = sc.cycle;
        if ((tc.t -= dt) <= 0) {
          if (tc.m === 'busy') { tc.m = 'turn'; tc.t = cy.turn; sfx.warn(); }
          else if (tc.m === 'turn') { tc.m = 'watch'; tc.t = cy.watch[0] + Math.random() * (cy.watch[1] - cy.watch[0]); sc.setTeacher('watch'); }
          else { tc.m = 'busy'; tc.t = cy.busy[0] + Math.random() * (cy.busy[1] - cy.busy[0]); sc.setTeacher('busy'); }
        }
        const away = !seated() && !(sc.dummyOk?.());
        if (tc.m === 'watch' && away) { pal += cy.palRate * dt; if (Math.random() < dt * 2.2) sfx.warn(); }
        else pal = Math.max(0, pal - 5 * dt);
        if (pal >= 100) { pal = 100; caught(); }
      }
      if (eyeEl && sc.teacher) {
        const t = sc.teacher; tmpV.set(t.root.position.x, 1.62, t.root.position.z).project(cam);
        eyeEl.style.left = (tmpV.x * .5 + .5) * W + 'px'; eyeEl.style.top = (-tmpV.y * .5 + .5) * H + 'px';
        const m = cut ? 'cut' : tc.m; if (eyeEl.dataset.m !== m) { eyeEl.dataset.m = m; eyeEl.className = 'mx-eye ' + m; eyeEl.textContent = m === 'watch' ? '👁' : m === 'turn' ? '❗' : m === 'cut' ? '💬' : sc.cycle.busyIcon; }
      }
      const pe = topEl.querySelector('[data-pal]'); if (pe) pe.style.width = pal + '%';
      if (ringM.visible && (ringT -= dt) <= 0) ringM.visible = false; else if (ringM.visible) { ringM.material.opacity = ringT / .6; ringM.scale.setScalar(1 + (.6 - ringT)); }
      if (!camFix) aim(); placeBubbles();
      R.render(scene, cam);
    }
    raf = requestAnimationFrame(loop);
  };

  // ——— кнопки ———
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a],[data-ok]'); if (!b) return;
    if (b.hasAttribute('data-ok')) { sfx.tap(); show(''); const r = cardRes; cardRes = null; r?.(); return; }
    const a = b.dataset.a; sfx.tap();
    if (a === 'x') return close();
    if (a === 'snd') { muted = !muted; save('maksMute', muted ? '1' : ''); sndIcon(); if (A()) out.gain.value = muted ? 0 : .8; return; }
    if (a === 'hint') { if (!panel.innerHTML) hintDots(); return; }
    if (a === 'phone') { if (!panel.innerHTML && !cut) phone(); return; }
    if (a === 'play') { show(''); if (!S.seen.intro) intro(); return; }
    if (a === 'reset') { S = fresh(); store(); drawInv(); goScene('hub'); title(); return; }
    if (a === 'lesson') { const v = b.dataset.v; show(''); sfx.door(); return goScene(v, {fresh: S.cur !== v}); }
    if (a === 'retry') { const id = cur; show(''); try { S = JSON.parse(snap); } catch {} return goScene(id, {fresh: false}); }
    if (a === 'tohub') { show(''); S.cur = ''; store(); return goScene('hub', {from: cur}); }
  });
  async function intro() {
    cut = true;
    await walkP(mx, [.2, .3]); face(mx, 0, 3);
    await sayMe('Третий курс. Четыре пары. Ноль желания.');
    await sayMe('Прогулять просто. Прогулять так, чтобы деканат не заметил, — вот искусство.');
    cut = false; S.seen.intro = 1; store();
    toast((touch ? 'Тапни' : 'Кликни') + ' по полу — пойду. По предмету — осмотрю. Дверь — расписание пар', 5000);
  }

  const keys = e => { A(); if (e.key === 'Escape') { if (panel.innerHTML && !panel.querySelector('[data-a=play]')) show(''); else close(); } };
  addEventListener('resize', fit); addEventListener('keydown', keys);
  function close() {
    cancelAnimationFrame(raf); root.remove(); document.body.style.overflow = was;
    removeEventListener('resize', fit); removeEventListener('keydown', keys);
    scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    for (const k of Object.keys(built)) built[k].g.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    R.dispose(); R.forceContextLoss();
  }

  if (/[?&]mtest\b/.test(location.search)) window.maksTest = {
    S: () => S, cur: () => cur, tc: () => tc, pal: () => pal, cut: () => cut, mx: () => mx.root.position.toArray(), pose: () => mx.pose,
    go: (id, o) => goScene(id, o), act: id => interact(sc.spots.find(s => s.id === id)), sel: i => { sel = i; drawInv(); },
    watch: m => { tc.m = m; tc.t = 99; sc.setTeacher(m === 'turn' ? 'busy' : m); }, skip: () => skipSay?.(), choose: i => chEl.querySelector(`[data-c="${i}"]`)?.click(),
    click: s => root.querySelector(s)?.click(), cam: (p, l) => { sc.cam = {...sc.cam, ...p}; if (l) aim(true); }, panel: () => panel.innerText, bubbles: () => bubbles.map(b => b.b.innerText),
    fix: (p, l) => { camFix = 1; cam.position.set(...p); cam.lookAt(...l); }, unfix: () => { camFix = null; },
    idle: () => !cut && !mx.path && !skipSay && !chRes && !panel.innerHTML, busy: () => ({cut, path: !!mx.path, say: !!skipSay, ch: !!chRes, panel: !!panel.innerHTML}),
    give: i => give(i), flags: f => { Object.assign(S.f, f); sc.sync(); },
  };
  goScene('hub');
  title();
  raf = requestAnimationFrame(loop);
}
})();
