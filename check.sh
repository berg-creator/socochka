#!/bin/sh
# Проверка перед коммитом: страница открывается в невидимом Chrome на живой базе и должна отрисоваться без ошибок (check.mjs).
# Хук ставится один раз: ./check.sh install — дальше .git/hooks/pre-commit вызывает этот файл; не прошла — коммит отклоняется
cd "$(dirname "$0")"
if [ "$1" = install ]; then printf '#!/bin/sh\nexec "$(git rev-parse --show-toplevel)/check.sh"\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit && echo 'хук pre-commit поставлен'; exit; fi
exec node check.mjs
