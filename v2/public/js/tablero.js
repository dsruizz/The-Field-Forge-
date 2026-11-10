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
    cont.innerHTML = `<img class="tablero__fondo" alt="" hidden><div class="tablero__capa"></div><div class="tablero__grupo" hidden></div><div class="tablero__sobre"></div><div class="tablero__telon" hidden></div>`;
    const fondo = cont.querySelector('.tablero__fondo'), capa = cont.querySelector('.tablero__capa');
    const cajaGrupo = cont.querySelector('.tablero__grupo'), sobre = cont.querySelector('.tablero__sobre'), telon = cont.querySelector('.tablero__telon');
    const nodos = new Map();   // id → { el, firma, particulas }
    let presente = null, avisoActual = null, relojAviso = 0;

    function colocar(el, d) {
      el.style.left = d.x + '%'; el.style.top = d.y + '%'; el.style.width = d.w + '%';
      el.style.height = d.tipo === 'texto' ? '' : d.h + '%';
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
      const vistos = new Set();
      lista.forEach((d, i) => {
        vistos.add(d.id);
        let n = nodos.get(d.id);
        if (!n) { n = { el: document.createElement('div'), firma: '' }; n.el.dataset.el = d.id; nodos.set(d.id, n); capa.append(n.el); }
        const f = firmaDe(d);
        if (f !== n.firma) { contenido(n, d); n.firma = f; }
        colocar(n.el, d); n.el.style.zIndex = i + 1;
      });
      for (const [idEl, n] of nodos) if (!vistos.has(idEl)) { n.particulas && n.particulas.parar(); n.el.remove(); nodos.delete(idEl); }
    }

    /* ---------- Grupo en escena ---------- */
    function grupo(lista, pos) {
      const ver = lista && lista.length && pos && pos !== 'oculto';
      cajaGrupo.hidden = !ver;
      if (!ver) return;
      cajaGrupo.dataset.pos = pos;
      cajaGrupo.innerHTML = lista.map(p => {
        const f = p.pgMax ? Math.max(0, Math.min(1, p.pg / p.pgMax)) : 1, est = salud(p.pg, p.pgMax);
        return `<div class="gp gp--${e(p.tipo)}${p.turno ? ' is-turno' : ''}${p.pg <= 0 && p.pgMax ? ' is-caido' : ''}" data-gp="${e(p.id)}">
          ${F.ficha ? F.ficha.retrato(p, 'gp__retrato') : ''}
          <div class="gp__txt"><b>${e(p.nombre)}</b>
            ${p.pgMax ? `<span class="gp__barra" data-nivel="${f > .6 ? 'bien' : f > .25 ? 'medio' : 'mal'}"><i data-f="${Math.round(f * 100)}"></i></span>
            <small>${p.tipo === 'pj' ? `${e(p.pg)} / ${e(p.pgMax)} PG` : est}</small>` : ''}
          </div></div>`;
      }).join('');
      cajaGrupo.querySelectorAll('[data-f]').forEach(i => { i.style.width = i.dataset.f + '%'; });
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
    const estado = s => { pintar(s.escena); grupo(s.grupo, s.pos); presentar(s.presentacion); aviso(s.aviso); negro(s.negro); };
    return { pintar, grupo, presentar, aviso, negro, estado, capa, nodo: idEl => (nodos.get(idEl) || {}).el, editable };
  }

  F.tablero = { montar, COLOR, EFECTOS, FORMAS, PLANTILLAS, AMBIENTES, salud };
})();
