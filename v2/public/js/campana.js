/* Vista previa de una campaña. El DM ve el código de invitación y puede editarla. */
(async () => {
  const F = window.Forja;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const main = document.querySelector('[data-contenido]');
  const dlg = document.getElementById('editar');
  let datos;

  function pintar() {
    const { campana: c, miembros } = datos;
    const esDm = c.rol === 'dm';
    document.title = c.nombre + ' · The Field Forge';
    main.innerHTML = `
      <div class="cabecera">
        <div>
          <a class="miga" href="campanas.html">${F.icono('atras').replace('<svg', '<svg width="16" height="16"')}Mis campañas</a>
          <h1 class="gotica">${F.esc(c.nombre)}</h1>
          ${c.ambientacion ? `<p>${F.esc(c.ambientacion)}</p>` : ''}
        </div>
        <div class="cabecera__acciones">
          ${esDm ? '<button class="boton boton--secundario" type="button" data-editar>Editar</button>' : ''}
          <button class="boton boton--primario" type="button" disabled title="Llega en el siguiente paso">${esDm ? 'Abrir la mesa' : 'Ver la crónica'}</button>
        </div>
      </div>
      <div class="detalle">
        <section class="panel" aria-labelledby="h-resumen">
          <h2 id="h-resumen">Resumen</h2>
          <div class="cifras">
            <div class="cifra"><b>${c.partidas}</b><span>${c.partidas === 1 ? 'sesión jugada' : 'sesiones jugadas'}</span></div>
            <div class="cifra"><b>${c.jugadores}</b><span>${c.jugadores === 1 ? 'jugador' : 'jugadores'}</span></div>
            <div class="cifra"><b>${c.ultimaPartida ? F.fecha(c.ultimaPartida) : '—'}</b><span>última sesión</span></div>
          </div>
          <p class="${c.sinopsis ? '' : 'suave'}">${c.sinopsis ? F.esc(c.sinopsis) : esDm ? 'Aún no hay sinopsis. Usa «Editar» para contar de qué va.' : 'El DM aún no ha escrito la sinopsis.'}</p>
        </section>
        <aside class="form">
          ${esDm ? `
          <section class="panel" aria-labelledby="h-invitar">
            <h2 id="h-invitar">Invitar al grupo</h2>
            <p class="suave">Comparte este código y la contraseña que elegiste.</p>
            <div class="codigo"><span data-codigo>${F.esc(c.codigo)}</span><button class="boton boton--fantasma boton--icono" type="button" data-copiar aria-label="Copiar código">${F.icono('copiar')}</button></div>
          </section>` : ''}
          <section class="panel" aria-labelledby="h-grupo">
            <h2 id="h-grupo">Grupo</h2>
            <ul class="miembros">
              ${miembros.map(m => `<li><span>${F.esc(m.usuario)}${m.usuario === usuario.usuario ? ' <span class="suave">(tú)</span>' : ''}</span><span class="chip ${m.rol === 'dm' ? 'chip--dm' : 'chip--jugador'}">${m.rol === 'dm' ? 'DM' : 'Jugador'}</span></li>`).join('')}
            </ul>
          </section>
        </aside>
      </div>`;
    const copiar = main.querySelector('[data-copiar]');
    if (copiar) copiar.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(c.codigo); F.toast('Código copiado'); }
      catch { F.toast('No se pudo copiar. Selecciónalo a mano.'); }
    });
    const editar = main.querySelector('[data-editar]');
    if (editar) editar.addEventListener('click', abrirEdicion);
  }

  function abrirEdicion() {
    const f = dlg.querySelector('form'), c = datos.campana;
    f.reset();
    f.nombre.value = c.nombre; f.ambientacion.value = c.ambientacion; f.sinopsis.value = c.sinopsis;
    dlg.querySelector('.aviso').textContent = '';
    dlg.showModal(); f.nombre.focus();
  }
  dlg.querySelector('[data-cerrar]').innerHTML = F.icono('cerrar');
  dlg.querySelectorAll('[data-cerrar],[data-cerrar-texto]').forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, aviso = f.querySelector('.aviso'), boton = f.querySelector('[type=submit]');
    const invalido = [...f.querySelectorAll('.entrada')].find(i => !i.checkValidity());
    if (invalido) { invalido.focus(); aviso.textContent = invalido.validationMessage; return; }
    const d = F.datosForm(f); if (!d.clave) delete d.clave;
    F.ocupado(boton, true);
    try {
      const r = await F.api('campanas/' + encodeURIComponent(id), { metodo: 'PATCH', datos: d });
      datos.campana = r.campana; dlg.close(); pintar(); F.toast('Cambios guardados');
    } catch (err) { aviso.textContent = err.message; }
    finally { F.ocupado(boton, false); }
  });

  try {
    datos = await F.api('campanas/' + encodeURIComponent(id || ''));
    pintar();
    if (params.get('nueva')) F.toast('Campaña creada. Ya puedes invitar a tu grupo.');
  } catch (err) {
    main.innerHTML = `<div class="cabecera"><div><a class="miga" href="campanas.html">Mis campañas</a><h1>No encontrada</h1><p>${F.esc(err.message)}</p></div></div>`;
  }
})();
