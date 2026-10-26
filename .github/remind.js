// Еженедельное напоминание в ntfy: кто староста и кто что убирает (график — как на странице)
const {people, bosses, objects, START, WEEK, TOPIC, SITE} = require('../shared.js');
const mod = n => (n % 4 + 4) % 4, w = Math.floor((Date.now() - START) / WEEK);
const message = `👑 Староста: ${bosses[mod(w)]}\n` + people.map((p, i) => `${objects[mod(i - w)].join(' ')} — ${p}`).join('\n');
fetch('https://ntfy.sh/', {method: 'POST', body: JSON.stringify({topic: TOPIC, title: '🧹 Новая неделя уборки', message, click: SITE + '#clean'})})
  .then(r => { if (!r.ok) throw r.status; });
