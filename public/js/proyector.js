/* Ventana del proyector: muestra lo que el DM elige (portada, crónica, mapa, fichas o negro).
   No tiene controles propios: todo se maneja desde las otras páginas. */
(() => {
  TFF.role = 'proyector';
  const { $, $$, esc, store: S } = TFF;
  const stage = $('#stage');
  const hint = $('#hint');
  let modoActual = null;
  let mapaActual = null;
  let sec = null;
  let mapCtrl = null;
  let lastPulse = 0;
  let lastSpot = null;
  let cardsIds = [];

  S.load();
  lastPulse = (S.stage.pulso && S.stage.pulso.t) || 0;
  const anim = () => TFF.gsapOk();

  /* ---------- Constructores por modo ---------- */
  function portada() {
    const c = S.state.campana;
    const [t1, ...t2] = c.titulo.split(' de ');
    return `${c.portada ? `<div class="art" data-bg="${esc(c.portada)}"></div>` : ''}
      <div class="cover__inner">
        <span class="logo-full" role="img" aria-label="The Field Forge"></span>
        <h1>${esc(t1)}${t2.length ? `<span>de ${esc(t2.join(' de '))}</span>` : ''}</h1>
        <div class="kicker">${esc(c.kicker)}</div>
      </div>
      <div class="burst"><span>Sesión<b>${String(c.sesionActual).padStart(2, '0')}</b></span></div>`;
  }

  function fichas() {
    const fs = S.state.personajes.filter(f => f.escena);
    if (!fs.length) return `<div class="stage-empty"><span class="logo-full"></span><p>Sin fichas en escena</p></div>`;
    return `<div class="pcards ${fs.length > 4 ? 'is-many' : ''} ${fs.length > 6 ? 'is-lots' : ''}" data-n="${fs.length}">${fs.map(f => TFF.render.pcard(f, S.stage.detalle)).join('')}</div>`;
  }

  function build(modo) {
    const el = document.createElement('section');
    el.dataset.modo = modo;
    if (modo === 'portada') { el.className = 'stage-cover'; el.innerHTML = portada(); }
    if (modo === 'negro') el.className = 'stage-black';
    if (modo === 'cronica') {
      el.className = 'stage-chron is-proj';
      el.innerHTML = TFF.render.pagina(S.state, { dm: false, foco: S.stage.cronicaFoco });
    }
    if (modo === 'fichas') {
      el.className = 'stage-cards';
      el.innerHTML = fichas();
      cardsIds = S.state.personajes.filter(f => f.escena).map(f => f.id);
    }
    if (modo === 'mapa') {
      el.className = 'stage-map';
      const m = S.find('mapas', S.stage.mapaId);
      if (!m) el.innerHTML = '<div class="stage-empty"><span class="logo-full"></span><p>Sin mapa</p></div>';
      else {
        const host = document.createElement('div');
        el.appendChild(host);
        stage.appendChild(el); // el renderer necesita medir el contenedor
        mapCtrl = TFF.render.mapa(host, m, { dm: false, spot: S.stage.mapaSpot });
        lastSpot = S.stage.mapaSpot;
      }
      mapaActual = S.stage.mapaId;
    }
    TFF.img.hydrate(el);
    return el;
  }

  /* ---------- Entradas ---------- */
  function entrar(el, modo) {
    if (!anim()) return;
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power1.out' });
    if (modo === 'portada') {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from($('.logo-full', el), { y: -30, opacity: 0, duration: .6 }, .1)
        .from($('h1', el), { y: 60, opacity: 0, skewY: 4, duration: .9 }, .25)
        .from($('.kicker', el), { opacity: 0, y: 14, duration: .5 }, .7)
        .from($('.burst', el), { scale: 0, rotate: -120, duration: .7, ease: 'back.out(2)' }, .8);
      const art = $('.art', el);
      if (art) gsap.fromTo(art, { scale: 1.12 }, { scale: 1, duration: 8, ease: 'none' });
    }
    if (modo === 'fichas') gsap.from($$('.pcard', el), { y: 80, opacity: 0, rotate: i => (i % 2 ? 2 : -2), duration: .7, stagger: .1, ease: 'power3.out', delay: .15 });
    if (modo === 'mapa') mapaEntrada(el);
    if (modo === 'cronica') gsap.from($('.ev.is-focus .ev__panel', el) || $('.hero', el), { y: 40, opacity: 0, duration: .8, ease: 'power3.out', delay: .3 });
  }

  function mapaEntrada(el) {
    if (!anim()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from($('.mapr__world', el), { opacity: 0, duration: 1 }, 0)
      .from($('.ovl-title', el), { x: -50, opacity: 0, duration: .7 }, .4)
      .from($('.ovl-amb', el), { y: -20, opacity: 0, duration: .5 }, .6)
      .from($('.ovl-legend', el), { x: 50, opacity: 0, duration: .6 }, .7)
      .from($$('.poi', el), { scale: 0, opacity: 0, duration: .4, stagger: .06, ease: 'back.out(2)', clearProps: 'scale' }, .8);
  }

  function cambiarA(modo) {
    const viejo = sec;
    if (mapCtrl && modo !== 'mapa') { mapCtrl.destroy(); mapCtrl = null; }
    if (viejo && viejo.dataset.modo === 'mapa' && mapCtrl) { mapCtrl.destroy(); mapCtrl = null; }
    sec = build(modo);
    if (!sec.isConnected) stage.appendChild(sec);
    modoActual = modo;
    if (modo === 'cronica') enfocar(false);
    entrar(sec, modo);
    if (viejo) {
      if (anim()) gsap.to(viejo, { opacity: 0, duration: .4, onComplete: () => viejo.remove() });
      else viejo.remove();
    }
  }

  /* ---------- Actualizaciones sin cambiar de modo ---------- */
  function refrescar() {
    const modo = modoActual;
    if (modo === 'portada') { sec.innerHTML = portada(); TFF.img.hydrate(sec); }
    if (modo === 'cronica') {
      const y = sec.scrollTop;
      sec.innerHTML = TFF.render.pagina(S.state, { dm: false, foco: S.stage.cronicaFoco });
      TFF.img.hydrate(sec);
      sec.style.scrollBehavior = 'auto'; sec.scrollTop = y; sec.style.scrollBehavior = '';
      enfocar(true);
    }
    if (modo === 'fichas') {
      const ids = S.state.personajes.filter(f => f.escena).map(f => f.id);
      sec.innerHTML = fichas();
      TFF.img.hydrate(sec);
      const nuevas = $$('.pcard', sec).filter(c => !cardsIds.includes(c.dataset.f));
      if (anim() && nuevas.length) gsap.from(nuevas, { y: 60, opacity: 0, duration: .6, stagger: .08, ease: 'power3.out' });
      cardsIds = ids;
    }
    if (modo === 'mapa' && mapCtrl) {
      const m = S.find('mapas', S.stage.mapaId);
      if (!m) return cambiarA('mapa');
      const spot = S.stage.mapaSpot;
      mapCtrl.update(m, { dm: false, spot, animate: true });
      if (spot && spot !== lastSpot && anim()) {
        const box = $('.ovl-spot', sec);
        if (box && !box.hidden) gsap.from(box, { scale: .85, opacity: 0, duration: .45, ease: 'back.out(2)' });
        const p = $(`[data-poi="${spot}"] .poi__dot`, sec);
        if (p) gsap.fromTo(p, { scale: 2.2 }, { scale: 1, duration: .6, ease: 'back.out(3)', clearProps: 'scale' });
      }
      lastSpot = spot;
    }
  }

  // Centra el acontecimiento enfocado y aviva sus vecinos.
  function enfocar(suave) {
    const id = S.stage.cronicaFoco;
    const el = id && $('#ev-' + id, sec);
    $$('.ev', sec).forEach(e => e.classList.remove('is-near'));
    if (!el) return;
    el.previousElementSibling?.classList.contains('ev') && el.previousElementSibling.classList.add('is-near');
    el.nextElementSibling?.classList.contains('ev') && el.nextElementSibling.classList.add('is-near');
    const r = el.getBoundingClientRect(), sr = sec.getBoundingClientRect();
    const top = sec.scrollTop + r.top - sr.top - Math.max(40, (sr.height - r.height) / 2);
    sec.scrollTo({ top: Math.max(0, top), behavior: suave && !TFF.reduceMotion() ? 'smooth' : 'auto' });
  }

  function sello(id) {
    const el = $('#ev-' + id, sec); if (!el) return;
    const b = document.createElement('div');
    b.className = 'burst ev__new'; b.innerHTML = '<span>¡Nuevo!</span>';
    $('.ev__panel', el).appendChild(b);
    if (anim()) {
      gsap.from($('.ev__panel', el), { y: 50, opacity: 0, duration: .8, ease: 'power3.out', delay: .4 });
      gsap.from(b, { scale: 0, rotate: -90, duration: .7, ease: 'back.out(2.5)', delay: 1 });
      gsap.to(b, { opacity: 0, scale: .6, delay: 7, duration: .5, onComplete: () => b.remove() });
    } else setTimeout(() => b.remove(), 7000);
  }

  /* ---------- Sincronía ---------- */
  function onStage() {
    const sg = S.stage;
    const cambioMapa = sg.modo === 'mapa' && modoActual === 'mapa' && sg.mapaId !== mapaActual;
    if (sg.modo !== modoActual || cambioMapa) cambiarA(sg.modo);
    else if (modoActual === 'cronica') {
      $$('.ev.is-focus', sec).forEach(e => e.classList.remove('is-focus'));
      $('#ev-' + sg.cronicaFoco, sec)?.classList.add('is-focus');
      enfocar(true);
    } else refrescar();
    if (sg.pulso && sg.pulso.t > lastPulse) {
      lastPulse = sg.pulso.t;
      if (sg.pulso.tipo === 'nuevo' && modoActual === 'cronica') setTimeout(() => sello(sg.pulso.id), 350);
    }
  }
  S.on(kind => {
    if (kind === 'state' && sec) refrescar();
    if (kind === 'stage') onStage();
  });

  /* ---------- Pantalla completa, aviso y cursor ---------- */
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  document.addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') fullscreen(); });
  stage.addEventListener('dblclick', fullscreen);
  const ocultarAviso = () => hint.classList.add('is-gone');
  setTimeout(ocultarAviso, 7000);
  document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) ocultarAviso(); });
  let idleT = 0;
  const despertar = () => {
    document.body.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(() => document.body.classList.add('idle'), 2500);
  };
  document.addEventListener('mousemove', despertar);
  despertar();
  window.addEventListener('resize', () => { if (modoActual === 'cronica') enfocar(false); });

  document.title = 'Proyector · ' + S.state.campana.titulo;
  cambiarA(S.stage.modo || 'portada');
})();
