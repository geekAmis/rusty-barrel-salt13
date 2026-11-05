import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9777;
const BASE = 'http://127.0.0.1:8123/game/index.html';
const DIR = path.join(process.cwd(), 'tools', 'trailer-frames');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

function waitHttp(url, tries = 80) {
  return new Promise((resolve, reject) => {
    const tick = (n) => http.get(url, (res) => { res.resume(); resolve(); }).on('error', () => {
      if (n <= 0) reject(new Error('no debug endpoint')); else setTimeout(() => tick(n - 1), 250);
    });
    tick(tries);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = {};
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      } else if (m.method && this.handlers[m.method]) this.handlers[m.method](m.params);
    });
  }
  on(method, fn) { this.handlers[method] = fn; }
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

const clickTile = (i) => `(function(){const t=[...document.querySelectorAll('.inv-item')][${i}];if(!t)return;const r=t.getBoundingClientRect();t.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));})()`;
const clickButtonText = (text) => `(function(){const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&x.textContent.trim().includes(${JSON.stringify(text)}));if(b)b.click();})()`;

const scenarios = [
  { name: 'menu', url: BASE, wait: 5200, dur: 2400, snap: true },

  { name: 'game', url: BASE + '?play=1&ch=1&seed=777777&skipscenes=1', wait: 3000, dur: 10500,
    setup: `(function(){
      const g=window.game; if(!g||!g.player) return;
      g.player.flashlight=true;
      window.__tf=setInterval(()=>{
        const g=window.game,p=g.player,w=g.world;
        if(!p||g.state!=='playing') return;
        let best=null,bd=1e9;
        for(const e of w.enemies){ if(e.dead)continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<bd){bd=d;best=e;} }
        if(best&&bd<340){
          p.angle=Math.atan2(best.y-p.y,best.x-p.x);
          if(p.ammo<=0){ p.ammo=12; }
          p.fireCd=0; p.tryShoot(w,g);
        }
        const t=performance.now();
        g.input.keys.d=Math.sin(t/850)>-0.25;
        g.input.keys.a=Math.sin(t/850)<=-0.25;
        g.input.keys.w=Math.cos(t/1150)>0.05;
        g.input.keys.s=Math.cos(t/1150)<=0.05;
      },150);
    })()` },

  { name: 'inventory', url: BASE + '?play=1&ch=1&seed=777777&skipscenes=1', wait: 3000, dur: 4800,
    setup: `(function(){
      const g=window.game;
      const reset=()=>{ try{ if(g.ui.invScreen)g.ui.invScreen.scrollTop=0; if(g.ui.invBody)g.ui.invBody.scrollTop=0; window.scrollTo(0,0); }catch(e){} };
      g.addItem('ammo_9x18',3); g.addItem('ammo_9x18',32);
      g.openInventory(); reset();
      setTimeout(()=>{${clickTile(0)};reset();},900);
      setTimeout(()=>{${clickTile(3)};reset();},1900);
      setTimeout(()=>{
        const p=g.player; let a=null,b=null;
        for(const k of ['backpack','pockets']){ for(const it of p.inv[k].items){ if(it.id==='ammo_9x18'){ if(!a)a=it; else b=it; } } }
        if(a&&b){ g.mergeAmmo(a.uid,b.uid); }
        g.openInventory(); reset();
      },3100);
      setTimeout(reset,3600);
    })()` },

  { name: 'trade', url: BASE + '?play=1&ch=1&seed=777777&dbg=trade&skipscenes=1', wait: 3000, dur: 4800,
    setup: `(function(){
      setTimeout(()=>{const t=document.querySelector('.trade-tile');if(t)t.click();},900);
      setTimeout(()=>${clickButtonText('КУПИТЬ')},2200);
      setTimeout(()=>{const t=[...document.querySelectorAll('.trade-tile')][3];if(t)t.click();},3300);
    })()` },

  { name: 'dialog', url: BASE + '?play=1&ch=1&seed=777777&dbg=npc&skipscenes=1', wait: 3000, dur: 4800,
    setup: `(function(){
      setTimeout(()=>${clickButtonText('О ЧЁМ ЭТО')},1000);
      setTimeout(()=>${clickButtonText('КТО ТЫ')},2200);
      setTimeout(()=>${clickButtonText('ЕЩЁ ВОПРОС')},3400);
      setTimeout(()=>${clickButtonText('ЧТО ЗДЕСЬ')},4300);
    })()` },

  { name: 'cutscene', url: BASE + '?play=1&ch=2&seed=777777&dbg=cutscene', wait: 3200, dur: 4800,
    setup: `(function(){
      setTimeout(()=>${clickButtonText('ДАЛЬШЕ')},1000);
      setTimeout(()=>${clickButtonText('ДАЛЬШЕ')},2300);
      setTimeout(()=>${clickButtonText('ДАЛЬШЕ')},3500);
    })()` },

  { name: 'stash', url: BASE + '?play=1&ch=1&seed=777777&dbg=stash&skipscenes=1', wait: 3000, dur: 4200,
    setup: `(function(){
      setTimeout(()=>{
        const cv=document.querySelector('#minigame canvas');
        if(!cv) return;
        const r=cv.getBoundingClientRect(); let k=-1.2;
        window.__lp=setInterval(()=>{
          k+=0.22;
          cv.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width/2+Math.cos(k)*90,clientY:r.top+r.height/2+Math.sin(k)*90}));
        },80);
      },700);
      setTimeout(()=>${clickButtonText('ДАВИТЬ')},1700);
      setTimeout(()=>${clickButtonText('ДАВИТЬ')},3000);
    })()` },

  { name: 'boss', url: BASE + '?play=1&ch=2&seed=777777&dbg=bossfight&skipscenes=1', wait: 3200, dur: 6800,
    setup: `(function(){
      window.__tf=setInterval(()=>{
        const g=window.game,p=g.player,w=g.world;
        if(!p||g.state!=='playing') return;
        const b=w.enemies.find(e=>e.def&&e.def.isBoss&&!e.dead);
        if(b){ p.angle=Math.atan2(b.y-p.y,b.x-p.x); if(p.ammo<=0)p.ammo=12; p.fireCd=0; p.tryShoot(w,g); }
        const t=performance.now();
        g.input.keys.d=Math.sin(t/600)>0; g.input.keys.a=Math.sin(t/600)<=0;
        g.input.keys.w=Math.cos(t/700)>0; g.input.keys.s=Math.cos(t/700)<=0;
      },170);
    })()` },

  { name: 'map', url: BASE + '?play=1&ch=1&seed=777777&dbg=map&skipscenes=1', wait: 3000, dur: 4800,
    setup: `(function(){
      const g=window.game; g.explored=g.explored||{};
      const rooms=(g.world&&g.world.rooms)||[];
      for(let i=0;i<rooms.length;i++){
        const r=rooms[i];
        const objects=(g.world.objects||[]).filter(o=>o.x>=r.x-40&&o.x<=r.x+r.w+40&&o.y>=r.y-40&&o.y<=r.y+r.h+40).map(o=>({x:o.x,y:o.y,kind:o.kind}));
        const enemies=(g.world.enemies||[]).filter(e=>!e.dead&&e.x>=r.x-40&&e.x<=r.x+r.w+40&&e.y>=r.y-40&&e.y<=r.y+r.h+40).map(e=>({x:e.x,y:e.y,boss:!!(e.def&&e.def.isBoss)}));
        g.explored['ch'+g.chapterIndex+':'+i]={name:r.name,x:r.x,y:r.y,w:r.w,h:r.h,objects,enemies,visitedAt:Date.now()};
      }
      if(window.RB&&RB.MapView) RB.MapView.open(g, ()=>{});
      setTimeout(()=>{ RB.MapView.view.zoom=1.6; RB.MapView.view.ox=40; RB.MapView.view.oy=20; RB.MapView.draw(); },1400);
      setTimeout(()=>{ RB.MapView.view.zoom=2.1; RB.MapView.view.ox=-30; RB.MapView.draw(); },2800);
    })()` },

  { name: 'ending', url: BASE + '?play=1&ch=1&seed=777777&dbg=ending&skipscenes=1', wait: 2800, dur: 3600 }
];

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run',
  '--window-size=1280,720', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(process.env.TEMP || '.', 'rb-capture-' + Date.now()),
  'about:blank'
], { stdio: 'ignore' });

try {
  await waitHttp(`http://127.0.0.1:${PORT}/json/version`);
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });

  let frame = 0;
  const times = [];
  const startWall = Date.now();
  cdp.on('Page.screencastFrame', (p) => {
    try {
      fs.writeFileSync(path.join(DIR, 'f' + String(frame).padStart(4, '0') + '.jpg'), Buffer.from(p.data, 'base64'));
      times.push(Date.now() - startWall);
      frame++;
    } catch (e) {}
    cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });

  const ranges = [];
  for (const sc of scenarios) {
    const nav = Date.now() - startWall;
    await cdp.send('Page.navigate', { url: sc.url });
    await sleep(sc.wait);
    if (sc.setup) { try { await cdp.eval(sc.setup); } catch (e) { console.log('setup', sc.name, e.message); } }
    const keepStart = Date.now() - startWall;
    if (sc.snap) {
      const t0 = Date.now();
      while (Date.now() - t0 < sc.dur) {
        try {
          const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
          fs.writeFileSync(path.join(DIR, 'f' + String(frame).padStart(4, '0') + '.jpg'), Buffer.from(r.data, 'base64'));
          times.push(Date.now() - startWall);
          frame++;
        } catch (e) {}
        await sleep(20);
      }
    } else {
      await sleep(sc.dur);
    }
    const keepEnd = Date.now() - startWall;
    ranges.push({ name: sc.name, nav, keepStart, keepEnd, dur: sc.dur });
    console.log(sc.name, 'frames', frame, 'keep', (keepStart / 1000).toFixed(1), '-', (keepEnd / 1000).toFixed(1));
  }
  await sleep(300);
  await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(DIR, 'meta.json'), JSON.stringify({ frame, times, ranges, total: Date.now() - startWall }, null, 2));
  console.log('TOTAL', frame, 'ms', Date.now() - startWall);
  ws.close();
} finally { edge.kill(); }
