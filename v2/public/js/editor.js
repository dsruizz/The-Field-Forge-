/* Editor de escenas: el mapa y lo que va encima (imágenes, textos, áreas, efectos y puntos de interés).
   Se prepara aquí; qué se proyecta se decide en la mesa (mesa.html). Si la escena que editas es la que
   está en el proyector, los cambios se ven en vivo. */
(async () => {
  const F = window.Forja, e = F.esc, T = F.tablero;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  const params = new URLSearchParams(location.search), id = params.get('id') || '';
  const $ = s => document.querySelector(s);
  const uid = F.vivo.uid;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const R = 16 / 9;   // proporción del tablero: un círculo mide w de ancho y w·R de alto

  let datos, rev, resumen;
  try {
    const [a, b] = await Promise.all([F.api('campanas/' + encodeURIComponent(id)), F.api('campanas/' + encodeURIComponent(id) + '/datos')]);
    if (b.rol !== 'dm') { location.replace('campana.html?id=' + encodeURIComponent(id)); return; }
    resumen = a.campana; datos = b.datos; rev = b.rev;
  } catch { location.replace('campanas.html'); return; }
  document.title = 'Escena · ' + resumen.nombre;
  $('[data-volver]').href = 'mesa.html?id=' + encodeURIComponent(id) + '&ver=escenas';
  $('[data-volver]').innerHTML = F.icono('atras');

  /* ---------- Estado ---------- */
  const escenaNueva = F.vivo.escenaNueva;
  const mesa = F.vivo.preparar(datos);
  const vivo = F.vivo.crear({ id, datos: () => datos, resumen });
  let escena = mesa.escenas.find(x => x.id === params.get('escena')) || mesa.escenas.find(x => x.id === mesa.actual) || mesa.escenas[0];
  let sel = null, hist = [];
  const enProyector = () => mesa.actual === escena.id && vivo.ctl.modo === 'mapa' && !vivo.ctl.negro;

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
  const emitir = () => { vivo.emitir(); };
  const emitirArrastre = () => { if (enProyector()) vivo.arrastre(escena); };

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
  function todo() { lienzo(); pintarBarra(); pintarDock(); emitir(); }
  new ResizeObserver(pintarSel).observe(tabEl);

  function pintarBarra() {
    $('[data-escena-nombre]').textContent = escena.nombre || 'Escena';
    $('[data-escena-lista]').innerHTML = mesa.escenas.map(x => `<button type="button" data-ir-escena="${e(x.id)}"${x.id === escena.id ? ' aria-current="true"' : ''}>${e(x.nombre || 'Escena')}</button>`).join('')
      + `<button type="button" data-nueva-escena>${F.icono('mas')}Nueva escena</button>`;
    const viva = enProyector();
    $('[data-vivo]').innerHTML = `<i class="punto${viva ? ' punto--on' : ''}"></i><span>${viva ? 'En el proyector' : 'Proyectar esta escena'}</span>`;
    $('[data-vivo]').setAttribute('aria-pressed', String(viva));
    $('[data-pista]').textContent = viva ? '' : 'Estás preparando: esta escena no está en el proyector.';
    const u = new URL(location.href); u.searchParams.set('escena', escena.id); history.replaceState(null, '', u);
  }
  $('[data-herramientas]').innerHTML = [['fondo', 'mapa', 'Mapa'], ['imagen', 'imagen', 'Imagen'], ['texto', 'texto', 'Texto'], ['punto', 'punto', 'Punto'], ['area', 'area', 'Área'], ['efecto', 'fuego', 'Efecto']]
    .map(([k, ic, t]) => `<button class="herr" type="button" data-anadir="${k}" title="${k === 'fondo' ? 'Cambiar el mapa de fondo' : 'Añadir ' + t.toLowerCase()}">${F.icono(ic)}<span>${t}</span></button>`).join('')
    + `<i class="mbar__sep"></i><button class="herr herr--icono" type="button" data-deshacer title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${F.icono('deshacer')}</button>`;
  $('[data-proyector]').innerHTML = F.icono('mesa') + '<span>Abrir proyector</span>';
  $('[data-panel]').innerHTML = F.icono('panel');
  vivo.alCambiar(pintarBarra);

  /* ---------- Panel lateral ---------- */
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
        <label class="casilla"><input type="checkbox" data-escena-prop="leyenda"${escena.leyenda !== false ? ' checked' : ''}> Mostrar la leyenda de puntos de interés</label>
        <div class="fila-btn">
          <button class="boton boton--fantasma boton--chico" type="button" data-duplicar-escena>${F.icono('duplicar')}Duplicar</button>
          <button class="boton boton--fantasma boton--chico" type="button" data-borrar-escena>${F.icono('borrar')}Borrar escena</button>
        </div>
        <p class="dock__ayuda suave">Añade imágenes, textos, puntos de interés, áreas de conjuro y efectos desde la barra de arriba. Arrastra para mover; usa las esquinas para cambiar el tamaño y el punto superior para girar.</p>
        <p class="dock__ayuda suave"><kbd>Supr</kbd> borra · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplica · <kbd>Ctrl</kbd>+<kbd>Z</kbd> deshace · flechas mueven</p>`;
    }
    const NOMBRE = { imagen: 'Imagen', texto: 'Texto', area: 'Área', efecto: 'Efecto', punto: 'Punto de interés' }[d.tipo];
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
    } else if (d.tipo === 'punto') {
      h += `<label class="prop"><span>Nombre</span><input class="entrada entrada--chica" data-prop="etq" value="${e(d.etq || '')}" maxlength="50" placeholder="Taberna del enano albino"></label>`
        + casilla('visible', d.visible !== false, 'Visible para los jugadores')
        + `<p class="dock__ayuda suave">Los puntos ocultos solo los ves tú: no llegan al proyector ni cuentan en la numeración.</p>`;
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

  function pintarDock() {
    $('[data-dock-cuerpo]').innerHTML = panelElemento();
    $('[data-dock-cuerpo]').querySelectorAll('.muestra').forEach(b => { b.style.background = T.COLOR[b.dataset.color.split(':')[1]]; });
  }

  /* ---------- Añadir ---------- */
  const base = (tipo, extra) => ({ id: uid('el'), tipo, x: 50, y: 50, w: 20, h: 20 * R, rot: 0, op: 1, ...extra });
  function anadir(d) { recordar(); escena.elementos.push(d); sel = d.id; todo(); programar(); }
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
    if (k === 'punto') return anadir(base('punto', { w: 3.4, h: 0, etq: '', visible: true }));
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
      if (sel !== nodo.dataset.el) { sel = nodo.dataset.el; pintarSel(); pintarDock(); }
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
          if (d.tipo === 'punto') d.w = limitar(d.w, 1.8, 9);
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
    if (ds.irEscena) { escena = mesa.escenas.find(x => x.id === ds.irEscena) || escena; sel = null; hist = []; listaEsc.hidden = true; todo(); programar(); }
    else if ('nuevaEscena' in ds) { escena = escenaNueva('Escena ' + (mesa.escenas.length + 1)); mesa.escenas.push(escena); sel = null; hist = []; listaEsc.hidden = true; todo(); programar(); }
    else if (ds.anadir) anadirTipo(ds.anadir);
    else if ('deshacer' in ds) deshacer();
    else if ('vivo' in ds) { if (!enProyector()) { mesa.actual = escena.id; vivo.poner({ modo: 'mapa', negro: false }); pintarBarra(); programar(); } }
    else if ('proyector' in ds) vivo.abrirProyector();
    else if ('panel' in ds) { const dock = $('[data-dock]'); dock.hidden = !dock.hidden; t.setAttribute('aria-pressed', String(!dock.hidden)); requestAnimationFrame(pintarSel); }
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
    } else if (ds.escenaProp) { escena[ds.escenaProp] = t.type === 'checkbox' ? t.checked : t.value; lienzo(); pintarBarra(); emitir(); programar(); }
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
      mesa.escenas.push(c); escena = c; sel = null; hist = []; todo(); programar();
    } else if ('borrarEscena' in ds) {
      if (mesa.escenas.length < 2) return F.toast('Es la única escena: no se puede borrar.');
      if (!confirm(`¿Borrar la escena «${escena.nombre}»? No se puede deshacer.`)) return;
      const eraActual = mesa.actual === escena.id;
      mesa.escenas = mesa.escenas.filter(x => x !== escena); escena = mesa.escenas[0]; if (eraActual) mesa.actual = escena.id; sel = null; hist = []; todo(); programar();
    }
  });

  todo();
  marca('');
  if (!escena.fondo && !escena.elementos.length) $('[data-pista]').textContent = 'Empieza subiendo un mapa con «Mapa» y abre el proyector en la otra pantalla.';
})();
