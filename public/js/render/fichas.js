/* Render de fichas: tarjeta compacta, hoja ampliada (editable) y carta de proyección. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const esc = s => TFF.esc(s);
  const R = () => TFF.reglas;
  const mod = s => Math.floor(((+s || 10) - 10) / 2);
  const fm = n => (n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '−') + Math.abs(n));
  const TIPO = { pj: 'PJ', npc: 'NPC', enemigo: 'Enemigo' };
  const ESTADOS = ['activo', 'desaparecido', 'derrotado', 'muerto'];
  const inicial = n => (n || '?').trim().charAt(0).toUpperCase();
  const pct = f => Math.max(0, Math.min(100, f.pgMax ? f.pg / f.pgMax * 100 : 0));
  const hpCls = f => { const r = f.pgMax ? f.pg / f.pgMax : 1; return r <= .25 ? 'is-low' : r <= .5 ? 'is-mid' : ''; };

  function sub(f) {
    if (f.tipo === 'enemigo' && f.base) return [f.categoria, 'VD ' + f.vd].filter(Boolean).join(' · ');
    const cl = [f.clase, f.nivel && f.clase ? f.nivel : ''].filter(Boolean).join(' ');
    return [f.raza, cl].filter(Boolean).join(' · ') || (f.categoria || '');
  }
  const isDown = f => f.estado === 'derrotado' || f.estado === 'muerto' || (f.tipo === 'enemigo' && f.pg <= 0);

  function lvlBadge(f) {
    if (f.tipo === 'enemigo' || (!f.clase && f.vd)) return `<div class="card__lvl">${esc(f.vd || '—')}<small>VD</small></div>`;
    return `<div class="card__lvl">${f.nivel || 1}<small>NIVEL</small></div>`;
  }

  /* ---------- Tarjeta compacta ---------- */
  function card(f) {
    return `<article class="card card--${f.tipo} ${isDown(f) ? 'is-down' : ''}" data-f="${f.id}">
      <div class="card__art dz" data-dz-card ${f.img ? `data-bg="${esc(f.img)}"` : 'data-dz-click'}>
        ${f.img ? '' : `<div class="card__mono">${esc(inicial(f.nombre))}</div>`}
        <span class="tag tag--${f.tipo} card__tag">${TIPO[f.tipo]}</span>
        ${lvlBadge(f)}
        ${f.estado && f.estado !== 'activo' ? `<span class="tag tag--decision card__state">${esc(f.estado)}</span>` : ''}
        <div class="dz__tools"><button data-dz-pick>Imagen</button><button data-dz-url data-dz-skip>URL</button></div>
      </div>
      <div class="card__body">
        <button class="card__name" data-open>${esc(f.nombre)}</button>
        <div class="card__sub">${esc(sub(f))}</div>
        ${f.rol ? `<div class="card__role">${esc(f.rol)}</div>` : ''}
        <div class="card__stats">
          <div class="shield" title="Clase de armadura">${f.ca ?? '—'}<small>CA</small></div>
          <div class="hpbox">
            <span class="hpbox__val">${f.pg}<small> / ${f.pgMax} PG</small></span>
            <div class="hp ${hpCls(f)}"><span style="width:${pct(f)}%"></span></div>
            <div class="hpbox__row"><button data-hp="-" aria-label="Quitar PG">−</button><input data-hp-amt value="1" inputmode="numeric" aria-label="Cantidad de PG"><button data-hp="+" aria-label="Sumar PG">+</button></div>
          </div>
        </div>
        <div class="card__foot">
          <button data-escena class="${f.escena ? 'is-on' : ''}" title="Mostrar en el proyector (modo Fichas)">En escena</button>
          ${f.tipo !== 'npc' ? `<button data-enc class="${f.enc ? 'is-on' : ''}" title="Contar en el balance de encuentro">Encuentro</button>` : ''}
          <span class="grow"></span><button data-open>Ficha ↗</button>
        </div>
      </div>
    </article>`;
  }

  /* ---------- Hoja ampliada ---------- */
  function sel(path, opts, val) {
    return `<select class="inp inp--sm" data-path="${path}">${opts.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  function skillsHTML(f) {
    if (f.habTxt) return `<p>${esc(f.habTxt)}</p>`;
    const H = R().HABILIDADES;
    const items = Object.entries(f.hab || {}).sort();
    if (!items.length) return '<p class="src">Sin competencias en habilidades.</p>';
    return `<div class="skills">${items.map(([n, v]) => `<span class="skill ${v === 2 ? 'is-exp' : ''}" title="${v === 2 ? 'Pericia' : 'Competencia'}">${esc(n)} <b>${fm(mod(f.atr[H[n]]) + (f.comp || 2) * v)}</b></span>`).join('')}</div>`;
  }
  function savesHTML(f) {
    if (f.salvTxt) return esc(f.salvTxt);
    if (!f.salv || !f.salv.length) return '—';
    return f.salv.map(k => `${R().ATR_LABEL[k]} ${fm(mod(f.atr[k]) + (f.comp || 2))}`).join(' · ');
  }
  function spellsHTML(f, edit) {
    const c = f.conj; if (!c) return edit ? `<div class="blk"><div class="blk__title">Conjuros <button data-conj-add>+ Añadir lanzamiento</button></div></div>` : '';
    const C = R().CONJURO;
    const niveles = Object.keys(c.espacios || {}).map(Number).sort((a, b) => a - b);
    const pips = niveles.map(n => `<div class="slots__lvl"><span>${c.pacto ? 'Pacto · ' : ''}Nv ${n}</span><div class="slots__pips">${Array.from({ length: c.espacios[n] }, (_, i) => `<button class="pip ${i < ((c.usados || {})[n] || 0) ? 'is-used' : ''}" data-pip="${n}:${i}" aria-label="Espacio de nivel ${n}"></button>`).join('')}</div></div>`).join('');
    const item = (n, tipo) => {
      const s = C[n];
      return `<div class="spell"><em>${tipo === 't' ? 'Truco' : 'Nv ' + (s ? s.l : '?')}</em><b>${esc(n)}</b>${s ? `<p>${esc(s.d)}</p>` : ''}${edit ? `<button class="x" data-spell-del="${tipo}:${esc(n)}" aria-label="Quitar ${esc(n)}">×</button>` : ''}</div>`;
    };
    const addOpts = edit ? R().CONJUROS.filter(x => !c.trucos.includes(x[0]) && !c.lista.includes(x[0])).map(x => `<option value="${esc(x[0])}">${x[1] ? 'Nv ' + x[1] : 'Truco'} · ${esc(x[0])}</option>`).join('') : '';
    return `<div class="blk">
      <div class="blk__title">Conjuros ${niveles.length ? '<button data-descanso>Descanso largo</button>' : ''}</div>
      <dl class="kv"><dt>Característica</dt><dd>${R().ATR_NOMBRE[c.c] || '—'}</dd><dt>CD de salvación</dt><dd><b>${c.cd}</b></dd><dt>Ataque de conjuro</dt><dd><b>${fm(c.atk)}</b></dd></dl>
      ${pips ? `<div class="slots" style="margin-top:12px">${pips}</div>` : ''}
      <div class="spells">${c.trucos.map(n => item(n, 't')).join('')}${c.lista.map(n => item(n, 'c')).join('')}</div>
      ${edit ? `<select class="inp" data-spell-add style="margin-top:8px"><option value="">+ Añadir conjuro…</option>${addOpts}</select>` : ''}
    </div>`;
  }

  function sheet(f, { edit = true } = {}) {
    const r = R();
    const gen = !!f.gen;
    const pers = f.pers || {};
    const PERS = [['pasado', 'Pasado'], ['rasgo', 'Rasgo de personalidad'], ['ideal', 'Ideal'], ['vinculo', 'Vínculo'], ['defecto', 'Defecto'], ['peculiaridad', 'Peculiaridad'], ['gancho', 'Gancho para la partida']];
    const ro = edit ? '' : 'readonly';
    const nivelCtl = f.tipo === 'enemigo' && !f.clase
      ? `<span class="lvlctl"><span>${esc(f.vd || '—')}<small>VD · ${f.xp || 0} PX</small></span></span>`
      : `<span class="lvlctl">${edit ? '<button data-lvl="-1" aria-label="Bajar nivel">−</button>' : ''}<span>${f.nivel || 1}<small>NIVEL</small></span>${edit ? '<button data-lvl="1" aria-label="Subir nivel">+</button>' : ''}</span>`;
    return `<div class="sheet sheet--${f.tipo}" data-sheet="${f.id}">
      <div class="sheet__head">
        <div class="sheet__art ${edit ? 'dz' : ''}" data-dz-sheet ${f.img ? `data-bg="${esc(f.img)}"` : 'data-dz-click'}>
          ${f.img ? '' : `<div class="card__mono">${esc(inicial(f.nombre))}</div>${edit ? '<div class="dz__empty" style="background:none"><b>Retrato</b>Arrastra, pega o haz clic</div>' : ''}`}
          ${edit ? `<div class="dz__tools"><button data-dz-pick>Subir</button><button data-dz-url data-dz-skip>URL</button>${f.img ? '<button data-dz-clear data-dz-skip>Quitar</button>' : ''}</div>` : ''}
        </div>
        <div class="sheet__id">
          <div class="sheet__line">
            ${edit ? sel('tipo', ['pj', 'npc', 'enemigo'], f.tipo).replace(/>pj</, '>PJ<').replace(/>npc</, '>NPC<').replace(/>enemigo</, '>Enemigo<') : `<span class="tag tag--${f.tipo}">${TIPO[f.tipo]}</span>`}
            ${edit ? sel('estado', ESTADOS, f.estado || 'activo') : ''}
            ${edit ? sel('actitud', r.PERS.actitud, f.actitud || 'Indiferente') : `<span class="chip">${esc(f.actitud || '')}</span>`}
          </div>
          <input class="sheet__name" data-path="nombre" value="${esc(f.nombre)}" aria-label="Nombre" ${ro}>
          <input class="sheet__role" data-path="rol" value="${esc(f.rol || '')}" placeholder="Rol en la historia (p. ej. ‘Contrabandista del muelle’)" aria-label="Rol" ${ro}>
          <div class="sheet__line">
            ${nivelCtl}
            <span class="chip">${esc(sub(f) || 'Sin clase')}</span>
            ${f.subclase ? `<span class="chip">${esc(f.subclase)}</span>` : ''}
            ${f.trasfondo ? `<span class="chip">${esc(f.trasfondo)}</span>` : ''}
            ${f.alineamiento ? `<span class="chip">${esc(f.alineamiento)}</span>` : ''}
          </div>
          ${gen && edit ? '<p class="src">Al cambiar de nivel se recalculan atributos, PG, CA, ataques, rasgos y conjuros. Lo que escribas a mano en personalidad y notas se conserva.</p>' : ''}
          ${f.fuente ? `<p class="src">Fuente: ${esc(f.fuente)}</p>` : ''}
          <div class="sheet__stats">
            <div class="statbox"><input data-path="ca" data-num value="${f.ca ?? ''}" aria-label="CA" ${ro}><span>CA</span></div>
            <div class="statbox statbox--hp"><input data-path="pg" data-num value="${f.pg ?? ''}" aria-label="PG actuales" ${ro}><span>PG actuales</span></div>
            <div class="statbox"><input data-path="pgMax" data-num value="${f.pgMax ?? ''}" aria-label="PG máximos" ${ro}><span>PG máx ${f.pgDado ? '· ' + esc(f.pgDado) : ''}</span></div>
            <div class="statbox"><b>${esc(f.vel || '—')}</b><span>Velocidad</span></div>
            <div class="statbox"><b>${fm(f.comp || 2)}</b><span>Competencia</span></div>
            <div class="statbox"><b>${fm(mod(f.atr.des))}</b><span>Iniciativa</span></div>
          </div>
        </div>
      </div>
      <div class="abil">${r.ATR.map(k => `<div class="abil__box"><label>${r.ATR_LABEL[k]}</label><span class="mod">${fm(mod(f.atr[k]))}</span>
        <input data-path="atr.${k}" data-num value="${f.atr[k]}" aria-label="${r.ATR_NOMBRE[k]}" ${ro}>${(f.salv || []).includes(k) ? `<span class="sv">SALV ${fm(mod(f.atr[k]) + (f.comp || 2))}</span>` : ''}</div>`).join('')}</div>
      <div class="sheet__cols">
        <div>
          <div class="blk"><div class="blk__title">Ataques ${edit ? '<button data-atk-add>+ Ataque</button>' : ''}</div>
            <table class="atk"><thead><tr><th>Ataque</th><th>Bono</th><th>Daño</th><th>Tipo</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>
            ${(f.ataques || []).map((a, i) => edit ? `<tr data-atk="${i}">
              <td><input data-k="n" value="${esc(a.n)}" aria-label="Nombre del ataque"><input data-k="nota" value="${esc([a.r, a.nota].filter(Boolean).join(' · '))}" placeholder="Alcance o nota" class="note" aria-label="Nota"></td>
              <td><input data-k="b" value="${a.b == null ? '' : fm(a.b)}" style="width:52px" aria-label="Bono"></td>
              <td><input data-k="d" value="${esc(a.d)}" style="width:80px" aria-label="Daño"></td>
              <td><input data-k="t" value="${esc(a.t || '')}" aria-label="Tipo de daño"></td>
              <td><button class="x" data-atk-del="${i}" aria-label="Quitar ataque">×</button></td></tr>`
              : `<tr><td><b>${esc(a.n)}</b><span class="note">${esc([a.r, a.nota].filter(Boolean).join(' · '))}</span></td><td><b>${a.b == null ? '—' : fm(a.b)}</b></td><td>${esc(a.d)}</td><td>${esc(a.t || '')}</td></tr>`).join('') || `<tr><td colspan="5" class="src">Sin ataques.</td></tr>`}
            </tbody></table></div>
          <div class="blk"><div class="blk__title">Rasgos y acciones ${edit ? '<button data-rasgo-add>+ Rasgo</button>' : ''}</div>
            ${(f.rasgos || []).map((t, i) => edit
              ? `<div class="trait trait--edit" data-rasgo="${i}"><input data-k="n" value="${esc(t.n)}" aria-label="Nombre del rasgo"><textarea data-k="d" rows="2" aria-label="Descripción del rasgo">${esc(t.d)}</textarea><button class="x" data-rasgo-del="${i}" aria-label="Quitar rasgo">×</button></div>`
              : `<div class="trait"><b>${esc(t.n)}.</b> ${esc(t.d)}</div>`).join('') || '<p class="src">Sin rasgos.</p>'}
          </div>
          ${spellsHTML(f, edit)}
        </div>
        <div>
          <div class="blk"><div class="blk__title">Competencias</div>
            <dl class="kv"><dt>Salvaciones</dt><dd>${savesHTML(f)}</dd>
            ${f.sentidos ? `<dt>Sentidos</dt><dd>${esc(f.sentidos)}</dd>` : ''}
            ${f.idiomas ? `<dt>Idiomas</dt><dd>${esc(f.idiomas)}</dd>` : ''}
            ${f.resist ? `<dt>Defensas</dt><dd>${esc(f.resist)}</dd>` : ''}
            ${f.caDesc ? `<dt>Armadura</dt><dd>${esc(f.caDesc)}</dd>` : ''}</dl>
            <div style="margin-top:12px">${skillsHTML(f)}</div>
          </div>
          <div class="blk"><div class="blk__title">Personalidad</div>
            <div class="pers">${PERS.filter(([k]) => edit || pers[k]).map(([k, l]) => `<label><span>${l}</span><textarea rows="2" data-path="pers.${k}" ${ro}>${esc(pers[k] || '')}</textarea></label>`).join('')}</div>
          </div>
          ${edit ? `<div class="blk"><div class="blk__title">Notas del DM</div><div class="pers"><textarea rows="4" data-path="notas" placeholder="Solo para ti. No se proyecta.">${esc(f.notas || '')}</textarea></div></div>` : ''}
        </div>
      </div>
      ${edit ? `<div class="sheet__foot">
        <div><button class="btn" data-proj-one>▶ Proyectar sola</button><button class="btn btn--ghost" data-escena-toggle>${f.escena ? 'Quitar de escena' : 'Añadir a escena'}</button></div>
        <div><button class="btn btn--ghost" data-dup>Duplicar</button><button class="btn btn--danger" data-del>Eliminar</button></div>
      </div>` : ''}
    </div>`;
  }

  /* ---------- Carta para el proyector ---------- */
  function pcard(f, detalle = 'basico') {
    const r = R();
    const showNums = detalle === 'completo' || (detalle === 'basico' && f.tipo !== 'enemigo');
    return `<article class="pcard pcard--${f.tipo} ${isDown(f) ? 'is-down' : ''}" data-f="${f.id}">
      <div class="pcard__art" ${f.img ? `data-bg="${esc(f.img)}"` : ''}>${f.img ? '' : `<div class="card__mono">${esc(inicial(f.nombre))}</div>`}<span class="tag tag--${f.tipo} pcard__tag">${TIPO[f.tipo]}</span></div>
      <div class="pcard__body">
        <h2>${esc(f.nombre)}</h2>
        <div class="pcard__sub">${esc(sub(f))}</div>
        ${f.rol && f.tipo !== 'enemigo' ? `<div class="pcard__role">${esc(f.rol)}</div>` : ''}
        ${detalle !== 'oculto' ? `<div class="pcard__nums">
          <div class="shield">${f.ca ?? '—'}<small>CA</small></div>
          <div class="pcard__hp"><b>${showNums ? `${f.pg} / ${f.pgMax} PG` : (isDown(f) ? 'Derrotado' : f.pg / f.pgMax > .5 ? 'Ileso' : f.pg / f.pgMax > .25 ? 'Herido' : 'Malherido')}</b><div class="hp ${hpCls(f)}"><span style="width:${pct(f)}%"></span></div></div>
        </div>
        <div class="pcard__abil">${r.ATR.map(k => `<div><span>${r.ATR_LABEL[k]}</span><b>${fm(mod(f.atr[k]))}</b></div>`).join('')}</div>` : ''}
        ${detalle === 'completo' && (f.ataques || []).length ? `<div class="pcard__atk">${f.ataques.slice(0, 4).map(a => `<div><span>${esc(a.n)}</span><b>${a.b == null ? '' : fm(a.b) + ' · '}${esc(a.d)}</b></div>`).join('')}</div>` : ''}
      </div>
    </article>`;
  }

  TFF.render = Object.assign(TFF.render || {}, { card, sheet, pcard, fichaSub: sub, isDown, fm, modOf: mod, TIPO });
})();
