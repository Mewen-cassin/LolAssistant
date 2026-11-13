/* Animated background, one scene per theme, drawn on a fixed canvas behind the UI.
   sakura: falling petals · dark: drifting network · sunset: rising embers + sun glow · nighttime: stars + shooting stars. */
(() => {
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  let W = 0;
  let H = 0;
  let scene = null;
  let raf = 0;
  let last = 0;
  let t = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Reads a hex CSS variable such as --accent as [r, g, b]. */
  function cssRgb(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- scenes: each has init(), step(dt), draw() ---------- */
  const scenes = {
    sakura() {
      const petals = Array.from({ length: 42 }, () => spawn(true));
      function spawn(anywhere) {
        return {
          x: rand(-40, W + 40), y: anywhere ? rand(-20, H) : rand(-60, -10),
          s: rand(5, 12), vy: rand(24, 58), drift: rand(8, 26), amp: rand(14, 40),
          freq: rand(0.5, 1.4), ph: rand(0, 6.28), rot: rand(0, 6.28), vr: rand(-1.2, 1.2),
          flip: rand(0.8, 2.2), a: rand(0.55, 0.9), tone: Math.random(),
        };
      }
      return {
        step(dt) {
          for (const p of petals) {
            p.y += p.vy * dt;
            p.x += (p.drift + Math.sin(t * p.freq + p.ph) * p.amp) * dt;
            p.rot += p.vr * dt;
            if (p.y > H + 20 || p.x > W + 60) Object.assign(p, spawn(false));
          }
        },
        draw() {
          for (const p of petals) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(Math.max(0.25, Math.abs(Math.cos(t * p.flip + p.ph))), 1); // tumbling
            ctx.globalAlpha = p.a;
            ctx.fillStyle = p.tone > 0.5 ? '#ff9db9' : '#ffc1d4';
            ctx.beginPath();
            ctx.moveTo(0, -p.s);
            ctx.bezierCurveTo(p.s * 0.95, -p.s * 0.55, p.s * 0.8, p.s * 0.65, 0, p.s);
            ctx.bezierCurveTo(-p.s * 0.8, p.s * 0.65, -p.s * 0.95, -p.s * 0.55, 0, -p.s);
            ctx.fill();
            ctx.restore();
          }
        },
      };
    },

    dark() {
      const [r, g, b] = cssRgb('--accent', [108, 140, 255]);
      const dots = Array.from({ length: 52 }, () => ({
        x: rand(0, W), y: rand(0, H), vx: rand(-14, 14), vy: rand(-14, 14), r: rand(1, 2.2),
      }));
      return {
        step(dt) {
          for (const d of dots) {
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            if (d.x < 0 || d.x > W) d.vx *= -1;
            if (d.y < 0 || d.y > H) d.vy *= -1;
          }
        },
        draw() {
          for (let i = 0; i < dots.length; i++) {
            const a = dots[i];
            for (let j = i + 1; j < dots.length; j++) {
              const d = dots[j];
              const dist = Math.hypot(a.x - d.x, a.y - d.y);
              if (dist < 130) {
                ctx.strokeStyle = `rgba(${r},${g},${b},${0.2 * (1 - dist / 130)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(d.x, d.y);
                ctx.stroke();
              }
            }
          }
          ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
          for (const d of dots) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, 6.283);
            ctx.fill();
          }
        },
      };
    },

    sunset() {
      const embers = Array.from({ length: 60 }, () => spawn(true));
      function spawn(anywhere) {
        return {
          x: rand(0, W), y: anywhere ? rand(0, H) : H + rand(0, 30),
          vy: rand(-70, -22), sway: rand(10, 28), freq: rand(0.6, 1.6), ph: rand(0, 6.28),
          r: rand(1, 3.4), a: rand(0.35, 0.9), warm: Math.random(),
        };
      }
      return {
        step(dt) {
          for (const e of embers) {
            e.y += e.vy * dt;
            e.x += Math.sin(t * e.freq + e.ph) * e.sway * dt;
            if (e.y < -10) Object.assign(e, spawn(false));
          }
        },
        draw() {
          // Sun glow resting on the bottom edge, gently breathing.
          const pulse = 0.85 + Math.sin(t * 0.8) * 0.15;
          const rad = Math.max(W, H) * 0.55 * pulse;
          const grad = ctx.createRadialGradient(W * 0.5, H * 1.08, 10, W * 0.5, H * 1.08, rad);
          grad.addColorStop(0, 'rgba(255,170,90,0.55)');
          grad.addColorStop(0.45, 'rgba(255,100,110,0.22)');
          grad.addColorStop(1, 'rgba(255,100,110,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
          for (const e of embers) {
            const rgb = e.warm > 0.5 ? '255,190,100' : '255,120,140';
            const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
            halo.addColorStop(0, `rgba(${rgb},${e.a})`);
            halo.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r * 4, 0, 6.283);
            ctx.fill();
          }
        },
      };
    },

    nighttime() {
      const stars = Array.from({ length: 140 }, () => ({
        x: rand(0, W), y: rand(0, H * 0.9), r: rand(0.4, 1.6), sp: rand(0.8, 3), ph: rand(0, 6.28),
      }));
      let shooting = null;
      let nextShot = rand(2, 5);
      return {
        step(dt) {
          nextShot -= dt;
          if (nextShot <= 0 && !shooting) {
            shooting = { x: rand(W * 0.2, W * 0.9), y: rand(0, H * 0.35), life: 0 };
            nextShot = rand(5, 11);
          }
          if (shooting) {
            shooting.life += dt;
            shooting.x -= 520 * dt;
            shooting.y += 260 * dt;
            if (shooting.life > 1.1) shooting = null;
          }
        },
        draw() {
          for (const s of stars) {
            const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
            ctx.fillStyle = `rgba(235,240,255,${a})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, 6.283);
            ctx.fill();
          }
          if (shooting) {
            const fade = 1 - shooting.life / 1.1;
            const grad = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x + 130, shooting.y - 65);
            grad.addColorStop(0, `rgba(255,255,255,${fade})`);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(shooting.x, shooting.y);
            ctx.lineTo(shooting.x + 130, shooting.y - 65);
            ctx.stroke();
          }
        },
      };
    },
  };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    t += dt;
    ctx.clearRect(0, 0, W, H);
    scene.step(dt);
    scene.draw();
  }

  function start(theme) {
    cancelAnimationFrame(raf);
    resize();
    scene = (scenes[theme] || scenes.dark)();
    if (reduced) {
      // One still frame, no loop, for people who asked for less motion.
      ctx.clearRect(0, 0, W, H);
      scene.draw();
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('themechange', (e) => start(e.detail));
  window.addEventListener('resize', () => start(document.documentElement.dataset.theme));
  start(document.documentElement.dataset.theme);
})();
