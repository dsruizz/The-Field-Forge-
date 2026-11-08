/* Portada: entrada animada, plazas libres y atajo si ya hay sesión. */
(() => {
  const F = window.Forja;
  F.escena();

  const animar = () => {
    const g = window.gsap;
    if (!g || F.reducido()) return;
    const tl = g.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.escena h1 .linea > span', { yPercent: 110, duration: 1.1, stagger: .14, delay: .15 })
      .from('.escena__sub, [data-cta], [data-plazas]', { y: 16, opacity: 0, duration: .7, stagger: .1, clearProps: 'all' }, '-=.6')
      .from('.barra--escena', { opacity: 0, y: -10, duration: .6 }, '<');
  };
  if (window.gsap) animar(); else addEventListener('load', animar, { once: true });

  (async () => {
    const [usuario, estado] = await Promise.all([F.yo().catch(() => null), F.api('estado').catch(() => null)]);
    if (usuario) {
      document.querySelector('[data-acciones]').innerHTML = '<a class="boton boton--primario" href="campanas.html">Mis campañas</a>';
      document.querySelector('[data-cta]').innerHTML = '<a class="boton boton--primario boton--grande" href="campanas.html">Volver a mis campañas</a><a class="boton boton--secundario boton--grande" href="personajes.html">Mis personajes</a>';
    }
    const nota = document.querySelector('[data-plazas]');
    if (estado && nota && !usuario) {
      const libres = Math.max(0, estado.plazas - estado.ocupadas);
      nota.textContent = libres ? `Beta privada con invitación · quedan ${libres} plazas.` : 'La beta está completa por ahora.';
    }
  })();
})();
