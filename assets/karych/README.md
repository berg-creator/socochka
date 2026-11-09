# Модели «Карыч: Доставка»

Персонажи — Quaternius, **Ultimate Animated Character Pack** (ноябрь 2019), лицензия **CC0 1.0** (public domain),
https://quaternius.com/packs/ultimatedanimatedcharacter.html (License.txt в паке: CC0 1.0 Universal).

| файл | исходник | кто в игре |
|---|---|---|
| kar.glb | Casual_Male.gltf + клипы Idle, Run, Jump, Roll, Death, RecieveHit, Victory, Walk | Карыч |
| baba.glb | Doctor_Female_Old.gltf (без клипов) | бабушка |
| king.glb | Wizard.gltf (без клипов, шляпа прячется в коде) | Жёлтый Король |
| dimon.glb | Casual_Bald.gltf (без клипов) | Димон |

Скелет у всех одинаковый, поэтому клипы хранятся только в kar.glb — game.js проигрывает их на всех.
Цвета, кепка, сумка, платок, корона, плащ, скипетр, цепь — в коде (game.js).

Сборка (node 22+, `npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer`):

    node build.mjs Casual_Male.gltf kar.glb Idle,Run,Jump,Roll,Death,RecieveHit,Victory,Walk
    node build.mjs Doctor_Female_Old.gltf baba.glb

Поменял модели — подними `MV` в game.js.
