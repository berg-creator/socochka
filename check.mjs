// Проверка перед коммитом (вызывает check.sh, его — хук .git/hooks/pre-commit): index.html открывается в невидимом Chrome
// на живой базе, ждём загрузки данных. Страница должна отрисоваться — вкладка выбрана, неделя и рейтинг заполнены — и без ошибок в консоли.
// Работает и на Маке, и на Linux (виртуалке): Chrome управляется по протоколу отладки, нужен только node 22+
import {spawn} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = existsSync(mac) ? mac : 'google-chrome';
const dir = mkdtempSync(join(tmpdir(), 'socochka-check-')); // свой профиль — иначе headless цепляется к открытому Chrome
const ch = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank'], {stdio: 'ignore'});
const sleep = t => new Promise(r => setTimeout(r, t));
const errors = [];
function done(msg) {
  ch.kill(); rmSync(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  if (msg) console.error('check: ' + msg + '. Открой index.html в браузере и посмотри консоль');
  process.exit(msg ? 1 : 0);
}
setTimeout(() => done('не дождался страницы за 30 с'), 30000);

let port;
for (let i = 0; i < 80 && !port; i++) { await sleep(250); try { port = readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
if (!port) done('Chrome не запустился');
const page = (await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json())).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0;
const wait = {};
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  wait[m.id]?.(m.result);
};
const call = (method, params = {}) => new Promise(r => { wait[++id] = r; ws.send(JSON.stringify({id, method, params})); });
await call('Runtime.enable');
await call('Page.navigate', {url: 'file://' + join(import.meta.dirname, 'index.html')});

// данные пришли — рейтинг заполнен строками (до загрузки там «Загрузка…»)
const ready = `!!document.querySelector('.tabs a.on') && !!document.querySelector('#week b') && !!document.querySelector('#rating .row.hist')`;
for (let i = 0; i < 50; i++) {
  if (errors.length) done('ошибка в скрипте: ' + errors[0].split('\n')[0]);
  if ((await call('Runtime.evaluate', {expression: ready, returnByValue: true})).result.value) done();
  await sleep(400);
}
const note = (await call('Runtime.evaluate', {expression: `document.getElementById('rating').innerText`, returnByValue: true})).result.value;
done('страница не отрисовалась (рейтинг: «' + note.slice(0, 60) + '»)');
