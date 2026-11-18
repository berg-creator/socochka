// Сервис админки на виртуалке (systemd --user, ставит vm/install.sh; сам файл копируется в ~/.local/share/socochka-admin —
// правки здесь вступают в силу только после повторного install.sh).
// 1) Коды дня: каждому, кто убирает (cfg/people), — 2 случайные цифры в ~codes/имя до 00:00 МСК; видит только сам.
// 2) Вход админа: страница пишет ~login/uid = {codes, ts}; коды всех совпали (в любом порядке) — ~admin/uid = {until: +3 ч}, ответ res.
//    5 неверных попыток за 30 минут — вход закрыт на полчаса (иначе 2-значные коды подбираются скриптом). Об успешном входе — пуш всем.
// В базу ходит правами владельца проекта: токен firebase CLI (firebase login), мимо правил.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomInt} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';

const HOME = homedir(), DIR = process.env.AI_DIR || join(HOME, '.local/share/socochka-admin');
const DB = process.env.AI_DB || 'https://socochka-default-rtdb.firebaseio.com';
const TOPIC = 'socochka-fcbd86', SITE = 'https://berg-creator.github.io/socochka/'; // как в shared.js
const PEOPLE = ['Миша', 'Паша', 'Максим', 'Карим']; // если в базе нет cfg
const SESSION = 3 * 36e5, TRIES = 5, LOCK = 30 * 6e4;
const log = (...a) => console.log(new Date().toISOString(), ...a);
mkdirSync(DIR, {recursive: true});
let state = {fails: []};
try { state = {...state, ...JSON.parse(readFileSync(join(DIR, 'state.json'), 'utf8'))}; } catch {}
const save = () => writeFileSync(join(DIR, 'state.json'), JSON.stringify(state));

// токен владельца: refresh-токен firebase CLI → access_token Google (живёт час)
const fbApi = createRequire(join(HOME, '.local/lib/node_modules/firebase-tools/package.json'))('./lib/api.js');
let tok = {};
async function token() {
  if (process.env.AI_TOKEN) return process.env.AI_TOKEN; // для эмулятора: owner
  if (tok.exp > Date.now()) return tok.t;
  const rt = JSON.parse(readFileSync(join(HOME, '.config/configstore/firebase-tools.json'), 'utf8')).tokens.refresh_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: rt, client_id: fbApi.clientId(), client_secret: fbApi.clientSecret()})}).then(r => r.json());
  if (!r.access_token) throw new Error('нет токена firebase: ' + JSON.stringify(r));
  tok = {t: r.access_token, exp: Date.now() + (r.expires_in - 120) * 1000};
  return tok.t;
}
async function db(path, method = 'GET', body) {
  const p = path.split('/').filter(Boolean).map(encodeURIComponent).join('/'), t = await token();
  const url = `${DB}/${p}.json?` + (process.env.AI_TOKEN ? 'ns=' + process.env.AI_NS : 'access_token=' + t);
  const r = await fetch(url, {method, headers: process.env.AI_TOKEN ? {Authorization: 'Bearer owner'} : {}, body: body === undefined ? undefined : JSON.stringify(body)});
  if (!r.ok) throw new Error(`база ${method} ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
const notify = message => process.env.AI_QUIET ? log('пуш (тихо):', message)
  : fetch('https://ntfy.sh/', {method: 'POST', body: JSON.stringify({topic: TOPIC, title: 'Соцочка', message, click: SITE + '#my'})}).catch(e => log('ntfy', e.message));
const msk = ts => new Date(ts).toLocaleTimeString('ru-RU', {timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit'});
const midnight = () => { const d = 864e5, o = 3 * 36e5; return (Math.floor((Date.now() + o) / d) + 1) * d - o; }; // ближайшие 00:00 МСК

// ---------- коды дня ----------
let codes = {};
async function refreshCodes() {
  const names = Object.keys(await db('cfg/people') || {}), want = names.length ? names : PEOPLE, now = Date.now();
  const cur = await db('~codes') || {};
  if (want.every(n => cur[n]?.exp > now) && Object.keys(cur).every(n => want.includes(n))) return codes = cur;
  const next = Object.fromEntries(want.map(n => [n, cur[n]?.exp > now ? cur[n] : {c: String(randomInt(100)).padStart(2, '0'), exp: midnight()}]));
  await db('~codes', 'PUT', next);
  log('коды обновлены для', want.join(', '));
  return codes = next;
}

// ---------- вход админа ----------
async function checkLogins() {
  const all = await db('~login') || {}, now = Date.now();
  for (const [uid, x] of Object.entries(all)) {
    if (x?.res) { if (!(x.ts > now - 864e5)) await db(`~login/${uid}`, 'DELETE'); continue; }
    if (typeof x?.codes !== 'string') { await db(`~login/${uid}`, 'DELETE'); continue; }
    if (Object.values(codes).some(c => !(c.exp > now))) await refreshCodes();
    state.fails = state.fails.filter(t => t > now - LOCK);
    let res;
    const want = Object.values(codes).map(c => c.c), got = x.codes.replace(/\D/g, '');
    if (state.fails.length >= TRIES) res = `Слишком много неверных попыток — вход закрыт до ${msk(state.fails[0] + LOCK)} МСК`;
    else if (got.length !== want.length * 2) res = `Нужно ${want.length} кода по 2 цифры — всего ${want.length * 2} цифр`;
    else if (got.match(/../g).sort().join() !== want.sort().join()) {
      state.fails.push(now); save();
      res = `Коды не подходят. Осталось попыток: ${TRIES - state.fails.length}` + (state.fails.length >= TRIES ? ` — вход закрыт до ${msk(now + LOCK)} МСК` : '');
      if (state.fails.length >= TRIES) notify('🔑 Кто-то 5 раз ввёл неверные коды админки — вход закрыт на полчаса');
    } else {
      await db(`~admin/${uid}`, 'PUT', {until: now + SESSION});
      res = 'ok';
      notify(`🔑 Вход в админку — до ${msk(now + SESSION)} МСК`);
    }
    log('вход', uid, res);
    await db(`~login/${uid}/res`, 'PUT', res);
  }
}
async function cleanSessions() {
  const all = await db('~admin') || {};
  for (const [uid, s] of Object.entries(all)) if (!(s?.until > Date.now())) await db(`~admin/${uid}`, 'DELETE');
}

// ---------- цикл ----------
const loop = (f, ms) => { const go = () => f().catch(e => log(f.name, e.message)).finally(() => setTimeout(go, ms)); go(); };
log('сервис админки запущен', DB);
await refreshCodes().catch(e => log('коды', e.message));
loop(refreshCodes, 60000);
loop(checkLogins, 1500);
loop(cleanSessions, 10 * 6e4);
