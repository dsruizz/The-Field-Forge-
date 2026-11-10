/* Escena de tinta: brasas que suben desde el caldero y la ilustración que respira con el ratón. */
(() => {
  const F = window.Forja;
  F.escena = ({ chispas = true, parallax = true } = {}) => {
    const lienzo = document.querySelector('[data-chispas]');
    const ilus = document.querySelector('[data-ilus]');
    const reducido = F.reducido();

    // Brasas y ceniza que suben como de una fogata. Con «menos movimiento» van en calma, no desaparecen.
    if (lienzo && chispas) F.particulas(lienzo, 'brasas', { color: 'verde', origen: lienzo.dataset.chispas || 'fogata', densidad: Number(lienzo.dataset.densidad) || 1 });

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
