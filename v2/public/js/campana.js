/* Campaña: crónica, personajes, hilos y grupo.
   El DM edita todo; el jugador solo lee (el servidor ya le envía la versión filtrada). */
(async () => {
  const F = window.Forja;
  const TFF = window.TFF;
  const e = F.esc;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const $ = s => document.querySelector(s);
  const main = $('[data-contenido]');

  const TIPOS = { escena: 'Escena', personaje: 'Personaje', combate: 'Combate', descubrimiento: 'Descubrimiento', decision: 'Decisión', hito: 'Hito' };
  const ROMANO = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };

  let resumen, miembros, datos, rev, esDm;
  let pestana = params.get('ver') || 'cronica';
  const filtro = { sesion: 'todas', texto: '', tipo: 'todos' };

  /* ---------- Carga ---------- */
  try {
    const [a, b] = await Promise.all([F.api('campanas/' + encodeURIComponent(id)), F.api('campanas/' + encodeURIComponent(id) + '/datos')]);
    resumen = a.campana; miembros = a.miembros; datos = b.datos; rev = b.rev; esDm = b.rol === 'dm';
  } catch (err) {
    main.innerHTML = `<div class="vacio"><h2>No encontrada</h2><p>${e(err.message)}</p><a class="boton boton--primario" href="campanas.html">Volver a mis campañas</a></div>`;
    return;
  }

  /* ---------- Guardado (solo DM) ---------- */
  let guardando = Promise.resolve();
  function guardar(cambio, mensaje) {
    cambio(datos);
    pintarTodo();
    guardando = guardando.then(async () => {
      try {
        const r = await F.api('campanas/' + encodeURIComponent(id) + '/datos', { metodo: 'PUT', datos: { rev, datos } });
        rev = r.rev;
        if (mensaje) F.toast(mensaje);
      } catch (err) {
        F.toast(err.estado === 409 ? 'La campaña cambió en otra ventana. Recargando…' : 'No se pudo guardar: ' + err.message);
        if (err.estado === 409) setTimeout(() => location.reload(), 1400);
      }
    });
    return guardando;
  }
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const pjPorId = idp => (datos.personajes || []).find(p => p.id === idp);

  /* ---------- Portada ---------- */
  function pintarPortada() {
    $('[data-portada]').hidden = false;
    $('[data-miga]').innerHTML = F.icono('atras') + 'Mis campañas';
    $('[data-titulo]').textContent = resumen.nombre;
    $('[data-amb]').textContent = resumen.ambientacion || '';
    document.title = resumen.nombre + ' · The Field Forge';
    const ult = resumen.ultimo;
    $('[data-cifras]').innerHTML = [
      [resumen.partidas, resumen.partidas === 1 ? 'sesión jugada' : 'sesiones jugadas'],
      resumen.nivelMedio ? [resumen.nivelMedio, 'nivel medio del grupo'] : null,
      [resumen.pjs.length, resumen.pjs.length === 1 ? 'personaje jugador' : 'personajes jugadores'],
      ult ? [ROMANO(ult.sesion), 'último: ' + ult.titulo] : null
    ].filter(Boolean).map(([b, s]) => `<div class="cifra"><b>${e(b)}</b><span>${e(s)}</span></div>`).join('');
    $('[data-acciones-portada]').innerHTML = `<span class="chip ${esDm ? 'chip--dm' : ''}">${esDm ? 'Eres el DM' : 'Jugador · solo lectura'}</span>`;
  }

  /* ---------- Pestañas ---------- */
  const PESTANAS = () => [['cronica', 'Crónica'], ['personajes', 'Personajes'], ...(esDm ? [['hilos', 'Hilos']] : []), ['grupo', esDm ? 'Grupo y ajustes' : 'Grupo']];
  function pintarPestanas() {
    $('[data-pestanas-caja]').hidden = false;
    if (!PESTANAS().some(([k]) => k === pestana)) pestana = 'cronica';
    $('[data-pestanas]').innerHTML = PESTANAS().map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === pestana}" data-pestana="${k}">${t}</button>`).join('');
  }
  $('[data-pestanas]').addEventListener('click', ev => {
    const b = ev.target.closest('[data-pestana]'); if (!b) return;
    pestana = b.dataset.pestana;
    const u = new URL(location.href); u.searchParams.set('ver', pestana); history.replaceState(null, '', u);
    pintarPestanas(); pintarPanel(true);
  });

  function pintarPanel(animar) {
    ({ cronica: panelCronica, personajes: panelPersonajes, hilos: panelHilos, grupo: panelGrupo })[pestana]();
    if (animar) F.entrar(main.querySelectorAll('.evento, .pjc, .hilo, .panel, .sesion__cab'), { y: 12, stagger: .02 });
  }
  function pintarTodo() { pintarPortada(); pintarPanel(false); }

  /* ---------- Crónica ---------- */
  function panelCronica() {
    const cr = (datos.cronica || []).slice();
    const sesiones = [...new Set(cr.map(x => x.sesion))].sort((a, b) => b - a);
    const q = filtro.texto.trim().toLowerCase();
    const visibles = cr.filter(x =>
      (filtro.sesion === 'todas' || String(x.sesion) === filtro.sesion) &&
      (!q || [x.titulo, x.texto, x.lugar, x.cita].join(' ').toLowerCase().includes(q)));
    const porSesion = sesiones.map(n => [n, visibles.filter(x => x.sesion === n).sort((a, b) => (a.t || 0) - (b.t || 0))]).filter(([, l]) => l.length);
    const titulos = (datos.campana && datos.campana.sesiones) || {};

    main.innerHTML = `
      <div class="herramientas">
        <div class="segmento" role="group" aria-label="Filtrar por sesión">
          <button type="button" aria-pressed="${filtro.sesion === 'todas'}" data-sesion="todas">Todas</button>
          ${sesiones.slice().reverse().map(n => `<button type="button" aria-pressed="${filtro.sesion === String(n)}" data-sesion="${n}">${ROMANO(n)}</button>`).join('')}
        </div>
        <input class="entrada" type="search" placeholder="Buscar en la crónica" aria-label="Buscar en la crónica" value="${e(filtro.texto)}" data-buscar>
        ${esDm ? `<button class="boton boton--primario boton--chico empuja" type="button" data-nuevo-evento>${F.icono('mas')}Acontecimiento</button>` : ''}
      </div>
      ${porSesion.length ? `<div class="cronica">${porSesion.map(([n, lista]) => `
        <section class="sesion" aria-label="Sesión ${n}">
          <header class="sesion__cab"><span class="sesion__num">${ROMANO(n)}</span><h2 class="sesion__titulo">${e(titulos[n] || 'Sesión ' + n)}<small>${lista.length} ${lista.length === 1 ? 'acontecimiento' : 'acontecimientos'}</small></h2></header>
          ${lista.map(evento).join('')}
        </section>`).join('')}</div>`
        : `<div class="vacio"><h2>${q ? 'Nada coincide' : 'La historia empieza aquí'}</h2><p>${q ? 'Prueba con otras palabras.' : esDm ? 'Registra el primer acontecimiento de la campaña.' : 'Cuando el DM registre lo que pasa en las sesiones, aparecerá aquí.'}</p>${esDm && !q ? `<div class="vacio__acciones"><button class="boton boton--primario" type="button" data-nuevo-evento>${F.icono('mas')}Primer acontecimiento</button></div>` : ''}</div>`}`;

    const buscar = main.querySelector('[data-buscar]');
    buscar.addEventListener('input', () => { filtro.texto = buscar.value; const pos = buscar.selectionStart; panelCronica(); const b = main.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); });
  }
  function evento(x) {
    const enlaces = (x.enlaces || []).map(pjPorId).filter(Boolean);
    return `
      <article class="evento${x.oculto ? ' evento--oculto' : ''}">
        <div class="evento__meta">
          <span class="chip chip--${e(x.tipo)}">${e(TIPOS[x.tipo] || x.tipo)}</span>
          ${x.oculto ? '<span class="chip chip--oculto">Solo DM</span>' : ''}
          ${x.lugar ? `<span>${e(x.lugar)}</span>` : ''}
          ${esDm ? `<span class="evento__acciones">
            <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-ocultar="${e(x.id)}" aria-label="${x.oculto ? 'Mostrar a los jugadores' : 'Ocultar a los jugadores'}" title="${x.oculto ? 'Mostrar a los jugadores' : 'Ocultar a los jugadores'}">${F.icono(x.oculto ? 'ojoNo' : 'ojo')}</button>
            <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-editar-evento="${e(x.id)}" aria-label="Editar">${F.icono('editar')}</button>
            <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-borrar-evento="${e(x.id)}" aria-label="Borrar">${F.icono('borrar')}</button>
          </span>` : ''}
        </div>
        <h3>${e(x.titulo)}</h3>
        ${x.img ? `<img class="evento__img" src="${e(x.img)}" alt="" loading="lazy">` : ''}
        ${x.texto ? `<p class="evento__texto">${e(x.texto)}</p>` : ''}
        ${x.cita ? `<blockquote class="evento__cita">${e(x.cita)}</blockquote>` : ''}
        ${enlaces.length ? `<div class="enlaces">${enlaces.map(p => `<button class="enlace-pj" type="button" data-ficha="${e(p.id)}"><span class="mono">${p.img ? `<img src="${e(p.img)}" alt="">` : e(p.nombre.charAt(0))}</span>${e(p.nombre)}</button>`).join('')}</div>` : ''}
      </article>`;
  }

  /* Diálogo de acontecimiento */
  const dlgEv = F.dialogo($('#evento'));
  const formEv = dlgEv.querySelector('form');
  formEv.tipo.innerHTML = Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
  let editandoEv = null;
  function abrirEvento(x) {
    editandoEv = x || null;
    formEv.reset();
    dlgEv.querySelector('.aviso').textContent = '';
    $('#evento-titulo').textContent = x ? 'Editar acontecimiento' : 'Nuevo acontecimiento';
    const ultima = Math.max(1, ...(datos.cronica || []).map(c => c.sesion || 1));
    const ses = x ? x.sesion : (filtro.sesion !== 'todas' ? Number(filtro.sesion) : ultima);
    formEv.sesion.value = ses;
    formEv.sesionTitulo.value = ((datos.campana || {}).sesiones || {})[ses] || '';
    formEv.tipo.value = x ? x.tipo : 'escena';
    for (const k of ['titulo', 'lugar', 'texto', 'cita']) formEv[k].value = x ? x[k] || '' : '';
    formEv.oculto.checked = !!(x && x.oculto);
    const sel = new Set(x ? x.enlaces || [] : []);
    const orden = (datos.personajes || []).slice().sort((a, b) => (a.tipo === 'pj' ? 0 : 1) - (b.tipo === 'pj' ? 0 : 1) || a.nombre.localeCompare(b.nombre));
    dlgEv.querySelector('[data-enlaces]').innerHTML = orden.map(p => `<label><input type="checkbox" name="enlace" value="${e(p.id)}"${sel.has(p.id) ? ' checked' : ''}>${e(p.nombre)}</label>`).join('') || '<span class="suave">Aún no hay personajes.</span>';
    dlgEv.showModal(); formEv.titulo.focus();
  }
  formEv.sesion.addEventListener('input', () => { formEv.sesionTitulo.value = ((datos.campana || {}).sesiones || {})[formEv.sesion.value] || ''; });
  formEv.addEventListener('submit', ev => {
    ev.preventDefault();
    const aviso = formEv.querySelector('.aviso');
    const invalido = [...formEv.querySelectorAll('.entrada')].find(i => !i.checkValidity());
    if (invalido) { invalido.focus(); aviso.textContent = invalido.validationMessage; return; }
    const sesion = Math.max(1, parseInt(formEv.sesion.value, 10) || 1);
    const nuevo = {
      sesion, tipo: formEv.tipo.value, titulo: formEv.titulo.value.trim(), lugar: formEv.lugar.value.trim(), texto: formEv.texto.value.trim(), cita: formEv.cita.value.trim(),
      enlaces: [...formEv.querySelectorAll('[name=enlace]:checked')].map(i => i.value), oculto: formEv.oculto.checked
    };
    const titSes = formEv.sesionTitulo.value.trim();
    guardar(d => {
      d.campana = d.campana || {}; d.campana.sesiones = d.campana.sesiones || {};
      if (titSes) d.campana.sesiones[sesion] = titSes;
      d.campana.sesionActual = Math.max(d.campana.sesionActual || 1, sesion);
      if (editandoEv) Object.assign(d.cronica.find(c => c.id === editandoEv.id), nuevo);
      else d.cronica.push({ id: uid('ev'), img: '', t: Date.now(), ...nuevo });
    }, editandoEv ? 'Acontecimiento actualizado' : 'Acontecimiento añadido');
    dlgEv.close();
  });

  /* ---------- Personajes ---------- */
  function panelPersonajes() {
    const q = filtro.texto.trim().toLowerCase();
    const lista = (datos.personajes || []).filter(p => (filtro.tipo === 'todos' || p.tipo === filtro.tipo) && (!q || [p.nombre, p.rol, p.raza, p.clase].join(' ').toLowerCase().includes(q)));
    const grupos = [['pj', 'Personajes jugadores'], ['npc', 'NPC'], ['enemigo', 'Enemigos']]
      .map(([t, n]) => [n, lista.filter(p => p.tipo === t).sort((a, b) => (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1) || a.nombre.localeCompare(b.nombre))])
      .filter(([, l]) => l.length);
    main.innerHTML = `
      <div class="herramientas">
        <div class="segmento" role="group" aria-label="Filtrar por tipo">
          ${[['todos', 'Todos'], ['pj', 'PJ'], ['npc', 'NPC'], ['enemigo', 'Enemigos']].map(([k, t]) => `<button type="button" aria-pressed="${filtro.tipo === k}" data-tipo="${k}">${t}</button>`).join('')}
        </div>
        <input class="entrada" type="search" placeholder="Buscar por nombre, rol o clase" aria-label="Buscar personajes" value="${e(filtro.texto)}" data-buscar>
        ${esDm ? `<button class="boton boton--primario boton--chico empuja" type="button" data-nuevo-pj>${F.icono('mas')}Añadir</button>` : ''}
      </div>
      ${grupos.length ? grupos.map(([n, l]) => `<section class="grupo-fichas"><h2>${n} · ${l.length}</h2><div class="fichas">${l.map(F.ficha.tarjeta).join('')}</div></section>`).join('')
        : `<div class="vacio"><h2>Nadie por aquí</h2><p>${esDm ? 'Añade PJ, NPC o criaturas del bestiario.' : 'Los personajes aparecerán cuando entren en la historia.'}</p></div>`}`;
    const buscar = main.querySelector('[data-buscar]');
    buscar.addEventListener('input', () => { filtro.texto = buscar.value; const pos = buscar.selectionStart; panelPersonajes(); const b = main.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); });
  }

  /* Ver ficha */
  const dlgVer = F.dialogo($('#ver-ficha'));
  function verFicha(idp) {
    const f = pjPorId(idp); if (!f) return;
    dlgVer.querySelector('[data-cuerpo]').innerHTML = F.ficha.completa(f);
    dlgVer.querySelector('[data-pie]').innerHTML = esDm ? `
      <button class="boton boton--fantasma boton--chico empuja" type="button" data-borrar-pj="${e(f.id)}">${F.icono('borrar')}Quitar de la campaña</button>
      <button class="boton boton--primario boton--chico" type="button" data-editar-pj="${e(f.id)}">${F.icono('editar')}Editar</button>` : '';
    if (!dlgVer.open) dlgVer.showModal();
  }

  /* Editar ficha */
  const dlgEd = F.dialogo($('#editar-ficha'));
  const formEd = dlgEd.querySelector('form');
  let editandoPj = null, imgNueva;
  const pintarRetrato = (img, nombre) => { dlgEd.querySelector('[data-retrato]').innerHTML = img ? `<img src="${e(img)}" alt="">` : e((nombre || '?').charAt(0)); };
  function abrirEdicionPj(idp) {
    const f = pjPorId(idp); if (!f) return;
    editandoPj = f; imgNueva = undefined;
    formEd.reset(); dlgEd.querySelector('.aviso').textContent = '';
    for (const k of ['nombre', 'rol', 'tipo', 'estado', 'actitud', 'notas']) formEd[k].value = f[k] || (k === 'estado' ? 'activo' : k === 'tipo' ? 'npc' : '');
    if (!['Amistoso', 'Indiferente', 'Hostil'].includes(f.actitud)) formEd.actitud.value = 'Indiferente';
    formEd.nivel.value = f.nivel || ''; formEd.nivel.disabled = !f.gen;
    formEd.pg.value = f.pg ?? f.pgMax ?? '';
    pintarRetrato(f.img, f.nombre);
    dlgVer.close(); dlgEd.showModal(); formEd.nombre.focus();
  }
  dlgEd.querySelector('#ef-img').addEventListener('change', async ev => {
    try { imgNueva = await F.reducirImagen(ev.target.files[0]); pintarRetrato(imgNueva, formEd.nombre.value); }
    catch (err) { dlgEd.querySelector('.aviso').textContent = err.message; }
  });
  dlgEd.querySelector('[data-quitar-img]').addEventListener('click', () => { imgNueva = ''; pintarRetrato('', formEd.nombre.value); });
  formEd.addEventListener('submit', ev => {
    ev.preventDefault();
    if (!formEd.nombre.value.trim()) { formEd.querySelector('.aviso').textContent = 'Escribe un nombre.'; return; }
    const idp = editandoPj.id;
    guardar(d => {
      const f = d.personajes.find(p => p.id === idp);
      Object.assign(f, { nombre: formEd.nombre.value.trim(), rol: formEd.rol.value.trim(), tipo: formEd.tipo.value, estado: formEd.estado.value, actitud: formEd.actitud.value, notas: formEd.notas.value });
      if (imgNueva !== undefined) f.img = imgNueva;
      const nivel = parseInt(formEd.nivel.value, 10);
      if (f.gen && nivel && nivel !== f.nivel) { f.nivel = nivel; TFF.npc.recalcular(f); }
      const pg = parseInt(formEd.pg.value, 10);
      if (!Number.isNaN(pg)) f.pg = Math.min(pg, f.pgMax || pg);
    }, 'Personaje guardado');
    dlgEd.close();
    verFicha(idp);
  });

  /* Nuevo personaje (forja o bestiario) */
  const dlgNp = F.dialogo($('#nuevo-pj'));
  const formNp = dlgNp.querySelector('form');
  let modoNp = 'forjar';
  if (TFF && TFF.reglas) {
    formNp.raza.innerHTML = '<option value="">Al azar</option>' + TFF.reglas.RAZAS.map(r => `<option value="${r.id}">${e(r.nombre)}</option>`).join('');
    formNp.clase.innerHTML = '<option value="">Al azar</option>' + TFF.reglas.CLASES.map(c => `<option value="${c.id}">${e(c.nombre)}</option>`).join('');
    const grupos = {};
    (TFF.bestiario || []).forEach(b => { (grupos[b.grupo || 'Criaturas'] = grupos[b.grupo || 'Criaturas'] || []).push(b); });
    formNp.criatura.innerHTML = Object.entries(grupos).map(([g, l]) => `<optgroup label="${e(g)}">${l.map(b => `<option value="${e(b.clave)}">${e(b.nombre)} · VD ${e(b.vd)}</option>`).join('')}</optgroup>`).join('');
  }
  dlgNp.querySelector('[data-modo-np]').addEventListener('click', ev => {
    const b = ev.target.closest('[data-modo]'); if (!b) return;
    modoNp = b.dataset.modo;
    dlgNp.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    dlgNp.querySelectorAll('[data-np]').forEach(x => { x.hidden = x.dataset.np !== modoNp; });
  });
  formNp.addEventListener('submit', ev => {
    ev.preventDefault();
    let f;
    try {
      if (modoNp === 'forjar') {
        f = TFF.npc.generar({ tipo: formNp.tipo.value, raza: formNp.raza.value || undefined, clase: formNp.clase.value || undefined, nivel: formNp.nivel.value, nombre: formNp.nombre.value, rol: formNp.rol.value });
        if (formNp.tipo.value !== 'pj') f.enc = false;
      } else {
        const b = (TFF.bestiario || []).find(x => x.clave === formNp.criatura.value);
        f = TFF.npc.desdeBestiario(b);
        f.tipo = 'enemigo';
        if (formNp.cnombre.value.trim()) f.nombre = formNp.cnombre.value.trim();
      }
    } catch (err) { formNp.querySelector('.aviso').textContent = 'No se pudo crear: ' + err.message; return; }
    guardar(d => { d.personajes.push(f); }, `${f.nombre} se une a la campaña`);
    dlgNp.close();
    verFicha(f.id);
  });

  /* ---------- Hilos (DM) ---------- */
  function panelHilos() {
    const hilos = datos.hilos || [];
    const abiertos = hilos.filter(h => h.estado !== 'resuelto'), resueltos = hilos.filter(h => h.estado === 'resuelto');
    const fila = h => `<li class="hilo${h.estado === 'resuelto' ? ' hilo--resuelto' : ''}"><input type="checkbox" aria-label="Marcar como resuelto" data-hilo="${e(h.id)}"${h.estado === 'resuelto' ? ' checked' : ''}><span>${e(h.texto)}</span><button class="boton boton--fantasma boton--chico boton--icono" type="button" data-borrar-hilo="${e(h.id)}" aria-label="Borrar">${F.icono('borrar')}</button></li>`;
    main.innerHTML = `
      <form class="herramientas" data-nuevo-hilo>
        <input class="entrada" name="texto" placeholder="Nuevo hilo: un misterio, una deuda, una promesa…" aria-label="Nuevo hilo" maxlength="300" required>
        <button class="boton boton--primario boton--chico" type="submit">${F.icono('mas')}Añadir</button>
      </form>
      <ul class="hilos">${abiertos.map(fila).join('') || '<li class="suave">No hay hilos abiertos.</li>'}</ul>
      ${resueltos.length ? `<details class="rasgos"><summary>Resueltos · ${resueltos.length}</summary><ul class="hilos">${resueltos.map(fila).join('')}</ul></details>` : ''}`;
    main.querySelector('[data-nuevo-hilo]').addEventListener('submit', ev => {
      ev.preventDefault();
      const texto = ev.target.texto.value.trim(); if (!texto) return;
      guardar(d => { d.hilos.push({ id: uid('h'), texto, estado: 'abierto' }); }, 'Hilo añadido');
      setTimeout(() => main.querySelector('[data-nuevo-hilo] input').focus(), 0);
    });
  }

  /* ---------- Grupo y ajustes ---------- */
  function panelGrupo() {
    main.innerHTML = `
      <div class="ajustes">
        ${esDm ? `
        <section class="panel">
          <h2>Invitar al grupo</h2>
          <p class="suave">Comparte el código y la contraseña de la campaña. Quien se una entra como jugador y solo puede leer.</p>
          <div class="codigo"><span>${e(resumen.codigo)}</span><button class="boton boton--fantasma boton--icono" type="button" data-copiar aria-label="Copiar código">${F.icono('copiar')}</button></div>
        </section>` : ''}
        <section class="panel">
          <h2>Grupo</h2>
          <ul class="miembros">${miembros.map(m => `<li><span>${e(m.usuario)}${m.usuario === usuario.usuario ? ' <span class="suave">(tú)</span>' : ''}</span><span class="chip ${m.rol === 'dm' ? 'chip--dm' : ''}">${m.rol === 'dm' ? 'DM' : 'Jugador'}</span></li>`).join('')}</ul>
        </section>
        ${esDm ? `
        <section class="panel">
          <h2>Mesa y proyector</h2>
          <p class="suave">El mapa, el proyector y la sala de móviles siguen en la herramienta de mesa mientras los pasamos a esta versión.</p>
          <a class="boton boton--secundario" href="/clasica/" target="_blank" rel="noopener">${F.icono('mesa')}Abrir herramienta de mesa</a>
        </section>
        <section class="panel">
          <h2>Campaña</h2>
          <p class="suave">Nombre, ambientación, sinopsis y contraseña.</p>
          <button class="boton boton--secundario" type="button" data-editar-camp>${F.icono('editar')}Editar campaña</button>
        </section>
        <section class="panel">
          <h2>Importar copia</h2>
          <p class="suave">Sube la copia que exportaste en la herramienta de mesa (⋯ → Exportar copia). Reemplaza la crónica, los personajes, los hilos y los mapas de esta campaña.</p>
          <label class="boton boton--secundario">${F.icono('subir')}Elegir archivo .json<input class="oculto-visual" type="file" accept="application/json,.json" data-importar></label>
        </section>` : ''}
      </div>`;
  }

  /* ---------- Editar campaña ---------- */
  const dlgCamp = F.dialogo($('#editar'));
  dlgCamp.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, aviso = f.querySelector('.aviso'), boton = f.querySelector('[type=submit]');
    const invalido = [...f.querySelectorAll('.entrada')].find(i => !i.checkValidity());
    if (invalido) { invalido.focus(); aviso.textContent = invalido.validationMessage; return; }
    const d = F.datosForm(f); if (!d.clave) delete d.clave;
    F.ocupado(boton, true);
    try { const r = await F.api('campanas/' + encodeURIComponent(id), { metodo: 'PATCH', datos: d }); resumen = r.campana; dlgCamp.close(); pintarTodo(); F.toast('Cambios guardados'); }
    catch (err) { aviso.textContent = err.message; }
    finally { F.ocupado(boton, false); }
  });

  /* ---------- Delegación de clics ---------- */
  main.addEventListener('click', async ev => {
    const t = ev.target.closest('button, [data-ficha]');
    if (!t) return;
    const d = t.dataset;
    if (d.sesion) { filtro.sesion = d.sesion; panelCronica(); return; }
    if (d.tipo) { filtro.tipo = d.tipo; panelPersonajes(); return; }
    if (d.ficha) return verFicha(d.ficha);
    if ('nuevoEvento' in d) return abrirEvento();
    if (d.editarEvento) return abrirEvento(datos.cronica.find(c => c.id === d.editarEvento));
    if (d.ocultar) return guardar(dd => { const c = dd.cronica.find(x => x.id === d.ocultar); c.oculto = !c.oculto; }, 'Visibilidad cambiada');
    if (d.borrarEvento) { if (confirm('¿Borrar este acontecimiento?')) guardar(dd => { dd.cronica = dd.cronica.filter(x => x.id !== d.borrarEvento); }, 'Acontecimiento borrado'); return; }
    if ('nuevoPj' in d) { formNp.reset(); formNp.querySelector('.aviso').textContent = ''; dlgNp.showModal(); return; }
    if (d.hilo) return;
    if (d.borrarHilo) return guardar(dd => { dd.hilos = dd.hilos.filter(h => h.id !== d.borrarHilo); }, 'Hilo borrado');
    if ('copiar' in d) { try { await navigator.clipboard.writeText(resumen.codigo); F.toast('Código copiado'); } catch { F.toast('No se pudo copiar. Selecciónalo a mano.'); } return; }
    if ('editarCamp' in d) {
      const f = dlgCamp.querySelector('form'); f.reset();
      f.nombre.value = resumen.nombre; f.ambientacion.value = resumen.ambientacion; f.sinopsis.value = resumen.sinopsis;
      dlgCamp.querySelector('.aviso').textContent = ''; dlgCamp.showModal();
    }
  });
  main.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.dataset.hilo) return guardar(dd => { const h = dd.hilos.find(x => x.id === t.dataset.hilo); h.estado = t.checked ? 'resuelto' : 'abierto'; });
    if ('importar' in t.dataset && t.files[0]) {
      if (!confirm('Esto reemplaza el contenido actual de la campaña por el de la copia. ¿Continuar?')) { t.value = ''; return; }
      try {
        const copia = JSON.parse(await t.files[0].text());
        F.toast('Importando…');
        const r = await F.api('campanas/' + encodeURIComponent(id) + '/importar', { metodo: 'POST', datos: copia });
        F.toast(`Copia importada${r.imagenes ? ` con ${r.imagenes} imágenes` : ''}. Recargando…`);
        setTimeout(() => location.reload(), 1200);
      } catch (err) { F.toast('No se pudo importar: ' + err.message); t.value = ''; }
    }
  });
  dlgVer.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.editarPj) abrirEdicionPj(t.dataset.editarPj);
    if (t.dataset.borrarPj && confirm('¿Quitar este personaje de la campaña? Desaparecerá también de los acontecimientos.')) {
      const idp = t.dataset.borrarPj;
      guardar(dd => { dd.personajes = dd.personajes.filter(p => p.id !== idp); dd.cronica.forEach(c => { c.enlaces = (c.enlaces || []).filter(x => x !== idp); }); }, 'Personaje quitado');
      dlgVer.close();
    }
  });

  /* ---------- Inicio ---------- */
  pintarPortada();
  pintarPestanas();
  pintarPanel(true);
  if (window.gsap && !F.reducido()) window.gsap.from('.portada-camp__in > *', { y: 14, opacity: 0, duration: .6, stagger: .08, ease: 'power3.out', clearProps: 'all' });
  if (params.get('nueva')) F.toast('Campaña creada. Ya puedes invitar a tu grupo.');
})();
