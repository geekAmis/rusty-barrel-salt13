/* Валидация платформенных уровней: комнаты, двери, достижимость обязательных целей. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(process.cwd());
const sandbox = {
  console, Math, JSON, Uint8Array, Int32Array, isFinite, Date,
  performance: { now: () => Date.now() },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: {
    createElement: () => ({ getContext: () => ({}), width: 0, height: 0 })
  }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['game/js/util.js','game/js/audio.js','game/js/weapons.js','game/js/gen.js','game/js/story.js','game/js/entities.js','game/js/platformer.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const RB = sandbox.RB;
let errors = 0;
let levels = 0;
const solid = (lv, tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) return true;
  return '#BCP'.includes(lv.grid[ty][tx]);
};
const perChapter = Number(process.argv[2] || 200);
for (const ch of RB.Story.chapters) {
  for (let i = 0; i < perChapter; i++) {
    let lv;
    try { lv = RB.Gen.generate(ch, RB.hashSeed('plat:' + ch.id + ':' + i)); }
    catch (e) { console.log('FAIL gen', ch.id, i, e.message); errors++; continue; }
    levels++;
    if (!lv || !lv.grid) { console.log('FAIL no level'); errors++; continue; }
    const ground = lv.h - 5;
    // земля под стартом/выходом
    const stx = Math.floor(lv.start.x / 48);
    if (!solid(lv, stx, ground)) { console.log('FAIL start no ground', ch.id, i); errors++; }
    const ex = lv.exit;
    if (!solid(lv, ex.tx, ground)) { console.log('FAIL exit no ground', ch.id, i); errors++; }
    // квестовые/записки на полу
    for (const o of lv.objects) {
      if (['quest','note','npc','weapon','shop','checkpoint','key','button','sigil','lever','cache','clue'].includes(o.kind)) {
        if (!solid(lv, o.tx, o.ty + 1)) { console.log('FAIL float', o.kind, ch.id, i); errors++; }
      }
      if (!isFinite(o.x) || !isFinite(o.y)) { console.log('FAIL NaN object', o.kind); errors++; }
    }
    for (const e of lv.enemies) {
      if (!isFinite(e.x) || !isFinite(e.y)) { console.log('FAIL NaN enemy', ch.id, i); errors++; }
    }
    // комнаты и двери
    if (lv.rooms.length < 4) { console.log('FAIL rooms', ch.id, i); errors++; }
    if (!lv.objects.some((o) => o.kind === 'door')) { console.log('FAIL no doors', ch.id, i); errors++; }
    if (!lv.objects.some((o) => o.kind === 'checkpoint')) { console.log('FAIL no checkpoint', ch.id, i); errors++; }
    if (ch.gen.keyLock && !lv.objects.some((o) => o.kind === 'key')) { console.log('FAIL no key', ch.id, i); errors++; }
    if (ch.gen.button && !lv.objects.some((o) => o.kind === 'button')) { console.log('FAIL no button', ch.id, i); errors++; }
    if (ch.gen.sigil && !lv.objects.some((o) => o.kind === 'sigil')) { console.log('FAIL no sigil', ch.id, i); errors++; }
    const exObj = lv.objects.find((o) => o.kind === 'exit');
    if (!exObj || !exObj.reqs) { console.log('FAIL exit reqs', ch.id, i); errors++; }
    else if (ch.gen.code && exObj.reqs.code !== String(ch.gen.code)) { console.log('FAIL code req', ch.id, i); errors++; }
  }
}
console.log('levels', levels, 'errors', errors);
console.log(errors === 0 ? 'PASS' : 'FAIL');
process.exit(errors ? 1 : 0);
