# Ассеты v2

В игре используются бесплатные ассеты CraftPix (лицензия Free / attribution not required, см. `res/*/license.txt`).

## Что подключено

- `game/assets/portraits/` — портреты NPC и игрока: SWAT dialogue portraits, Prototype dialogue portraits, Schoolgirl sprite pack.
- `game/assets/portraits/player_*.png` — 7 PNG-лиц по целостности + ломка + соль-13 (Prototype dialogue portraits).
- `game/assets/icons/` — иконки медицины, патронов, ресурсов, снаряжения, одежды и ближнего боя (Post-Apocalypse 512×512). Явные соответствия — в `items.js` и `docs/TERMINALS.md`.
- `game/assets/sprites/player_*.png` — спрайт-листы прототипа героя (idle/run/aim/hurt/dead).
- `game/assets/sprites/zombie*.png` — 4 зомби (walk/attack/dead/idle).
- `game/assets/sprites/girl_idle.png` — Ася.

## Где используются

- Инвентарь и торговля — иконки предметов.
- Портрет героя в инвентаре и паузе — PNG по HP, ломке и действию соли-13.
- Патроны: пачка при 15+ шт., одиночный патрон при <15 шт.
- STALKER-диалоги — портреты.
- Бой — спрайты зомби для врагов без отрубленных конечностей; с конечностями остаётся процедурная расчленёнка.
- Катсцены — спрайты героя, зомби и Аси на фоне сцены.
- Земля — иконки предметов.

## Правила

- Не переименовывать исходные папки `res/` без необходимости.
- Новые ассеты класть в `game/assets/<категория>/` и подключать через `game/js/assets.js`.
- Для APK используется только `game/assets`, папка `res` в сборку не входит.
