// Общее для страницы и напоминаний (.github/remind.js, .github/trash.js)
const people = ['Миша', 'Паша', 'Максим', 'Карим']; // убирают
const members = [...people, 'Катя']; // все на сайте: Катя не убирает, но оценивает, голосует, пишет заявки
const bosses = ['Максим', 'Паша', 'Карим', 'Миша']; // староста по очереди, начиная с этой недели
const objects =[['🧽', 'Поверхности'], ['🚪', 'Коридор'], ['🚽', 'Туалет'], ['🛋️', 'Кухня + гостиная']];
// неделя — со среды 00:00 МСК по вторник; итоги и срок уборки — в её конце. Неделя 0 — с 21.10 (приложение — с 26.10)
const START = Date.UTC(2026, 9, 20, 21);
const WEEK = 7 * 864e5;
// уведомления — приложение ntfy, канал TOPIC
// ponytail: канал открыт всем, кто знает название (оно в коде); свой сервер ntfy с паролем, если начнут спамить
const TOPIC = 'socochka-fcbd86';
const SITE = 'https://berg-creator.github.io/socochka/';
const DB = 'https://socochka-default-rtdb.firebaseio.com';
// вся база без фото: ~photos сортируется после «~» и в выборку не попадает (ключи верхнего уровня — латиницей)
const ALL = DB + '/.json?orderBy="$key"&endAt="~"';
// уборка недели n просрочена, если ни сам, ни староста не отметили её до конца недели (среда 00:00 МСК) — минус LATE баллов
const LATE = 5;
// вынос мусора: один — 1 балл, вдвоём (with) — по 0,5 каждому
const trashPts = (o, p) => (o.by === p || o.with === p) / (o.with ? 2 : 1);
// не больше TRASH выносов в сутки (по Москве) на человека: вынос, где кто-то из двоих уже набрал TRASH, не засчитывается
const TRASH = 2, msk = ts => Math.floor((ts + 3 * 36e5) / 864e5);
function trashCap(list) {
  const n = {};
  return [...list].sort((a, b) => a.ts - b.ts).filter(o => {
    const k = [o.by, o.with].filter(Boolean).map(p => p + msk(o.ts));
    if (k.some(x => n[x] >= TRASH)) return false;
    k.forEach(x => n[x] = (n[x] || 0) + 1);
    return true;
  });
}
// оценка недели: среднее звёзд marks[n][кто][от кого]. Объект старосты оценивают все участники, остальные — один староста
const avg = m => { const v = Object.values(m || {}).filter(Number.isInteger); return v.length ? v.reduce((a, b) => a + b) / v.length : undefined; };
const due = n => START + (n + 1) * WEEK;
// уборка недели n — с понедельника 00:00 МСК (5 суток от её начала); до него у объектов ни цвета, ни статуса
const monday = n => START + n * WEEK + 5 * 864e5;
const late = (cleaned, accepted, p, n) => !(cleaned[n]?.[p] < due(n) || accepted[n]?.[p] < due(n));
// Перепоручение — обмен очередями, чтобы работы у всех было поровну.
// Объект: subs[n][чей объект] = {to, ts, ok}. A просит B убрать его объект в неделю n; B согласился (ok) — B убирает в n два объекта,
// а A в неделю n+1 убирает объект B (запись отработки subs[n+1][B] = {to: A, ok, back: n}, её пишет B вместе с согласием).
// Объект и его оценки, отметки, просрочки по-прежнему лежат под именем владельца по очереди, а засчитываются тому, кто убирает
// Староста: bossSubs[n] = {from, to, ts, ok}. Староста недели n отдаёт её B, а сам берёт ближайшую неделю B по очереди m (запись bossSubs[m] с back: n).
// База проверяет только, кто пишет; что запись складная (отработка ссылается на настоящий обмен) — проверяет fixSubs/fixBoss
function fixSubs(raw) {
  const ok = (n, p) => { const x = raw?.[n]?.[p]; return x && people.includes(p) && people.includes(x.to) && x.to !== p && typeof x.ts === 'number'; };
  const out = {};
  for (const n of Object.keys(raw || {})) for (const p of Object.keys(raw[n] || {})) {
    const x = raw[n][p];
    if (!ok(n, p) || x.back !== undefined && !(x.back === n - 1 && raw[x.back]?.[x.to]?.ok && raw[x.back][x.to].to === p)) continue;
    (out[n] ||= {})[p] = x;
  }
  return out;
}
// имя в винительном (за Мишу, за Максима) и родительном (объект Миши, вместо Максима) — для Миша/Паша/Максим/Карим
const vin = n => /а$/.test(n) ? n.slice(0, -1) + 'у' : n + 'а', rod = n => /а$/.test(n) ? n.slice(0, -1) + 'и' : n + 'а';
const nextBoss = (n, p) => { let m = n + 1; while (bosses[m % 4] !== p) m++; return m; };
function fixBoss(raw) {
  const out = {};
  for (const n of Object.keys(raw || {})) {
    const x = raw[n], k = +n;
    if (!x || !people.includes(x.to) || x.from !== bosses[k % 4] || x.to === x.from || typeof x.ts !== 'number') continue;
    if (x.back !== undefined && !(raw[x.back]?.ok && raw[x.back].to === x.from && raw[x.back].from === x.to && nextBoss(x.back, x.from) === k)) continue;
    out[n] = x;
  }
  return out;
}
// кто убирает объект владельца p в неделю n; какие объекты (по владельцу) убирает p; кто староста недели n
const cleaner = (subs, n, p) => subs?.[n]?.[p]?.ok ? subs[n][p].to : p;
const slots = (subs, n, p) => people.filter(q => cleaner(subs, n, q) === p);
const bossOf = (bs, n) => bs?.[n]?.ok ? bs[n].to : bosses[n % 4];
// оценка p за неделю n — средняя по объектам, которые он убирал (их может быть 0, 1 или 2)
const weekMark = (marks, subs, n, p) => { const v = slots(subs, n, p).map(q => avg(marks[n]?.[q])).filter(x => x !== undefined); return v.length ? v.reduce((a, b) => a + b) / v.length : undefined; };
// доброе дело: голос — время нажатия, «за» положительное, «против» — со знаком минус. Что раньше набрало два голоса,
// то и решило: два «за» — засчитано с момента второго, два «против» — отклонено (undefined). Иначе через сутки засчитывается
// само, голоса после этого не в счёт. Дела, отправленные до первых итогов (due(0)), сами не засчитываются — только двумя «за»
// Время засчитывания может быть в будущем — до него дело на проверке
const DEED = 1;
function deedAt(d) {
  const end = d.ts < due(0) ? Infinity : d.ts + DAY, n = {};
  for (const v of Object.values(d.votes || {}).sort((a, b) => Math.abs(a) - Math.abs(b))) {
    if (Math.abs(v) >= end) break;
    if ((n[v > 0] = (n[v > 0] || 0) + 1) === 2) return v > 0 ? v : undefined;
  }
  return end;
}
// бумага: когда стало «мало» (≤2), страница пишет paper.low, покупка переносит его в buys[].low. Староста недели n не купил
// за сутки с момента «мало» (или с начала своей недели, если мало стало раньше) — минус NOBUY баллов ему в эту неделю
const NOBUY = 1, DAY = 864e5;
const lows = (paper, buys) => [...buys.filter(b => b.low).map(b => [b.low, b.ts]), ...(paper?.low ? [[paper.low, Infinity]] : [])];
const nobuy = (lows, n, now = Date.now()) => lows.some(([a, b]) => Math.min(b, now, START + (n + 1) * WEEK) - Math.max(a, START + n * WEEK) > DAY);
// заявка: цену голосуют все участники, price[кто] — 1..5, цена — среднее голосов (без голосов — 0). Сделавший (done) сдаёт старосте,
// тот принимает (ok) — баллы в неделю приёма. Штрафную заявку должник делает без баллов: debt — её сдал тот, на ком долг (all — verdicts)
const reqPts = (r, p) => r.ok && r.done?.by === p ? Math.round((avg(r.price) || 0) * 10) / 10 : 0;
const debt = (all, r) => all.some(v => v.req === r && v.who.includes(r.done?.by));
// итоги недели n — в её конце, в среду 00:00 МСК: худший балл за неделю (weekMark — средняя оценка за объекты, которые убирал, с учётом обменов + trashPts за вынос мусора + DEED за доброе дело + reqPts за заявки − LATE за каждый просроченный объект − NOBUY старосте (bossOf) за бумагу)
// выполняет самую старую заявку, открытую на тот момент и не занятую прошлыми долгами; сделал её кто-то другой — долг переходит на следующую.
// Долг сдают до итогов следующей недели; не сдан — минус LATE в каждую неделю, на конце которой он ещё висит, и долг остаётся. Без оценки и просрочки — не участвует, ничья — делают вместе.
// Комментарии на балл не влияют; оценку после среды страница менять не даёт, чтобы итог не менялся задним числом
// Итоги всех недель по порядку: [{n, min, who, req, fines}], fines — [кто, заявка] за несданные к итогам недели n долги
const paid = v => v.req?.done && v.who.includes(v.req.done.by) ? v.req.done.ts : Infinity;
function verdicts(marks, requests, trashOut, cleaned, accepted, lw = [], deeds = [], subs = {}, bs = {}, now = Date.now()) {
  const all = [];
  for (let n = 0, at = due(0); at <= now; at = due(++n)) {
    const fines = all.filter(v => v.req && paid(v) >= at).flatMap(v => v.who.map(p => [p, v.req]));
    const score = people.flatMap(p => {
      const s = weekMark(marks, subs, n, p), b = bossOf(bs, n) === p && nobuy(lw, n, now);
      // итог первой недели подведён, когда вынос стоил 2 и по 1, — задним числом не меняем (в рейтинге за всё время — уже по-новому)
      const t = trashCap(trashOut).filter(o => Math.floor((o.ts - START) / WEEK) === n).reduce((a, o) => a + trashPts(o, p) * (o.ts < due(0) ? 2 : 1), 0), l = slots(subs, n, p).filter(q => late(cleaned, accepted, q, n)).length;
      const g = deeds.filter(d => d.by === p && Math.floor((deedAt(d) - START) / WEEK) === n).length * DEED;
      const q = requests.filter(r => Math.floor((r.ok - START) / WEEK) === n && !debt(all, r)).reduce((a, r) => a + reqPts(r, p), 0);
      const o = fines.filter(f => f[0] === p).length;
      return s || l || b || o ? [[p, Math.round(((s || 0) + t + g + q - (l + o) * LATE - b * NOBUY) * 100) / 100]] : [];
    });
    const min = Math.min(...score.map(x => x[1])), who = score.filter(x => x[1] === min).map(x => x[0]);
    all.push({n, min, who, fines, req: who.length ? requests.filter(r => r.ts < at && !all.some(v => v.req === r) && (!r.done || r.done.ts >= at && who.includes(r.done.by))).sort((a, b) => a.ts - b.ts)[0] : undefined});
  }
  return all;
}
const verdict = (...a) => verdicts(...a).at(-1) || {n: -1, min: Infinity, who: [], fines: []};
if (typeof module === 'object') module.exports = {people, bosses, fixSubs, fixBoss, nextBoss, vin, rod, cleaner, slots, bossOf, weekMark, objects, START, WEEK, TOPIC, SITE, DB, ALL, LATE, DEED, NOBUY, DAY, TRASH, trashPts, trashCap, avg, due, monday, late, deedAt, reqPts, debt, lows, nobuy, paid, verdicts, verdict};
