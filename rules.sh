#!/bin/sh
# Правила базы: ./rules.sh test — прогнать rules-test.mjs в локальном эмуляторе; ./rules.sh — прогнать и, если всё прошло, выложить в Firebase.
# Нужно (на виртуалке уже стоит): firebase-tools (~/.local/bin/firebase, вход — firebase login) и Java для эмулятора
cd "$(dirname "$0")"
fb=$(command -v firebase || echo "$HOME/.local/bin/firebase")
out=$("$fb" emulators:exec --only database --project demo-socochka "node rules-test.mjs" 2>&1); code=$?
rm -f firebase-debug.log database-debug.log
echo "$out" | grep -E '^(OK|FAIL)|провер|ПРОВАЛ'
[ $code -eq 0 ] || { echo 'тест правил не прошёл — не выкладываю' >&2; exit 1; }
[ "$1" = test ] || "$fb" deploy --only database
