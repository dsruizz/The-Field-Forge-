/* Mesa: la consola tranquila del DM. Aquí se decide qué ve la mesa (portada, crónica, mapa, fichas o negro),
   quién está en escena y con qué datos, y se lanzan avisos y presentaciones.
   El mapa se prepara aparte, en el editor de escenas (escena.html). */
(async () => {
  const F = window.Forja, e = F.esc, T = F.tablero, TFF = window.TFF || {};
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);
  const params = new URLSearchParams(location.search), id = params.get('id') || '';
  const $ = s => document.querySelector(s);
  const uid = F.vivo.uid;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

  let datos, rev, resumen;
  try {
    const [a, b] = await Promise.all([F.api('campanas/' + encodeURIComponent(id)), F.api('campanas/' + encodeURIComponent(id) + '/datos')]);
    if (b.rol !== 'dm') { location.replace('campana.html?id=' + encodeURIComponent(id)); return; }
    resumen = a.campana; datos = b.datos; rev = b.rev;
  } catch { location.replace('campanas.html'); return; }
  document.title = 'Mesa · ' + resumen.nombre;
  $('[data-miga]').href = 'campana.html?id=' + encodeURIComponent(id);
  $('[data-miga]').innerHTML = F.icono('atras') + e(resumen.nombre);

  const mesa = F.vivo.preparar(datos);
  const vivo = F.vivo.crear({ id, datos: () => datos, resumen });
  const tab = T.montar($('[data-tablero]'));
  const pj = idp => datos.personajes.find(p => p.id === idp);
  const TIPO = { pj: 'PJ', npc: 'NPC', enemigo: 'Enemigo' };
  let vista = ['escena', 'escenas', 'presentaciones'].includes(params.get('ver')) ? params.get('ver') : 'escena';

  /* ---------- Guardado ---------- */
  let reloj = 0, guardando = false, sucio = false;
  const marca = t => { $('[data-guardado]').textContent = t; };
  function programar() { sucio = true; marca('Guardando…'); clearTimeout(reloj); reloj = setTimeout(guardar, 600); }
  async function guardar() {
    clearTimeout(reloj);
    if (guardando || !sucio) return;
    guardando = true; sucio = false;
    try { const r = await F.api('campanas/' + encodeURIComponent(id) + '/datos', { metodo: 'PUT', datos: { rev, datos } }); rev = r.rev; if (!sucio) marca('Guardado'); }
    catch (err) {
      marca('Sin guardar');
      F.toast(err.estado === 409 ? 'La campaña cambió en otra ventana. Recargando…' : 'No se pudo guardar: ' + err.message);
      if (err.estado === 409) return setTimeout(() => location.reload(), 1500);
      sucio = true;
    }
    guardando = false;
    if (sucio) programar();
  }
  addEventListener('pagehide', () => { if (sucio) guardar(); });
  const cambio = fn => { fn(); pintarVista(); vivo.emitir(); programar(); };

  /* ---------- Proyector: vista previa y qué se muestra ---------- */
  const ICONO_MODO = { portada: 'libro', cronica: 'texto', mapa: 'mapa', fichas: 'grupo', negro: 'telon' };
  function pintarVivo(s) {
    tab.estado(s);
    const modo = vivo.ctl.modo, esc = mesa.escenas.find(x => x.id === mesa.actual);
    $('[data-modos]').innerHTML = Object.entries(vivo.MODOS).map(([k, t]) => `<button type="button" aria-pressed="${k === modo}" data-modo="${k}">${F.icono(ICONO_MODO[k])}<span>${t}</span></button>`).join('');
    const eventos = datos.cronica.slice().sort((a, b) => (b.sesion - a.sesion) || ((b.t || 0) - (a.t || 0)));
    $('[data-modo-extra]').innerHTML =
      modo === 'mapa' ? `<label class="campo"><span class="etq">Escena en el proyector</span><select class="entrada entrada--chica" data-escena-sel>${mesa.escenas.map(x => `<option value="${e(x.id)}"${x.id === mesa.actual ? ' selected' : ''}>${e(x.nombre)}</option>`).join('')}</select></label>
        <a class="boton boton--secundario boton--chico" href="escena.html?id=${encodeURIComponent(id)}&escena=${encodeURIComponent(esc.id)}">${F.icono('editar')}Editar esta escena</a>`
      : modo === 'cronica' ? (eventos.length ? `<label class="campo"><span class="etq">Acontecimiento</span><select class="entrada entrada--chica" data-evento-sel><option value="">Elige uno…</option>${eventos.map(x => `<option value="${e(x.id)}"${x.id === vivo.ctl.eventoId ? ' selected' : ''}>${e('S' + x.sesion + ' · ' + x.titulo)}${x.oculto ? ' (solo DM)' : ''}</option>`).join('')}</select></label>` : '<p class="suave consola__nota">La crónica aún no tiene acontecimientos.</p>')
      : modo === 'fichas' ? '<p class="suave consola__nota">Se proyectan en grande quienes estén en escena y visibles.</p>'
      : modo === 'portada' ? '<p class="suave consola__nota">Título, sinopsis y sesión actual: buena pantalla para empezar o hacer una pausa.</p>'
      : '<p class="suave consola__nota">Pantalla en negro. Elige otro modo para volver.</p>';
  }
  vivo.alCambiar(pintarVivo);
  $('[data-proyector]').innerHTML = F.icono('mesa') + 'Abrir proyector';

  /* ---------- Vistas ---------- */
  const VISTAS = [['escena', 'En escena'], ['escenas', 'Escenas y mapas'], ['presentaciones', 'Presentaciones']];
  const barra = (pg, max) => { const f = max ? limitar(pg / max, 0, 1) : 1; return `<span class="gp__barra" data-nivel="${f > .6 ? 'bien' : f > .25 ? 'medio' : 'mal'}"><i data-f="${Math.round(f * 100)}"></i></span>`; };

  function vistaEscena() {
    const dentro = mesa.enEscena.map(pj).filter(Boolean), cfg = mesa.grupoCfg;
    const pjs = dentro.filter(p => p.tipo === 'pj'), enemigos = dentro.filter(p => p.tipo === 'enemigo');
    let balance = '';
    if (TFF.encuentro && pjs.length && enemigos.length) {
      const r = TFF.encuentro.calcular(pjs, enemigos);
      balance = `<section class="balance balance--${e(r.etiqueta ? r.etiqueta.k : 'trivial')}">
        <div><small>Dificultad estimada</small><b class="gotica">${e(r.etiqueta ? r.etiqueta.label : '—')}</b><span>${e(r.aj)} PX ajustados · ${enemigos.length} ${enemigos.length === 1 ? 'enemigo' : 'enemigos'} contra ${pjs.length} PJ</span></div>
        <ul>${r.tips.slice(0, 4).map(t => `<li>${e(t)}</li>`).join('')}</ul></section>`;
    }
    return `
      <div class="herramientas">
        <button class="boton boton--primario boton--chico" type="button" data-abrir-anadir>${F.icono('mas')}Añadir a la escena</button>
        <button class="boton boton--secundario boton--chico" type="button" data-turno="sig"${dentro.length ? '' : ' disabled'}>${F.icono('proyectar')}Siguiente turno</button>
        ${mesa.turno ? `<button class="boton boton--fantasma boton--chico" type="button" data-turno="fin">Terminar turnos</button>` : ''}
        ${enemigos.length ? `<button class="boton boton--fantasma boton--chico empuja" type="button" data-sacar-enemigos>Sacar a los enemigos</button>` : ''}
      </div>
      <div class="tabla-cfg" role="group" aria-label="Qué muestra la tabla del proyector">
        <span class="etq">Tabla sobre el mapa</span>
        <select class="entrada entrada--chica" data-cfg="pos" aria-label="Posición de la tabla">${Object.entries({ derecha: 'A la derecha', izquierda: 'A la izquierda', abajo: 'Abajo', arriba: 'Arriba', oculto: 'No mostrar' }).map(([k, t]) => `<option value="${k}"${cfg.pos === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <label class="casilla"><input type="checkbox" data-cfg="pg"${cfg.pg !== false ? ' checked' : ''}> Vida</label>
        <label class="casilla"><input type="checkbox" data-cfg="ca"${cfg.ca !== false ? ' checked' : ''}> Clase de armadura</label>
        <select class="entrada entrada--chica" data-cfg="enemigos" aria-label="Vida de NPC y enemigos">${Object.entries({ estado: 'NPC y enemigos: solo estado', numero: 'NPC y enemigos: PG exactos' }).map(([k, t]) => `<option value="${k}"${cfg.enemigos === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      ${dentro.length ? `<div class="escena-grid">${dentro.map(p => {
        const oculto = mesa.ocultos.includes(p.id), pg = p.pg ?? p.pgMax ?? 0;
        return `<article class="ec ec--${e(p.tipo)}${mesa.turno === p.id ? ' is-turno' : ''}${oculto ? ' is-oculto' : ''}${p.pgMax && pg <= 0 ? ' is-caido' : ''}">
          <button class="ec__quien" type="button" data-ver-ficha="${e(p.id)}" title="Ver la ficha completa">
            ${F.ficha.retrato(p, 'ec__retrato')}
            <span><b>${e(p.nombre)}</b><small>${e([TIPO[p.tipo] || 'NPC', F.ficha.linea(p)].filter(Boolean).join(' · '))}</small></span>
          </button>
          <div class="ec__datos">
            ${p.ca !== undefined ? `<span class="ec__ca" title="Clase de armadura"><b>${e(p.ca)}</b><small>CA</small></span>` : ''}
            ${p.pgMax ? `<div class="ec__pg"><p><b>${e(pg)}</b><small>/ ${e(p.pgMax)} PG</small><em>${e(T.salud(pg, p.pgMax))}</em></p>${barra(pg, p.pgMax)}</div>` : '<p class="suave ec__sin">Sin estadísticas</p>'}
          </div>
          ${p.pgMax ? `<div class="ec__mas" role="group" aria-label="Cambiar PG de ${e(p.nombre)}">${[-5, -1, 1, 5].map(n => `<button type="button" data-pg="${e(p.id)}:${n}">${n > 0 ? '+' + n : '−' + Math.abs(n)}</button>`).join('')}</div>` : ''}
          <div class="ec__pie">
            <button class="chip-btn" type="button" data-ojo="${e(p.id)}" aria-pressed="${!oculto}" title="${oculto ? 'Mostrar en el proyector' : 'Ocultar del proyector'}">${F.icono(oculto ? 'ojoNo' : 'ojo')}${oculto ? 'Oculto' : 'Visible'}</button>
            <button class="chip-btn" type="button" data-turno-de="${e(p.id)}" aria-pressed="${mesa.turno === p.id}">${F.icono('dado')}Turno</button>
            <span class="ec__orden">
              <button class="herr herr--icono" type="button" data-orden="${e(p.id)}" title="Subir en el orden de turnos" aria-label="Subir en el orden">${F.icono('arriba')}</button>
              <button class="herr herr--icono" type="button" data-sale="${e(p.id)}" title="Sacar de la escena" aria-label="Sacar de la escena">${F.icono('cerrar')}</button>
            </span>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="vacio"><h2>Nadie en escena</h2><p>Añade a los personajes jugadores, a los NPC que aparecen y a los enemigos del combate.</p><div class="vacio__acciones"><button class="boton boton--primario" type="button" data-abrir-anadir>${F.icono('mas')}Añadir a la escena</button></div></div>`}
      ${balance}`;
  }

  function vistaEscenas() {
    return `
      <div class="herramientas"><p class="suave">Cada escena es un mapa con lo que pongas encima: imágenes, textos, puntos de interés, áreas y efectos.</p>
        <button class="boton boton--primario boton--chico empuja" type="button" data-nueva-escena>${F.icono('mas')}Nueva escena</button></div>
      <div class="escenas-grid">${mesa.escenas.map(x => {
        const activa = x.id === mesa.actual && vivo.ctl.modo === 'mapa', n = x.elementos.length;
        return `<article class="esc${activa ? ' is-activa' : ''}">
          <a class="esc__img" href="escena.html?id=${encodeURIComponent(id)}&escena=${encodeURIComponent(x.id)}" aria-label="Editar ${e(x.nombre)}">${x.fondo ? `<img src="${e(x.fondo)}" alt="" loading="lazy">` : `<span>${F.icono('mapa')}Sin mapa</span>`}${activa ? '<i class="esc__vivo">En el proyector</i>' : ''}</a>
          <div class="esc__txt"><b>${e(x.nombre)}</b><small>${n} ${n === 1 ? 'elemento' : 'elementos'}</small></div>
          <div class="esc__acc">
            <button class="boton boton--chico ${activa ? 'boton--secundario' : 'boton--primario'}" type="button" data-proyectar-escena="${e(x.id)}"${activa ? ' disabled' : ''}>${F.icono('proyectar')}${activa ? 'Proyectando' : 'Proyectar'}</button>
            <a class="boton boton--secundario boton--chico" href="escena.html?id=${encodeURIComponent(id)}&escena=${encodeURIComponent(x.id)}">${F.icono('editar')}Editar</a>
          </div>
        </article>`;
      }).join('')}</div>`;
  }

  function vistaPresentaciones() {
    return `
      <div class="herramientas"><p class="suave">La entrada de un jefe, un personaje o un lugar: imagen, título y descripción con ambiente animado sobre lo que haya en pantalla.</p>
        <button class="boton boton--primario boton--chico empuja" type="button" data-nueva-pres>${F.icono('mas')}Nueva presentación</button></div>
      ${mesa.presentaciones.length ? `<div class="escenas-grid">${mesa.presentaciones.map(p => {
        const activa = vivo.ctl.presentacion && vivo.ctl.presentacion.id === p.id;
        return `<article class="esc esc--pres${activa ? ' is-activa' : ''}">
          <div class="esc__img">${p.img ? `<img src="${e(p.img)}" alt="" loading="lazy">` : `<span>${F.icono('imagen')}Sin imagen</span>`}${activa ? '<i class="esc__vivo">En el proyector</i>' : ''}</div>
          <div class="esc__txt"><b>${e(p.titulo)}</b><small>${e(T.PLANTILLAS[p.plantilla] || '')} · ${e(T.AMBIENTES[p.ambiente] || 'Sin ambiente')}</small></div>
          <div class="esc__acc">
            <button class="boton boton--chico ${activa ? 'boton--secundario' : 'boton--primario'}" type="button" data-proyectar="${e(p.id)}">${F.icono(activa ? 'parar' : 'proyectar')}${activa ? 'Quitar' : 'Proyectar'}</button>
            <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-editar-pres="${e(p.id)}" aria-label="Editar" title="Editar">${F.icono('editar')}</button>
            <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-borrar-pres="${e(p.id)}" aria-label="Borrar" title="Borrar">${F.icono('borrar')}</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="vacio"><h2>Sin presentaciones todavía</h2><p>Prepara la aparición del jefe de la sesión y lánzala con un clic cuando llegue el momento.</p></div>`}`;
  }

  const cajaVista = $('[data-vista]');
  function pintarVista() {
    $('[data-vistas]').innerHTML = VISTAS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === vista}" data-vista-ir="${k}">${t}${k === 'escena' ? `<i>${mesa.enEscena.length}</i>` : ''}</button>`).join('');
    cajaVista.innerHTML = ({ escena: vistaEscena, escenas: vistaEscenas, presentaciones: vistaPresentaciones })[vista]();
    cajaVista.querySelectorAll('[data-f]').forEach(i => { i.style.width = i.dataset.f + '%'; });
    const dl = $('#dl-quien'); if (dl) dl.innerHTML = mesa.enEscena.map(pj).filter(Boolean).map(p => `<option value="${e(p.nombre)}">`).join('');
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t || t.closest('dialog')) return;
    const ds = t.dataset;
    if (ds.modo) { vivo.poner({ modo: ds.modo }); pintarVista(); }
    else if ('proyector' in ds) vivo.abrirProyector();
    else if (ds.vistaIr) { vista = ds.vistaIr; const u = new URL(location.href); u.searchParams.set('ver', vista); history.replaceState(null, '', u); pintarVista(); F.entrar(cajaVista.querySelectorAll('.ec, .esc'), { y: 10, stagger: .02 }); }
    else if ('abrirAnadir' in ds) abrirAnadir();
    else if (ds.pg) { const [idp, n] = ds.pg.split(':'), p = pj(idp); if (p) cambio(() => { p.pg = limitar((p.pg ?? p.pgMax) + Number(n), 0, p.pgMax || 999); }); }
    else if (ds.ojo) cambio(() => { mesa.ocultos = mesa.ocultos.includes(ds.ojo) ? mesa.ocultos.filter(x => x !== ds.ojo) : [...mesa.ocultos, ds.ojo]; });
    else if (ds.turnoDe) cambio(() => { mesa.turno = mesa.turno === ds.turnoDe ? '' : ds.turnoDe; });
    else if (ds.turno) cambio(() => { const orden = mesa.enEscena.filter(pj); mesa.turno = ds.turno === 'fin' || !orden.length ? '' : orden[(orden.indexOf(mesa.turno) + 1) % orden.length]; });
    else if (ds.orden) cambio(() => { const i = mesa.enEscena.indexOf(ds.orden); if (i > 0) { mesa.enEscena.splice(i, 1); mesa.enEscena.splice(i - 1, 0, ds.orden); } });
    else if (ds.sale) cambio(() => sacar([ds.sale]));
    else if ('sacarEnemigos' in ds) cambio(() => sacar(mesa.enEscena.filter(x => (pj(x) || {}).tipo === 'enemigo')));
    else if (ds.verFicha) { const p = pj(ds.verFicha); if (p) { dlgFicha.querySelector('[data-cuerpo]').innerHTML = F.ficha.completa(p); dlgFicha.showModal(); } }
    else if (ds.proyectarEscena) { mesa.actual = ds.proyectarEscena; vivo.poner({ modo: 'mapa' }); pintarVista(); programar(); }
    else if ('nuevaEscena' in ds) { const x = F.vivo.escenaNueva('Escena ' + (mesa.escenas.length + 1)); mesa.escenas.push(x); sucio = true; guardar().then(() => { location.href = `escena.html?id=${encodeURIComponent(id)}&escena=${encodeURIComponent(x.id)}`; }); }
    else if (ds.proyectar) { const p = mesa.presentaciones.find(x => x.id === ds.proyectar), act = vivo.ctl.presentacion; vivo.poner({ presentacion: act && act.id === ds.proyectar ? null : p ? { ...p, k: Date.now() } : null }); pintarVista(); }
    else if (ds.editarPres) abrirPres(mesa.presentaciones.find(x => x.id === ds.editarPres));
    else if ('nuevaPres' in ds) abrirPres(null);
    else if (ds.borrarPres) {
      const p = mesa.presentaciones.find(x => x.id === ds.borrarPres);
      if (!p || !confirm(`¿Borrar la presentación «${p.titulo}»?`)) return;
      if (vivo.ctl.presentacion && vivo.ctl.presentacion.id === p.id) vivo.poner({ presentacion: null });
      cambio(() => { mesa.presentaciones = mesa.presentaciones.filter(x => x !== p); });
    }
  });
  const sacar = ids => { mesa.enEscena = mesa.enEscena.filter(x => !ids.includes(x)); mesa.ocultos = mesa.ocultos.filter(x => !ids.includes(x)); if (ids.includes(mesa.turno)) mesa.turno = ''; };
  document.addEventListener('change', ev => {
    const t = ev.target, ds = t.dataset;
    if (ds.cfg) cambio(() => { mesa.grupoCfg[ds.cfg] = t.type === 'checkbox' ? t.checked : t.value; });
    else if ('escenaSel' in ds) { mesa.actual = t.value; vivo.emitir(); pintarVista(); programar(); }
    else if ('eventoSel' in ds) vivo.poner({ eventoId: t.value });
  });

  /* Aviso a la mesa */
  const formAviso = $('[data-aviso]');
  formAviso.quien.addEventListener('input', () => {
    const p = datos.personajes.find(x => x.nombre === formAviso.quien.value);
    $('#dl-que').innerHTML = (p ? [...(p.ataques || []).map(a => a.n), ...((p.conj || {}).trucos || []), ...((p.conj || {}).lista || [])] : []).map(c => `<option value="${e(c)}">`).join('');
  });
  formAviso.addEventListener('submit', ev => {
    ev.preventDefault();
    const quien = formAviso.quien.value.trim(), que = formAviso.que.value.trim();
    if (!quien && !que) return F.toast('Escribe quién actúa o qué hace.');
    const p = datos.personajes.find(x => x.nombre === quien);
    vivo.avisar({ quien, que, nota: formAviso.nota.value.trim(), res: (ev.submitter && ev.submitter.value) || 'neutro', img: (p && p.img) || '' });
    formAviso.que.value = ''; formAviso.nota.value = ''; formAviso.que.focus();
  });

  /* ---------- Añadir a la escena ---------- */
  const dlgFicha = F.dialogo($('#ver-ficha'));
  const dlgAn = F.dialogo($('#anadir-dlg'));
  const filtroAn = { tipo: 'todos', q: '' };
  function pintarAnadir() {
    const q = filtroAn.q.trim().toLowerCase();
    const lista = datos.personajes.filter(p => (filtroAn.tipo === 'todos' || p.tipo === filtroAn.tipo) && (!q || (p.nombre || '').toLowerCase().includes(q) || (p.rol || '').toLowerCase().includes(q)));
    dlgAn.querySelector('[data-an-tipos]').innerHTML = [['todos', 'Todos'], ['pj', 'PJ'], ['npc', 'NPC'], ['enemigo', 'Enemigos']].map(([k, t]) => `<button type="button" aria-pressed="${k === filtroAn.tipo}" data-an-tipo="${k}">${t}</button>`).join('');
    dlgAn.querySelector('[data-an-lista]').innerHTML = lista.map(p => {
      const dentro = mesa.enEscena.includes(p.id);
      return `<button type="button" class="an-fila${dentro ? ' is-dentro' : ''}" data-an-pj="${e(p.id)}" aria-pressed="${dentro}">${F.ficha.retrato(p, 'pj-mini__retrato')}<span><b>${e(p.nombre)}</b><small>${e([TIPO[p.tipo] || 'NPC', F.ficha.linea(p) || p.rol].filter(Boolean).join(' · '))}</small></span><i>${dentro ? 'En escena' : 'Añadir'}</i></button>`;
    }).join('') || `<p class="suave">${datos.personajes.length ? 'Nadie coincide.' : 'La campaña aún no tiene personajes.'}</p>`;
  }
  function abrirAnadir() {
    filtroAn.q = ''; dlgAn.querySelector('[data-an-buscar]').value = '';
    const grupos = {};
    (TFF.bestiario || []).forEach(b => { (grupos[b.grupo || 'Criaturas'] = grupos[b.grupo || 'Criaturas'] || []).push(b); });
    dlgAn.querySelector('[data-an-criatura]').innerHTML = Object.entries(grupos).map(([g, l]) => `<optgroup label="${e(g)}">${l.map(b => `<option value="${e(b.clave)}">${e(b.nombre)} · VD ${e(b.vd)}</option>`).join('')}</optgroup>`).join('');
    pintarAnadir(); dlgAn.showModal();
  }
  dlgAn.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.anTipo) { filtroAn.tipo = t.dataset.anTipo; pintarAnadir(); }
    else if (t.dataset.anPj) { const idp = t.dataset.anPj; cambio(() => { if (mesa.enEscena.includes(idp)) sacar([idp]); else mesa.enEscena.push(idp); }); pintarAnadir(); }
    else if ('anBestia' in t.dataset) {
      const b = (TFF.bestiario || []).find(x => x.clave === dlgAn.querySelector('[data-an-criatura]').value); if (!b) return;
      const n = limitar(parseInt(dlgAn.querySelector('[data-an-cuantos]').value, 10) || 1, 1, 12);
      const ya = datos.personajes.filter(p => p.base === b.clave).length;
      cambio(() => { for (let i = 1; i <= n; i++) { const f = TFF.npc.desdeBestiario(b, n > 1 || ya ? ya + i : 0); datos.personajes.push(f); mesa.enEscena.push(f.id); } });
      pintarAnadir(); F.toast(`${n} × ${b.nombre} en escena`);
    }
  });
  dlgAn.querySelector('[data-an-buscar]').addEventListener('input', ev => { filtroAn.q = ev.target.value; pintarAnadir(); });

  /* ---------- Presentaciones ---------- */
  const dlgPres = F.dialogo($('#present-dlg')), formPres = dlgPres.querySelector('form');
  let presEdit = null, presImg = '', presPlantilla = 'jefe';
  const opciones = (obj, valor) => Object.entries(obj).map(([k, t]) => `<option value="${e(k)}"${k === valor ? ' selected' : ''}>${e(t)}</option>`).join('');
  formPres.ambiente.innerHTML = opciones(T.AMBIENTES, 'llamas');
  const pintarPlantillas = () => { dlgPres.querySelector('[data-plantillas]').innerHTML = Object.entries(T.PLANTILLAS).map(([k, t]) => `<button type="button" aria-pressed="${k === presPlantilla}" data-plantilla="${k}">${t}</button>`).join(''); };
  const pintarPresImg = () => { dlgPres.querySelector('[data-pd-img]').innerHTML = presImg ? `<img src="${e(presImg)}" alt="">` : F.icono('imagen'); };
  function abrirPres(p) {
    presEdit = p; presImg = (p && p.img) || ''; presPlantilla = (p && p.plantilla) || 'jefe';
    formPres.reset();
    formPres.desde.innerHTML = '<option value="">—</option>' + datos.personajes.map(x => `<option value="${e(x.id)}">${e(x.nombre)} · ${TIPO[x.tipo] || 'NPC'}</option>`).join('');
    formPres.titulo.value = (p && p.titulo) || ''; formPres.sub.value = (p && p.sub) || ''; formPres.texto.value = (p && p.texto) || '';
    formPres.ambiente.value = (p && p.ambiente) || 'llamas'; formPres.color.value = (p && p.color) || 'fuego';
    dlgPres.querySelector('.aviso').textContent = '';
    pintarPlantillas(); pintarPresImg(); dlgPres.showModal();
  }
  dlgPres.addEventListener('click', ev => { const b = ev.target.closest('[data-plantilla]'); if (b) { presPlantilla = b.dataset.plantilla; pintarPlantillas(); } });
  formPres.desde.addEventListener('change', () => {
    const p = pj(formPres.desde.value); if (!p) return;
    formPres.titulo.value = p.nombre || '';
    formPres.sub.value = p.rol || [TIPO[p.tipo], F.ficha.linea(p)].filter(Boolean).join(' · ');
    formPres.texto.value = (p.pers && (p.pers.gancho || p.pers.rasgo)) || formPres.texto.value;
    if (p.img) { presImg = p.img; pintarPresImg(); }
    if (p.tipo !== 'enemigo') { presPlantilla = 'npc'; formPres.ambiente.value = 'arcano'; formPres.color.value = 'verde'; pintarPlantillas(); }
  });
  dlgPres.querySelector('#pd-img').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { presImg = (await F.subirImagen(id, f, presPlantilla === 'lugar' ? 2200 : 1400, presPlantilla === 'lugar' ? 'image/jpeg' : 'image/webp')).url; pintarPresImg(); }
    catch (err) { dlgPres.querySelector('.aviso').textContent = 'No se pudo subir la imagen: ' + err.message; }
  });
  formPres.addEventListener('submit', ev => {
    ev.preventDefault();
    const titulo = formPres.titulo.value.trim();
    if (!titulo) { dlgPres.querySelector('.aviso').textContent = 'Ponle un título.'; return; }
    const d = { plantilla: presPlantilla, img: presImg, titulo, sub: formPres.sub.value.trim(), texto: formPres.texto.value.trim(), ambiente: formPres.ambiente.value, color: formPres.color.value };
    dlgPres.close(); vista = 'presentaciones';
    cambio(() => { if (presEdit) Object.assign(presEdit, d); else mesa.presentaciones.push({ id: uid('pre'), ...d }); });
  });

  pintarVista();
  vivo.emitir();
  marca('');
  F.entrar('.consola__vivo > *, .ec, .esc', { y: 12, stagger: .03 });
})();
