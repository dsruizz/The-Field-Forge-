/* Tablero: dibuja una escena (fondo + elementos), las presentaciones, los avisos y el grupo en escena.
   Lo comparten la mesa del DM (editable) y el proyector (solo mira), así se ven idénticos.
   Las medidas van en porcentaje del tablero (16:9) y los textos en unidades del propio tablero (cqw),
   por eso la vista previa pequeña y la pantalla grande encuadran igual.
   La política de seguridad prohíbe estilos escritos en el HTML: todo se aplica desde aquí con el.style. */
(() => {
  const F = window.Forja;
  const e = F.esc;
  const COLOR = { acido: '#aad431', amarillo: '#fde134', oxido: '#9f2c27', pizarra: '#465173', papel: '#d9d9d9', tinta: '#262626', fuego: '#ff8a2a' };
  const RGB = { acido: '170,212,49', amarillo: '253,225,52', oxido: '159,44,39', pizarra: '70,81,115', papel: '217,217,217', tinta: '38,38,38', fuego: '255,138,42' };
  const EFECTOS = { llamas: 'Llamas', brasas: 'Brasas y ceniza', niebla: 'Niebla', arcano: 'Destellos arcanos', lluvia: 'Lluvia', oscuridad: 'Oscuridad' };
  const FORMAS = { circulo: 'Círculo', cono: 'Cono', cuadrado: 'Cuadrado', linea: 'Línea' };
  const PLANTILLAS = { jefe: 'Jefe', npc: 'Personaje', lugar: 'Lugar o hallazgo' };
  const AMBIENTES = { llamas: 'Llamas', brasas: 'Brasas', niebla: 'Niebla de cueva', arcano: 'Destellos arcanos', lluvia: 'Lluvia', ninguno: 'Sin ambiente' };
  const SALUD = [[0, 'Caído'], [.25, 'Malherido'], [.6, 'Herido'], [1.01, 'Sano']];
  const salud = (pg, max) => { const f = max ? pg / max : 1; return pg <= 0 ? 'Caído' : SALUD.find(([lim]) => f <= lim)[1]; };

  function montar(cont, { editable = false } = {}) {
    cont.classList.add('tablero');
    cont.innerHTML = `<img class="tablero__fondo" alt="" hidden><div class="tablero__capa"></div><div class="tablero__leyenda" hidden></div><div class="tablero__grupo" hidden></div><div class="tablero__modo"></div><div class="tablero__sobre"></div><div class="tablero__telon" hidden></div>`;
    const fondo = cont.querySelector('.tablero__fondo'), capa = cont.querySelector('.tablero__capa');
    const cajaGrupo = cont.querySelector('.tablero__grupo'), sobre = cont.querySelector('.tablero__sobre'), telon = cont.querySelector('.tablero__telon');
    const leyenda = cont.querySelector('.tablero__leyenda'), capaModo = cont.querySelector('.tablero__modo');
    const nodos = new Map();   // id → { el, firma, particulas }
    let numeros = new Map(), firmaModo = '', brasasModo = null;
    let presente = null, avisoActual = null, relojAviso = 0;

    function colocar(el, d) {
      el.style.left = d.x + '%'; el.style.top = d.y + '%'; el.style.width = d.w + '%';
      el.style.height = d.tipo === 'texto' || d.tipo === 'punto' ? '' : d.h + '%';
      el.style.transform = `translate(-50%, -50%) rotate(${d.rot || 0}deg)`;
      el.style.opacity = d.op ?? 1;
    }
    // Solo se reconstruye el interior si cambió algo más que la posición: así las partículas no se reinician al arrastrar.
    const firmaDe = d => JSON.stringify({ ...d, x: 0, y: 0, w: 0, h: 0, rot: 0, op: 0 });
    function contenido(n, d) {
      const el = n.el;
      if (n.particulas) { n.particulas.parar(); n.particulas = null; }
      el.className = `el el--${d.tipo}${d.bloq ? ' is-bloq' : ''}`;
      el.style.removeProperty('--c'); el.style.removeProperty('--c-rgb'); el.style.fontSize = ''; el.style.color = ''; el.style.textAlign = '';
      if (d.tipo === 'imagen') {
        el.classList.add('el--marco-' + (d.marco || 'ninguno'));
        el.innerHTML = `<img src="${e(d.src)}" alt="" draggable="false">`;
      } else if (d.tipo === 'texto') {
        el.classList.add('el--' + (d.fuente || 'sans')); if (d.placa) el.classList.add('el--placa', ['tinta', 'oxido', 'pizarra'].includes(d.color) ? 'el--placa-clara' : 'el--placa-oscura');
        el.style.fontSize = (d.t || 4) + 'cqw'; el.style.color = COLOR[d.color] || COLOR.papel; el.style.textAlign = d.alin || 'center';
        el.textContent = d.txt || 'Texto';
      } else if (d.tipo === 'area') {
        el.classList.add('el--' + (d.forma || 'circulo')); if (d.pulso !== false) el.classList.add('el--pulso');
        el.style.setProperty('--c', COLOR[d.color] || COLOR.oxido); el.style.setProperty('--c-rgb', RGB[d.color] || RGB.oxido);
        el.innerHTML = `<i></i>${d.etq ? `<span>${e(d.etq)}</span>` : ''}`;
      } else if (d.tipo === 'punto') {
        if (d.visible === false) el.classList.add('el--punto-oculto');
        el.innerHTML = `<b>${numeros.get(d.id) || '·'}</b>${editable && d.etq ? `<span>${e(d.etq)}</span>` : ''}`;
      } else if (d.tipo === 'efecto') {
        el.classList.add('el--' + (d.clase || 'llamas'));
        if (d.clase === 'oscuridad') el.innerHTML = '';
        else {
          el.innerHTML = '<canvas></canvas>';
          n.particulas = F.particulas(el.firstChild, d.clase || 'llamas', { color: d.color || (d.clase === 'niebla' || d.clase === 'lluvia' ? 'papel' : 'fuego'), origen: 'ancho', forzar: true });
        }
      }
    }
    function pintar(escena) {
      const lista = (escena && escena.elementos) || [];
      if (escena && escena.fondo) { if (fondo.getAttribute('src') !== escena.fondo) fondo.src = escena.fondo; fondo.hidden = false; fondo.dataset.ajuste = escena.ajuste || 'contain'; }
      else { fondo.hidden = true; fondo.removeAttribute('src'); }
      // Los jugadores ven números seguidos: los puntos ocultos no cuentan.
      const puntos = lista.filter(d => d.tipo === 'punto' && d.visible !== false);
      numeros = new Map(puntos.map((d, i) => [d.id, i + 1]));
      const conNombre = puntos.filter(d => d.etq);
      leyenda.hidden = !conNombre.length || (escena && escena.leyenda === false);
      leyenda.innerHTML = conNombre.map(d => `<li><i>${numeros.get(d.id)}</i>${e(d.etq)}</li>`).join('');
      const vistos = new Set();
      lista.forEach((d, i) => {
        vistos.add(d.id);
        let n = nodos.get(d.id);
        if (!n) { n = { el: document.createElement('div'), firma: '' }; n.el.dataset.el = d.id; nodos.set(d.id, n); capa.append(n.el); }
        const f = firmaDe(d) + (numeros.get(d.id) || '');
        if (f !== n.firma) { contenido(n, d); n.firma = f; }
        colocar(n.el, d); n.el.style.zIndex = i + 1;
      });
      for (const [idEl, n] of nodos) if (!vistos.has(idEl)) { n.particulas && n.particulas.parar(); n.el.remove(); nodos.delete(idEl); }
    }

    /* ---------- Grupo en escena: tabla compacta con retrato, nombre, vida y CA ---------- */
    const filaGrupo = (p, cfg, clase) => {
      const f = p.pgMax ? Math.max(0, Math.min(1, p.pg / p.pgMax)) : 1;
      const verPg = !p.pgMax || cfg.pg === false ? 'no' : p.tipo === 'pj' ? 'numero' : (cfg.enemigos || 'estado');
      return `<div class="${clase} gp--${e(p.tipo)}${p.turno ? ' is-turno' : ''}${p.pg <= 0 && p.pgMax ? ' is-caido' : ''}">
        ${F.ficha ? F.ficha.retrato(p, 'gp__retrato') : ''}
        <div class="gp__txt"><b>${e(p.nombre)}</b>${clase === 'mf' && p.linea ? `<em>${e(p.linea)}</em>` : ''}
          ${verPg !== 'no' ? `<span class="gp__barra" data-nivel="${f > .6 ? 'bien' : f > .25 ? 'medio' : 'mal'}"><i data-f="${Math.round(f * 100)}"></i></span>
          <small>${verPg === 'numero' ? `${e(p.pg)} / ${e(p.pgMax)} PG` : salud(p.pg, p.pgMax)}</small>` : ''}
        </div>
        ${cfg.ca !== false && p.ca !== '' && p.ca !== undefined ? `<span class="gp__ca"><b>${e(p.ca)}</b><small>CA</small></span>` : ''}
      </div>`;
    };
    const anchos = caja => caja.querySelectorAll('[data-f]').forEach(i => { i.style.width = i.dataset.f + '%'; });
    function grupo(lista, cfg) {
      cfg = typeof cfg === 'string' ? { pos: cfg } : (cfg || {});
      const pos = cfg.pos || 'derecha', ver = lista && lista.length && pos !== 'oculto';
      cajaGrupo.hidden = !ver;
      if (!ver) return;
      cajaGrupo.dataset.pos = pos;
      cajaGrupo.innerHTML = lista.map(p => filaGrupo(p, cfg, 'gp')).join('');
      anchos(cajaGrupo);
    }

    /* ---------- Modos que no son el mapa: portada, un acontecimiento de la crónica y las fichas en escena ---------- */
    const TIPOS_EV = { escena: 'Escena', personaje: 'Personaje', combate: 'Combate', descubrimiento: 'Descubrimiento', decision: 'Decisión', hito: 'Hito' };
    function modo(s) {
      const m = s.modo || 'mapa';
      cont.dataset.modo = m;
      const firma = m + JSON.stringify(m === 'portada' ? s.portada : m === 'cronica' ? s.evento : m === 'fichas' ? [s.grupo, s.cfg] : 0);
      if (firma === firmaModo) return;
      const claveAnim = m + (s.evento ? s.evento.id : ''), cambioDeModo = claveAnim !== cont.dataset.anim;
      cont.dataset.anim = claveAnim; firmaModo = firma;
      if (brasasModo) { brasasModo.parar(); brasasModo = null; }
      const po = s.portada || {}, ev = s.evento;
      if (m === 'portada') {
        capaModo.innerHTML = `<div class="mp mp--portada${po.img ? ' mp--conimg' : ''}"><canvas class="mp__brasas"></canvas>
          <div class="mp__txt"><p class="mp__kicker">Crónica de campaña${po.amb ? ' · ' + e(po.amb) : ''}</p><h1 class="gotica">${e(po.titulo)}</h1>${po.sinopsis ? `<p class="mp__cuerpo">${e(po.sinopsis)}</p>` : ''}</div>
          ${po.img ? `<div class="mp__img"><img src="${e(po.img)}" alt=""></div>` : ''}
          <span class="mp__sello"><small>Sesión</small><b>${String(po.sesion || 1).padStart(2, '0')}</b></span></div>`;
        brasasModo = F.particulas(capaModo.querySelector('canvas'), 'brasas', { color: 'verde', origen: 'ancho', densidad: .7, forzar: true });
      } else if (m === 'cronica') {
        capaModo.innerHTML = ev ? `<div class="mp mp--evento${ev.img ? ' mp--conimg' : ''}${(ev.texto || '').length > 420 ? ' mp--largo' : ''}">
          <div class="mp__txt"><p class="mp__kicker">${e(TIPOS_EV[ev.tipo] || 'Crónica')}${ev.lugar ? ' · ' + e(ev.lugar) : ''}</p><h1>${e(ev.titulo)}</h1>
            ${ev.texto ? `<p class="mp__cuerpo">${e(ev.texto)}</p>` : ''}${ev.cita ? `<blockquote class="gotica">${e(ev.cita)}</blockquote>` : ''}
            ${ev.quien && ev.quien.length ? `<div class="mp__quien">${ev.quien.map(q => `<span>${q.img ? `<img src="${e(q.img)}" alt="">` : ''}${e(q.nombre)}</span>`).join('')}</div>` : ''}</div>
          ${ev.img ? `<div class="mp__img"><img src="${e(ev.img)}" alt=""></div>` : ''}</div>`
          : `<div class="mp mp--portada"><div class="mp__txt"><p class="mp__kicker">Crónica</p><h1 class="gotica">${e(po.titulo || '')}</h1></div></div>`;
      } else if (m === 'fichas') {
        const l = s.grupo || [];
        capaModo.innerHTML = `<div class="mp mp--fichas"><div class="mp__rejilla">${l.map(p => filaGrupo(p, s.cfg || {}, 'mf')).join('') || '<p class="mp__kicker">Nadie en escena</p>'}</div></div>`;
        const rej = capaModo.querySelector('.mp__rejilla');
        rej.style.gridTemplateColumns = `repeat(${l.length <= 1 ? 1 : l.length <= 4 ? 2 : l.length <= 9 ? 3 : 4}, minmax(0, 1fr))`;
        rej.dataset.n = l.length <= 4 ? 'pocos' : l.length <= 9 ? 'varios' : 'muchos';
        anchos(capaModo);
      } else capaModo.innerHTML = '';
      const g = window.gsap;
      if (g && !F.reducido() && cambioDeModo && capaModo.firstElementChild) {
        g.from(capaModo.firstElementChild, { opacity: 0, duration: .5, ease: 'power1.out' });
        g.from(capaModo.querySelectorAll('.mp__kicker, h1, .mp__cuerpo, blockquote, .mp__quien, .mp__img, .mf, .mp__sello'), { y: 24, opacity: 0, duration: .7, stagger: .07, ease: 'power3.out', clearProps: 'transform,opacity' });
      }
    }

    /* ---------- Presentación: imagen, título y descripción sobre el mapa ---------- */
    function presentar(p) {
      if ((p && p.k) === (presente && presente.k)) return;
      const g = window.gsap, anim = g && !F.reducido();
      const anterior = sobre.querySelector('.present');
      if (anterior) {
        const amb = anterior._amb;
        const fuera = () => { amb && amb.parar(); anterior.remove(); };
        anim ? g.to(anterior, { opacity: 0, duration: .5, ease: 'power2.in', onComplete: fuera }) : fuera();
      }
      presente = p || null;
      if (!p) return;
      const el = document.createElement('div');
      el.className = `present present--${p.plantilla || 'jefe'}${p.img ? '' : ' present--sinimg'}`;
      el.innerHTML = `
        <div class="present__velo"></div>
        ${p.ambiente && p.ambiente !== 'ninguno' ? `<canvas class="present__amb present__amb--${e(p.ambiente)}"></canvas>` : ''}
        ${p.img ? `<div class="present__img"><img src="${e(p.img)}" alt=""></div>` : ''}
        <div class="present__txt">
          ${p.sub ? `<p class="present__sub">${e(p.sub)}</p>` : ''}
          <h2 class="present__tit gotica"><span>${e(p.titulo || '')}</span></h2>
          <span class="present__raya"></span>
          ${p.texto ? `<p class="present__desc">${e(p.texto)}</p>` : ''}
        </div>`;
      sobre.append(el);
      const lienzo = el.querySelector('.present__amb');
      if (lienzo) el._amb = F.particulas(lienzo, p.ambiente, { color: p.color || (p.ambiente === 'niebla' || p.ambiente === 'lluvia' ? 'papel' : 'fuego'), origen: 'ancho', densidad: p.ambiente === 'llamas' ? .8 : 1.2, forzar: true });
      if (!anim) return;
      const q = s => el.querySelector(s), tl = g.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(el, { opacity: 0, duration: .7, ease: 'power1.out' });
      if (q('.present__img')) tl.from(q('.present__img'), { opacity: 0, scale: p.plantilla === 'lugar' ? 1.18 : .86, yPercent: p.plantilla === 'lugar' ? 0 : 6, duration: 1.5 }, .25);
      if (q('.present__sub')) tl.from(q('.present__sub'), { opacity: 0, y: 14, duration: .7 }, .9);
      tl.from(q('.present__tit span'), { yPercent: 115, duration: 1.1, ease: 'power4.out' }, 1.05);
      tl.from(q('.present__raya'), { scaleX: 0, duration: .9, ease: 'power2.inOut' }, 1.5);
      if (q('.present__desc')) tl.from(q('.present__desc'), { opacity: 0, y: 16, duration: .9 }, 1.8);
      if (q('.present__img img') && p.plantilla === 'lugar') g.to(q('.present__img img'), { scale: 1.08, duration: 26, ease: 'none' });
    }

    /* ---------- Aviso: quién hace qué y si acierta, para toda la mesa ---------- */
    function aviso(a) {
      if ((a && a.k) === (avisoActual && avisoActual.k)) return;
      clearTimeout(relojAviso);
      sobre.querySelectorAll('.anuncio').forEach(x => x.remove());
      avisoActual = a || null;
      if (!a) return;
      const el = document.createElement('div');
      el.className = `anuncio anuncio--${a.res || 'neutro'}`;
      const RES = { acierta: 'Acierta', falla: 'Falla', critico: 'Crítico', pifia: 'Pifia' };
      el.innerHTML = `
        <div class="anuncio__quien">${a.img ? `<img src="${e(a.img)}" alt="">` : ''}<span>${e(a.quien || '')}</span></div>
        <div class="anuncio__que">${e(a.que || '')}</div>
        ${RES[a.res] ? `<div class="anuncio__res gotica">${RES[a.res]}</div>` : ''}
        ${a.nota ? `<div class="anuncio__nota">${e(a.nota)}</div>` : ''}`;
      sobre.append(el);
      const g = window.gsap, anim = g && !F.reducido();
      const quitar = () => { if (avisoActual === a) avisoActual = null; anim ? g.to(el, { opacity: 0, y: -20, duration: .45, onComplete: () => el.remove() }) : el.remove(); };
      if (anim) {
        g.from(el, { opacity: 0, y: -40, scale: .94, duration: .6, ease: 'back.out(1.6)' });
        const r = el.querySelector('.anuncio__res');
        if (r) g.from(r, { scale: 2.4, opacity: 0, duration: .55, ease: 'power4.out', delay: .45 });
        if (a.res === 'falla' || a.res === 'pifia') g.fromTo(el, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1.2, .25)', delay: .5 });
      }
      relojAviso = setTimeout(quitar, a.dur || 6500);
    }

    const negro = si => { telon.hidden = !si; };
    const estado = s => { pintar(s.escena); grupo(s.grupo, s.cfg || s.pos); modo(s); presentar(s.presentacion); aviso(s.aviso); negro(s.modo === 'negro' || s.negro); };
    return { pintar, grupo, modo, presentar, aviso, negro, estado, capa, nodo: idEl => (nodos.get(idEl) || {}).el, editable };
  }

  F.tablero = { montar, COLOR, EFECTOS, FORMAS, PLANTILLAS, AMBIENTES, salud };
})();
