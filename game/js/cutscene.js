/* RUSTY BARREL — визуальные катсцены (v2) */
(function () {
  const RB = (window.RB = window.RB || {});

  const BG = {
    laboratory: ['#1a2420', '#0a0d0b', '#39504a'],
    archive: ['#2a2418', '#0d0a06', '#5a4a2a'],
    flooded: ['#16262a', '#070d0e', '#3a5a5e'],
    gate: ['#1e2420', '#080a08', '#4a5a4a'],
    mother: ['#241c16', '#0b0806', '#5a3a28'],
    cult: ['#2a1a14', '#0e0705', '#6a2a1a'],
    capture: ['#1a1410', '#080605', '#4a3520'],
    cell: ['#141a1a', '#060808', '#2a3a3a'],
    interrogation: ['#1a1814', '#080706', '#4a4030'],
    escape: ['#141a16', '#060807', '#2a4a3a'],
    bossBarrel: ['#1a0e0a', '#080403', '#5a1a10'],
    asya: ['#16262a', '#070d0e', '#3a6a6e']
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;background:#050403;';
    return c;
  }

  RB.Cutscene = {
    active: null,
    play(ui, scene, onDone) {
      if (!scene) { onDone && onDone(); return; }
      if (this.active) this.active.close(true);
      const host = document.createElement('div');
      host.id = 'cutscene';
      host.style.cssText = 'position:fixed;inset:0;z-index:60;background:#050403;overflow:hidden;';
      document.body.appendChild(host);
      const cv = makeCanvas(window.innerWidth, window.innerHeight);
      host.appendChild(cv);
      const g = cv.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize = () => {
        cv.width = Math.floor(window.innerWidth * dpr);
        cv.height = Math.floor(window.innerHeight * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      const panel = document.createElement('div');
      panel.style.cssText = 'position:absolute;z-index:2;left:4%;right:4%;bottom:4%;min-height:30%;max-height:46%;padding:14px 18px;background:rgba(8,10,7,0.92);border:2px solid #6a6a3a;box-shadow:0 0 0 1px #000, 8px 8px 0 rgba(0,0,0,0.7);font-family:"Courier New",monospace;color:#c8d0b8;overflow:auto;';
      host.appendChild(panel);
      const kicker = document.createElement('div');
      kicker.style.cssText = 'font-size:10px;letter-spacing:.32em;color:#7fae86;';
      kicker.textContent = scene.kicker || '';
      const title = document.createElement('div');
      title.style.cssText = 'font:700 24px/1.1 Georgia,serif;color:#e8e0c0;margin:4px 0;letter-spacing:.06em;';
      title.textContent = scene.title || '';
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:11px;color:#8a9a7a;margin-bottom:8px;';
      sub.textContent = scene.subtitle || '';
      const line = document.createElement('div');
      line.id = 'cutscene-line';
      line.style.cssText = 'font-size:15px;line-height:1.5;color:#d8e0c8;min-height:48px;';
      panel.appendChild(kicker); panel.appendChild(title); panel.appendChild(sub); panel.appendChild(line);
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px;';
      const next = document.createElement('button');
      next.type = 'button'; next.textContent = 'ДАЛЬШЕ';
      next.style.cssText = 'padding:7px 16px;background:#12180e;border:1px solid #7fae86;color:#e8f0d8;font:11px "Courier New",monospace;';
      const skip = document.createElement('button');
      skip.type = 'button'; skip.textContent = 'ПРОПУСТИТЬ';
      skip.style.cssText = 'padding:7px 16px;background:#12180e;border:1px solid #4a4a2e;color:#c8d0b8;font:11px "Courier New",monospace;';
      bar.appendChild(next); bar.appendChild(skip); panel.appendChild(bar);

      const key = Object.keys(BG).find((k) => (scene.kicker || '').toLowerCase().includes(k) || (scene.title || '').toLowerCase().includes(k)) || 'gate';
      const pal = BG[key] || BG.gate;
      const actorZ = key === 'asya' ? -1 : key === 'mother' ? 3 : key === 'cult' ? 3 : 3;
      const portrait = RB.Assets ? RB.Assets.img(key === 'asya' ? 'assets/sprites/girl_idle.png' : 'assets/sprites/zombie' + actorZ + '_walk.png') : null;
      const playerSheet = RB.Assets ? RB.Assets.img('assets/sprites/player_walk.png') : null;
      let idx = 0, closed = false, typing = null, timer = null;

      const drawBackdrop = (t) => {
        const w = cv.width / dpr, h = cv.height / dpr;
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, pal[0]); grd.addColorStop(1, pal[1]);
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        // стены/пол
        g.fillStyle = pal[2]; g.globalAlpha = 0.25;
        for (let x = 0; x < w; x += 72) g.fillRect(x, 0, 2, h * 0.72);
        g.globalAlpha = 0.5; g.fillRect(0, h * 0.72, w, h * 0.28);
        g.globalAlpha = 1;
        // лампы
        for (let x = w * 0.15; x < w; x += w * 0.24) {
          const flick = 0.35 + Math.abs(Math.sin(t * 2 + x)) * 0.4;
          g.fillStyle = 'rgba(232,220,194,' + flick * 0.22 + ')';
          g.beginPath(); g.arc(x, h * 0.15, 26, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#2a2620'; g.fillRect(x - 8, h * 0.1, 16, 4);
        }
        // бочки
        for (let i = 0; i < 3; i++) {
          const bx = w * 0.1 + i * w * 0.08;
          g.fillStyle = '#3a2a1e'; g.fillRect(bx, h * 0.6, 30, 60);
          g.fillStyle = '#1a120e'; g.fillRect(bx, h * 0.6 + 10, 30, 4); g.fillRect(bx, h * 0.6 + 46, 30, 4);
        }
        // туман/дождь
        g.strokeStyle = 'rgba(180,200,190,0.08)';
        for (let i = 0; i < 40; i++) {
          const x = (i * 97 + t * 40) % w;
          const y = (i * 53 + t * 120) % (h * 0.7);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 12); g.stroke();
        }
      };

      const drawActor = (im, x, y, scale, flip, frame, frames) => {
        if (!RB.Assets || !RB.Assets.ready(im)) return;
        const fw = im.naturalWidth / frames;
        const sw = fw, sh = im.naturalHeight;
        g.save();
        if (flip) { g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0); }
        g.drawImage(im, Math.floor(frame % frames) * fw, 0, sw, sh, x - 64 * scale, y - 128 * scale, 128 * scale, 128 * scale);
        g.restore();
      };

      const draw = (now) => {
        if (closed) return;
        const t = now / 1000;
        drawBackdrop(t);
        const w = cv.width / dpr, h = cv.height / dpr;
        // игрок
        drawActor(playerSheet, w * 0.28, h * 0.72, 1.1, true, Math.floor(t * 7), Math.max(1, playerSheet ? Math.round(playerSheet.naturalWidth / playerSheet.naturalHeight) : 1));
        // собеседник/угроза
        if (key === 'asya' && RB.Assets) drawActor(RB.Assets.img('assets/sprites/girl_idle.png'), w * 0.68, h * 0.72, 1.0, false, Math.floor(t * 4), 8);
        else drawActor(portrait, w * 0.7, h * 0.72, 1.25, false, Math.floor(t * 5), Math.max(1, portrait ? Math.round(portrait.naturalWidth / portrait.naturalHeight) : 1));
        // виньетка
        const vg = g.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.9);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
        g.fillStyle = vg; g.fillRect(0, 0, w, h);
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);

      const finish = () => {
        if (closed) return;
        closed = true;
        if (typing) clearInterval(typing);
        if (timer) clearTimeout(timer);
        window.removeEventListener('resize', resize);
        host.remove();
        this.active = null;
        onDone && onDone();
      };
      const show = () => {
        if (idx >= scene.lines.length) { finish(); return; }
        const text = scene.lines[idx++];
        line.textContent = '';
        if (typing) clearInterval(typing);
        let ci = 0;
        typing = setInterval(() => {
          ci += 2;
          line.textContent = text.slice(0, ci);
          if (ci >= text.length) { clearInterval(typing); typing = null; }
        }, 20);
        clearTimeout(timer);
        timer = setTimeout(show, Math.max(1900, scene.speed || 2400));
      };
      next.onclick = () => { if (typing) { clearInterval(typing); typing = null; line.textContent = scene.lines[Math.max(0, idx - 1)]; } else show(); };
      skip.onclick = finish;
      host.addEventListener('click', (e) => { if (e.target === host || e.target === cv) next.click(); });
      window.addEventListener('resize', resize);
      this.active = { close: finish };
      show();
    }
  };
})();
