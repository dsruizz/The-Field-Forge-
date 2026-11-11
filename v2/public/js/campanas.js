/* Mis campañas: lista, crear y unirse. */
(async () => {
  const F = window.Forja;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);

  const lista = document.querySelector('[data-lista]');
  const acciones = document.querySelector('[data-acciones]');
  document.querySelector('[data-saludo]').textContent = `Hola, ${usuario.usuario}. Elige dónde seguir la historia.`;
  acciones.querySelector('[data-abrir=nueva]').innerHTML = F.icono('mas') + 'Nueva campaña';
  acciones.querySelector('[data-abrir=unirse]').innerHTML = F.icono('llave') + 'Unirme';

  /* ---------- Hojas (dialog) ---------- */
  const hojas = { nueva: document.getElementById('nueva'), unirse: document.getElementById('unirse') };
  const abrir = id => { const d = hojas[id]; d.querySelector('form').reset(); d.querySelector('.aviso').textContent = ''; d.showModal(); d.querySelector('.entrada').focus(); };
  document.addEventListener('click', e => { const b = e.target.closest('[data-abrir]'); if (b) abrir(b.dataset.abrir); });
  for (const d of Object.values(hojas)) {
    d.querySelector('[data-cerrar]').innerHTML = F.icono('cerrar');
    d.querySelectorAll('[data-cerrar],[data-cerrar-texto]').forEach(b => b.addEventListener('click', () => d.close()));
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); // clic en el fondo
  }

  function enviar(d, ruta, alTerminar) {
    const form = d.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const aviso = form.querySelector('.aviso'), boton = form.querySelector('[type=submit]');
      aviso.textContent = '';
      const invalido = [...form.querySelectorAll('.entrada')].find(i => !i.checkValidity());
      if (invalido) { invalido.focus(); aviso.textContent = invalido.validationMessage; return; }
      F.ocupado(boton, true);
      try { const r = await F.api(ruta, { metodo: 'POST', datos: F.datosForm(form) }); d.close(); alTerminar(r); }
      catch (err) { aviso.textContent = err.message; }
      finally { F.ocupado(boton, false); }
    });
  }
  enviar(hojas.nueva, 'campanas', r => { location.href = 'campana.html?id=' + encodeURIComponent(r.campana.id) + '&nueva=1'; });
  // Al unirse se entra directamente: lo siguiente que quiere el jugador es elegir su personaje.
  enviar(hojas.unirse, 'campanas/unirse', r => { location.href = 'campana.html?id=' + encodeURIComponent(r.campana.id); });

  /* ---------- Lista ---------- */
  const tarjeta = c => `
    <a class="camp" href="campana.html?id=${encodeURIComponent(c.id)}">
      <div class="camp__arriba">
        <div><h2>${F.esc(c.nombre)}</h2>${c.ambientacion ? `<p class="camp__amb">${F.esc(c.ambientacion)}</p>` : ''}</div>
        <span class="chip ${c.rol === 'dm' ? 'chip--dm' : 'chip--jugador'}">${c.rol === 'dm' ? 'DM' : 'Jugador'}</span>
      </div>
      ${c.sinopsis ? `<p class="camp__sin">${F.esc(c.sinopsis)}</p>` : ''}
      <div class="camp__datos">
        <span><b>${c.partidas}</b> ${c.partidas === 1 ? 'sesión' : 'sesiones'}</span>
        ${c.nivelMedio ? `<span>Nivel <b>${c.nivelMedio}</b></span>` : ''}
        ${c.pjs && c.pjs.length ? `<span><b>${c.pjs.length}</b> PJ</span>` : ''}
        <span><b>${c.jugadores}</b> ${c.jugadores === 1 ? 'jugador' : 'jugadores'}</span>
        ${c.rol !== 'dm' ? `<span>DM <b>${F.esc(c.dm)}</b></span>` : ''}
      </div>
    </a>`;

  async function cargar() {
    lista.setAttribute('aria-busy', 'true');
    try {
      const { campanas } = await F.api('campanas');
      acciones.hidden = campanas.length === 0;
      lista.innerHTML = campanas.length ? campanas.map(tarjeta).join('') : `
        <div class="vacio">
          <h2>Aún no hay campañas</h2>
          <p>Crea la tuya y serás su DM, o únete a la de tu grupo con el código y la contraseña que te den.</p>
          <div class="vacio__acciones">
            <button class="boton boton--primario boton--grande" type="button" data-abrir="nueva">${F.icono('mas')}Crear campaña</button>
            <button class="boton boton--secundario boton--grande" type="button" data-abrir="unirse">${F.icono('llave')}Unirme a una</button>
          </div>
        </div>`;
      F.entrar(lista.children);
    } catch (err) {
      lista.innerHTML = `<p class="aviso">${F.esc(err.message)}</p>`;
    } finally { lista.removeAttribute('aria-busy'); }
  }
  cargar();
})();
