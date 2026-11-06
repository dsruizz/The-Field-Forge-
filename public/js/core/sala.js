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

  /* ---------- Interfaz: botón en la barra, panel y avisos ---------- */
  function boton() {
    const ctl = $('.topbar .projctl'); if (!ctl || $('[data-sala]', ctl)) return;
    const b = document.createElement('button');
    b.className = 'btn btn--sm btn--ghost salabtn'; b.dataset.sala = '';
    b.innerHTML = '<span class="salabtn__dot" aria-hidden="true"></span>Sala<span class="salabtn__n" hidden></span>';
    b.onclick = panel;
    ctl.prepend(b);
    const pintar = () => {
      const n = vista ? vista.solicitudes.filter(s => s.estado === 'pendiente').length : 0;
      const badge = $('.salabtn__n', b); badge.hidden = !n; badge.textContent = n;
      b.classList.toggle('is-live', !!(cfg && conectado));
      b.title = cfg ? `Sala ${cfg.codigo} · ${conectado ? 'conectada' : 'sin conexión'}` : 'Crear una sala para los jugadores';
      b.setAttribute('aria-label', `Sala de jugadores${n ? `, ${n} peticiones pendientes` : ''}`);
    };
    subs.add(pintar); pintar();
  }

  // Avisos de peticiones flotando sobre cualquier página del DM.
  function dock() {
    let el = $('.saladock');
    if (!el) { el = document.createElement('aside'); el.className = 'saladock'; el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-label', 'Peticiones de los jugadores'); document.body.appendChild(el); }
    const pintar = () => {
      const pend = vista ? vista.solicitudes.filter(s => s.estado === 'pendiente') : [];
      el.innerHTML = pend.map(s => {
        const f = vista.fichas[s.pjId] || {};
        return `<div class="saladock__card" data-sol="${s.id}">
          <span class="saladock__k">${s.tipo === 'poder' ? 'Poder' : s.nivel ? 'Conjuro · nivel ' + s.nivel : 'Truco'}</span>
          <p><b>${esc(f.nombre || '?')}</b> quiere lanzar <b>${esc(s.nombre)}</b></p>
          <div class="saladock__act"><button class="btn btn--sm" data-ok>Acierta</button><button class="btn btn--sm btn--danger" data-ko>Falla</button></div>
        </div>`;
      }).join('');
      if (TFF.gsapOk()) $$('.saladock__card:not(.is-in)', el).forEach(c => { c.classList.add('is-in'); gsap.from(c, { x: -30, opacity: 0, rotate: -2, duration: .35, ease: 'back.out(2)' }); });
      else $$('.saladock__card', el).forEach(c => c.classList.add('is-in'));
    };
    el.onclick = e => {
      const card = e.target.closest('[data-sol]'); if (!card) return;
      if (e.target.closest('[data-ok]')) resolver(card.dataset.sol, true);
      if (e.target.closest('[data-ko]')) resolver(card.dataset.sol, false);
    };
    subs.add(pintar); pintar();
  }
  function avisoSolicitud(s) {
    const f = vista.fichas[s.pjId] || {};
    if (document.hidden) document.title = '● ' + document.title.replace(/^● /, '');
    ui.toast(`${f.nombre || 'Un jugador'} quiere lanzar ${s.nombre}`);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = document.title.replace(/^● /, ''); });

  function qrSVG(texto) {
    if (!window.qrcode) return '';
    const q = qrcode(0, 'M'); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'Código QR para entrar a la sala' });
  }

  function panel() {
    const m = ui.modal({ title: 'Sala de jugadores', wide: true, className: 'modal--sala' });
    const pintar = () => { if (!document.body.contains(m.el)) { subs.delete(pintar); return; } m.body.innerHTML = cfg ? htmlSala() : htmlSinSala(); };
    subs.add(pintar); pintar();

    m.body.addEventListener('click', async e => {
      const t = e.target;
      try {
        if (t.closest('[data-crear]')) { t.closest('button').disabled = true; await crear(); }
        if (t.closest('[data-copiar]')) { await navigator.clipboard.writeText(t.closest('[data-copiar]').dataset.copiar); ui.toast('Copiado.'); }
        if (t.closest('[data-descanso]')) { const tipo = t.closest('[data-descanso]').dataset.descanso; await dm({ accion: 'descanso', tipo }); ui.toast(tipo === 'largo' ? 'Descanso largo: vida y espacios al máximo.' : 'Descanso corto: pactos y poderes recargados.'); }
        if (t.closest('[data-expulsar]')) { const id = t.closest('[data-expulsar]').dataset.expulsar; if (await ui.confirmar('¿Sacar a este jugador de la sala? Podrá volver a entrar con su nombre.', { ok: 'Sacar' })) await dm({ accion: 'expulsar', jugadorId: id }); }
        if (t.closest('[data-sol-ok]')) await resolver(t.closest('[data-sol-ok]').dataset.solOk, true);
        if (t.closest('[data-sol-ko]')) await resolver(t.closest('[data-sol-ko]').dataset.solKo, false);
        if (t.closest('[data-recargar]')) { const r = t.closest('[data-recargar]').dataset; await dm({ accion: 'recargar', pjId: r.recargar, nivel: r.nivel ? +r.nivel : undefined, poder: r.poder || undefined }); }
        if (t.closest('[data-reenviar]')) { enviado = {}; await enviarFichas(); ui.toast('Fichas enviadas.'); }
        if (t.closest('[data-olvidar]') && await ui.confirmar('Este navegador dejará de controlar la sala. La sala y sus datos siguen en el servidor; puedes volver con el código y la clave de DM.', { ok: 'Desconectar' })) olvidar();
      } catch (err) { ui.toast(err.message, 'error'); }
    });
    m.body.addEventListener('change', async e => {
      const t = e.target;
      try {
        if (t.matches('[data-asignar]')) await dm({ accion: 'asignar', jugadorId: t.dataset.asignar, pjId: t.value || null });
        if (t.matches('[data-libre]')) await dm({ accion: 'libre', valor: t.checked });
      } catch (err) { ui.toast(err.message, 'error'); }
    });
    m.body.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try { await unirseComoDM(fd.get('codigo'), fd.get('clave')); } catch (err) { ui.toast(err.message, 'error'); }
    });
  }

  function htmlSinSala() {
    return `<div class="sala">
      <p class="eyebrow">Sala de jugadores</p>
      <h2 class="sala__h">Que cada jugador lleve su ficha en el móvil</h2>
      <p class="sala__lead">Al crear la sala tendrás un código y un QR. Los jugadores entran con su nombre, tú les asignas su PJ y desde aquí desbloqueas cada conjuro cuando aciertan la tirada.</p>
      <div class="row-actions" style="justify-content:flex-start"><button class="btn btn--yellow" data-crear>Crear sala para ${esc(S.state.campana.titulo)}</button></div>
      <details class="sala__alt"><summary>Ya tengo una sala (otro equipo del DM)</summary>
        <form class="sala__form">
          <label class="field"><span>Código</span><input name="codigo" required autocomplete="off" maxlength="8" style="text-transform:uppercase"></label>
          <label class="field"><span>Clave de DM</span><input name="clave" required autocomplete="off"></label>
          <button class="btn btn--sm">Conectar</button>
        </form>
      </details>
    </div>`;
  }

  // Espacios y poderes de un PJ: cada recurso gastado se puede recargar con un clic.
  function recursos(f) {
    const esp = (f.conj && f.conj.espacios) || {};
    const u = f.usados || {};
    const partes = Object.keys(esp).map(k => {
      const gast = u[k] || 0;
      const pips = Array.from({ length: esp[k] }, (_, i) => `<i class="${i < esp[k] - gast ? 'is-full' : ''}"></i>`).join('');
      return `<button class="pips" ${gast ? `data-recargar="${f.id}" data-nivel="${k}" title="Recargar un espacio de nivel ${k}"` : `disabled title="Nivel ${k}: completo"`}><small>N${k}</small>${pips}</button>`;
    });
    (f.poderes || []).forEach(p => {
      const usado = (f.usos || {})[p.n] >= (p.max || 1);
      partes.push(`<button class="pips" ${usado ? `data-recargar="${f.id}" data-poder="${esc(p.n)}" title="Recargar ${esc(p.n)}"` : `disabled title="${esc(p.n)}: disponible"`}><small>${esc(p.n.split(' ').pop())}</small><i class="${usado ? '' : 'is-full'}"></i></button>`);
    });
    if (!partes.length) return '';
    const algo = Object.keys(u).some(k => u[k]) || Object.keys(f.usos || {}).length;
    return partes.join('') + (algo ? `<button class="btn btn--sm btn--ghost" data-recargar="${f.id}" title="Recargar todo">↻</button>` : '');
  }

  function htmlSala() {
    const v = vista;
    const url = enlace();
    const opciones = sel => `<option value="">Sin personaje</option>` + pjs().map(f => `<option value="${f.id}" ${sel === f.id ? 'selected' : ''}>${esc(f.nombre)}</option>`).join('');
    const pend = v ? v.solicitudes : [];
    return `<div class="sala sala--on">
      <div class="sala__top">
        <div class="sala__qr">${qrSVG(url)}</div>
        <div class="sala__id">
          <p class="eyebrow">Sala ${conectado ? '<span class="sala__live">● en vivo</span>' : '<span class="sala__off">● sin conexión</span>'}</p>
          <p class="sala__code" aria-label="Código de sala">${esc(cfg.codigo)}</p>
          <p class="sala__lead">Escanea el QR o entra en <b>${esc(url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</b> con el código.</p>
          <div class="sala__btns">
            <button class="btn btn--sm" data-copiar="${esc(url)}">Copiar enlace</button>
            <button class="btn btn--sm btn--ghost" data-copiar="${esc(cfg.dmToken)}" title="Para controlar la sala desde otro equipo">Copiar clave de DM</button>
          </div>
        </div>
      </div>

      ${pend.length ? `<section class="sala__sec"><h3>Peticiones</h3>${pend.map(s => {
        const f = v.fichas[s.pjId] || {};
        return `<div class="sala__sol ${s.estado === 'permitida' ? 'is-ok' : ''}"><span><b>${esc(f.nombre)}</b> · ${esc(s.nombre)}${s.nivel ? ` <small>nivel ${s.nivel}</small>` : ''}</span>
          ${s.estado === 'pendiente' ? `<span><button class="btn btn--sm" data-sol-ok="${s.id}">Acierta</button> <button class="btn btn--sm btn--danger" data-sol-ko="${s.id}">Falla</button></span>` : '<small>Desbloqueado · esperando a que lance</small>'}</div>`;
      }).join('')}</section>` : ''}

      <section class="sala__sec">
        <h3>Jugadores</h3>
        ${v && v.jugadores.length ? `<div class="sala__jug">${v.jugadores.map(j => {
          const f = j.pjId && v.fichas[j.pjId];
          return `<div class="sala__row">
            <span class="sala__who"><i class="${j.conectado ? 'is-on' : ''}" title="${j.conectado ? 'Conectado' : 'Desconectado'}"></i>${esc(j.nombre)}</span>
            <select data-asignar="${j.id}" aria-label="Personaje de ${esc(j.nombre)}">${opciones(j.pjId)}</select>
            <span class="sala__hp">${f ? `${f.pg}/${f.pgMax} PG` : ''}</span>
            <span class="sala__slots">${f ? recursos(f) : ''}</span>
            <button class="btn btn--sm btn--ghost btn--icon" data-expulsar="${j.id}" aria-label="Sacar a ${esc(j.nombre)}">×</button>
          </div>`;
        }).join('')}</div>` : '<p class="src">Todavía no ha entrado nadie.</p>'}
      </section>

      <section class="sala__sec sala__ctl">
        <label class="sala__switch"><input type="checkbox" data-libre ${v && v.sala.libre ? 'checked' : ''}><span>Lanzamiento libre <small>Sin pedir permiso. Útil fuera de combate.</small></span></label>
        <div class="sala__btns">
          <button class="btn btn--sm btn--ghost" data-descanso="corto">Descanso corto</button>
          <button class="btn btn--sm btn--ghost" data-descanso="largo">Descanso largo</button>
          <button class="btn btn--sm btn--ghost" data-reenviar>Reenviar fichas</button>
          <button class="btn btn--sm btn--ghost" data-olvidar>Desconectar</button>
        </div>
      </section>

      ${v && v.registro.length ? `<section class="sala__sec"><h3>Registro</h3><ol class="sala__log">${v.registro.slice(-8).reverse().map(r => `<li><time>${new Date(r.t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</time>${esc(r.texto)}</li>`).join('')}</ol></section>` : ''}
    </div>`;
  }

  function init() { boton(); dock(); if (cfg) conectar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  TFF.sala = { get cfg() { return cfg; }, get vista() { return vista; }, panel, enviarFichas };
})();
