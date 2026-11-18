#!/bin/sh
# Ставит (и обновляет) сервис админки на виртуалке: vm/admind.mjs → ~/.local/share/socochka-admin, служба systemd --user
# socochka-admin (живёт без входа в систему: linger). Лог: journalctl --user -u socochka-admin -f
# Нужно: node 22+ и firebase CLI с входом владельца проекта (firebase login) — через его токен сервис пишет в базу
set -e
cd "$(dirname "$0")/.."
D="$HOME/.local/share/socochka-admin"
mkdir -p "$D" "$HOME/.config/systemd/user"
cp vm/admind.mjs "$D/"
cat > "$HOME/.config/systemd/user/socochka-admin.service" <<UNIT
[Unit]
Description=Соцочка: коды дня и вход админа
After=network-online.target

[Service]
ExecStart=/usr/bin/node %h/.local/share/socochka-admin/admind.mjs
Restart=always
RestartSec=10
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable -q socochka-admin
systemctl --user restart socochka-admin
echo 'сервис админки запущен: journalctl --user -u socochka-admin -f'
