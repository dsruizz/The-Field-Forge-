/* Crónica de la campaña: lo que ha ido pasando, sesión a sesión. Es del DM y vive en la mesa:
   desde aquí se escribe, se ilustra y se decide qué acontecimiento se proyecta. */
(() => {
  const F = window.Forja, e = F.esc;
  const TIPOS = { escena: 'Escena', personaje: 'Personaje', combate: 'Combate', descubrimiento: 'Descubrimiento', decision: 'Decisión', hito: 'Hito' };
  const ROMANO = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  /* caja: dónde se pinta · datos(): el documento de la campaña · guardar(fn, mensaje): aplica y guarda
     vivo: control del proyector · verFicha(id): abre la ficha de quien aparece */
  function montar({ caja, datos, guardar, id, vivo, verFicha }) {
    const filtro = { sesion: 'todas', texto: '' };
    let numero = new Map();
    const pj = idp => (datos().personajes || []).find(p => p.id === idp);
    const proyectado = x => vivo.ctl.modo === 'cronica' && vivo.ctl.eventoId === x.id && !vivo.ctl.negro;

    function evento(x) {
      const enlaces = (x.enlaces || []).map(pj).filter(Boolean), vivoYa = proyectado(x);
      return `
        <article class="evento evento--${e(x.tipo)}${x.oculto ? ' evento--oculto' : ''}${x.img ? ' evento--conimg' : ''}${vivoYa ? ' is-proyectado' : ''}">
          <span class="evento__n" aria-hidden="true">${numero.get(x.id) || ''}</span>
          <div class="evento__panel">
            <div class="evento__meta">
              <span class="chip chip--${e(x.tipo)}">${e(TIPOS[x.tipo] || x.tipo)}</span>
              ${x.oculto ? '<span class="chip chip--oculto">Solo DM</span>' : ''}
              ${x.lugar ? `<span>${e(x.lugar)}</span>` : ''}
              <span class="evento__acciones">
                <button class="boton boton--chico ${vivoYa ? 'boton--secundario' : 'boton--primario'}" type="button" data-proyectar-evento="${e(x.id)}">${F.icono(vivoYa ? 'parar' : 'proyectar')}${vivoYa ? 'Quitar' : 'Proyectar'}</button>
                <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-ocultar="${e(x.id)}" aria-label="${x.oculto ? 'Mostrar en la proyección' : 'Marcar como solo DM'}" title="${x.oculto ? 'Mostrar en la proyección' : 'Marcar como solo DM'}">${F.icono(x.oculto ? 'ojoNo' : 'ojo')}</button>
                <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-editar-evento="${e(x.id)}" aria-label="Editar">${F.icono('editar')}</button>
                <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-borrar-evento="${e(x.id)}" aria-label="Borrar">${F.icono('borrar')}</button>
              </span>
            </div>
            <h3>${e(x.titulo)}</h3>
            ${x.texto ? `<p class="evento__texto">${e(x.texto)}</p>` : ''}
            ${x.cita ? `<blockquote class="evento__cita">${e(x.cita)}</blockquote>` : ''}
            ${enlaces.length ? `<div class="enlaces">${enlaces.map(p => `<button class="enlace-pj" type="button" data-ficha="${e(p.id)}"><span class="mono">${p.img ? `<img src="${e(p.img)}" alt="">` : e(p.nombre.charAt(0))}</span>${e(p.nombre)}</button>`).join('')}</div>` : ''}
          </div>
          ${x.img ? `<figure class="evento__img"><img src="${e(x.img)}" alt="" loading="lazy"></figure>` : ''}
        </article>`;
    }

    function pintar() {
      const d = datos(), cr = (d.cronica || []).slice();
      const sesiones = [...new Set(cr.map(x => x.sesion))].sort((a, b) => b - a);
      const q = filtro.texto.trim().toLowerCase();
      const visibles = cr.filter(x => (filtro.sesion === 'todas' || String(x.sesion) === filtro.sesion) && (!q || [x.titulo, x.texto, x.lugar, x.cita].join(' ').toLowerCase().includes(q)));
      const porSesion = sesiones.map(n => [n, visibles.filter(x => x.sesion === n).sort((a, b) => (a.t || 0) - (b.t || 0))]).filter(([, l]) => l.length);
      const titulos = (d.campana && d.campana.sesiones) || {};
      numero = new Map(cr.slice().sort((a, b) => (a.sesion - b.sesion) || ((a.t || 0) - (b.t || 0))).map((x, i) => [x.id, i + 1]));
      caja.innerHTML = `
        <div class="herramientas">
          <div class="segmento" role="group" aria-label="Filtrar por sesión">
            <button type="button" aria-pressed="${filtro.sesion === 'todas'}" data-sesion="todas">Todas</button>
            ${sesiones.slice().reverse().map(n => `<button type="button" aria-pressed="${filtro.sesion === String(n)}" data-sesion="${n}">${ROMANO(n)}</button>`).join('')}
          </div>
          <input class="entrada" type="search" placeholder="Buscar en la crónica" aria-label="Buscar en la crónica" value="${e(filtro.texto)}" data-buscar-cronica>
          <button class="boton boton--primario boton--chico empuja" type="button" data-nuevo-evento>${F.icono('mas')}Acontecimiento</button>
        </div>
        ${porSesion.length ? `<div class="cronica">${porSesion.map(([n, lista]) => `
          <section class="sesion" aria-label="Sesión ${n}">
            <header class="sesion__cab"><span class="sesion__num" aria-hidden="true">${ROMANO(n)}</span><h2 class="sesion__titulo"><small>Sesión ${String(n).padStart(2, '0')} · ${lista.length} ${lista.length === 1 ? 'acontecimiento' : 'acontecimientos'}</small>${e(titulos[n] || 'Sesión ' + n)}</h2></header>
            <div class="linea">${lista.map(evento).join('')}</div>
          </section>`).join('')}</div>`
          : `<div class="vacio"><h2>${q ? 'Nada coincide' : 'La historia empieza aquí'}</h2><p>${q ? 'Prueba con otras palabras.' : 'Registra el primer acontecimiento de la campaña.'}</p>${q ? '' : `<div class="vacio__acciones"><button class="boton boton--primario" type="button" data-nuevo-evento>${F.icono('mas')}Primer acontecimiento</button></div>`}</div>`}`;
    }

    caja.addEventListener('input', ev => {
      const b = ev.target.closest('[data-buscar-cronica]'); if (!b) return;
      filtro.texto = b.value; const pos = b.selectionStart; pintar();
      const n = caja.querySelector('[data-buscar-cronica]'); n.focus(); n.setSelectionRange(pos, pos);
    });
    caja.addEventListener('click', ev => {
      const t = ev.target.closest('button'); if (!t) return;
      const ds = t.dataset;
      if (ds.sesion) { filtro.sesion = ds.sesion; pintar(); }
      else if (ds.ficha) verFicha && verFicha(ds.ficha);
      else if ('nuevoEvento' in ds) abrir();
      else if (ds.proyectarEvento) {
        const x = datos().cronica.find(c => c.id === ds.proyectarEvento);
        if (x && proyectado(x)) vivo.poner({ modo: 'mapa' });
        else { vivo.poner({ modo: 'cronica', eventoId: ds.proyectarEvento, negro: false }); F.toast(x && x.oculto ? 'En el proyector (aunque esté marcado como solo DM)' : 'En el proyector'); }
        pintar();
      }
      else if (ds.editarEvento) abrir(datos().cronica.find(c => c.id === ds.editarEvento));
      else if (ds.ocultar) guardar(d => { const c = d.cronica.find(x => x.id === ds.ocultar); c.oculto = !c.oculto; }, 'Visibilidad cambiada');
      else if (ds.borrarEvento) { if (confirm('¿Borrar este acontecimiento?')) guardar(d => { d.cronica = d.cronica.filter(x => x.id !== ds.borrarEvento); }, 'Acontecimiento borrado'); }
    });

    /* Diálogo */
    const dlg = F.dialogo(document.querySelector('#evento'));
    const form = dlg.querySelector('form');
    form.tipo.innerHTML = Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
    let editando = null, img = '';
    const pintarImg = () => { dlg.querySelector('[data-ev-img]').innerHTML = img ? `<img src="${e(img)}" alt="">` : F.icono('imagen'); dlg.querySelector('[data-ev-quitar]').hidden = !img; };
    dlg.querySelector('#ev-img').addEventListener('change', async ev => {
      const f = ev.target.files[0]; if (!f) return;
      const aviso = form.querySelector('.aviso'); aviso.textContent = 'Subiendo imagen…';
      try { img = (await F.subirImagen(id, f, 1600, 'image/jpeg')).url; aviso.textContent = ''; pintarImg(); }
      catch (err) { aviso.textContent = 'No se pudo subir la imagen: ' + err.message; }
    });
    dlg.querySelector('[data-ev-quitar]').addEventListener('click', () => { img = ''; pintarImg(); });
    function abrir(x) {
      const d = datos();
      editando = x || null; img = (x && x.img) || '';
      form.reset(); pintarImg(); form.querySelector('.aviso').textContent = '';
      dlg.querySelector('#evento-titulo').textContent = x ? 'Editar acontecimiento' : 'Nuevo acontecimiento';
      const ultima = Math.max(1, ...(d.cronica || []).map(c => c.sesion || 1));
      const ses = x ? x.sesion : (filtro.sesion !== 'todas' ? Number(filtro.sesion) : ultima);
      form.sesion.value = ses; form.sesionTitulo.value = ((d.campana || {}).sesiones || {})[ses] || '';
      form.tipo.value = x ? x.tipo : 'escena';
      for (const k of ['titulo', 'lugar', 'texto', 'cita']) form[k].value = x ? x[k] || '' : '';
      form.oculto.checked = !!(x && x.oculto);
      const sel = new Set(x ? x.enlaces || [] : []);
      const orden = (d.personajes || []).slice().sort((a, b) => (a.tipo === 'pj' ? 0 : 1) - (b.tipo === 'pj' ? 0 : 1) || a.nombre.localeCompare(b.nombre));
      dlg.querySelector('[data-enlaces]').innerHTML = orden.map(p => `<label><input type="checkbox" name="enlace" value="${e(p.id)}"${sel.has(p.id) ? ' checked' : ''}>${e(p.nombre)}</label>`).join('') || '<span class="suave">Aún no hay personajes.</span>';
      dlg.showModal(); form.titulo.focus();
    }
    form.sesion.addEventListener('input', () => { form.sesionTitulo.value = ((datos().campana || {}).sesiones || {})[form.sesion.value] || ''; });
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const aviso = form.querySelector('.aviso');
      const invalido = [...form.querySelectorAll('.entrada')].find(i => !i.checkValidity());
      if (invalido) { invalido.focus(); aviso.textContent = invalido.validationMessage; return; }
      const sesion = Math.max(1, parseInt(form.sesion.value, 10) || 1);
      const nuevo = { sesion, tipo: form.tipo.value, titulo: form.titulo.value.trim(), lugar: form.lugar.value.trim(), texto: form.texto.value.trim(), cita: form.cita.value.trim(),
        enlaces: [...form.querySelectorAll('[name=enlace]:checked')].map(i => i.value), oculto: form.oculto.checked, img };
      const titSes = form.sesionTitulo.value.trim(), era = editando;
      guardar(d => {
        d.campana = d.campana || {}; d.campana.sesiones = d.campana.sesiones || {};
        if (titSes) d.campana.sesiones[sesion] = titSes;
        d.campana.sesionActual = Math.max(d.campana.sesionActual || 1, sesion);
        if (era) Object.assign(d.cronica.find(c => c.id === era.id), nuevo);
        else d.cronica.push({ id: uid('ev'), t: Date.now(), ...nuevo });
      }, era ? 'Acontecimiento actualizado' : 'Acontecimiento añadido');
      dlg.close();
    });

    return { pintar, abrir };
  }
  F.cronica = { montar, TIPOS, ROMANO };
})();
