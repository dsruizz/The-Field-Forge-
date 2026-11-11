/* Vista del jugador, pensada para el móvil: su ficha, sus conjuros, su mochila y su cuaderno.
   La vida y los espacios de conjuro los lleva el DM; aquí solo se ven. Mover objetos de sitio y escribir
   en el cuaderno es libre. Añadir, usar, dar o soltar se pide al DM; si el objeto lleva dados (una poción
   de curación, 2d4+2), el jugador tira los suyos en la mesa y escribe el resultado antes de pedirlo.
   El DM puede abrir cualquier personaje (?pj=…): sus cambios se aplican sin pedir permiso. Con &simular=1
   actúa como lo haría el jugador. Con &embed=1 se muestra dentro de la mesa, en una ventana interna. */
(async () => {
  const F = window.Forja, e = F.esc, R = (window.TFF || {}).reglas;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '', pjParam = params.get('pj') || '', simular = params.get('simular') === '1', embed = params.get('embed') === '1';
  const $ = s => document.querySelector(s);
  const main = $('[data-contenido]'), tabs = $('[data-tabs]');
  const ruta = 'campanas/' + encodeURIComponent(id) + '/jugador';
  const ATR = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];
  const mod = v => Math.floor((v - 10) / 2), signo = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const LUGARES = [['equipado', 'Equipado', 'Lo que llevas puesto o en la mano.'], ['mochila', 'Mochila', 'Lo que cargas contigo.'], ['guardado', 'Guardado', 'Lo que dejaste en el campamento o la posada.']];
  const TIPOS = { arma: 'Arma', armadura: 'Armadura', escudo: 'Escudo', pocion: 'Poción', pergamino: 'Pergamino', comida: 'Comida y bebida', herramienta: 'Herramienta', tesoro: 'Tesoro', objeto: 'Otro', frasco: 'Recipiente vacío' };
  const SE_USA = ['pocion', 'pergamino', 'comida'];
  const ACENTOS = ['acido', 'amarillo', 'oxido', 'pizarra'];
  const NOMBRE_ATR = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma', ca: 'CA' };
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const poner = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

  let est = null, tab = ['ficha', 'conjuros', 'mochila'].includes(params.get('ver')) ? params.get('ver') : 'ficha';
  if (embed) document.body.classList.add('is-embed');
  $('[data-miga]').href = 'campana.html?id=' + encodeURIComponent(id);
  $('[data-miga]').innerHTML = F.icono('atras');

  /* ---------- Color de la ficha: uno de la marca o uno propio con el gotero ---------- */
  function aplicarAcento(v) {
    const b = document.body;
    b.style.removeProperty('--ac'); b.style.removeProperty('--sobre-ac');
    if (/^#[0-9a-f]{6}$/i.test(v || '')) {
      const [r, g, bl] = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      const lum = .2126 * r + .7152 * g + .0722 * bl;
      b.dataset.acento = 'propio'; b.style.setProperty('--ac', v); b.style.setProperty('--sobre-ac', lum > .22 ? '#262626' : '#d9d9d9');
    } else b.dataset.acento = ACENTOS.includes(v) ? v : 'acido';
  }
  aplicarAcento(leer('forja.acento'));

  const esDm = () => est && est.rol === 'dm';
  const directo = () => esDm() && !simular;
  const cuerpo = extra => ({ ...(esDm() ? { pj: pjParam, simular } : {}), ...extra });
  async function hacer(extra, mensaje) {
    let r = null;
    try { r = await F.api(ruta, { metodo: 'POST', datos: cuerpo(extra) }); if (mensaje) F.toast(typeof mensaje === 'function' ? mensaje(r) : mensaje); }
    catch (err) { F.toast(err.message); }
    await cargar();
    return r;
  }
  async function cargar() {
    try { est = await F.api(ruta + (pjParam ? '?pj=' + encodeURIComponent(pjParam) : '')); }
    catch (err) {
      main.innerHTML = `<div class="vacio"><h2>No encontrada</h2><p>${e(err.message)}</p><a class="boton boton--primario" href="campanas.html">Volver a mis campañas</a></div>`;
      return;
    }
    pintar();
  }

  /* ---------- Sin personaje todavía: se pide al DM ---------- */
  const tarjetaPj = (p, attr) => `<button class="jpick" type="button" ${attr}>${F.ficha.retrato(p, 'jpick__retrato')}<span><b>${e(p.nombre)}</b><small>${e(F.ficha.linea(p) || 'Personaje')}${p.jugador ? ' · lo lleva ' + e(p.jugador) : ''}</small></span>${F.icono('proyectar')}</button>`;
  function pintarEleccion() {
    tabs.hidden = true;
    if (esDm()) {
      main.innerHTML = `<section class="jbloque"><h1 class="jtit">El móvil <span class="gotica">de cada uno</span></h1>
        <p class="suave">Abre la vista de cualquier personaje jugador.</p>
        <div class="jlista">${est.elegibles.map(p => tarjetaPj(p, `data-abrir="${e(p.id)}"`)).join('') || '<p class="suave">La campaña aún no tiene personajes jugadores.</p>'}</div></section>`;
      return;
    }
    const espera = (est.peticiones || []).find(x => x.tipo === 'pj' && x.estado === 'pendiente');
    const rechazo = (est.peticiones || []).filter(x => x.tipo === 'pj' && x.estado === 'rechazada').pop();
    if (espera) {
      main.innerHTML = `<section class="jbloque"><h1 class="jtit">Esperando <span class="gotica">al DM</span></h1>
        <p class="jpet"><span>${F.icono('movil')}</span><span><b>${e(espera.texto)}</b><small>Tu DM está revisando la ficha. En cuanto acepte, se abre aquí.</small></span><button class="boton boton--fantasma boton--chico" type="button" data-cancelar-pj>Cancelar</button></p></section>`;
      return;
    }
    main.innerHTML = `<section class="jbloque"><h1 class="jtit">Elige <span class="gotica">tu personaje</span></h1>
      <p class="suave">Tu DM recibe la petición, revisa la ficha y decide.</p>
      ${rechazo && Date.now() - (rechazo.resuelta || 0) < 30 * 60 * 1000 ? `<p class="jpet jpet--rechazada"><span>${F.icono('cerrar')}</span><span><b>${e(rechazo.texto)}</b><small>El DM no lo aceptó${rechazo.motivo ? ': ' + e(rechazo.motivo) : ''}. Prueba con otro.</small></span></p>` : ''}
      <h2 class="jsub">Personajes de la campaña</h2>
      ${est.elegibles.length ? `<div class="jlista">${est.elegibles.map(p => tarjetaPj(p, `data-elegir="${e(p.id)}"`)).join('')}</div>` : '<p class="suave">No hay personajes libres en la campaña.</p>'}
      <h2 class="jsub">O trae uno de los tuyos</h2>
      ${est.mios.length ? `<div class="jlista">${est.mios.map(p => tarjetaPj(p, `data-traer="${e(p.id)}"`)).join('')}</div>` : '<p class="suave">Todavía no has creado ningún personaje.</p>'}
      <a class="boton boton--secundario" href="personajes.html">${F.icono('mas')}Crear un personaje</a></section>`;
  }

  /* ---------- Efectos temporales (objetos de la forja) ---------- */
  const bono = (p, atr) => (p.efectos || []).filter(x => x.atr === atr).reduce((t, x) => t + (Number(x.valor) || 0), 0);
  const atrCon = (p, k) => (p.atr ? p.atr[k] : 10) + bono(p, k);

  /* ---------- Ficha: un solo contenedor con todo lo que define al personaje ---------- */
  function vistaFicha(p, plegada) {
    const pg = p.pg ?? p.pgMax ?? 0, f = p.pgMax ? Math.min(1, Math.max(0, pg / p.pgMax)) : 1;
    const estado = F.salud(pg, p.pgMax), nivel = F.muerto(pg, p.pgMax) ? 'muerto' : pg <= 0 ? 'mal' : f > .6 ? 'bien' : f > .25 ? 'medio' : 'mal';
    const salv = new Set(p.salv || []), comp = p.comp || 2, ca = (Number(p.ca) || 0) + bono(p, 'ca');
    const habTodas = R ? Object.entries(R.HABILIDADES) : [];
    const totalHab = (n, a) => p.atr ? mod(atrCon(p, a)) + comp * ((p.hab || {})[n] || 0) : null;
    const efectos = p.efectos || [];
    const notas = p.cuaderno && p.cuaderno.length ? p.cuaderno : [''];
    hoja = Math.min(hoja, notas.length - 1);
    const heroe = `
      <section class="jhero">
        <div class="jhero__quien">
          ${F.ficha.retrato(p, 'jhero__retrato')}
          <div><h1>${e(p.nombre)}</h1><p>${e(F.ficha.linea(p) || p.rol || '')}</p></div>
        </div>
        <div class="jvida" data-nivel="${nivel}">
          <div class="jvida__num"><b>${e(pg)}</b><span>/ ${e(p.pgMax || '—')} PG</span><em>${e(estado)}</em></div>
          <div class="jvida__barra"><i data-f="${Math.round(f * 100)}"></i></div>
          ${pg <= 0 && !F.muerto(pg, p.pgMax) ? `<p class="jnota">Si el daño te deja por debajo de −${Math.floor((p.pgMax || 0) / 2)} PG, mueres.</p>` : ''}
        </div>
        ${efectos.length ? `<div class="jefectos">${efectos.map(x => `<span class="jefecto">${F.icono('chispa')}${e(x.n)} · ${e(NOMBRE_ATR[x.atr] || x.atr)} ${x.valor >= 0 ? '+' : ''}${e(x.valor)} · ${e(x.turnos)} ${x.turnos === 1 ? 'turno' : 'turnos'}</span>`).join('')}</div>` : ''}
        <div class="jvitales">
          <div${bono(p, 'ca') ? ' class="is-bono"' : ''}><b>${e(p.ca !== undefined ? ca : '—')}</b><span>CA</span></div>
          <div><b>${p.atr ? signo(mod(atrCon(p, 'des')) + ((p.iniciativa ?? mod(p.atr.des)) - mod(p.atr.des))) : '—'}</b><span>Iniciativa</span></div>
          <div><b>${e(String(p.vel || '—').replace(' m', ''))}</b><span>Velocidad</span></div>
          <div><b>+${e(comp)}</b><span>Competencia</span></div>
        </div>
        ${p.atr ? `
        <div class="jpanel">
          <h2 class="jsub">Atributos</h2>
          <div class="jatr">${ATR.map(([k, t]) => { const v = atrCon(p, k); return `<div${bono(p, k) ? ' class="is-bono"' : ''}><span>${t}</span><b>${signo(mod(v))}</b><small>${e(v)}</small></div>`; }).join('')}</div>
          <h2 class="jsub">Tiradas de salvación</h2>
          <div class="jsalv">${ATR.map(([k, t]) => `<div class="${salv.has(k) ? 'is-comp' : ''}" title="${salv.has(k) ? 'Competente' : ''}"><span>${t}</span><b>${signo(mod(atrCon(p, k)) + (salv.has(k) ? comp : 0))}</b></div>`).join('')}</div>
          <p class="jnota">Marcadas: tus salvaciones con competencia.</p>
          ${habTodas.length ? `
          <details class="jhabs"${leer('forja.habs') === '1' ? ' open' : ''} data-recordar="forja.habs">
            <summary><span class="jsub">Habilidades</span><span class="jhabs__ver">Ver las 18</span></summary>
            <ul class="jhabs__lista">${habTodas.map(([n, a]) => { const c = (p.hab || {})[n] || 0; return `<li class="${c ? 'is-comp' : ''}${c > 1 ? ' is-pericia' : ''}"><span>${e(n)}<small>${e(R.ATR_LABEL ? R.ATR_LABEL[a] || a.toUpperCase() : a.toUpperCase())}</small></span><b>${signo(totalHab(n, a))}</b></li>`; }).join('')}</ul>
            <p class="jnota">Verde: competente. Con doble marca: pericia.</p>
          </details>` : ''}
        </div>` : ''}
      </section>`;
    // En Conjuros y Mochila la ficha va plegada: nombre, foto y vida a la vista, y el resto al desplegar.
    if (plegada) return `<details class="jmini"${leer('forja.mini') === '1' ? ' open' : ''} data-recordar="forja.mini">
      <summary>${F.ficha.retrato(p, 'jmini__retrato')}<span><b>${e(p.nombre)}</b><small>${e(pg)} / ${e(p.pgMax || '—')} PG · CA ${e(p.ca !== undefined ? ca : '—')}</small></span><i>Ver ficha</i></summary>${heroe}</details>`;
    return `${heroe}
      ${(p.ataques || []).length ? `<section class="jbloque"><h2 class="jsub">Ataques</h2><div class="lista-ataques">${p.ataques.map(a => `<div class="ataque"><div><b>${e(a.n)}</b><small>${e([a.t, a.r, a.nota].filter(Boolean).join(' · '))}</small></div><span class="ataque__num">${a.b !== undefined && a.b !== null && a.b !== '' ? signo(a.b) : ''}</span><span class="ataque__num">${e(a.d || '')}</span></div>`).join('')}</div></section>` : ''}
      ${(p.rasgos || []).length ? `<section class="jbloque"><details class="jplegable"${leer('forja.rasgos') === '1' ? ' open' : ''} data-recordar="forja.rasgos"><summary><span class="jsub">Rasgos <i>${p.rasgos.length}</i></span></summary><div class="rasgos">${p.rasgos.map(r => `<details><summary>${e(r.n)}</summary><p>${e(r.d)}</p></details>`).join('')}</div></details></section>` : ''}
      ${p.idiomas || p.sentidos ? `<section class="jbloque"><h2 class="jsub">Sentidos e idiomas</h2><p class="suave">${e([p.sentidos, p.idiomas].filter(Boolean).join(' · '))}</p></section>` : ''}
      ${esDm() && !simular ? `<section class="jbloque"><h2 class="jsub">${F.icono('libreta')}Cuaderno</h2><p class="jnota">El cuaderno es privado: solo lo lee quien lleva a ${e(p.nombre)}.</p></section>` : `<section class="jbloque"><details class="jplegable jcuaderno"${leer('forja.cuaderno') !== '0' ? ' open' : ''} data-recordar="forja.cuaderno" data-abierto-def="1">
        <summary><span class="jsub">${F.icono('libreta')}Cuaderno <i>${notas.length}</i></span><span class="jcuaderno__estado" data-cuaderno-estado></span></summary>
        <div class="jcuaderno__hoja">
          <textarea class="jcuaderno__txt" data-cuaderno maxlength="3000" aria-label="Hoja ${hoja + 1} del cuaderno" placeholder="Lo que quieras recordar: nombres, pistas, deudas, planes…">${e(notas[hoja])}</textarea>
          <span class="jcuaderno__n">${hoja + 1} / ${notas.length}</span>
        </div>
        <div class="jcuaderno__nav">
          <button class="boton boton--secundario boton--chico boton--icono" type="button" data-hoja="-1" aria-label="Hoja anterior"${hoja ? '' : ' disabled'}>${F.icono('atras')}</button>
          <button class="boton boton--secundario boton--chico boton--icono jcuaderno__sig" type="button" data-hoja="1" aria-label="Hoja siguiente"${hoja < notas.length - 1 ? '' : ' disabled'}>${F.icono('atras')}</button>
          <button class="boton boton--fantasma boton--chico" type="button" data-hoja-nueva>${F.icono('mas')}Hoja</button>
          ${notas.length > 1 ? `<button class="boton boton--fantasma boton--chico boton--icono" type="button" data-hoja-borrar aria-label="Borrar esta hoja" title="Borrar esta hoja">${F.icono('borrar')}</button>` : ''}
          <button class="boton boton--primario boton--chico empuja" type="button" data-cuaderno-guardar>Guardar</button>
        </div>
      </details></section>`}
      <section class="jbloque"><h2 class="jsub">Color de tu ficha</h2>
        <div class="jacentos" role="group" aria-label="Color de tu ficha">${ACENTOS.map(a => `<button type="button" data-acento="${a}" aria-pressed="${document.body.dataset.acento === a}" aria-label="${a}"></button>`).join('')}
          <label class="jacentos__gotero${document.body.dataset.acento === 'propio' ? ' is-on' : ''}" title="Elige tu propio color">${F.icono('gotero')}<input type="color" data-gotero value="${/^#/.test(leer('forja.acento') || '') ? e(leer('forja.acento')) : '#aad431'}" aria-label="Color propio"></label>
        </div>
      </section>`;
  }

  /* ---------- Cuaderno: hojas de tamaño fijo que se pasan como en una libreta ---------- */
  let hoja = 0, borrador = null;
  const hojas = () => borrador || (est.pj.cuaderno && est.pj.cuaderno.length ? est.pj.cuaderno.slice() : ['']);
  const marcarCuaderno = t => { const x = $('[data-cuaderno-estado]'); if (x) x.textContent = t; };
  async function guardarCuaderno() {
    const h = hojas();
    try { await F.api(ruta, { metodo: 'POST', datos: cuerpo({ accion: 'notas', hojas: h }) }); est.pj.cuaderno = h; borrador = null; marcarCuaderno('Guardado'); }
    catch (err) { F.toast(err.message); }
  }

  /* ---------- Conjuros ---------- */
  function vistaConjuros(p) {
    const c = p.conj;
    if (!c || !((c.trucos || []).length || (c.lista || []).length)) return `<div class="vacio"><h2>Sin conjuros</h2><p>${e(p.nombre)} no lanza conjuros, al menos de momento.</p></div>`;
    const conj = n => (R && R.CONJURO[n]) || { d: '' };
    const usados = p.usados || {};
    const niveles = Object.entries(c.espacios || {}).filter(([, k]) => k > 0);
    const porNivel = {};
    (c.lista || []).forEach(n => { const l = conj(n).l ?? '?'; (porNivel[l] = porNivel[l] || []).push(n); });
    const item = (n, etq) => { const x = conj(n); return `<details><summary><span class="chip">${e(etq)}</span>${e(n)}</summary><div class="jconj-txt"><p>${e(x.x || x.d || 'Consulta la descripción con tu DM.')}</p>${x.x && x.d ? `<p class="jconj-res"><b>En corto:</b> ${e(x.d)}</p>` : ''}</div></details>`; };
    const dm = directo();
    return `
      <section class="jbloque jconj-cab"><div><b>${e(c.cd)}</b><span>CD de salvación</span></div><div><b>${signo(c.atk || 0)}</b><span>Ataque de conjuro</span></div></section>
      ${niveles.length ? `<section class="jbloque"><h2 class="jsub">Espacios de conjuro</h2>
        <div class="jesp">${niveles.map(([n, k]) => { const u = Math.min(k, usados[n] || 0); return `<div class="jesp__fila"><span>Nivel ${e(n)}</span><div role="group" aria-label="Espacios de nivel ${e(n)}: quedan ${k - u} de ${k}">${Array.from({ length: k }, (_, i) => dm ? `<button type="button" class="${i < u ? 'is-gastado' : ''}" data-esp="${e(n)}:${i < u ? i : i + 1}" aria-label="${i < u ? 'Recuperar' : 'Gastar'} espacio"></button>` : `<i class="${i < u ? 'is-gastado' : ''}"></i>`).join('')}</div><small>${k - u} de ${k}</small></div>`; }).join('')}</div>
        <p class="jnota">${dm ? 'Toca un espacio para gastarlo o recuperarlo.' : 'Tu DM marca los espacios que gastas.'}${c.pacto ? ' Se recuperan con un descanso corto.' : ''}</p>
        ${dm ? `<div class="jfila"><button class="boton boton--secundario boton--chico" type="button" data-descanso="largo">${F.icono('fuego')}Descanso largo</button>${c.pacto ? `<button class="boton boton--secundario boton--chico" type="button" data-descanso="corto">Descanso corto</button>` : ''}</div>` : ''}
      </section>` : ''}
      ${(c.trucos || []).length ? `<section class="jbloque"><h2 class="jsub">Trucos</h2><div class="rasgos">${c.trucos.map(n => item(n, 'Truco')).join('')}</div></section>` : ''}
      ${Object.keys(porNivel).sort().map(l => `<section class="jbloque"><h2 class="jsub">Nivel ${e(l)}</h2><div class="rasgos">${porNivel[l].map(n => item(n, 'Nv ' + l)).join('')}</div></section>`).join('')}`;
  }

  /* ---------- Respuestas del DM: se ven un rato y se van solas, o se cierran con la X ----------
     Las ya vistas se recuerdan en este navegador para que no vuelvan al recargar. */
  const CLAVE_VISTAS = 'forja.vistas.' + id, DURA_AVISO = 8000;
  const vistas = new Set((() => { try { return JSON.parse(leer(CLAVE_VISTAS) || '[]'); } catch { return []; } })());
  const relojes = new Map();
  function marcarVista(idp) {
    if (vistas.has(idp)) return;
    vistas.add(idp); poner(CLAVE_VISTAS, JSON.stringify([...vistas].slice(-60)));
    clearTimeout(relojes.get(idp)); relojes.delete(idp);
    const el = main.querySelector(`[data-respuesta="${CSS.escape(idp)}"]`);
    if (!el) return;
    const quitar = () => { const caja = el.parentNode; el.remove(); if (caja && caja.classList.contains('jpets') && !caja.children.length) caja.remove(); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return quitar();
    el.classList.add('is-saliendo'); setTimeout(quitar, 320);
  }
  // Tras pintar: cada respuesta visible se oculta sola pasados unos segundos (una sola cuenta por aviso).
  function programarAvisos() {
    main.querySelectorAll('[data-respuesta]').forEach(el => {
      const idp = el.dataset.respuesta;
      if (!relojes.has(idp)) relojes.set(idp, setTimeout(() => marcarVista(idp), DURA_AVISO));
    });
  }

  /* ---------- Mochila ---------- */
  const pendientes = () => (est.peticiones || []).filter(x => x.estado === 'pendiente');
  const textoEfecto = ef => !ef ? '' : ef.clase === 'curar' ? `Cura ${ef.dados} PG` : `${NOMBRE_ATR[ef.clase === 'ca' ? 'ca' : ef.atr]} ${ef.dados ? '+' + ef.dados : (ef.valor >= 0 ? '+' : '') + ef.valor} durante ${ef.turnos} ${ef.turnos === 1 ? 'turno' : 'turnos'}`;
  // «2d4+2» → { n: 2, caras: 4, mod: 2 }; un número fijo no pide tirada.
  const dadosDe = ob => { const m = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/i.exec((ob.efecto && ob.efecto.dados) || ''); return m ? { n: Number(m[1]) || 1, caras: Number(m[2]), mod: Number(m[3]) || 0 } : null; };
  function vistaMochila(p) {
    const inv = p.inv || [], pend = pendientes();
    const recientes = (est.peticiones || []).filter(x => x.estado !== 'pendiente' && !vistas.has(x.id) && Date.now() - (x.resuelta || 0) < 15 * 60 * 1000).slice(-3);
    const enEspera = new Set(pend.map(x => x.objeto));
    return `
      ${pend.length || recientes.length ? `<section class="jbloque jpets">
        ${pend.map(x => `<p class="jpet"><span>${F.icono('movil')}</span><span><b>${e(x.texto)}</b><small>Esperando al DM</small></span><button class="boton boton--fantasma boton--chico" type="button" data-cancelar="${e(x.id)}">Cancelar</button></p>`).join('')}
        ${recientes.map(x => `<p class="jpet jpet--${e(x.estado)}" data-respuesta="${e(x.id)}"><span>${F.icono(x.estado === 'aprobada' ? 'hecho' : 'cerrar')}</span><span><b>${e(x.texto)}</b><small>${x.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}${x.resultado ? ' · ' + e(x.resultado) : ''}${x.motivo ? ' · ' + e(x.motivo) : ''} · ${e(F.hace(x.resuelta))}</small></span><button class="jpet__cerrar" type="button" data-visto="${e(x.id)}" aria-label="Cerrar aviso">${F.icono('cerrar')}</button></p>`).join('')}
      </section>` : ''}
      ${LUGARES.map(([k, t, ayuda]) => { const l = inv.filter(x => (x.lugar || 'mochila') === k); return `
        <section class="jbloque jzona"><h2 class="jsub">${t} <i>${l.reduce((n, x) => n + (x.cant || 1), 0)}</i></h2>
          ${l.length ? `<div class="jinv">${l.map(x => `<button class="ob ob--${e(x.tipo)}${enEspera.has(x.id) ? ' is-espera' : ''}${x.efecto ? ' ob--magico' : ''}" type="button" data-objeto="${e(x.id)}"><span class="ob__ico">${F.icono(x.tipo in TIPOS ? x.tipo : 'objeto')}${x.cant > 1 ? `<i>${e(x.cant)}</i>` : ''}</span><b>${e(x.n)}</b></button>`).join('')}</div>` : `<p class="jnota">${ayuda}</p>`}
        </section>`; }).join('')}
      <button class="boton boton--primario jflot" type="button" data-pedir>${F.icono('mas')}${directo() ? 'Añadir objeto' : 'Pedir un objeto'}</button>`;
  }

  /* ---------- Pintado ---------- */
  const TABS = [['ficha', 'Ficha', 'mascara'], ['conjuros', 'Conjuros', 'chispa'], ['mochila', 'Mochila', 'mochila']];
  function pintar() {
    $('[data-campana]').textContent = est.campana;
    const m = $('[data-modo]');
    m.hidden = !esDm();
    if (esDm()) {
      const otra = new URL(location.href); if (simular) otra.searchParams.delete('simular'); else otra.searchParams.set('simular', '1');
      const enlace = `<a href="${e(otra.pathname.split('/').pop() + otra.search)}">${simular ? 'Salir de la prueba' : 'Probar como jugador'}</a>`;
      m.innerHTML = est.pj ? (simular ? `<b>Modo prueba.</b> Actúas como el jugador: lo que pidas llega a tu mesa. ${enlace}` : `<b>Vista del DM.</b> Así lo ve en su móvil; tus cambios se aplican sin pedir permiso. ${enlace}`) : '<b>Vista del DM.</b>';
    }
    const p = est.pj;
    if (!p) return pintarEleccion();
    document.title = p.nombre + ' · The Field Forge';
    const y = scrollY, foco = document.activeElement && document.activeElement.matches('[data-cuaderno]');
    if (borrador) p.cuaderno = borrador;
    main.innerHTML = `<div class="jvista">${tab === 'ficha' ? '' : vistaFicha(p, true)}${({ ficha: vistaFicha, conjuros: vistaConjuros, mochila: vistaMochila })[tab](p)}</div>`;
    main.querySelectorAll('[data-f]').forEach(i => { i.style.width = i.dataset.f + '%'; });
    programarAvisos();
    if (borrador) marcarCuaderno('Sin guardar');
    if (foco) { const t = $('[data-cuaderno]'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    tabs.hidden = false;
    const n = pendientes().length;
    tabs.innerHTML = TABS.map(([k, t, ic]) => `<button type="button" aria-pressed="${k === tab}" data-tab="${k}">${F.icono(ic)}<span>${t}</span>${k === 'mochila' && n ? `<i>${n}</i>` : ''}</button>`).join('');
    scrollTo(0, y);
    if (dlgOb.open && !tirando) { const ob = (p.inv || []).find(x => x.id === dlgOb.dataset.id); if (ob) pintarObjeto(ob); else dlgOb.close(); }
  }

  /* ---------- Objeto ---------- */
  const dlgOb = F.dialogo($('#objeto-dlg'));
  let tirando = null; // id del objeto cuyo uso espera la tirada del jugador
  function pintarTirada(ob, d) {
    const mod = d.mod ? ` El ${d.mod > 0 ? '+' : ''}${d.mod} se suma solo.` : '';
    return `<form class="ob-tirada" data-ob-tirada novalidate>
      <p class="ob-tirada__pide">${F.icono('dado')}<span><b>Tira ${e(d.n)}d${e(d.caras)}</b><small>Tira tus dados en la mesa y escribe lo que suman.${e(mod)}</small></span></p>
      <div class="campo"><label for="ob-tirada">Lo que sacaste <span class="suave">(${e(d.n)} a ${e(d.n * d.caras)})</span></label>
        <input class="entrada" id="ob-tirada" name="tirada" type="number" inputmode="numeric" min="${e(d.n)}" max="${e(d.n * d.caras)}" required autocomplete="off"></div>
      <p class="aviso" role="alert"></p>
      <div class="ob-acc ob-acc--fila">
        <button class="boton boton--fantasma" type="button" data-ob-volver>Volver</button>
        <button class="boton boton--primario" type="submit">${F.icono('hecho')}<span>${directo() ? 'Aplicar' : 'Enviar al DM'}</span></button>
      </div>
    </form>`;
  }
  function pintarObjeto(ob) {
    if (dlgOb.dataset.id !== ob.id) tirando = null;
    dlgOb.dataset.id = ob.id;
    const espera = pendientes().find(x => x.objeto === ob.id);
    const pide = directo() ? '' : ' <small>pide permiso</small>';
    const usable = ob.efecto || SE_USA.includes(ob.tipo);
    $('[data-ob-cab]').innerHTML = `<span class="ob__ico ob--${e(ob.tipo)}">${F.icono(ob.tipo in TIPOS ? ob.tipo : 'objeto')}</span><div><h2 id="ob-nombre">${e(ob.n)}</h2><p class="suave">${e(TIPOS[ob.tipo] || 'Objeto')}${ob.cant > 1 ? ' · ' + e(ob.cant) + ' unidades' : ''}</p></div>`;
    $('[data-ob-cuerpo]').innerHTML = `
      ${ob.efecto ? `<p class="ob-efecto">${F.icono('chispa')}<span><b>${e(textoEfecto(ob.efecto))}</b><small>${ob.consumible !== false ? 'Se gasta al usarlo' : 'No se gasta'}${ob.resto ? ' · deja: ' + e(ob.resto) : ''}</small></span></p>` : ''}
      ${ob.nota ? `<p class="ob-nota">${e(ob.nota)}</p>` : ''}
      <div class="campo"><span class="etq">Dónde lo llevas</span><div class="tipos" role="group">${LUGARES.map(([k, t]) => `<button type="button" aria-pressed="${(ob.lugar || 'mochila') === k}" data-mover="${k}">${t}</button>`).join('')}</div></div>
      ${tirando === ob.id && dadosDe(ob) ? pintarTirada(ob, dadosDe(ob)) : espera ? `<p class="jpet"><span>${F.icono('movil')}</span><span><b>${e(espera.texto)}</b><small>Esperando al DM</small></span></p>` : `
      <div class="ob-acc">
        ${usable ? `<button class="boton boton--primario" type="button" data-ob-usar>${F.icono(ob.tipo in TIPOS ? ob.tipo : 'chispa')}<span>Usar${pide}</span></button>` : ''}
        ${est.companeros.length ? `<div class="ob-dar"><select class="entrada" data-ob-a aria-label="A quién se lo das">${est.companeros.map(c => `<option value="${e(c.id)}">${e(c.nombre)}</option>`).join('')}</select><button class="boton boton--secundario" type="button" data-ob-dar>${F.icono('dar')}<span>Dar${pide}</span></button></div>` : ''}
        ${ob.cant > 1 ? `<label class="campo ob-cant"><span class="etq">Cuántos (para dar o soltar)</span><input class="entrada" type="number" inputmode="numeric" min="1" max="${e(ob.cant)}" value="1" data-ob-cant></label>` : ''}
        <button class="boton boton--fantasma" type="button" data-ob-tirar>${F.icono('borrar')}<span>Soltar${pide}</span></button>
      </div>`}`;
  }
  dlgOb.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const objeto = dlgOb.dataset.id, cant = (dlgOb.querySelector('[data-ob-cant]') || {}).value || 1;
    const aviso = directo() ? 'Hecho' : 'Enviado al DM';
    const ob = est.pj.inv.find(x => x.id === objeto);
    if (b.dataset.mover) return hacer({ accion: 'mover', objeto, lugar: b.dataset.mover });
    if ('obVolver' in b.dataset) { tirando = null; return pintarObjeto(ob); }
    if ('obUsar' in b.dataset) {
      // Con dados, primero se pide la tirada; el efecto no se aplica hasta que el DM lo aprueba.
      if (ob && dadosDe(ob)) { tirando = ob.id; pintarObjeto(ob); const i = dlgOb.querySelector('#ob-tirada'); if (i) i.focus(); return; }
      dlgOb.close();
      if (directo()) return hacer({ accion: 'usar', objeto }, r => `${ob.n}: ${(r && r.resultado) || 'usado'}`);
      return hacer({ accion: 'pedir', tipo: 'usar', objeto }, aviso);
    }
    if ('obDar' in b.dataset) { const a = dlgOb.querySelector('[data-ob-a]').value; dlgOb.close(); return hacer({ accion: 'pedir', tipo: 'dar', objeto, a, cant }, aviso); }
    if ('obTirar' in b.dataset) { dlgOb.close(); return hacer({ accion: 'pedir', tipo: 'tirar', objeto, cant }, aviso); }
  });

  dlgOb.addEventListener('submit', async ev => {
    const f = ev.target.closest('[data-ob-tirada]'); if (!f) return;
    ev.preventDefault();
    const ob = est.pj.inv.find(x => x.id === dlgOb.dataset.id), d = ob && dadosDe(ob); if (!d) return;
    const v = parseInt(f.tirada.value, 10), max = d.n * d.caras;
    if (Number.isNaN(v) || v < d.n || v > max) { f.querySelector('.aviso').textContent = `Escribe un número entre ${d.n} y ${max}.`; f.tirada.focus(); return; }
    tirando = null; dlgOb.close();
    if (directo()) return hacer({ accion: 'usar', objeto: ob.id, tirada: v }, r => `${ob.n}: ${(r && r.resultado) || 'usado'}`);
    return hacer({ accion: 'pedir', tipo: 'usar', objeto: ob.id, tirada: v }, 'Enviado al DM: espera su aprobación');
  });
  dlgOb.addEventListener('close', () => { tirando = null; });

  /* ---------- Pedir un objeto ---------- */
  const dlgPd = F.dialogo($('#pedir-dlg')), formPd = dlgPd.querySelector('form');
  let tipoPd = 'objeto';
  const pintarTipos = () => { $('[data-pd-tipos]').innerHTML = Object.entries(TIPOS).filter(([k]) => k !== 'frasco').map(([k, t]) => `<button type="button" aria-pressed="${k === tipoPd}" data-pd-tipo="${k}">${F.icono(k)}${t}</button>`).join(''); };
  dlgPd.addEventListener('click', ev => { const b = ev.target.closest('[data-pd-tipo]'); if (b) { tipoPd = b.dataset.pdTipo; pintarTipos(); } });
  formPd.addEventListener('submit', async ev => {
    ev.preventDefault();
    const n = formPd.n.value.trim();
    if (!n) { formPd.querySelector('.aviso').textContent = 'Escribe qué es.'; formPd.n.focus(); return; }
    dlgPd.close();
    await hacer({ accion: 'pedir', tipo: 'anadir', n, clase: tipoPd, cant: formPd.cant.value, nota: formPd.nota.value.trim() }, directo() ? 'Añadido' : 'Enviado al DM');
  });

  /* ---------- Eventos ---------- */
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b || b.closest('dialog')) return;
    const d = b.dataset;
    if (d.tab) { if (borrador) await guardarCuaderno(); tab = d.tab; const u = new URL(location.href); u.searchParams.set('ver', tab); history.replaceState(null, '', u); pintar(); scrollTo(0, 0); F.entrar(main.querySelectorAll('.jvista > *'), { y: 10, stagger: .03 }); }
    else if (d.esp) { const [nivel, usados] = d.esp.split(':'); est.pj.usados = { ...(est.pj.usados || {}), [nivel]: Number(usados) }; pintar(); hacer({ accion: 'espacio', nivel, usados }); }
    else if (d.descanso) { if (confirm(d.descanso === 'largo' ? '¿Descanso largo? Recupera todos los espacios de conjuro y la vida.' : '¿Descanso corto? Recupera los espacios de conjuro.')) hacer({ accion: 'descanso', largo: d.descanso === 'largo' }, 'Descansado'); }
    else if (d.objeto) { const ob = est.pj.inv.find(x => x.id === d.objeto); if (ob) { pintarObjeto(ob); dlgOb.showModal(); } }
    else if ('pedir' in d) { formPd.reset(); tipoPd = 'objeto'; pintarTipos(); formPd.querySelector('.aviso').textContent = ''; $('[data-pd-nota]').textContent = directo() ? 'Como DM, se añade al momento.' : 'Tu DM lo verá en su mesa y decidirá si entra en tu inventario.'; $('[data-pd-enviar]').textContent = directo() ? 'Añadir' : 'Pedir al DM'; dlgPd.showModal(); }
    else if (d.visto) marcarVista(d.visto);
    else if (d.cancelar) hacer({ accion: 'cancelar', peticion: d.cancelar });
    else if ('cancelarPj' in d) hacer({ accion: 'cancelar' }, 'Petición cancelada');
    else if (d.acento) { aplicarAcento(d.acento); poner('forja.acento', d.acento); pintar(); }
    else if (d.elegir) hacer({ accion: 'elegir', pj: d.elegir }, 'Petición enviada al DM');
    else if (d.traer) hacer({ accion: 'traer', personaje: d.traer }, 'Petición enviada al DM');
    else if (d.abrir) { const u = new URL(location.href); u.searchParams.set('pj', d.abrir); location.href = u; }
    else if (d.hoja) { const h = hojas(); hoja = Math.max(0, Math.min(h.length - 1, hoja + Number(d.hoja))); pintar(); }
    else if ('hojaNueva' in d) { const h = hojas(); if (h.length >= 60) return F.toast('El cuaderno está lleno (60 hojas).'); h.push(''); borrador = h; hoja = h.length - 1; pintar(); $('[data-cuaderno]').focus(); }
    else if ('hojaBorrar' in d) { if (!confirm('¿Borrar esta hoja del cuaderno?')) return; const h = hojas(); h.splice(hoja, 1); borrador = h.length ? h : ['']; hoja = Math.max(0, hoja - 1); await guardarCuaderno(); pintar(); }
    else if ('cuadernoGuardar' in d) { await guardarCuaderno(); F.toast('Cuaderno guardado'); }
  });
  document.addEventListener('input', ev => {
    if (ev.target.matches('[data-cuaderno]')) { const h = hojas(); h[hoja] = ev.target.value; borrador = h; marcarCuaderno('Sin guardar'); }
    else if (ev.target.matches('[data-gotero]')) { aplicarAcento(ev.target.value); poner('forja.acento', ev.target.value); document.querySelectorAll('[data-acento]').forEach(x => x.setAttribute('aria-pressed', 'false')); ev.target.parentNode.classList.add('is-on'); }
  });
  document.addEventListener('toggle', ev => { const t = ev.target; if (t.dataset && t.dataset.recordar) poner(t.dataset.recordar, t.open ? '1' : '0'); }, true);
  // Si se cierra o se esconde la página con el cuaderno a medias, se guarda solo.
  document.addEventListener('visibilitychange', () => { if (document.hidden && borrador) guardarCuaderno(); });

  /* ---------- En vivo ---------- */
  let relojVivo = 0;
  const refrescar = () => { clearTimeout(relojVivo); relojVivo = setTimeout(cargar, 120); };
  F.enVivo(id, d => {
    // La vida llega en el propio aviso: se pinta al instante y luego se refresca lo demás.
    if (d.pg && est && est.pj && d.pg[est.pj.id] !== undefined && d.pg[est.pj.id] !== est.pj.pg) { est.pj.pg = d.pg[est.pj.id]; pintar(); }
    if (d.reconectado || d.pj || d.parches) refrescar();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });

  await cargar();
  F.entrar(main.querySelectorAll('.jhero, .jvista > *, .jpick'), { y: 12, stagger: .04 });
})();
