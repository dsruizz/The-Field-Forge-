/* Página de personajes: reparto, Forja de NPC, bestiario y balance de encuentros. */
(() => {
  const { $, $$, esc, ui, store: S } = TFF;
  const R = TFF.reglas;
  const app = $('#app');
  let filtro = 'todos';
  let buscar = '';
  let openSheet = null; // { id, modal }

  ui.topbar('personajes');
  S.load();

  app.innerHTML = `
    <header class="page-head">
      <div><div class="kicker">Reparto de la campaña</div><h1>Personajes</h1>
        <p>PJ, NPC y enemigos. En la tarjeta, lo esencial para la mesa; al abrir la ficha, todas las estadísticas y conjuros.</p></div>
      <div class="page-head__actions">
        <button class="btn btn--yellow" data-forge>⚒ Forjar NPC</button>
        <button class="btn btn--ghost" data-bestiary>Bestiario</button>
        <button class="btn btn--ghost" data-blank>+ Ficha en blanco</button>
      </div>
    </header>
    <div class="roster-layout">
      <section class="roster" aria-label="Fichas">
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Filtrar">
            <button data-filter="todos" class="is-on">Todos</button><button data-filter="pj">PJ</button><button data-filter="npc">NPC</button><button data-filter="enemigo">Enemigos</button>
          </div>
          <input class="inp" type="search" placeholder="Buscar por nombre, raza, rol…" aria-label="Buscar" data-search>
          <span style="flex:1"></span>
          <div class="seg" role="group" aria-label="Detalle en el proyector" title="Qué ven los jugadores de las fichas en escena">
            <button data-detalle="oculto">Solo retrato</button><button data-detalle="basico">Básico</button><button data-detalle="completo">Completo</button>
          </div>
          <button class="btn btn--sm" data-proj-scene>▶ Proyectar escena (<span data-scene-n>0</span>)</button>
          <button class="btn btn--sm btn--ghost" data-clear-scene>Vaciar escena</button>
        </div>
        <div class="grid-cards" data-grid></div>
      </section>
      <aside class="enc" aria-label="Balance de encuentro" data-enc></aside>
    </div>`;

  const grid = $('[data-grid]', app);
  const encEl = $('[data-enc]', app);

  /* ---------- Render ---------- */
  function visibles() {
    const q = buscar.trim().toLowerCase();
    return S.state.personajes.filter(f => (filtro === 'todos' || f.tipo === filtro) &&
      (!q || [f.nombre, f.raza, f.clase, f.rol, f.categoria].join(' ').toLowerCase().includes(q)));
  }
  function render() {
    const lista = visibles();
    const grupos = [['pj', 'Personajes jugadores'], ['npc', 'NPC'], ['enemigo', 'Enemigos y criaturas']];
    grid.innerHTML = grupos.map(([t, label]) => {
      const fs = lista.filter(f => f.tipo === t);
      if (!fs.length) return '';
      return `<h2 class="group-title">${label} <small>${fs.length}</small></h2>` + fs.map(TFF.render.card).join('');
    }).join('') || '<p class="src">No hay fichas con ese filtro.</p>';
    TFF.img.hydrate(grid);
    $$('[data-dz-card]', grid).forEach(el => {
      const id = el.closest('[data-f]').dataset.f;
      ui.dropzone(el, ref => setImg(id, ref), { max: 1400 });
    });
    $('[data-scene-n]', app).textContent = S.state.personajes.filter(f => f.escena).length;
    $$('[data-detalle]', app).forEach(b => b.classList.toggle('is-on', b.dataset.detalle === S.stage.detalle));
    renderEnc();
    if (openSheet) refreshSheet();
  }

  function setImg(id, ref) {
    S.update(st => { const f = st.personajes.find(x => x.id === id); if (f) f.img = ref; });
  }
  const upd = (id, fn) => S.update(st => { const f = st.personajes.find(x => x.id === id); if (f) fn(f, st); });

  S.on(kind => { if (kind === 'state') render(); if (kind === 'stage') $$('[data-detalle]', app).forEach(b => b.classList.toggle('is-on', b.dataset.detalle === S.stage.detalle)); });

  /* ---------- Toolbar ---------- */
  app.addEventListener('click', e => {
    const fb = e.target.closest('[data-filter]');
    if (fb) { filtro = fb.dataset.filter; $$('[data-filter]', app).forEach(b => b.classList.toggle('is-on', b === fb)); render(); }
    const dt = e.target.closest('[data-detalle]');
    if (dt) S.setStage({ detalle: dt.dataset.detalle });
    if (e.target.closest('[data-proj-scene]')) {
      const n = S.state.personajes.filter(f => f.escena).length;
      if (!n) { ui.toast('Marca “En escena” en las fichas que quieras proyectar.', 'error'); return; }
      S.setStage({ modo: 'fichas' }); ui.toast(`Proyectando ${n} ficha${n > 1 ? 's' : ''}.`);
    }
    if (e.target.closest('[data-clear-scene]')) S.update(st => st.personajes.forEach(f => { f.escena = false; }));
    if (e.target.closest('[data-forge]')) forja();
    if (e.target.closest('[data-bestiary]')) bestiario();
    if (e.target.closest('[data-blank]')) {
      const f = TFF.npc.fichaVacia(filtro === 'todos' ? 'npc' : filtro);
      S.update(st => st.personajes.push(f)); abrirFicha(f.id);
    }
  });
  $('[data-search]', app).addEventListener('input', e => { buscar = e.target.value; render(); });

  /* ---------- Tarjetas ---------- */
  grid.addEventListener('click', async e => {
    const card = e.target.closest('[data-f]'); if (!card) return;
    const id = card.dataset.f;
    if (e.target.closest('[data-open]')) return abrirFicha(id);
    const hp = e.target.closest('[data-hp]');
    if (hp) {
      const amt = Math.max(0, parseInt($('[data-hp-amt]', card).value, 10) || 0);
      upd(id, f => {
        f.pg = Math.max(0, Math.min(f.pgMax, f.pg + (hp.dataset.hp === '+' ? amt : -amt)));
        if (f.tipo === 'enemigo' && f.pg === 0) f.estado = 'derrotado';
        if (f.pg > 0 && f.estado === 'derrotado') f.estado = 'activo';
      });
      return;
    }
    if (e.target.closest('[data-escena]')) upd(id, f => { f.escena = !f.escena; });
    if (e.target.closest('[data-enc]')) upd(id, f => { f.enc = !f.enc; });
    if (e.target.closest('[data-dz-url]')) { e.stopPropagation(); const u = await ui.pedirURL(S.find('personajes', id).img || ''); if (u) setImg(id, u); }
  });
  grid.addEventListener('keydown', e => {
    if (e.target.matches('[data-hp-amt]') && e.key === 'Enter') { e.preventDefault(); e.target.closest('.hpbox').querySelector('[data-hp="-"]').click(); }
  });

  /* ---------- Hoja ampliada ---------- */
  function abrirFicha(id) {
    const f = S.find('personajes', id); if (!f) return;
    const m = ui.modal({ title: f.nombre, wide: true, body: '', onClose: () => { openSheet = null; } });
    openSheet = { id, m };
    refreshSheet();
    bindSheet(m.body);
  }
  function refreshSheet() {
    const { id, m } = openSheet;
    const f = S.find('personajes', id);
    if (!f) { m.close(); return; }
    const active = document.activeElement;
    if (active && m.body.contains(active) && active.matches('input, textarea, select')) return; // no pisar lo que se está escribiendo
    const y = m.el.querySelector('.modal__box').scrollTop;
    m.body.innerHTML = TFF.render.sheet(f);
    TFF.img.hydrate(m.body);
    const art = $('[data-dz-sheet]', m.body);
    if (art) ui.dropzone(art, ref => setImg(id, ref), { max: 1400 });
    m.el.querySelector('.modal__box').scrollTop = y;
  }
  function setPath(o, path, v) { const ks = path.split('.'); let t = o; ks.slice(0, -1).forEach(k => { t[k] = t[k] || {}; t = t[k]; }); t[ks[ks.length - 1]] = v; }
  const num = v => { const n = parseInt(String(v).replace('−', '-').replace('+', ''), 10); return isNaN(n) ? null : n; };

  function bindSheet(root) {
    root.addEventListener('change', e => {
      const id = openSheet && openSheet.id; if (!id) return;
      const el = e.target;
      if (el.matches('[data-spell-add]')) {
        const n = el.value; if (!n) return;
        upd(id, f => { const s = R.CONJURO[n]; if (s && s.l === 0) f.conj.trucos.push(n); else f.conj.lista.push(n); });
        return;
      }
      if (el.dataset.path) {
        const path = el.dataset.path;
        let v = el.dataset.num !== undefined ? num(el.value) : el.value;
        if (v === null) { refreshSheet(); return; }
        upd(id, f => {
          if (path.startsWith('atr.') && f.gen) {
            const k = path.slice(4); f.gen.base[k] += v - f.atr[k]; TFF.npc.recalcular(f); return;
          }
          if (path === 'ca' && f.gen) { f.gen.ca = v; f.gen.caDesc = f.caDesc || 'Equipo'; }
          if (path === 'pg') v = Math.max(0, Math.min(f.pgMax, v));
          if (path === 'pgMax') f.pg = Math.min(f.pg, v);
          setPath(f, path, v);
          if (path === 'tipo' && f.gen) TFF.npc.recalcular(f);
        });
        if (/^(atr\.|ca|pg|tipo)/.test(path)) setTimeout(() => { document.activeElement && document.activeElement.blur(); refreshSheet(); }, 0);
        return;
      }
      const atkRow = el.closest('[data-atk]');
      if (atkRow) {
        const i = +atkRow.dataset.atk, k = el.dataset.k;
        upd(id, f => {
          const a = f.ataques[i]; a.manual = true;
          if (k === 'b') a.b = el.value.trim() === '' ? null : num(el.value);
          else if (k === 'nota') { a.nota = el.value; a.r = ''; }
          else a[k] = el.value;
        });
        return;
      }
      const tr = el.closest('[data-rasgo]');
      if (tr) upd(id, f => { const t = f.rasgos[+tr.dataset.rasgo]; t[el.dataset.k] = el.value; t.manual = true; });
    });

    root.addEventListener('click', async e => {
      const id = openSheet && openSheet.id; if (!id) return;
      const t = e.target;
      const lvl = t.closest('[data-lvl]');
      if (lvl) {
        const d = +lvl.dataset.lvl;
        upd(id, f => { f.nivel = Math.max(1, Math.min(20, (f.nivel || 1) + d)); if (f.gen) TFF.npc.recalcular(f); });
        const f = S.find('personajes', id);
        ui.toast(`${f.nombre}: nivel ${f.nivel}${f.gen ? ` · ${f.pgMax} PG · CA ${f.ca}` : ''}`);
        return;
      }
      if (t.closest('[data-atk-add]')) upd(id, f => f.ataques.push({ n: 'Nuevo ataque', b: 0, d: '1d6', t: '', manual: true }));
      const ad = t.closest('[data-atk-del]'); if (ad) upd(id, f => f.ataques.splice(+ad.dataset.atkDel, 1));
      if (t.closest('[data-rasgo-add]')) upd(id, f => f.rasgos.push({ n: 'Nuevo rasgo', d: '', manual: true }));
      const rd = t.closest('[data-rasgo-del]'); if (rd) upd(id, f => f.rasgos.splice(+rd.dataset.rasgoDel, 1));
      const sd = t.closest('[data-spell-del]');
      if (sd) { const [k, n] = sd.dataset.spellDel.split(/:(.+)/); upd(id, f => { const arr = k === 't' ? f.conj.trucos : f.conj.lista; arr.splice(arr.indexOf(n), 1); }); }
      const pip = t.closest('[data-pip]');
      if (pip) { const [n, i] = pip.dataset.pip.split(':').map(Number); upd(id, f => { f.conj.usados = f.conj.usados || {}; const u = f.conj.usados[n] || 0; f.conj.usados[n] = i < u ? i : i + 1; }); }
      if (t.closest('[data-descanso]')) upd(id, f => { f.conj.usados = {}; f.pg = f.pgMax; });
      if (t.closest('[data-conj-add]')) upd(id, f => { const m = TFF.render.modOf(f.atr.car); f.conj = { c: 'car', cd: 8 + (f.comp || 2) + m, atk: (f.comp || 2) + m, espacios: {}, pacto: false, trucos: [], lista: [], usados: {} }; });
      if (t.closest('[data-proj-one]')) {
        S.update(st => st.personajes.forEach(f => { f.escena = f.id === id; }));
        S.setStage({ modo: 'fichas' });
        ui.toast('En el proyector.');
      }
      if (t.closest('[data-escena-toggle]')) upd(id, f => { f.escena = !f.escena; });
      if (t.closest('[data-dup]')) {
        const f = JSON.parse(JSON.stringify(S.find('personajes', id)));
        f.id = S.uid('f'); f.nombre += ' (copia)'; f.escena = false;
        S.update(st => st.personajes.push(f));
        openSheet.m.close(); abrirFicha(f.id);
      }
      if (t.closest('[data-del]')) {
        const f = S.find('personajes', id);
        if (!(await ui.confirmar(`¿Eliminar a ${f.nombre}? También desaparecerá de los acontecimientos donde aparece.`))) return;
        TFF.img.remove(f.img);
        S.update(st => { st.personajes = st.personajes.filter(x => x.id !== id); st.cronica.forEach(ev => { ev.enlaces = (ev.enlaces || []).filter(x => x !== id); }); });
        openSheet && openSheet.m.close();
      }
      if (t.closest('[data-dz-url]')) { e.stopPropagation(); const u = await ui.pedirURL(S.find('personajes', id).img || ''); if (u) setImg(id, u); }
      if (t.closest('[data-dz-clear]')) { e.stopPropagation(); const old = S.find('personajes', id).img; setImg(id, ''); TFF.img.remove(old); }
    });
    root.addEventListener('focusout', () => setTimeout(() => { if (openSheet && !openSheet.m.body.contains(document.activeElement)) refreshSheet(); }, 0));
  }

  /* ---------- Balance de encuentro ---------- */
  function renderEnc() {
    const st = S.state;
    const pjs = st.personajes.filter(f => f.tipo === 'pj' && f.enc && f.estado === 'activo');
    const ens = st.personajes.filter(f => f.tipo === 'enemigo' && f.enc && !TFF.render.isDown(f));
    const r = TFF.encuentro.calcular(pjs, ens);
    const max = Math.max(r.umbrales[3] * 1.35, r.aj * 1.05, 1);
    const pos = v => Math.min(100, v / max * 100);
    encEl.innerHTML = `
      <div class="kicker">Para el DM</div><h2>Balance de encuentro</h2>
      <div class="enc__sec"><span>Grupo (${pjs.length})</span><div class="enc__list">${pjs.map(f => `<div class="enc__row"><div>${esc(f.nombre)}<small>Nivel ${f.nivel} · ${f.pg}/${f.pgMax} PG · CA ${f.ca}</small></div><button data-enc-off="${f.id}" aria-label="Quitar del encuentro">×</button></div>`).join('') || '<p class="src">Ningún PJ marcado.</p>'}</div></div>
      <div class="enc__sec"><span>Enemigos (${ens.length})</span><div class="enc__list">${ens.map(f => `<div class="enc__row"><div>${esc(f.nombre)}<small>VD ${esc(f.vd || '—')} · ${TFF.encuentro.xpDe(f)} PX · ${f.pg}/${f.pgMax} PG</small></div><button data-enc-off="${f.id}" aria-label="Quitar del encuentro">×</button></div>`).join('') || '<p class="src">Ningún enemigo marcado.</p>'}</div></div>
      ${r.etiqueta ? `
      <div class="enc__sec meter"><span>PX ajustados: ${r.aj} (${r.base} × ${r.m})</span>
        <div class="meter__bar"><div class="meter__fill" style="width:${pos(r.aj)}%;background:${['var(--paper)', 'var(--acid)', 'var(--yellow)', '#e9883a', 'var(--rust)'][r.nivel]}"></div>${r.umbrales.map(u => `<i class="meter__tick" style="left:${pos(u)}%"></i>`).join('')}</div>
        <div class="meter__labels">${['Fácil', 'Medio', 'Difícil', 'Mortal'].map((l, i) => `<span style="left:${pos(r.umbrales[i])}%">${l}</span>`).join('')}</div>
      </div>
      <div class="verdict verdict--${r.etiqueta.k}"><small>Dificultad estimada</small><b>${r.etiqueta.label}</b></div>` : ''}
      <ul class="tips">${r.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      ${ens.length ? '<div class="row-actions" style="justify-content:flex-start"><button class="btn btn--sm" data-enc-scene>▶ Proyectar enemigos del encuentro</button></div>' : ''}
      <p class="src" style="margin-top:16px">Cálculo según la Guía del Dungeon Master: umbrales de PX por nivel y multiplicador por número de enemigos. Es orientativo: el terreno, la sorpresa y los conjuros cambian mucho una pelea.</p>`;
  }
  encEl.addEventListener('click', e => {
    const off = e.target.closest('[data-enc-off]');
    if (off) upd(off.dataset.encOff, f => { f.enc = false; });
    if (e.target.closest('[data-enc-scene]')) {
      S.update(st => st.personajes.forEach(f => { f.escena = f.tipo === 'enemigo' && f.enc && !TFF.render.isDown(f); }));
      S.setStage({ modo: 'fichas' });
    }
  });

  /* ---------- La Forja ---------- */
  function forja() {
    const opt = (arr, val = 'id', lab = 'nombre') => '<option value="azar">Al azar</option>' + arr.map(x => `<option value="${esc(x[val])}">${esc(x[lab])}</option>`).join('');
    const m = ui.modal({
      title: 'Forja de NPC', wide: true,
      body: `<div class="forge">
        <form class="forge__form" novalidate>
          <h2>La Forja</h2>
          <p>Elige lo que quieras fijar y deja el resto al azar. Cada NPC es una hoja de personaje completa de 5.ª edición.</p>
          <div class="field-row">
            <label class="field"><span>Tipo</span><select name="tipo"><option value="npc">NPC</option><option value="enemigo">Enemigo</option><option value="pj">PJ</option></select></label>
            <label class="field"><span>Nivel</span><select name="nivel"><option value="">1–5 al azar</option>${Array.from({ length: 20 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Raza</span><select name="raza">${opt(R.RAZAS)}</select></label>
          <label class="field"><span>Clase</span><select name="clase">${opt(R.CLASES)}</select></label>
          <label class="field"><span>Trasfondo</span><select name="trasfondo">${opt(R.TRASFONDOS)}</select></label>
          <div class="field-row">
            <label class="field"><span>Alineamiento</span><select name="alineamiento"><option value="azar">Al azar</option>${R.ALINEAMIENTOS.map(a => `<option>${a}</option>`).join('')}</select></label>
            <label class="field"><span>Actitud</span><select name="actitud"><option value="azar">Al azar</option>${R.PERS.actitud.map(a => `<option>${a}</option>`).join('')}</select></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Nombre (opcional)</span><input name="nombre" placeholder="Al azar según la raza"></label>
            <label class="field"><span>Nombres</span><select name="sexo"><option value="azar">Al azar</option><option value="m">Masculinos</option><option value="f">Femeninos</option></select></label>
          </div>
          <label class="field"><span>Rol en la historia (opcional)</span><input name="rol" placeholder="Ej.: Superviviente de la tripulación perdida"></label>
          <button class="btn forge__roll" type="submit">⚒ Forjar</button>
        </form>
        <div class="forge__preview" data-preview><div class="forge__empty">El NPC aparecerá aquí.<br>Pulsa “Forjar”.</div></div>
      </div>`
    });
    const form = $('form', m.el), prev = $('[data-preview]', m.el);
    let actual = null;
    const forjar = () => {
      const o = Object.fromEntries(new FormData(form));
      actual = TFF.npc.generar(o);
      prev.innerHTML = `${TFF.render.sheet(actual, { edit: false })}
        <div class="row-actions" style="justify-content:flex-start">
          <button class="btn btn--yellow" data-save>Guardar en el reparto</button>
          <button class="btn btn--ghost" data-save-open>Guardar y abrir ficha</button>
          <button class="btn btn--ghost" data-again>Volver a tirar</button>
        </div>`;
      if (TFF.gsapOk()) {
        gsap.from(prev.firstElementChild, { y: 30, rotate: -1.5, opacity: 0, duration: .45, ease: 'back.out(1.6)' });
        gsap.fromTo($('.forge__roll', m.el), { rotate: -3 }, { rotate: 0, duration: .4, ease: 'elastic.out(1.2, .4)' });
      }
    };
    form.addEventListener('submit', e => { e.preventDefault(); forjar(); });
    prev.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) forjar();
      const save = e.target.closest('[data-save], [data-save-open]');
      if (save && actual) {
        const f = actual;
        S.update(st => st.personajes.push(f));
        ui.toast(`${f.nombre} se une al reparto.`);
        if (save.hasAttribute('data-save-open')) { m.close(); abrirFicha(f.id); }
        else { actual = null; prev.innerHTML = '<div class="forge__empty">Guardado. Forja otro cuando quieras.</div>'; }
      }
    });
  }

  /* ---------- Bestiario ---------- */
  function bestiario() {
    const grupos = [...new Set(TFF.bestiario.map(b => b.grupo))];
    const m = ui.modal({
      title: 'Bestiario', wide: true,
      body: `<div class="bestiary">
        <div><div class="kicker">5.ª edición · SRD 5.1 y variantes de campaña</div><h2>Bestiario</h2>
        <p class="src">Elige cuántos añadir. Cada copia lleva sus propios PG. Las variantes de campaña indican en qué criatura del SRD se basan.</p>
        <label class="check"><input type="checkbox" data-to-enc checked> Añadir también al balance de encuentro</label></div>
        ${grupos.map(g => `<section class="bst-group"><h3>${esc(g)}</h3><div class="bst-list">${TFF.bestiario.filter(b => b.grupo === g).map(b => `
          <article class="bst" data-bst="${b.clave}">
            <b>${esc(b.nombre)}</b><span class="bst__vd">VD ${esc(b.vd)}</span>
            <small>${esc(b.categoria)} · CA ${b.ca} · ${b.pgMax} PG · ${b.xp} PX · ${esc(b.fuente)}</small>
            ${b.rol ? `<p>${esc(b.rol)}</p>` : ''}
            ${b.imgSugerida ? `<small>Imagen en tu carpeta: ${esc(b.imgSugerida)}</small>` : ''}
            <div class="bst__add"><input type="number" min="1" max="12" value="1" aria-label="Cantidad"><button class="btn btn--sm" data-add>Añadir</button><button class="btn btn--sm btn--ghost" data-peek>Ver ficha</button></div>
          </article>`).join('')}</div></section>`).join('')}
      </div>`
    });
    m.body.addEventListener('click', e => {
      const card = e.target.closest('[data-bst]'); if (!card) return;
      const b = TFF.bestiario.find(x => x.clave === card.dataset.bst);
      if (e.target.closest('[data-peek]')) {
        const f = TFF.npc.desdeBestiario(b);
        ui.modal({ title: b.nombre, wide: true, body: TFF.render.sheet(f, { edit: false }) });
      }
      if (e.target.closest('[data-add]')) {
        const n = Math.max(1, Math.min(12, parseInt($('input', card).value, 10) || 1));
        const enc = $('[data-to-enc]', m.el).checked;
        S.update(st => {
          const ya = st.personajes.filter(f => f.base === b.clave).length;
          for (let i = 0; i < n; i++) {
            const f = TFF.npc.desdeBestiario(b, n > 1 || ya ? ya + i + 1 : 0);
            f.enc = enc; st.personajes.push(f);
          }
        });
        ui.toast(`${n} × ${b.nombre} añadido${n > 1 ? 's' : ''}.`);
      }
    });
  }

  render();
})();
