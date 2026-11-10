/* Vista del jugador, pensada para el móvil: su ficha, su vida, sus conjuros y su inventario.
   La vida, los espacios de conjuro y mover objetos de sitio son cosa suya. Añadir, usar, dar o soltar
   un objeto se pide al DM, que lo aprueba desde su mesa.
   El DM puede abrir cualquier personaje (?pj=…): sus cambios se aplican al momento. Con &simular=1
   actúa como lo haría el jugador, para probar el circuito completo sin otro dispositivo. */
(async () => {
  const F = window.Forja, e = F.esc, R = (window.TFF || {}).reglas;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '', pjParam = params.get('pj') || '', simular = params.get('simular') === '1';
  const $ = s => document.querySelector(s);
  const main = $('[data-contenido]'), tabs = $('[data-tabs]');
  const ruta = 'campanas/' + encodeURIComponent(id) + '/jugador';
  const ATR = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];
  const mod = v => Math.floor((v - 10) / 2), signo = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const LUGARES = [['equipado', 'Equipado', 'Lo que llevas puesto o en la mano.'], ['mochila', 'Mochila', 'Lo que cargas contigo.'], ['guardado', 'Guardado', 'Lo que dejaste en el campamento o la posada.']];
  const TIPOS = { arma: 'Arma', armadura: 'Armadura', escudo: 'Escudo', pocion: 'Poción', pergamino: 'Pergamino', comida: 'Comida', herramienta: 'Herramienta', tesoro: 'Tesoro', objeto: 'Otro', frasco: 'Frasco' };
  const SE_USA = ['pocion', 'pergamino', 'comida'];
  const ACENTOS = ['acido', 'amarillo', 'oxido', 'pizarra'];
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const poner = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

  let est = null, tab = ['ficha', 'conjuros', 'mochila'].includes(params.get('ver')) ? params.get('ver') : 'ficha';
  let pgReloj = 0, pgLocal = null;
  document.body.dataset.acento = ACENTOS.includes(leer('forja.acento')) ? leer('forja.acento') : 'acido';
  $('[data-miga]').href = 'campana.html?id=' + encodeURIComponent(id) + (pjParam ? '&ver=grupo' : '');
  $('[data-miga]').innerHTML = F.icono('atras');

  const esDm = () => est && est.rol === 'dm';
  const directo = () => esDm() && !simular;
  const cuerpo = extra => ({ ...(esDm() ? { pj: pjParam, simular } : {}), ...extra });
  async function hacer(extra, mensaje) {
    try { await F.api(ruta, { metodo: 'POST', datos: cuerpo(extra) }); if (mensaje) F.toast(mensaje); }
    catch (err) { F.toast(err.message); }
    await cargar();
  }
  async function cargar() {
    try { est = await F.api(ruta + (pjParam ? '?pj=' + encodeURIComponent(pjParam) : '')); }
    catch (err) {
      main.innerHTML = `<div class="vacio"><h2>No encontrada</h2><p>${e(err.message)}</p><a class="boton boton--primario" href="campanas.html">Volver a mis campañas</a></div>`;
      return;
    }
    if (est.pj && pgLocal !== null) est.pj.pg = pgLocal;
    pintar();
  }

  /* ---------- Sin personaje todavía ---------- */
  const tarjetaPj = (p, attr) => `<button class="jpick" type="button" ${attr}>${F.ficha.retrato(p, 'jpick__retrato')}<span><b>${e(p.nombre)}</b><small>${e(F.ficha.linea(p) || 'Personaje')}${p.jugador ? ' · lo lleva ' + e(p.jugador) : ''}</small></span>${F.icono('proyectar')}</button>`;
  function pintarEleccion() {
    tabs.hidden = true;
    if (esDm()) {
      main.innerHTML = `<section class="jbloque"><h1 class="jtit">El móvil <span class="gotica">de cada uno</span></h1>
        <p class="suave">Abre la vista de cualquier personaje jugador. Lo que cambies se aplica al momento.</p>
        <div class="jlista">${est.elegibles.map(p => tarjetaPj(p, `data-abrir="${e(p.id)}"`)).join('') || '<p class="suave">La campaña aún no tiene personajes jugadores.</p>'}</div></section>`;
      return;
    }
    main.innerHTML = `<section class="jbloque"><h1 class="jtit">Elige <span class="gotica">tu personaje</span></h1>
      ${est.elegibles.length ? `<p class="suave">Estos personajes de la campaña están libres.</p><div class="jlista">${est.elegibles.map(p => tarjetaPj(p, `data-elegir="${e(p.id)}"`)).join('')}</div>` : '<p class="suave">No hay personajes libres en la campaña.</p>'}
      <h2 class="jsub">O trae uno de los tuyos</h2>
      ${est.mios.length ? `<div class="jlista">${est.mios.map(p => tarjetaPj(p, `data-traer="${e(p.id)}"`)).join('')}</div>` : '<p class="suave">Todavía no has creado ningún personaje.</p>'}
      <a class="boton boton--secundario" href="personajes.html">${F.icono('mas')}Crear un personaje</a></section>`;
  }

  /* ---------- Cabecera: quién eres y tu vida ---------- */
  function cabecera(p) {
    const pg = p.pg ?? p.pgMax ?? 0, f = p.pgMax ? Math.min(1, Math.max(0, pg / p.pgMax)) : 1;
    return `
      <section class="jhero">
        <div class="jhero__quien">
          ${F.ficha.retrato(p, 'jhero__retrato')}
          <div><h1>${e(p.nombre)}</h1><p>${e(F.ficha.linea(p) || p.rol || '')}</p></div>
        </div>
        <div class="jvida" data-nivel="${f > .6 ? 'bien' : f > .25 ? 'medio' : 'mal'}">
          <div class="jvida__num"><b data-pg>${e(pg)}</b><span>/ ${e(p.pgMax || '—')} PG</span><em data-salud>${pg <= 0 ? 'Caído' : f > .6 ? 'En forma' : f > .25 ? 'Herido' : 'Malherido'}</em></div>
          <div class="jvida__barra"><i data-barra data-f="${Math.round(f * 100)}"></i></div>
          <div class="jvida__mas" role="group" aria-label="Cambiar puntos de golpe">${[-5, -1, 1, 5].map(n => `<button type="button" data-pg-mas="${n}" aria-label="${n > 0 ? 'Curar' : 'Perder'} ${Math.abs(n)}">${n > 0 ? '+' + n : '−' + Math.abs(n)}</button>`).join('')}</div>
        </div>
        <div class="jvitales">
          <div><b>${e(p.ca ?? '—')}</b><span>CA</span></div>
          <div><b>${p.atr ? signo(p.iniciativa ?? mod(p.atr.des)) : '—'}</b><span>Iniciativa</span></div>
          <div><b>${e(String(p.vel || '—').replace(' m', ''))}</b><span>Velocidad</span></div>
          <div><b>+${e(p.comp || 2)}</b><span>Competencia</span></div>
        </div>
      </section>`;
  }

  /* ---------- Ficha ---------- */
  function vistaFicha(p) {
    const salv = new Set(p.salv || []);
    const habs = Object.entries(p.hab || {}).filter(([, v]) => v).map(([n, v]) => { const a = R && R.HABILIDADES[n]; const t = a && p.atr ? mod(p.atr[a]) + (p.comp || 2) * v : null; return `<span class="chip">${e(n)}${t !== null ? ' ' + signo(t) : ''}</span>`; }).join('');
    return `
      ${p.atr ? `<section class="jbloque"><h2 class="jsub">Atributos</h2><div class="jatr">${ATR.map(([k, t]) => `<div class="${salv.has(k) ? 'is-salv' : ''}"><span>${t}</span><b>${signo(mod(p.atr[k]))}</b><small>${e(p.atr[k])}</small></div>`).join('')}</div><p class="jnota">El borde marca tus salvaciones competentes.</p></section>` : ''}
      ${(p.ataques || []).length ? `<section class="jbloque"><h2 class="jsub">Ataques</h2><div class="lista-ataques">${p.ataques.map(a => `<div class="ataque"><div><b>${e(a.n)}</b><small>${e([a.t, a.r, a.nota].filter(Boolean).join(' · '))}</small></div><span class="ataque__num">${a.b !== undefined && a.b !== null && a.b !== '' ? signo(a.b) : ''}</span><span class="ataque__num">${e(a.d || '')}</span></div>`).join('')}</div></section>` : ''}
      ${habs ? `<section class="jbloque"><h2 class="jsub">Habilidades</h2><div class="habs">${habs}</div></section>` : ''}
      ${(p.rasgos || []).length ? `<section class="jbloque"><h2 class="jsub">Rasgos</h2><div class="rasgos">${p.rasgos.map(r => `<details><summary>${e(r.n)}</summary><p>${e(r.d)}</p></details>`).join('')}</div></section>` : ''}
      ${p.idiomas || p.sentidos ? `<section class="jbloque"><h2 class="jsub">Sentidos e idiomas</h2><p class="suave">${e([p.sentidos, p.idiomas].filter(Boolean).join(' · '))}</p></section>` : ''}
      <section class="jbloque"><h2 class="jsub">Color de tu ficha</h2>
        <div class="jacentos" role="group" aria-label="Color de tu ficha">${ACENTOS.map(a => `<button type="button" data-acento="${a}" aria-pressed="${document.body.dataset.acento === a}" aria-label="${a}"></button>`).join('')}</div>
        ${!esDm() ? `<button class="boton boton--fantasma boton--chico" type="button" data-soltar>Cambiar de personaje</button>` : ''}
      </section>`;
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
    const item = (n, etq) => `<details><summary><span class="chip">${e(etq)}</span>${e(n)}</summary><p>${e(conj(n).d || 'Consulta la descripción con tu DM.')}</p></details>`;
    return `
      <section class="jbloque jconj-cab"><div><b>${e(c.cd)}</b><span>CD de salvación</span></div><div><b>${signo(c.atk || 0)}</b><span>Ataque de conjuro</span></div></section>
      ${niveles.length ? `<section class="jbloque"><h2 class="jsub">Espacios de conjuro</h2>
        <div class="jesp">${niveles.map(([n, k]) => { const u = Math.min(k, usados[n] || 0); return `<div class="jesp__fila"><span>Nivel ${e(n)}</span><div role="group" aria-label="Espacios de nivel ${e(n)}: quedan ${k - u} de ${k}">${Array.from({ length: k }, (_, i) => `<button type="button" class="${i < u ? 'is-gastado' : ''}" data-esp="${e(n)}:${i < u ? i : i + 1}" aria-label="${i < u ? 'Recuperar' : 'Gastar'} espacio"></button>`).join('')}</div><small>${k - u} de ${k}</small></div>`; }).join('')}</div>
        <p class="jnota">Toca un espacio para gastarlo o recuperarlo.${c.pacto ? ' Se recuperan con un descanso corto.' : ''}</p>
        <div class="jfila"><button class="boton boton--secundario boton--chico" type="button" data-descanso="largo">${F.icono('fuego')}Descanso largo</button>${c.pacto ? `<button class="boton boton--secundario boton--chico" type="button" data-descanso="corto">Descanso corto</button>` : ''}</div>
      </section>` : ''}
      ${(c.trucos || []).length ? `<section class="jbloque"><h2 class="jsub">Trucos</h2><div class="rasgos">${c.trucos.map(n => item(n, 'Truco')).join('')}</div></section>` : ''}
      ${Object.keys(porNivel).sort().map(l => `<section class="jbloque"><h2 class="jsub">Nivel ${e(l)}</h2><div class="rasgos">${porNivel[l].map(n => item(n, 'Nv ' + l)).join('')}</div></section>`).join('')}`;
  }

  /* ---------- Mochila ---------- */
  const pendientes = () => (est.peticiones || []).filter(x => x.estado === 'pendiente');
  function vistaMochila(p) {
    const inv = p.inv || [], pend = pendientes();
    const recientes = (est.peticiones || []).filter(x => x.estado !== 'pendiente' && Date.now() - (x.resuelta || 0) < 15 * 60 * 1000).slice(-3);
    const enEspera = new Set(pend.map(x => x.objeto));
    return `
      ${pend.length || recientes.length ? `<section class="jbloque jpets">
        ${pend.map(x => `<p class="jpet"><span>${F.icono('movil')}</span><span><b>${e(x.texto)}</b><small>Esperando al DM</small></span><button class="boton boton--fantasma boton--chico" type="button" data-cancelar="${e(x.id)}">Cancelar</button></p>`).join('')}
        ${recientes.map(x => `<p class="jpet jpet--${e(x.estado)}"><span>${F.icono(x.estado === 'aprobada' ? 'hecho' : 'cerrar')}</span><span><b>${e(x.texto)}</b><small>${x.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}${x.motivo ? ' · ' + e(x.motivo) : ''} · ${e(F.hace(x.resuelta))}</small></span></p>`).join('')}
      </section>` : ''}
      ${LUGARES.map(([k, t, ayuda]) => { const l = inv.filter(x => (x.lugar || 'mochila') === k); return `
        <section class="jbloque jzona"><h2 class="jsub">${t} <i>${l.reduce((n, x) => n + (x.cant || 1), 0)}</i></h2>
          ${l.length ? `<div class="jinv">${l.map(x => `<button class="ob ob--${e(x.tipo)}${enEspera.has(x.id) ? ' is-espera' : ''}" type="button" data-objeto="${e(x.id)}"><span class="ob__ico">${F.icono(x.tipo in TIPOS ? x.tipo : 'objeto')}${x.cant > 1 ? `<i>${e(x.cant)}</i>` : ''}</span><b>${e(x.n)}</b></button>`).join('')}</div>` : `<p class="jnota">${ayuda}</p>`}
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
      m.innerHTML = est.pj ? (simular ? `<b>Modo prueba.</b> Actúas como el jugador: lo que pidas llega a tu mesa para aprobarlo. <a href="${e(otra.pathname.split('/').pop() + otra.search)}">Salir de la prueba</a>`
        : `<b>Vista del DM.</b> Tus cambios se aplican sin pedir permiso. <a href="${e(otra.pathname.split('/').pop() + otra.search)}">Probar como jugador</a>`) : '<b>Vista del DM.</b>';
    }
    const p = est.pj;
    if (!p) return pintarEleccion();
    document.title = p.nombre + ' · The Field Forge';
    const y = scrollY;
    main.innerHTML = cabecera(p) + `<div class="jvista">${({ ficha: vistaFicha, conjuros: vistaConjuros, mochila: vistaMochila })[tab](p)}</div>`;
    main.querySelectorAll('[data-f]').forEach(i => { i.style.width = i.dataset.f + '%'; });
    tabs.hidden = false;
    const n = pendientes().length;
    tabs.innerHTML = TABS.map(([k, t, ic]) => `<button type="button" aria-pressed="${k === tab}" data-tab="${k}">${F.icono(ic)}<span>${t}</span>${k === 'mochila' && n ? `<i>${n}</i>` : ''}</button>`).join('');
    scrollTo(0, y);
    if (dlgOb.open) { const ob = (p.inv || []).find(x => x.id === dlgOb.dataset.id); if (ob) pintarObjeto(ob); else dlgOb.close(); }
  }

  /* ---------- Vida: se nota al instante y se envía cuando dejas de tocar ---------- */
  function cambiarPg(n) {
    const p = est.pj; if (!p.pgMax) return;
    pgLocal = p.pg = Math.min(p.pgMax, Math.max(0, (p.pg ?? p.pgMax) + n));
    pintar();
    clearTimeout(pgReloj);
    pgReloj = setTimeout(async () => { const valor = pgLocal; await F.api(ruta, { metodo: 'POST', datos: cuerpo({ accion: 'pg', valor }) }).catch(err => F.toast(err.message)); if (pgLocal === valor) pgLocal = null; }, 500);
  }

  /* ---------- Objeto ---------- */
  const dlgOb = F.dialogo($('#objeto-dlg'));
  function pintarObjeto(ob) {
    dlgOb.dataset.id = ob.id;
    const espera = pendientes().find(x => x.objeto === ob.id);
    const pide = directo() ? '' : ' <small>pide permiso</small>';
    $('[data-ob-cab]').innerHTML = `<span class="ob__ico ob--${e(ob.tipo)}">${F.icono(ob.tipo in TIPOS ? ob.tipo : 'objeto')}</span><div><h2 id="ob-nombre">${e(ob.n)}</h2><p class="suave">${e(TIPOS[ob.tipo] || 'Objeto')}${ob.cant > 1 ? ' · ' + e(ob.cant) + ' unidades' : ''}</p></div>`;
    $('[data-ob-cuerpo]').innerHTML = `
      ${ob.nota ? `<p class="ob-nota">${e(ob.nota)}</p>` : ''}
      <div class="campo"><span class="etq">Dónde lo llevas</span><div class="tipos" role="group">${LUGARES.map(([k, t]) => `<button type="button" aria-pressed="${(ob.lugar || 'mochila') === k}" data-mover="${k}">${t}</button>`).join('')}</div></div>
      ${espera ? `<p class="jpet"><span>${F.icono('movil')}</span><span><b>${e(espera.texto)}</b><small>Esperando al DM</small></span></p>` : `
      <div class="ob-acc">
        ${SE_USA.includes(ob.tipo) ? `<button class="boton boton--primario" type="button" data-ob-usar>${F.icono(ob.tipo)}<span>Usar${pide}</span></button>` : ''}
        ${est.companeros.length ? `<div class="ob-dar"><select class="entrada" data-ob-a aria-label="A quién se lo das">${est.companeros.map(c => `<option value="${e(c.id)}">${e(c.nombre)}</option>`).join('')}</select><button class="boton boton--secundario" type="button" data-ob-dar>${F.icono('dar')}<span>Dar${pide}</span></button></div>` : ''}
        ${ob.cant > 1 ? `<label class="campo ob-cant"><span class="etq">Cuántos (para dar o soltar)</span><input class="entrada" type="number" inputmode="numeric" min="1" max="${e(ob.cant)}" value="1" data-ob-cant></label>` : ''}
        <button class="boton boton--fantasma" type="button" data-ob-tirar>${F.icono('borrar')}<span>Soltar${pide}</span></button>
      </div>`}`;
  }
  dlgOb.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const objeto = dlgOb.dataset.id, cant = (dlgOb.querySelector('[data-ob-cant]') || {}).value || 1;
    const aviso = directo() ? 'Hecho' : 'Enviado al DM';
    if (b.dataset.mover) return hacer({ accion: 'mover', objeto, lugar: b.dataset.mover });
    if ('obUsar' in b.dataset) { dlgOb.close(); return hacer({ accion: 'pedir', tipo: 'usar', objeto }, aviso); }
    if ('obDar' in b.dataset) { const a = dlgOb.querySelector('[data-ob-a]').value; dlgOb.close(); return hacer({ accion: 'pedir', tipo: 'dar', objeto, a, cant }, aviso); }
    if ('obTirar' in b.dataset) { dlgOb.close(); return hacer({ accion: 'pedir', tipo: 'tirar', objeto, cant }, aviso); }
  });

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
    if (d.tab) { tab = d.tab; const u = new URL(location.href); u.searchParams.set('ver', tab); history.replaceState(null, '', u); pintar(); scrollTo(0, 0); F.entrar(main.querySelectorAll('.jvista > *'), { y: 10, stagger: .03 }); }
    else if (d.pgMas) cambiarPg(Number(d.pgMas));
    else if (d.esp) { const [nivel, usados] = d.esp.split(':'); est.pj.usados = { ...(est.pj.usados || {}), [nivel]: Number(usados) }; pintar(); hacer({ accion: 'espacio', nivel, usados }); }
    else if (d.descanso) { if (confirm(d.descanso === 'largo' ? '¿Descanso largo? Recuperas todos los espacios de conjuro y la vida.' : '¿Descanso corto? Recuperas los espacios de conjuro.')) hacer({ accion: 'descanso', largo: d.descanso === 'largo' }, 'Descansado'); }
    else if (d.objeto) { const ob = est.pj.inv.find(x => x.id === d.objeto); if (ob) { pintarObjeto(ob); dlgOb.showModal(); } }
    else if ('pedir' in d) { formPd.reset(); tipoPd = 'objeto'; pintarTipos(); formPd.querySelector('.aviso').textContent = ''; $('[data-pd-nota]').textContent = directo() ? 'Como DM, se añade al momento.' : 'Tu DM lo verá en su mesa y decidirá si entra en tu inventario.'; $('[data-pd-enviar]').textContent = directo() ? 'Añadir' : 'Pedir al DM'; dlgPd.showModal(); }
    else if (d.cancelar) hacer({ accion: 'cancelar', peticion: d.cancelar });
    else if (d.acento) { document.body.dataset.acento = d.acento; poner('forja.acento', d.acento); pintar(); }
    else if (d.elegir) hacer({ accion: 'elegir', pj: d.elegir });
    else if (d.traer) hacer({ accion: 'traer', personaje: d.traer });
    else if ('soltar' in d) { if (confirm('¿Dejar este personaje? Podrás elegir otro; este se queda en la campaña.')) hacer({ accion: 'soltar' }); }
    else if (d.abrir) { const u = new URL(location.href); u.searchParams.set('pj', d.abrir); location.href = u; }
  });

  /* ---------- En vivo ---------- */
  let relojVivo = 0;
  const refrescar = () => { clearTimeout(relojVivo); relojVivo = setTimeout(cargar, 150); };
  F.enVivo(id, d => { if (d.reconectado || d.pj || d.parches) refrescar(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });

  await cargar();
  F.entrar(main.querySelectorAll('.jhero, .jvista > *, .jpick'), { y: 12, stagger: .04 });
})();
