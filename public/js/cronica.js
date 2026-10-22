/* Página de la crónica (vista del DM). */
(() => {
  const { $, $$, esc, ui, store: S } = TFF;
  const app = $('#app');
  let playerView = false;
  let firstRender = true;
  let skipRender = false;
  let justAdded = null;

  ui.topbar('cronica');
  S.load();

  /* ---------- Render ---------- */
  function render() {
    const y = window.scrollY;
    document.body.classList.toggle('is-dm', !playerView);
    app.innerHTML = TFF.render.pagina(S.state, { dm: !playerView, foco: S.stage.modo === 'cronica' ? S.stage.cronicaFoco : null });
    TFF.img.hydrate(app);
    if (!playerView) bindDropzones();
    if (firstRender) { intro(); firstRender = false; }
    else window.scrollTo(0, y);
    if (justAdded) {
      const el = $('#ev-' + justAdded);
      if (el) {
        el.scrollIntoView({ behavior: TFF.reduceMotion() ? 'auto' : 'smooth', block: 'center' });
        stampNuevo(el);
      }
      justAdded = null;
    }
    paintSubbar();
  }

  function intro() {
    if (!TFF.gsapOk()) return;
    gsap.registerPlugin(ScrollTrigger);
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero__kicker', { y: 16, opacity: 0, duration: .5 })
      .from('.hero__title', { y: 50, opacity: 0, skewY: 3, duration: .8 }, '-=.25')
      .from('.hero__lede', { y: 20, opacity: 0, duration: .6 }, '-=.45')
      .from('.hero__frame', { x: 60, rotate: 9, opacity: 0, duration: .9 }, '-=.7')
      .from('.hero .burst', { scale: 0, rotate: -120, duration: .7, ease: 'back.out(2.2)' }, '-=.4')
      .from('.party__card', { y: 30, opacity: 0, stagger: .08, duration: .5 }, '-=.4');
    gsap.utils.toArray('.thread').forEach((el, i) => gsap.from(el, { x: -20, opacity: 0, duration: .4, delay: i * .05, scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
    gsap.utils.toArray('.chapter').forEach(el => gsap.from(el.children, { y: 40, opacity: 0, stagger: .1, duration: .7, scrollTrigger: { trigger: el, start: 'top 85%', once: true } }));
    gsap.utils.toArray('.ev').forEach((el, i) => {
      const odd = i % 2;
      gsap.from($('.ev__panel', el), { x: odd ? 40 : -40, rotate: odd ? 1.5 : -1.5, opacity: 0, duration: .7, scrollTrigger: { trigger: el, start: 'top 82%', once: true } });
      const art = $('.ev__art', el);
      if (art) gsap.from(art, { y: 50, rotate: odd ? -6 : 6, opacity: 0, duration: .8, delay: .1, scrollTrigger: { trigger: el, start: 'top 82%', once: true } });
      gsap.from($('.ev__n', el), { scale: 0, duration: .5, ease: 'back.out(3)', scrollTrigger: { trigger: el, start: 'top 82%', once: true } });
    });
  }

  function stampNuevo(el) {
    const b = document.createElement('div');
    b.className = 'burst ev__new'; b.innerHTML = '<span>¡Nuevo!</span>';
    $('.ev__panel', el).appendChild(b);
    if (TFF.gsapOk()) {
      gsap.from(b, { scale: 0, rotate: -90, duration: .6, ease: 'back.out(2.5)' });
      gsap.from($('.ev__panel', el), { y: 30, opacity: 0, duration: .6, ease: 'power3.out' });
      gsap.to(b, { opacity: 0, scale: .6, delay: 4, duration: .4, onComplete: () => b.remove() });
    } else setTimeout(() => b.remove(), 4000);
  }

  S.on((kind) => {
    if (kind === 'state') { if (skipRender) { skipRender = false; return; } render(); }
    if (kind === 'stage') { paintSubbar(); $$('.ev.is-focus').forEach(e => e.classList.remove('is-focus')); if (S.stage.modo === 'cronica' && S.stage.cronicaFoco) $('#ev-' + S.stage.cronicaFoco)?.classList.add('is-focus'); }
  });

  /* ---------- Barra del DM ---------- */
  const sub = document.createElement('div');
  sub.className = 'subbar';
  sub.innerHTML = `
    <div class="seg" role="group" aria-label="Vista"><button data-view="dm" class="is-on">Vista DM</button><button data-view="jugador">Vista jugador</button></div>
    <div class="subbar__ses"><span>Sesión en juego</span><button class="btn btn--sm btn--ghost btn--icon" data-ses="-1" aria-label="Sesión anterior">−</button><b data-ses-val></b><button class="btn btn--sm btn--ghost btn--icon" data-ses="1" aria-label="Sesión siguiente">+</button></div>
    <span class="grow"></span>
    <button class="btn btn--sm btn--ghost" data-go-end>Ir al último ↓</button>
    <button class="btn btn--sm" data-proj-chron>▶ Proyectar crónica</button>`;
  document.querySelector('.topbar').after(sub);
  function paintSubbar() {
    $('[data-ses-val]', sub).textContent = String(S.state.campana.sesionActual).padStart(2, '0');
    $$('[data-view]', sub).forEach(b => b.classList.toggle('is-on', (b.dataset.view === 'jugador') === playerView));
  }
  sub.addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v) { playerView = v.dataset.view === 'jugador'; render(); }
    const s = e.target.closest('[data-ses]');
    if (s) S.update(st => { st.campana.sesionActual = Math.max(1, st.campana.sesionActual + Number(s.dataset.ses)); const k = st.campana.sesionActual; st.campana.sesiones[k] = st.campana.sesiones[k] || 'Nueva sesión'; });
    if (e.target.closest('[data-go-end]')) { const evs = $$('.ev'); (evs[evs.length - 1] || $('.chron__end')).scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (e.target.closest('[data-proj-chron]')) {
      const visibles = S.state.cronica.filter(x => !x.oculto);
      const last = visibles[visibles.length - 1];
      S.setStage({ modo: 'cronica', cronicaFoco: last ? last.id : null });
      ui.toast('Proyectando la crónica en el último acontecimiento.');
    }
  });

  /* ---------- Imágenes ---------- */
  function setImg(kind, id, ref) {
    S.update(st => {
      if (kind === 'portada') { st.campana.portada = ref; return; }
      const ev = st.cronica.find(x => x.id === id); if (ev) ev.img = ref;
    });
  }
  function currentRef(kind, id) { return kind === 'portada' ? S.state.campana.portada : (S.find('cronica', id) || {}).img; }
  function bindDropzones() {
    $$('[data-dz]', app).forEach(el => {
      const kind = el.dataset.dz, id = el.dataset.evArt;
      if (!currentRef(kind, id)) el.setAttribute('data-dz-click', '');
      ui.dropzone(el, ref => { setImg(kind, id, ref); ui.toast('Imagen guardada.'); }, { max: 2200 });
    });
  }
  app.addEventListener('click', async e => {
    const urlBtn = e.target.closest('[data-dz-url]');
    const clr = e.target.closest('[data-dz-clear]');
    const host = (urlBtn || clr) && (urlBtn || clr).closest('[data-dz]');
    if (!host) return;
    e.stopPropagation();
    const kind = host.dataset.dz, id = host.dataset.evArt;
    if (urlBtn) { const u = await ui.pedirURL(currentRef(kind, id) || ''); if (u) setImg(kind, id, u); }
    if (clr) { const old = currentRef(kind, id); setImg(kind, id, ''); TFF.img.remove(old); }
  });

  /* ---------- Texto editable en línea ---------- */
  app.addEventListener('focusout', e => {
    const el = e.target;
    const txt = el.innerText.trim();
    if (el.dataset.edit) { skipRender = true; S.update(st => { st.campana[el.dataset.edit] = txt; }); }
    if (el.dataset.editSesion) { skipRender = true; S.update(st => { st.campana.sesiones[el.dataset.editSesion] = txt; }); }
    if (el.hasAttribute('data-edit-hilo')) {
      const id = el.closest('[data-hilo]').dataset.hilo;
      skipRender = true; S.update(st => { const h = st.hilos.find(x => x.id === id); if (h) h.texto = txt; });
    }
  });
  app.addEventListener('keydown', e => {
    if (e.target.isContentEditable && e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'P') { e.preventDefault(); e.target.blur(); }
  });

  /* ---------- Hilos ---------- */
  app.addEventListener('click', async e => {
    const add = e.target.closest('[data-hilo-add]');
    if (add) {
      const id = S.uid('h');
      S.update(st => st.hilos.push({ id, texto: 'Nuevo hilo', estado: 'abierto' }));
      const el = $(`[data-hilo="${id}"] .thread__txt`);
      if (el) { el.focus(); document.getSelection().selectAllChildren(el); }
      return;
    }
    const act = e.target.closest('[data-hilo-act]');
    if (!act) return;
    const id = act.closest('[data-hilo]').dataset.hilo;
    if (act.dataset.hiloAct === 'toggle') S.update(st => { const h = st.hilos.find(x => x.id === id); h.estado = h.estado === 'abierto' ? 'resuelto' : 'abierto'; });
    if (act.dataset.hiloAct === 'borrar' && await ui.confirmar('¿Eliminar este hilo?')) S.update(st => { st.hilos = st.hilos.filter(x => x.id !== id); });
  });

  /* ---------- Acciones de acontecimientos ---------- */
  app.addEventListener('click', async e => {
    const b = e.target.closest('.ev__tools [data-act]'); if (!b) return;
    const id = b.closest('[data-ev]').dataset.ev;
    const ev = S.find('cronica', id);
    switch (b.dataset.act) {
      case 'proyectar':
        if (ev.oculto) S.update(st => { st.cronica.find(x => x.id === id).oculto = false; });
        S.setStage({ modo: 'cronica', cronicaFoco: id });
        ui.toast('En el proyector: ' + ev.titulo);
        break;
      case 'editar': composer(ev); break;
      case 'ocultar': S.update(st => { const x = st.cronica.find(y => y.id === id); x.oculto = !x.oculto; }); break;
      case 'subir': case 'bajar': mover(id, b.dataset.act === 'subir' ? -1 : 1); break;
      case 'borrar':
        if (await ui.confirmar(`¿Eliminar “${ev.titulo}” de la crónica?`)) { TFF.img.remove(ev.img); S.update(st => { st.cronica = st.cronica.filter(x => x.id !== id); }); }
        break;
    }
  });
  function mover(id, dir) {
    S.update(st => {
      const arr = st.cronica, i = arr.findIndex(x => x.id === id), ses = arr[i].sesion;
      let j = i + dir;
      while (j >= 0 && j < arr.length && arr[j].sesion !== ses) j += dir;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });
  }

  /* ---------- Editor de acontecimientos ---------- */
  function composer(ev = null) {
    const st = S.state;
    const data = ev ? JSON.parse(JSON.stringify(ev)) : { tipo: 'escena', titulo: '', texto: '', cita: '', lugar: (st.cronica[st.cronica.length - 1] || {}).lugar || '', sesion: st.campana.sesionActual, enlaces: [], img: '', oculto: false };
    const lugares = [...new Set(st.cronica.map(x => x.lugar).filter(Boolean))];
    const orden = { pj: 0, npc: 1, enemigo: 2 };
    const fichas = [...st.personajes].sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.nombre.localeCompare(b.nombre));
    const m = ui.modal({
      title: ev ? 'Editar acontecimiento' : 'Nuevo acontecimiento',
      body: `<h3 class="modal__title">${ev ? 'Editar acontecimiento' : 'Nuevo acontecimiento'}</h3>
        <form class="composer" novalidate>
          <label class="field"><span>Título</span><input name="titulo" required maxlength="90" value="${esc(data.titulo)}" placeholder="Ej.: Velas negras en el horizonte" autofocus></label>
          <div class="field"><span>Tipo</span><div class="typepick">${Object.entries(TFF.render.TIPOS).map(([k, v]) => `<button type="button" data-tipo="${k}" class="${k === data.tipo ? 'is-on tag tag--' + k : ''}">${v}</button>`).join('')}</div></div>
          <label class="field"><span>Qué pasó</span><textarea name="texto" rows="4" placeholder="Dos o tres frases. Se leerá en la pantalla.">${esc(data.texto)}</textarea></label>
          <label class="field"><span>Frase destacada (opcional)</span><input name="cita" maxlength="120" value="${esc(data.cita)}" placeholder="Una línea que resuma la escena"></label>
          <div class="field-row">
            <label class="field"><span>Lugar</span><input name="lugar" list="lugares" value="${esc(data.lugar)}"><datalist id="lugares">${lugares.map(l => `<option value="${esc(l)}">`).join('')}</datalist></label>
            <label class="field"><span>Sesión</span><input name="sesion" type="number" min="1" value="${data.sesion}"></label>
          </div>
          <div class="field"><span>Quién participa</span><div class="whopick">${fichas.map(f => `<button type="button" data-who="${f.id}" class="${data.enlaces.includes(f.id) ? 'is-on' : ''}">${esc(f.nombre)}</button>`).join('')}</div></div>
          <div class="field"><span>Imagen</span><div class="composer-art dz ${data.img ? 'has-img' : ''}" data-dz-click ${data.img ? `data-bg="${esc(data.img)}"` : ''}><div class="dz__empty"><b>Arrastra aquí</b>o haz clic · también puedes pegar (Ctrl+V)</div></div></div>
          <label class="check"><input type="checkbox" name="oculto" ${data.oculto ? 'checked' : ''}> Ocultar a los jugadores por ahora</label>
          <div class="row-actions">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn--ghost" data-save="1">Guardar</button>
            <button type="submit" class="btn" data-save="2">Guardar y proyectar</button>
          </div>
        </form>`
    });
    const form = $('form', m.el);
    TFF.img.hydrate(m.el);
    const art = $('.composer-art', m.el);
    ui.dropzone(art, ref => { data.img = ref; art.dataset.bg = ref; art.classList.add('has-img'); TFF.img.hydrate(m.el); }, { max: 2200 });
    $$('[data-tipo]', m.el).forEach(btn => btn.onclick = () => {
      data.tipo = btn.dataset.tipo;
      $$('[data-tipo]', m.el).forEach(x => { x.className = x === btn ? 'is-on tag tag--' + x.dataset.tipo : ''; });
    });
    $$('[data-who]', m.el).forEach(btn => btn.onclick = () => {
      const id = btn.dataset.who;
      data.enlaces = data.enlaces.includes(id) ? data.enlaces.filter(x => x !== id) : [...data.enlaces, id];
      btn.classList.toggle('is-on');
    });
    let proyectar = false;
    $$('[data-save]', m.el).forEach(btn => btn.onclick = () => { proyectar = btn.dataset.save === '2'; });
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { proyectar = true; form.requestSubmit(); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const titulo = fd.get('titulo').trim();
      if (!titulo) { ui.toast('Ponle un título al acontecimiento.', 'error'); $('[name=titulo]', form).focus(); return; }
      Object.assign(data, { titulo, texto: fd.get('texto').trim(), cita: fd.get('cita').trim(), lugar: fd.get('lugar').trim(), sesion: Math.max(1, parseInt(fd.get('sesion'), 10) || 1), oculto: fd.get('oculto') === 'on' });
      const id = ev ? ev.id : S.uid('ev');
      if (!ev) justAdded = id;
      S.update(st => {
        if (ev) Object.assign(st.cronica.find(x => x.id === ev.id), data);
        else st.cronica.push(Object.assign(data, { id, t: Date.now() }));
        st.campana.sesiones[data.sesion] = st.campana.sesiones[data.sesion] || 'Nueva sesión';
      });
      if (proyectar) {
        if (data.oculto) S.update(st => { st.cronica.find(x => x.id === id).oculto = false; });
        S.setStage({ modo: 'cronica', cronicaFoco: id });
        S.pulse('nuevo', id);
      }
      m.close();
      ui.toast(ev ? 'Acontecimiento actualizado.' : 'Acontecimiento añadido a la crónica.');
    });
  }

  const fab = document.createElement('button');
  fab.className = 'btn composer-fab';
  fab.innerHTML = '+ Acontecimiento <kbd>N</kbd>';
  fab.onclick = () => composer();
  document.body.appendChild(fab);
  document.addEventListener('keydown', e => {
    const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n' && !document.querySelector('.modal') && !playerView) { e.preventDefault(); composer(); }
  });

  render();
})();
