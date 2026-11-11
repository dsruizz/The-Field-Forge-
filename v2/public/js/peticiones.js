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
    function pintar() {
      caja.hidden = !lista.length;
      caja.innerHTML = lista.length ? `
        <h2 class="pets__tit">${F.icono('movil')}Piden permiso <i>${lista.length}</i></h2>
        <ul class="pets__lista">${lista.map(x => { const p = x.tipo === 'pj' ? (pj(x.pjCamp) || { nombre: x.quien, img: x.img }) : (pj(x.pj) || { nombre: x.quien }); return `
          <li class="pet${x.tipo === 'pj' ? ' pet--pj' : ''}">
            ${F.ficha.retrato(p, 'pet__retrato')}
            <p><b>${x.tipo === 'pj' ? e(x.usuario) : e(p.nombre)}</b><span>${F.icono(ICONO[x.tipo] || 'objeto')}${e(x.texto)}</span><small>${x.tipo === 'pj' ? (x.pjCamp ? 'Personaje de la campaña' : 'Su propio personaje: revisa la ficha antes de aceptar') : e(x.usuario)} · ${e(F.hace(x.t))}${x.nuevo && x.nuevo.nota ? ' · ' + e(x.nuevo.nota) : ''}</small></p>
            <div class="pet__acc">
              ${x.tipo === 'pj' ? `<button class="boton boton--chico boton--secundario" type="button" data-pet-ficha="${e(x.id)}">${F.icono('ojo')}Ver ficha</button>` : ''}
              <button class="boton boton--chico boton--primario" type="button" data-pet="${e(x.id)}" data-ok="1">${F.icono('hecho')}Aprobar</button>
              <button class="boton boton--chico boton--secundario" type="button" data-pet="${e(x.id)}">Rechazar</button>
            </div>
          </li>`; }).join('')}</ul>` : '';
    }
    async function cargar() {
      try { const r = await F.api(ruta); lista = r.peticiones; datos().jugadores = r.jugadores; parchear(r.parches); pintar(); alCambiar && alCambiar(); } catch { /* se reintenta al reconectar */ }
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
    caja.addEventListener('click', async ev => {
      const f = ev.target.closest('[data-pet-ficha]'); if (f) return verFicha(f.dataset.petFicha);
      const b = ev.target.closest('[data-pet]'); if (b) resolver(b);
    });
    async function resolver(b) {
      caja.querySelectorAll('button').forEach(x => { x.disabled = true; });
      try {
        const r = await F.api(ruta, { metodo: 'POST', datos: { id: b.dataset.pet, ok: !!b.dataset.ok } });
        parchear(r.parches); lista = r.peticiones;
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
      pintar(); alCambiar && alCambiar();
    });
    cargar();
    return { cargar };
  }
  F.peticiones = { montar };
})();
