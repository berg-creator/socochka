// Ежедневное напоминание про мусор в ntfy; молчит, если вынесли за последние 12 часов
const {TOPIC, SITE, DB} = require('../shared.js');
(async () => {
  const t = await (await fetch(DB + '/trash.json')).json();
  if (t && !t.full && Date.now() - t.ts < 12 * 36e5) return;
  const message = t?.full ? `Мусорка переполнена (отметил ${t.by}) — кто вынесет: один +1 балл, вдвоём по +0,5` : 'Проверь мусорку и вынеси, если пора';
  const r = await fetch('https://ntfy.sh/', {method: 'POST', body: JSON.stringify({topic: TOPIC, title: '🗑 Мусор', message, click: SITE + '#home'})});
  if (!r.ok) throw r.status;
})();
