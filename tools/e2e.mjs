import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const BASE = 'http://127.0.0.1:8123/game/index.html';
const OUT = path.join(process.cwd(), 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitHttp(url, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = (n) => {
      http.get(url, (res) => { res.resume(); resolve(true); }).on('error', () => {
        if (n <= 0) reject(new Error('debug endpoint unavailable'));
        else setTimeout(() => tick(n - 1), 250);
      });
    };
    tick(tries);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'eval error');
    }
    return r.result?.value;
  }
  async shot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  }
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

async function main() {
  fs.rmSync(path.join(process.env.TEMP || '.', 'rb-edge-' + Date.now()), { recursive: true, force: true });
  const edge = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,720',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'rb-edge-profile'),
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitHttp('http://127.0.0.1:' + PORT + '/json/version');
    const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
    const page = list.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: true
    });

    const errors = [];
    const collect = () => {
      for (const ev of cdp.events.splice(0)) {
        if (ev.method === 'Runtime.exceptionThrown') {
          errors.push('EXC ' + (ev.params.exceptionDetails?.exception?.description || ev.params.exceptionDetails?.text));
        }
        if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') {
          errors.push('LOG ' + (ev.params.entry.url || '') + ' ' + ev.params.entry.text);
        }
        if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') {
          errors.push('CONS ' + ev.params.args.map((a) => a.value || a.description || '').join(' '));
        }
      }
    };

    const advanceCutscenes = async () => {
      for (let i = 0; i < 20; i++) {
        const st = await cdp.eval('window.game ? window.game.state : null');
        if (st !== 'cutscene' && st !== 'choice') break;
        await cdp.eval(`(() => {
          const cs = document.querySelectorAll('#cutscene button');
          if (cs.length) { cs[cs.length - 1].click(); return 'cutscene'; }
          const b = document.querySelector('#modal-buttons button');
          if (b) { b.click(); return 'clicked'; }
          if (window.game && window.game.state === 'cutscene') { window.game.ui.closeModal(); window.game.state = 'playing'; }
          return 'skipped';
        })()`);
        await sleep(250);
      }
    };
    const nav = async (url, wait = 2600) => {
      await cdp.send('Page.navigate', { url });
      await sleep(wait);
      await advanceCutscenes();
      await sleep(700);
      collect();
    };
    const state = () => cdp.eval(`(() => {
      const g = window.game;
      if (!g) return { boot:false };
      return {
        boot: true,
        state: g.state,
        chapter: g.chapter && g.chapter.id,
        seed: g.seedText,
        mode: g.world && g.world.mode,
        px: g.player && Math.round(g.player.x),
        py: g.player && Math.round(g.player.y),
        hp: g.player && Math.round(g.player.hp),
        objects: g.world ? g.world.objects.reduce((m,o)=>{m[o.kind]=(m[o.kind]||0)+1;return m;},{}) : null,
        enemies: g.world ? g.world.enemies.map(e=>e.type) : null,
        err: window.__lastErr || null,
        crash: (RB.CrashLog ? RB.CrashLog.list() : []).map(x=>x.m).slice(0,5),
        title: document.title
      };
    })()`);

    /* ---------- MENU ---------- */
    await nav(BASE, 1800);
    await cdp.eval('try{localStorage.clear()}catch(e){}');
    await nav(BASE, 1800);
    let s = await state();
    check('menu boot', s.boot && s.state === 'menu', JSON.stringify(s));
    check('menu no crash', !s.err && s.crash.length === 0, s.err || '');
    await cdp.shot('e2e_menu.png');
    const langTest = await cdp.eval(`(() => {
      RB.I18n.set('en');
      const en = document.getElementById('btn-new').textContent;
      const langBtn = document.getElementById('lang').textContent;
      const note = RB.L.note(RB.Story.notes.n1);
      const chapter = RB.L.chapter(RB.Story.chapters[0]);
      const scene = RB.L.scene(RB.Story.scenes.capture, 'capture');
      const npc = RB.L.npc(RB.Story.npcs.zoya);
      const prompt = RB.L.prompt('ПРОЧИТАТЬ ДОКУМЕНТ');
      const shop = RB.L.shop(RB.ShopPool[0]);
      const room = RB.L.room('ЦЕХ');
      RB.I18n.set('ru');
      const ru = document.getElementById('btn-new').textContent;
      return { en, ru, langBtn, note: note.title, chapter: chapter.title, scene: scene.title, npc: npc.lines.first[0], prompt, shop: shop.name, room };
    })()`);
    check('EN/RU language toggle', langTest.en === 'NEW SHIFT' && langTest.ru === 'НОВАЯ СМЕНА', JSON.stringify(langTest));
    check('EN content pack', langTest.note === 'INSPECTOR INSTRUCTIONS' && langTest.chapter === 'CHECKPOINT' && langTest.scene === 'THE SACK' && langTest.npc === 'Order.' && langTest.prompt === 'READ DOCUMENT' && langTest.room === 'WORKSHOP', JSON.stringify(langTest));

    /* ---------- CHAPTERS ---------- */
    for (let ch = 1; ch <= 5; ch++) {
      await nav(BASE + '?play=1&ch=' + ch + '&seed=777777', ch === 1 ? 3000 : 3200);
      s = await state();
      const bossCount = (s.enemies || []).filter((t) => ['boss', 'mat', 'chorus', 'dvoynik'].includes(t)).length;
      check('ch' + ch + ' playable', s.boot && s.state === 'playing' && s.chapter === ch && !s.err,
        'state=' + s.state + ' mode=' + s.mode + ' objs=' + JSON.stringify(s.objects) + ' enemies=' + (s.enemies || []).length + ' boss=' + bossCount + ' err=' + s.err);
      check('ch' + ch + ' world populated', s.objects && Object.keys(s.objects).length > 3 && s.enemies.length > 0,
        JSON.stringify(s.objects));
      check('ch' + ch + ' no runtime errors', !s.err && s.crash.length === 0, s.crash.join(' | '));
      await cdp.shot('e2e_ch' + ch + '.png');
    }

    /* ---------- FEATURES ch1 ---------- */
    await nav(BASE + '?play=1&ch=1&seed=777777', 3000);
    const feat = await cdp.eval(`(async () => {
      const g = window.game, out = {};
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      out.scenes = RB.Story.scenes ? Object.keys(RB.Story.scenes) : null;
      out.endingScenes = RB.Story.endingScenes ? Object.keys(RB.Story.endingScenes) : null;
      out.noteComments = RB.Story.noteComments ? Object.keys(RB.Story.noteComments).length : 0;
      out.notesTotal = RB.Story.notes ? Object.keys(RB.Story.notes).length : 0;
      out.promptBtn = !!document.getElementById('prompt');
      out.ngBtn = !!document.getElementById('btn-ngplus');
      // map
      g.openMap(); await wait(120);
      out.mapOpen = !document.getElementById('map-screen').classList.contains('hidden') && !!document.getElementById('map-canvas');
      out.mapRooms = Object.keys(g.explored || {}).length > 0;
      RB.MapView.close();
      g.state = 'playing';
      // inventory
      g.openInventory(); await wait(120);
      out.invOpen = !document.getElementById('inv-screen').classList.contains('hidden') &&
        document.querySelectorAll('.inv-grid').length >= 2 &&
        document.querySelectorAll('.inv-item').length >= 4;
      document.getElementById('inv-screen').classList.add('hidden');
      g.state = 'playing';
      // lever
      const lev = g.world.objects.find(o => o.kind === 'lever');
      if (lev) { const t0 = g.player.tokens; g.useLever(lev); out.lever = lev.on && g.player.tokens === t0 + 2; }
      // cache
      const cache = g.world.objects.find(o => o.kind === 'cache');
      if (cache) { g.openCache(cache); out.cache = !!cache.taken; }
      // clue
      const clue = g.world.objects.find(o => o.kind === 'clue');
      if (clue) { g.player.x = clue.x; g.player.y = clue.y; g.state = 'playing'; g.interact(); out.clue = !!clue.taken && (g.flags.photos||0) >= 1; }
      // cutscene
      let cut = false;
      if (RB.Story.scenes && RB.Story.scenes.capture) {
        g.state = 'cutscene';
        RB.Cutscene.play(g.ui, RB.Story.scenes.capture, () => { cut = true; });
        await wait(700);
        out.cutsceneVisible = !!document.getElementById('cutscene');
        out.cutsceneText = (document.getElementById('cutscene-line')?.textContent || '').length > 5;
        if (RB.Cutscene && RB.Cutscene.active) RB.Cutscene.active.close();
        g.state = 'playing';
      }
      // ngplus persistence
      g.finishGame('salt');
      out.ngStored = !!RB.store.get('rb_ngplus', null);
      out.endingScenePlayed = !!document.getElementById('cutscene');
      return out;
    })()`);
    check('cutscene data', Array.isArray(feat.scenes) && feat.scenes.includes('capture') && feat.scenes.includes('escape') && feat.scenes.includes('procession') && feat.scenes.includes('conveyor'), JSON.stringify(feat.scenes));
    check('ending scenes data', Array.isArray(feat.endingScenes) && feat.endingScenes.length >= 4, JSON.stringify(feat.endingScenes));
    check('note comments', feat.noteComments >= 12, String(feat.noteComments));
    check('30 documents', feat.notesTotal === 30, String(feat.notesTotal));
    check('map panel', feat.mapOpen && feat.mapRooms, JSON.stringify({ open: feat.mapOpen, rooms: feat.mapRooms }));
    check('inventory panel', feat.invOpen, String(feat.invOpen));
    check('lever works', feat.lever === true, String(feat.lever));
    check('cache works', feat.cache === true, String(feat.cache));
    check('clue works', feat.clue === true, String(feat.clue));
    check('cutscene plays', feat.cutsceneVisible === true && feat.cutsceneText === true, JSON.stringify({ v: feat.cutsceneVisible, t: feat.cutsceneText }));
    check('ending cutscene plays', feat.endingScenePlayed === true, String(feat.endingScenePlayed));
    check('NG+ persisted', feat.ngStored === true, String(feat.ngStored));
    check('NG+ menu button', feat.ngBtn === true, String(feat.ngBtn));
    await cdp.shot('e2e_features.png');

    /* ---------- KEY / CODE / SIGIL / WITNESS / SCHEDULE ---------- */
    await nav(BASE + '?play=1&ch=2&seed=777777', 3000);
    const keyTest = await cdp.eval(`(() => {
      const g = window.game;
      const k = g.world.objects.find(o => o.kind === 'key');
      if (!k) return { has: false };
      g.player.x = k.x; g.player.y = k.y - 10;
      g.interact();
      return { has: true, taken: !!k.taken, flag: !!g.flags['key_2'], req: !!(g.world.exitObj.reqs || {}).key, interrogation: g.flags.interrogation || null };
    })()`);
    check('key pickup + lock graph', keyTest.has && keyTest.taken && keyTest.flag && keyTest.req, JSON.stringify(keyTest));
    check('interrogation choice persists', keyTest.interrogation === 'lie', String(keyTest.interrogation));

    await nav(BASE + '?play=1&ch=4&seed=777777', 3000);
    const faction = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      const sh = g.world.objects.find(o => o.kind === 'shop' && o.faction === 'fishers');
      if (!sh) return { has: false };
      g.flags.vera = true;
      g.flags.photos = 2;
      g.flags.photoList = [{ ch: 2, label: 'x' }, { ch: 3, label: 'y' }];
      const t0 = g.player.tokens;
      g.openShop(sh);
      await wait(120);
      const btn = [...document.querySelectorAll('#modal-buttons button')].find(b => /Сдать фотоулику/.test(b.textContent));
      if (btn) btn.click();
      await wait(120);
      return { has: true, traded: g.flags.photos === 1, tokens: g.player.tokens - t0, label: !!btn };
    })()`);
    check('faction trade (photo->tokens)', faction.has && faction.traded && faction.tokens >= 6, JSON.stringify(faction));

    await nav(BASE + '?play=1&ch=3&seed=777777', 3000);
    const codeTest = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      for (const h of g.goals) h.done = true;
      g.world.exitObj.locked = true;
      g.openCodeLock(g.world.exitObj);
      await wait(80);
      const clickByText = (t) => {
        const b = [...document.querySelectorAll('#modal-buttons button')].find(x => x.textContent === t);
        if (b) { b.click(); return true; }
        return false;
      };
      const opened = !document.getElementById('modal').classList.contains('hidden');
      for (const d of ['0','9','1','9']) { clickByText(d); await wait(30); }
      await wait(120);
      return { opened, accepted: !!g.flags['code_3'], state: g.state, unlocked: !g.world.exitObj.locked };
    })()`);
    check('code lock UI accepts 0919', codeTest.opened && codeTest.accepted && codeTest.unlocked, JSON.stringify(codeTest));

    await nav(BASE + '?play=1&ch=5&seed=777777', 3000);
    const sigilTest = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      const s = g.world.objects.find(o => o.kind === 'sigil');
      if (!s) return { has: false };
      g.openSigil(s);
      await wait(120);
      const host = document.getElementById('minigame');
      const buttons = [...document.querySelectorAll('#mg-body button')];
      const rotates = buttons.filter(b => b.textContent === 'ПОВЕРНУТЬ');
      for (let i = 0; i < rotates.length; i++) {
        for (let k = 0; k <= i; k++) rotates[i].click();
      }
      const collect = [...document.querySelectorAll('#mg-body button')].find(b => b.textContent === 'СОБРАТЬ СИГИЛ');
      if (collect) collect.click();
      await wait(150);
      return { has: true, visible: !host.classList.contains('hidden'), done: !!s.done, flag: !!g.flags['sigil_5'], state: g.state };
    })()`);
    check('sigil puzzle solvable', sigilTest.has && sigilTest.done && sigilTest.flag && sigilTest.state === 'playing', JSON.stringify(sigilTest));

    await nav(BASE + '?play=1&ch=2&seed=777777', 3000);
    const valves = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      const o = g.world.objects.find(x => x.kind === 'puzzle' && x.puzzle === 'valves');
      if (!o) return { has: false };
      g.openPuzzle(o);
      await wait(150);
      const rotates = [...document.querySelectorAll('#mg-body button')].filter(b => b.textContent === 'ПОВЕРНУТЬ');
      const clicks = [2, 0, 3];
      clicks.forEach((n, i) => { for (let k = 0; k < n; k++) rotates[i].click(); });
      const check = [...document.querySelectorAll('#mg-body button')].find(b => b.textContent === 'ВЫРОВНЯТЬ');
      if (check) check.click();
      await wait(150);
      return { has: true, done: !!o.done, flag: !!g.flags.puzzle_valves, state: g.state };
    })()`);
    check('valves puzzle', valves.has && valves.done && valves.flag && valves.state === 'playing', JSON.stringify(valves));

    await nav(BASE + '?play=1&ch=3&seed=777777', 3000);
    const cameras = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      const o = g.world.objects.find(x => x.kind === 'puzzle' && x.puzzle === 'cameras');
      if (!o) return { has: false };
      g.openPuzzle(o);
      await wait(4300);
      const cells = [...document.querySelectorAll('#mg-body button')].slice(0, 9);
      for (const i of [0, 4, 8, 2]) { cells[i].click(); await wait(80); }
      await wait(200);
      return { has: true, done: !!o.done, flag: !!g.flags.puzzle_cameras, state: g.state };
    })()`);
    check('cameras puzzle', cameras.has && cameras.done && cameras.flag && cameras.state === 'playing', JSON.stringify(cameras));

    await nav(BASE + '?play=1&ch=4&seed=777777', 3000);
    const weights = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      const o = g.world.objects.find(x => x.kind === 'puzzle' && x.puzzle === 'weights');
      if (!o) return { has: false };
      g.openPuzzle(o);
      await wait(150);
      const pick = (t) => [...document.querySelectorAll('#mg-body button')].find(b => b.textContent === t);
      pick('4').click(); pick('5').click();
      const check = [...document.querySelectorAll('#mg-body button')].find(b => b.textContent === 'ВЗВЕСИТЬ');
      check.click();
      await wait(150);
      return { has: true, done: !!o.done, flag: !!g.flags.puzzle_weights, state: g.state };
    })()`);
    check('weights puzzle', weights.has && weights.done && weights.flag && weights.state === 'playing', JSON.stringify(weights));

    await nav(BASE + '?play=1&ch=2&seed=777777', 3000);
    const bossTest = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      for (const h of g.goals) h.done = true;
      g.flags['bossTalk_2'] = true;
      g.addItem('key_boss', 1);
      const o = g.world.objects.find(x => x.kind === 'boss');
      if (!o) return { has: false };
      g.startBossFight(o);
      await wait(200);
      const iso = g.world.mode === 'iso' && !!g.world.bossFight;
      const boss = g.world.enemies.find(e => e.def && e.def.isBoss);
      const type = boss && boss.type;
      if (boss) boss.dead = true;
      await wait(400);
      return { has: true, iso, type, returned: !g.inIso, defeated: !!g.flags['bossDefeated_2'] };
    })()`);
    check('boss gate opens only in iso', bossTest.has && bossTest.iso && bossTest.type === 'boss', JSON.stringify(bossTest));
    check('boss victory returns and unlocks', bossTest.returned === true && bossTest.defeated === true, JSON.stringify(bossTest));

    await nav(BASE + '?play=1&ch=1&seed=777777', 3000);
    const stashTest = await cdp.eval(`(async () => {
      const g = window.game, wait = ms => new Promise(r => setTimeout(r, ms));
      const s = g.world.objects.find(x => x.kind === 'stash');
      if (!s) return { has: false };
      g.player.x = s.x; g.player.y = s.y;
      g.openStash(s);
      await wait(150);
      const host = document.getElementById('minigame');
      const open = !host.classList.contains('hidden') && g.state === 'minigame';
      host.classList.add('hidden');
      g.state = 'playing';
      return { has: true, open };
    })()`);
    check('lockpick stash minigame opens', stashTest.has && stashTest.open, JSON.stringify(stashTest));

    await nav(BASE + '?play=1&ch=1&seed=777777&dbg=craft', 3200);
    const craftTest = await cdp.eval(`(() => {
      const g = window.game;
      return { iso: g.world && g.world.mode === 'iso', table: !!(g.world && g.world.objects.find(o => o.kind === 'craft')), modal: (document.getElementById('modal-title')?.textContent || ''), battery: Math.round(g.player.battery) };
    })()`);
    check('craft table in iso', craftTest.iso && craftTest.table && /КРАФТ|CRAFT/.test(craftTest.modal), JSON.stringify(craftTest));

    await nav(BASE + '?play=1&ch=1&seed=777777', 3000);
    const aiTest = await cdp.eval(`(() => {
      const g = window.game, w = g.world, p = g.player;
      p.flashlight = true; p.battery = 100;
      let e = w.enemies.find(x => x.type === 'svidetel');
      if (!e) { e = new RB.Enemy('svidetel', p.x + 60, p.y); w.enemies.push(e); }
      e.x = p.x + 60; e.y = p.y; e.limbs = e.limbs || { head: true, armL: true, armR: true, legL: true, legR: true };
      e.update(0.1, w, p, g);
      g.flags.ignat = true;
      return {
        witness: e.state === 'flee' && !!e.screamed,
        schedule: Array.isArray(RB.Story.npcs.zoya.schedule && RB.Story.npcs.zoya.schedule[1]) && RB.Story.npcs.zoya.schedule[1].length > 0,
        rep: g.cultReputation(),
        photos: (g.flags.photoList || []).length
      };
    })()`);
    check('witness flees and screams', aiTest.witness === true, JSON.stringify(aiTest));
    check('npc schedules', aiTest.schedule === true, String(aiTest.schedule));
    check('cult reputation', aiTest.rep >= 15, String(aiTest.rep));
    const worldTest = await cdp.eval(`(async () => {
      const g = window.game, w = g.world, p = g.player;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      // кости
      const gm = w.objects.find(o => o.kind === 'gamble');
      if (gm) {
        p.tokens = 10;
        g.openGamble(gm);
        await wait(60);
        const hist = [p.tokens];
        const roll = () => [...document.querySelectorAll('#modal-buttons button')].find(b => /БРОСИТЬ/.test(b.textContent));
        for (let i = 0; i < 3; i++) {
          const r = roll();
          if (r) r.click();
          await wait(70);
          hist.push(p.tokens);
        }
        out.rolls = hist;
        out.gambleState = g.state;
        out.gambleText = document.getElementById('modal-text').textContent.slice(0, 120);
        out.gamble = g.state === 'gambling' && /ТВОИ/.test(out.gambleText) && hist.some(t => t !== 10);
        const leave = [...document.querySelectorAll('#modal-buttons button')].find(b => b.textContent === 'УЙТИ');
        if (leave) leave.click();
        await wait(60);
      }
      // укрытие
      const sh = w.objects.find(o => o.kind === 'shelter');
      if (sh) {
        g.toggleShelter(sh);
        out.hidden = p.hidden === true;
        const e = w.enemies.find(x => !x.dead);
        out.invisible = e ? e.canSee(w, p) === false : true;
        g.toggleShelter(sh);
        out.left = p.hidden === false;
      }
      out.scenes = !!(RB.Story.scenes.procession && RB.Story.scenes.conveyor);
      return out;
    })()`);
    check('gambling (dice)', worldTest.gamble === true, JSON.stringify(worldTest));
    check('shelter hides player', worldTest.hidden === true && worldTest.invisible === true && worldTest.left === true, JSON.stringify(worldTest));
    check('procession + conveyor scenes', worldTest.scenes === true, JSON.stringify(worldTest));

    const extraTest = await cdp.eval(`(async () => {
      const g = window.game, w = g.world, p = g.player, out = {};
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const sec = w.objects.find(o => o.kind === 'secret');
      if (sec) {
        g.enterSecret(sec);
        out.secretIn = g.inIso === true && g.world.mode === 'iso' && g.world.objects.some(o => o.kind === 'cache');
        g.exitIso();
        out.secretOut = g.inIso === false && g.world === w;
      }
      const r = w.objects.find(o => o.kind === 'rescue');
      if (r) {
        const t0 = p.tokens;
        g.openRescue(r);
        out.rescue = !!r.taken && g.flags.rescued >= 1 && p.tokens === t0 + 4;
      }
      const a = 0.7;
      out.isoMath = Math.abs(RB.Iso.worldAngleToScreen(RB.Iso.screenAngleToWorld(a)) - a) < 1e-6;
      const cb = document.getElementById('contrast');
      const before = document.body.classList.contains('high-contrast');
      if (cb) cb.click();
      out.contrast = document.body.classList.contains('high-contrast') !== before;
      if (cb) cb.click();
      const mb = document.getElementById('motion');
      const beforeM = document.body.classList.contains('reduce-motion');
      if (mb) mb.click();
      out.motion = document.body.classList.contains('reduce-motion') !== beforeM;
      if (mb) mb.click();
      out.aria = !!document.querySelector('#btn-fire[aria-label]');
      return out;
    })()`);
    check('secret room enter/exit', extraTest.secretIn === true && extraTest.secretOut === true, JSON.stringify(extraTest));
    check('NPC rescue', extraTest.rescue === true, JSON.stringify(extraTest));
    check('iso aim math', extraTest.isoMath === true, String(extraTest.isoMath));
    check('accessibility toggles', extraTest.contrast === true && extraTest.motion === true && extraTest.aria === true, JSON.stringify(extraTest));

    const systems2 = await cdp.eval(`(async () => {
      const g = window.game, p = g.player, w = g.world, out = {};
      const wait = ms => new Promise(r => setTimeout(r, ms));
      g.initInventory(p);
      out.pocket = { w: p.inv.pockets.w, h: p.inv.pockets.h, items: p.inv.pockets.items.map(it => ({ id: it.id, x: it.x, y: it.y, w: it.w, h: it.h })) };
      out.initPistol = [...p.inv.backpack.items, ...p.inv.pockets.items].filter(it => it.id === 'w_pistol').length;
      const addRet = RB.Inv.add(p.inv.pockets, 'mag_pm', 1);
      out.addRet = !!addRet;
      out.afterAdd = [...p.inv.backpack.items, ...p.inv.pockets.items].filter(it => it.kind === 'mag').length;
      p.hp = 40;
      g.addItem('medkit', 1);
      const med = [...p.inv.backpack.items, ...p.inv.pockets.items].find(it => it.id === 'medkit');
      if (med) { g.useItem(med.uid); out.useItem = p.hp > 40; }
      // бронебойные патроны и магазин
      g.addItem('ammo_9x18_ap', 10);
      g.addItem('w_pistol', 1);
      g.addItem('mag_pm', 1);
      const pistol = [...p.inv.backpack.items, ...p.inv.pockets.items].find(it => it.id === 'w_pistol');
      if (pistol) {
        const freeMag = [...p.inv.backpack.items, ...p.inv.pockets.items].find(it => it.id === 'mag_pm');
        if (freeMag) pistol.magUid = freeMag.uid;
        g.equipUid(p, pistol.uid);
      }
      const wItem = g.getWeaponItem(p);
      out.weapon = wItem && wItem.id;
      out.equip = p.inv.equipment.weapon;
      out.pistolIn = [...p.inv.backpack.items, ...p.inv.pockets.items].filter(it => it.id === 'w_pistol').length;
      out.magIn = [...p.inv.backpack.items, ...p.inv.pockets.items].filter(it => it.kind === 'mag').length;
      out.magUid = wItem && wItem.magUid;
      const mag = wItem ? g.getWeaponMag(p, wItem) : null;
      out.magFound = !!mag;
      out.ammoCount = RB.Inv.total(p, 'ammo_9x18_ap');
      if (mag) { mag.rounds = 0; out.magAmmo = mag.ammo; out.magCap = mag.cap; const apIt = [...p.inv.backpack.items, ...p.inv.pockets.items].find(it => it.id === 'ammo_9x18_ap'); out.ammoFam = apIt && apIt.family; out.ammoKind = apIt && apIt.kind; g.loadMag(mag.uid); out.loaded = mag.loaded; out.mul = p.ammoMul; out.rounds = mag.rounds; out.ap = mag.loaded === 'ammo_9x18_ap' && p.ammoMul >= 1.2; }
      // одежда
      g.addItem('hat_01', 1);
      const hat = [...p.inv.backpack.items, ...p.inv.pockets.items].find(it => it.id === 'hat_01');
      if (hat) { g.equipUid(p, hat.uid); out.hat = !!p.outfit.hat && p.inv.equipment.hat === hat.uid; g.unequipSlot('hat'); }
      // наркотики
      p.maxHpBase = p.maxHpBase || p.maxHp;
      p.drug = { doses: 0, penalty: 0, relief: 0, tick: 0, boost: 0 };
      p.hp = 30; g.useDrug();
      out.drug1 = p.drug.doses === 1 && p.hp >= p.maxHpBase;
      g.useDrug();
      out.drug2 = p.drug.doses === 2 && p.drug.penalty === 30 && p.drug.relief > 0;
      // пощада культиста
      const e = new RB.Enemy('cultist', p.x + 60, p.y);
      e.hp = 1; e.maxHp = 4; e.state = 'chase'; w.enemies.push(e);
      e.update(0.05, w, p, g);
      out.surrender = e.state === 'surrender';
      const t0 = p.tokens;
      g.spareCultist(e);
      out.mercy = p.tokens >= t0 + 2 && (g.flags.cultMercy || 0) >= 1;
      return out;
    })()`);
    check('inventory use item', systems2.useItem === true, JSON.stringify(systems2));
    check('AP ammo loads into magazine', systems2.ap === true, JSON.stringify(systems2));
    check('clothing equip/unequip', systems2.hat === true, JSON.stringify(systems2));
    check('drug dose 1 full restore', systems2.drug1 === true, JSON.stringify(systems2));
    check('drug dose 2 penalty/relief', systems2.drug2 === true, JSON.stringify(systems2));
    check('cultist surrender + mercy', systems2.surrender === true && systems2.mercy === true, JSON.stringify(systems2));

    await nav(BASE + '?play=1&ch=1&seed=777777', 3000);
    const systems3 = await cdp.eval(`(async () => {
      const g = window.game, p = g.player, w = g.world, out = {};
      const wait = ms => new Promise(r => setTimeout(r, ms));
      g.initInventory(p);
      // размеры оружия
      out.sizes = RB.Items.get('w_pistol').w === 1 && RB.Items.get('w_ak74').w === 2 && RB.Items.get('w_flamethrower').w === 3 && RB.Items.get('w_harpoon').w === 4;
      // несколько магазинов + перезарядка
      g.addItem('mag_pm', 1); g.addItem('ammo_9x18', 16);
      const wItem = g.getWeaponItem(p);
      const mags = [p.inv.backpack.items, p.inv.pockets.items, p.inv.rps.items].flat().filter(it => it.kind === 'mag');
      if (mags[0]) { mags[0].rounds = 0; mags[0].ammo = undefined; }
      if (wItem) g.reloadWeapon(p);
      out.multiMag = mags.some(m => m.rounds > 0) && p.ammo > 0;
      // дробовик без магазина
      g.addItem('w_shotgun', 1); g.addItem('ammo_12', 8);
      const shot = [p.inv.backpack.items, p.inv.pockets.items].flat().find(it => it.id === 'w_shotgun');
      if (shot) { g.equipUid(p, shot.uid); g.reloadWeapon(p); }
      out.noMagShotgun = p.weapon === 'shotgun' && p.ammo > 0;
      // магазины в РПС
      g.addItem('rps_01', 1);
      const rps = [p.inv.backpack.items, p.inv.pockets.items].flat().find(it => it.id === 'rps_01');
      if (rps) g.equipUid(p, rps.uid);
      g.addItem('mag_ak', 1);
      out.rps = !!(p.inv.rps && p.inv.rps.items.length);
      // рецепты по умолчанию
      out.recipes = !!(g.flags.recipes.mag_pm && g.flags.recipes.mag_ak && g.flags.recipes.harpoon);
      // выброс на пол
      g.addItem('food', 1);
      const food = [p.inv.backpack.items, p.inv.pockets.items].flat().find(it => it.id === 'food');
      if (food) g.dropItem(food.uid);
      out.drop = w.objects.some(o => o.kind === 'item' && o.item === 'food' && !o.taken);
      // успокоительное
      g.addItem('calm', 1);
      const calm = [p.inv.backpack.items, p.inv.pockets.items].flat().find(it => it.id === 'calm');
      p.attention = 60;
      if (calm) g.useItem(calm.uid);
      out.calm = p.calmTimer > 0 && p.attention === 0;
      p.calmTimer = 0.01; g.updateCalm(0.1);
      out.calmAfter = p.attention === 80 && p.recordBlocked > 0;
      // Игнат даёт чертёж
      g.completeNpcQuest(RB.Story.npcs.ignat);
      out.ignat = !!g.flags.recipes.salt13;
      // запись в комнате
      const door = w.objects.find(o => o.kind === 'door');
      if (door) { g.enterIso(door); out.recordOff = document.getElementById('btn-record').disabled === true; g.exitIso(); }
      // торговля сеткой
      const npc = RB.Story.npcs.zoya;
      const st = g.npcState.zoya;
      g.openNpcTrade(npc, st, () => {});
      await wait(120);
      out.trade = !document.getElementById('trade-screen').classList.contains('hidden') && document.querySelectorAll('.trade-tile').length > 0;
      document.getElementById('trade-screen').classList.add('hidden');
      g.state = 'playing';
      // диалог с репликами
      g.talkTo({ npcId: 'zoya' });
      await wait(120);
      out.dialog = /ВЫ:/.test(document.getElementById('modal-text').textContent) && /Зоя:/.test(document.getElementById('modal-text').textContent);
      g.ui.closeModal(); g.state = 'playing';
      // объединение патронов
      g.initInventory(p);
      const a1 = RB.Inv.make('ammo_9x18', 3);
      const a2 = RB.Inv.make('ammo_9x18', 32);
      RB.Inv.autoPlace(p.inv.backpack, a1);
      RB.Inv.autoPlace(p.inv.backpack, a2);
      g.mergeAmmo(a1.uid, a2.uid);
      out.merge = a1.count === 35 && ![...p.inv.backpack.items, ...p.inv.pockets.items].some(it => it.uid === a2.uid);
      return out;
    })()`);
    check('weapon grid sizes', systems3.sizes === true, JSON.stringify(systems3));
    check('multiple magazines reload', systems3.multiMag === true, JSON.stringify(systems3));
    check('shotgun has no magazine', systems3.noMagShotgun === true, JSON.stringify(systems3));
    check('RPS holds magazines', systems3.rps === true, JSON.stringify(systems3));
    check('default magazine recipes', systems3.recipes === true, JSON.stringify(systems3));
    check('drop item to floor', systems3.drop === true, JSON.stringify(systems3));
    check('calming pill + aftermath', systems3.calm === true && systems3.calmAfter === true, JSON.stringify(systems3));
    check('Ignat gives salt blueprint', systems3.ignat === true, JSON.stringify(systems3));
    check('record disabled in room', systems3.recordOff === true, JSON.stringify(systems3));
    check('trade grid UI', systems3.trade === true, JSON.stringify(systems3));
    check('dialogue replies', systems3.dialog === true, JSON.stringify(systems3));
    check('ammo stacks merge', systems3.merge === true, JSON.stringify(systems3));
    await cdp.shot('e2e_systems.png');

    await nav(BASE + '?play=1&ch=1&seed=777777&skipscenes=1', 3000);
    const systems4 = await cdp.eval(`(async () => {
      const g = window.game, p = g.player, w = g.world, out = {};
      const wait = ms => new Promise(r => setTimeout(r, ms));
      g.initInventory(p);
      out.terminals = w.objects.filter(o => o.kind === 'mail').length === 1 && w.objects.filter(o => o.kind === 'console').length === 1;
      out.icons = String(RB.Assets.icon('keycard_1')).indexOf('data:image/svg') === 0 && RB.Assets.icon('medkit').indexOf('med') >= 0;
      out.icons2 = RB.Assets.icon('painkiller').indexOf('med23') >= 0 && RB.Assets.icon('rps_01').indexOf('equip10') >= 0 &&
        RB.Assets.icon('jacket_05').indexOf('cloth6') >= 0 && RB.Assets.icon('pants_17').indexOf('cloth25') >= 0 &&
        RB.Assets.icon('boots_07').indexOf('equip29') >= 0;
      out.ammoIcon = RB.Assets.icon('ammo_9x18', 3).indexOf('ammo1.png') >= 0 &&
        RB.Assets.icon('ammo_9x18', 30).indexOf('ammo40.png') >= 0 &&
        RB.Assets.icon('ammo_12', 8).indexOf('ammo44.png') >= 0;
      out.face = RB.Assets.playerPortrait(0.9, {}).indexOf('player_ok.png') >= 0 &&
        RB.Assets.playerPortrait(0.25, {}).indexOf('player_30.png') >= 0 &&
        RB.Assets.playerPortrait(0.9, { withdraw: true }).indexOf('player_withdraw.png') >= 0 &&
        RB.Assets.playerPortrait(0.2, { salt: true }).indexOf('player_salt.png') >= 0;
      // почта
      const mailObj = w.objects.find(o => o.kind === 'mail');
      g.openMail(mailObj);
      out.mail = g.flags.mail_read === true && document.getElementById('modal-title').textContent === 'ВХОДЯЩИЕ' && document.querySelectorAll('#modal-buttons button').length >= 4;
      g.ui.closeModal(); g.state = 'playing'; g.ui.showHUD();
      // ключ-карта в тайной комнате
      const sec = w.objects.find(o => o.kind === 'secret');
      g.enterSecret(sec);
      const card = g.world.objects.find(o => o.kind === 'item' && String(o.item).indexOf('keycard_') === 0);
      out.secretCard = !!card && card.item === 'keycard_1';
      g.exitIso();
      // консоль без карты
      const con = g.world.objects.find(o => o.kind === 'console');
      g.state = 'playing';
      g.openConsole(con);
      out.locked = g.state === 'playing' && !g.flags.console_1;
      // взлом с картой
      g.addItem('keycard_1', 1);
      const t0 = p.tokens;
      g.openConsole(con);
      out.hackOpen = g.state === 'minigame' && !document.getElementById('minigame').classList.contains('hidden');
      await wait(7600);
      out.hacked = g.flags.console_1 === true && p.tokens - t0 === 15 && RB.Inv.total(p, 'salt') >= 3 && !g.hasKeycard(1);
      out.hackState = g.state;
      // прокачка силы ноги
      g.rpg.points = 6;
      const ups = [];
      for (let i = 0; i < 5; i++) ups.push(g.buyUpgrade('leg'));
      out.leg = ups.slice(0, 4).every(Boolean) && ups[4] === false && g.rpg.upgrades.leg === 4;
      out.opm = p.opm === true && p.bald === true && p.cape === true && p.legPower > 1;
      // новые вопросы NPC
      g.talkTo({ npcId: 'zoya' });
      await wait(100);
      const talkBtn = [...document.querySelectorAll('#modal-buttons button')].find(b => b.textContent.indexOf('О ЧЁМ') >= 0);
      if (talkBtn) talkBtn.click();
      await wait(100);
      out.npcExtra = [...document.querySelectorAll('#modal-buttons button')].some(b => b.textContent.indexOf('★') >= 0);
      g.ui.closeModal(); g.state = 'playing'; g.ui.showHUD();
      // полный инвентарь: покупка падает на пол
      g.initInventory(p);
      for (const k of ['backpack', 'pockets', 'rps']) {
        const c = p.inv[k];
        if (!c) continue;
        c.items = [];
        for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const it = RB.Inv.make('medkit', 1); it.x = x; it.y = y; c.items.push(it); }
      }
      const shop = { stock: [{ id: 'weapon_pistol', name: 'ПМ', price: 1, kind: 'weapon', weapon: 'pistol' }] };
      p.tokens = 100;
      const bt = p.tokens;
      g.buyItem(shop, shop.stock[0], () => {});
      out.buyDrop = (bt - p.tokens) === 1 && shop.stock[0].sold === true && g.world.objects.some(o => o.kind === 'item' && o.item === 'w_pistol' && !o.taken);
      // выброс на пол подальше и с задержкой подбора
      g.initInventory(p);
      const dropIt = RB.Inv.make('food', 1);
      let placedDrop = false;
      if (RB.Inv.autoPlace(p.inv.backpack, dropIt)) placedDrop = true;
      if (!placedDrop && RB.Inv.autoPlace(p.inv.pockets, dropIt)) placedDrop = true;
      if (placedDrop) g.dropItem(dropIt.uid);
      const dropped = g.world.objects.filter(o => o.kind === 'item' && o.item === 'food' && o.pickupAt).pop();
      out.dropFloor = !!dropped && Math.hypot(dropped.x - p.x, dropped.y - p.y) > 34 && dropped.pickupAt > Date.now();
      // пасхалка Марио: прыжок на голову
      const e = w.enemies.find(x => !x.dead);
      if (e) {
        p.x = e.x; p.y = e.y - 70; p.vy = 300; p.onGround = false;
        e.hp = e.maxHp = 10;
        const hp0 = e.hp;
        for (let i = 0; i < 8; i++) { p.vy = 300; p.update(0.05, g.input, w, g); }
        out.stomp = e.hp < hp0;
      }
      return out;
    })()`);
    check('mail + console terminals exist', systems4.terminals === true, JSON.stringify(systems4));
    check('explicit item icons', systems4.icons === true, JSON.stringify(systems4));
    check('clothing/med/ammo icons match', systems4.icons2 === true, JSON.stringify(systems4));
    check('ammo under 15 shows single round', systems4.ammoIcon === true, JSON.stringify(systems4));
    check('player portrait by HP/drug state', systems4.face === true, JSON.stringify(systems4));
    check('mail terminal opens letters', systems4.mail === true, JSON.stringify(systems4));
    check('keycard in every secret room', systems4.secretCard === true, JSON.stringify(systems4));
    check('console locked without keycard', systems4.locked === true, JSON.stringify(systems4));
    check('console hack screen starts', systems4.hackOpen === true, JSON.stringify(systems4));
    check('console reward 15 tokens + 3 salt', systems4.hacked === true && systems4.hackState === 'playing', JSON.stringify(systems4));
    check('leg strength 4 levels -> One Punch Man', systems4.leg === true && systems4.opm === true, JSON.stringify(systems4));
    check('unlocked NPC questions', systems4.npcExtra === true, JSON.stringify(systems4));
    check('full inventory purchase drops to floor', systems4.buyDrop === true, JSON.stringify(systems4));
    check('dropped item lands away and waits', systems4.dropFloor === true, JSON.stringify(systems4));
    check('Mario stomp damages enemy', systems4.stomp === true, JSON.stringify(systems4));
    await cdp.shot('e2e_terminals.png');

    /* ---------- SAVE ROUND-TRIP ---------- */
    await nav(BASE + '?play=1&ch=2&seed=777777', 3000);
    const saved = await cdp.eval(`(() => {
      const g = window.game;
      g.player.x = Math.round(g.player.x) + 137;
      g.flags.save_test = 'ok';
      g.flags.key_2 = true;
      g.saveProgress();
      const s = RB.store.get('rb_save', null);
      RB.store.set('rb_test_save', s);
      return { v: s && s.version, ch: s && s.chapter, x: Math.round(g.player.x), fields: !!(s && s.run && s.run.player && s.run.objects && s.run.flags), inv: !!(s && s.inv && s.inv.backpack) };
    })()`);
    await nav(BASE + '?play=1&ch=2&seed=777777', 3000);
    const loaded = await cdp.eval(`(() => {
      const g = window.game;
      const s = RB.store.get('rb_test_save', null) || g.loadSave();
      if (!s || !s.run) return { ok: false };
      const applied = g.applyRun(s.run);
      return { ok: applied, x: Math.round(g.player.x), runX: Math.round(s.run.player.x), flag: g.flags.save_test, key: !!g.flags.key_2, inv: !!(g.player.inv && g.player.inv.backpack.items.length) };
    })()`);
    check('save v3 round-trip', saved.v === 3 && saved.ch === 2 && saved.fields && saved.inv && loaded.ok && Math.abs(loaded.x - saved.x) < 2 && loaded.flag === 'ok' && loaded.key && loaded.inv, JSON.stringify({ saved, loaded }));

    /* ---------- STORE SHOTS ---------- */
    await nav(BASE + '?play=1&ch=4&seed=777777&dbg=boss', 3400);
    await cdp.shot('store_04_boss.png');
    await cdp.send('Page.navigate', { url: BASE + '?play=1&ch=5&seed=777777&dbg=choice' });
    await sleep(3000);
    await cdp.shot('store_05_choice.png');
    await nav(BASE + '?play=1&ch=1&seed=777777&dbg=ending', 2600);
    await cdp.shot('store_06_ending.png');
    await nav(BASE, 1800);
    await cdp.shot('store_01_menu.png');

    /* ---------- ISO / ELEVATOR ---------- */
    await nav(BASE + '?play=1&ch=1&seed=777777', 3000);
    const iso = await cdp.eval(`(async () => {
      const g = window.game; const wait = (ms)=>new Promise(r=>setTimeout(r,ms));
      const door = g.world.objects.find(o => o.kind === 'door');
      const elev = g.world.objects.find(o => o.kind === 'elevator');
      const out = { door: !!door, elev: !!elev };
      if (door) { g.enterIso(door); await wait(300); out.isoMode = g.world.mode === 'iso'; out.isoObjs = g.world.objects.length; }
      return out;
    })()`);
    check('iso room exists', iso.door === true, JSON.stringify(iso));
    check('iso enters', iso.isoMode === true, JSON.stringify(iso));
    await cdp.shot('e2e_iso.png');

    await nav(BASE + '?play=1&ch=1&seed=777777', 3000);
    const elev = await cdp.eval(`(async () => {
      const g = window.game; const wait = (ms)=>new Promise(r=>setTimeout(r,ms));
      const e = g.world.objects.find(o => o.kind === 'elevator');
      const out = { has: !!e };
      if (e) { g.startElevator(e); await wait(900); out.anim = e.anim || 0; out.state = g.state; }
      return out;
    })()`);
    check('elevator exists', elev.has === true, JSON.stringify(elev));
    check('elevator animates', (elev.anim || 0) > 0, JSON.stringify(elev));

    collect();
    check('no page errors overall', errors.length === 0, errors.slice(0, 4).join(' | '));

    const failed = results.filter((r) => !r.ok);
    console.log('\nSUMMARY ' + (results.length - failed.length) + '/' + results.length + ' passed');
    if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(', '));
    fs.writeFileSync(path.join(process.cwd(), 'tools', 'e2e-report.json'), JSON.stringify({ results, errors }, null, 2));
    ws.close();
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    edge.kill();
  }
}

main().catch((e) => { console.error('E2E FATAL', e); process.exit(1); });
