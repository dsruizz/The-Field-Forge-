/* Partículas sobre un lienzo: brasas y ceniza de fogata, llamas, niebla, destellos arcanos y lluvia.
   Lo usan la portada, la mesa del DM y el proyector.

     const p = Forja.particulas(lienzo, 'brasas', { color: 'verde', origen: 'fogata' });
     p.parar();
*/
(() => {
  const F = window.Forja;
  const PALETAS = {
    verde: ['170,212,49', '253,225,52', '214,240,140'],
    fuego: ['255,138,42', '253,225,52', '200,60,40'],
    azul: ['120,146,220', '217,217,217', '90,110,190'],
    rojo: ['200,60,48', '255,138,42', '159,44,39'],
    papel: ['217,217,217', '190,190,190', '240,240,240']
  };
  const azar = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  // Un punto de luz difuso por color, dibujado una vez y reutilizado: mucho más barato que sombrear cada partícula.
  const cache = {};
  const brillo = rgb => {
    if (cache[rgb]) return cache[rgb];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(.25, `rgba(${rgb},.55)`); g.addColorStop(.6, `rgba(${rgb},.12)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (cache[rgb] = c);
  };

  const TIPOS = {
    /* Brasas que suben de una fogata, con copos de ceniza que flotan más despacio. */
    brasas: {
      mezcla: 'lighter',
      cantidad: (w, h, o) => Math.round(Math.min(190, Math.max(36, w * h / 9500)) * (o.densidad || 1)),
      nueva(m, o, inicial) {
        const ceniza = Math.random() < .3, k = Math.max(1, Math.min(2.2, m.w / 1300));
        const p = {
          ceniza, x: o.origen === 'ancho' ? azar(0, m.w) : m.w * (.5 + gauss() * .2), y: m.h + azar(4, 30),
          vx: azar(-22, 22), vy: -azar(ceniza ? 30 : 55, ceniza ? 70 : 170) * Math.max(.7, m.h / 800),
          r: (ceniza ? azar(1.4, 3.2) : azar(1.2, 3.6)) * k, vida: azar(4.5, 10), edad: 0, fase: azar(0, 6.28), giro: azar(-2, 2),
          c: o.paleta[Math.random() < .62 ? 0 : Math.random() < .7 ? 1 : 2]
        };
        if (inicial) { p.edad = azar(0, p.vida); p.y += p.vy * p.edad; p.x += gauss() * 60 * (p.edad / p.vida); }
        return p;
      },
      paso(p, dt, t, m, v) {
        p.edad += dt;
        p.x += (p.vx + Math.sin(t * 1.3 + p.fase) * (p.ceniza ? 22 : 13) + Math.sin(t * .37 + p.fase * 2) * 9) * dt * v;
        p.y += p.vy * dt * v; p.vy *= 1 - .06 * dt;
        return p.edad < p.vida && p.y > -20;
      },
      dibujar(x, p, t) {
        const f = p.edad / p.vida, a = Math.min(1, p.edad / .35) * Math.min(1, (1 - f) * 1.8);
        if (p.ceniza) {
          x.save(); x.translate(p.x, p.y); x.rotate(p.fase + t * p.giro);
          x.fillStyle = `rgba(168,168,160,${a * .5})`; x.fillRect(-p.r, -p.r * .35, p.r * 2, p.r * .7); x.restore();
          return;
        }
        const parpadeo = .68 + .32 * Math.sin(t * 9 + p.fase), d = p.r * 9 * (1 - f * .35);
        x.globalAlpha = a * parpadeo * .85; x.drawImage(brillo(p.c), p.x - d / 2, p.y - d / 2, d, d);
        x.globalAlpha = a; x.fillStyle = 'rgba(255,255,225,.95)';
        x.beginPath(); x.arc(p.x, p.y, p.r * .42 * (1 - f * .5), 0, 6.283); x.fill();
        x.globalAlpha = 1;
      }
    },
    /* Fuego: lenguas que nacen abajo, brillantes al principio y del color base al apagarse. */
    llamas: {
      mezcla: 'lighter',
      cantidad: (w, h, o) => Math.round(Math.min(220, Math.max(50, w / 5)) * (o.densidad || 1)),
      nueva(m, o, inicial) {
        const p = { x: m.w * (.5 + gauss() * .3), y: m.h * azar(.97, 1.06), vx: azar(-10, 10), vy: -m.h * azar(.4, .85), r: Math.min(m.w, m.h) * azar(.05, .12), vida: azar(.7, 1.5), edad: 0, fase: azar(0, 6.28) };
        if (inicial) { p.edad = azar(0, p.vida); p.y += p.vy * p.edad; }
        return p;
      },
      paso(p, dt, t, m, v) { p.edad += dt * v; p.x += (p.vx + Math.sin(t * 4 + p.fase) * 22) * dt * v; p.y += p.vy * dt * v; return p.edad < p.vida; },
      dibujar(x, p, t, o) {
        const f = p.edad / p.vida, d = p.r * 2 * (1 - f * .7);
        x.globalAlpha = Math.sin(Math.min(1, f * 5) * 1.57) * (1 - f) ** 1.4 * .36;
        x.drawImage(brillo(o.paleta[f < .22 ? 1 : f < .62 ? 0 : 2]), p.x - d / 2, p.y - d * .9, d, d * 1.7);
        x.globalAlpha = 1;
      }
    },
    /* Niebla: manchas grandes y suaves que cruzan despacio. */
    niebla: {
      mezcla: 'source-over',
      cantidad: (w, h, o) => Math.round(13 * (o.densidad || 1)),
      nueva(m, o, inicial) {
        const r = Math.max(m.w, m.h) * azar(.22, .5), dir = Math.random() < .5 ? 1 : -1;
        return { x: inicial ? azar(-r, m.w + r) : (dir > 0 ? -r : m.w + r), y: m.h * azar(.1, 1), vx: dir * azar(8, 26), r, a: azar(.07, .16), fase: azar(0, 6.28), edad: 0 };
      },
      paso(p, dt, t, m, v) { p.x += p.vx * dt * v; p.y += Math.sin(t * .2 + p.fase) * 4 * dt; return p.x > -p.r * 1.2 && p.x < m.w + p.r * 1.2; },
      dibujar(x, p, t, o) {
        x.globalAlpha = p.a * (.75 + .25 * Math.sin(t * .5 + p.fase));
        x.drawImage(brillo(o.paleta[0]), p.x - p.r, p.y - p.r * .6, p.r * 2, p.r * 1.2);
        x.globalAlpha = 1;
      }
    },
    /* Destellos arcanos: estrellas de cuatro puntas que titilan y derivan en órbita. */
    arcano: {
      mezcla: 'lighter',
      cantidad: (w, h, o) => Math.round(Math.min(70, Math.max(18, w * h / 22000)) * (o.densidad || 1)),
      nueva(m, o) {
        return { ang: azar(0, 6.28), rad: azar(.08, .62), vel: azar(-.22, .22), r: azar(3, 9) * Math.max(1, Math.min(2.2, m.w / 1100)), vida: azar(1.6, 4.5), edad: azar(0, 1), fase: azar(0, 6.28), c: o.paleta[Math.floor(azar(0, 3))], x: 0, y: 0 };
      },
      paso(p, dt, t, m, v) {
        p.edad += dt; p.ang += p.vel * dt * v;
        p.x = m.w / 2 + Math.cos(p.ang) * p.rad * m.w; p.y = m.h / 2 + Math.sin(p.ang) * p.rad * m.h * .9;
        return p.edad < p.vida;
      },
      dibujar(x, p) {
        const a = Math.sin(Math.PI * p.edad / p.vida) ** 2, s = brillo(p.c), l = p.r * 5;
        x.globalAlpha = a;
        x.drawImage(s, p.x - l, p.y - p.r * .45, l * 2, p.r * .9);
        x.drawImage(s, p.x - p.r * .45, p.y - l, p.r * .9, l * 2);
        x.drawImage(s, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        x.globalAlpha = 1;
      }
    },
    lluvia: {
      mezcla: 'source-over',
      cantidad: (w, h, o) => Math.round(Math.min(260, w / 5) * (o.densidad || 1)),
      nueva(m, o, inicial) { return { x: azar(-m.w * .1, m.w * 1.15), y: inicial ? azar(0, m.h) : -30, v: azar(700, 1250), l: azar(12, 30), a: azar(.14, .4) }; },
      paso(p, dt, t, m, v) { p.y += p.v * dt * Math.max(v, .6); p.x -= p.v * .16 * dt * Math.max(v, .6); return p.y < m.h + 30; },
      dibujar(x, p, t, o) {
        x.strokeStyle = `rgba(${o.paleta[0]},${p.a})`; x.lineWidth = 1.3;
        x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + p.l * .16, p.y - p.l); x.stroke();
      }
    }
  };

  F.particulas = (lienzo, tipo = 'brasas', opciones = {}) => {
    const def = TIPOS[tipo] || TIPOS.brasas;
    const o = { ...opciones, paleta: PALETAS[opciones.color] || PALETAS.verde };
    const calma = opciones.calma ?? F.reducido();
    if (F.sinEfectos && F.sinEfectos() && !opciones.forzar) return { parar() {} };
    if (calma) o.densidad = (o.densidad || 1) * .55;
    const x = lienzo.getContext('2d'), m = { w: 0, h: 0 };
    let ps = [], vivo = true, cuadro = 0, antes = 0;

    const medir = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1), w = lienzo.clientWidth, h = lienzo.clientHeight;
      if (!w || !h) return;
      const primera = !m.w;
      m.w = w; m.h = h; lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = def.cantidad(w, h, o);
      if (primera) ps = Array.from({ length: n }, () => def.nueva(m, o, true));
      else if (ps.length > n) ps.length = n;
      else while (ps.length < n) ps.push(def.nueva(m, o, true));
    };
    const paso = ahora => {
      if (!vivo) return;
      cuadro = requestAnimationFrame(paso);
      if (!m.w) return medir();
      const dt = Math.min(.05, (ahora - (antes || ahora)) / 1000), t = ahora / 1000; antes = ahora;
      x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, m.w, m.h);
      x.globalCompositeOperation = def.mezcla;
      for (let i = 0; i < ps.length; i++) {
        if (!def.paso(ps[i], dt, t, m, calma ? .45 : 1)) ps[i] = def.nueva(m, o, false);
        def.dibujar(x, ps[i], t, o);
      }
    };
    const observador = 'ResizeObserver' in window ? new ResizeObserver(medir) : null;
    if (observador) observador.observe(lienzo); else addEventListener('resize', medir);
    const visible = () => { cancelAnimationFrame(cuadro); antes = 0; if (!document.hidden && vivo) cuadro = requestAnimationFrame(paso); };
    document.addEventListener('visibilitychange', visible);
    medir(); cuadro = requestAnimationFrame(paso);
    return { parar() { vivo = false; cancelAnimationFrame(cuadro); observador && observador.disconnect(); document.removeEventListener('visibilitychange', visible); } };
  };
  F.particulas.tipos = Object.keys(TIPOS);
  F.particulas.colores = Object.keys(PALETAS);
})();
