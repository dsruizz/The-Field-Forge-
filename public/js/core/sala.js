/* The Field Forge — sala de juego (lado del DM).
   Conecta las páginas del DM con el servidor de salas: crea la sala, sube las fichas
   de los PJ, recibe a los jugadores y sus peticiones de lanzar, y mantiene la vida y
   los espacios de conjuro sincronizados en los dos sentidos.

   Reparto de datos: la ficha completa sigue viviendo aquí (navegador del DM). En el
   servidor hay una copia de los PJ con lo que el jugador necesita ver. La vida y los
   espacios gastados se pueden cambiar desde ambos lados; el resto solo desde aquí. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const { $, $$, esc } = TFF;
  const ui = TFF.ui, S = TFF.store;
  const KEY = 'tff.sala';
  const IMGKEY = 'tff.sala.imgs';

  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let cfg = leer(KEY, null);         // { codigo, dmToken, nombre }
  let vista = null;                   // último estado recibido del servidor
  let es = null;                      // EventSource
  let enviado = {};                   // pjId -> último payload confirmado (para enviar solo diferencias)
  let conectado = false;
  const subs = new Set();
  const emit = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

  /* ---------- API ---------- */
  async function api(ruta, { method = 'GET', body, auth = true } = {}) {
    const r = await fetch('/api/salas' + ruta, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, auth && cfg ? { Authorization: 'Bearer ' + cfg.dmToken } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      const err = new Error(data.error || (r.status === 404 || r.status === 502 ? 'El servidor de salas no responde. ¿Está levantado el servicio api?' : 'Error ' + r.status));
      err.status = r.status; throw err;
    }
    return data;
  }
  const dm = body => api('/' + cfg.codigo + '/dm', { method: 'POST', body });

  /* ---------- Fichas: de la ficha local a lo que ve el jugador ---------- */
  const pjs = () => S.state.personajes.filter(f => f.tipo === 'pj');
  const imgs = leer(IMGKEY, {});

  async function subirImagen(ref) {
    if (!ref) return '';
    if (!ref.startsWith('idb:')) return ref;
    if (imgs[ref]) return imgs[ref];
    const blob = await TFF.img.blob(ref); if (!blob) return '';
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const dataUrl = c.toDataURL('image/webp', 0.86);
    const { url } = await api('/' + cfg.codigo + '/imagen', { method: 'POST', body: { dataUrl } });
    imgs[ref] = url; escribir(IMGKEY, imgs);
    return url;
  }

  function poderes(f) {
    // Usos limitados que se recargan con descanso (p. ej. el arma de aliento).
    return (f.ataques || []).filter(a => /por descanso/i.test(a.nota || '')).map(a => ({ n: a.n, d: [a.d, a.t, a.nota].filter(Boolean).join(' · '), max: 1, recarga: 'corto' }));
  }

  async function payload(f) {
    const R = TFF.reglas;
    const c = f.conj;
    const info = {};
    if (c) [...(c.trucos || []), ...(c.lista || [])].forEach(n => { const x = R.CONJURO[n]; info[n] = x ? { l: x.l, d: x.d } : { l: 0, d: '' }; });
    return {
      id: f.id, nombre: f.nombre, img: await subirImagen(f.img).catch(() => ''),
      raza: f.raza, clase: f.clase, subclase: f.subclase || '', nivel: f.nivel, ca: f.ca, pg: f.pg, pgMax: f.pgMax,
      vel: f.vel, iniciativa: f.iniciativa ?? 0, comp: f.comp, atr: f.atr, percepcionPasiva: f.percepcionPasiva ?? null, estado: f.estado || 'activo',
      ataques: (f.ataques || []).map(a => ({ n: a.n, b: a.b, d: a.d, t: a.t || '', r: a.r || '', nota: a.nota || '' })),
      rasgos: (f.rasgos || []).map(r => ({ n: r.n, d: String(r.d || '').slice(0, 600) })),
      conj: c ? { c: c.c, cd: c.cd, atk: c.atk, espacios: c.espacios || {}, pacto: !!c.pacto, trucos: c.trucos || [], lista: c.lista || [], info } : null,
      usados: (c && c.usados) || {},
      poderes: poderes(f)
    };
  }
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Envía solo los campos que cambiaron desde el último envío.
  let cola = null;
  function programarEnvio() { if (!cfg || !conectado) return; clearTimeout(cola); cola = setTimeout(enviarFichas, 350); }
  async function enviarFichas() {
    if (!cfg) return;
    const lista = [];
    for (const f of pjs()) {
      const p = await payload(f);
      const prev = enviado[f.id];
      if (!prev) { lista.push(p); continue; }
      const dif = { id: f.id }; let hay = false;
      for (const k of Object.keys(p)) if (k !== 'id' && !igual(p[k], prev[k])) { dif[k] = p[k]; hay = true; }
      if (hay) lista.push(dif);
    }
    const ids = new Set(pjs().map(f => f.id));
    const quitar = vista ? Object.keys(vista.fichas).filter(id => !ids.has(id)) : [];
    if (!lista.length && !quitar.length) return;
    try {
      await dm({ accion: 'fichas', fichas: lista, quitar });
      for (const x of lista) enviado[x.id] = Object.assign({}, enviado[x.id], x);
    } catch (e) { ui.toast('No se pudieron enviar las fichas: ' + e.message, 'error'); }
  }

  // Trae del servidor lo que el jugador puede cambiar: vida y espacios gastados.
  function aplicarServidor(primera) {
    if (!vista) return;
    const cambios = [];
    for (const f of pjs()) {
      const sv = vista.fichas[f.id]; if (!sv) continue;
      const local = { pg: f.pg, usados: (f.conj && f.conj.usados) || {} };
      const llega = { pg: sv.pg, usados: sv.usados || {} };
      if (!igual(local.pg, llega.pg) || (f.conj && !igual(local.usados, llega.usados))) cambios.push([f.id, llega]);
      // Lo que ya está en el servidor cuenta como enviado.
      if (primera || !enviado[f.id]) enviado[f.id] = JSON.parse(JSON.stringify(sv));
      else { enviado[f.id].pg = sv.pg; enviado[f.id].usados = sv.usados || {}; }
    }
    if (cambios.length) {
      aplicando = true;
      S.update(st => cambios.forEach(([id, v]) => {
        const f = st.personajes.find(x => x.id === id); if (!f) return;
        f.pg = Math.max(0, Math.min(f.pgMax, v.pg));
        if (f.conj) f.conj.usados = Object.assign({}, v.usados);
      }));
      aplicando = false;
    }
  }
  let aplicando = false;

  /* ---------- Conexión en tiempo real ---------- */
  let avisadas = new Set();
  function conectar() {
    if (!cfg) return;
    if (es) es.close();
    es = new EventSource(`/api/salas/${cfg.codigo}/stream?rol=dm&token=${encodeURIComponent(cfg.dmToken)}`);
    let primera = true;
    es.addEventListener('estado', e => {
      vista = JSON.parse(e.data);
      conectado = true;
      aplicarServidor(primera);
      if (primera) { primera = false; enviarFichas(); }
      vista.solicitudes.forEach(s => { if (s.estado === 'pendiente' && !avisadas.has(s.id)) { avisadas.add(s.id); avisoSolicitud(s); } });
      emit();
    });
    es.addEventListener('efecto', e => {
      const d = JSON.parse(e.data);
      ui.toast(`✦ ${d.pj} lanza ${d.nombre}`);
    });
    es.onerror = async () => {
      conectado = false; emit();
      // Si la sala ya no existe o el token no vale, se olvida.
      try { await api('/' + cfg.codigo, { auth: false }); }
      catch (err) { if (err.status === 404) { ui.toast('La sala ' + cfg.codigo + ' ya no existe en el servidor.', 'error'); olvidar(); } }
    };
  }
  function olvidar() {
    if (es) es.close(); es = null; cfg = null; vista = null; enviado = {}; conectado = false;
    try { localStorage.removeItem(KEY); } catch (e) {}
    emit();
  }

  S.on((k, remoto) => { if (k === 'state' && !aplicando) programarEnvio(); });

  /* ---------- Acciones ---------- */
  async function crear() {
    const r = await api('', { method: 'POST', body: { nombre: S.state.campana.titulo }, auth: false });
    cfg = { codigo: r.codigo, dmToken: r.dmToken, nombre: r.nombre };
    escribir(KEY, cfg); enviado = {};
    conectar();
  }
  async function unirseComoDM(codigo, clave) {
    cfg = { codigo: codigo.trim().toUpperCase(), dmToken: clave.trim() };
    try {
      const r = await api('/' + cfg.codigo, { auth: false });
      cfg.nombre = r.nombre;
      await dm({ accion: 'nombre', nombre: r.nombre });
      escribir(KEY, cfg); enviado = {}; conectar();
    } catch (e) { cfg = null; throw e; }
  }
  const resolver = (id, ok) => dm({ accion: 'resolver', solicitudId: id, ok }).catch(e => ui.toast(e.message, 'error'));
  const enlace = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}jugar.html?sala=${cfg.codigo}`;

  /* ---------- Barra superior: acceso a la Mesa con aviso de peticiones ---------- */
  function boton() {
    const ctl = $('.topbar .projctl'); if (!ctl || $('[data-sala]', ctl)) return;
    const b = document.createElement('a');
    b.href = 'mesa.html'; b.className = 'salabtn'; b.dataset.sala = '';
    b.innerHTML = '<span class="salabtn__dot" aria-hidden="true"></span><span class="salabtn__txt">Sala</span><span class="salabtn__n" hidden></span>';
    ctl.prepend(b);
    const pintar = () => {
      const n = vista ? vista.solicitudes.filter(s => s.estado === 'pendiente').length : 0;
      const badge = $('.salabtn__n', b); badge.hidden = !n; badge.textContent = n;
      b.classList.toggle('is-live', !!(cfg && conectado));
      $('.salabtn__txt', b).textContent = cfg ? cfg.codigo : 'Sala';
      b.title = cfg ? `Sala ${cfg.codigo} · ${conectado ? 'en vivo' : 'sin conexión'}` : 'Sin sala';
      b.setAttribute('aria-label', `Sala de jugadores${n ? `, ${n} peticiones pendientes` : ''}`);
    };
    subs.add(pintar); pintar();
  }

  // Peticiones flotando abajo a la izquierda en cualquier página del DM.
  function dock() {
    let el = $('.saladock');
    if (!el) { el = document.createElement('aside'); el.className = 'saladock'; el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-label', 'Peticiones de los jugadores'); document.body.appendChild(el); }
    const pintar = () => {
      const pend = vista ? vista.solicitudes.filter(s => s.estado === 'pendiente') : [];
      el.innerHTML = pend.map(s => {
        const f = vista.fichas[s.pjId] || {};
        return `<div class="saladock__card" data-sol="${s.id}">
          <span class="saladock__k">${s.tipo === 'poder' ? 'Poder' : s.nivel ? 'Conjuro · nivel ' + s.nivel : 'Truco'}</span>
          <p><b>${esc(f.nombre || '?')}</b> quiere usar <b>${esc(s.nombre)}</b></p>
          <div class="saladock__act"><button class="btn btn--sm" data-ok>Acierta</button><button class="btn btn--sm btn--danger" data-ko>Falla</button></div>
        </div>`;
      }).join('');
      if (TFF.gsapOk()) $$('.saladock__card', el).forEach(c => gsap.from(c, { x: -24, opacity: 0, duration: .3, ease: 'power3.out' }));
    };
    el.onclick = e => {
      const card = e.target.closest('[data-sol]'); if (!card) return;
      if (e.target.closest('[data-ok]')) resolver(card.dataset.sol, true);
      if (e.target.closest('[data-ko]')) resolver(card.dataset.sol, false);
    };
    let ultimo = '';
    subs.add(() => { const k = vista ? vista.solicitudes.filter(s => s.estado === 'pendiente').map(s => s.id).join() : ''; if (k !== ultimo) { ultimo = k; pintar(); } });
    pintar();
  }
  function avisoSolicitud(s) {
    const f = vista.fichas[s.pjId] || {};
    if (document.hidden) document.title = '● ' + document.title.replace(/^● /, '');
    if (!$('.mesa')) ui.toast(`${f.nombre || 'Un jugador'} quiere usar ${s.nombre}`);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = document.title.replace(/^● /, ''); });

  function qrSVG(texto) {
    if (!window.qrcode) return '';
    const q = qrcode(0, 'M'); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'Código QR para entrar a la sala' });
  }

  /* ---------- Página Mesa ---------- */
  // Un tablero tranquilo con una tarjeta por PJ: foto, vida, nivel, recursos y jugador.
  let preview = null; // pjId en vista previa
  let invitarAbierto = false;
  let logAbierto = false;
  function mesa(root) {
    root.innerHTML = '<div class="mesa"><div data-zona="top"></div><div class="mesa__body"><section class="mesa__grid" data-zona="grid" aria-label="Personajes jugadores"></section><aside class="mesa__movil" data-zona="movil" hidden aria-label="Vista del móvil del jugador"></aside></div><div data-zona="log"></div></div>';
    const z = n => $(`[data-zona="${n}"]`, root);
    // El móvil de vista previa va aparte para que el iframe no se recargue con cada cambio.
    const pintarMovil = () => {
      const el = z('movil');
      el.closest('.mesa__body').classList.toggle('has-preview', !!(preview && cfg));
      if (!preview || !cfg) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false;
      el.innerHTML = `<div class="mesa__movilhead"><span>Así lo ve en su móvil</span><button data-cerrar-ver aria-label="Cerrar vista previa">×</button></div>
        <iframe src="jugar.html?sala=${cfg.codigo}&ver=${encodeURIComponent(preview)}" title="Vista del jugador"></iframe>`;
    };
    const pintar = () => {
      const foco = document.activeElement && document.activeElement.closest('[data-keep]') ? document.activeElement.dataset.keep : null;
      z('top').innerHTML = htmlTop();
      z('grid').innerHTML = pjs().map(htmlTarjeta).join('') || '<p class="src">No hay PJ. Créalos en Personajes.</p>';
      z('log').innerHTML = htmlLog();
      TFF.img.hydrate(root);
      $$('[data-foto]', root).forEach(el => ui.dropzone(el, ref => {
        const id = el.dataset.foto;
        S.update(st => { const f = st.personajes.find(x => x.id === id); if (f) f.img = ref; });
        ui.toast('Foto actualizada. Se envía a su móvil.');
      }, { max: 900 }));
      if (foco) $(`[data-keep="${foco}"]`, root)?.focus();
    };
    let t = null;
    const pronto = () => { clearTimeout(t); t = setTimeout(pintar, 30); };
    subs.add(pronto);
    S.on(k => { if (k === 'state') pronto(); });
    pintar();

    root.addEventListener('click', async e => {
      const el = e.target.closest('button, [data-act]'); if (!el) return;
      const d = el.dataset;
      try {
        if ('crear' in d) { el.disabled = true; await crear(); invitarAbierto = true; }
        if ('invitar' in d) { invitarAbierto = !invitarAbierto; const p = $('.mesa__invitar', root); if (p) p.hidden = !invitarAbierto; }
        if ('copiar' in d) { await navigator.clipboard.writeText(d.copiar); ui.toast('Copiado.'); }
        if ('descanso' in d) { await dm({ accion: 'descanso', tipo: d.descanso }); ui.toast(d.descanso === 'largo' ? 'Descanso largo: vida y espacios al máximo.' : 'Descanso corto: pactos y poderes recargados.'); }
        if ('solOk' in d) await resolver(d.solOk, true);
        if ('solKo' in d) await resolver(d.solKo, false);
        if ('pg' in d) { const n = +d.pg; S.update(st => { const f = st.personajes.find(x => x.id === d.pj); if (f) f.pg = Math.max(0, Math.min(f.pgMax, f.pg + n)); }); }
        if ('lvl' in d) {
          const n = +d.lvl;
          S.update(st => { const f = st.personajes.find(x => x.id === d.pj); if (!f) return; f.nivel = Math.max(1, Math.min(20, (f.nivel || 1) + n)); if (f.gen) TFF.npc.recalcular(f); });
          const f = S.find('personajes', d.pj); ui.toast(`${f.nombre}: nivel ${f.nivel} · ${f.pgMax} PG`);
        }
        if ('recargar' in d) await dm({ accion: 'recargar', pjId: d.recargar, nivel: d.nivel ? +d.nivel : undefined, poder: d.poder || undefined });
        if ('ver' in d) { preview = preview === d.ver ? null : d.ver; pintar(); pintarMovil(); }
        if ('cerrarVer' in d) { preview = null; pintar(); pintarMovil(); }
        if ('expulsar' in d && await ui.confirmar('¿Sacar a este jugador de la sala? Podrá volver a entrar con su nombre.', { ok: 'Sacar' })) await dm({ accion: 'expulsar', jugadorId: d.expulsar });
        if ('olvidar' in d && await ui.confirmar('Este navegador dejará de controlar la sala. La sala sigue en el servidor; puedes volver con el código y la clave de DM.', { ok: 'Desconectar' })) olvidar();
      } catch (err) { ui.toast(err.message, 'error'); }
    });
    root.addEventListener('toggle', e => { if (e.target.matches('.mesa__log')) logAbierto = e.target.open; }, true);
    root.addEventListener('change', async e => {
      const t = e.target;
      try {
        if (t.matches('[data-asignar]')) {
          // El select de una tarjeta asigna un jugador a ese PJ.
          const pjId = t.dataset.asignar, jugadorId = t.value;
          const antes = vista.jugadores.find(j => j.pjId === pjId);
          if (antes && antes.id !== jugadorId) await dm({ accion: 'asignar', jugadorId: antes.id, pjId: null });
          if (jugadorId) await dm({ accion: 'asignar', jugadorId, pjId });
        }
        if (t.matches('[data-libre]')) await dm({ accion: 'libre', valor: t.checked });
      } catch (err) { ui.toast(err.message, 'error'); }
    });
    root.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try { await unirseComoDM(fd.get('codigo'), fd.get('clave')); } catch (err) { ui.toast(err.message, 'error'); }
    });
  }

  function htmlRecursos(f, sv) {
    const esp = (f.conj && f.conj.espacios) || {};
    const u = (f.conj && f.conj.usados) || {};
    const usos = (sv && sv.usos) || {};
    const partes = Object.keys(esp).map(k => {
      const gast = u[k] || 0;
      const pips = Array.from({ length: esp[k] }, (_, i) => `<i class="${i < esp[k] - gast ? 'is-full' : ''}"></i>`).join('');
      return `<button class="pips" ${gast && sv ? `data-recargar="${f.id}" data-nivel="${k}" title="Recargar un espacio de nivel ${k}"` : `disabled title="Nivel ${k}"`}><small>Nv ${k}</small>${pips}</button>`;
    });
    ((sv && sv.poderes) || []).forEach(p => {
      const usado = (usos[p.n] || 0) >= (p.max || 1);
      partes.push(`<button class="pips" ${usado ? `data-recargar="${f.id}" data-poder="${esc(p.n)}" title="Recargar ${esc(p.n)}"` : `disabled title="${esc(p.n)}: disponible"`}><small>${esc(p.n.replace(/^Arma de /, ''))}</small><i class="${usado ? '' : 'is-full'}"></i></button>`);
    });
    return partes.join('');
  }

  function htmlTarjeta(f) {
    const v = vista;
    const sv = v && v.fichas[f.id];
    const jug = v ? v.jugadores.find(j => j.pjId === f.id) : null;
    const p = f.pgMax ? Math.max(0, Math.min(100, f.pg / f.pgMax * 100)) : 0;
    const tono = p <= 25 ? 'is-low' : p <= 50 ? 'is-mid' : '';
    const pend = v ? v.solicitudes.filter(s => s.pjId === f.id) : [];
    const libres = v ? v.jugadores.filter(j => !j.pjId || j.pjId === f.id) : [];
    return `<article class="pjc ${f.estado !== 'activo' ? 'is-out' : ''} ${preview === f.id ? 'is-viendo' : ''}">
      <div class="pjc__head">
        <div class="pjc__foto" data-dz-click data-foto="${f.id}" title="Arrastra, pega o haz clic para cambiar la foto" tabindex="0" role="button" aria-label="Cambiar la foto de ${esc(f.nombre)}">
          ${f.img ? `<img data-img="${esc(f.img)}" alt="">` : `<span>${esc((f.nombre || '?')[0])}</span>`}
          <em>Foto</em>
        </div>
        <div class="pjc__id">
          <h2>${esc(f.nombre)}</h2>
          <p>${esc([f.raza, f.clase].filter(Boolean).join(' · '))}</p>
          <div class="pjc__lvl"><button data-lvl="-1" data-pj="${f.id}" aria-label="Bajar nivel">−</button><span>Nivel <b>${f.nivel}</b></span><button data-lvl="1" data-pj="${f.id}" aria-label="Subir nivel">+</button></div>
        </div>
      </div>
      <div class="pjc__vida ${tono}">
        <div class="pjc__pg"><b>${f.pg}</b><span>/ ${f.pgMax} PG</span><small>CA ${f.ca}${f.conj ? ` · CD ${f.conj.cd}` : ''}</small></div>
        <div class="pjc__bar"><i style="width:${p}%"></i></div>
        <div class="pjc__pgb">${[-5, -1, 1, 5].map(n => `<button data-pg="${n}" data-pj="${f.id}" class="${n < 0 ? 'is-dmg' : 'is-cura'}" aria-label="${n < 0 ? 'Restar' : 'Sumar'} ${Math.abs(n)} PG a ${esc(f.nombre)}">${n > 0 ? '+' : '−'}${Math.abs(n)}</button>`).join('')}</div>
      </div>
      ${htmlRecursos(f, sv) ? `<div class="pjc__rec">${htmlRecursos(f, sv)}</div>` : ''}
      ${pend.map(s => `<div class="pjc__sol ${s.estado === 'permitida' ? 'is-ok' : ''}"><span>${esc(s.nombre)}${s.nivel ? ` · nv ${s.nivel}` : ''}</span>${s.estado === 'pendiente' ? `<span><button class="btn btn--sm" data-sol-ok="${s.id}">Acierta</button><button class="btn btn--sm btn--danger" data-sol-ko="${s.id}">Falla</button></span>` : '<small>Desbloqueado</small>'}</div>`).join('')}
      <footer class="pjc__foot">
        ${cfg ? `<label class="pjc__jug"><i class="${jug && jug.conectado ? 'is-on' : ''}" title="${jug ? (jug.conectado ? 'Conectado' : 'Desconectado') : 'Sin jugador'}"></i>
          <select data-asignar="${f.id}" data-keep="asig-${f.id}" aria-label="Jugador de ${esc(f.nombre)}"><option value="">Sin jugador</option>${libres.map(j => `<option value="${j.id}" ${jug && jug.id === j.id ? 'selected' : ''}>${esc(j.nombre)}</option>`).join('')}</select></label>
          ${sv ? `<button class="pjc__ver" data-ver="${f.id}">${preview === f.id ? 'Cerrar vista' : 'Ver su móvil'}</button>` : ''}` : '<span class="pjc__nota">Crea la sala para asignar jugador</span>'}
      </footer>
    </article>`;
  }

  function htmlTop() {
    const v = vista;
    const espera = v ? v.jugadores.filter(j => !j.pjId) : [];
    const url = cfg ? enlace() : '';
    return `<header class="mesa__head">
        <div>
          <p class="mesa__k">${esc(S.state.campana.titulo)}</p>
          <h1>Mesa</h1>
        </div>
        ${cfg ? `<div class="mesa__ctl">
          <button class="mesa__sala" data-invitar aria-expanded="${invitarAbierto}" aria-label="Invitar jugadores"><i class="${conectado ? 'is-on' : ''}"></i><span>${esc(cfg.codigo)}</span><small>Invitar</small></button>
          <label class="mesa__libre"><input type="checkbox" data-libre ${v && v.sala.libre ? 'checked' : ''}><span>Lanzamiento libre</span></label>
          <button class="btn btn--sm btn--ghost" data-descanso="corto">Descanso corto</button>
          <button class="btn btn--sm btn--ghost" data-descanso="largo">Descanso largo</button>
        </div>` : `<div class="mesa__ctl"><button class="btn btn--yellow" data-crear>Crear sala para jugadores</button></div>`}
      </header>
      ${cfg ? `<div class="mesa__invitar" ${invitarAbierto ? '' : 'hidden'}>
        <div class="mesa__qr">${qrSVG(url)}</div>
        <div>
          <p class="mesa__k">Código de sala</p><p class="mesa__code">${esc(cfg.codigo)}</p>
          <p class="mesa__url">${esc(url.replace(/^https?:\/\//, ''))}</p>
          <div class="mesa__btns"><button class="btn btn--sm" data-copiar="${esc(url)}">Copiar enlace</button><button class="btn btn--sm btn--ghost" data-copiar="${esc(cfg.dmToken)}">Copiar clave de DM</button><button class="btn btn--sm btn--ghost" data-olvidar>Desconectar</button></div>
        </div>
      </div>` : `<p class="mesa__intro">Crea una sala y tus jugadores entran desde el móvil con un QR. Les asignas su PJ aquí, y desde aquí controlas su vida, sus recursos y lo que pueden lanzar.</p>
      <details class="mesa__alt"><summary>Ya tengo una sala</summary>
        <form class="mesa__form"><label class="field"><span>Código</span><input name="codigo" required maxlength="8" autocomplete="off"></label><label class="field"><span>Clave de DM</span><input name="clave" required autocomplete="off"></label><button class="btn btn--sm">Conectar</button></form>
      </details>`}
      ${espera.length ? `<div class="mesa__espera"><span>Esperando personaje</span>${espera.map(j => `<span class="mesa__chip"><i class="${j.conectado ? 'is-on' : ''}"></i>${esc(j.nombre)}<button data-expulsar="${j.id}" aria-label="Sacar a ${esc(j.nombre)}">×</button></span>`).join('')}<small>Asígnalos desde la tarjeta de cada PJ.</small></div>` : ''}`;
  }
  function htmlLog() {
    const v = vista;
    return v && v.registro.length ? `<details class="mesa__log" ${logAbierto ? 'open' : ''}><summary>Registro de la sala</summary><ol>${v.registro.slice(-12).reverse().map(r => `<li><time>${new Date(r.t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</time>${esc(r.texto)}</li>`).join('')}</ol></details>` : '';
  }

  function init() {
    boton(); dock();
    const root = $('#mesa'); if (root) mesa(root);
    if (cfg) conectar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  TFF.sala = { get cfg() { return cfg; }, get vista() { return vista; }, enviarFichas };
})();
