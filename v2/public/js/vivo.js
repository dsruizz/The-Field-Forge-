/* Lo que está en vivo: decide qué recibe el proyector y se lo envía.
   Lo usan la mesa (consola del DM), el editor de escenas y la crónica (botón «Proyectar»).

   - datos.mesa guarda lo preparado (escenas, presentaciones, quién está en escena) y viaja con la campaña.
   - El control (qué modo se proyecta, qué acontecimiento, presentación activa, telón) es del momento
     y vive en este navegador: localStorage «forja.ctl.<id>».
   - El estado ya montado para el proyector se envía por BroadcastChannel y se deja en «forja.mesa.<id>»
     para que el proyector lo recupere al recargar. */
(() => {
  const F = window.Forja;
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const MODOS = { portada: 'Portada', cronica: 'Crónica', mapa: 'Mapa', fichas: 'En escena', negro: 'Negro' };

  const escenaNueva = (nombre, fondo) => ({ id: uid('esc'), nombre, fondo: fondo || '', ajuste: 'contain', elementos: [] });
  /* Deja datos.mesa completo. La primera vez crea una escena por cada mapa que ya tuviera la campaña. */
  function preparar(datos) {
    if (!datos.mesa || !Array.isArray(datos.mesa.escenas) || !datos.mesa.escenas.length) {
      const deMapas = (datos.mapas || []).map(m => escenaNueva(m.nombre || 'Mapa', /^(api\/|data:image)/.test(m.img || '') ? m.img : ''));
      datos.mesa = { escenas: deMapas.length ? deMapas : [escenaNueva('Escena 1')], presentaciones: [], enEscena: datos.personajes.filter(p => p.tipo === 'pj').map(p => p.id) };
    }
    const m = datos.mesa;
    m.presentaciones = m.presentaciones || []; m.enEscena = (m.enEscena || []).filter(idp => datos.personajes.some(p => p.id === idp));
    m.ocultos = m.ocultos || []; m.turno = m.turno || '';
    m.grupoCfg = { pos: m.grupoPos || 'derecha', pg: true, ca: true, enemigos: 'estado', ...(m.grupoCfg || {}) };
    delete m.grupoPos;
    if (!m.escenas.some(x => x.id === m.actual)) m.actual = m.escenas[0].id;
    return m;
  }

  function crear({ id, datos, resumen }) {
    const CTL = 'forja.ctl.' + id, EST = 'forja.mesa.' + id;
    const leer = () => { try { return JSON.parse(localStorage.getItem(CTL)) || {}; } catch { return {}; } };
    let ctl = { modo: 'mapa', eventoId: '', presentacion: null, negro: false, ...leer() };
    let aviso = null, escenaFija = null, oyentes = [];
    const canal = 'BroadcastChannel' in window ? new BroadcastChannel('forja-mesa-' + id) : null;
    const pj = idp => datos().personajes.find(p => p.id === idp);

    function grupo() {
      const d = datos(), m = d.mesa;
      return m.enEscena.map(pj).filter(Boolean).filter(p => !m.ocultos.includes(p.id)).map(p => ({
        id: p.id, nombre: p.nombre, img: p.img || '', tipo: p.tipo, pg: p.pg ?? p.pgMax ?? 0, pgMax: p.pgMax || 0, ca: p.ca ?? '',
        linea: F.ficha ? F.ficha.linea(p) : '', turno: m.turno === p.id
      }));
    }
    function evento() {
      const x = datos().cronica.find(c => c.id === ctl.eventoId);
      if (!x) return null;
      return { id: x.id, tipo: x.tipo, titulo: x.titulo, lugar: x.lugar, texto: x.texto, cita: x.cita, img: x.img || '', sesion: x.sesion,
        quien: (x.enlaces || []).map(pj).filter(Boolean).map(p => ({ nombre: p.nombre, img: p.img || '' })) };
    }
    // Los puntos de interés ocultos no salen del navegador del DM.
    const publica = esc => esc && { ...esc, elementos: (esc.elementos || []).filter(el => !(el.tipo === 'punto' && el.visible === false)) };
    function estado() {
      const d = datos(), m = d.mesa, c = d.campana || {};
      const esc = escenaFija || m.escenas.find(x => x.id === m.actual) || m.escenas[0];
      return {
        modo: ctl.negro ? 'negro' : ctl.modo, escena: publica(esc), grupo: grupo(), cfg: m.grupoCfg,
        portada: { titulo: resumen.nombre, amb: resumen.ambientacion || '', sinopsis: c.sinopsis || resumen.sinopsis || '', img: c.portada || '', sesion: c.sesionActual || 1 },
        evento: ctl.modo === 'cronica' ? evento() : null, presentacion: ctl.presentacion, aviso
      };
    }
    let reloj = 0;
    function emitir() {
      const s = estado();
      canal && canal.postMessage(s);
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        try { localStorage.setItem(CTL, JSON.stringify(ctl)); localStorage.setItem(EST, JSON.stringify({ ...s, aviso: null })); } catch { /* almacenamiento lleno: el canal sigue funcionando */ }
      }, 250);
      oyentes.forEach(f => f(s));
      return s;
    }
    let cuadro = 0;
    const arrastre = esc => { if (!canal || cuadro || escenaFija) return; cuadro = requestAnimationFrame(() => { cuadro = 0; canal.postMessage({ parcial: true, escena: publica(esc) }); }); };
    if (canal) canal.onmessage = ev => { if (ev.data === 'hola') emitir(); };
    // Otra pestaña del DM (mesa, editor o crónica) cambió el control: se sigue el cambio.
    addEventListener('storage', ev => { if (ev.key === CTL && ev.newValue) { try { ctl = { ...ctl, ...JSON.parse(ev.newValue) }; oyentes.forEach(f => f(estado())); } catch { /* ignorar */ } } });

    return {
      MODOS, estado, emitir, arrastre,
      get ctl() { return ctl; },
      poner(cambios) { Object.assign(ctl, cambios); return emitir(); },
      avisar(a) { aviso = a ? { ...a, k: Date.now() } : null; const k = aviso && aviso.k; emitir(); if (k) setTimeout(() => { if (aviso && aviso.k === k) aviso = null; }, 6600); },
      // El editor puede «congelar» lo que ve la mesa mientras prepara cambios.
      congelar(esc) { escenaFija = esc ? JSON.parse(JSON.stringify(esc)) : null; },
      alCambiar(f) { oyentes.push(f); },
      abrirProyector() {
        const v = window.open('proyector.html?id=' + encodeURIComponent(id), 'forja-proyector-' + id, 'popup,width=1280,height=720');
        if (!v) F.toast('El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.');
        setTimeout(emitir, 700);
      }
    };
  }

  F.vivo = { crear, preparar, escenaNueva, uid, MODOS };
})();
