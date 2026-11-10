/* Mesa del DM: editor visual de escenas (mapa + imágenes, textos, áreas y efectos), grupo en escena,
   avisos de acierto o fallo y presentaciones animadas. Lo que se ve aquí es lo que sale en el proyector.
   El proyector vive en otra ventana del mismo navegador y se sincroniza por BroadcastChannel;
   lo preparado (escenas y presentaciones) se guarda en la campaña, dentro de datos.mesa. */
(async () => {
  const F = window.Forja, e = F.esc, T = F.tablero, TFF = window.TFF || {};
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  const id = new URLSearchParams(location.search).get('id') || '';
  const $ = s => document.querySelector(s);
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const R = 16 / 9;   // proporción del tablero: un círculo mide w de ancho y w·R de alto

  let datos, rev, resumen;
  try {
    const [a, b] = await Promise.all([F.api('campanas/' + encodeURIComponent(id)), F.api('campanas/' + encodeURIComponent(id) + '/datos')]);
    if (b.rol !== 'dm') { location.replace('campana.html?id=' + encodeURIComponent(id)); return; }
    resumen = a.campana; datos = b.datos; rev = b.rev;
  } catch { location.replace('campanas.html'); return; }
  document.title = 'Mesa · ' + resumen.nombre;
  $('[data-volver]').href = 'campana.html?id=' + encodeURIComponent(id);
  $('[data-volver]').innerHTML = F.icono('atras');

  /* ---------- Estado ---------- */
  const escenaNueva = (nombre, fondo) => ({ id: uid('esc'), nombre, fondo: fondo || '', ajuste: 'contain', elementos: [] });
  if (!datos.mesa || !Array.isArray(datos.mesa.escenas) || !datos.mesa.escenas.length) {
    // Primera vez: una escena por cada mapa que ya tuviera la campaña.
    const deMapas = (datos.mapas || []).map(m => escenaNueva(m.nombre || 'Mapa', /^(api\/|data:image)/.test(m.img || '') ? m.img : ''));
    datos.mesa = {
      escenas: deMapas.length ? deMapas : [escenaNueva('Escena 1')], presentaciones: [],
      enEscena: datos.personajes.filter(p => p.tipo === 'pj').map(p => p.id), grupoPos: 'abajo', turno: ''
    };
  }
  const mesa = datos.mesa;
  mesa.presentaciones = mesa.presentaciones || []; mesa.enEscena = mesa.enEscena || []; mesa.grupoPos = mesa.grupoPos || 'abajo';
  let escena = mesa.escenas.find(x => x.id === mesa.actual) || mesa.escenas[0];
  let sel = null, hist = [], panel = 'elemento', enVivo = true, escenaEmitida = null;
  const vivo = { presentacion: null, aviso: null, negro: false };
  const CLAVE = 'forja.mesa.' + id;
  try { const s = JSON.parse(localStorage.getItem(CLAVE)); if (s) { vivo.presentacion = s.presentacion || null; vivo.negro = !!s.negro; } } catch { /* sin estado previo */ }

  const tabEl = $('[data-tablero]');
  const tab = T.montar(tabEl, { editable: true });
  tabEl.classList.add('tablero--edit');
  const caja = document.createElement('div');
  caja.className = 'sel'; caja.hidden = true;
  caja.innerHTML = ['nw', 'ne', 'se', 'sw', 'giro'].map(a => `<i class="asa" data-asa="${a}"></i>`).join('');
  tab.capa.append(caja);

  const elSel = () => escena.elementos.find(x => x.id === sel) || null;
  const pj = idp => datos.personajes.find(p => p.id === idp);

  /* ---------- Guardado ---------- */
  let reloj = 0, guardando = false, sucio = false;
  const marca = t => { $('[data-guardado]').textContent = t; };
  function programar() { sucio = true; marca('Guardando…'); clearTimeout(reloj); reloj = setTimeout(guardar, 700); }
  async function guardar() {
    clearTimeout(reloj);
    if (guardando || !sucio) return;
    guardando = true; sucio = false;
    try {
      const r = await F.api('campanas/' + encodeURIComponent(id) + '/datos', { metodo: 'PUT', datos: { rev, datos } });
      rev = r.rev; if (!sucio) marca('Guardado');
    } catch (err) {
      marca('Sin guardar');
      F.toast(err.estado === 409 ? 'La campaña cambió en otra ventana. Recargando…' : 'No se pudo guardar: ' + err.message);
      if (err.estado === 409) return setTimeout(() => location.reload(), 1500);
      sucio = true;
    }
    guardando = false;
    if (sucio) programar();
  }
  addEventListener('pagehide', () => { if (sucio) guardar(); });

  /* ---------- Emisión al proyector ---------- */
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('forja-mesa-' + id) : null;
  const grupoVivo = () => mesa.enEscena.map(pj).filter(Boolean).map(p => ({ id: p.id, nombre: p.nombre, img: p.img || '', tipo: p.tipo, pg: p.pg ?? p.pgMax ?? 0, pgMax: p.pgMax || 0, turno: mesa.turno === p.id }));
  const estadoVivo = () => ({ escena: escenaEmitida || escena, grupo: grupoVivo(), pos: mesa.grupoPos, presentacion: vivo.presentacion, aviso: vivo.aviso, negro: vivo.negro });
  let relojLs = 0;
  function emitir() {
    if (enVivo) escenaEmitida = JSON.parse(JSON.stringify(escena));
    const s = estadoVivo();
    canal && canal.postMessage(s);
    clearTimeout(relojLs);
    relojLs = setTimeout(() => { try { localStorage.setItem(CLAVE, JSON.stringify({ ...s, aviso: null })); } catch { /* almacenamiento lleno: el canal sigue funcionando */ } }, 300);
  }
  let cuadroParcial = 0;
  const emitirArrastre = () => { if (!enVivo || !canal || cuadroParcial) return; cuadroParcial = requestAnimationFrame(() => { cuadroParcial = 0; canal.postMessage({ parcial: true, escena }); }); };
  if (canal) canal.onmessage = ev => { if (ev.data === 'hola') emitir(); };

  /* ---------- Historial ---------- */
  const recordar = () => { hist.push(JSON.stringify(escena.elementos)); if (hist.length > 40) hist.shift(); };
  function deshacer() {
    if (!hist.length) return F.toast('No hay nada que deshacer');
    escena.elementos = JSON.parse(hist.pop());
    if (!elSel()) sel = null;
    todo(); programar();
  }
  let editando = false;   // agrupa en un solo paso del historial todo lo que se teclea o desliza seguido
  const tocar = () => { if (!editando) { recordar(); editando = true; } };

  /* ---------- Pintado ---------- */
  function pintarSel() {
    const d = elSel(), n = d && tab.nodo(d.id);
    caja.hidden = !n;
    if (!n) return;
    caja.style.left = d.x + '%'; caja.style.top = d.y + '%';
    caja.style.width = n.offsetWidth + 'px'; caja.style.height = n.offsetHeight + 'px';
    caja.style.transform = `translate(-50%, -50%) rotate(${d.rot || 0}deg)`;
    caja.classList.toggle('is-bloq', !!d.bloq);
  }
  function lienzo() { tab.pintar(escena); pintarSel(); }
  function vivoLocal() { tab.grupo(grupoVivo(), mesa.grupoPos); tab.presentar(vivo.presentacion); tab.aviso(vivo.aviso); }
  function todo() { lienzo(); vivoLocal(); pintarBarra(); pintarDock(); emitir(); }
  new ResizeObserver(pintarSel).observe(tabEl);

  function pintarBarra() {
    $('[data-escena-nombre]').textContent = escena.nombre || 'Escena';
    $('[data-escena-lista]').innerHTML = mesa.escenas.map(x => `<button type="button" data-ir-escena="${e(x.id)}"${x.id === escena.id ? ' aria-current="true"' : ''}>${e(x.nombre || 'Escena')}</button>`).join('')
      + `<button type="button" data-nueva-escena>${F.icono('mas')}Nueva escena</button>`;
    $('[data-vivo]').innerHTML = `<i class="punto${enVivo ? ' punto--on' : ''}"></i><span>${enVivo ? 'En vivo' : 'Preparando'}</span>`;
    $('[data-vivo]').setAttribute('aria-pressed', String(enVivo));
    $('[data-telon]').innerHTML = F.icono('telon') + '<span>Telón</span>';
    $('[data-telon]').setAttribute('aria-pressed', String(vivo.negro));
    $('[data-pista]').textContent = vivo.negro ? 'El proyector está en negro (telón).' : !enVivo ? 'Preparando: el proyector no cambia hasta que vuelvas a «En vivo».' : '';
  }
  $('[data-herramientas]').innerHTML = [['fondo', 'mapa', 'Mapa'], ['imagen', 'imagen', 'Imagen'], ['texto', 'texto', 'Texto'], ['area', 'area', 'Área'], ['efecto', 'fuego', 'Efecto']]
    .map(([k, ic, t]) => `<button class="herr" type="button" data-anadir="${k}" title="${k === 'fondo' ? 'Cambiar el mapa de fondo' : 'Añadir ' + t.toLowerCase()}">${F.icono(ic)}<span>${t}</span></button>`).join('')
    + `<i class="mbar__sep"></i><button class="herr herr--icono" type="button" data-deshacer title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${F.icono('deshacer')}</button>`;
  $('[data-proyector]').innerHTML = F.icono('mesa') + '<span>Abrir proyector</span>';
  $('[data-panel]').innerHTML = F.icono('panel');

  /* ---------- Panel lateral ---------- */
  const PANELES = [['elemento', 'Escena'], ['grupo', 'En escena'], ['presentar', 'Presentar']];
  const prop = (etq, html) => `<label class="prop"><span>${etq}</span>${html}</label>`;
  const opciones = (obj, valor) => Object.entries(obj).map(([k, t]) => `<option value="${e(k)}"${k === valor ? ' selected' : ''}>${e(t)}</option>`).join('');
  const lista = (p, obj, valor) => `<select class="entrada entrada--chica" data-prop="${p}">${opciones(obj, valor)}</select>`;
  const rango = (p, min, max, paso, valor) => `<input type="range" data-prop="${p}" min="${min}" max="${max}" step="${paso}" value="${valor}">`;
  const muestras = (p, claves, valor) => `<div class="muestras" role="group">${claves.map(c => `<button type="button" class="muestra muestra--${c}" data-color="${p}:${c}" aria-pressed="${c === valor}" aria-label="${c}" title="${c}"></button>`).join('')}</div>`;
  const casilla = (p, si, t) => `<label class="casilla"><input type="checkbox" data-prop="${p}"${si ? ' checked' : ''}> ${t}</label>`;
  const COLORES_EFECTO = { fuego: 'Fuego', verde: 'Verde', azul: 'Azul', rojo: 'Rojo', papel: 'Gris' };

  function panelElemento() {
    const d = elSel();
    if (!d) {
      return `
        <h3 class="dock__tit">Escena</h3>
        <label class="prop"><span>Nombre</span><input class="entrada entrada--chica" data-escena-prop="nombre" value="${e(escena.nombre)}" maxlength="60"></label>
        <label class="prop"><span>Mapa</span><select class="entrada entrada--chica" data-escena-prop="ajuste"><option value="contain"${escena.ajuste !== 'cover' ? ' selected' : ''}>Entero</option><option value="cover"${escena.ajuste === 'cover' ? ' selected' : ''}>Llenar la pantalla</option></select></label>
        <div class="fila-btn">
          <button class="boton boton--secundario boton--chico" type="button" data-anadir="fondo">${F.icono('mapa')}${escena.fondo ? 'Cambiar mapa' : 'Subir mapa'}</button>
          ${escena.fondo ? `<button class="boton boton--fantasma boton--chico" type="button" data-quitar-fondo>Quitar</button>` : ''}
        </div>
        <div class="fila-btn">
          <button class="boton boton--fantasma boton--chico" type="button" data-duplicar-escena>${F.icono('duplicar')}Duplicar</button>
          <button class="boton boton--fantasma boton--chico" type="button" data-borrar-escena>${F.icono('borrar')}Borrar escena</button>
        </div>
        <p class="dock__ayuda suave">Añade imágenes, textos, áreas de conjuro y efectos desde la barra de arriba. Arrastra para mover; usa las esquinas para cambiar el tamaño y el punto superior para girar.</p>
        <p class="dock__ayuda suave"><kbd>Supr</kbd> borra · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplica · <kbd>Ctrl</kbd>+<kbd>Z</kbd> deshace · flechas mueven</p>`;
    }
    const NOMBRE = { imagen: 'Imagen', texto: 'Texto', area: 'Área', efecto: 'Efecto' }[d.tipo];
    let h = `<h3 class="dock__tit">${NOMBRE}</h3>`;
    if (d.tipo === 'texto') {
      h += `<label class="prop prop--alto"><span>Texto</span><textarea class="entrada entrada--chica" data-prop="txt" rows="3" maxlength="400">${e(d.txt)}</textarea></label>`
        + prop('Letra', lista('fuente', { gotica: 'Gótica', sans: 'Poppins' }, d.fuente))
        + prop('Tamaño', rango('t', .8, 16, .1, d.t))
        + prop('Alineación', lista('alin', { left: 'Izquierda', center: 'Centro', right: 'Derecha' }, d.alin))
        + prop('Color', muestras('color', ['papel', 'amarillo', 'acido', 'tinta', 'oxido', 'pizarra'], d.color))
        + casilla('placa', d.placa, 'Con placa de fondo');
    } else if (d.tipo === 'imagen') {
      h += prop('Marco', lista('marco', { ninguno: 'Sin marco', sombra: 'Con sombra', redondo: 'Esquinas redondas', circulo: 'Círculo' }, d.marco))
        + `<div class="fila-btn"><button class="boton boton--secundario boton--chico" type="button" data-reemplazar>${F.icono('subir')}Cambiar imagen</button></div>`;
    } else if (d.tipo === 'area') {
      h += prop('Forma', lista('forma', T.FORMAS, d.forma))
        + prop('Color', muestras('color', ['oxido', 'fuego', 'amarillo', 'acido', 'pizarra', 'papel'], d.color))
        + `<label class="prop"><span>Etiqueta</span><input class="entrada entrada--chica" data-prop="etq" value="${e(d.etq || '')}" maxlength="40" placeholder="Bola de fuego · 6 m"></label>`
        + casilla('pulso', d.pulso !== false, 'Que palpite');
    } else if (d.tipo === 'efecto') {
      h += prop('Efecto', lista('clase', T.EFECTOS, d.clase)) + (d.clase === 'oscuridad' ? '' : prop('Color', lista('color', COLORES_EFECTO, d.color)));
    }
    h += prop('Opacidad', rango('op', .1, 1, .05, d.op ?? 1))
      + `<label class="prop"><span>Giro</span><input class="entrada entrada--chica" type="number" data-prop="rot" value="${Math.round(d.rot || 0)}" min="-360" max="360" step="5"></label>
      <div class="fila-btn fila-btn--iconos">
        <button class="herr herr--icono" type="button" data-accion="subir" title="Traer adelante" aria-label="Traer adelante">${F.icono('arriba')}</button>
        <button class="herr herr--icono" type="button" data-accion="bajar" title="Enviar atrás" aria-label="Enviar atrás">${F.icono('abajo')}</button>
        <button class="herr herr--icono" type="button" data-accion="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">${F.icono('duplicar')}</button>
        <button class="herr herr--icono" type="button" data-accion="bloquear" aria-pressed="${!!d.bloq}" title="Bloquear para no moverlo sin querer" aria-label="Bloquear">${F.icono('candado')}</button>
        <button class="herr herr--icono" type="button" data-accion="borrar" title="Borrar (Supr)" aria-label="Borrar">${F.icono('borrar')}</button>
      </div>`;
    return h;
  }

  let buscaPj = '';
  const TIPO = { pj: 'PJ', npc: 'NPC', enemigo: 'Enemigo' };
  function resultadosPj() {
    const q = buscaPj.trim().toLowerCase();
    const fuera = datos.personajes.filter(p => !mesa.enEscena.includes(p.id) && (!q || (p.nombre || '').toLowerCase().includes(q) || (TIPO[p.tipo] || '').toLowerCase().includes(q)));
    if (!datos.personajes.length) return `<p class="suave dock__ayuda">Esta campaña aún no tiene personajes. <a href="campana.html?id=${encodeURIComponent(id)}&ver=personajes">Añádelos en Personajes</a>.</p>`;
    if (!fuera.length) return `<p class="suave dock__ayuda">${q ? 'Nadie con ese nombre.' : 'Todos están ya en escena.'}</p>`;
    return fuera.slice(0, 14).map(p => `<button type="button" class="pj-mini" data-entra="${e(p.id)}">${F.ficha.retrato(p, 'pj-mini__retrato')}<span>${e(p.nombre)}</span><small>${TIPO[p.tipo] || 'NPC'}</small>${F.icono('mas')}</button>`).join('')
      + (fuera.length > 14 ? `<p class="suave dock__ayuda">Y ${fuera.length - 14} más: escribe para filtrar.</p>` : '');
  }
  function panelGrupo() {
    const dentro = mesa.enEscena.map(pj).filter(Boolean);
    return `
      <h3 class="dock__tit">En escena</h3>
      ${prop('En el proyector', `<select class="entrada entrada--chica" data-mesa-prop="grupoPos">${opciones({ abajo: 'Abajo', arriba: 'Arriba', izquierda: 'A la izquierda', derecha: 'A la derecha', oculto: 'No mostrar' }, mesa.grupoPos)}</select>`)}
      <div class="fila-btn">
        <button class="boton boton--secundario boton--chico" type="button" data-turno="sig"${dentro.length ? '' : ' disabled'}>${F.icono('proyectar')}Siguiente turno</button>
        ${mesa.turno ? `<button class="boton boton--fantasma boton--chico" type="button" data-turno="fin">Terminar</button>` : ''}
      </div>
      <ul class="escena-lista">${dentro.map(p => `
        <li class="${mesa.turno === p.id ? 'is-turno' : ''}">
          <button type="button" class="escena-lista__quien" data-ver-ficha="${e(p.id)}" title="Ver la ficha">${F.ficha.retrato(p, 'pj-mini__retrato')}<span><b>${e(p.nombre)}</b><small>${TIPO[p.tipo] || 'NPC'}${p.ca !== undefined ? ' · CA ' + e(p.ca) : ''}</small></span></button>
          ${p.pgMax ? `<span class="pg"><button type="button" data-pg="${e(p.id)}:-1" aria-label="Quitar 1 PG">−</button><input type="number" data-pg-de="${e(p.id)}" value="${e(p.pg ?? p.pgMax)}" min="0" max="${e(p.pgMax)}" aria-label="PG de ${e(p.nombre)}"><small>/${e(p.pgMax)}</small><button type="button" data-pg="${e(p.id)}:1" aria-label="Sumar 1 PG">+</button></span>` : ''}
          <span class="escena-lista__acc">
            <button type="button" class="herr herr--icono" data-orden="${e(p.id)}" title="Subir en el orden de turnos" aria-label="Subir en el orden">${F.icono('arriba')}</button>
            <button type="button" class="herr herr--icono" data-sale="${e(p.id)}" title="Sacar de la escena" aria-label="Sacar de la escena">${F.icono('cerrar')}</button>
          </span>
        </li>`).join('') || '<li class="suave">Nadie en escena todavía.</li>'}</ul>
      <input class="entrada entrada--chica" type="search" data-buscar-pj value="${e(buscaPj)}" placeholder="Añadir PJ, NPC o enemigo…" aria-label="Buscar personaje para añadir">
      <div class="pj-resultados" data-resultados>${resultadosPj()}</div>`;
  }

  function panelPresentar() {
    const dentro = mesa.enEscena.map(pj).filter(Boolean);
    return `
      <h3 class="dock__tit">Avisar a la mesa</h3>
      <form class="aviso-form" data-aviso>
        <input class="entrada entrada--chica" name="quien" list="dl-quien" placeholder="Quién" maxlength="60" aria-label="Quién" autocomplete="off">
        <datalist id="dl-quien">${dentro.map(p => `<option value="${e(p.nombre)}">`).join('')}</datalist>
        <input class="entrada entrada--chica" name="que" list="dl-que" placeholder="Qué hace: Bola de fuego, espadazo…" maxlength="80" aria-label="Qué hace" autocomplete="off">
        <datalist id="dl-que"></datalist>
        <input class="entrada entrada--chica" name="nota" placeholder="Daño o efecto (opcional)" maxlength="80" aria-label="Daño o efecto" autocomplete="off">
        <div class="aviso-form__res">
          <button class="boton boton--chico res res--acierta" type="submit" value="acierta">Acierta</button>
          <button class="boton boton--chico res res--falla" type="submit" value="falla">Falla</button>
          <button class="boton boton--chico res res--critico" type="submit" value="critico">Crítico</button>
          <button class="boton boton--chico boton--secundario" type="submit" value="neutro">Solo avisar</button>
        </div>
      </form>
      <h3 class="dock__tit">Presentaciones</h3>
      <div class="pres-lista">${mesa.presentaciones.map(p => {
        const activa = vivo.presentacion && vivo.presentacion.id === p.id;
        return `<article class="pres${activa ? ' is-activa' : ''}">
          <div class="pres__img">${p.img ? `<img src="${e(p.img)}" alt="">` : F.icono('imagen')}</div>
          <div class="pres__txt"><b>${e(p.titulo)}</b><small>${e(T.PLANTILLAS[p.plantilla] || '')} · ${e(T.AMBIENTES[p.ambiente] || 'Sin ambiente')}</small></div>
          <div class="pres__acc">
            <button class="boton boton--chico ${activa ? 'boton--secundario' : 'boton--primario'}" type="button" data-proyectar="${e(p.id)}">${F.icono(activa ? 'parar' : 'proyectar')}${activa ? 'Quitar' : 'Proyectar'}</button>
            <button class="herr herr--icono" type="button" data-editar-pres="${e(p.id)}" aria-label="Editar" title="Editar">${F.icono('editar')}</button>
            <button class="herr herr--icono" type="button" data-borrar-pres="${e(p.id)}" aria-label="Borrar" title="Borrar">${F.icono('borrar')}</button>
          </div>
        </article>`;
      }).join('') || '<p class="suave dock__ayuda">Prepara la entrada de un jefe, un personaje o un lugar: imagen, título y descripción con ambiente animado sobre el mapa.</p>'}</div>
      <button class="boton boton--secundario boton--chico" type="button" data-nueva-pres>${F.icono('mas')}Nueva presentación</button>`;
  }

  function pintarDock() {
    PANELES[0][1] = elSel() ? 'Elemento' : 'Escena';
    $('[data-dock-tabs]').innerHTML = PANELES.map(([k, t]) => `<button type="button" aria-pressed="${k === panel}" data-panel-ir="${k}">${t}</button>`).join('');
    $('[data-dock-cuerpo]').innerHTML = ({ elemento: panelElemento, grupo: panelGrupo, presentar: panelPresentar })[panel]();
    $('[data-dock-cuerpo]').querySelectorAll('.muestra').forEach(b => { b.style.background = T.COLOR[b.dataset.color.split(':')[1]]; });
  }

  /* ---------- Añadir ---------- */
  const base = (tipo, extra) => ({ id: uid('el'), tipo, x: 50, y: 50, w: 20, h: 20 * R, rot: 0, op: 1, ...extra });
  function anadir(d) { recordar(); escena.elementos.push(d); sel = d.id; panel = 'elemento'; todo(); programar(); }
  const archivo = $('[data-archivo]');
  let destinoArchivo = null;
  const pedirArchivo = destino => { destinoArchivo = destino; archivo.value = ''; archivo.click(); };
  archivo.addEventListener('change', async () => {
    const f = archivo.files[0], destino = destinoArchivo;
    if (!f) return;
    marca('Subiendo imagen…');
    try {
      if (destino === 'fondo') {
        const r = await F.subirImagen(id, f, 2560, 'image/jpeg');
        escena.fondo = r.url; todo(); programar();
      } else {
        const r = await F.subirImagen(id, f, 1400, 'image/webp'), d = destino === 'reemplazar' && elSel();
        if (d) { recordar(); d.src = r.url; d.h = d.w * (r.alto / r.ancho) * R; todo(); programar(); }
        else anadir(base('imagen', { src: r.url, marco: 'ninguno', w: 28, h: 28 * (r.alto / r.ancho) * R }));
      }
    } catch (err) { marca(''); F.toast('No se pudo subir la imagen: ' + err.message); }
  });
  function anadirTipo(k) {
    if (k === 'fondo' || k === 'imagen') return pedirArchivo(k);
    if (k === 'texto') return anadir(base('texto', { w: 44, h: 0, t: 5, txt: 'Título', fuente: 'gotica', color: 'papel', alin: 'center', placa: false }));
    if (k === 'area') return anadir(base('area', { w: 18, h: 18 * R, forma: 'circulo', color: 'oxido', etq: '', pulso: true }));
    if (k === 'efecto') return anadir(base('efecto', { w: 26, h: 42, clase: 'llamas', color: 'fuego' }));
  }

  /* ---------- Acciones sobre el elemento ---------- */
  function accion(a) {
    const d = elSel(); if (!d) return;
    const i = escena.elementos.indexOf(d);
    recordar();
    if (a === 'borrar') { escena.elementos.splice(i, 1); sel = null; }
    else if (a === 'duplicar') { const c = { ...JSON.parse(JSON.stringify(d)), id: uid('el'), x: limitar(d.x + 3, 0, 100), y: limitar(d.y + 3, 0, 100), bloq: false }; escena.elementos.push(c); sel = c.id; }
    else if (a === 'subir' && i < escena.elementos.length - 1) { escena.elementos.splice(i, 1); escena.elementos.splice(i + 1, 0, d); }
    else if (a === 'bajar' && i > 0) { escena.elementos.splice(i, 1); escena.elementos.splice(i - 1, 0, d); }
    else if (a === 'bloquear') d.bloq = !d.bloq;
    todo(); programar();
  }
  function ponerProp(d, p, v) {
    d[p] = v;
    // Al cambiar de forma se ajusta la proporción para que el resultado sea el esperado a la primera.
    if (p === 'forma') { if (v === 'linea') d.h = 3; else if (v === 'circulo' || v === 'cuadrado') d.h = d.w * R; else if (d.h < 8) d.h = d.w * R * .8; }
    if (p === 'clase' && (v === 'niebla' || v === 'lluvia')) d.color = 'papel';
  }

  /* ---------- Arrastrar, redimensionar, girar ---------- */
  tabEl.addEventListener('pointerdown', ev => {
    if (ev.button) return;
    const asa = ev.target.closest('[data-asa]'), nodo = ev.target.closest('[data-el]');
    if (asa && elSel()) return arrastre('asa', asa.dataset.asa, ev);
    if (nodo) {
      if (sel !== nodo.dataset.el) { sel = nodo.dataset.el; panel = 'elemento'; pintarSel(); pintarDock(); }
      if (!elSel().bloq) arrastre('mover', null, ev);
      return;
    }
    if (sel) { sel = null; pintarSel(); pintarDock(); }
  });
  function arrastre(modo, asa, ev) {
    ev.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const d = elSel(), r = tabEl.getBoundingClientRect(), ini = { ...d };
    const cx = r.left + d.x / 100 * r.width, cy = r.top + d.y / 100 * r.height;
    const dist0 = Math.hypot(ev.clientX - cx, ev.clientY - cy) || 1, ang0 = Math.atan2(ev.clientY - cy, ev.clientX - cx);
    let movido = false;
    const mover = m => {
      const dx = m.clientX - ev.clientX, dy = m.clientY - ev.clientY;
      if (!movido) { if (Math.hypot(dx, dy) < 3) return; movido = true; recordar(); }
      if (modo === 'mover') { d.x = limitar(ini.x + dx / r.width * 100, -10, 110); d.y = limitar(ini.y + dy / r.height * 100, -10, 110); }
      else if (asa === 'giro') {
        let a = (ini.rot || 0) + (Math.atan2(m.clientY - cy, m.clientX - cx) - ang0) * 180 / Math.PI;
        if (m.shiftKey) a = Math.round(a / 15) * 15;
        d.rot = Math.round(((a + 540) % 360) - 180);
      } else {
        const libre = d.tipo === 'efecto' || (d.tipo === 'area' && d.forma !== 'circulo') || (d.tipo === 'imagen' && m.shiftKey);
        if (libre) {
          const rad = -(d.rot || 0) * Math.PI / 180, px = m.clientX - cx, py = m.clientY - cy;
          d.w = Math.max(1.5, 2 * Math.abs(px * Math.cos(rad) - py * Math.sin(rad)) / r.width * 100);
          d.h = Math.max(1.5, 2 * Math.abs(px * Math.sin(rad) + py * Math.cos(rad)) / r.height * 100);
        } else {
          const f = Math.max(.05, Math.hypot(m.clientX - cx, m.clientY - cy) / dist0);
          d.w = Math.max(1.5, ini.w * f); d.h = ini.h * f;
          if (d.tipo === 'texto') d.t = limitar(ini.t * f, .8, 16);
        }
      }
      lienzo(); emitirArrastre();
    };
    const soltar = () => {
      removeEventListener('pointermove', mover);
      if (movido) { pintarDock(); emitir(); programar(); }
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar, { once: true });
    addEventListener('pointercancel', soltar, { once: true });
  }

  /* ---------- Teclado ---------- */
  addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
    const d = elSel(), ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 'z') { ev.preventDefault(); return deshacer(); }
    if (!d) return;
    if (ev.key === 'Escape') { sel = null; pintarSel(); pintarDock(); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); accion('borrar'); }
    else if (ctrl && ev.key.toLowerCase() === 'd') { ev.preventDefault(); accion('duplicar'); }
    else if (ev.key.startsWith('Arrow') && !d.bloq) {
      ev.preventDefault(); tocar();
      const paso = ev.shiftKey ? 2 : .4;
      if (ev.key === 'ArrowLeft') d.x -= paso; if (ev.key === 'ArrowRight') d.x += paso; if (ev.key === 'ArrowUp') d.y -= paso; if (ev.key === 'ArrowDown') d.y += paso;
      lienzo(); emitir(); programar();
    }
  });
  addEventListener('keyup', () => { editando = false; });

  /* ---------- Barra ---------- */
  document.addEventListener('click', ev => {
    const t = ev.target.closest('button, a');
    const listaEsc = $('[data-escena-lista]'), botonEsc = $('[data-escena-boton]');
    if (t === botonEsc) { listaEsc.hidden = !listaEsc.hidden; botonEsc.setAttribute('aria-expanded', String(!listaEsc.hidden)); return; }
    if (!ev.target.closest('[data-escenas]')) { listaEsc.hidden = true; botonEsc.setAttribute('aria-expanded', 'false'); }
    if (!t) return;
    const ds = t.dataset;
    if (ds.irEscena) { escena = mesa.escenas.find(x => x.id === ds.irEscena) || escena; mesa.actual = escena.id; sel = null; hist = []; listaEsc.hidden = true; todo(); programar(); }
    else if ('nuevaEscena' in ds) { escena = escenaNueva('Escena ' + (mesa.escenas.length + 1)); mesa.escenas.push(escena); mesa.actual = escena.id; sel = null; hist = []; panel = 'elemento'; listaEsc.hidden = true; todo(); programar(); }
    else if (ds.anadir) anadirTipo(ds.anadir);
    else if ('deshacer' in ds) deshacer();
    else if ('vivo' in ds) { enVivo = !enVivo; pintarBarra(); emitir(); }
    else if ('telon' in ds) { vivo.negro = !vivo.negro; pintarBarra(); emitir(); }
    else if ('proyector' in ds) { const v = window.open('proyector.html?id=' + encodeURIComponent(id), 'forja-proyector-' + id, 'popup,width=1280,height=720'); if (!v) F.toast('El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.'); setTimeout(emitir, 600); }
    else if ('panel' in ds) { const dock = $('[data-dock]'); dock.hidden = !dock.hidden; t.setAttribute('aria-pressed', String(!dock.hidden)); requestAnimationFrame(pintarSel); }
    else if (ds.panelIr) { panel = ds.panelIr; pintarDock(); }
  });

  /* ---------- Panel: eventos ---------- */
  const cuerpo = $('[data-dock-cuerpo]');
  cuerpo.addEventListener('input', ev => {
    const t = ev.target, ds = t.dataset;
    if (ds.prop) {
      const d = elSel(); if (!d) return;
      tocar();
      ponerProp(d, ds.prop, t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.type === 'number') ? Number(t.value) || 0 : t.value);
      lienzo(); emitir(); programar();
    } else if (ds.escenaProp) { escena[ds.escenaProp] = t.value; lienzo(); pintarBarra(); emitir(); programar(); }
    else if (ds.mesaProp) { mesa[ds.mesaProp] = t.value; vivoLocal(); emitir(); programar(); }
    else if ('buscarPj' in ds) { buscaPj = t.value; cuerpo.querySelector('[data-resultados]').innerHTML = resultadosPj(); }
    else if (ds.pgDe) { const p = pj(ds.pgDe); if (p) { p.pg = limitar(Math.round(Number(t.value) || 0), 0, p.pgMax || 999); vivoLocal(); emitir(); programar(); } }
    else if (t.name === 'quien') {
      // Sugiere los ataques y conjuros de quien actúa.
      const p = datos.personajes.find(x => x.nombre === t.value), dl = cuerpo.querySelector('#dl-que');
      const cosas = p ? [...(p.ataques || []).map(a => a.n), ...((p.conj || {}).trucos || []), ...((p.conj || {}).lista || [])] : [];
      if (dl) dl.innerHTML = cosas.map(c => `<option value="${e(c)}">`).join('');
    }
  });
  cuerpo.addEventListener('change', ev => {
    editando = false;
    if (ev.target.dataset.prop && ev.target.tagName === 'SELECT') pintarDock();   // algunos campos dependen de la forma o del efecto elegido
  });
  cuerpo.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    const ds = t.dataset;
    if (ds.color) { const [p, c] = ds.color.split(':'), d = elSel(); if (d) { recordar(); d[p] = c; todo(); programar(); } }
    else if (ds.accion) accion(ds.accion);
    else if ('reemplazar' in ds) pedirArchivo('reemplazar');
    else if (ds.anadir) anadirTipo(ds.anadir);
    else if ('quitarFondo' in ds) { escena.fondo = ''; todo(); programar(); }
    else if ('duplicarEscena' in ds) {
      const c = JSON.parse(JSON.stringify(escena)); c.id = uid('esc'); c.nombre = escena.nombre + ' (copia)'; c.elementos.forEach(x => { x.id = uid('el'); });
      mesa.escenas.push(c); escena = c; mesa.actual = c.id; sel = null; hist = []; todo(); programar();
    } else if ('borrarEscena' in ds) {
      if (mesa.escenas.length < 2) return F.toast('Es la única escena: no se puede borrar.');
      if (!confirm(`¿Borrar la escena «${escena.nombre}»? No se puede deshacer.`)) return;
      mesa.escenas = mesa.escenas.filter(x => x !== escena); escena = mesa.escenas[0]; mesa.actual = escena.id; sel = null; hist = []; todo(); programar();
    }
    else if (ds.entra) { mesa.enEscena.push(ds.entra); buscaPj = ''; todo(); programar(); }
    else if (ds.sale) { mesa.enEscena = mesa.enEscena.filter(x => x !== ds.sale); if (mesa.turno === ds.sale) mesa.turno = ''; todo(); programar(); }
    else if (ds.orden) { const i = mesa.enEscena.indexOf(ds.orden); if (i > 0) { mesa.enEscena.splice(i, 1); mesa.enEscena.splice(i - 1, 0, ds.orden); todo(); programar(); } }
    else if (ds.pg) { const [idp, n] = ds.pg.split(':'), p = pj(idp); if (p) { p.pg = limitar((p.pg ?? p.pgMax) + Number(n), 0, p.pgMax || 999); todo(); programar(); } }
    else if (ds.turno) {
      const orden = mesa.enEscena.filter(pj);
      mesa.turno = ds.turno === 'fin' || !orden.length ? '' : orden[(orden.indexOf(mesa.turno) + 1) % orden.length];
      todo(); programar();
    }
    else if (ds.verFicha) { const p = pj(ds.verFicha); if (p) { dlgFicha.querySelector('[data-cuerpo]').innerHTML = F.ficha.completa(p); dlgFicha.showModal(); } }
    else if (ds.proyectar) {
      const p = mesa.presentaciones.find(x => x.id === ds.proyectar);
      vivo.presentacion = vivo.presentacion && vivo.presentacion.id === ds.proyectar ? null : p ? { ...p, k: Date.now() } : null;
      vivoLocal(); pintarDock(); emitir();
    }
    else if (ds.editarPres) abrirPres(mesa.presentaciones.find(x => x.id === ds.editarPres));
    else if ('nuevaPres' in ds) abrirPres(null);
    else if (ds.borrarPres) {
      const p = mesa.presentaciones.find(x => x.id === ds.borrarPres);
      if (!p || !confirm(`¿Borrar la presentación «${p.titulo}»?`)) return;
      mesa.presentaciones = mesa.presentaciones.filter(x => x !== p);
      if (vivo.presentacion && vivo.presentacion.id === p.id) vivo.presentacion = null;
      todo(); programar();
    }
  });
  cuerpo.addEventListener('submit', ev => {
    if (!ev.target.matches('[data-aviso]')) return;
    ev.preventDefault();
    const f = ev.target, quien = f.quien.value.trim(), que = f.que.value.trim();
    if (!quien && !que) return F.toast('Escribe quién actúa o qué hace.');
    const p = datos.personajes.find(x => x.nombre === quien);
    vivo.aviso = { k: Date.now(), quien, que, nota: f.nota.value.trim(), res: (ev.submitter && ev.submitter.value) || 'neutro', img: (p && p.img) || '' };
    const k = vivo.aviso.k;
    vivoLocal(); emitir();
    setTimeout(() => { if (vivo.aviso && vivo.aviso.k === k) vivo.aviso = null; }, 6600);
    f.que.value = ''; f.nota.value = ''; f.que.focus();
  });

  /* ---------- Ficha y presentaciones ---------- */
  const dlgFicha = F.dialogo($('#ver-ficha'));
  const dlgPres = F.dialogo($('#present-dlg')), formPres = dlgPres.querySelector('form');
  let presEdit = null, presImg = '', presPlantilla = 'jefe';
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
    if (presEdit) Object.assign(presEdit, d); else mesa.presentaciones.push({ id: uid('pre'), ...d });
    dlgPres.close(); panel = 'presentar'; todo(); programar();
  });

  todo();
  marca('');
  if (!escena.fondo && !escena.elementos.length) $('[data-pista]').textContent = 'Empieza subiendo un mapa con «Mapa» y abre el proyector en la otra pantalla.';
})();
