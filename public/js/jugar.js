/* The Field Forge — pantalla del jugador (móvil).
   Entra a la sala con el código y su nombre, espera a que el DM le asigne un PJ y
   desde aquí ve su vida, sus conjuros y espacios, pide lanzar, lanza cuando el DM
   lo desbloquea y escribe sus notas. Todo se guarda en el servidor de la sala. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = () => window.gsap && !reduce();
  const signo = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const mod = v => Math.floor((v - 10) / 2);
  const KEY = 'tff.jugador';
  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const app = $('#app');
  const qs = new URLSearchParams(location.search);
  let ses = leer(KEY, null);           // { codigo, token, jugadorId, nombre }
  const codigoURL = (qs.get('sala') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (ses && codigoURL && ses.codigo !== codigoURL) ses = null; // otro QR, otra sala

  let v = null;                         // vista del servidor
  let es = null;
  let tab = leer('tff.jugador.tab', 'poderes');
  let fijados = leer('tff.jugador.fijados', {});
  const enfriando = new Map();          // nombre -> fin (ms) para trucos ya lanzados
  const ENFRIA = 6000;                  // un asalto de 6 segundos

  /* ---------- API ---------- */
  async function api(ruta, body) {
    const r = await fetch(`/api/salas/${ses.codigo}${ruta}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ses.token }, body: JSON.stringify(body)
    });
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (r.status === 401) { salir('Tu sesión expiró. Vuelve a entrar con tu nombre.'); throw new Error(d.error); }
    if (!r.ok) throw new Error(d.error || 'No se pudo conectar con la sala.');
    return d;
  }
  const accion = body => api('/jugador', body);

  /* ---------- Aviso breve ---------- */
  function toast(msg, tipo = 'ok') {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast toast--' + tipo; t.textContent = msg; box.appendChild(t);
    if (anim()) gsap.from(t, { y: 20, opacity: 0, duration: .3, ease: 'back.out(2)' });
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, tipo === 'error' ? 5000 : 2600);
  }

  /* ---------- Entrar ---------- */
  function pantallaEntrar(msg = '') {
    if (es) { es.close(); es = null; }
    app.className = 'app app--entrar';
    app.innerHTML = `<section class="entrar">
      <span class="entrar__logo" aria-hidden="true"></span>
      <p class="kicker">The Field Forge</p>
      <h1 class="entrar__h">A la mesa</h1>
      <p class="entrar__lead">${codigoURL ? 'Escribe tu nombre para entrar. El DM te asignará tu personaje.' : 'Escribe el código de la sala que te dio el DM y tu nombre.'}</p>
      ${msg ? `<p class="entrar__msg" role="alert">${esc(msg)}</p>` : ''}
      <form class="entrar__form" novalidate>
        <label class="campo" ${codigoURL ? 'hidden' : ''}><span>Código de sala</span><input name="codigo" value="${esc(codigoURL)}" autocomplete="off" autocapitalize="characters" maxlength="8" required inputmode="text"></label>
        <label class="campo"><span>Tu nombre</span><input name="nombre" value="${esc(leer('tff.jugador.nombre', ''))}" autocomplete="nickname" maxlength="40" required></label>
        <button class="b b--grande">Entrar a la sala</button>
      </form>
    </section>`;
    const form = $('form', app);
    (codigoURL ? form.nombre : form.codigo).focus();
    form.onsubmit = async e => {
      e.preventDefault();
      const codigo = (form.codigo.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const nombre = form.nombre.value.trim();
      if (!codigo || !nombre) { toast(!codigo ? 'Falta el código de sala.' : 'Falta tu nombre.', 'error'); return; }
      const btn = $('button', form); btn.disabled = true; btn.textContent = 'Entrando…';
      try {
        const r = await fetch(`/api/salas/${codigo}/unirse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'No se pudo entrar.');
        ses = { codigo, token: d.token, jugadorId: d.jugadorId, nombre: d.nombre };
        escribir(KEY, ses); escribir('tff.jugador.nombre', nombre);
        if (!codigoURL) history.replaceState(null, '', `?sala=${codigo}`);
        conectar();
      } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Entrar a la sala'; }
    };
  }
  function salir(msg) { try { localStorage.removeItem(KEY); } catch (e) {} ses = null; v = null; pantallaEntrar(msg); }

  /* ---------- Tiempo real ---------- */
  function conectar() {
    if (es) es.close();
    pintarCargando();
    es = new EventSource(`/api/salas/${ses.codigo}/stream?token=${encodeURIComponent(ses.token)}`);
    es.addEventListener('estado', e => { const prev = v; v = JSON.parse(e.data); render(prev); });
    es.addEventListener('fuera', () => salir('El DM te sacó de la sala. Puedes volver a entrar con tu nombre.'));
    es.addEventListener('resuelta', e => {
      const d = JSON.parse(e.data); if (d.jugadorId !== ses.jugadorId) return;
      if (d.ok) { vibrar([40, 40, 80]); desbloqueo(d.nombre); }
      else { vibrar([160]); fallo(d.nombre); }
    });
    es.addEventListener('efecto', e => {
      const d = JSON.parse(e.data);
      if (v && v.pj && d.pjId === v.pj.id) return; // el propio ya se vio al lanzar
      toast(`${d.pj} lanza ${d.nombre}`);
    });
    es.addEventListener('descanso', e => { const d = JSON.parse(e.data); toast(d.tipo === 'largo' ? 'Descanso largo: vida y espacios recuperados.' : 'Descanso corto.'); });
    es.addEventListener('recarga', e => { const d = JSON.parse(e.data); if (v && v.pj && d.pjId === v.pj.id) { toast('El DM recargó tus recursos.'); vibrar([30]); } });
    es.onerror = () => { $('.hud__dot')?.classList.remove('is-on'); };
    es.onopen = () => { $('.hud__dot')?.classList.add('is-on'); };
  }
  function pintarCargando() { app.className = 'app'; app.innerHTML = '<p class="cargando">Conectando con la sala…</p>'; }

  /* ---------- Render ---------- */
  function render(prev) {
    if (!v) return;
    if (!v.pj) { pantallaEspera(); return; }
    const foco = document.activeElement;
    const notasFoco = foco && foco.matches('textarea[name=notas]');
    if (notasFoco && prev && prev.pj) { pintarDinamico(); return; } // no pisar lo que escribe
    const scroll = $('.panel')?.scrollTop || 0;
    app.className = 'app app--pj';
    app.innerHTML = htmlHUD();
    if ($('.panel')) $('.panel').scrollTop = scroll;
    if (prev && prev.pj && v.pj && prev.pj.pg !== v.pj.pg) golpeVida(v.pj.pg - prev.pj.pg);
    if (!prev || !prev.pj) entrada();
    tickEnfria();
  }
  // Partes que pueden cambiar mientras se escriben notas.
  function pintarDinamico() {
    const vida = $('.vida'); if (vida) vida.outerHTML = htmlVida();
  }

  function pantallaEspera() {
    app.className = 'app app--espera';
    app.innerHTML = `<header class="hud__bar"><span class="hud__sala">${esc(v.sala.nombre)}</span><span class="hud__code">${esc(v.sala.codigo)}<i class="hud__dot is-on"></i></span></header>
      <section class="espera">
        <p class="kicker">Hola, ${esc(v.yo.nombre)}</p>
        <h1 class="espera__h">Esperando a que el DM te asigne personaje</h1>
        <div class="espera__dados" aria-hidden="true"><span>d20</span></div>
        ${v.grupo.length ? `<p class="espera__lead">Ya en la mesa:</p><ul class="grupo">${v.grupo.map(g => htmlMiembro(g)).join('')}</ul>` : ''}
        <button class="b b--ghost" data-salir>Salir</button>
      </section>`;
    if (anim()) gsap.to('.espera__dados span', { rotate: 360, duration: 3, ease: 'none', repeat: -1 });
  }

  const pct = (a, b) => Math.max(0, Math.min(100, b ? a / b * 100 : 0));
  const tono = p => p <= 25 ? 'is-low' : p <= 50 ? 'is-mid' : '';

  function htmlVida() {
    const f = v.pj, p = pct(f.pg, f.pgMax);
    return `<section class="vida ${tono(p)} ${f.pg === 0 ? 'is-caido' : ''}" aria-label="Puntos de golpe">
      <div class="vida__num"><b data-pg>${f.pg}</b><span>/ ${f.pgMax}</span>${f.pgTemp ? `<em>+${f.pgTemp} temp.</em>` : ''}<small>PG</small></div>
      <div class="vida__bar" role="meter" aria-valuemin="0" aria-valuemax="${f.pgMax}" aria-valuenow="${f.pg}" aria-label="Vida"><i style="width:${p}%"></i></div>
      <div class="vida__btns">
        <button class="b b--rojo" data-pg-d="-5" aria-label="Restar 5">−5</button>
        <button class="b b--rojo" data-pg-d="-1" aria-label="Restar 1">−1</button>
        <button class="b b--sec" data-pg-set aria-label="Escribir vida">±</button>
        <button class="b b--verde" data-pg-d="1" aria-label="Sumar 1">+1</button>
        <button class="b b--verde" data-pg-d="5" aria-label="Sumar 5">+5</button>
      </div>
      ${f.pg === 0 ? '<p class="vida__caido">Inconsciente · tiradas de salvación contra muerte</p>' : ''}
    </section>`;
  }

  function htmlHUD() {
    const f = v.pj;
    const c = f.conj;
    const chips = [
      ['CA', f.ca], ['Inic.', signo(f.iniciativa || 0)], ['Vel.', f.vel],
      ...(c ? [['CD', c.cd], ['Atq. conj.', signo(c.atk)]] : []),
      ['Comp.', signo(f.comp || 2)]
    ];
    return `<header class="hud__bar">
        <span class="hud__sala">${esc(v.sala.nombre)}</span>
        <span class="hud__code">${v.sala.libre ? '<em class="hud__libre">Libre</em>' : ''}${esc(v.sala.codigo)}<i class="hud__dot is-on" title="Conectado"></i></span>
      </header>
      <section class="heroe">
        <div class="heroe__img">${f.img ? `<img src="${esc(f.img)}" alt="">` : `<span>${esc((f.nombre || '?')[0])}</span>`}</div>
        <div class="heroe__txt">
          <h1 class="heroe__nombre">${esc(f.nombre)}</h1>
          <p class="heroe__sub">${esc([f.raza, f.clase].filter(Boolean).join(' · '))}${f.subclase ? `<br><small>${esc(f.subclase)}</small>` : ''}</p>
        </div>
        <div class="heroe__nivel" aria-label="Nivel ${f.nivel}"><small>Nivel</small><b>${f.nivel}</b></div>
      </section>
      ${htmlVida()}
      <ul class="chips">${chips.map(([k, x]) => `<li><small>${k}</small><b>${esc(x)}</b></li>`).join('')}</ul>
      <div class="panel" role="tabpanel">${{ poderes: htmlPoderes, ficha: htmlFicha, grupo: htmlGrupo, notas: htmlNotas }[tab]()}</div>
      <nav class="tabs" role="tablist" aria-label="Secciones">
        ${[['poderes', 'Poderes', '✦'], ['ficha', 'Ficha', '◆'], ['grupo', 'Grupo', '◎'], ['notas', 'Notas', '✎']].map(([id, l, ic]) => `<button role="tab" aria-selected="${tab === id}" data-tab="${id}" class="${tab === id ? 'is-on' : ''}"><span aria-hidden="true">${ic}</span>${l}</button>`).join('')}
      </nav>`;
  }

  /* ---------- Poderes y conjuros ---------- */
  function lista() {
    const f = v.pj, c = f.conj, out = [];
    (f.poderes || []).forEach(p => out.push({ tipo: 'poder', n: p.n, nivel: 0, d: p.d, usado: (f.usos || {})[p.n] >= (p.max || 1) }));
    if (c) {
      (c.trucos || []).forEach(n => out.push({ tipo: 'conjuro', n, nivel: 0, d: (c.info[n] || {}).d || '' }));
      (c.lista || []).forEach(n => out.push({ tipo: 'conjuro', n, nivel: (c.info[n] || {}).l || 1, d: (c.info[n] || {}).d || '' }));
    }
    const fij = fijados[f.id] || [];
    return out.sort((a, b) => (fij.includes(b.n) - fij.includes(a.n)) || (a.tipo === 'poder' ? -1 : 0) - (b.tipo === 'poder' ? -1 : 0) || a.nivel - b.nivel);
  }
  function hayEspacio(nivel) {
    const c = v.pj.conj; if (!c) return false;
    const u = v.pj.usados || {};
    return Object.keys(c.espacios).some(k => +k >= nivel && (u[k] || 0) < c.espacios[k]);
  }
  function solicitudDe(n) { return v.solicitudes.find(s => s.nombre === n && (s.estado === 'pendiente' || s.estado === 'permitida')); }

  function htmlEspacios() {
    const c = v.pj.conj; if (!c || !Object.keys(c.espacios).length) return '';
    const u = v.pj.usados || {};
    return `<div class="espacios" aria-label="Espacios de conjuro">
      ${Object.keys(c.espacios).map(k => {
        const tot = c.espacios[k], quedan = tot - (u[k] || 0);
        return `<div class="espacios__nivel"><small>${c.pacto ? 'Pacto · ' : ''}Nivel ${k}</small><span aria-label="${quedan} de ${tot} disponibles">${Array.from({ length: tot }, (_, i) => `<i class="${i < quedan ? 'is-full' : 'is-gastado'}"></i>`).join('')}</span></div>`;
      }).join('')}
      <p class="espacios__nota">${c.pacto ? 'Vuelven con un descanso corto.' : 'Vuelven con un descanso largo.'} El DM puede recargarlos.</p>
    </div>`;
  }

  function htmlPoderes() {
    const items = lista();
    if (!items.length) return '<p class="vacio">Tu personaje no tiene conjuros ni poderes con usos. Tus ataques están en Ficha.</p>';
    const fij = fijados[v.pj.id] || [];
    return htmlEspacios() + `<ul class="cartas">${items.map(x => {
      const sol = solicitudDe(x.n);
      const fin = enfriando.get(x.n) || 0;
      let estado = 'libre', btn = v.sala.libre ? 'Lanzar' : 'Pedir lanzar';
      if (x.tipo === 'poder' && x.usado) { estado = 'gastado'; btn = 'Usado'; }
      else if (x.tipo === 'conjuro' && x.nivel > 0 && !hayEspacio(x.nivel)) { estado = 'gastado'; btn = 'Sin espacios'; }
      if (sol && sol.estado === 'pendiente') { estado = 'espera'; btn = 'Esperando al DM…'; }
      if (sol && sol.estado === 'permitida') { estado = 'listo'; btn = '¡Lanzar!'; }
      if (fin > Date.now() && estado === 'libre') estado = 'enfria';
      const tema = temaDe(x);
      return `<li class="carta carta--${estado}" data-carta="${esc(x.n)}" data-tipo="${x.tipo}" data-nivel="${x.nivel}" data-tema="${tema.id}" style="--tema:${tema.c}">
        <div class="carta__top">
          <span class="carta__lvl">${x.tipo === 'poder' ? 'Poder' : x.nivel ? 'Nv ' + x.nivel : 'Truco'}</span>
          <h3 class="carta__n">${esc(x.n)}</h3>
          <button class="carta__pin ${fij.includes(x.n) ? 'is-on' : ''}" data-pin aria-pressed="${fij.includes(x.n)}" aria-label="${fij.includes(x.n) ? 'Quitar de favoritos' : 'Fijar arriba'}">★</button>
        </div>
        ${x.d ? `<p class="carta__d">${esc(x.d)}</p>` : ''}
        <div class="carta__act">
          ${estado === 'espera' ? `<button class="b b--ghost b--sm" data-cancelar>Cancelar</button>` : ''}
          <button class="b carta__btn" data-lanzar ${estado === 'gastado' || estado === 'espera' || estado === 'enfria' ? 'disabled' : ''}>
            ${estado === 'enfria' ? '<span class="enfria"><i></i><b>Recargando</b></span>' : btn}
          </button>
        </div>
      </li>`;
    }).join('')}</ul>`;
  }

  /* ---------- Ficha, grupo y notas ---------- */
  function htmlFicha() {
    const f = v.pj;
    const A = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];
    return `<section class="bloque"><h2>Atributos</h2>
        <ul class="atr">${A.map(([k, l]) => `<li><small>${l}</small><b>${signo(mod((f.atr || {})[k] || 10))}</b><span>${(f.atr || {})[k] ?? '—'}</span></li>`).join('')}</ul>
        ${f.percepcionPasiva ? `<p class="mini">Percepción pasiva ${f.percepcionPasiva}</p>` : ''}
      </section>
      <section class="bloque"><h2>Ataques</h2>
        <ul class="ataques">${(f.ataques || []).map(a => `<li><b>${esc(a.n)}</b><span class="ataques__bono">${a.b == null ? '—' : signo(a.b)}</span><span>${esc(a.d)} ${esc(a.t)}</span>${a.r || a.nota ? `<small>${esc([a.r, a.nota].filter(Boolean).join(' · '))}</small>` : ''}</li>`).join('') || '<li class="vacio">Sin ataques.</li>'}</ul>
      </section>
      <section class="bloque"><h2>Rasgos</h2>
        ${(f.rasgos || []).map(r => `<details class="rasgo"><summary>${esc(r.n)}</summary><p>${esc(r.d)}</p></details>`).join('') || '<p class="vacio">Sin rasgos.</p>'}
      </section>`;
  }
  function htmlMiembro(g) {
    const p = pct(g.pg, g.pgMax);
    return `<li class="miembro ${g.yo ? 'is-yo' : ''}">
      <span class="miembro__img">${g.img ? `<img src="${esc(g.img)}" alt="">` : esc((g.nombre || '?')[0])}</span>
      <span class="miembro__txt"><b>${esc(g.nombre)}</b><small>${esc(g.jugador)}</small><span class="miembro__bar ${tono(p)}"><i style="width:${p}%"></i></span></span>
      <span class="miembro__pg">${g.pg}/${g.pgMax}</span>
    </li>`;
  }
  function htmlGrupo() {
    return `<section class="bloque"><h2>El grupo</h2><ul class="grupo">${v.grupo.map(htmlMiembro).join('')}</ul></section>
      <button class="b b--ghost b--sm" data-salir>Salir de la sala</button>`;
  }
  function htmlNotas() {
    return `<section class="bloque bloque--notas"><h2>Mis notas</h2>
      <p class="mini">Solo las ves tú y el DM. Se guardan solas.</p>
      <textarea name="notas" rows="14" placeholder="Pistas, nombres, deudas, lo que no quieres olvidar…">${esc(v.yo.notas || '')}</textarea>
      <p class="mini notas__estado" aria-live="polite"></p></section>`;
  }

  /* ---------- Interacción ---------- */
  app.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-salir]')) { if (confirm('¿Salir de la sala? Podrás volver a entrar con tu nombre.')) salir(); return; }
    const tb = t.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; escribir('tff.jugador.tab', tab); render(v); if (anim()) gsap.from('.panel > *', { y: 14, opacity: 0, stagger: .04, duration: .25 }); return; }
    const d = t.closest('[data-pg-d]');
    if (d) { try { await accion({ accion: 'pg', delta: +d.dataset.pgD }); } catch (err) { toast(err.message, 'error'); } return; }
    if (t.closest('[data-pg-set]')) { dialogoVida(); return; }
    const carta = t.closest('[data-carta]'); if (!carta) return;
    const n = carta.dataset.carta;
    if (t.closest('[data-pin]')) {
      const id = v.pj.id; const l = fijados[id] || [];
      fijados[id] = l.includes(n) ? l.filter(x => x !== n) : [...l, n];
      escribir('tff.jugador.fijados', fijados); render(v); return;
    }
    if (t.closest('[data-cancelar]')) { try { await accion({ accion: 'cancelar' }); } catch (err) { toast(err.message, 'error'); } return; }
    if (t.closest('[data-lanzar]')) {
      const sol = solicitudDe(n);
      const tema = temaDe({ n, d: (carta.querySelector('.carta__d') || {}).textContent || '' });
      try {
        if (sol && sol.estado === 'permitida') { await lanzar(sol, carta, tema); return; }
        await accion({ accion: 'solicitar', tipo: carta.dataset.tipo, nombre: n, nivel: +carta.dataset.nivel, tema: tema.id });
        if (v.sala.libre) {
          // En modo libre la petición llega ya desbloqueada: se lanza directamente.
          const r = await esperar(() => solicitudDe(n) && solicitudDe(n).estado === 'permitida');
          if (r) await lanzar(solicitudDe(n), carta, tema);
        } else vibrar([20]);
      } catch (err) { toast(err.message, 'error'); }
    }
  });
  function esperar(cond, ms = 3000) {
    return new Promise(res => { const t0 = Date.now(); (function tick() { if (cond()) res(true); else if (Date.now() - t0 > ms) res(false); else setTimeout(tick, 60); })(); });
  }
  async function lanzar(sol, carta, tema) {
    await accion({ accion: 'lanzar', solicitudId: sol.id });
    efecto(sol.nombre, tema);
    if (sol.tipo === 'conjuro' && !sol.nivel) { enfriando.set(sol.nombre, Date.now() + ENFRIA); tickEnfria(); }
  }

  let notasT = null;
  app.addEventListener('input', e => {
    if (!e.target.matches('textarea[name=notas]')) return;
    const st = $('.notas__estado'); if (st) st.textContent = 'Escribiendo…';
    clearTimeout(notasT);
    notasT = setTimeout(async () => {
      try { await accion({ accion: 'notas', texto: e.target.value }); v.yo.notas = e.target.value; if ($('.notas__estado')) $('.notas__estado').textContent = 'Guardado'; }
      catch (err) { if ($('.notas__estado')) $('.notas__estado').textContent = 'No se pudo guardar: ' + err.message; }
    }, 700);
  });

  function dialogoVida() {
    const f = v.pj;
    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.innerHTML = `<form method="dialog" class="dlg__box">
      <h2>Ajustar vida</h2>
      <label class="campo"><span>Daño o curación (usa − para daño)</span><input name="delta" type="number" inputmode="numeric" placeholder="−7 o 5"></label>
      <label class="campo"><span>O vida exacta (0–${f.pgMax})</span><input name="valor" type="number" inputmode="numeric" min="0" max="${f.pgMax}" placeholder="${f.pg}"></label>
      <label class="campo"><span>Puntos de golpe temporales</span><input name="temp" type="number" inputmode="numeric" min="0" value="${f.pgTemp || 0}"></label>
      <div class="dlg__act"><button class="b b--ghost" value="no">Cancelar</button><button class="b" value="ok">Aplicar</button></div>
    </form>`;
    document.body.appendChild(d); d.showModal();
    d.addEventListener('close', async () => {
      const fd = new FormData($('form', d));
      if (d.returnValue === 'ok') {
        const body = { accion: 'pg' };
        if (fd.get('delta') !== '') body.delta = +fd.get('delta');
        else if (fd.get('valor') !== '') body.valor = +fd.get('valor');
        body.temp = +fd.get('temp') || 0;
        try { await accion(body); } catch (err) { toast(err.message, 'error'); }
      }
      d.remove();
    });
  }

  /* ---------- Animaciones ---------- */
  function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  function entrada() {
    if (!anim()) return;
    gsap.from('.heroe', { y: -20, opacity: 0, duration: .4, ease: 'power3.out' });
    gsap.from('.heroe__nivel', { scale: 0, rotate: -40, duration: .6, ease: 'back.out(2.4)', delay: .15 });
    gsap.from('.vida, .chips li', { y: 16, opacity: 0, stagger: .04, duration: .3, delay: .1 });
  }
  function golpeVida(delta) {
    const el = $('.vida'); if (!el) return;
    vibrar(delta < 0 ? [60] : [20]);
    const flot = document.createElement('span');
    flot.className = 'vida__flot ' + (delta < 0 ? 'is-dmg' : 'is-cura');
    flot.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
    el.appendChild(flot);
    if (anim()) {
      gsap.fromTo(flot, { y: 0, opacity: 1, scale: .6 }, { y: -50, opacity: 0, scale: 1.4, duration: 1.1, ease: 'power2.out', onComplete: () => flot.remove() });
      if (delta < 0) gsap.fromTo(el, { x: -8 }, { x: 0, duration: .4, ease: 'elastic.out(1.2, .3)' });
    } else setTimeout(() => flot.remove(), 900);
  }
  function tickEnfria() {
    $$('.carta--enfria').forEach(c => {
      const fin = enfriando.get(c.dataset.carta) || 0;
      const resto = Math.max(0, fin - Date.now());
      const i = $('.enfria i', c);
      if (i) i.style.setProperty('--p', (1 - resto / ENFRIA) * 360 + 'deg');
    });
    if ([...enfriando.values()].some(fin => fin > Date.now())) requestAnimationFrame(tickEnfria);
    else if ($('.carta--enfria')) { enfriando.clear(); render(v); }
  }

  // Temas visuales según el tipo de daño o efecto que menciona el conjuro.
  const TEMAS = [
    { id: 'fuego', re: /fuego|llamas|ardiente/i, c: '#ff7a1a', o: '¡FWOOSH!' },
    { id: 'frio', re: /frío|escarcha|hielo/i, c: '#7fd6ff', o: '¡KRSSH!' },
    { id: 'acido', re: /ácido/i, c: '#aad431', o: '¡SSSZZ!' },
    { id: 'rayo', re: /relámpago|eléctric|rayo de luz/i, c: '#fde134', o: '¡KRAKOOM!' },
    { id: 'trueno', re: /trueno|atronador/i, c: '#9fb0e0', o: '¡BOOOM!' },
    { id: 'necro', re: /necrótic|oscuridad|sombra/i, c: '#9a6bd6', o: '¡WHOOM!' },
    { id: 'radiante', re: /radiante|sagrad/i, c: '#ffe9a8', o: '¡SHIIING!' },
    { id: 'veneno', re: /veneno|envenen/i, c: '#6bbf3a', o: '¡BLURP!' },
    { id: 'psiquico', re: /psíquic|hechiza|encanta|mente/i, c: '#ff6fb5', o: '¡ZWEEE!' },
    { id: 'cura', re: /recupera|cura|sana|PG de/i, c: '#aad431', o: '¡AAAH!' },
    { id: 'fuerza', re: /fuerza|empuj/i, c: '#8fa0d8', o: '¡POW!' }
  ];
  function temaDe(x) {
    const txt = (x.d || '') + ' ' + (x.n || '');
    return TEMAS.find(t => t.re.test(txt)) || { id: 'arcano', c: '#c3a6ff', o: '¡ZAP!' };
  }

  const fx = $('#fx');
  function rafaga(color) {
    // Estallido de cómic: polígono de puntas irregulares.
    const pts = []; const n = 22;
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? 30 + Math.random() * 8 : 48 + Math.random() * 4;
      const a = (i / (n * 2)) * Math.PI * 2;
      pts.push((50 + Math.cos(a) * r).toFixed(1) + ',' + (50 + Math.sin(a) * r).toFixed(1));
    }
    return `<svg class="fx__burst" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="${color}" stroke="#262626" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  }
  function efecto(nombre, tema) {
    vibrar([30, 30, 30, 30, 120]);
    fx.hidden = false;
    fx.className = 'fx fx--' + tema.id;
    fx.style.setProperty('--tema', tema.c);
    fx.innerHTML = `<div class="fx__fondo"></div>${rafaga(tema.c)}
      <div class="fx__txt"><span class="fx__ono">${esc(tema.o)}</span><span class="fx__nombre">${esc(nombre)}</span></div>
      <div class="fx__part" aria-hidden="true">${Array.from({ length: 26 }, () => '<i></i>').join('')}</div>
      <p class="sr-only" role="alert">Lanzaste ${esc(nombre)}</p>`;
    const cerrar = () => { fx.hidden = true; fx.innerHTML = ''; fx.onclick = null; };
    fx.onclick = cerrar;
    if (!anim()) { setTimeout(cerrar, 2200); return; }
    const tl = gsap.timeline({ onComplete: cerrar });
    tl.fromTo('.fx__fondo', { opacity: 0 }, { opacity: 1, duration: .15 })
      .fromTo('.fx__burst', { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: .45, ease: 'back.out(2.2)' }, 0)
      .to('.fx__burst', { rotate: 8, duration: 1.6, ease: 'none' }, .45)
      .fromTo('.fx__ono', { scale: 3, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: -6, duration: .35, ease: 'power4.out' }, .12)
      .fromTo('.fx__nombre', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .3, ease: 'power3.out' }, .35);
    $$('.fx__part i').forEach((p, i) => {
      const a = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
      tl.fromTo(p, { x: 0, y: 0, scale: 1, opacity: 1 }, { x: Math.cos(a) * dist, y: Math.sin(a) * dist + (tema.id === 'acido' || tema.id === 'veneno' ? 120 : 0), scale: .2, opacity: 0, duration: .9 + Math.random() * .6, ease: 'power3.out' }, .1 + i * .01);
    });
    tl.to('.fx', { opacity: 0, duration: .35 }, 2.1).set('.fx', { opacity: 1 });
  }
  function desbloqueo(nombre) {
    toast(`¡Acertaste! Ya puedes lanzar ${nombre}.`);
    tab = 'poderes'; render(v);
    const c = $$('[data-carta]').find(x => x.dataset.carta === nombre);
    if (c) { c.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); if (anim()) gsap.fromTo(c, { scale: .94 }, { scale: 1, duration: .6, ease: 'elastic.out(1.1, .4)' }); }
  }
  function fallo(nombre) {
    fx.hidden = false; fx.className = 'fx fx--fallo'; fx.style.setProperty('--tema', '#9f2c27');
    fx.innerHTML = `<div class="fx__fondo"></div>${rafaga('#9f2c27')}<div class="fx__txt"><span class="fx__ono">¡FALLO!</span><span class="fx__nombre">${esc(nombre)} no sale</span></div><p class="sr-only" role="alert">Fallaste. ${esc(nombre)} no se lanza.</p>`;
    const cerrar = () => { fx.hidden = true; fx.innerHTML = ''; };
    fx.onclick = cerrar;
    if (!anim()) { setTimeout(cerrar, 1600); return; }
    gsap.timeline({ onComplete: cerrar })
      .fromTo('.fx__burst', { scale: 0 }, { scale: .8, duration: .3, ease: 'back.out(2)' })
      .fromTo('.fx__ono', { scale: 2, opacity: 0 }, { scale: 1, opacity: 1, duration: .25 }, 0)
      .to('.fx__txt', { x: 10, duration: .06, repeat: 5, yoyo: true }, .3)
      .to('.fx', { opacity: 0, duration: .3 }, 1.5).set('.fx', { opacity: 1 });
  }

  /* ---------- Inicio ---------- */
  if (ses) conectar(); else pantallaEntrar();
})();
