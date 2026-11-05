# AGENT_SKILL_GAME.md — правила работы над «Ржавой Бочкой»

Читать до любых правок. Коротко и по делу.

## 1. Проект

- **Мобильный** хоррор-выживание сверху (ландшафт). WebView + HTML5 Canvas.
- **21+**: кровь, расчленёнка, телесный ужас, вещества с побочками.
- Мир **оригинальный**: остров Крутой, ВИК, соль-13, смена, культ «Братья Тихого берега». Вдохновлён тоном КОНТУР, но **не та вселенная**: никаких К.О.Н.Т.У.Р., ОНТ, «допусков», масок █, чисел 41/922.
- Корень: `D:\megaGame`. Игра: `game/`, Android: `android/`, инструменты: `tools/`.
- SDK: `D:\Android\sdk` (platform 34, build-tools **35.0.1**), JDK 24 (`javac --release 17`). Сборка APK — `tools/build-apk.ps1`, без Gradle.

## 2. Документы мира (источник правды)

`ЛОР.md`, `ПРЕДЫСТОРИЯ.md`, `СЮЖЕТ.md`, `Сюжетные квесты.md`, `ДОПОЛНИТЕЛЬНЫЕ_КВЕСТЫ.md`, `МИНИ-ИГРЫ.md`, `NPC/*.md`.

Код обязан соответствовать докам. Меняешь сюжет — сначала правишь доки, потом `story.js`.

## 3. Roadmap

`roadmap.json` — единственный список задач. Правила:
1. Прочитать, взять `current`.
2. Поставить `in_progress` (до двух задач одновременно).
3. `prompt` — самодостаточный, с файлами и ограничениями.
4. Готово → `done`, обновить `current`/`next`/`updated`.
5. Новое — новый id (`T36`…), старое не удалять.
6. `blocked` — с причиной в `note`.

## 4. Цикл

`roadmap → in_progress → код → проверка → done → следующий prompt`

Definition of Done:
- [ ] `node --check` для всех изменённых js.
- [ ] `node tools/test-gen.mjs` — PASS (связность, NPC, детерминизм).
- [ ] `node tools/test-story.mjs` — PASS (8 NPC, 8 мини-игр, 4 концовки).
- [ ] Игра запускается в headless Edge без ошибок (title не содержит `ERR`).
- [ ] Мобильные 360×640 и 800×360: ничего не перекрыто, кнопки ≥ 48 px.
- [ ] Если менялся Android — APK собирается, `apksigner verify` ок.
- [ ] `roadmap.json` обновлён.

## 5. Архитектура

Порядок скриптов:
`util → audio → input → gen → story → minigames → entities → render → ui → game → main`

- Только классические скрипты, всё в `window.RB`. Никаких ES-модулей и CDN.
- Ассетов нет: графика рисуется, звук синтезируется.
- Случайность уровней — только `RB.mulberry32(seed)`. `Math.random` в генераторе запрещён.
- Тайл 48 px. Коллизии — `World.moveEntity`, путь — BFS.
- NPC — объекты `kind:'npc'` с `npcId`; данные в `RB.Story.npcs`.
- Мини-игры — `RB.Minigames.start(type, cb)`; типы: stamp, radio, wires, shells, count, hor, pipes, xray.
- Флаги прохождения — `game.flags` (сохраняются в `rb_save`), гейтят концовки.
- Концовки: `horror`, `salt`, `embargo`, `quiet`; условия в `RB.Story.endings[].requires`.

## 6. Правила контента

- Русский язык, канцелярский ужас, без мата.
- 21+ уместен, но не ради шока: кровь/гибы — стилизация, не фотореализм.
- Культ — люди, а не зомби: вежливые, убеждённые, страшные.
- Не объяснять всё: соль, смена и Ася должны оставаться немного непонятными.
- Мобильный приоритет: dt-кламп, dpr ≤ 2, кэш статики, без тяжёлых аллокаций в кадре.

## 7. Команды

```powershell
node --check game/js/game.js
node tools/test-gen.mjs
node tools/test-story.mjs
powershell -ExecutionPolicy Bypass -File tools/build-apk.ps1
D:\Android\sdk\platform-tools\adb.exe install -r build\rustybarrel-debug.apk
```

Отладка: `game/index.html?play=1&ch=2&seed=777&dbg=npc|choice|mg:stamp`.

## 8. Передача смены

В конце ответа: статусы задач, следующий prompt (и в roadmap), известные риски. Кратко.
