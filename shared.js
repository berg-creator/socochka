// Общее для страницы и напоминаний (.github/remind.js, .github/trash.js)
const people = ['Миша', 'Паша', 'Максим', 'Карим']; // убирают
const members = [...people, 'Катя']; // все на сайте: Катя не убирает, но оценивает, голосует, пишет заявки
const bosses = ['Максим', 'Паша', 'Карим', 'Миша']; // староста по очереди, начиная с этой недели
const objects =[['🧽', 'Поверхности'], ['🚪', 'Коридор'], ['🚽', 'Туалет'], ['🛋️', 'Кухня + гостиная']];
const START = Date.UTC(2026, 9, 26); // понедельник, с которого действует график выше
const WEEK = 7 * 864e5;
// уведомления — приложение ntfy, канал TOPIC
// ponytail: канал открыт всем, кто знает название (оно в коде); свой сервер ntfy с паролем, если начнут спамить
const TOPIC = 'socochka-fcbd86';
const SITE = 'https://berg-creator.github.io/socochka/';
const DB = 'https://socochka-default-rtdb.firebaseio.com';
// вся база без фото: ~photos сортируется после «~» и в выборку не попадает (ключи верхнего уровня — латиницей)
const ALL = DB + '/.json?orderBy="$key"&endAt="~"';
// уборка недели n просрочена, если ни сам, ни староста не отметили её до среды 03:00 МСК (вс + 2 суток) — минус LATE баллов
const LATE = 5;
// вынос мусора: один — 2 балла, вдвоём (with) — по 1 каждому
const trashPts = (o, p) => o.by === p ? (o.with ? 1 : 2) : o.with === p ? 1 : 0;
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
const due = n => START + n * WEEK + 9 * 864e5;
const late = (cleaned, accepted, p, n) => !(cleaned[n]?.[p] < due(n) || accepted[n]?.[p] < due(n));
// доброе дело засчитано вторым голосом «за» (голос — время нажатия): с этого момента автору +DEED
const DEED = 1;
const deedAt = d => Object.values(d.votes || {}).sort((a, b) => a - b)[1];
// бумага: когда стало «мало» (≤2), страница пишет paper.low, покупка переносит его в buys[].low. Староста недели n не купил
// за сутки с момента «мало» (или с начала своей недели, если мало стало раньше) — минус NOBUY баллов ему в эту неделю
const NOBUY = 1, DAY = 864e5;
const lows = (paper, buys) => [...buys.filter(b => b.low).map(b => [b.low, b.ts]), ...(paper?.low ? [[paper.low, Infinity]] : [])];
const nobuy = (lows, n, now = Date.now()) => lows.some(([a, b]) => Math.min(b, now, START + (n + 1) * WEEK) - Math.max(a, START + n * WEEK) > DAY);
// итоги недели n — в среду следующей: худший балл за неделю (оценка старосты marks[n][кто] + trashPts за вынос мусора + DEED за доброе дело − LATE за просрочку − NOBUY старосте за бумагу)
// выполняет самую старую заявку, открытую на тот момент. Без оценки и просрочки — не участвует, ничья — делают вместе.
// Комментарии на балл не влияют; оценку после среды страница менять не даёт, чтобы итог не менялся задним числом
function verdict(marks, requests, trashOut, cleaned, accepted, lw = [], deeds = [], now = Date.now()) {
  const n = Math.floor((now - due(0)) / WEEK), at = due(n);
  const score = n < 0 ? [] : people.flatMap(p => { // n < 0 — до первой среды недели ещё нет
    const s = marks[n]?.[p], b = bosses[n % 4] === p && nobuy(lw, n, now);
    const t = trashCap(trashOut).filter(o => Math.floor((o.ts - START) / WEEK) === n).reduce((a, o) => a + trashPts(o, p), 0), l = late(cleaned, accepted, p, n);
    const g = deeds.filter(d => d.by === p && Math.floor((deedAt(d) - START) / WEEK) === n).length * DEED;
    return s || l || b ? [[p, Math.round(((s || 0) + t + g - l * LATE - b * NOBUY) * 100) / 100]] : [];
  });
  const min = Math.min(...score.map(x => x[1]));
  return {n, min, who: score.filter(x => x[1] === min).map(x => x[0]),
    req: requests.filter(r => r.ts < at && !(r.done?.ts < at)).sort((a, b) => a.ts - b.ts)[0]};
}
if (typeof module === 'object') module.exports = {people, bosses, objects, START, WEEK, TOPIC, SITE, DB, ALL, LATE, DEED, NOBUY, DAY, TRASH, trashPts, trashCap, due, late, deedAt, lows, nobuy, verdict};
