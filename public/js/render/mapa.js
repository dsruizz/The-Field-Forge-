/* Render de mapas: lo usan la página de mapas (vista previa del DM) y el proyector.
   La vista se guarda en fracciones del mapa, así el encuadre es el mismo
   en la vista previa pequeña y en la pantalla grande. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const esc = s => TFF.esc(s);
  const ZMIN = 1, ZMAX = 5;

  const visibles = map => (map.pois || []).filter(p => p.visible !== false);
  const clampZ = z => Math.min(ZMAX, Math.max(ZMIN, z || 1));

  function overlays(map, o) {
    const ov = map.overlay || {};
    const amb = [map.ambiente?.momento, map.ambiente?.clima].filter(Boolean);
    const vis = visibles(map).filter(p => p.label);
    return `
      ${ov.ambiente !== false && amb.length ? `<div class="ovl-amb">${amb.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
      ${ov.titulo !== false ? `<div class="ovl-title">
        ${map.region ? `<div class="kicker">${esc(map.region)}</div>` : ''}
        <h2>${esc(map.nombre || 'Sin nombre')}</h2>
        ${ov.desc !== false && map.desc ? `<p>${esc(map.desc)}</p>` : ''}
      </div>` : ''}
      ${ov.leyenda !== false && vis.length ? `<div class="ovl-legend"><ol>${vis.map(p => `<li><i>${numero(map, p)}</i>${esc(p.label)}</li>`).join('')}</ol></div>` : ''}
      <div class="ovl-spot" hidden></div>`;
  }

  // Los jugadores ven números seguidos; los puntos ocultos no cuentan.
  function numero(map, p) {
    const i = visibles(map).indexOf(p);
    return i < 0 ? '·' : i + 1;
  }

  function pois(map, o) {
    return (map.pois || []).filter(p => o.dm || p.visible !== false).map(p => `
      <div class="poi ${p.visible === false ? 'is-off' : ''} ${o.spot === p.id ? 'is-spot' : ''}" data-poi="${p.id}" style="left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%">
        <span class="poi__dot">${numero(map, p)}</span>
        ${p.label && (o.dm || (map.overlay || {}).etiquetas !== false) ? `<span class="poi__lbl">${esc(p.label)}</span>` : ''}
      </div>`).join('');
  }

  function mapa(el, map, opts = {}) {
    let o = Object.assign({ dm: false, spot: null }, opts);
    let base = { w: 0, h: 0 };
    let cur = { x: 0, y: 0, z: 1 };
    let ar = map.ar || 16 / 9;
    let imgRef = null;
    let world, img, poisEl, ovl;
    const useGsap = () => TFF.gsapOk && TFF.gsapOk();

    function build() {
      imgRef = map.img || '';
      el.classList.add('mapr');
      el.classList.toggle('mapr--dm', !!o.dm);
      el.innerHTML = `<div class="mapr__bg" ${imgRef ? `data-bg="${esc(imgRef)}"` : ''}></div>
        <div class="mapr__world">
          ${imgRef ? `<img class="mapr__img" data-img="${esc(imgRef)}" alt="${esc(map.nombre || '')}" draggable="false">` : ''}
          <div class="mapr__pois"></div>
        </div>
        ${imgRef ? '' : `<div class="mapr__empty"><b>${esc(map.nombre || 'Mapa')}</b>${o.dm ? 'Arrastra aquí la imagen del mapa' : ''}${o.dm && map.hint ? `<small>${esc(map.hint.split('/').pop())}</small>` : ''}</div>`}
        <div class="mapr__vignette" ${(map.overlay || {}).vineta === false ? 'hidden' : ''}></div>
        <div class="mapr__ovl"></div>`;
      world = el.querySelector('.mapr__world');
      img = el.querySelector('.mapr__img');
      poisEl = el.querySelector('.mapr__pois');
      ovl = el.querySelector('.mapr__ovl');
      if (img) {
        img.addEventListener('load', () => {
          if (!img.naturalWidth) return;
          const nar = img.naturalWidth / img.naturalHeight;
          if (Math.abs(nar - ar) > 0.001) { ar = nar; layout(); ctrl.onAspect && ctrl.onAspect(nar); }
        });
      }
      TFF.img.hydrate(el);
      paint();
      layout();
    }

    function paint() {
      poisEl.innerHTML = pois(map, o);
      ovl.innerHTML = overlays(map, o);
      const vig = el.querySelector('.mapr__vignette');
      if (vig) vig.hidden = (map.overlay || {}).vineta === false;
    }

    function layout() {
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      let w = W, h = W / ar;
      if (h > H) { h = H; w = H * ar; }
      base = { w, h };
      world.style.width = w + 'px';
      world.style.height = h + 'px';
      setVista(cur, false);
    }

    function transformFor(v) {
      const z = clampZ(v.z);
      return { x: -(0.5 + (v.x || 0)) * base.w * z, y: -(0.5 + (v.y || 0)) * base.h * z, scale: z };
    }

    function setVista(v, animate) {
      cur = { x: v.x || 0, y: v.y || 0, z: clampZ(v.z) };
      const t = transformFor(cur);
      if (useGsap()) {
        gsap.killTweensOf(world, 'x,y,scale');
        const sync = () => { world.style.setProperty('--inv', 1 / gsap.getProperty(world, 'scaleX')); placeSpot(); };
        if (animate && !TFF.reduceMotion()) gsap.to(world, { x: t.x, y: t.y, scale: t.scale, transformOrigin: '0 0', duration: .8, ease: 'power2.out', onUpdate: sync, onComplete: sync });
        else { gsap.set(world, { x: t.x, y: t.y, scale: t.scale, transformOrigin: '0 0' }); sync(); }
      } else {
        world.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
        world.style.setProperty('--inv', 1 / t.scale);
        placeSpot();
      }
    }

    // Tarjeta del punto destacado, al lado del punto y sin salirse de la pantalla.
    function placeSpot() {
      const box = ovl && ovl.querySelector('.ovl-spot');
      if (!box) return;
      const p = (map.pois || []).find(x => x.id === o.spot && (o.dm || x.visible !== false));
      if (!p || (!p.label && !p.desc)) { box.hidden = true; return; }
      if (box.dataset.for !== p.id) {
        box.dataset.for = p.id;
        box.innerHTML = `<div class="kicker">Punto ${numero(map, p)}</div><h3>${esc(p.label || '')}</h3>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}`;
      }
      box.hidden = false;
      const W = el.clientWidth, H = el.clientHeight;
      const wr = world.getBoundingClientRect(), er = el.getBoundingClientRect();
      const px = wr.left - er.left + p.x * wr.width;
      const py = wr.top - er.top + p.y * wr.height;
      const bw = box.offsetWidth, bh = box.offsetHeight, gap = W * 0.03;
      const left = px + gap + bw < W - 8 ? px + gap : Math.max(8, px - gap - bw);
      const top = Math.min(H - bh - 8, Math.max(8, py - bh / 2));
      box.style.left = left + 'px';
      box.style.top = top + 'px';
    }

    // Coordenadas de pantalla → fracción del mapa (0–1).
    function toFrac(cx, cy) {
      const r = world.getBoundingClientRect();
      return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
    }

    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => layout()) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', layout);

    const ctrl = {
      el,
      get vista() { return { ...cur }; },
      get size() { return { ...base }; },
      setVista,
      toFrac,
      layout,
      // Cambios del estado: reconstruye solo si cambia la imagen.
      update(m, nuevas = {}) {
        const animate = !!nuevas.animate;
        o = Object.assign(o, nuevas);
        delete o.animate;
        map = m;
        if (m.ar) ar = m.ar;
        if ((m.img || '') !== imgRef) { build(); setVista(m.vista || {}, false); return; }
        el.classList.toggle('mapr--dm', !!o.dm);
        const box = ovl.querySelector('.ovl-spot'); if (box) box.dataset.for = '';
        paint();
        setVista(m.vista || {}, animate);
      },
      destroy() { if (ro) ro.disconnect(); else window.removeEventListener('resize', layout); }
    };

    cur = { x: map.vista?.x || 0, y: map.vista?.y || 0, z: clampZ(map.vista?.z) };
    build();
    return ctrl;
  }

  TFF.render = Object.assign(TFF.render || {}, { mapa, mapaVisibles: visibles, MAPA_Z: [ZMIN, ZMAX] });
})();
