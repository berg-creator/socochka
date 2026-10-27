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
// уборка недели n просрочена, если ни сам, ни староста не отметили её до среды 03:00 МСК (вс + 2 суток) — минус LATE баллов
const LATE = 5;
// вынос мусора: один — 2 балла, вдвоём (with) — по 1 каждому
const trashPts = (o, p) => o.by === p ? (o.with ? 1 : 2) : o.with === p ? 1 : 0;
const due = n => START + n * WEEK + 9 * 864e5;
const late = (cleaned, accepted, p, n) => !(cleaned[n]?.[p] < due(n) || accepted[n]?.[p] < due(n));
// итоги недели n — в среду следующей: худший балл за неделю (оценка старосты marks[n][кто] + trashPts за вынос мусора − LATE за просрочку)
// выполняет самую старую заявку, открытую на тот момент. Без оценки и просрочки — не участвует, ничья — делают вместе.
// Комментарии на балл не влияют; оценку после среды страница менять не даёт, чтобы итог не менялся задним числом
function verdict(marks, requests, trashOut, cleaned, accepted, now = Date.now()) {
  const n = Math.floor((now - due(0)) / WEEK), at = due(n);
  const score = n < 0 ? [] : people.flatMap(p => { // n < 0 — до первой среды недели ещё нет
    const s = marks[n]?.[p];
    const t = trashOut.filter(o => Math.floor((o.ts - START) / WEEK) === n).reduce((a, o) => a + trashPts(o, p), 0), l = late(cleaned, accepted, p, n);
    return s || l ? [[p, Math.round(((s || 0) + t - l * LATE) * 100) / 100]] : [];
  });
  const min = Math.min(...score.map(x => x[1]));
  return {n, min, who: score.filter(x => x[1] === min).map(x => x[0]),
    req: requests.filter(r => r.ts < at && !(r.done?.ts < at)).sort((a, b) => a.ts - b.ts)[0]};
}
if (typeof module === 'object') module.exports = {people, bosses, objects, START, WEEK, TOPIC, SITE, DB, LATE, trashPts, due, late, verdict};
