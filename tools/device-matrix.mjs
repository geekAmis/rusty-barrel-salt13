import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ADB = 'D:\\Android\\sdk\\platform-tools\\adb.exe';
const PKG = 'ru.rustybarrel';
const ACT = PKG + '/.MainActivity';
const OUT = path.join(process.cwd(), 'tools', 'shots', 'device');
const PORT = 9223;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function adb(args, opts = {}) {
  const r = spawnSync(ADB, args, { encoding: opts.buffer ? null : 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r.stdout == null ? '' : r.stdout;
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
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
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
  }
}

async function connectDevice() {
  adb(['forward', '--remove-all']);
  const pid = adb(['shell', 'pidof', PKG]).trim();
  if (!pid) return null;
  adb(['forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`]);
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url)) || list[0];
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.addEventListener('open', res, { once: true });
          ws.addEventListener('error', rej, { once: true });
        });
        const cdp = new CDP(ws);
        await cdp.send('Runtime.enable');
        return cdp;
      }
    } catch (e) { /* not ready */ }
    await sleep(250);
  }
  return null;
}

const scenarios = [
  { name: 'menu', debug: null, expect: { state: 'menu' } },
  ...Array.from({ length: 5 }, (_, i) => ({ name: 'chapter_' + (i + 1), debug: `play=1,ch=${i + 1},seed=777777,skipscenes=1`, expect: { state: 'playing', chapter: i + 1 } })),
  { name: 'en_chapter_1', debug: 'play=1,ch=1,seed=777777,skipscenes=1,lang=en', expect: { state: 'playing', chapter: 1, chapterTitle: 'CHECKPOINT' } },
  ...Array.from({ length: 5 }, (_, i) => ({ name: 'iso_ch' + (i + 1), debug: `play=1,ch=${i + 1},seed=777777,dbg=iso,skipscenes=1`, expect: { mode: 'iso', minObstacles: 1, recordOff: true } })),
  { name: 'iso_aim', debug: 'play=1,ch=2,seed=777777,dbg=isoaim,skipscenes=1', expect: { mode: 'iso', minObstacles: 1, recordOff: true } },
  ...Array.from({ length: 4 }, (_, i) => ({ name: 'boss_ch' + (i + 2), debug: `play=1,ch=${i + 2},seed=777777,dbg=boss,skipscenes=1`, expect: { state: 'playing', chapter: i + 2 } })),
  { name: 'elevator', debug: 'play=1,ch=1,seed=777777,dbg=elevator,skipscenes=1', expect: { state: 'playing' } },
  { name: 'shop', debug: 'play=1,ch=4,seed=777777,dbg=shop,skipscenes=1', expect: { state: 'shop' } },
  { name: 'npc', debug: 'play=1,ch=1,seed=777777,dbg=npc,skipscenes=1', expect: { state: 'npc' } },
  { name: 'trade', debug: 'play=1,ch=1,seed=777777,dbg=trade,skipscenes=1', expect: { tradeOpen: true } },
  { name: 'note', debug: 'play=1,ch=1,seed=777777,dbg=note,skipscenes=1', expect: { vn: true } },
  { name: 'map', debug: 'play=1,ch=1,seed=777777,dbg=map,skipscenes=1', expect: { state: 'paused', mapOpen: true } },
  { name: 'inventory', debug: 'play=1,ch=1,seed=777777,dbg=inventory,skipscenes=1', expect: { state: 'paused', invOpen: true } },
  { name: 'bossfight', debug: 'play=1,ch=2,seed=777777,dbg=bossfight,skipscenes=1', expect: { mode: 'iso', bossFight: true } },
  { name: 'deathanim', debug: 'play=1,ch=1,seed=777777,dbg=deathanim,skipscenes=1', expect: { deathAnim: true } },
  { name: 'stash', debug: 'play=1,ch=1,seed=777777,dbg=stash,skipscenes=1', expect: { state: 'minigame' } },
  { name: 'craft', debug: 'play=1,ch=1,seed=777777,dbg=craft,skipscenes=1', expect: { mode: 'iso', modalText: 'КРАФТ' } },
  { name: 'drug', debug: 'play=1,ch=1,seed=777777,dbg=drug,skipscenes=1', expect: { drugDoses: 1 } },
  { name: 'reloadtest', debug: 'play=1,ch=1,seed=777777,dbg=reloadtest,skipscenes=1', expect: { ammo: 1 } },
  { name: 'mail', debug: 'play=1,ch=1,seed=777777,dbg=mail,skipscenes=1', expect: { modalText: 'ВХОДЯЩИЕ', terminals: 2 } },
  { name: 'console', debug: 'play=1,ch=1,seed=777777,dbg=console,skipscenes=1', expect: { state: 'minigame', miniOpen: true } },
  { name: 'leg', debug: 'play=1,ch=1,seed=777777,dbg=leg,skipscenes=1', expect: { leg: 4, opm: true } },
  { name: 'puzzle_valves', debug: 'play=1,ch=2,seed=777777,dbg=puzzle,skipscenes=1', expect: { state: 'minigame' } },
  { name: 'puzzle_cameras', debug: 'play=1,ch=3,seed=777777,dbg=puzzle,skipscenes=1', expect: { state: 'minigame' } },
  { name: 'puzzle_weights', debug: 'play=1,ch=4,seed=777777,dbg=puzzle,skipscenes=1', expect: { state: 'minigame' } },
  { name: 'gamble', debug: 'play=1,ch=1,seed=777777,dbg=gamble,skipscenes=1', expect: { state: 'gambling' } },
  { name: 'shelter', debug: 'play=1,ch=1,seed=777777,dbg=shelter,skipscenes=1', expect: { state: 'playing', hidden: true } },
  { name: 'secret', debug: 'play=1,ch=1,seed=777777,dbg=secret,skipscenes=1', expect: { mode: 'iso', minObstacles: 1 } },
  { name: 'rescue', debug: 'play=1,ch=1,seed=777777,dbg=rescue,skipscenes=1', expect: { state: 'playing', rescued: 1 } },
  { name: 'cutscene', debug: 'play=1,ch=2,seed=777777,dbg=cutscene', expect: { state: 'cutscene' } },
  { name: 'choice', debug: 'play=1,ch=5,seed=777777,dbg=choice,skipscenes=1', expect: { state: 'choice' } },
  { name: 'ending', debug: 'play=1,ch=1,seed=777777,dbg=ending,skipscenes=1', expect: { modal: true } },
  { name: 'death', debug: 'play=1,ch=1,seed=777777,dbg=death,skipscenes=1', expect: { modal: true } },
  { name: 'layout', debug: 'play=1,ch=1,seed=777777,dbg=layout,skipscenes=1', expect: { editing: true } },
  { name: 'pause', debug: 'play=1,ch=1,seed=777777,dbg=pause,skipscenes=1', expect: { state: 'paused' } },
  { name: 'dev', debug: 'play=1,ch=1,seed=777777,dbg=dev,skipscenes=1', expect: { state: 'dev' } }
];

const results = [];
const device = adb(['shell', 'getprop', 'ro.product.model']).trim() + ' / Android ' + adb(['shell', 'getprop', 'ro.build.version.release']).trim();
const filter = process.argv[2] || '';
const list = filter ? scenarios.filter((s) => s.name === filter) : scenarios;

function matches(summary, expect) {
  if (!summary) return false;
  if (expect.state && summary.state !== expect.state) return false;
  if (expect.chapter && summary.chapter !== expect.chapter) return false;
  if (expect.chapterTitle && !String(summary.chapterTitle || '').includes(expect.chapterTitle)) return false;
  if (expect.mode && summary.mode !== expect.mode) return false;
  if (expect.minObstacles && summary.iso && (summary.iso.column + summary.iso.prop) < expect.minObstacles) return false;
  if (expect.rescued && summary.rescued < expect.rescued) return false;
  if (expect.secrets && summary.secrets < expect.secrets) return false;
  if (expect.hidden != null && !!summary.hidden !== expect.hidden) return false;
  if (expect.modal && !summary.modalText) return false;
  if (expect.vn && !summary.vn) return false;
  if (expect.editing != null && !!summary.editing !== expect.editing) return false;
  if (expect.invOpen != null && !!summary.invOpen !== expect.invOpen) return false;
  if (expect.tradeOpen != null && !!summary.tradeOpen !== expect.tradeOpen) return false;
  if (expect.recordOff != null && !!summary.recordOff !== expect.recordOff) return false;
  if (expect.mapOpen != null && !!summary.mapOpen !== expect.mapOpen) return false;
  if (expect.deathAnim != null && !!summary.deathAnim !== expect.deathAnim) return false;
  if (expect.bossFight != null && !!summary.bossFight !== expect.bossFight) return false;
  if (expect.drugDoses != null && summary.drugDoses !== expect.drugDoses) return false;
  if (expect.ammo != null && summary.ammo < expect.ammo) return false;
  if (expect.leg != null && summary.leg !== expect.leg) return false;
  if (expect.opm != null && !!summary.opm !== !!expect.opm) return false;
  if (expect.terminals != null && summary.terminals < expect.terminals) return false;
  if (expect.modalText && !String(summary.modalText).includes(expect.modalText)) return false;
  if (expect.vnTitle && !String(summary.vnTitle).includes(expect.vnTitle)) return false;
  return true;
}

// чистое состояние перед матрицей: старые краш-логи и сейвы не должны влиять
adb(['shell', 'pm', 'clear', PKG]);
await sleep(500);

for (const sc of list) {
  process.stdout.write(sc.name + ' ... ');
  adb(['shell', 'am', 'force-stop', PKG]);
  adb(['logcat', '-c']);
  await sleep(250);
  if (sc.debug) adb(['shell', 'am', 'start', '-n', ACT, '--es', 'debug', sc.debug]);
  else adb(['shell', 'am', 'start', '-n', ACT]);
  await sleep(4600);

  const shot = path.join(OUT, sc.name + '.png');
  const png = adb(['exec-out', 'screencap', '-p'], { buffer: true });
  let shotPath = shot;
  if (png && png.length > 1000) {
    try { fs.writeFileSync(shot, png); }
    catch (e) {
      shotPath = path.join(OUT, sc.name + '_' + Date.now() + '.png');
      try { fs.writeFileSync(shotPath, png); } catch (e2) { shotPath = ''; }
    }
  }

  let summary = null;
  let cdpErr = null;
  let cdp = null;
  try {
    cdp = await connectDevice();
    if (!cdp) throw new Error('no devtools target');
    summary = await cdp.eval(`(() => {
      const g = window.game;
      if (!g) return { boot: false, title: document.title };
      const s = {
        boot: true,
        state: g.state,
        chapter: g.chapter && g.chapter.id,
        chapterTitle: g.chapter && g.chapter.title,
        mode: g.world && g.world.mode,
        hidden: !!(g.player && g.player.hidden),
        rescued: (g.flags && g.flags.rescued) || 0,
        secrets: (g.flags && (g.flags['secret_1'] || g.flags['secret_2'] || g.flags['secret_3'] || g.flags['secret_4'] || g.flags['secret_5'])) || 0,
        modalText: document.getElementById('modal-title') ? document.getElementById('modal-title').textContent : null,
        vn: !!(document.getElementById('vn') && !document.getElementById('vn').classList.contains('hidden')),
        vnTitle: document.getElementById('vn-title') ? document.getElementById('vn-title').textContent : null,
        editing: document.body.classList.contains('editing'),
        invOpen: !document.getElementById('inv-screen').classList.contains('hidden'),
        tradeOpen: !document.getElementById('trade-screen').classList.contains('hidden'),
        recordOff: !!(document.getElementById('btn-record') && document.getElementById('btn-record').disabled),
        mapOpen: !document.getElementById('map-screen').classList.contains('hidden'),
        deathAnim: !!window.__lastDeathAnim,
        bossFight: !!(g.world && g.world.bossFight),
        drugDoses: g.player && g.player.drug ? g.player.drug.doses : 0,
        ammo: g.player ? g.player.ammo : 0,
        leg: g.rpg && g.rpg.upgrades ? (g.rpg.upgrades.leg || 0) : 0,
        opm: !!(g.player && g.player.opm),
        terminals: g.world ? g.world.objects.filter((o) => o.kind === 'mail' || o.kind === 'console').length : 0,
        puzzleId: g.world ? (g.world.objects.find((o) => o.kind === 'puzzle') || {}).puzzle : null,
        miniOpen: !!(document.getElementById('minigame') && !document.getElementById('minigame').classList.contains('hidden')),
        roomLabels: [...document.querySelectorAll('*')]
          .filter((e) => e.children.length === 0 && /КОМНАТА/.test(e.textContent || ''))
          .map((e) => ({ tag: e.tagName, id: e.id, cls: e.className, top: Math.round(e.getBoundingClientRect().top) })),
        aim: (() => {
          const p = g.player; if (!p) return null;
          let dist = 150; const a = p.angle || 0;
          for (let d = 18; d < 240; d += 6) {
            if (g.world.solidAt(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d)) { dist = d - 6; break; }
          }
          const W = g.renderer.low.width, H = g.renderer.low.height;
          const pp = RB.Iso.project(p.x, p.y, W, H);
          const cp = RB.Iso.project(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, W, H);
          return { angle: +a.toFixed(2), dist, px: Math.round(pp.x), py: Math.round(pp.y), cx: Math.round(cp.x), cy: Math.round(cp.y) };
        })(),
        iso: g.world && g.world.mode === 'iso' ? {
          wall: g.world.grid.reduce((a,row)=>a+row.filter(c=>c==='#').length,0),
          column: g.world.grid.reduce((a,row)=>a+row.filter(c=>c==='C').length,0),
          prop: g.world.grid.reduce((a,row)=>a+row.filter(c=>c==='P').length,0)
        } : null,
        objects: g.world ? g.world.objects.reduce((m,o)=>{m[o.kind]=(m[o.kind]||0)+1;return m;},{}) : null,
        enemies: g.world ? g.world.enemies.map(e=>e.type) : null,
        err: window.__lastErr || null,
        crash: (RB.CrashLog ? RB.CrashLog.list() : []).map(x=>x.m).slice(0,3),
        title: document.title,
        modal: document.getElementById('modal-title') ? document.getElementById('modal-title').textContent : null
      };
      return s;
    })()`);
  } catch (e) {
    cdpErr = e.message;
  }
  if (cdp) { try { cdp.ws.close(); } catch (e) {} }

  const log = adb(['logcat', '-d', '-v', 'brief']);
  const bad = log.split(/\r?\n/).filter((l) =>
    /FATAL EXCEPTION|RBSTACK|AndroidRuntime.*ru\.rustybarrel|chromium.*(Uncaught|ERROR)|E\/chromium|Unhandled Promise/i.test(l) &&
    !/RecentUncaughtExceptionHandler|SpecialLayer|page_load_metrics|Invalid first_paint|cr_ChromiumAndroidLinker|android_dlopen_ext|ssl_client_socket_impl|handshake failed|net_error -101/i.test(l)
  ).slice(0, 6);

  const expected = matches(summary, sc.expect || {});
  const ok = !!summary && summary.boot && !summary.err && (!summary.crash || summary.crash.length === 0) && bad.length === 0 && expected;
  results.push({ name: sc.name, debug: sc.debug, ok, expected, summary, cdpErr, log: bad, shot: path.relative(process.cwd(), shot) });
  console.log(ok ? 'PASS' : 'FAIL', summary ? `state=${summary.state} ch=${summary.chapter} mode=${summary.mode}` : (cdpErr || 'no summary'));
  if (!ok) console.log('   ', JSON.stringify({ expected, summary, cdpErr, bad }));
}

adb(['forward', '--remove-all']);
const report = { device, date: new Date().toISOString(), passed: results.filter((r) => r.ok).length, total: results.length, results };
fs.writeFileSync(path.join(process.cwd(), 'tools', 'device-matrix.json'), JSON.stringify(report, null, 2));

let md = `# Матрица устройств · ${device}\n\nДата: ${new Date().toISOString().slice(0, 10)}. Проверок: ${report.passed}/${report.total}.\n\n| Локация | Статус | Состояние | Объекты | Ошибки | Скриншот |\n|---|---|---|---|---|---|\n`;
for (const r of results) {
  const s = r.summary || {};
  const objs = s.objects ? Object.entries(s.objects).map(([k, v]) => k + ':' + v).join(' ') : '—';
  const err = (r.log.length ? r.log.join(' ').slice(0, 160) : (s.err || (s.crash && s.crash[0]) || (r.cdpErr || '—')));
  md += `| ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${s.state || '—'} · ch${s.chapter || '—'} · ${s.mode || '—'} | ${objs} | ${String(err).replace(/\|/g, '/')} | \`${r.shot}\` |\n`;
}
fs.writeFileSync(path.join(process.cwd(), 'docs', 'DEVICE_MATRIX.md'), md);
console.log(`\nSUMMARY ${report.passed}/${report.total}`);
process.exitCode = report.passed === report.total ? 0 : 1;
