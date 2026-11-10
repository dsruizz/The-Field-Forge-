/* Peticiones de los jugadores (lado del DM). Escucha el canal en vivo de la campaña, pinta lo que espera
   respuesta y mantiene al día, en la copia local, lo que cada jugador cambia desde su móvil. */
(() => {
  const F = window.Forja, e = F.esc;
  const ICONO = { anadir: 'mas', usar: 'pocion', dar: 'dar', tirar: 'borrar' };

  function montar({ id, caja, datos, alCambiar, alRev }) {
    let lista = [];
    const ruta = 'campanas/' + encodeURIComponent(id) + '/peticion';
    const pj = idp => datos().personajes.find(p => p.id === idp);
    function parchear(parches) {
      (parches || []).forEach(x => { const p = pj(x.id); if (!p) return; for (const [k, v] of Object.entries(x.campos)) { if (v === undefined || v === null) delete p[k]; else p[k] = v; } });
    }
    function pintar() {
      caja.hidden = !lista.length;
      caja.innerHTML = lista.length ? `
        <h2 class="pets__tit">${F.icono('movil')}Piden permiso <i>${lista.length}</i></h2>
        <ul class="pets__lista">${lista.map(x => { const p = pj(x.pj) || { nombre: x.quien }; return `
          <li class="pet">
            ${F.ficha.retrato(p, 'pet__retrato')}
            <p><b>${e(p.nombre)}</b><span>${F.icono(ICONO[x.tipo] || 'objeto')}${e(x.texto)}</span><small>${e(x.usuario)} · ${e(F.hace(x.t))}${x.nuevo && x.nuevo.nota ? ' · ' + e(x.nuevo.nota) : ''}</small></p>
            <div class="pet__acc">
              <button class="boton boton--chico boton--primario" type="button" data-pet="${e(x.id)}" data-ok="1">${F.icono('hecho')}Aprobar</button>
              <button class="boton boton--chico boton--secundario" type="button" data-pet="${e(x.id)}">Rechazar</button>
            </div>
          </li>`; }).join('')}</ul>` : '';
    }
    async function cargar() {
      try { const r = await F.api(ruta); lista = r.peticiones; datos().jugadores = r.jugadores; parchear(r.parches); pintar(); alCambiar && alCambiar(); } catch { /* se reintenta al reconectar */ }
    }
    caja.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-pet]'); if (!b) return;
      caja.querySelectorAll('button').forEach(x => { x.disabled = true; });
      try {
        const r = await F.api(ruta, { metodo: 'POST', datos: { id: b.dataset.pet, ok: !!b.dataset.ok } });
        parchear(r.parches); lista = r.peticiones;
        F.toast(r.aviso ? 'No se pudo aplicar: ' + r.aviso : r.estado === 'aprobada' ? 'Aprobada' : 'Rechazada');
      } catch (err) { F.toast(err.message); await cargar(); }
      pintar(); alCambiar && alCambiar();
    });
    F.enVivo(id, d => {
      if (d.reconectado) return cargar();
      if (!d.parches && !d.peticiones && !d.nuevo) return; // aviso para las vistas de jugador
      if (d.nuevo && !pj(d.nuevo.id)) { datos().personajes.push(d.nuevo); alRev && alRev(d.rev); }
      parchear(d.parches);
      if (d.jugadores) datos().jugadores = d.jugadores;
      if (d.peticiones) { if (d.peticiones.length > lista.length) F.toast('Nueva petición de un jugador'); lista = d.peticiones; }
      pintar(); alCambiar && alCambiar();
    });
    cargar();
    return { cargar };
  }
  F.peticiones = { montar };
})();
