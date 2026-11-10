/* The Field Forge v2 · utilidades comunes a todas las páginas. */
(() => {
  const F = (window.Forja = {});

  /* ---------- Tema claro / oscuro ---------- */
  const raiz = document.documentElement;
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const temaGuardado = leer('forja.tema');
  if (temaGuardado) raiz.dataset.tema = temaGuardado;
  F.temaActual = () => raiz.dataset.tema || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
  F.alternarTema = () => {
    const nuevo = F.temaActual() === 'oscuro' ? 'claro' : 'oscuro';
    raiz.dataset.tema = nuevo; guardar('forja.tema', nuevo);
    document.querySelectorAll('[data-icono-tema]').forEach(pintarIconoTema);
  };

  /* ---------- Iconos (trazo, 24×24) ---------- */
  const I = {
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l3 3M14 9l2 2"/>',
    cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
    atras: '<path d="M15 18l-6-6 6-6"/>',
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    libro: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    mascara: '<path d="M4 5c5 2 11 2 16 0v6a8 8 0 0 1-16 0V5Z"/><path d="M8.5 10.5h2M13.5 10.5h2M9.5 15c1.5 1 3.5 1 5 0"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    borrar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    ojoNo: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    subir: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    mesa: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    dado: '<path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
    chispa: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5"/>',
    imagen: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    texto: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    area: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="1.5"/>',
    fuego: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.4 2 2.9-.5-3 0-5.9 1-8.4Z"/>',
    mapa: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4ZM9 4v13.5M15 6.5V20"/>',
    deshacer: '<path d="M8 7 4 11l4 4"/><path d="M4 11h10a5 5 0 0 1 0 10h-3"/>',
    duplicar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    candado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    arriba: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    abajo: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    proyectar: '<path d="M6 4l14 8-14 8V4Z"/>',
    parar: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    grupo: '<circle cx="9" cy="9" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0M16 6.2a3 3 0 0 1 0 5.6M17.5 14.2A5.5 5.5 0 0 1 21 19"/>',
    aviso: '<path d="M4 10v4h3l6 4V6l-6 4H4ZM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
    telon: '<path d="M3 4h18v3H3zM5 7v13M19 7v13M5 7c2 5 2 9 0 13M19 7c-2 5-2 9 0 13"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    punto: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };
  F.icono = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
  function pintarIconoTema(b) {
    const oscuro = F.temaActual() === 'oscuro';
    b.innerHTML = F.icono(oscuro ? 'sol' : 'luna');
    b.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    b.title = b.getAttribute('aria-label');
  }

  /* ---------- Texto seguro ---------- */
  F.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- API ---------- */
  F.api = async (ruta, { metodo = 'GET', datos } = {}) => {
    let r;
    try {
      r = await fetch('api/' + ruta, {
        method: metodo, credentials: 'same-origin',
        headers: datos ? { 'Content-Type': 'application/json' } : {},
        body: datos ? JSON.stringify(datos) : undefined
      });
    } catch {
      throw Object.assign(new Error('Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.'), { estado: 0 });
    }
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(cuerpo.error || 'Algo salió mal.'), { estado: r.status });
    return cuerpo;
  };

  /* ---------- Captcha: resuelve el reto del servidor en segundo plano ---------- */
  async function sha256Hex(texto) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }
  F.captcha = el => {
    let promesa = null, solucion = null;
    const poner = (estado, texto) => { el.dataset.estado = estado; el.querySelector('.captcha__texto').textContent = texto; };
    const resolver = () => {
      if (promesa) return promesa;
      poner('calculando', 'Comprobando que eres humano…');
      promesa = (async () => {
        const reto = await F.api('captcha');
        for (let n = 0; n <= reto.maxnumber; n++) {
          if (await sha256Hex(reto.salt + n) === reto.challenge) {
            solucion = btoa(JSON.stringify({ algorithm: reto.algorithm, challenge: reto.challenge, number: n, salt: reto.salt, signature: reto.signature }));
            poner('listo', 'Comprobado');
            return solucion;
          }
        }
        throw new Error('No se pudo resolver el reto.');
      })().catch(e => { promesa = null; poner('error', 'No se pudo comprobar. Toca para reintentar.'); throw e; });
      return promesa;
    };
    el.addEventListener('click', () => { if (el.dataset.estado === 'error') resolver().catch(() => {}); });
    return {
      empezar: () => resolver().catch(() => {}),
      // Cada solución vale una vez: tras usarla se prepara otra.
      obtener: async () => { const s = await resolver(); promesa = null; solucion = null; return s; },
      reiniciar: () => { promesa = null; solucion = null; resolver().catch(() => {}); }
    };
  };

  /* ---------- Errores: que nunca fallen en silencio ---------- */
  let avisados = 0;
  const informar = (error, donde) => {
    if (avisados++ > 4) return;
    F.toast && F.toast('Algo falló en esta página. Recárgala; si sigue, avísame con este texto: ' + String(error).slice(0, 120));
    fetch('api/diag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagina: location.pathname + location.search, error: String(error), donde: donde || '' }) }).catch(() => {});
  };
  addEventListener('error', e => { if (e.message) informar(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno); });
  addEventListener('unhandledrejection', e => informar((e.reason && e.reason.message) || e.reason, 'promesa'));

  /* ---------- Avisos breves ---------- */
  let tt;
  F.toast = texto => {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = texto; t.classList.add('is-on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('is-on'), Math.max(2600, texto.length * 55));
  };

  /* ---------- Sesión ---------- */
  F.yo = async () => (await F.api('yo')).usuario;
  F.exigirSesion = async () => {
    const u = await F.yo().catch(() => null);
    if (!u) { location.replace('cuenta.html?volver=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return null; }
    return u;
  };
  F.salir = async () => { await F.api('salir', { metodo: 'POST', datos: {} }).catch(() => {}); location.href = './'; };

  /* ---------- Barra superior: tema y menú de usuario ---------- */
  F.montarBarra = usuario => {
    document.querySelectorAll('[data-icono-tema]').forEach(b => { if (b.dataset.listo) return; b.dataset.listo = '1'; pintarIconoTema(b); b.addEventListener('click', F.alternarTema); });
    const nav = document.querySelector('[data-nav]');
    if (nav && usuario) {
      const actual = location.pathname.split('/').pop() || 'index.html';
      const enlaces = [['campanas.html', 'libro', 'Campañas', ['campanas.html', 'campana.html']], ['personajes.html', 'mascara', 'Personajes', ['personajes.html']]];
      nav.innerHTML = enlaces.map(([href, ic, txt, paginas]) =>
        `<a href="${href}"${paginas.includes(actual) ? ' aria-current="page"' : ''}>${F.icono(ic)}<span>${txt}</span></a>`).join('');
    }
    const hueco = document.querySelector('[data-menu-usuario]');
    if (!hueco || !usuario) return;
    hueco.innerHTML = `
      <div class="menu">
        <button class="avatar" aria-haspopup="true" aria-expanded="false" aria-label="Tu cuenta">${F.esc(usuario.usuario.charAt(0).toUpperCase())}</button>
        <div class="menu__lista" hidden>
          <div class="menu__quien"><b>${F.esc(usuario.usuario)}</b><br>${F.esc(usuario.correo)}</div>
          <a href="campanas.html">Mis campañas</a>
          <a href="personajes.html">Mis personajes</a>
          <button type="button" data-efectos></button>
          <button type="button" data-salir>Cerrar sesión</button>
        </div>
      </div>`;
    const boton = hueco.querySelector('.avatar'), lista = hueco.querySelector('.menu__lista');
    const cerrar = () => { lista.hidden = true; boton.setAttribute('aria-expanded', 'false'); };
    boton.addEventListener('click', e => { e.stopPropagation(); const abrir = lista.hidden; lista.hidden = !abrir; boton.setAttribute('aria-expanded', String(abrir)); });
    document.addEventListener('click', e => { if (!hueco.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
    hueco.querySelector('[data-salir]').addEventListener('click', F.salir);
    const ef = hueco.querySelector('[data-efectos]');
    const pintarEf = () => { ef.textContent = 'Efectos y animación: ' + (F.efectos() === 'no' ? 'apagados' : 'encendidos'); };
    pintarEf();
    ef.addEventListener('click', () => { guardar('forja.efectos', F.efectos() === 'no' ? 'si' : 'no'); location.reload(); });
  };

  /* ---------- Formularios ---------- */
  F.datosForm = form => Object.fromEntries(new FormData(form).entries());
  F.ocupado = (boton, si, texto) => {
    if (si) { boton.dataset.texto = boton.textContent; boton.textContent = texto || 'Un momento…'; boton.disabled = true; }
    else { boton.textContent = boton.dataset.texto || boton.textContent; boton.disabled = false; }
  };
  /* ---------- Movimiento: entrada escalonada con GSAP si está disponible ---------- */
  /* Efectos: 'si' y 'no' son elección de la persona; sin elección se sigue al sistema, que si pide menos
     movimiento recibe una versión en calma (menos partículas, más lentas, sin entradas ni parallax). */
  F.efectos = () => leer('forja.efectos') || 'auto';
  F.sinEfectos = () => F.efectos() === 'no';
  F.reducido = () => F.efectos() === 'no' || (F.efectos() !== 'si' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  F.entrar = (elementos, opciones = {}) => {
    const lista = typeof elementos === 'string' ? document.querySelectorAll(elementos) : elementos;
    if (!window.gsap || F.reducido() || !lista || !lista.length) return;
    window.gsap.from(lista, { y: 18, opacity: 0, duration: .55, ease: 'power3.out', stagger: .045, clearProps: 'transform,opacity', ...opciones });
  };
  /* Reduce una imagen en el navegador antes de guardarla (retratos). */
  const reducir = (archivo, lado, tipo) => new Promise((ok, ko) => {
    if (!archivo || !/^image\//.test(archivo.type)) return ko(new Error('Elige una imagen.'));
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      // Si el navegador no sabe escribir ese formato devuelve PNG: vale igual, solo pesa más.
      ok({ url: c.toDataURL(tipo, .86), ancho: c.width, alto: c.height });
    };
    img.onerror = () => ko(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
  F.reducirImagen = async (archivo, lado = 512) => (await reducir(archivo, lado, 'image/jpeg')).url;
  /* Sube una imagen a la campaña y devuelve su dirección y proporción. */
  F.subirImagen = async (campana, archivo, lado = 1600, tipo = 'image/webp') => {
    const dato = await reducir(archivo, lado, tipo);
    const r = await F.api('campanas/' + encodeURIComponent(campana) + '/img', { metodo: 'POST', datos: { img: dato.url } });
    return { url: r.url, ancho: dato.ancho, alto: dato.alto };
  };
  F.dialogo = dlg => {
    const cerrar = dlg.querySelector('[data-cerrar]');
    if (cerrar && !cerrar.innerHTML.trim()) cerrar.innerHTML = F.icono('cerrar');
    dlg.querySelectorAll('[data-cerrar],[data-cerrar-texto]').forEach(b => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    return dlg;
  };
  F.fecha = ms => ms ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms)) : '';
})();
