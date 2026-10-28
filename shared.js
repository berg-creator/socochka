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
// вынос мусора: один — 1 балл, вдвоём (with) — по 0,5 каждому. До первых итогов (due(0)) было 2 и по 1 — старые выносы считаются по-старому
const trashPts = (o, p) => (o.by === p || o.with === p) * (o.ts < due(0) ? 2 : 1) / (o.with ? 2 : 1);
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
// итоги недели n — в её конце, в среду 00:00 МСК: худший балл за неделю (средняя оценка avg(marks[n][кто]) + trashPts за вынос мусора + DEED за доброе дело − LATE за просрочку − NOBUY старосте за бумагу)
// выполняет самую старую заявку, открытую на тот момент. Без оценки и просрочки — не участвует, ничья — делают вместе.
// Комментарии на балл не влияют; оценку после среды страница менять не даёт, чтобы итог не менялся задним числом
function verdict(marks, requests, trashOut, cleaned, accepted, lw = [], deeds = [], now = Date.now()) {
  const n = Math.floor((now - due(0)) / WEEK), at = due(n);
  const score = n < 0 ? [] : people.flatMap(p => { // n < 0 — до первой среды недели ещё нет
    const s = avg(marks[n]?.[p]), b = bosses[n % 4] === p && nobuy(lw, n, now);
    const t = trashCap(trashOut).filter(o => Math.floor((o.ts - START) / WEEK) === n).reduce((a, o) => a + trashPts(o, p), 0), l = late(cleaned, accepted, p, n);
    const g = deeds.filter(d => d.by === p && Math.floor((deedAt(d) - START) / WEEK) === n).length * DEED;
    return s || l || b ? [[p, Math.round(((s || 0) + t + g - l * LATE - b * NOBUY) * 100) / 100]] : [];
  });
  const min = Math.min(...score.map(x => x[1]));
  return {n, min, who: score.filter(x => x[1] === min).map(x => x[0]),
    req: requests.filter(r => r.ts < at && !(r.done?.ts < at)).sort((a, b) => a.ts - b.ts)[0]};
}
if (typeof module === 'object') module.exports = {people, bosses, objects, START, WEEK, TOPIC, SITE, DB, ALL, LATE, DEED, NOBUY, DAY, TRASH, trashPts, trashCap, avg, due, monday, late, deedAt, lows, nobuy, verdict};
