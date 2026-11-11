/* Peticiones de los jugadores (lado del DM). Escucha el canal en vivo de la campaña, pinta lo que espera
   respuesta y mantiene al día, en la copia local, lo que cada jugador cambia desde su móvil. */
(() => {
  const F = window.Forja, e = F.esc;
  const ICONO = { anadir: 'mas', usar: 'pocion', dar: 'dar', tirar: 'borrar', pj: 'mascara' };

  function montar({ id, caja, datos, alCambiar, alRev }) {
    let lista = [];
    const ruta = 'campanas/' + encodeURIComponent(id) + '/peticion';
    const pj = idp => datos().personajes.find(p => p.id === idp);
    function parchear(parches) {
      (parches || []).forEach(x => { const p = pj(x.id); if (!p) return; for (const [k, v] of Object.entries(x.campos)) { if (v === undefined || v === null) delete p[k]; else p[k] = v; } });
    }
    /* Botón flotante, como el de ayuda de muchas webs: siempre a mano y sin tapar nada.
       Late cuando hay algo sin contestar; al abrirlo sale un cuadro pequeño con dos listas plegables. */
    if (caja) caja.hidden = true;
    const flot = document.createElement('div');
    flot.className = 'pflot';
    flot.innerHTML = `<div class="pflot__panel" hidden role="dialog" aria-label="Peticiones de los jugadores"></div>
      <button class="pflot__boton" type="button" aria-expanded="false" aria-label="Peticiones de los jugadores">${F.icono('campanilla')}<i hidden></i></button>`;
    document.body.append(flot);
    const panel = flot.querySelector('.pflot__panel'), boton = flot.querySelector('.pflot__boton');
    let hechas = [], abiertas = { pend: true, hechas: false };
    const ESTADO = { aprobada: 'Aprobada', rechazada: 'Rechazada' };
    const fila = (x, resuelta) => {
      const p = x.tipo === 'pj' ? (pj(x.pjCamp) || pj(x.pj) || { nombre: x.quien, img: x.img }) : (pj(x.pj) || { nombre: x.quien });
      return `<li class="pet${resuelta ? ' pet--hecha pet--' + e(x.estado) : ''}">
        ${F.ficha.retrato(p, 'pet__retrato')}
        <p><b>${x.tipo === 'pj' ? e(x.usuario) : e(p.nombre)}</b><span>${F.icono(ICONO[x.tipo] || 'objeto')}${e(x.texto)}</span>
          <small>${resuelta ? `${ESTADO[x.estado] || 'Resuelta'} · ${e(F.hace(x.resuelta || x.t))}` : `${x.tipo === 'pj' ? (x.pjCamp ? 'Personaje de la campaña' : 'Trae su propio personaje') : e(x.usuario)} · ${e(F.hace(x.t))}`}${x.nuevo && x.nuevo.nota ? ' · ' + e(x.nuevo.nota) : ''}</small></p>
        ${resuelta ? '' : `<div class="pet__acc">
          ${x.tipo === 'pj' ? `<button type="button" data-pet-ficha="${e(x.id)}" title="Ver la ficha" aria-label="Ver la ficha">${F.icono('ojo')}</button>` : ''}
          <button type="button" class="pet__ok" data-pet="${e(x.id)}" data-ok="1" title="Aprobar" aria-label="Aprobar">${F.icono('hecho')}</button>
          <button type="button" data-pet="${e(x.id)}" title="Rechazar" aria-label="Rechazar">${F.icono('cerrar')}</button>
        </div>`}
      </li>`;
    };
    function pintar() {
      const n = lista.length, cuenta = boton.querySelector('i');
      cuenta.hidden = !n; cuenta.textContent = n;
      boton.classList.toggle('is-llama', n > 0);
      boton.title = n ? `${n} ${n === 1 ? 'petición' : 'peticiones'} sin contestar` : 'Peticiones de los jugadores';
      panel.innerHTML = `
        <div class="pflot__cab"><b>Peticiones</b><button type="button" data-pflot-cerrar aria-label="Cerrar">${F.icono('cerrar')}</button></div>
        <details class="pflot__grupo" data-grupo="pend"${abiertas.pend ? ' open' : ''}><summary>Sin contestar <i>${n}</i></summary>
          ${n ? `<ul>${lista.map(x => fila(x, false)).join('')}</ul>` : '<p class="pflot__vacio">Nada pendiente.</p>'}</details>
        <details class="pflot__grupo" data-grupo="hechas"${abiertas.hechas ? ' open' : ''}><summary>Contestadas <i>${hechas.length}</i></summary>
          ${hechas.length ? `<ul>${hechas.map(x => fila(x, true)).join('')}</ul>` : '<p class="pflot__vacio">Aún no has contestado ninguna.</p>'}</details>`;
    }
    const abrir = si => { panel.hidden = !si; boton.setAttribute('aria-expanded', String(si)); };
    boton.addEventListener('click', () => abrir(panel.hidden));
    panel.addEventListener('toggle', ev => { const g = ev.target.dataset && ev.target.dataset.grupo; if (g) abiertas[g] = ev.target.open; }, true);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) abrir(false); });
    document.addEventListener('pointerdown', ev => { if (!panel.hidden && !flot.contains(ev.target) && !ev.target.closest('dialog')) abrir(false); });
    async function cargar() {
      try { const r = await F.api(ruta); lista = r.peticiones; hechas = r.contestadas || []; datos().jugadores = r.jugadores; parchear(r.parches); pintar(); alCambiar && alCambiar(); } catch { /* se reintenta al reconectar */ }
    }
    // Ficha de quien pide entrar: se revisa antes de aceptar.
    let dlg = null;
    async function verFicha(idPet) {
      if (!dlg) {
        dlg = document.createElement('dialog'); dlg.className = 'hoja hoja--ancha';
        dlg.innerHTML = '<div class="hoja__in"><div class="hoja__cab"><span class="etq">Revisa antes de aceptar</span><button class="boton boton--fantasma boton--icono" type="button" data-cerrar aria-label="Cerrar"></button></div><div data-cuerpo></div><div class="hoja__pie" data-pie></div></div>';
        document.body.append(dlg); F.dialogo(dlg);
        dlg.addEventListener('click', ev => { const b = ev.target.closest('[data-pet]'); if (b) { dlg.close(); resolver(b); } });
      }
      try {
        const r = await F.api(ruta + '?ficha=' + encodeURIComponent(idPet));
        dlg.querySelector('[data-cuerpo]').innerHTML = r.ficha ? F.ficha.completa(r.ficha) : '<p class="suave">No se encontró la ficha.</p>';
        dlg.querySelector('[data-pie]').innerHTML = `<button class="boton boton--secundario" type="button" data-pet="${e(idPet)}">Rechazar</button><button class="boton boton--primario" type="button" data-pet="${e(idPet)}" data-ok="1">${F.icono('hecho')}Aceptar</button>`;
        dlg.showModal();
      } catch (err) { F.toast(err.message); }
    }
    panel.addEventListener('click', async ev => {
      if (ev.target.closest('[data-pflot-cerrar]')) return abrir(false);
      const f = ev.target.closest('[data-pet-ficha]'); if (f) return verFicha(f.dataset.petFicha);
      const b = ev.target.closest('[data-pet]'); if (b) resolver(b);
    });
    async function resolver(b) {
      panel.querySelectorAll('.pet button').forEach(x => { x.disabled = true; });
      try {
        const r = await F.api(ruta, { metodo: 'POST', datos: { id: b.dataset.pet, ok: !!b.dataset.ok } });
        parchear(r.parches); lista = r.peticiones; hechas = r.contestadas || hechas;
        if (r.nuevo && !pj(r.nuevo.id)) { datos().personajes.push(r.nuevo); alRev && alRev(r.rev); }
        F.toast(r.estado === 'rechazada' && r.aviso ? 'No se pudo aplicar: ' + r.aviso : r.estado === 'aprobada' ? 'Aprobada' + (r.aviso ? ': ' + r.aviso : '') : 'Rechazada');
      } catch (err) { F.toast(err.message); await cargar(); }
      pintar(); alCambiar && alCambiar();
    }
    F.enVivo(id, d => {
      if (d.reconectado) return cargar();
      if (!d.parches && !d.peticiones && !d.nuevo) return; // aviso para las vistas de jugador
      if (d.aviso) F.toast(d.aviso);
      if (d.nuevo && !pj(d.nuevo.id)) { datos().personajes.push(d.nuevo); alRev && alRev(d.rev); }
      parchear(d.parches);
      if (d.jugadores) datos().jugadores = d.jugadores;
      if (d.peticiones) { if (d.peticiones.length > lista.length) F.toast('Nueva petición de un jugador'); lista = d.peticiones; }
      if (d.contestadas) hechas = d.contestadas;
      pintar(); alCambiar && alCambiar();
    });
    cargar();
    return { cargar };
  }
  F.peticiones = { montar };
})();
