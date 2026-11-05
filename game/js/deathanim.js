/* RUSTY BARREL — анимации смерти: пожирание, бочка, удушье (v2) */
(function () {
  const RB = (window.RB = window.RB || {});

  RB.DeathAnim = {
    playing: false,
    play(type, onDone) {
      if (this.playing) { onDone && onDone(); return; }
      this.playing = true;
      window.__lastDeathAnim = type;
      const cv = document.createElement('canvas');
      cv.id = 'death-anim';
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:55;pointer-events:none;background:rgba(3,3,2,0.55);';
      document.body.appendChild(cv);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth, h = window.innerHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t0 = performance.now();
      const dur = type === 'barrel' ? 3000 : 2600;
      const blood = [];
      for (let i = 0; i < 60; i++) blood.push({ x: w * 0.5 + RB.rand(-40, 40), y: h * 0.5 + RB.rand(-30, 30), vx: RB.rand(-160, 160), vy: RB.rand(-220, 40), s: RB.rand(1, 4) });

      const drawPlayer = (x, y, s, rot, clutch) => {
        g.save();
        g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
        g.fillStyle = '#b08a6c';
        g.fillRect(-4, -16, 8, 7); // голова
        g.fillStyle = '#3f4a58';
        g.fillRect(-6, -9, 12, 14); // пальто
        g.strokeStyle = '#2c333d'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-5, -7); g.lineTo(clutch ? -2 : -9, clutch ? -15 : 2); g.stroke();
        g.beginPath(); g.moveTo(5, -7); g.lineTo(clutch ? 2 : 9, clutch ? -15 : 2); g.stroke();
        g.strokeStyle = '#171a1f';
        g.beginPath(); g.moveTo(-3, 5); g.lineTo(-3, 17); g.moveTo(3, 5); g.lineTo(3, 17); g.stroke();
        g.restore();
      };

      const drawMonster = (x, y, s, lunge) => {
        g.save();
        g.translate(x, y); g.scale(s, s);
        g.fillStyle = '#141210';
        g.beginPath();
        g.moveTo(-22, 10); g.lineTo(-18, -34); g.lineTo(-4, -48); g.lineTo(10, -46);
        g.lineTo(20, -30); g.lineTo(24, 8); g.closePath(); g.fill();
        g.fillStyle = '#2a241c';
        g.fillRect(-12, -40, 24, 30);
        g.fillStyle = '#a3271b';
        g.fillRect(-9, -36 + lunge * 6, 5, 3);
        g.fillRect(4, -36 + lunge * 6, 5, 3);
        g.fillStyle = '#e8e0d0';
        for (let i = -2; i <= 2; i++) g.fillRect(i * 7, -8 + lunge * 4, 3, 9);
        g.fillStyle = '#5a120c';
        g.fillRect(-10 + lunge * 4, 2, 20, 5);
        g.strokeStyle = '#141210'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(-16, -20); g.lineTo(-30 - lunge * 10, -4 + lunge * 10); g.stroke();
        g.beginPath(); g.moveTo(16, -20); g.lineTo(30 + lunge * 10, -4 + lunge * 10); g.stroke();
        g.restore();
      };

      const drawBarrel = (x, y, s, roll) => {
        g.save();
        g.translate(x, y); g.scale(s, s); g.rotate(roll || 0);
        g.fillStyle = '#4a2f1e';
        g.beginPath(); g.ellipse(0, 0, 42, 54, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1a120e'; g.lineWidth = 6;
        g.beginPath(); g.ellipse(0, -30, 40, 10, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(0, 30, 40, 10, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#8a2a1e';
        g.fillRect(-14, -10, 28, 6);
        g.fillStyle = '#c9a05a'; g.font = 'bold 14px monospace'; g.textAlign = 'center';
        g.fillText('№9', 0, 4);
        g.restore();
      };

      const frame = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        g.clearRect(0, 0, w, h);
        g.fillStyle = 'rgba(3,3,2,' + (0.35 + t * 0.42) + ')';
        g.fillRect(0, 0, w, h);
        const cx = w * 0.5, cy = h * 0.62;

        if (type === 'devour') {
          const lunge = t < 0.55 ? Math.min(1, t / 0.35) : 1;
          drawPlayer(cx, cy, 1.15, 0, false);
          drawMonster(cx + 150 - lunge * 120, cy - 6, 1.25 + lunge * 0.25, lunge);
          if (t > 0.4) {
            for (const b of blood) {
              b.x += b.vx * 0.016; b.y += b.vy * 0.016; b.vy += 380 * 0.016;
              g.fillStyle = 'rgba(140,18,12,' + Math.max(0, 1 - t) + ')';
              g.fillRect(b.x, b.y, b.s, b.s);
            }
          }
          g.fillStyle = 'rgba(220,200,170,0.85)';
          g.font = '18px Georgia, serif'; g.textAlign = 'center';
          g.fillText('ОН НЕ УБИВАЕТ. ОН ЕСТ.', cx, h * 0.16);
        } else if (type === 'barrel') {
          const drop = Math.min(1, t / 0.58);
          drawPlayer(cx, cy - 120 + drop * 110, 1.1, drop * 1.3, false);
          drawBarrel(cx, cy + 52, 1.05, Math.sin(t * 18) * 0.08);
          if (t > 0.5) {
            g.fillStyle = 'rgba(232,232,220,0.5)';
            for (let i = 0; i < 26; i++) {
              const a = (i / 26) * Math.PI * 2;
              g.fillRect(cx + Math.cos(a) * (30 + t * 40), cy + 10 + Math.sin(a) * (20 + t * 20), 2, 2);
            }
          }
          g.fillStyle = 'rgba(220,200,170,0.85)';
          g.font = '18px Georgia, serif'; g.textAlign = 'center';
          g.fillText('СМЕНА ПРИНЯТА. РАССОЛ ТЁПЛЫЙ.', cx, h * 0.16);
        } else {
          drawPlayer(cx, cy, 1.15, t * 0.8, true);
          g.fillStyle = 'rgba(140,18,12,' + (0.25 + Math.abs(Math.sin(t * 9)) * 0.35) + ')';
          g.fillRect(0, 0, w, h);
          g.fillStyle = 'rgba(220,200,170,0.9)';
          g.font = '18px Georgia, serif'; g.textAlign = 'center';
          g.fillText('ГОРЛО СЖИМАЕТСЯ. ВОЗДУХА НЕТ.', cx, h * 0.16);
        }

        if (t < 1) requestAnimationFrame(frame);
        else {
          cv.style.transition = 'opacity 0.4s';
          cv.style.opacity = '0';
          setTimeout(() => {
            cv.remove();
            RB.DeathAnim.playing = false;
            onDone && onDone();
          }, 420);
        }
      };
      requestAnimationFrame(frame);
    }
  };
})();
