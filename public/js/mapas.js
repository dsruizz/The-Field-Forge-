/* Página de mapas: biblioteca, encuadre, puntos de interés y capas para el proyector. */
(() => {
  const { $, $$, esc, ui, store: S } = TFF;
  const app = $('#app');
  const SEL_KEY = 'tff.mapas.sel';
  let selId = null;
  let adding = false;
  let skip = false;      // evita re-render mientras el DM edita o arrastra
  let ctrl = null;
  let ctrlFor = null;

  ui.topbar('mapas');
  S.load();
  try { selId = localStorage.getItem(SEL_KEY); } catch (e) {}

  app.innerHTML = `
    <div class="maps-layout">
      <aside class="maplib" aria-label="Biblioteca de mapas">
        <div class="kicker">Biblioteca</div><h2>Mapas</h2>
        <div class="maplib__drop dz" data-dz-click data-libdrop tabindex="0" role="button" aria-label="Añadir mapas: arrastra imágenes o haz clic">
          <div class="dz__empty"><b>+ Mapas</b>Arrastra una o varias imágenes, pégalas o haz clic</div>
        </div>
        <div class="maplib__list" data-list></div>
        <button class="btn btn--sm btn--ghost" data-blank style="margin-top:12px;width:100%">+ Mapa sin imagen</button>
      </aside>
      <section class="mapstage-wrap" aria-label="Vista previa">
        <div class="mapstage-bar" data-bar></div>
        <div class="mapstage-frame dz" data-frame><div data-mapr></div></div>
        <p class="mapstage-hint">Arrastra para mover · rueda para acercar · arrastra un punto para recolocarlo · suelta una imagen encima para cambiar el mapa. Lo que ves aquí es lo que ve la mesa.</p>
      </section>
      <aside class="mapprops" data-props aria-label="Propiedades del mapa"></aside>
    </div>`;

  const listEl = $('[data-list]', app);
  const barEl = $('[data-bar]', app);
  const frame = $('[data-frame]', app);
  const host = $('[data-mapr]', app);
  const props = $('[data-props]', app);

  const mapas = () => S.state.mapas || [];
  const sel = () => mapas().find(m => m.id === selId) || null;
  function select(id) {
    selId = id; adding = false;
    try { localStorage.setItem(SEL_KEY, id || ''); } catch (e) {}
    render();
  }
  const upd = (fn, quiet) => {
    const id = selId;
    if (quiet) skip = true;
    S.update(st => { const m = st.mapas.find(x => x.id === id); if (m) fn(m, st); });
    if (quiet) skip = false;
  };
  const nombreDe = file => (file && file.name ? file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s*\[.*?\]\s*/g, ' ').replace(/\s+u\s.*$/i, '').trim() : 'Mapa nuevo');
  const base = s => (s || '').split('/').pop().toLowerCase();

  /* ---------- Render ---------- */
  function render() {
    if (!sel() && mapas().length) selId = (mapas().find(m => m.id === S.stage.mapaId) || mapas()[0]).id;
    renderList();
    renderBar();
    renderPreview();
    if (!props.contains(document.activeElement)) renderProps();
  }

  function renderList() {
    const live = S.stage.modo === 'mapa' ? S.stage.mapaId : null;
    listEl.innerHTML = mapas().map(m => `
      <button class="mapitem ${m.id === selId ? 'is-sel' : ''} ${m.id === live ? 'is-live' : ''}" data-sel="${m.id}">
        <i ${m.img ? `data-bg="${esc(m.img)}"` : ''}></i>
        <span><b>${esc(m.nombre || 'Sin nombre')}</b><small>${esc(m.region || '')}${m.img ? '' : ' · sin imagen'}</small></span>
      </button>`).join('') || '<p class="src">Aún no hay mapas.</p>';
    TFF.img.hydrate(listEl);
  }

  function renderBar() {
    const m = sel();
    if (!m) { barEl.innerHTML = ''; return; }
    const live = S.stage.modo === 'mapa' && S.stage.mapaId === m.id;
    const z = (m.vista && m.vista.z) || 1;
    barEl.innerHTML = `
      <button class="btn btn--sm ${adding ? 'btn--yellow' : 'btn--ghost'}" data-add aria-pressed="${adding}">${adding ? 'Haz clic en el mapa…' : '+ Punto de interés'}</button>
      <div class="seg" role="group" aria-label="Zoom">
        <button data-zoom="-1" aria-label="Alejar">−</button><button data-zoom="0" title="Encuadrar todo"><span class="zoomval">${Math.round(z * 100)}%</span></button><button data-zoom="1" aria-label="Acercar">+</button>
      </div>
      ${S.stage.mapaSpot && (m.pois || []).some(p => p.id === S.stage.mapaSpot) ? '<button class="btn btn--sm btn--ghost" data-unspot>Quitar destacado</button>' : ''}
      <span class="grow"></span>
      ${live ? '<span class="tag tag--hito">En el proyector</span>' : ''}
      <button class="btn btn--sm" data-project>▶ Proyectar este mapa</button>`;
  }

  function renderPreview() {
    const m = sel();
    frame.classList.toggle('is-adding', adding);
    if (!m) {
      if (ctrl) { ctrl.destroy(); ctrl = null; ctrlFor = null; }
      host.className = ''; host.innerHTML = '<div class="dz__empty"><b>Sin mapas</b>Arrastra imágenes a la biblioteca</div>';
      return;
    }
    const spot = S.stage.mapaSpot;
    if (ctrl && ctrlFor === m.id) ctrl.update(m, { dm: true, spot });
    else {
      if (ctrl) ctrl.destroy();
      ctrl = TFF.render.mapa(host, m, { dm: true, spot });
      ctrlFor = m.id;
      ctrl.onAspect = ar => { if (Math.abs((sel()?.ar || 0) - ar) > 0.001) upd(mm => { mm.ar = ar; }, true); };
    }
  }

  function renderProps() {
    const m = sel();
    if (!m) { props.innerHTML = ''; return; }
    const ov = m.overlay || {};
    const tog = (k, label) => `<label class="check"><input type="checkbox" data-ov="${k}" ${ov[k] !== false ? 'checked' : ''}> ${label}</label>`;
    props.innerHTML = `
      <h3>Mapa</h3>
      <label class="field"><span>Nombre</span><input data-k="nombre" value="${esc(m.nombre)}"></label>
      <label class="field"><span>Región</span><input data-k="region" value="${esc(m.region)}"></label>
      <label class="field"><span>Descripción para la mesa</span><textarea data-k="desc" rows="3">${esc(m.desc)}</textarea></label>
      <div class="field-row">
        <label class="field"><span>Momento</span><input data-k="ambiente.momento" value="${esc(m.ambiente?.momento)}" list="dl-momento" placeholder="Atardecer"></label>
        <label class="field"><span>Clima</span><input data-k="ambiente.clima" value="${esc(m.ambiente?.clima)}" list="dl-clima" placeholder="Lluvia"></label>
      </div>
      <datalist id="dl-momento">${['Amanecer', 'Mañana', 'Mediodía', 'Tarde', 'Atardecer', 'Noche', 'Medianoche'].map(x => `<option>${x}</option>`).join('')}</datalist>
      <datalist id="dl-clima">${['Despejado', 'Bochorno', 'Lluvia', 'Tormenta', 'Niebla', 'Viento', 'Calma chicha'].map(x => `<option>${x}</option>`).join('')}</datalist>

      <h3>Capas en el proyector</h3>
      <div class="toggles">${tog('titulo', 'Título')}${tog('desc', 'Descripción')}${tog('ambiente', 'Momento y clima')}${tog('leyenda', 'Leyenda')}${tog('etiquetas', 'Nombres en puntos')}${tog('vineta', 'Viñeta')}</div>

      <h3>Puntos de interés <small class="src">${(m.pois || []).length}</small></h3>
      <div class="poi-list">${(m.pois || []).map(p => `
        <div class="poi-row ${p.visible === false ? 'is-off' : ''}" data-row="${p.id}">
          <span class="poi-row__n">${p.visible === false ? '·' : TFF.render.mapaVisibles(m).indexOf(p) + 1}</span>
          <div><input data-pk="label" value="${esc(p.label)}" placeholder="Nombre" aria-label="Nombre del punto">
            <textarea data-pk="desc" placeholder="Descripción breve (sale al destacarlo)" aria-label="Descripción del punto">${esc(p.desc)}</textarea></div>
          <div class="poi-row__tools">
            <button data-pa="spot" title="Mostrar su tarjeta en el proyector">${S.stage.mapaSpot === p.id ? '★ Activo' : 'Destacar'}</button>
            <button data-pa="vis">${p.visible === false ? 'Mostrar' : 'Ocultar'}</button>
            <button data-pa="zoom" title="Centrar la vista en este punto">Centrar</button>
            <button data-pa="del" aria-label="Eliminar punto">×</button>
          </div>
        </div>`).join('') || '<p class="src">Pulsa “+ Punto de interés” y haz clic en el mapa.</p>'}</div>

      <h3>Imagen</h3>
      <div class="field-row">
        <button class="btn btn--sm btn--ghost" data-img-pick>${m.img ? 'Cambiar imagen' : 'Subir imagen'}</button>
        <button class="btn btn--sm btn--ghost" data-img-url>Por URL</button>
      </div>
      ${m.hint ? `<p class="src" style="margin:10px 0 4px">Archivo sugerido de tu carpeta de mapas:</p><div class="hintfile">${esc(m.hint)}</div>` : ''}

      <h3>Notas del DM</h3>
      <label class="field"><span>Solo las ves tú</span><textarea data-k="notas" rows="4">${esc(m.notas)}</textarea></label>

      <button class="btn btn--sm btn--danger" data-del-map style="margin-top:8px">Eliminar mapa</button>`;
  }

  /* ---------- Imágenes ---------- */
  ui.dropzone($('[data-libdrop]', app), (ref, file) => {
    // Si el archivo coincide con un mapa preparado sin imagen, lo rellena; si no, crea uno nuevo.
    const hit = file && mapas().find(m => !m.img && m.hint && base(m.hint) === file.name.toLowerCase());
    let id;
    S.update(st => {
      if (hit) { const m = st.mapas.find(x => x.id === hit.id); m.img = ref; id = m.id; return; }
      const m = nuevoMapa(nombreDe(file)); m.img = ref; st.mapas.push(m); id = m.id;
    });
    ui.toast(hit ? `Imagen asignada a “${hit.nombre}”.` : 'Mapa añadido.');
    select(id);
  }, { max: 3200, multiple: true });

  const frameDz = ui.dropzone(frame, ref => {
    if (!sel()) { S.update(st => { const m = nuevoMapa('Mapa nuevo'); m.img = ref; st.mapas.push(m); selId = m.id; }); return; }
    const old = sel().img;
    upd(m => { m.img = ref; m.ar = null; m.vista = { x: 0, y: 0, z: 1 }; });
    if (old && old !== ref) TFF.img.remove(old);
  }, { max: 3200 });

  function nuevoMapa(nombre) {
    return {
      id: S.uid('map'), nombre, region: '', desc: '', img: '', hint: '', notas: '',
      ambiente: { momento: '', clima: '' },
      overlay: { titulo: true, desc: true, leyenda: true, ambiente: true, vineta: true, etiquetas: true },
      vista: { x: 0, y: 0, z: 1 }, pois: []
    };
  }

  /* ---------- Vista previa: mover, acercar, puntos ---------- */
  const clampV = v => {
    const z = Math.min(5, Math.max(1, v.z));
    const lim = 0.5 - 0.5 / z + 0.15;   // margen para no perder el mapa de vista
    return { z, x: Math.min(lim, Math.max(-lim, v.x)), y: Math.min(lim, Math.max(-lim, v.y)) };
  };
  let saveT = 0;
  function saveVista(v, now) {
    clearTimeout(saveT);
    const go = () => upd(m => { m.vista = v; }, true);
    // Durante un arrastre se guarda a ritmo moderado para que el proyector lo siga.
    if (now) go(); else saveT = setTimeout(go, 120);
    const zv = $('.zoomval', barEl); if (zv) zv.textContent = Math.round(v.z * 100) + '%';
  }
  function zoomAt(factor, cx, cy) {
    if (!ctrl) return;
    const v = ctrl.vista, s = ctrl.size;
    const r = host.getBoundingClientRect();
    const dx = cx == null ? 0 : cx - (r.left + r.width / 2);
    const dy = cy == null ? 0 : cy - (r.top + r.height / 2);
    const fx = 0.5 + v.x + dx / (s.w * v.z), fy = 0.5 + v.y + dy / (s.h * v.z);
    const z = Math.min(5, Math.max(1, v.z * factor));
    const nv = clampV({ z, x: fx - dx / (s.w * z) - 0.5, y: fy - dy / (s.h * z) - 0.5 });
    ctrl.setVista(nv, false);
    saveVista(nv);
  }

  host.addEventListener('wheel', e => {
    if (!ctrl || !sel()) return;
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  }, { passive: false });

  let drag = null;
  host.addEventListener('pointerdown', e => {
    if (!ctrl || !sel() || e.button !== 0 || e.target.closest('.dz__tools')) return;
    const poiEl = e.target.closest('[data-poi]');
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, poi: poiEl ? poiEl.dataset.poi : null, el: poiEl, v0: ctrl.vista };
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    if (drag.poi) {
      const f = ctrl.toFrac(e.clientX, e.clientY);
      drag.f = { x: Math.min(1, Math.max(0, f.x)), y: Math.min(1, Math.max(0, f.y)) };
      drag.el.style.left = drag.f.x * 100 + '%'; drag.el.style.top = drag.f.y * 100 + '%';
    } else {
      const s = ctrl.size, v = drag.v0;
      const nv = clampV({ z: v.z, x: v.x - dx / (s.w * v.z), y: v.y - dy / (s.h * v.z) });
      ctrl.setVista(nv, false);
      saveVista(nv);
    }
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.poi && d.moved && d.f) { upd(m => { const p = m.pois.find(x => x.id === d.poi); if (p) Object.assign(p, d.f); }); return; }
    if (d.poi && !d.moved) { focusRow(d.poi); return; }
    if (d.moved) { saveVista(ctrl.vista, true); return; }
    if (adding) {
      const f = ctrl.toFrac(e.clientX, e.clientY);
      if (f.x < 0 || f.x > 1 || f.y < 0 || f.y > 1) return;
      const id = S.uid('poi');
      upd(m => { m.pois = m.pois || []; m.pois.push({ id, x: f.x, y: f.y, label: 'Punto ' + (m.pois.length + 1), desc: '', visible: true }); });
      adding = false; renderBar(); frame.classList.remove('is-adding');
      renderProps(); focusRow(id, true);
    }
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) drag = null; });

  function focusRow(id, selectText) {
    const row = $(`[data-row="${id}"]`, props); if (!row) return;
    row.scrollIntoView({ block: 'nearest', behavior: TFF.reduceMotion() ? 'auto' : 'smooth' });
    const inp = $('[data-pk="label"]', row); inp.focus(); if (selectText) inp.select();
    if (TFF.gsapOk()) gsap.fromTo(row, { backgroundColor: '#5a5410' }, { backgroundColor: '#383838', duration: .9, clearProps: 'backgroundColor' });
  }

  /* ---------- Eventos ---------- */
  app.addEventListener('click', async e => {
    const t = e.target;
    const s = t.closest('[data-sel]'); if (s) return select(s.dataset.sel);
    if (t.closest('[data-blank]')) { const m = nuevoMapa('Mapa nuevo'); S.update(st => st.mapas.push(m)); return select(m.id); }
    const m = sel(); if (!m) return;
    if (t.closest('[data-add]')) { adding = !adding; renderBar(); frame.classList.toggle('is-adding', adding); return; }
    const z = t.closest('[data-zoom]');
    if (z) {
      const k = +z.dataset.zoom;
      if (k === 0) { const v = { x: 0, y: 0, z: 1 }; ctrl.setVista(v, true); saveVista(v, true); }
      else zoomAt(k > 0 ? 1.3 : 1 / 1.3);
      return;
    }
    if (t.closest('[data-project]')) { S.setStage({ modo: 'mapa', mapaId: m.id }); ui.toast(`Proyectando “${m.nombre}”.`); return; }
    if (t.closest('[data-unspot]')) { S.setStage({ mapaSpot: null }); return; }
    if (t.closest('[data-img-pick]')) { frameDz.pick(); return; }
    if (t.closest('[data-img-url]')) { const u = await ui.pedirURL(m.img && !m.img.startsWith('idb:') ? m.img : ''); if (u) upd(mm => { mm.img = u; mm.ar = null; }); return; }
    if (t.closest('[data-del-map]')) {
      if (!(await ui.confirmar(`¿Eliminar “${m.nombre}” y sus puntos?`))) return;
      const id = m.id, img = m.img;
      S.update(st => { st.mapas = st.mapas.filter(x => x.id !== id); });
      if (img) TFF.img.remove(img);
      if (S.stage.mapaId === id) S.setStage({ mapaId: null, mapaSpot: null, modo: S.stage.modo === 'mapa' ? 'portada' : S.stage.modo });
      selId = null; return render();
    }
    const pa = t.closest('[data-pa]');
    if (pa) {
      const pid = pa.closest('[data-row]').dataset.row;
      const p = m.pois.find(x => x.id === pid);
      const act = pa.dataset.pa;
      if (act === 'spot') {
        const on = S.stage.mapaSpot !== pid;
        if (on && p.visible === false) upd(mm => { mm.pois.find(x => x.id === pid).visible = true; });
        S.setStage(on ? { mapaSpot: pid, modo: 'mapa', mapaId: m.id } : { mapaSpot: null });
        if (on) ui.toast(`Destacando “${p.label || 'punto'}” en el proyector.`);
      }
      if (act === 'vis') {
        upd(mm => { const q = mm.pois.find(x => x.id === pid); q.visible = q.visible === false; });
        if (S.stage.mapaSpot === pid && p.visible !== false) S.setStage({ mapaSpot: null });
      }
      if (act === 'zoom') {
        const zz = Math.max(2, ctrl.vista.z);
        const v = clampV({ z: zz, x: p.x - 0.5, y: p.y - 0.5 });
        ctrl.setVista(v, true); saveVista(v, true);
      }
      if (act === 'del') {
        upd(mm => { mm.pois = mm.pois.filter(x => x.id !== pid); });
        if (S.stage.mapaSpot === pid) S.setStage({ mapaSpot: null });
      }
      renderProps();
    }
  });

  // Campos de texto: se guardan al escribir sin perder el foco.
  let typeT = 0;
  props.addEventListener('input', e => {
    const t = e.target;
    clearTimeout(typeT);
    typeT = setTimeout(() => {
      if (t.dataset.k) {
        const path = t.dataset.k.split('.');
        upd(m => { let o = m; while (path.length > 1) { const k = path.shift(); o = o[k] = o[k] || {}; } o[path[0]] = t.value; });
      }
      if (t.dataset.pk) {
        const pid = t.closest('[data-row]').dataset.row;
        upd(m => { const p = m.pois.find(x => x.id === pid); if (p) p[t.dataset.pk] = t.value; });
      }
    }, 200);
  });
  props.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ov) upd(m => { m.overlay = m.overlay || {}; m.overlay[t.dataset.ov] = t.checked; });
  });
  props.addEventListener('focusout', () => setTimeout(() => { if (!props.contains(document.activeElement)) renderProps(); }, 0));

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'Escape' && adding) { adding = false; renderBar(); frame.classList.remove('is-adding'); }
    if ((e.key === 'p' || e.key === 'P') && !e.altKey && !e.ctrlKey && !e.metaKey && sel()) { adding = !adding; renderBar(); frame.classList.toggle('is-adding', adding); }
  });

  S.on(kind => {
    if (skip) return;
    if (kind === 'state') render();
    if (kind === 'stage') { renderList(); renderBar(); renderPreview(); if (!props.contains(document.activeElement)) renderProps(); }
  });

  render();
})();
