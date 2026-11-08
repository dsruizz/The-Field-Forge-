/* Mis personajes y creador guiado (reglas del SRD 5.1). */
(async () => {
  const F = window.Forja;
  const TFF = window.TFF;
  const R = TFF.reglas;
  const e = F.esc;
  const usuario = await F.exigirSesion();
  if (!usuario) return;
  F.montarBarra(usuario);
  const main = document.querySelector('[data-contenido]');

  // Solo las especies del SRD 5.1: el resto no se puede distribuir con licencia abierta.
  const ESPECIES_SRD = ['humano', 'elfo', 'enano', 'mediano', 'draconido', 'gnomo', 'semielfo', 'semiorco', 'tiefling'];
  const RAZAS = R.RAZAS.filter(r => ESPECIES_SRD.includes(r.id));
  const ESTANDAR = [15, 14, 13, 12, 10, 8];
  const ROL_CLASE = {
    barbaro: 'Furia y aguante en primera línea.', bardo: 'Magia, música y palabras que cambian la escena.', brujo: 'Poder prestado por un patrón, con un precio.',
    clerigo: 'Fe que cura, protege y castiga.', druida: 'La naturaleza como arma y como refugio.', explorador: 'Rastreo, arco y supervivencia lejos de la ciudad.',
    guerrero: 'Dominio de las armas y la armadura.', hechicero: 'Magia innata que sale de la sangre.', mago: 'Estudio, grimorio y el repertorio de conjuros más amplio.',
    monje: 'Disciplina, velocidad y golpes sin armas.', paladin: 'Un juramento que se convierte en luz y acero.', picaro: 'Sigilo, trampas y el golpe exacto.'
  };
  const mod = v => Math.floor((v - 10) / 2);
  const signo = n => (n >= 0 ? '+' : '−') + Math.abs(n);

  let mios = [];
  const dlgVer = F.dialogo(document.getElementById('ver'));

  /* =========================================================
     Lista
     ========================================================= */
  async function lista() {
    history.replaceState(null, '', 'personajes.html');
    try { mios = (await F.api('personajes')).personajes; }
    catch (err) { main.innerHTML = `<p class="aviso">${e(err.message)}</p>`; return; }
    main.innerHTML = `
      <div class="cabecera">
        <div><h1>Mis personajes</h1><p>Crea tus héroes con las reglas oficiales y llévalos a la mesa.</p></div>
        ${mios.length ? `<div class="cabecera__acciones"><button class="boton boton--primario" type="button" data-crear>${F.icono('mas')}Crear personaje</button></div>` : ''}
      </div>
      ${mios.length ? `<div class="fichas">${mios.map(F.ficha.tarjeta).join('')}</div>` : `
        <div class="vacio">
          <h2>Tu primer héroe</h2>
          <p>Elige especie, clase y trasfondo; te mostramos sus rasgos y conjuros a cada nivel.</p>
          <div class="vacio__acciones"><button class="boton boton--primario boton--grande" type="button" data-crear>${F.icono('chispa')}Forjar personaje</button></div>
        </div>`}`;
    F.entrar(main.querySelectorAll('.pjc, .vacio, .cabecera'));
  }
  main.addEventListener('click', ev => {
    const t = ev.target.closest('[data-crear], [data-ficha]');
    if (!t) return;
    if ('crear' in t.dataset) return asistente();
    const f = mios.find(x => x.id === t.dataset.ficha);
    if (!f) return;
    dlgVer.querySelector('[data-cuerpo]').innerHTML = F.ficha.completa(f);
    dlgVer.querySelector('[data-pie]').innerHTML = `
      <button class="boton boton--fantasma boton--chico empuja" type="button" data-borrar="${e(f.id)}">${F.icono('borrar')}Borrar</button>
      <button class="boton boton--primario boton--chico" type="button" data-editar="${e(f.id)}">${F.icono('editar')}Editar</button>`;
    dlgVer.showModal();
  });
  dlgVer.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.editar) { const f = mios.find(x => x.id === t.dataset.editar); dlgVer.close(); asistente(f); }
    if (t.dataset.borrar && confirm('¿Borrar este personaje? No se puede deshacer.')) {
      try { await F.api('personajes/' + t.dataset.borrar, { metodo: 'DELETE', datos: {} }); dlgVer.close(); F.toast('Personaje borrado'); lista(); }
      catch (err) { F.toast(err.message); }
    }
  });

  /* =========================================================
     Creador guiado
     ========================================================= */
  const PASOS = [['especie', 'Especie'], ['clase', 'Clase'], ['trasfondo', 'Trasfondo'], ['atributos', 'Atributos'], ['detalles', 'Detalles'], ['listo', 'Listo']];

  function asistente(existente) {
    const s = existente && existente.crear ? structuredClone(existente.crear) : {
      raza: '', clase: '', trasfondo: '', nivel: 1, metodo: 'estandar',
      asign: { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }, tiradas: null,
      nombre: '', sexo: 'f', alineamiento: 'Neutral bueno', historia: '', img: '', pers: null
    };
    const idExistente = existente ? existente.id : null;
    let paso = existente ? 5 : 0;
    history.replaceState(null, '', 'personajes.html?crear=1');

    const raza = () => RAZAS.find(r => r.id === s.raza);
    const clase = () => R.CLASES.find(c => c.id === s.clase);
    const tras = () => R.TRASFONDOS.find(t => t.id === s.trasfondo);
    const valores = () => s.metodo === 'tirada' && s.tiradas ? s.tiradas : ESTANDAR;
    const repartoCompleto = () => R.ATR.every(k => s.asign[k]);

    // Atributos finales: reparto + bonificadores de especie (+1 libres a las principales de la clase).
    function base() {
      const r = raza(), c = clase();
      const b = {}; R.ATR.forEach(k => { b[k] = s.asign[k] || 8; });
      if (r) {
        Object.entries(r.asi || {}).forEach(([k, v]) => { b[k] += v; });
        if (r.asiLibre) (c ? c.prim : R.ATR).filter(k => !(r.asi || {})[k]).slice(0, r.asiLibre).forEach(k => { b[k] += 1; });
      }
      return b;
    }
    function ficha() {
      if (!s.raza || !s.clase || !s.trasfondo) return null;
      const f = TFF.npc.generar({ tipo: 'pj', raza: s.raza, clase: s.clase, trasfondo: s.trasfondo, nivel: s.nivel, nombre: s.nombre || 'Sin nombre', sexo: s.sexo, alineamiento: s.alineamiento });
      if (repartoCompleto()) { f.gen.base = base(); TFF.npc.recalcular(f, { nuevo: true }); }
      if (!s.pers) s.pers = f.pers;
      f.pers = { ...s.pers, pasado: s.historia || s.pers.pasado };
      f.img = s.img; f.rol = ''; f.actitud = 'Amistoso'; f.estado = 'activo'; f.enc = true;
      delete f.id;
      return f;
    }
    const puedeAvanzar = i => [() => s.raza, () => s.clase, () => s.trasfondo, repartoCompleto, () => s.nombre.trim(), () => true][i]();

    function pintar() {
      const actual = PASOS[paso][0];
      main.innerHTML = `
        <div class="cabecera">
          <div><a class="miga" href="personajes.html" data-salir-asistente>${F.icono('atras')}Mis personajes</a><h1>${idExistente ? 'Editar personaje' : 'Forjar personaje'}</h1></div>
        </div>
        <div class="pasos-barra" role="list">
          ${PASOS.map(([k, t], i) => `<button type="button" role="listitem" data-ir="${i}" ${i === paso ? 'aria-current="step"' : ''} class="${i < paso && puedeAvanzar(i) ? 'hecho' : ''}" ${i > paso && !PASOS.slice(0, i).every((_, j) => puedeAvanzar(j)) ? 'disabled' : ''}><i>${i + 1}</i>${t}</button>`).join('')}
        </div>
        <div class="asistente">
          <section class="paso-cuerpo" data-paso>${({ especie: pasoEspecie, clase: pasoClase, trasfondo: pasoTrasfondo, atributos: pasoAtributos, detalles: pasoDetalles, listo: pasoListo })[actual]()}
            <div class="navegacion-pasos">
              <button class="boton boton--secundario" type="button" data-atras ${paso === 0 ? 'disabled' : ''}>Atrás</button>
              ${paso < PASOS.length - 1
                ? `<button class="boton boton--primario" type="button" data-siguiente ${puedeAvanzar(paso) ? '' : 'disabled'}>Siguiente</button>`
                : `<button class="boton boton--primario boton--grande" type="button" data-guardar>${F.icono('chispa')}${idExistente ? 'Guardar cambios' : 'Guardar personaje'}</button>`}
            </div>
          </section>
          <aside class="resumen-lateral" aria-label="Tu personaje">${lateral()}</aside>
        </div>`;
      F.entrar(main.querySelectorAll('.opcion, .detalle-opcion, .reparto .atr'), { y: 10, stagger: .02, duration: .4 });
    }

    function lateral() {
      const f = ficha();
      const b = repartoCompleto() ? base() : null;
      return `
        <div class="ficha__cab">
          ${F.ficha.retrato({ nombre: s.nombre || '?', img: s.img }, 'ficha__retrato')}
          <div><div class="ficha__nombre">${e(s.nombre || 'Sin nombre')}</div><p class="ficha__sub">${e([raza() && raza().nombre, clase() && `${clase().nombre} ${s.nivel}`, tras() && tras().nombre].filter(Boolean).join(' · ') || 'Elige especie, clase y trasfondo')}</p></div>
        </div>
        ${b ? `<div class="atributos">${R.ATR.map(k => `<div class="atr"><span>${R.ATR_LABEL[k]}</span><b>${b[k]}</b><small>${signo(mod(b[k]))}</small></div>`).join('')}</div>` : ''}
        ${f && b ? `<div class="ficha__vitales"><div class="vital"><b>${f.ca}</b><span>CA</span></div><div class="vital"><b>${f.pgMax}</b><span>PG</span></div><div class="vital"><b>+${f.comp}</b><span>Comp.</span></div></div>` : ''}`;
    }

    /* ---- Pasos ---- */
    function pasoEspecie() {
      const r = raza();
      return `
        <h2>¿De qué pueblo viene?</h2>
        <p>La especie define rasgos y bonificadores a los atributos.</p>
        <div class="opciones">${RAZAS.map(x => `<button class="opcion" type="button" aria-pressed="${x.id === s.raza}" data-elegir="raza" data-valor="${x.id}"><b>${e(x.nombre)}</b><small>${e(Object.entries(x.asi || {}).map(([k, v]) => `${R.ATR_LABEL[k]} +${v}`).join(' · ') + (x.asiLibre ? ` · +1 a ${x.asiLibre} más` : ''))}</small></button>`).join('')}</div>
        ${r ? `<div class="detalle-opcion"><h3>${e(r.nombre)}</h3><ul>
          <li><b>Velocidad.</b> ${e(r.vel)} m</li><li><b>Idiomas.</b> ${e(r.idiomas || '')}</li>
          ${(r.rasgos || []).map(([n, d]) => `<li><b>${e(n)}.</b> ${e(d)}</li>`).join('')}
        </ul></div>` : ''}`;
    }
    function pasoClase() {
      const c = clase();
      const rasgos = c ? c.rasgos.filter(([l]) => l <= s.nivel).map(([l, n, d]) => [l, n, typeof d === 'function' ? d(s.nivel) : d]) : [];
      const f = c && s.raza && s.trasfondo ? ficha() : null;
      return `
        <h2>¿Cómo se enfrenta al mundo?</h2>
        <p>La clase marca su estilo de juego. Elige también el nivel con el que empieza la campaña.</p>
        <div class="opciones">${R.CLASES.map(x => `<button class="opcion" type="button" aria-pressed="${x.id === s.clase}" data-elegir="clase" data-valor="${x.id}"><b>${e(x.nombre)}</b><small>${e(ROL_CLASE[x.id] || '')}</small></button>`).join('')}</div>
        <div class="campo"><label for="cr-nivel">Nivel inicial</label><select class="entrada" id="cr-nivel" data-campo="nivel">${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}"${s.nivel === i + 1 ? ' selected' : ''}>Nivel ${i + 1}</option>`).join('')}</select><span class="ayuda">Pregunta a tu DM con qué nivel empieza el grupo.</span></div>
        ${c ? `<div class="detalle-opcion"><h3>${e(c.nombre)} · nivel ${s.nivel}</h3><ul>
          <li><b>Dado de golpe.</b> d${c.dg} · <b>Salvaciones.</b> ${c.salv.map(k => R.ATR_NOMBRE[k]).join(' y ')}</li>
          <li><b>Atributos clave.</b> ${c.prim.slice(0, 2).map(k => R.ATR_NOMBRE[k]).join(', ')}</li>
          ${c.sub ? `<li><b>Subclase del SRD.</b> ${e(c.sub)}</li>` : ''}
          ${rasgos.map(([l, n, d]) => `<li><b>${e(n)}</b> <span class="suave">(nivel ${l})</span>. ${e(d)}</li>`).join('')}
        </ul></div>
        ${f && f.conj && ((f.conj.trucos || []).length || (f.conj.lista || []).length) ? `<div class="detalle-opcion"><h3>Conjuros sugeridos a nivel ${s.nivel}</h3><p class="suave">Con el SRD; tu DM puede permitir otros de tu libro.</p><div class="habs">${(f.conj.trucos || []).map(n => `<span class="chip">${e(n)}</span>`).join('')}${(f.conj.lista || []).map(n => `<span class="chip chip--personaje">${e(n)}</span>`).join('')}</div></div>` : ''}` : ''}`;
    }
    function pasoTrasfondo() {
      const t = tras();
      return `
        <h2>¿Qué hacía antes de la aventura?</h2>
        <p>El trasfondo le da habilidades y un pasado del que tirar.</p>
        <div class="opciones">${R.TRASFONDOS.map(x => `<button class="opcion" type="button" aria-pressed="${x.id === s.trasfondo}" data-elegir="trasfondo" data-valor="${x.id}"><b>${e(x.nombre)}</b><small>${e(x.hab.join(' · '))}</small></button>`).join('')}</div>
        ${t ? `<div class="detalle-opcion"><h3>${e(t.nombre)}</h3><ul><li><b>Habilidades.</b> ${e(t.hab.join(' y '))}</li>${t.pasado.map(p => `<li>${e(p)}</li>`).join('')}</ul></div>` : ''}`;
    }
    function pasoAtributos() {
      const vals = valores();
      const b = base();
      const r = raza();
      return `
        <h2>Reparte sus atributos</h2>
        <p>Asigna cada valor a un atributo. ${r ? `Tu especie suma: ${e(Object.entries(r.asi || {}).map(([k, v]) => `${R.ATR_NOMBRE[k]} +${v}`).join(', '))}${r.asiLibre ? ` y +1 a ${r.asiLibre} atributos de tu clase` : ''}.` : ''}</p>
        <div class="segmento" role="group" aria-label="Método">
          <button type="button" aria-pressed="${s.metodo === 'estandar'}" data-metodo="estandar">Valores estándar</button>
          <button type="button" aria-pressed="${s.metodo === 'tirada'}" data-metodo="tirada">Tirar 4d6</button>
        </div>
        ${s.metodo === 'tirada' ? `<div class="herramientas"><button class="boton boton--secundario boton--chico" type="button" data-tirar>${F.icono('dado')}${s.tiradas ? 'Volver a tirar' : 'Tirar dados'}</button>${s.tiradas ? `<span class="suave">Resultados: <b>${s.tiradas.join(' · ')}</b></span>` : ''}</div>` : ''}
        ${s.metodo === 'estandar' || s.tiradas ? `
        <div class="reparto">${R.ATR.map(k => `
          <label class="atr">
            <span>${R.ATR_NOMBRE[k]}</span>
            <select class="entrada" data-asignar="${k}" aria-label="${R.ATR_NOMBRE[k]}">
              <option value="">—</option>
              ${[...new Set(vals)].sort((a, x) => x - a).map(v => { const disponibles = vals.filter(x => x === v).length - R.ATR.filter(a => a !== k && s.asign[a] === v).length; return `<option value="${v}"${s.asign[k] === v ? ' selected' : ''}${disponibles <= 0 && s.asign[k] !== v ? ' disabled' : ''}>${v}</option>`; }).join('')}
            </select>
            <small>${s.asign[k] ? `Total ${b[k]} · ${signo(mod(b[k]))}` : 'Sin asignar'}</small>
          </label>`).join('')}
        </div>
        <div class="herramientas"><button class="boton boton--fantasma boton--chico" type="button" data-sugerir>${F.icono('chispa')}Repartir según la clase</button></div>` : ''}`;
    }
    function pasoDetalles() {
      return `
        <h2>¿Quién es?</h2>
        <p>Nombre, cara y una historia corta para tu DM.</p>
        <div class="retrato-carga">
          ${F.ficha.retrato({ nombre: s.nombre || '?', img: s.img }, 'ficha__retrato')}
          <div class="campo"><label for="cr-img">Retrato</label><input class="entrada" id="cr-img" type="file" accept="image/*" data-imagen>${s.img ? '<button class="boton boton--fantasma boton--chico" type="button" data-quitar-img>Quitar imagen</button>' : ''}</div>
        </div>
        <div class="campo"><label for="cr-nombre">Nombre</label>
          <div class="herramientas"><input class="entrada" id="cr-nombre" data-campo="nombre" maxlength="80" value="${e(s.nombre)}" required><button class="boton boton--secundario boton--chico" type="button" data-nombre-azar>${F.icono('dado')}Sugerir</button></div>
        </div>
        <div class="fila">
          <div class="campo"><label for="cr-sexo">Para los nombres</label><select class="entrada" id="cr-sexo" data-campo="sexo"><option value="f"${s.sexo === 'f' ? ' selected' : ''}>Femeninos</option><option value="m"${s.sexo === 'm' ? ' selected' : ''}>Masculinos</option></select></div>
          <div class="campo"><label for="cr-ali">Alineamiento</label><select class="entrada" id="cr-ali" data-campo="alineamiento">${R.ALINEAMIENTOS.map(a => `<option${a === s.alineamiento ? ' selected' : ''}>${a}</option>`).join('')}</select></div>
        </div>
        <div class="campo"><label for="cr-hist">Historia</label><textarea class="entrada" id="cr-hist" data-campo="historia" maxlength="2000" placeholder="${e((s.pers && s.pers.pasado) || 'De dónde viene y qué busca.')}">${e(s.historia)}</textarea></div>`;
    }
    function pasoListo() {
      const f = ficha();
      return `<h2>Listo para la mesa</h2><p>Revisa la ficha. Puedes volver a cualquier paso.</p><div class="detalle-opcion">${f ? F.ficha.completa(f) : ''}</div>`;
    }

    /* ---- Interacción ---- */
    function nombreAzar() {
      const r = raza() || RAZAS[0];
      const n = r.nombres || {};
      const lista = n[s.sexo] || n.m || [];
      const ap = n.ap || [];
      return [TFF.dice.pick(lista), ap.length ? TFF.dice.pick(ap) : ''].filter(Boolean).join(' ');
    }
    function sugerirReparto() {
      const c = clase(); if (!c) return;
      const vals = valores().slice().sort((a, b) => b - a);
      s.asign = {}; c.prim.forEach((k, i) => { s.asign[k] = vals[i]; });
    }

    main.onclick = async ev => {
      const t = ev.target.closest('button, a[data-salir-asistente]');
      if (!t) return;
      const d = t.dataset;
      if ('salirAsistente' in d) { ev.preventDefault(); main.onclick = null; main.oninput = null; main.onchange = null; return lista(); }
      if (d.ir !== undefined) { paso = Number(d.ir); return pintar(); }
      if ('atras' in d) { paso = Math.max(0, paso - 1); return pintar(); }
      if ('siguiente' in d) { paso = Math.min(PASOS.length - 1, paso + 1); window.scrollTo({ top: 0, behavior: F.reducido() ? 'auto' : 'smooth' }); return pintar(); }
      if (d.elegir) {
        s[d.elegir] = d.valor;
        if (d.elegir !== 'trasfondo') s.pers = null;
        if (d.elegir === 'clase' && R.ATR.every(k => !s.asign[k])) sugerirReparto();
        return pintar();
      }
      if (d.metodo) { s.metodo = d.metodo; s.asign = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }; if (d.metodo === 'estandar') sugerirReparto(); return pintar(); }
      if ('tirar' in d) {
        s.tiradas = Array.from({ length: 6 }, () => { const r = [1, 2, 3, 4].map(() => TFF.dice.roll(1, 6)).sort((a, b) => a - b); return r[1] + r[2] + r[3]; }).sort((a, b) => b - a);
        s.asign = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }; sugerirReparto();
        pintar();
        if (window.gsap && !F.reducido()) window.gsap.from('.reparto .atr b, .reparto select', { rotate: -12, scale: .6, opacity: 0, duration: .5, stagger: .05, ease: 'back.out(2)', clearProps: 'all' });
        return;
      }
      if ('sugerir' in d) { sugerirReparto(); return pintar(); }
      if ('nombreAzar' in d) { s.nombre = nombreAzar(); return pintar(); }
      if ('quitarImg' in d) { s.img = ''; return pintar(); }
      if ('guardar' in d) {
        const f = ficha();
        if (!f) return;
        f.crear = s;
        F.ocupado(t, true, 'Guardando…');
        try {
          if (idExistente) await F.api('personajes/' + idExistente, { metodo: 'PUT', datos: { personaje: f } });
          else await F.api('personajes', { metodo: 'POST', datos: { personaje: f } });
          main.onclick = null; main.oninput = null; main.onchange = null;
          F.toast(idExistente ? 'Cambios guardados' : `${f.nombre} está listo para la aventura`);
          lista();
        } catch (err) { F.toast(err.message); F.ocupado(t, false); }
      }
    };
    main.onchange = async ev => {
      const t = ev.target;
      if (t.dataset.asignar) { s.asign[t.dataset.asignar] = Number(t.value) || 0; return pintar(); }
      if ('imagen' in t.dataset && t.files[0]) {
        try { s.img = await F.reducirImagen(t.files[0], 384); pintar(); } catch (err) { F.toast(err.message); }
        return;
      }
      if (t.dataset.campo === 'nivel') { s.nivel = Number(t.value); return pintar(); }
      if (t.dataset.campo === 'sexo' || t.dataset.campo === 'alineamiento') { s[t.dataset.campo] = t.value; main.querySelector('.resumen-lateral').innerHTML = lateral(); }
    };
    main.oninput = ev => {
      const t = ev.target;
      if (t.dataset.campo === 'nombre' || t.dataset.campo === 'historia') {
        s[t.dataset.campo] = t.value;
        main.querySelector('.resumen-lateral').innerHTML = lateral();
        const sig = main.querySelector('[data-siguiente]'); if (sig) sig.disabled = !puedeAvanzar(paso);
      }
    };
    pintar();
  }

  if (new URLSearchParams(location.search).get('crear')) asistente(); else lista();
})();
