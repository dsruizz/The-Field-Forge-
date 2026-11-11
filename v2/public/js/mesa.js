/* Mesa y proyección: la consola del DM. A la izquierda, lo que ve la mesa (vista previa, accesos rápidos,
   proyector y notas rápidas). A la derecha: Crónica, Mapas, Escena, Presentaciones y Forja de utilidades.
   El editor de mapas y el móvil de cada jugador se abren en ventanas internas, sin salir de aquí. */
(async () => {
  const F = window.Forja, e = F.esc, T = F.tablero, TFF = window.TFF || {};
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);
  const params = new URLSearchParams(location.search), id = params.get('id') || '';
  const $ = s => document.querySelector(s);
  const uid = F.vivo.uid;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const rutaCamp = 'campanas/' + encodeURIComponent(id);

  let datos, rev, resumen;
  try {
    const [a, b] = await Promise.all([F.api(rutaCamp), F.api(rutaCamp + '/datos')]);
    if (b.rol !== 'dm') { location.replace('campana.html?id=' + encodeURIComponent(id)); return; }
    resumen = a.campana; datos = b.datos; rev = b.rev;
  } catch { location.replace('campanas.html'); return; }
  document.title = 'Mesa · ' + resumen.nombre;
  $('[data-miga]').href = 'campana.html?id=' + encodeURIComponent(id);
  $('[data-miga]').innerHTML = F.icono('atras') + e(resumen.nombre);

  let mesa = F.vivo.preparar(datos);
  const vivo = F.vivo.crear({ id, datos: () => datos, resumen });
  const tab = T.montar($('[data-tablero]'));
  const pj = idp => datos.personajes.find(p => p.id === idp);
  const TIPO = { pj: 'PJ', npc: 'NPC', enemigo: 'Enemigo' };
  const VISTAS = [['cronica', 'Crónica', 'texto'], ['mapas', 'Mapas', 'mapa'], ['escena', 'Escena', 'grupo'], ['presentaciones', 'Presentaciones', 'telon'], ['forja', 'Forja de utilidades', 'forja']];
  let vista = { escenas: 'mapas' }[params.get('ver')] || (VISTAS.some(([k]) => k === params.get('ver')) ? params.get('ver') : 'escena');

  /* ---------- Guardado ---------- */
  let reloj = 0, guardando = false, sucio = false, pausado = false;
  const marca = t => { $('[data-guardado]').textContent = t; };
  function programar() { sucio = true; marca('Guardando…'); clearTimeout(reloj); reloj = setTimeout(guardar, 600); }
  async function guardar() {
    clearTimeout(reloj);
    if (guardando || !sucio || pausado) return;
    guardando = true; sucio = false;
    try { const r = await F.api(rutaCamp + '/datos', { metodo: 'PUT', datos: { rev, datos } }); rev = r.rev; if (!sucio) marca('Guardado'); }
    catch (err) {
      marca('Sin guardar');
      F.toast(err.estado === 409 ? 'La campaña cambió en otra ventana. Recargando…' : 'No se pudo guardar: ' + err.message);
      if (err.estado === 409) return setTimeout(() => location.reload(), 1500);
      sucio = true;
    }
    guardando = false;
    if (sucio) programar();
  }
  const terminarGuardado = async () => { for (let i = 0; i < 100 && (sucio || guardando); i++) { if (!guardando) await guardar(); else await new Promise(r => setTimeout(r, 80)); } };
  addEventListener('pagehide', () => { if (sucio) guardar(); });
  const cambio = fn => { fn(); pintarVista(); vivo.emitir(); programar(); };

  // La vida de un PJ va por la vía corta: llega al móvil del jugador al instante, sin esperar al guardado.
  let colaPg = Promise.resolve();
  function enviarPg(p) {
    const valor = p.pg;
    colaPg = colaPg.then(() => F.api(rutaCamp + '/jugador', { metodo: 'POST', datos: { accion: 'pg', pj: p.id, valor } }).catch(err => F.toast('No se pudo enviar la vida: ' + err.message)));
  }

  /* ---------- Vista previa y accesos rápidos ---------- */
  const ICONO_MODO = { portada: 'libro', cronica: 'texto', mapa: 'mapa', fichas: 'grupo', negro: 'telon' };
  function pintarVivo(s) {
    tab.estado(s);
    const modo = vivo.ctl.negro ? 'negro' : vivo.ctl.modo, esc = mesa.escenas.find(x => x.id === mesa.actual) || mesa.escenas[0];
    $('[data-modos]').innerHTML = Object.entries(vivo.MODOS).map(([k, t]) => `<button type="button" aria-pressed="${k === modo}" data-modo="${k}">${F.icono(ICONO_MODO[k])}<span>${t}</span></button>`).join('');
    const ev = datos.cronica.find(x => x.id === vivo.ctl.eventoId);
    $('[data-modo-extra]').innerHTML =
      modo === 'mapa' ? `<label class="campo"><span class="etq">Mapa en el proyector</span><select class="entrada entrada--chica" data-escena-sel>${mesa.escenas.map(x => `<option value="${e(x.id)}"${x.id === mesa.actual ? ' selected' : ''}>${e(x.nombre)}</option>`).join('')}</select></label>
        <button class="boton boton--secundario boton--chico" type="button" data-editar-escena="${e(esc.id)}">${F.icono('editar')}Editar este mapa</button>`
      : modo === 'cronica' ? `<p class="suave consola__nota">${ev ? `Proyectando: <b>${e(ev.titulo)}</b>.` : 'Aún no has elegido un acontecimiento.'} Se elige desde la pestaña Crónica.</p>${vista !== 'cronica' ? `<button class="boton boton--secundario boton--chico" type="button" data-vista-ir="cronica">${F.icono('texto')}Ir a la crónica</button>` : ''}`
      : modo === 'fichas' ? '<p class="suave consola__nota">Se proyectan en grande quienes estén en escena y visibles.</p>'
      : modo === 'portada' ? '<p class="suave consola__nota">Título, sinopsis y sesión actual: buena pantalla para empezar o hacer una pausa.</p>'
      : '<p class="suave consola__nota">Telón bajado: la pantalla queda en negro. Elige otro modo para subirlo.</p>';
    if (vista === 'cronica' && !document.querySelector('dialog[open]')) cronica.pintar();
  }
  vivo.alCambiar(pintarVivo);
  const pintarBotonProy = abierto => { const b = $('[data-proyector]'); b.innerHTML = F.icono(abierto ? 'cerrar' : 'mesa') + (abierto ? 'Cerrar proyector' : 'Abrir proyector'); b.classList.toggle('is-abierto', abierto); };
  vivo.alProyector(pintarBotonProy);
  pintarBotonProy(false);

  /* Notas rápidas: solo para esta sesión del navegador, nunca se guardan en la campaña. */
  const notas = $('[data-notas-dm]'), CLAVE_NOTAS = 'forja.notas.' + id;
  try { notas.value = sessionStorage.getItem(CLAVE_NOTAS) || ''; } catch { /* sin almacenamiento */ }
  notas.addEventListener('input', () => { try { sessionStorage.setItem(CLAVE_NOTAS, notas.value); } catch { /* sin almacenamiento */ } });
  $('[data-notas-borrar]').addEventListener('click', () => { if (!notas.value || confirm('¿Borrar las notas rápidas?')) { notas.value = ''; try { sessionStorage.removeItem(CLAVE_NOTAS); } catch { /* nada */ } notas.focus(); } });

  /* ---------- Crónica ---------- */
  const dlgFicha = F.dialogo($('#ver-ficha'));
  const verFicha = idp => {
    const p = pj(idp); if (!p) return;
    dlgFicha.querySelector('[data-cuerpo]').innerHTML = F.ficha.completa(p);
    dlgFicha.querySelector('[data-pie]').innerHTML = `<button class="boton boton--primario boton--chico" type="button" data-editar-pj="${e(p.id)}">${F.icono('editar')}Editar</button>`;
    if (!dlgFicha.open) dlgFicha.showModal();
  };
  dlgFicha.addEventListener('click', ev => { const b = ev.target.closest('[data-editar-pj]'); if (b) { dlgFicha.close(); abrirEdicion(b.dataset.editarPj); } });
  const cajaCronica = $('[data-vista-cronica]');
  const cronica = F.cronica.montar({
    caja: cajaCronica, datos: () => datos, id, vivo, verFicha,
    guardar: (fn, mensaje) => { fn(datos); cronica.pintar(); vivo.emitir(); programar(); if (mensaje) F.toast(mensaje); }
  });

  /* ---------- Escena ---------- */
  const barra = (pg, max) => { const f = max ? limitar(pg / max, 0, 1) : 1; return `<span class="gp__barra" data-nivel="${f > .6 ? 'bien' : f > .25 ? 'medio' : 'mal'}"><i data-f="${Math.round(f * 100)}"></i></span>`; };
  const NOMBRE_ATR = { fue: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR', ca: 'CA' };
  function tarjeta(p) {
    const oculto = mesa.ocultos.includes(p.id), pg = p.pg ?? p.pgMax ?? 0, n = mesa.enEscena.indexOf(p.id) + 1;
    const muerto = F.muerto(pg, p.pgMax), caBono = (p.efectos || []).filter(x => x.atr === 'ca').reduce((t, x) => t + x.valor, 0);
    return `<article class="ec ec--${e(p.tipo)}${mesa.turno === p.id ? ' is-turno' : ''}${oculto ? ' is-oculto' : ''}${p.pgMax && pg <= 0 ? ' is-caido' : ''}${muerto ? ' is-muerto' : ''}">
      <button class="ec__quien" type="button" data-ver-ficha="${e(p.id)}" title="Ver la ficha completa">
        <span class="ec__marco">${F.ficha.retrato(p, 'ec__retrato')}<span class="ec__orden-n" title="Orden de turno">${n}</span></span>
        <span><b>${e(p.nombre)}</b><small>${e([TIPO[p.tipo] || 'NPC', F.ficha.linea(p)].filter(Boolean).join(' · '))}</small></span>
      </button>
      <div class="ec__datos">
        ${p.ca !== undefined ? `<span class="ec__ca${caBono ? ' is-bono' : ''}" title="Clase de armadura"><b>${e(Number(p.ca) + caBono)}</b><small>CA</small></span>` : ''}
        ${p.pgMax ? `<div class="ec__pg"><p><b>${e(pg)}</b><small>/ ${e(p.pgMax)} PG</small><em>${e(F.salud(pg, p.pgMax))}</em></p>${barra(pg, p.pgMax)}</div>` : '<p class="suave ec__sin">Sin estadísticas</p>'}
      </div>
      ${(p.efectos || []).length ? `<div class="ec__efectos">${p.efectos.map(x => `<span>${e(x.n)} · ${e(NOMBRE_ATR[x.atr] || x.atr)} ${x.valor >= 0 ? '+' : ''}${e(x.valor)} · ${e(x.turnos)} t</span>`).join('')}</div>` : ''}
      ${p.pgMax ? `<div class="ec__mas" role="group" aria-label="Cambiar PG de ${e(p.nombre)}">${[-5, -1, 1, 5].map(k => `<button type="button" data-pg="${e(p.id)}:${k}">${k > 0 ? '+' + k : '−' + Math.abs(k)}</button>`).join('')}</div>` : ''}
      <div class="ec__pie">
        <button class="chip-btn" type="button" data-ojo="${e(p.id)}" aria-pressed="${!oculto}" title="${oculto ? 'Mostrar en el proyector' : 'Ocultar del proyector'}">${F.icono(oculto ? 'ojoNo' : 'ojo')}${oculto ? 'Oculto' : 'Visible'}</button>
        <button class="chip-btn" type="button" data-turno-de="${e(p.id)}" aria-pressed="${mesa.turno === p.id}">${F.icono('dado')}${mesa.turno === p.id ? 'En turno' : 'Turno'}</button>
        <span class="ec__orden">
          <button class="herr herr--icono" type="button" data-editar-pj="${e(p.id)}" title="Editar" aria-label="Editar a ${e(p.nombre)}">${F.icono('editar')}</button>
          ${p.tipo === 'pj' ? `<button class="herr herr--icono" type="button" data-movil="${e(p.id)}" title="Ver su móvil" aria-label="Ver el móvil de ${e(p.nombre)}">${F.icono('movil')}</button>` : ''}
          <button class="herr herr--icono" type="button" data-orden="${e(p.id)}:-1" title="Subir en el orden de turnos" aria-label="Subir en el orden"${n > 1 ? '' : ' disabled'}>${F.icono('arriba')}</button>
          <button class="herr herr--icono" type="button" data-orden="${e(p.id)}:1" title="Bajar en el orden de turnos" aria-label="Bajar en el orden"${n < mesa.enEscena.length ? '' : ' disabled'}>${F.icono('abajo')}</button>
          <button class="herr herr--icono" type="button" data-sale="${e(p.id)}" title="Sacar de la escena" aria-label="Sacar de la escena">${F.icono('cerrar')}</button>
        </span>
      </div>
    </article>`;
  }
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
    const grupos = [['pj', 'Personajes jugadores'], ['npc', 'NPC'], ['enemigo', 'Enemigos']].map(([t, n]) => [n, dentro.filter(p => (TIPO[p.tipo] ? p.tipo : 'npc') === t)]).filter(([, l]) => l.length);
    return `
      <div class="herramientas">
        <button class="boton boton--primario boton--chico" type="button" data-abrir-anadir>${F.icono('mas')}Añadir a la escena</button>
        <div class="turnos" role="group" aria-label="Turnos">
          <button class="boton boton--secundario boton--chico" type="button" data-turno="sig"${dentro.length ? '' : ' disabled'}>${F.icono('proyectar')}Siguiente turno</button>
          <button class="boton boton--secundario boton--chico" type="button" data-turno="fin"${mesa.turno ? '' : ' disabled'}>${F.icono('parar')}Terminar turnos</button>
        </div>
        ${enemigos.length ? `<button class="boton boton--fantasma boton--chico empuja" type="button" data-sacar-enemigos>Sacar a los enemigos</button>` : ''}
      </div>
      <div class="tabla-cfg" role="group" aria-label="Qué muestra la tabla del proyector">
        <span class="etq">Tabla sobre el mapa</span>
        <select class="entrada entrada--chica" data-cfg="pos" aria-label="Posición de la tabla">${Object.entries({ derecha: 'A la derecha', izquierda: 'A la izquierda', abajo: 'Abajo', arriba: 'Arriba', oculto: 'No mostrar' }).map(([k, t]) => `<option value="${k}"${cfg.pos === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <label class="casilla"><input type="checkbox" data-cfg="pg"${cfg.pg !== false ? ' checked' : ''}> Vida</label>
        <label class="casilla"><input type="checkbox" data-cfg="ca"${cfg.ca !== false ? ' checked' : ''}> Clase de armadura</label>
        <select class="entrada entrada--chica" data-cfg="enemigos" aria-label="Vida de NPC y enemigos">${Object.entries({ estado: 'NPC y enemigos: solo estado', numero: 'NPC y enemigos: PG exactos' }).map(([k, t]) => `<option value="${k}"${cfg.enemigos === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      ${dentro.length ? grupos.map(([n, l]) => `<section class="escena-grupo"><h2 class="separador"><span>${n}</span><i>${l.length}</i></h2><div class="escena-grid">${l.map(tarjeta).join('')}</div></section>`).join('')
        : `<div class="vacio"><h2>Nadie en escena</h2><p>Añade a los personajes jugadores, a los NPC que aparecen y a los enemigos del combate.</p><div class="vacio__acciones"><button class="boton boton--primario" type="button" data-abrir-anadir>${F.icono('mas')}Añadir a la escena</button></div></div>`}
      ${balance}`;
  }

  /* ---------- Mapas ---------- */
  function vistaMapas() {
    return `
      <p class="suave vista-intro">Cada mapa es una escena con lo que pongas encima: imágenes, textos, puntos de interés, áreas y efectos.</p>
      <div class="escenas-grid">
        <button class="esc esc--nueva" type="button" data-nueva-escena><span>${F.icono('mas')}</span><b>Crear nueva escena</b></button>
        ${mesa.escenas.map(x => {
          const activa = x.id === mesa.actual && vivo.ctl.modo === 'mapa' && !vivo.ctl.negro, n = x.elementos.length;
          return `<article class="esc${activa ? ' is-activa' : ''}">
            <button class="esc__img" type="button" data-editar-escena="${e(x.id)}" aria-label="Editar ${e(x.nombre)}">${x.fondo ? `<img src="${e(x.fondo)}" alt="" loading="lazy">` : `<span>${F.icono('mapa')}Sin mapa</span>`}${activa ? '<i class="esc__vivo">En el proyector</i>' : ''}</button>
            <div class="esc__txt"><b>${e(x.nombre)}</b><small>${n} ${n === 1 ? 'elemento' : 'elementos'}</small></div>
            <div class="esc__acc">
              <button class="boton boton--chico ${activa ? 'boton--secundario' : 'boton--primario'}" type="button" data-proyectar-escena="${e(x.id)}"${activa ? ' disabled' : ''}>${F.icono('proyectar')}${activa ? 'Proyectando' : 'Proyectar'}</button>
              <button class="boton boton--secundario boton--chico" type="button" data-editar-escena="${e(x.id)}">${F.icono('editar')}Editar</button>
            </div>
          </article>`;
        }).join('')}
      </div>`;
  }

  /* ---------- Presentaciones ---------- */
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

  /* ---------- Forja de utilidades ---------- */
  const TIPOS_OBJ = { pocion: 'Poción', comida: 'Comida y bebida', pergamino: 'Pergamino', arma: 'Arma', armadura: 'Armadura', escudo: 'Escudo', herramienta: 'Herramienta', tesoro: 'Tesoro', objeto: 'Otro' };
  const ATR_LARGO = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma', ca: 'CA' };
  const textoEfecto = ef => !ef ? 'Sin efecto: solo narrativo' : ef.clase === 'curar' ? `Cura ${ef.dados} PG` : `${ATR_LARGO[ef.clase === 'ca' ? 'ca' : ef.atr]} ${ef.dados ? '+' + ef.dados : (ef.valor >= 0 ? '+' : '') + ef.valor} durante ${ef.turnos} ${ef.turnos === 1 ? 'turno' : 'turnos'}`;
  // Lo básico para empezar: se puede editar o borrar.
  const BASICOS = () => [
    { n: 'Poción de curación', tipo: 'pocion', nota: 'Un líquido rojo que brilla al agitarlo.', efecto: { clase: 'curar', dados: '2d4+2' }, consumible: true, resto: 'Frasco vacío', precio: 50 },
    { n: 'Poción de curación mayor', tipo: 'pocion', nota: 'Más espesa y de un rojo casi negro.', efecto: { clase: 'curar', dados: '4d4+4' }, consumible: true, resto: 'Frasco vacío', precio: 150 },
    { n: 'Poción de fuerza', tipo: 'pocion', nota: 'Sabe a hierro y a tormenta.', efecto: { clase: 'atributo', atr: 'fue', valor: 2, turnos: 3 }, consumible: true, resto: 'Frasco vacío', precio: 100 },
    { n: 'Elixir de piel de roble', tipo: 'pocion', nota: 'La piel se vuelve dura y rugosa como la corteza.', efecto: { clase: 'ca', valor: 2, turnos: 10 }, consumible: true, resto: 'Frasco vacío', precio: 120 },
    { n: 'Cerveza', tipo: 'comida', nota: 'Espumosa y fresca. Suelta la lengua.', efecto: { clase: 'atributo', atr: 'car', valor: 1, turnos: 5 }, consumible: true, resto: 'Jarra vacía', precio: 1 },
    { n: 'Café de la jungla', tipo: 'comida', nota: 'Amargo y fuerte: nadie se duerme en la guardia.', efecto: { clase: 'atributo', atr: 'sab', valor: 1, turnos: 5 }, consumible: true, resto: '', precio: 1 },
    { n: 'Raciones', tipo: 'comida', nota: 'Comida seca para un día de viaje.', consumible: true, resto: '', precio: 1 },
    { n: 'Antorcha', tipo: 'herramienta', nota: 'Ilumina 6 m durante una hora.', precio: 1 },
    { n: 'Monedas de oro', tipo: 'tesoro', nota: '', precio: 1 }
  ].map(x => ({ id: uid('fo'), ...x }));
  let forjaNueva = false;
  if (!mesa.forja) { mesa.forja = BASICOS(); forjaNueva = true; }
  function vistaForja() {
    return `
      <p class="suave vista-intro">Objetos con un uso real: curan o suman a un atributo o a la CA durante unos turnos. Créalos aquí y dáselos a un jugador. Cuando lo use, te llega a la campanilla para aprobarlo; si lleva dados (2d4+2), el jugador escribe antes lo que sacó. Los turnos se descuentan cuando le llega su turno en Escena.</p>
      <div class="forja-grid">
        <button class="obj obj--nuevo" type="button" data-nuevo-obj><span>${F.icono('mas')}</span><b>Crear objeto</b></button>
        ${mesa.forja.map(o => `
          <article class="obj obj--${e(o.tipo)}">
            <div class="obj__cab"><span class="obj__ico">${F.icono(o.tipo)}</span><div><b>${e(o.n)}</b><small>${e(TIPOS_OBJ[o.tipo] || 'Objeto')}${o.precio ? ' · ' + e(o.precio) + ' po' : ''}</small></div></div>
            <p class="obj__ef${o.efecto ? '' : ' is-sin'}">${F.icono(o.efecto ? 'chispa' : 'libro')}<span>${e(textoEfecto(o.efecto))}</span></p>
            ${o.nota ? `<p class="obj__nota">${e(o.nota)}</p>` : ''}
            <div class="obj__acc">
              <button class="boton boton--primario boton--chico" type="button" data-dar-obj="${e(o.id)}">${F.icono('dar')}Dar a…</button>
              <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-editar-obj="${e(o.id)}" aria-label="Editar" title="Editar">${F.icono('editar')}</button>
              <button class="boton boton--fantasma boton--chico boton--icono" type="button" data-borrar-obj="${e(o.id)}" aria-label="Borrar" title="Borrar">${F.icono('borrar')}</button>
            </div>
          </article>`).join('')}
      </div>`;
  }

  /* ---------- Pintado de la pestaña ---------- */
  const cajaVista = $('[data-vista]');
  function pintarVista() {
    $('[data-vistas]').innerHTML = VISTAS.map(([k, t, ic]) => `<button type="button" role="tab" aria-selected="${k === vista}" data-vista-ir="${k}">${F.icono(ic)}<span>${t}</span></button>`).join('');
    const esCronica = vista === 'cronica';
    cajaVista.hidden = esCronica; cajaCronica.hidden = !esCronica;
    if (esCronica) { cronica.pintar(); return; }
    cajaVista.innerHTML = ({ escena: vistaEscena, mapas: vistaMapas, presentaciones: vistaPresentaciones, forja: vistaForja })[vista]();
    cajaVista.querySelectorAll('[data-f]').forEach(i => { i.style.width = i.dataset.f + '%'; });
  }
  function irA(v) {
    vista = v; const u = new URL(location.href); u.searchParams.set('ver', vista); history.replaceState(null, '', u);
    pintarVista(); pintarVivo(vivo.estado());
    F.entrar((vista === 'cronica' ? cajaCronica : cajaVista).querySelectorAll('.ec, .esc, .obj, .evento, .separador'), { y: 10, stagger: .02 });
  }

  /* ---------- Turnos: los efectos de la forja se gastan cuando le toca a quien los lleva ---------- */
  function pasarTurno(fin) {
    const orden = mesa.enEscena.filter(pj);
    mesa.turno = fin || !orden.length ? '' : orden[(orden.indexOf(mesa.turno) + 1) % orden.length];
    const p = pj(mesa.turno);
    if (p && (p.efectos || []).length) {
      p.efectos.forEach(x => { x.turnos -= 1; });
      const acaban = p.efectos.filter(x => x.turnos <= 0);
      p.efectos = p.efectos.filter(x => x.turnos > 0);
      if (acaban.length) F.toast(`${p.nombre}: se acaba ${acaban.map(x => x.n).join(', ')}`);
    }
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t || t.closest('dialog')) return;
    const ds = t.dataset;
    if (ds.modo) { vivo.poner(ds.modo === 'negro' ? { negro: true } : { modo: ds.modo, negro: false }); pintarVista(); }
    else if ('proyector' in ds) { if (vivo.proyectorAbierto()) vivo.cerrarProyector(); else vivo.abrirProyector(); }
    else if (ds.vistaIr) irA(ds.vistaIr);
    else if ('abrirAnadir' in ds) abrirAnadir();
    else if (ds.pg) {
      const [idp, k] = ds.pg.split(':'), p = pj(idp); if (!p) return;
      p.pg = limitar((p.pg ?? p.pgMax) + Number(k), -(p.pgMax || 999), p.pgMax || 999);
      if (p.tipo === 'pj') { enviarPg(p); pintarVista(); vivo.emitir(); }
      else cambio(() => {});
    }
    else if (ds.ojo) cambio(() => { mesa.ocultos = mesa.ocultos.includes(ds.ojo) ? mesa.ocultos.filter(x => x !== ds.ojo) : [...mesa.ocultos, ds.ojo]; });
    else if (ds.turnoDe) cambio(() => { mesa.turno = mesa.turno === ds.turnoDe ? '' : ds.turnoDe; });
    else if (ds.turno) cambio(() => pasarTurno(ds.turno === 'fin'));
    else if (ds.orden) cambio(() => {
      const [idp, k] = ds.orden.split(':'), i = mesa.enEscena.indexOf(idp), j = i + Number(k);
      if (i < 0 || j < 0 || j >= mesa.enEscena.length) return;
      mesa.enEscena.splice(i, 1); mesa.enEscena.splice(j, 0, idp);
    });
    else if (ds.sale) cambio(() => sacar([ds.sale]));
    else if ('sacarEnemigos' in ds) cambio(() => sacar(mesa.enEscena.filter(x => (pj(x) || {}).tipo === 'enemigo')));
    else if (ds.verFicha) verFicha(ds.verFicha);
    else if (ds.editarPj) abrirEdicion(ds.editarPj);
    else if (ds.movil) abrirMovil(ds.movil);
    else if (ds.proyectarEscena) { mesa.actual = ds.proyectarEscena; vivo.poner({ modo: 'mapa', negro: false }); pintarVista(); programar(); }
    else if (ds.editarEscena) abrirEditor(ds.editarEscena);
    else if ('nuevaEscena' in ds) { const x = F.vivo.escenaNueva('Escena ' + (mesa.escenas.length + 1)); mesa.escenas.push(x); sucio = true; abrirEditor(x.id); }
    else if (ds.proyectar) { const p = mesa.presentaciones.find(x => x.id === ds.proyectar), act = vivo.ctl.presentacion; vivo.poner({ presentacion: act && act.id === ds.proyectar ? null : p ? { ...p, k: Date.now() } : null }); pintarVista(); }
    else if (ds.editarPres) abrirPres(mesa.presentaciones.find(x => x.id === ds.editarPres));
    else if ('nuevaPres' in ds) abrirPres(null);
    else if (ds.borrarPres) {
      const p = mesa.presentaciones.find(x => x.id === ds.borrarPres);
      if (!p || !confirm(`¿Borrar la presentación «${p.titulo}»?`)) return;
      if (vivo.ctl.presentacion && vivo.ctl.presentacion.id === p.id) vivo.poner({ presentacion: null });
      cambio(() => { mesa.presentaciones = mesa.presentaciones.filter(x => x !== p); });
    }
    else if ('nuevoObj' in ds) abrirObjeto(null);
    else if (ds.editarObj) abrirObjeto(mesa.forja.find(x => x.id === ds.editarObj));
    else if (ds.borrarObj) { const o = mesa.forja.find(x => x.id === ds.borrarObj); if (o && confirm(`¿Borrar «${o.n}» de la forja? Los que ya tengan los jugadores se quedan en su mochila.`)) cambio(() => { mesa.forja = mesa.forja.filter(x => x !== o); }); }
    else if (ds.darObj) abrirDar(mesa.forja.find(x => x.id === ds.darObj));
  });
  const sacar = ids => { mesa.enEscena = mesa.enEscena.filter(x => !ids.includes(x)); mesa.ocultos = mesa.ocultos.filter(x => !ids.includes(x)); if (ids.includes(mesa.turno)) mesa.turno = ''; };
  document.addEventListener('change', ev => {
    const t = ev.target, ds = t.dataset;
    if (t.closest('dialog')) return;
    if (ds.cfg) cambio(() => { mesa.grupoCfg[ds.cfg] = t.type === 'checkbox' ? t.checked : t.value; });
    else if ('escenaSel' in ds) { mesa.actual = t.value; vivo.emitir(); pintarVista(); programar(); }
  });

  /* ---------- Ventanas internas: el móvil de un jugador y el editor de mapas ---------- */
  const dlgMovil = F.dialogo($('#movil-dlg')), dlgEditor = $('#editor-dlg');
  function abrirMovil(idp) {
    const p = pj(idp); if (!p) return;
    dlgMovil.querySelector('[data-ventana-tit]').innerHTML = `${F.icono('movil')}<span>El móvil de ${e(p.nombre)}</span>`;
    dlgMovil.querySelector('iframe').src = `jugador.html?id=${encodeURIComponent(id)}&pj=${encodeURIComponent(idp)}&embed=1`;
    dlgMovil.showModal();
  }
  dlgMovil.addEventListener('close', () => { dlgMovil.querySelector('iframe').src = 'about:blank'; });
  async function abrirEditor(idEsc) {
    // El editor guarda por su cuenta: antes se termina lo pendiente aquí y mientras tanto la mesa no guarda.
    await terminarGuardado();
    pausado = true;
    dlgEditor.querySelector('iframe').src = `escena.html?id=${encodeURIComponent(id)}&escena=${encodeURIComponent(idEsc)}&embed=1`;
    dlgEditor.showModal();
  }
  async function cerrarEditor() {
    if (!dlgEditor.open) return;
    const marco = dlgEditor.querySelector('iframe');
    try { const w = marco.contentWindow; if (w && w.Forja && w.Forja.guardarYa) await w.Forja.guardarYa(); } catch { /* sigue */ }
    dlgEditor.close(); marco.src = 'about:blank';
    try { const b = await F.api(rutaCamp + '/datos'); datos = b.datos; rev = b.rev; mesa = F.vivo.preparar(datos); if (!mesa.forja) mesa.forja = BASICOS(); }
    catch (err) { F.toast('No se pudo recargar la campaña: ' + err.message); }
    pausado = false; sucio = false;
    pintarVista(); vivo.emitir();
  }
  dlgEditor.addEventListener('cancel', ev => { ev.preventDefault(); cerrarEditor(); });
  addEventListener('message', ev => { if (ev.origin === location.origin && ev.data === 'forja:cerrar-editor') cerrarEditor(); });

  /* ---------- Edición rápida: foto, nombre y números de quien está en escena ---------- */
  const dlgEd = F.dialogo($('#editar-pj')), formEd = dlgEd.querySelector('form');
  let editando = null, imgNueva;
  const pintarRetratoEd = (img, nombre) => { dlgEd.querySelector('[data-retrato]').innerHTML = img ? `<img src="${e(img)}" alt="">` : e((nombre || '?').charAt(0).toUpperCase()); };
  function abrirEdicion(idp) {
    const p = pj(idp); if (!p) return;
    editando = p; imgNueva = undefined; formEd.reset(); dlgEd.querySelector('.aviso').textContent = '';
    formEd.nombre.value = p.nombre || ''; formEd.tipo.value = TIPO[p.tipo] ? p.tipo : 'npc'; formEd.rol.value = p.rol || ''; formEd.notas.value = p.notas || '';
    formEd.nivel.value = p.nivel || ''; formEd.nivel.disabled = !p.gen;
    formEd.ca.value = p.ca ?? ''; formEd.pgMax.value = p.pgMax || '';
    pintarRetratoEd(p.img, p.nombre);
    dlgEd.showModal();
  }
  dlgEd.querySelector('#ep-img').addEventListener('change', async ev => {
    try { imgNueva = await F.reducirImagen(ev.target.files[0]); pintarRetratoEd(imgNueva, formEd.nombre.value); }
    catch (err) { dlgEd.querySelector('.aviso').textContent = err.message; }
  });
  dlgEd.querySelector('[data-quitar-img]').addEventListener('click', () => { imgNueva = ''; dlgEd.querySelector('#ep-img').value = ''; pintarRetratoEd('', formEd.nombre.value); });
  formEd.addEventListener('submit', ev => {
    ev.preventDefault();
    const nombre = formEd.nombre.value.trim();
    if (!nombre) { dlgEd.querySelector('.aviso').textContent = 'Escribe un nombre.'; return; }
    const p = editando;
    cambio(() => {
      Object.assign(p, { nombre, tipo: formEd.tipo.value, rol: formEd.rol.value.trim(), notas: formEd.notas.value });
      if (imgNueva !== undefined) p.img = imgNueva;
      const nivel = parseInt(formEd.nivel.value, 10);
      if (p.gen && nivel && nivel !== p.nivel && TFF.npc) { p.nivel = limitar(nivel, 1, 20); TFF.npc.recalcular(p); }
      const ca = parseInt(formEd.ca.value, 10), pgMax = parseInt(formEd.pgMax.value, 10);
      if (ca > 0) p.ca = limitar(ca, 1, 40);
      if (pgMax > 0 && pgMax !== p.pgMax) { const lleno = (p.pg ?? p.pgMax) >= (p.pgMax || 0); p.pgMax = limitar(pgMax, 1, 999); if (lleno || p.pg > p.pgMax) { p.pg = p.pgMax; if (p.tipo === 'pj') enviarPg(p); } }
    });
    dlgEd.close(); F.toast('Personaje guardado');
  });

  /* ---------- Añadir a la escena: de la campaña o forjado al momento ---------- */
  const dlgAn = F.dialogo($('#anadir-dlg'));
  const filtroAn = { tipo: 'todos', q: '' };
  const formFj = dlgAn.querySelector('[data-an-forjar]'), previa = dlgAn.querySelector('[data-an-previa]');
  let forjado = null;
  const R5 = TFF.reglas;
  if (R5) {
    formFj.raza.innerHTML = '<option value="">Al azar</option>' + R5.RAZAS.map(r => `<option value="${r.id}">${e(r.nombre)}</option>`).join('');
    formFj.clase.innerHTML = '<option value="">Al azar</option>' + R5.CLASES.map(c => `<option value="${c.id}">${e(c.nombre)}</option>`).join('');
    formFj.trasfondo.innerHTML = '<option value="">Al azar</option>' + R5.TRASFONDOS.map(t => `<option value="${t.id}">${e(t.nombre)}</option>`).join('');
    formFj.alineamiento.innerHTML = '<option value="azar">Al azar</option>' + R5.ALINEAMIENTOS.map(a => `<option>${e(a)}</option>`).join('');
  }
  function pintarAnadir() {
    const forjar = filtroAn.tipo === 'forjar';
    dlgAn.querySelector('[data-an-tipos]').innerHTML = [['todos', 'Todos'], ['pj', 'PJ'], ['npc', 'NPC'], ['enemigo', 'Enemigos'], ['forjar', 'Forjar']].map(([k, t]) => `<button type="button" aria-pressed="${k === filtroAn.tipo}" data-an-tipo="${k}"${k === 'forjar' ? ' class="seg-forjar"' : ''}>${k === 'forjar' ? F.icono('forja') : ''}${t}</button>`).join('');
    dlgAn.querySelector('[data-an-buscar]').hidden = forjar;
    dlgAn.querySelector('[data-an-lista]').hidden = forjar;
    formFj.hidden = !forjar || !!forjado; previa.hidden = !forjar || !forjado;
    dlgAn.querySelector('#an-titulo').textContent = forjar ? 'Forjar un personaje' : 'Añadir a la escena';
    if (forjar) return pintarPrevia();
    const q = filtroAn.q.trim().toLowerCase();
    const lista = datos.personajes.filter(p => (filtroAn.tipo === 'todos' || p.tipo === filtroAn.tipo) && (!q || (p.nombre || '').toLowerCase().includes(q) || (p.rol || '').toLowerCase().includes(q)));
    dlgAn.querySelector('[data-an-lista]').innerHTML = lista.map(p => {
      const dentro = mesa.enEscena.includes(p.id);
      return `<button type="button" class="an-fila${dentro ? ' is-dentro' : ''}" data-an-pj="${e(p.id)}" aria-pressed="${dentro}">${F.ficha.retrato(p, 'pj-mini__retrato')}<span><b>${e(p.nombre)}</b><small>${e([TIPO[p.tipo] || 'NPC', F.ficha.linea(p) || p.rol].filter(Boolean).join(' · '))}</small></span><i>${dentro ? 'En escena' : 'Añadir'}</i></button>`;
    }).join('') || `<p class="suave">${datos.personajes.length ? 'Nadie coincide.' : 'La campaña aún no tiene personajes. Prueba con «Forjar».'}</p>`;
  }
  function pintarPrevia() {
    if (!forjado) { previa.innerHTML = ''; return; }
    const f = forjado;
    previa.innerHTML = `
      <div class="previa-ed">
        <div class="retrato-carga">
          <div class="ficha__retrato" data-pv-retrato>${f.img ? `<img src="${e(f.img)}" alt="">` : e((f.nombre || '?').charAt(0))}</div>
          <div class="campo"><label for="pv-img">Foto <span class="suave">(opcional)</span></label><input class="entrada" id="pv-img" type="file" accept="image/*" data-pv-img></div>
        </div>
        <div class="fila">
          <div class="campo"><label for="pv-nombre">Nombre</label><input class="entrada" id="pv-nombre" data-pv="nombre" value="${e(f.nombre)}" maxlength="80"></div>
          <div class="campo"><label for="pv-tipo">Tipo</label><select class="entrada" id="pv-tipo" data-pv="tipo">${Object.entries(TIPO).map(([k, t]) => `<option value="${k}"${f.tipo === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="fila">
          <div class="campo"><label for="pv-nivel">Nivel</label><input class="entrada" id="pv-nivel" data-pv="nivel" type="number" min="1" max="20" value="${e(f.nivel)}"></div>
          <div class="campo"><label for="pv-ca">CA</label><input class="entrada" id="pv-ca" data-pv="ca" type="number" min="1" max="40" value="${e(f.ca)}"></div>
          <div class="campo"><label for="pv-pg">PG máximos</label><input class="entrada" id="pv-pg" data-pv="pgMax" type="number" min="1" max="999" value="${e(f.pgMax)}"></div>
        </div>
        <div class="campo"><label for="pv-rol">Rol en la historia</label><input class="entrada" id="pv-rol" data-pv="rol" value="${e(f.rol || '')}" maxlength="140"></div>
        <div class="campo"><label for="pv-notas">Notas del DM</label><textarea class="entrada" id="pv-notas" data-pv="notas" maxlength="4000">${e(f.notas || '')}</textarea></div>
      </div>
      <div class="previa-ficha">${F.ficha.completa(f)}</div>
      <div class="hoja__pie previa-pie">
        <button class="boton boton--fantasma empuja" type="button" data-fj-otra>Cambiar opciones</button>
        <button class="boton boton--secundario" type="button" data-fj-rehacer>${F.icono('dado')}Volver a forjar</button>
        <button class="boton boton--primario" type="button" data-fj-guardar>${F.icono('hecho')}Guardar y añadir a la escena</button>
      </div>`;
  }
  function forjar() {
    const o = Object.fromEntries(new FormData(formFj).entries());
    try {
      const f = TFF.npc.generar({ tipo: o.tipo, raza: o.raza || undefined, clase: o.clase || undefined, trasfondo: o.trasfondo || undefined, nivel: o.nivel, nombre: o.nombre, sexo: o.sexo, alineamiento: o.alineamiento, rol: o.rol });
      if (o.tipo !== 'pj') f.enc = false;
      forjado = f; pintarAnadir();
    } catch (err) { F.toast('No se pudo forjar: ' + err.message); }
  }
  formFj.addEventListener('submit', ev => { ev.preventDefault(); forjar(); });
  previa.addEventListener('change', async ev => {
    if ('pvImg' in ev.target.dataset && forjado) {
      try { forjado.img = await F.reducirImagen(ev.target.files[0]); previa.querySelector('[data-pv-retrato]').innerHTML = `<img src="${e(forjado.img)}" alt="">`; previa.querySelector('.previa-ficha').innerHTML = F.ficha.completa(forjado); }
      catch (err) { F.toast(err.message); }
      return;
    }
    const k = ev.target.dataset.pv; if (!k || !forjado) return;
    const v = ev.target.value;
    if (k === 'nivel') { const n = limitar(parseInt(v, 10) || 1, 1, 20); if (n !== forjado.nivel) { forjado.nivel = n; TFF.npc.recalcular(forjado); } }
    else if (k === 'ca' || k === 'pgMax') { const n = parseInt(v, 10); if (n > 0) { forjado[k] = n; if (k === 'pgMax') forjado.pg = n; } }
    else forjado[k] = k === 'nombre' ? v.trim() || forjado.nombre : v;
    // Solo se repinta la ficha: rehacer el formulario entero se comería el clic que provocó el cambio.
    previa.querySelector('.previa-ficha').innerHTML = F.ficha.completa(forjado);
    if (k === 'nivel') ['ca', 'pgMax'].forEach(c => { previa.querySelector(`[data-pv="${c}"]`).value = forjado[c]; });
  });
  function abrirAnadir() {
    filtroAn.q = ''; dlgAn.querySelector('[data-an-buscar]').value = ''; forjado = null;
    pintarAnadir(); dlgAn.showModal();
  }
  dlgAn.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.anTipo) { filtroAn.tipo = t.dataset.anTipo; pintarAnadir(); }
    else if (t.dataset.anPj) { const idp = t.dataset.anPj; cambio(() => { if (mesa.enEscena.includes(idp)) sacar([idp]); else mesa.enEscena.push(idp); }); pintarAnadir(); }
    else if ('fjRehacer' in t.dataset) forjar();
    else if ('fjOtra' in t.dataset) { forjado = null; pintarAnadir(); }
    else if ('fjGuardar' in t.dataset) {
      const f = forjado; if (!f) return;
      cambio(() => { datos.personajes.push(f); mesa.enEscena.push(f.id); });
      F.toast(`${f.nombre} se une a la campaña y entra en escena`);
      forjado = null; formFj.reset(); filtroAn.tipo = 'todos'; dlgAn.close();
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

  /* ---------- Forja: crear y dar objetos ---------- */
  const dlgObj = F.dialogo($('#objeto-dlg')), formObj = dlgObj.querySelector('form');
  const EFECTOS_OBJ = [['ninguno', 'Nada'], ['curar', 'Curar'], ['atributo', 'Atributo'], ['ca', 'CA']];
  let objEdit = null, objTipo = 'pocion', objEfecto = 'curar';
  function pintarObjForm() {
    dlgObj.querySelector('[data-fo-tipos]').innerHTML = Object.entries(TIPOS_OBJ).map(([k, t]) => `<button type="button" aria-pressed="${k === objTipo}" data-fo-tipo="${k}">${F.icono(k)}${t}</button>`).join('');
    dlgObj.querySelector('[data-fo-efectos]').innerHTML = EFECTOS_OBJ.map(([k, t]) => `<button type="button" aria-pressed="${k === objEfecto}" data-fo-efecto="${k}">${t}</button>`).join('');
    dlgObj.querySelector('[data-fo-campos="curar"]').hidden = objEfecto !== 'curar';
    dlgObj.querySelector('[data-fo-campos="bono"]').hidden = !['atributo', 'ca'].includes(objEfecto);
    dlgObj.querySelector('[data-fo-atr]').hidden = objEfecto !== 'atributo';
  }
  function abrirObjeto(o) {
    objEdit = o; formObj.reset(); dlgObj.querySelector('.aviso').textContent = '';
    objTipo = o ? o.tipo : 'pocion'; objEfecto = o ? (o.efecto ? o.efecto.clase : 'ninguno') : 'curar';
    dlgObj.querySelector('#fo-titulo').textContent = o ? 'Editar objeto' : 'Nuevo objeto';
    if (o) {
      formObj.n.value = o.n; formObj.nota.value = o.nota || ''; formObj.resto.value = o.resto || ''; formObj.precio.value = o.precio || '';
      formObj.consumible.checked = o.consumible !== false && (!!o.efecto || !!o.consumible);
      if (o.efecto) { formObj.dados.value = o.efecto.dados || ''; formObj.atr.value = o.efecto.atr || 'fue'; formObj.valor.value = o.efecto.dados && o.efecto.clase !== 'curar' ? o.efecto.dados : (o.efecto.valor ?? 2); formObj.turnos.value = o.efecto.turnos ?? 3; }
    } else formObj.resto.value = 'Frasco vacío';
    pintarObjForm(); dlgObj.showModal(); formObj.n.focus();
  }
  dlgObj.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.foTipo) {
      const antes = objTipo; objTipo = b.dataset.foTipo;
      if (antes === 'pocion' && objTipo !== 'pocion' && formObj.resto.value === 'Frasco vacío') formObj.resto.value = '';
      if (objTipo === 'pocion' && !formObj.resto.value) formObj.resto.value = 'Frasco vacío';
      pintarObjForm();
    }
    else if (b.dataset.foEfecto) { objEfecto = b.dataset.foEfecto; pintarObjForm(); }
  });
  formObj.addEventListener('submit', ev => {
    ev.preventDefault();
    const aviso = dlgObj.querySelector('.aviso'), n = formObj.n.value.trim();
    if (!n) { aviso.textContent = 'Ponle un nombre.'; formObj.n.focus(); return; }
    let efecto = null;
    if (objEfecto === 'curar') {
      const dd = (formObj.dados.value.trim() || '1d4').replace(/\s+/g, '');
      if (!/^\d{0,2}d\d{1,3}([+-]\d{1,3})?$|^\d{1,3}$/i.test(dd)) { aviso.textContent = 'Escribe la curación como 2d4+2 o como un número.'; return; }
      efecto = { clase: 'curar', dados: dd };
    } else if (objEfecto !== 'ninguno') {
      // «Cuánto» acepta un número fijo (+2) o dados (1d4): con dados, el jugador tira y escribe el resultado.
      const v = formObj.valor.value.trim().replace(/\s+/g, '').replace(/^\+/, '');
      const conDados = /^\d{0,2}d\d{1,3}([+-]\d{1,3})?$/i.test(v);
      if (!conDados && !/^-?\d{1,2}$/.test(v)) { aviso.textContent = 'Escribe cuánto suma como un número (2) o con dados (1d4).'; formObj.valor.focus(); return; }
      efecto = { clase: objEfecto, ...(conDados ? { dados: v.toLowerCase() } : { valor: limitar(parseInt(v, 10), -10, 10) }), turnos: limitar(parseInt(formObj.turnos.value, 10) || 1, 1, 100), ...(objEfecto === 'atributo' ? { atr: formObj.atr.value } : {}) };
    }
    const o = { n, tipo: objTipo, nota: formObj.nota.value.trim(), consumible: formObj.consumible.checked, resto: formObj.resto.value.trim(), precio: parseInt(formObj.precio.value, 10) || 0 };
    if (efecto) o.efecto = efecto;
    dlgObj.close();
    cambio(() => { if (objEdit) { delete objEdit.efecto; Object.assign(objEdit, o); } else mesa.forja.unshift({ id: uid('fo'), ...o }); });
  });
  const dlgDar = F.dialogo($('#dar-dlg')), formDar = dlgDar.querySelector('form');
  let objDar = null;
  function abrirDar(o) {
    if (!o) return;
    const pjs = datos.personajes.filter(p => p.tipo === 'pj' && p.estado !== 'muerto');
    if (!pjs.length) return F.toast('La campaña no tiene personajes jugadores todavía.');
    objDar = o; formDar.reset(); dlgDar.querySelector('.aviso').textContent = '';
    dlgDar.querySelector('[data-dd-objeto]').innerHTML = `<div class="obj obj--${e(o.tipo)} obj--mini"><div class="obj__cab"><span class="obj__ico">${F.icono(o.tipo)}</span><div><b>${e(o.n)}</b><small>${e(textoEfecto(o.efecto))}</small></div></div></div>`;
    const enEscena = new Set(mesa.enEscena);
    formDar.pj.innerHTML = pjs.sort((a, b) => (enEscena.has(b.id) ? 1 : 0) - (enEscena.has(a.id) ? 1 : 0)).map(p => `<option value="${e(p.id)}">${e(p.nombre)}</option>`).join('');
    dlgDar.showModal();
  }
  formDar.addEventListener('submit', async ev => {
    ev.preventDefault();
    const o = objDar, idp = formDar.pj.value, cant = limitar(parseInt(formDar.cant.value, 10) || 1, 1, 99);
    const boton = formDar.querySelector('[type=submit]'); F.ocupado(boton, true);
    try {
      await F.api(rutaCamp + '/jugador', { metodo: 'POST', datos: { accion: 'dar', pj: idp, objeto: { n: o.n, tipo: o.tipo, nota: o.nota, efecto: o.efecto, consumible: o.consumible, resto: o.resto, cant } } });
      dlgDar.close(); F.toast(`${cant > 1 ? cant + ' × ' : ''}${o.n} para ${(pj(idp) || {}).nombre || 'el jugador'}`);
    } catch (err) { dlgDar.querySelector('.aviso').textContent = err.message; }
    finally { F.ocupado(boton, false); }
  });

  // Lo que los jugadores cambian en su móvil (inventario, efectos) llega aquí y sigue hasta el proyector.
  F.peticiones.montar({ id, caja: $('[data-pets]'), datos: () => datos, alCambiar: () => { if (!document.querySelector('dialog[open]') && vista !== 'cronica') pintarVista(); vivo.emitir(); }, alRev: r => { if (r === rev + 1) rev = r; } });

  pintarVista();
  vivo.emitir();
  marca('');
  if (forjaNueva) programar();
  F.entrar('.consola__vivo > *, .ec, .esc, .obj', { y: 12, stagger: .03 });
})();
