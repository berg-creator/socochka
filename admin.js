// Админка: грузится из index.html только у админа (вкладка «🔑 Админ»), рисуется в #my и сама следит, чтобы живое обновление
// данных не стирало то, что вводится. Пишет в базу от аккаунта админа: правила дают ему запись везде, пока жива сессия (~admin/uid).
// Пользуется общим со страницей: DB, idToken, load, raw (последняя выборка), people/members/bosses/objects, adj, esc, stamp, logOut
const A = {built: false, draft: null, dirty: false, timer: 0};
const aId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// запрос к базе от админа; путь — сегменты через «/», каждый кодируем (имена русские)
async function aSend(path, method, body) {
  const url = `${DB}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}.json?auth=${await idToken()}`;
  const r = await fetch(url, {method, body: body === undefined ? undefined : JSON.stringify(body)}).catch(() => null);
  if (!r?.ok) { alert(r?.status === 401 ? 'Нет прав: сессия админа кончилась или правила базы не пускают такие данные' : 'Не отправилось, попробуй ещё раз'); return null; }
  return r.json();
}

function admin() {
  if (!isAdmin()) return;
  if (!A.built || !$('aRoot')) build();
  $('aSess').innerHTML = `Сессия до <b>${new Date(tok.until).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</b> · <button class="link" id="aOut">выйти</button>`;
  $('aOut').onclick = () => { logOut(); location.hash = 'clean'; };
  renderBonus();
  if (!A.dirty) { A.draft = null; renderCfg(); }
  // сессия кончилась — страница сама выйдет из админа
  A.timer ||= setInterval(() => { if (!isAdmin()) { clearInterval(A.timer); A.timer = 0; render(); } }, 3e4);
}

function build() {
  A.built = true;
  $('my').innerHTML = `<div id="aRoot">
<p class="muted small" id="aSess"></p>
<div class="jump"><button data-jump="aPts">⚖️ Баллы</button><button data-jump="aPpl">👥 Состав</button><button data-jump="aDb">🗂 База</button></div>
<h2 id="aPts">⚖️ Баллы вручную</h2>
<form id="aBonus" class="row"><div class="two"><select name="who" required aria-label="Кому"></select><input name="pts" type="number" step="0.1" required placeholder="+2 или -1.5" aria-label="Баллы"></div>
<input name="why" maxlength="200" required placeholder="За что (увидят в истории баллов)" aria-label="За что"><button>Начислить</button></form>
<div id="aBonusList"></div>
<h2 id="aPpl">👥 Состав и объекты</h2>
<div id="aCfg"></div>
<h2 id="aDb">🗂 База целиком</h2>
<p class="muted small hint">Любой узел: путь вроде <b>marks/3</b>, <b>requests</b>, <b>paper</b>; пусто — вся база без фото. Правила базы проверяют и данные админа (например, оценка — от 1 до 5)</p>
<form id="aRaw" class="row"><input name="path" placeholder="Путь (пусто — вся база)" aria-label="Путь" autocapitalize="off">
<div class="ctl"><button value="get">Открыть</button><button value="put">Сохранить</button><button value="del">Удалить</button></div>
<textarea name="json" rows="14" spellcheck="false" style="font:12px/1.4 ui-monospace,monospace" aria-label="JSON"></textarea></form>
</div>`;

  $('aBonus').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, pts = Math.round(+f.pts.value * 10) / 10;
    if (!pts) return alert('Баллы — не ноль: плюс — дать, минус — снять');
    if (await aSend(`bonus/${aId()}`, 'PUT', {who: f.who.value, pts, why: f.why.value.trim(), ts: {'.sv': 'timestamp'}})) { f.reset(); load(); }
  };
  $('aBonusList').onclick = async e => {
    const b = e.target.closest('[data-unbonus]');
    if (b && confirm('Отменить эти баллы?') && await aSend(`bonus/${b.dataset.unbonus}`, 'DELETE')) load();
  };

  $('aRaw').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, path = f.path.value.trim().replace(/^\/+|\/+$/g, ''), act = e.submitter?.value;
    if (act === 'get') {
      const r = path ? await aSend(path, 'GET') : await fetch(ALL).then(x => x.json()).catch(() => null);
      if (r !== null || path) f.json.value = JSON.stringify(r, null, 2);
      return;
    }
    if (!path && !confirm('Путь пустой — это вся база. Уверен?')) return;
    if (act === 'del') { if (confirm(`Удалить «${path || 'всю базу'}» насовсем?`) && await aSend(path, 'DELETE') !== null) { f.json.value = ''; load(); } return; }
    let v; try { v = JSON.parse(f.json.value); } catch (x) { return alert('Это не JSON: ' + x.message); }
    if (confirm(`Записать в «${path || 'корень'}» — заменить то, что там было?`) && await aSend(path, 'PUT', v) !== null) load();
  };
  $('aCfg').addEventListener('input', () => { A.dirty = true; });
  $('aCfg').addEventListener('click', cfgClick);
}

function renderBonus() {
  const f = $('aBonus'), v = f.who.value;
  f.who.innerHTML = people.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (people.includes(v)) f.who.value = v;
  const list = Object.entries(raw.bonus || {}).filter(([, x]) => x?.who).sort((a, b) => b[1].ts - a[1].ts);
  $('aBonusList').innerHTML = list.map(([id, x]) => `<div class="row head"><span class="icon">⚖️</span><div class="grow"><div class="name">${esc(x.who)}: ${x.pts > 0 ? '+' : '−'}${Math.abs(x.pts)}</div><div class="muted small">${esc(x.why)} · ${stamp(x.ts)}</div></div><button class="del" data-unbonus="${esc(id)}" title="Отменить">🗑</button></div>`).join('')
    + PENALTIES.map(([who, ts, n, why]) => `<div class="row head done"><span class="icon">⚖️</span><div class="grow"><div class="name">${esc(who)}: −${n}</div><div class="muted small">${esc(why)} · ${stamp(ts)} · записан в коде</div></div></div>`).join('');
}

// состав: черновик правится на месте, «Сохранить» пишет cfg и logins разом
function renderCfg() {
  const d = A.draft ||= {
    people: [...people], guests: members.filter(p => !people.includes(p)), bosses: [...bosses], objects: objects.map(o => [...o]),
    logins: Object.fromEntries(Object.entries(raw.logins || {}).map(([k, v]) => [v, k])),
  };
  const mv = (list, i) => `<button type="button" class="del" data-mv="${list}" data-i="${i}" data-d="-1" title="Выше"${i ? '' : ' disabled'}>↑</button><button type="button" class="del" data-mv="${list}" data-i="${i}" data-d="1" title="Ниже">↓</button>`;
  const person = (list, p, i) => `<div class="head"><input data-name="${list}" data-i="${i}" value="${esc(p)}" maxlength="20" aria-label="Имя" style="flex:1">`
    + `<input data-login="${list}" data-i="${i}" value="${esc(d.logins[p] || '')}" placeholder="логин" maxlength="30" aria-label="Логин" style="width:30%" autocapitalize="off">`
    + `${list === 'people' ? mv(list, i) : ''}<button type="button" class="del" data-reset="${list}" data-i="${i}" title="Сбросить пароль: при следующем входе придумает новый">🔄</button><button type="button" class="del" data-rm="${list}" data-i="${i}" title="Убрать">✕</button></div>`;
  $('aCfg').innerHTML = `<div class="row" style="display:grid;gap:6px">
<h3 style="margin:0">Убирают — по очереди объектов</h3>${d.people.map((p, i) => person('people', p, i)).join('')}
<button type="button" class="link" data-add="people">＋ Добавить, кто убирает</button>
<h3 style="margin:8px 0 0">Не убирают, но голосуют и оценивают</h3>${d.guests.map((p, i) => person('guests', p, i)).join('') || '<span class="muted small">никого</span>'}
<button type="button" class="link" data-add="guests">＋ Добавить</button>
<h3 style="margin:8px 0 0">Объекты уборки — столько же, сколько убирающих</h3>${d.objects.map(([e, n], i) => `<div class="head"><input data-oe="${i}" value="${esc(e)}" maxlength="4" aria-label="Значок" style="width:56px;text-align:center"><input data-on="${i}" value="${esc(n)}" maxlength="40" aria-label="Объект" style="flex:1">${mv('objects', i)}<button type="button" class="del" data-rm="objects" data-i="${i}" title="Убрать">✕</button></div>`).join('')}
<button type="button" class="link" data-add="objects">＋ Добавить объект</button>
<h3 style="margin:8px 0 0">Очередь старост</h3>${d.bosses.filter(p => d.people.includes(p)).map((p, i) => `<div class="head"><span class="grow">${i + 1}. ${esc(p)}</span>${mv('bosses', i)}</div>`).join('')}
<p class="muted small">Логин — латиницей, по нему входят (почта логин@socochka.app). 🔄 — забыл пароль: логин меняется, при следующем входе человек придумает новый пароль.
Осторожно: история считается по текущему составу — убранный человек пропадёт из рейтинга, а смена очередей переставит объекты и старост и в прошлых неделях.</p>
<div class="two"><button type="button" data-cfg="reset">Отменить правки</button><button type="button" data-cfg="save">Сохранить состав</button></div></div>`;
}

function readCfg() {
  const d = A.draft, q = s => [...$('aCfg').querySelectorAll(s)];
  const names = {people: [...d.people], guests: [...d.guests]}, logins = {};
  q('[data-name]').forEach(el => { const l = el.dataset.name, i = +el.dataset.i, old = d[l][i], nw = el.value.trim(); names[l][i] = nw; if (old !== nw) d.bosses = d.bosses.map(b => b === old ? nw : b); });
  q('[data-login]').forEach(el => { logins[names[el.dataset.login][+el.dataset.i]] = el.value.trim().toLowerCase(); });
  d.people = names.people; d.guests = names.guests; d.logins = logins;
  d.objects = d.objects.map((o, i) => [$('aCfg').querySelector(`[data-oe="${i}"]`)?.value.trim() || '🧹', $('aCfg').querySelector(`[data-on="${i}"]`)?.value.trim() || '']);
  d.bosses = [...d.bosses.filter(p => d.people.includes(p)), ...d.people.filter(p => !d.bosses.includes(p))];
}

async function cfgClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const d = A.draft, x = b.dataset;
  if (x.cfg === 'reset') { A.dirty = false; A.draft = null; return renderCfg(); }
  readCfg(); A.dirty = true;
  if (x.add) d[x.add].push(x.add === 'objects' ? ['🧹', ''] : '');
  if (x.rm) { const [gone] = d[x.rm].splice(+x.i, 1); if (x.rm === 'people') d.bosses = d.bosses.filter(p => p !== gone); }
  if (x.mv) { const l = x.mv === 'bosses' ? d.bosses : d[x.mv], i = +x.i, j = i + +x.d; if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]]; }
  if (x.reset) { const p = d[x.reset][+x.i], l = d.logins[p]; if (l && confirm(`${p} придумает новый пароль при следующем входе. Сбросить?`)) d.logins[p] = l.replace(/\d+$/, '') + Math.floor(Math.random() * 900 + 100); }
  if (x.cfg === 'save') return saveCfg();
  renderCfg();
}

async function saveCfg() {
  const d = A.draft, all = [...d.people, ...d.guests], err = [];
  if (!d.people.length) err.push('нужен хотя бы один, кто убирает');
  if (all.some(p => !p || /[.#$\[\]\/]/.test(p))) err.push('имена не пустые и без . # $ [ ] /');
  if (new Set(all).size !== all.length) err.push('имена не должны повторяться');
  if (all.some(p => !/^[a-z0-9-]{2,30}$/.test(d.logins[p] || ''))) err.push('у каждого логин латиницей: буквы, цифры, дефис');
  if (new Set(all.map(p => d.logins[p])).size !== all.length) err.push('логины не должны повторяться');
  if (d.objects.length !== d.people.length) err.push(`объектов ${d.objects.length}, а убирающих ${d.people.length} — должно быть поровну`);
  if (d.objects.some(o => !o[1])) err.push('у каждого объекта название');
  if (err.length) return alert('Не сохранил:\n— ' + err.join('\n— '));
  const gone = [...people, ...members].filter(p => !all.includes(p));
  if (!confirm('Сохранить состав?' + (gone.length ? `\nУйдут из приложения: ${[...new Set(gone)].join(', ')} — их баллы пропадут из рейтинга` : ''))) return;
  const ord = l => Object.fromEntries(l.map((p, i) => [p, i]));
  const cfg = {people: ord(d.people), guests: ord(d.guests), bosses: ord(d.bosses), objects: d.objects};
  if (await aSend('', 'PATCH', {cfg, logins: Object.fromEntries(all.map(p => [d.logins[p], p]))}) !== null) { A.dirty = false; A.draft = null; await load(); }
}
