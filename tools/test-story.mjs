/* Проверка сюжетных данных: NPC, квесты, концовки.
   Запуск: node tools/test-story.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(process.cwd());
const sandbox = { console, Math, JSON, Uint8Array, Int32Array, isFinite, Date, performance: { now: () => Date.now() }, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['game/js/util.js', 'game/js/story.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const S = sandbox.RB.Story;
let errors = 0;
const fail = (m) => { console.log('FAIL:', m); errors++; };

if (S.chapters.length !== 5) fail('должно быть 5 глав');
if (Object.keys(S.notes).length !== 30) fail('должно быть 30 документов');
const npcIds = Object.keys(S.npcs);
if (npcIds.length !== 8) fail('должно быть 8 NPC, есть ' + npcIds.length);
if (S.endings.length !== 4) fail('должно быть 4 концовки');

const minigames = ['stamp', 'radio', 'wires', 'shells', 'count', 'hor', 'pipes', 'xray'];
for (const id of npcIds) {
  const n = S.npcs[id];
  if (!n.quest) fail(id + ': нет квеста');
  if (!minigames.includes(n.quest.minigame)) fail(id + ': неизвестная мини-игра ' + n.quest.minigame);
  if (!n.lines || !n.lines.first || !n.lines.done) fail(id + ': нет реплик');
}

for (const ch of S.chapters) {
  for (const id of (ch.gen.npcs || [])) {
    if (!S.npcs[id]) fail(`глава ${ch.id}: неизвестный NPC ${id}`);
  }
  for (const n of ch.notes) if (!S.notes[n.id]) fail(`глава ${ch.id}: документ ${n.id} не найден`);
}

const ids = S.endings.map((e) => e.id);
for (const c of S.finaleChoices) {
  if (!ids.includes(c.id)) fail('финальный выбор ссылается на несуществующую концовку ' + c.id);
}
const quiet = S.endings.find((e) => e.id === 'quiet');
for (const id of npcIds) {
  if (!quiet.requires.includes(id)) fail('идеальная концовка не требует ' + id);
}
if (!quiet.requires.includes('asya')) fail('идеальная концовка не требует Асю');

console.log(`главы: ${S.chapters.length}, документы: ${Object.keys(S.notes).length}, NPC: ${npcIds.length}, концовки: ${S.endings.length}`);
console.log(errors === 0 ? 'PASS' : `FAIL (${errors})`);
process.exit(errors === 0 ? 0 : 1);
