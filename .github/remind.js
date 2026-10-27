// Напоминания в ntfy (график и итоги — как на странице): в среду 00:00 МСК — итоги прошедшей недели, в понедельник 00:00 — началась уборка, кто что убирает
const {people, bosses, objects, START, WEEK, TOPIC, SITE, ALL, lows, verdict, monday} = require('../shared.js');
const send = (title, message, tab) => fetch('https://ntfy.sh/', {method: 'POST', body: JSON.stringify({topic: TOPIC, title, message, click: SITE + '#' + tab})})
  .then(r => { if (!r.ok) throw r.status; });
const mod = n => (n % 4 + 4) % 4, w = Math.floor((Date.now() - START) / WEEK);
if (Date.now() >= monday(w)) send('🧹 Уборка началась', `Сдать до среды 00:00\n👑 Староста: ${bosses[mod(w)]}\n` + people.map((p, i) => `${objects[mod(i - w)].join(' ')} — ${p}`).join('\n'), 'clean');
else fetch(ALL).then(r => r.json()).then(d => {
  const v = verdict(d?.marks || {}, Object.values(d?.requests || {}), Object.values(d?.trashOut || {}), d?.cleaned || {}, d?.accepted || {}, lows(d?.paper, Object.values(d?.buys || {})), Object.values(d?.deeds || {}));
  if (v.n < 0) return;
  return send('⚖️ Итоги недели', !v.who.length ? 'Оценок и просрочек за неделю не было — без штрафа'
    : `👎 Худший рейтинг: ${v.who.join(' и ')} (${v.min.toFixed(1)} ★)\n` + (v.req ? `🔧 Выполняет заявку: ${v.req.text}` : 'Открытых заявок нет — повезло'), 'clean');
});
