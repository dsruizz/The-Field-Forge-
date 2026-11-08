/* Escena de tinta: chispas que suben desde el caldero y la ilustración que respira con el ratón. */
(() => {
  const F = window.Forja;
  F.escena = ({ chispas = true, parallax = true } = {}) => {
    const lienzo = document.querySelector('[data-chispas]');
    const ilus = document.querySelector('[data-ilus]');
    const reducido = F.reducido();

    if (lienzo && chispas && !reducido) {
      const ctx = lienzo.getContext('2d');
      const colores = ['170,212,49', '253,225,52', '217,217,217'];
      let w = 0, h = 0, dpr = 1, particulas = [], activo = true;
      const medir = () => {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = lienzo.clientWidth; h = lienzo.clientHeight;
        lienzo.width = w * dpr; lienzo.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const nueva = (y) => ({
        x: w * (0.15 + Math.random() * 0.7), y: y ?? h + 10,
        r: 0.6 + Math.random() * 1.8, vy: 0.25 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.3,
        fase: Math.random() * Math.PI * 2, c: colores[Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2], vida: 0.4 + Math.random() * 0.6
      });
      medir();
      const cantidad = Math.round(Math.min(90, w / 14));
      for (let i = 0; i < cantidad; i++) particulas.push(nueva(Math.random() * h));
      const paso = t => {
        if (!activo) return;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of particulas) {
          p.y -= p.vy; p.x += p.vx + Math.sin(t / 900 + p.fase) * 0.25;
          const alto = 1 - p.y / h;
          const a = Math.max(0, Math.min(1, (1 - alto) * 1.2)) * p.vida;
          ctx.beginPath();
          ctx.fillStyle = `rgba(${p.c},${a})`;
          ctx.shadowColor = `rgba(${p.c},${a})`; ctx.shadowBlur = 8;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          if (p.y < -10) Object.assign(p, nueva());
        }
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
      addEventListener('resize', medir);
      document.addEventListener('visibilitychange', () => { activo = !document.hidden; if (activo) requestAnimationFrame(paso); });
    }

    const arrancar = () => {
      const g = window.gsap;
      if (!g || reducido) return;
      if (ilus) {
        g.from(ilus.firstElementChild, { scale: 1.12, opacity: 0, duration: 2.2, ease: 'power2.out', clearProps: 'opacity' });
        if (parallax && matchMedia('(pointer: fine)').matches) {
          const ax = g.quickTo(ilus.firstElementChild, 'x', { duration: 1.2, ease: 'power3' });
          const ay = g.quickTo(ilus.firstElementChild, 'y', { duration: 1.2, ease: 'power3' });
          addEventListener('pointermove', e => { ax((e.clientX / innerWidth - 0.5) * -24); ay((e.clientY / innerHeight - 0.5) * -16); });
        }
      }
    };
    if (window.gsap) arrancar(); else addEventListener('load', arrancar, { once: true });
  };
})();
