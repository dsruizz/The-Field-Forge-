/* Render de la crónica: lo usan la página del DM (index) y el proyector. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const esc = s => TFF.esc(s);

  const TIPOS = {
    escena: 'Escena', personaje: 'Personaje', combate: 'Combate',
    descubrimiento: 'Descubrimiento', decision: 'Decisión', hito: 'Hito'
  };
  const ROMANO = n => { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
  const inicial = n => (n || '?').trim().charAt(0).toUpperCase();

  function avatar(f) {
    return f && f.img ? `<img data-img="${esc(f.img)}" alt="">` : esc(inicial(f && f.nombre));
  }
  function hpClass(f) { const r = f.pgMax ? f.pg / f.pgMax : 1; return r <= .25 ? 'is-low' : r <= .5 ? 'is-mid' : ''; }

  function hero(st, { dm }) {
    const c = st.campana;
    const [t1, ...t2] = c.titulo.split(' de ');
    const titulo = t2.length ? `${esc(t1)} <span>de ${esc(t2.join(' de '))}</span>` : esc(c.titulo);
    return `<section class="hero" id="inicio">
      <div class="hero__copy">
        <div class="hero__kicker"><span class="kicker" ${dm ? 'contenteditable="true" data-edit="kicker"' : ''}>${esc(c.kicker)}</span></div>
        <h1 class="hero__title">${titulo}</h1>
        <p class="hero__lede" ${dm ? 'contenteditable="true" data-edit="sinopsis"' : ''}>${esc(c.sinopsis)}</p>
      </div>
      <div class="hero__art">
        <div class="hero__frame ${dm ? 'dz' : ''} ${!c.portada && !dm ? 'is-blank' : ''}" data-dz="portada" ${c.portada ? `data-bg="${esc(c.portada)}"` : ''}>
          ${!c.portada && !dm ? '<span class="logo-full" aria-hidden="true"></span>' : ''}
          ${!c.portada && dm ? '<div class="dz__empty"><b>Portada</b>Arrastra una imagen, pégala o haz clic</div>' : ''}
          ${dm ? '<div class="dz__tools"><button data-dz-pick>Subir</button><button data-dz-url data-dz-skip>URL</button>' + (c.portada ? '<button data-dz-clear data-dz-skip>Quitar</button>' : '') + '</div>' : ''}
        </div>
        <div class="burst"><span>Sesión<b>${String(c.sesionActual).padStart(2, '0')}</b></span></div>
      </div>
    </section>`;
  }

  function party(st) {
    const pjs = st.personajes.filter(f => f.tipo === 'pj');
    if (!pjs.length) return '';
    return `<section class="party" aria-label="El grupo">${pjs.map(f => `
      <article class="party__card ${f.estado !== 'activo' ? 'is-out' : ''}">
        <div class="por">${avatar(f)}</div>
        <div>
          <h3>${esc(f.nombre)}</h3>
          <small>${esc([f.raza, f.clase].filter(Boolean).join(' · '))}${f.nivel ? ' · Nv ' + f.nivel : ''}</small>
          ${f.estado === 'activo' ? `<div class="hp ${hpClass(f)}" title="PG ${f.pg}/${f.pgMax}"><span style="width:${Math.max(0, Math.min(100, f.pg / f.pgMax * 100))}%"></span></div>` : `<span class="party__state tag tag--decision">${esc(f.estado)}</span>`}
        </div>
      </article>`).join('')}</section>`;
  }

  function threads(st, { dm }) {
    const hs = st.hilos.filter(h => dm || h.estado === 'abierto');
    if (!hs.length && !dm) return '';
    return `<section class="threads" id="hilos">
      <div><div class="kicker">Lo que sigue en el aire</div><h2>Hilos abiertos</h2></div>
      <div>
        <ul>${hs.map(h => `<li class="thread ${h.estado !== 'abierto' ? 'is-done' : ''}" data-hilo="${h.id}">
          <span class="thread__txt" ${dm ? 'contenteditable="true" data-edit-hilo' : ''}>${esc(h.texto)}</span>
          <span class="thread__tools"><button data-hilo-act="toggle" title="${h.estado === 'abierto' ? 'Marcar resuelto' : 'Reabrir'}" aria-label="${h.estado === 'abierto' ? 'Marcar resuelto' : 'Reabrir'}">✓</button><button data-hilo-act="borrar" title="Eliminar" aria-label="Eliminar hilo">×</button></span>
        </li>`).join('')}</ul>
        ${dm ? '<button class="btn btn--sm btn--yellow threads__add" data-hilo-add>+ Hilo</button>' : ''}
      </div>
    </section>`;
  }

  function evento(e, n, st, { dm, foco }) {
    const who = (e.enlaces || []).map(id => st.personajes.find(f => f.id === id)).filter(Boolean);
    const conImg = !!e.img;
    const showArt = conImg || dm;
    return `<article class="ev ev--${e.tipo} ${showArt ? '' : 'ev--noimg'} ${e.oculto ? 'is-hidden' : ''} ${foco === e.id ? 'is-focus' : ''}" data-ev="${e.id}" id="ev-${e.id}">
      <div class="ev__n" aria-hidden="true">${n}</div>
      <div class="ev__panel">
        ${dm ? `<div class="ev__tools">
          <button data-act="proyectar" title="Mostrar en el proyector">▶ Proyectar</button>
          <button data-act="editar">Editar</button>
          <button data-act="ocultar">${e.oculto ? 'Revelar' : 'Ocultar'}</button>
          <button data-act="subir" aria-label="Subir">↑</button><button data-act="bajar" aria-label="Bajar">↓</button>
          <button data-act="borrar" aria-label="Eliminar">×</button></div>` : ''}
        <div class="ev__meta"><span class="tag tag--${e.tipo}">${TIPOS[e.tipo] || e.tipo}</span>${e.lugar ? `<span class="ev__place">${esc(e.lugar)}</span>` : ''}</div>
        <h3 class="ev__title">${esc(e.titulo)}</h3>
        <p class="ev__text">${esc(e.texto)}</p>
        ${e.cita ? `<p class="ev__quote">${esc(e.cita)}</p>` : ''}
        ${who.length ? `<div class="ev__who">${who.map(f => `<span class="who who--${f.tipo}"><i>${avatar(f)}</i>${esc(f.nombre)}</span>`).join('')}</div>` : ''}
      </div>
      ${showArt ? `<div class="ev__art ${dm ? 'dz' : ''} ${conImg ? '' : 'is-empty'}" data-dz="ev" data-ev-art="${e.id}" ${conImg ? `data-bg="${esc(e.img)}"` : ''}>
        ${!conImg ? '<div class="dz__empty"><b>Imagen</b>Arrastra, pega o haz clic</div>' : ''}
        ${dm ? '<div class="dz__tools"><button data-dz-pick>Subir</button><button data-dz-url data-dz-skip>URL</button>' + (conImg ? '<button data-dz-clear data-dz-skip>Quitar</button>' : '') + '</div>' : ''}
      </div>` : ''}
    </article>`;
  }

  function cronica(st, opts = {}) {
    const { dm = false } = opts;
    const evs = st.cronica.filter(e => dm || !e.oculto);
    const sesiones = [...new Set(evs.map(e => e.sesion))].sort((a, b) => a - b);
    if (!sesiones.includes(st.campana.sesionActual)) sesiones.push(st.campana.sesionActual);
    let n = 0;
    const body = sesiones.map(s => {
      const lista = evs.filter(e => e.sesion === s);
      const now = s === st.campana.sesionActual;
      return `<header class="chapter ${now ? 'is-now' : ''}" id="sesion-${s}">
          <div class="chapter__num">${ROMANO(s)}</div>
          <div class="chapter__txt"><div class="kicker">Sesión ${String(s).padStart(2, '0')}${now ? '<span class="now-pill">En juego</span>' : ''}</div>
          <h2 ${dm ? `contenteditable="true" data-edit-sesion="${s}"` : ''}>${esc((st.campana.sesiones || {})[s] || 'Sin título')}</h2></div>
          <div class="chapter__rule"></div>
        </header>
        ${lista.map(e => evento(e, ++n, st, opts)).join('')}`;
    }).join('');
    return `<section class="chron" id="cronica" aria-label="Crónica">${body}
      <footer class="chron__end"><p>Continuará…</p><small>The Field Forge · memoria de campaña</small></footer></section>`;
  }

  function pagina(st, opts = {}) {
    return hero(st, opts) + party(st) + threads(st, opts) + cronica(st, opts);
  }

  TFF.render = Object.assign(TFF.render || {}, { pagina, TIPOS, ROMANO, avatar, hpClass, inicial });
})();
