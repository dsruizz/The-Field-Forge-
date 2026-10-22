/* The Field Forge — utilidades de interfaz compartidas por las páginas del DM. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsapOk = () => window.gsap && !reduceMotion();

  /* ---------- Avisos ---------- */
  function toast(msg, kind = 'ok') {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast toast--' + kind; t.textContent = msg; box.appendChild(t);
    if (gsapOk()) gsap.from(t, { y: 16, opacity: 0, rotate: -2, duration: .35, ease: 'back.out(2)' });
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, kind === 'error' ? 6000 : 2600);
  }

  /* ---------- Modal ---------- */
  function modal({ title = '', body = '', wide = false, className = '', onClose } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal ' + className;
    wrap.innerHTML = `<div class="modal__backdrop" data-close></div>
      <div class="modal__box ${wide ? 'modal__box--wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button class="modal__x" data-close aria-label="Cerrar">×</button>
        <div class="modal__body"></div>
      </div>`;
    const bodyEl = $('.modal__body', wrap);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    document.body.appendChild(wrap);
    document.body.classList.add('has-modal');
    const prevFocus = document.activeElement;
    const close = () => {
      wrap.remove();
      if (!$('.modal')) document.body.classList.remove('has-modal');
      document.removeEventListener('keydown', onKey);
      onClose && onClose();
      prevFocus && prevFocus.focus?.();
    };
    const onKey = e => { if (e.key === 'Escape' && wrap === $$('.modal').pop()) close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    if (gsapOk()) {
      gsap.from($('.modal__box', wrap), { y: 30, rotate: 1.2, opacity: 0, duration: .35, ease: 'power3.out' });
      gsap.from($('.modal__backdrop', wrap), { opacity: 0, duration: .25 });
    }
    setTimeout(() => ($('[autofocus]', wrap) || $('.modal__x', wrap)).focus(), 30);
    return { el: wrap, body: bodyEl, close };
  }

  function confirmar(texto, { ok = 'Eliminar', peligro = true } = {}) {
    return new Promise(res => {
      const m = modal({
        title: 'Confirmar',
        body: `<p class="confirm__text">${esc(texto)}</p>
          <div class="row-actions"><button class="btn btn--ghost" data-no>Cancelar</button>
          <button class="btn ${peligro ? 'btn--danger' : ''}" data-yes autofocus>${esc(ok)}</button></div>`,
        className: 'modal--small',
        onClose: () => res(false)
      });
      $('[data-yes]', m.el).onclick = () => { res(true); m.close(); };
      $('[data-no]', m.el).onclick = () => m.close();
    });
  }

  /* ---------- Zona de imagen: arrastrar, pegar, elegir o URL ---------- */
  // el: elemento destino. onImage(ref) recibe 'idb:...' o una URL.
  function dropzone(el, onImage, { max = 1400, multiple = false } = {}) {
    if (el.__dz) return; el.__dz = true;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = multiple; input.hidden = true;
    el.appendChild(input);
    const handleFiles = async files => {
      const imgs = [...files].filter(f => f.type.startsWith('image/'));
      if (!imgs.length) { toast('Ese archivo no es una imagen.', 'error'); return; }
      el.classList.add('is-busy');
      try {
        for (const f of (multiple ? imgs : imgs.slice(0, 1))) onImage(await TFF.img.put(f, { max }), f);
      } catch (e) { console.error(e); toast('No se pudo guardar la imagen.', 'error'); }
      el.classList.remove('is-busy');
    };
    el.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('is-over'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('is-over'); });
    el.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); el.classList.remove('is-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length) return handleFiles(e.dataTransfer.files);
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (/^https?:\/\//.test(url)) onImage(url.trim());
    });
    el.addEventListener('click', e => {
      if (e.target === input || e.target.closest('[data-dz-skip]')) return;
      if (e.target.closest('[data-dz-pick]') || el.hasAttribute('data-dz-click')) input.click();
    });
    input.addEventListener('change', () => { if (input.files.length) handleFiles(input.files); input.value = ''; });
    el.addEventListener('paste', e => {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); handleFiles(files); }
    });
    return { pick: () => input.click() };
  }

  // Botón “pegar URL” reutilizable.
  async function pedirURL(actual = '') {
    return new Promise(res => {
      const m = modal({
        title: 'Imagen por URL',
        className: 'modal--small',
        body: `<h3 class="modal__title">Imagen por URL</h3>
          <label class="field"><span>Dirección de la imagen</span><input type="url" value="${esc(actual.startsWith('idb:') ? '' : actual)}" placeholder="https://…/imagen.jpg" autofocus></label>
          <div class="row-actions"><button class="btn btn--ghost" data-close>Cancelar</button><button class="btn" data-ok>Usar imagen</button></div>`,
        onClose: () => res(null)
      });
      const inp = $('input', m.el);
      const ok = () => { const v = inp.value.trim(); res(v || null); m.close(); };
      $('[data-ok]', m.el).onclick = ok;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    });
  }

  /* ---------- Barra superior y control del proyector ---------- */
  const PAGES = [
    { href: 'index.html', id: 'cronica', label: 'Crónica' },
    { href: 'personajes.html', id: 'personajes', label: 'Personajes' },
    { href: 'mapas.html', id: 'mapas', label: 'Mapas' }
  ];
  const MODES = [
    { id: 'portada', label: 'Portada', key: '1' },
    { id: 'cronica', label: 'Crónica', key: '2' },
    { id: 'mapa', label: 'Mapa', key: '3' },
    { id: 'fichas', label: 'Fichas', key: '4' },
    { id: 'negro', label: 'Negro', key: '0' }
  ];

  let projWin = null;
  function abrirProyector() {
    if (projWin && !projWin.closed) { projWin.focus(); return; }
    projWin = window.open('proyector.html', 'tff-proyector', 'popup,width=1280,height=720');
    if (!projWin) toast('El navegador bloqueó la ventana. Permite ventanas emergentes o abre proyector.html en otra pestaña.', 'error');
  }

  function topbar(active) {
    const bar = document.createElement('header');
    bar.className = 'topbar';
    bar.innerHTML = `
      <a class="brand" href="index.html" aria-label="The Field Forge, inicio"><span class="logo-mask" aria-hidden="true"></span><span class="brand__camp">Tumba de la Aniquilación</span></a>
      <nav class="topnav" aria-label="Secciones">${PAGES.map(p => `<a href="${p.href}" class="${p.id === active ? 'is-active' : ''}" ${p.id === active ? 'aria-current="page"' : ''}>${p.label}</a>`).join('')}</nav>
      <div class="projctl" role="group" aria-label="Control del proyector">
        <span class="projctl__dot" title="Proyector desconectado"></span>
        <div class="projctl__modes">${MODES.map(m => `<button data-mode="${m.id}" title="Proyectar: ${m.label} (Alt+${m.key})">${m.label}</button>`).join('')}</div>
        <button class="btn btn--sm" data-open-proj>Abrir proyector ↗</button>
        <button class="btn btn--sm btn--ghost btn--icon" data-menu aria-haspopup="true" aria-label="Copia de seguridad">⋯</button>
      </div>
      <div class="menu" hidden>
        <button data-export>Exportar copia (.json)</button>
        <label class="menu__file">Importar copia<input type="file" accept="application/json,.json" hidden></label>
        <a href="archivo/pripiat/index.html">Archivo: Cenizas de Prípiat</a>
        <button data-reset class="menu__danger">Restablecer datos de ejemplo</button>
      </div>`;
    document.body.prepend(bar);
    const S = TFF.store;
    const paint = () => {
      $$('[data-mode]', bar).forEach(b => b.classList.toggle('is-on', b.dataset.mode === S.stage.modo));
    };
    paint();
    S.on(k => { if (k === 'stage') paint(); });
    $$('[data-mode]', bar).forEach(b => b.onclick = () => {
      const modo = b.dataset.mode;
      if (modo === 'mapa' && !S.stage.mapaId) { const m = S.state.mapas[0]; if (m) S.setStage({ mapaId: m.id }); }
      S.setStage({ modo });
    });
    document.addEventListener('keydown', e => {
      if (!e.altKey) return;
      const m = MODES.find(x => x.key === e.key); if (!m) return;
      e.preventDefault(); $(`[data-mode="${m.id}"]`, bar).click();
    });
    $('[data-open-proj]', bar).onclick = abrirProyector;
    const menu = $('.menu', bar);
    $('[data-menu]', bar).onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.hidden = true; });
    $('[data-export]', menu).onclick = async () => { menu.hidden = true; await S.exportar(); toast('Copia exportada con todas las imágenes.'); };
    $('input[type=file]', menu).onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return; menu.hidden = true;
      if (!(await confirmar('Importar reemplaza la campaña actual por la del archivo. ¿Continuar?', { ok: 'Importar' }))) return;
      try { await S.importar(f); toast('Copia importada.'); } catch (err) { toast(err.message, 'error'); }
    };
    $('[data-reset]', menu).onclick = async () => {
      menu.hidden = true;
      if (!(await confirmar('Esto borra todo lo que has añadido y vuelve a los datos de ejemplo. Exporta antes una copia si la necesitas.', { ok: 'Restablecer' }))) return;
      S.reset(); toast('Datos restablecidos.');
    };
    // Indicador de proyector conectado.
    const dot = $('.projctl__dot', bar);
    let last = 0;
    S.on(k => { if (k === 'pong:proyector') last = Date.now(); });
    const check = () => { S.ping(); setTimeout(() => { const on = Date.now() - last < 3500; dot.classList.toggle('is-live', on); dot.title = on ? 'Proyector conectado' : 'Proyector desconectado'; }, 400); };
    check(); setInterval(check, 3000);
    return bar;
  }

  /* ---------- Dados ---------- */
  const roll = (n, d) => { let t = 0; for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * d); return t; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtMod = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const mod = s => Math.floor((s - 10) / 2);

  Object.assign(TFF, { $, $$, esc, reduceMotion, gsapOk });
  TFF.ui = { toast, modal, confirmar, dropzone, pedirURL, topbar, abrirProyector, MODES };
  TFF.dice = { roll, pick, shuffle, fmtMod, mod };
})();
