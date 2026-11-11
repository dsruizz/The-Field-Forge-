/* Campaña: portada, personajes, hilos y grupo. La crónica es del DM y vive en la mesa.
   El jugador ve la portada, la sinopsis y un menú con Personajes y Grupo; su ficha está en «Al campo». */
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

  const ROMANO = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };

  let resumen, miembros, datos, rev, esDm;
  let pestana = params.get('ver') || '';
  const filtro = { texto: '', tipo: 'todos' };

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
    $('[data-acciones-portada]').innerHTML = `<span class="chip ${esDm ? 'chip--dm' : ''}">${esDm ? 'Eres el DM' : 'Jugador'}</span>`;
    if (!pintarPortada.brasas) pintarPortada.brasas = F.particulas($('[data-chispas]'), 'brasas', { color: 'verde', origen: 'ancho', densidad: .45 });
  }

  /* ---------- Pestañas ---------- */
  // El DM tiene pestañas; el jugador, un menú plegado (la mayor parte del tiempo solo mira la portada).
  const PESTANAS = () => esDm ? [['personajes', 'Personajes'], ['hilos', 'Hilos'], ['grupo', 'Grupo y ajustes']] : [['inicio', 'La campaña'], ['personajes', 'Personajes'], ['grupo', 'Grupo']];
  function pintarPestanas() {
    $('[data-pestanas-caja]').hidden = false;
    if (!PESTANAS().some(([k]) => k === pestana)) pestana = PESTANAS()[0][0];
    const boton = esDm ? `<a class="pestana-mesa" href="mesa.html?id=${encodeURIComponent(id)}">${F.icono('mesa')}Mesa y proyección</a>`
      : `<a class="pestana-mesa" href="jugador.html?id=${encodeURIComponent(id)}" title="Tu personaje: ficha, conjuros y mochila">${F.icono('mascara')}Al campo</a>`;
    if (esDm) {
      $('[data-pestanas]').innerHTML = PESTANAS().map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === pestana}" data-pestana="${k}">${t}</button>`).join('') + boton;
      return;
    }
    const actual = PESTANAS().find(([k]) => k === pestana)[1];
    $('[data-pestanas]').innerHTML = `
      <div class="menu menu-camp">
        <button class="menu-camp__boton" type="button" aria-haspopup="true" aria-expanded="false" data-menu-camp>${F.icono('menu')}<span>${e(actual)}</span></button>
        <div class="menu__lista" hidden data-menu-camp-lista>${PESTANAS().map(([k, t]) => `<button type="button" data-pestana="${k}"${k === pestana ? ' aria-current="true"' : ''}>${t}</button>`).join('')}</div>
      </div>${boton}`;
  }
  $('[data-pestanas]').addEventListener('click', ev => {
    const m = ev.target.closest('[data-menu-camp]');
    if (m) { const l = $('[data-menu-camp-lista]'); l.hidden = !l.hidden; m.setAttribute('aria-expanded', String(!l.hidden)); return; }
    const b = ev.target.closest('[data-pestana]'); if (!b) return;
    pestana = b.dataset.pestana;
    const u = new URL(location.href); u.searchParams.set('ver', pestana); history.replaceState(null, '', u);
    pintarPestanas(); pintarPanel(true);
  });
  document.addEventListener('click', ev => { if (!ev.target.closest('.menu-camp')) { const l = $('[data-menu-camp-lista]'); if (l) l.hidden = true; } });

  function panelInicio() {
    const sinopsis = resumen.sinopsis || (datos.campana || {}).sinopsis || '';
    const pjs = (datos.personajes || []).filter(p => p.tipo === 'pj' && p.estado !== 'muerto');
    main.innerHTML = `
      <section class="inicio-camp">
        <div class="inicio-camp__txt">
          <h2 class="inicio-camp__tit">De qué va</h2>
          ${sinopsis ? sinopsis.split(/\n{2,}/).map(par => `<p>${e(par)}</p>`).join('') : '<p class="suave">El DM aún no ha escrito la descripción de la campaña.</p>'}
        </div>
        ${pjs.length ? `<aside class="inicio-camp__grupo"><h2 class="inicio-camp__tit">El grupo</h2><ul>${pjs.map(p => `<li>${F.ficha.retrato(p, 'pet__retrato')}<span><b>${e(p.nombre)}</b><small>${e(F.ficha.linea(p))}</small></span></li>`).join('')}</ul></aside>` : ''}
      </section>`;
  }

  function pintarPanel(animar) {
    ({ inicio: panelInicio, personajes: panelPersonajes, hilos: panelHilos, grupo: panelGrupo })[pestana]();
    if (animar) F.entrar(main.querySelectorAll('.pjc, .hilo, .panel, .inicio-camp > *'), { y: 12, stagger: .02 });
  }
  function pintarTodo() { pintarPortada(); pintarPanel(false); }

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
    const jug = datos.jugadores || {};
    const pjDe = u => pjPorId(jug[u]);
    main.innerHTML = `
      <div class="ajustes">
        ${esDm ? `
        <section class="panel">
          <h2>Invitar al grupo</h2>
          <p class="suave">Comparte el código y la contraseña de la campaña. Quien se una entra como jugador y elige su personaje desde «Al campo»; tú apruebas la elección.</p>
          <div class="codigo"><span>${e(resumen.codigo)}</span><button class="boton boton--fantasma boton--icono" type="button" data-copiar aria-label="Copiar código">${F.icono('copiar')}</button></div>
        </section>` : ''}
        <section class="panel">
          <h2>Grupo</h2>
          <ul class="miembros">${miembros.map(m => { const p = m.rol === 'jugador' && pjDe(m.usuario); return `<li><span>${e(m.usuario)}${m.usuario === usuario.usuario ? ' <span class="suave">(tú)</span>' : ''}${p ? `<small class="miembros__pj">lleva a ${e(p.nombre)}</small>` : ''}</span><span class="miembros__acc">${esDm && p ? `<button class="boton boton--fantasma boton--chico" type="button" data-liberar="${e(m.usuario)}" title="Deja libre a ${e(p.nombre)}">Liberar</button>` : ''}<span class="chip ${m.rol === 'dm' ? 'chip--dm' : ''}">${m.rol === 'dm' ? 'DM' : 'Jugador'}</span></span></li>`; }).join('')}</ul>
        </section>
        ${esDm ? `
        <section class="panel">
          <h2>Campaña</h2>
          <p class="suave">Nombre, ambientación, descripción para los jugadores y contraseña.</p>
          <button class="boton boton--secundario" type="button" data-editar-camp>${F.icono('editar')}Editar campaña</button>
        </section>
        <section class="panel">
          <h2>Guardar partida</h2>
          <p class="suave">Descarga toda la campaña en un .zip: crónica, personajes, mapas, escenas, inventarios e imágenes. Mientras estemos en beta, guárdala de vez en cuando; con ella puedes recuperar la partida en otra versión.</p>
          <div class="fila-acciones">
            <a class="boton boton--primario" href="api/campanas/${encodeURIComponent(id)}/copia" download>${F.icono('abajo')}Descargar .zip</a>
            <label class="boton boton--secundario">${F.icono('subir')}Cargar partida<input class="oculto-visual" type="file" accept=".zip,application/zip,application/json,.json" data-importar></label>
          </div>
          <p class="suave">Cargar una partida reemplaza el contenido actual de esta campaña. Acepta el .zip de aquí y las copias .json de la herramienta clásica.</p>
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
    if (d.tipo) { filtro.tipo = d.tipo; panelPersonajes(); return; }
    if (d.ficha) return verFicha(d.ficha);
    if ('nuevoPj' in d) { formNp.reset(); formNp.querySelector('.aviso').textContent = ''; dlgNp.showModal(); return; }
    if (d.hilo) return;
    if (d.borrarHilo) return guardar(dd => { dd.hilos = dd.hilos.filter(h => h.id !== d.borrarHilo); }, 'Hilo borrado');
    if (d.liberar) {
      if (!confirm('¿Dejar libre su personaje? Podrá pedir otro.')) return;
      try { const r = await F.api('campanas/' + encodeURIComponent(id) + '/jugador', { metodo: 'POST', datos: { accion: 'asignar', usuario: d.liberar, pj: '' } }); datos.jugadores = r.jugadores; F.toast('Personaje libre'); }
      catch (err) { F.toast(err.message); }
      return panelGrupo();
    }
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
        const archivo = t.files[0];
        const copia = /\.zip$/i.test(archivo.name) || archivo.type.includes('zip') ? await leerZip(archivo) : JSON.parse(await archivo.text());
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

  /* Lee el .zip de «Guardar partida» (archivos sin comprimir) y lo convierte al formato de importación. */
  async function leerZip(archivo) {
    const buf = new Uint8Array(await archivo.arrayBuffer()), v = new DataView(buf.buffer), dec = new TextDecoder();
    const archivos = {}; let i = 0;
    while (i + 30 <= buf.length && v.getUint32(i, true) === 0x04034b50) {
      const metodo = v.getUint16(i + 8, true), tam = v.getUint32(i + 18, true), ln = v.getUint16(i + 26, true), lx = v.getUint16(i + 28, true);
      const nombre = dec.decode(buf.subarray(i + 30, i + 30 + ln)), ini = i + 30 + ln + lx;
      if (metodo !== 0) throw new Error('Ese .zip no lo creó The Field Forge (está comprimido).');
      archivos[nombre] = buf.subarray(ini, ini + tam); i = ini + tam;
    }
    if (!archivos['partida.json']) throw new Error('El .zip no contiene una partida de The Field Forge.');
    const copia = JSON.parse(dec.decode(archivos['partida.json']));
    const tipo = n => /\.png$/i.test(n) ? 'image/png' : /\.webp$/i.test(n) ? 'image/webp' : /\.gif$/i.test(n) ? 'image/gif' : 'image/jpeg';
    copia.imagenes = {};
    for (const [n, b] of Object.entries(archivos)) if (n.startsWith('img/')) copia.imagenes[n] = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(new Blob([b], { type: tipo(n) })); });
    return copia;
  }

  /* ---------- Inicio ---------- */
  // Peticiones de los jugadores y lo que cambian desde su móvil.
  if (esDm) F.peticiones.montar({
    id, caja: $('[data-pets]'), datos: () => datos, alRev: r => { if (r === rev + 1) rev = r; },
    alCambiar: () => { if ((pestana === 'grupo' || pestana === 'personajes') && !document.querySelector('dialog[open]') && !main.contains(document.activeElement)) pintarPanel(false); }
  });
  pintarPortada();
  pintarPestanas();
  pintarPanel(true);
  if (window.gsap && !F.reducido()) window.gsap.from('.portada-camp__in > *', { y: 14, opacity: 0, duration: .6, stagger: .08, ease: 'power3.out', clearProps: 'all' });
  if (params.get('nueva')) F.toast('Campaña creada. Ya puedes invitar a tu grupo.');
})();
