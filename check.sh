#!/bin/sh
# Проверка перед коммитом (ставится хуком: .git/hooks/pre-commit вызывает этот файл): страница открывается
# в невидимом Chrome на живой базе и должна отрисоваться — вкладка выбрана, неделя и рейтинг заполнены.
# Не отрисовалась — в скрипте ошибка, коммит отклоняется
cd "$(dirname "$0")"
# свой временный профиль — иначе headless цепляется к уже открытому Chrome и висит; живое обновление (EventSource)
# не даёт странице «успокоиться», поэтому без --virtual-time-budget, а с жёстким пределом по времени
tmp=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --user-data-dir="$tmp" --timeout=6000 --dump-dom "file://$PWD/index.html" > "$tmp/dom" 2>/dev/null &
pid=$!; ( sleep 20; kill $pid 2>/dev/null ) & wait $pid; dom=$(cat "$tmp/dom"); rm -rf "$tmp"
echo "$dom" | grep -q 'class="on"' && echo "$dom" | grep -q 'id="week"><b>' && echo "$dom" | grep -q 'class="row hist"' && exit 0
echo "check.sh: страница не отрисовалась — в скрипте ошибка. Открой index.html в браузере и посмотри консоль" >&2
exit 1
