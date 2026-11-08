/* Landing: si ya hay sesión, ofrece ir directo a las campañas. */
(async () => {
  const F = window.Forja;
  F.montarBarra(null);
  const [usuario, estado] = await Promise.all([F.yo().catch(() => null), F.api('estado').catch(() => null)]);
  if (usuario) {
    document.querySelector('[data-acciones]').innerHTML = `
      <button class="boton boton--fantasma boton--icono" type="button" data-icono-tema></button>
      <a class="boton boton--primario" href="campanas.html">Mis campañas</a>`;
    F.montarBarra(null);
    document.querySelectorAll('.heroe__cta').forEach(c => { c.innerHTML = '<a class="boton boton--primario boton--grande" href="campanas.html">Ir a mis campañas</a>'; });
  }
  const nota = document.querySelector('[data-plazas]');
  if (estado && nota) {
    const libres = Math.max(0, estado.plazas - estado.ocupadas);
    nota.textContent = libres ? `Registro con código de invitación · ${libres} de ${estado.plazas} plazas libres.` : 'La beta está completa por ahora.';
  }
})();
