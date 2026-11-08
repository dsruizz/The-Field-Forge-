/* Ficha de personaje: tarjeta compacta y ficha completa. Funciona con fichas completas (PJ, NPC
   generados) y con fichas reducidas (lo que ve un jugador de un NPC). */
(() => {
  const F = window.Forja;
  const ATR = ['fue', 'des', 'con', 'int', 'sab', 'car'];
  const ATR_LABEL = { fue: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };
  const mod = v => Math.floor((v - 10) / 2);
  const signo = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const e = F.esc;
  const TIPO = { pj: 'PJ', npc: 'NPC', enemigo: 'Enemigo' };

  const retrato = (f, clase) => `<div class="${clase}">${f.img ? `<img src="${e(f.img)}" alt="" loading="lazy">` : e((f.nombre || '?').trim().charAt(0).toUpperCase())}</div>`;
  const estadoChip = f => f.estado && f.estado !== 'activo' ? `<span class="chip chip--${e(f.estado)}">${e(f.estado.charAt(0).toUpperCase() + f.estado.slice(1))}</span>` : '';
  const linea = f => [f.raza, f.clase && `${f.clase}${f.nivel ? ' ' + f.nivel : ''}`].filter(Boolean).join(' · ');

  function tarjeta(f) {
    return `
      <button class="pjc" type="button" data-ficha="${e(f.id)}">
        ${retrato(f, 'pjc__retrato')}
        <div>
          <div class="pjc__nombre">${e(f.nombre)}</div>
          <div class="pjc__sub">${e(f.rol || linea(f) || '')}</div>
          <div class="pjc__chips"><span class="chip">${TIPO[f.tipo] || 'NPC'}</span>${f.tipo === 'pj' && f.nivel ? `<span class="chip">Nivel ${e(f.nivel)}</span>` : ''}${estadoChip(f)}</div>
        </div>
      </button>`;
  }

  function completa(f) {
    const R = window.TFF && window.TFF.reglas;
    const tieneStats = f.atr && f.ca !== undefined;
    const salv = new Set(f.salv || []);
    const habilidades = Object.entries(f.hab || {}).filter(([, v]) => v).map(([n, v]) => {
      const atr = R && R.HABILIDADES[n];
      const total = atr && f.atr ? mod(f.atr[atr]) + (f.comp || 2) * v : null;
      return `<span class="chip">${e(n)}${total !== null ? ' ' + signo(total) : ''}</span>`;
    }).join('');
    const c = f.conj;
    const conjuro = n => (R && R.CONJURO[n]) || { n, d: '' };
    const pers = f.pers || {};
    const persFilas = [['pasado', 'Pasado'], ['rasgo', 'Rasgo'], ['ideal', 'Ideal'], ['vinculo', 'Vínculo'], ['defecto', 'Defecto'], ['peculiaridad', 'Peculiaridad'], ['gancho', 'Gancho']]
      .filter(([k]) => pers[k]).map(([k, t]) => `<p><b>${t}.</b> ${e(pers[k])}</p>`).join('');

    return `
      <article class="ficha">
        <header class="ficha__cab">
          ${retrato(f, 'ficha__retrato')}
          <div>
            <h2 class="ficha__nombre">${e(f.nombre)}</h2>
            <p class="ficha__sub">${e([linea(f), f.trasfondo, f.alineamiento].filter(Boolean).join(' · ') || f.rol || '')}</p>
            <div class="pjc__chips"><span class="chip">${TIPO[f.tipo] || 'NPC'}</span>${f.actitud ? `<span class="chip">${e(f.actitud)}</span>` : ''}${estadoChip(f)}</div>
            ${f.rol && linea(f) ? `<p class="ficha__sub">${e(f.rol)}</p>` : ''}
          </div>
        </header>
        ${tieneStats ? `
        <div class="ficha__vitales">
          <div class="vital"><b>${e(f.ca)}</b><span>CA</span></div>
          <div class="vital"><b>${e(f.pg ?? f.pgMax)}<small class="suave">/${e(f.pgMax)}</small></b><span>PG</span></div>
          <div class="vital"><b>${e(String(f.vel || '').replace(' m', ''))}<small class="suave"> m</small></b><span>Velocidad</span></div>
          <div class="vital"><b>${signo(f.iniciativa ?? mod(f.atr.des))}</b><span>Iniciativa</span></div>
          <div class="vital"><b>+${e(f.comp || 2)}</b><span>Competencia</span></div>
        </div>
        <div class="atributos">
          ${ATR.map(k => `<div class="atr${salv.has(k) ? ' atr--salv' : ''}" title="${salv.has(k) ? 'Competente en salvación' : ''}"><span>${ATR_LABEL[k]}</span><b>${e(f.atr[k])}</b><small>${signo(mod(f.atr[k]))}</small></div>`).join('')}
        </div>` : ''}
        ${habilidades ? `<section class="ficha__bloque"><h3>Habilidades</h3><div class="habs">${habilidades}</div></section>` : ''}
        ${(f.ataques || []).length ? `
        <section class="ficha__bloque"><h3>Ataques</h3><div class="lista-ataques">
          ${f.ataques.map(a => `<div class="ataque"><div><b>${e(a.n)}</b><small>${e([a.t, a.r, a.nota].filter(Boolean).join(' · '))}</small></div><span class="ataque__num">${a.b !== undefined && a.b !== '' ? signo(a.b) : ''}</span><span class="ataque__num">${e(a.d || '')}</span></div>`).join('')}
        </div></section>` : ''}
        ${c && ((c.trucos || []).length || (c.lista || []).length) ? `
        <section class="ficha__bloque"><h3>Conjuros · CD ${e(c.cd)} · ataque ${signo(c.atk || 0)}</h3>
          ${Object.keys(c.espacios || {}).length ? `<div class="espacios">${Object.entries(c.espacios).map(([n, k]) => `<span class="chip">Nivel ${e(n)} · ${e(k)} ${k === 1 ? 'espacio' : 'espacios'}</span>`).join('')}${c.pacto ? '<span class="chip">Se recuperan en descanso corto</span>' : ''}</div>` : ''}
          <div class="rasgos">
            ${(c.trucos || []).map(n => { const x = conjuro(n); return `<details><summary><span class="chip">Truco</span>${e(n)}</summary><p>${e(x.d)}</p></details>`; }).join('')}
            ${(c.lista || []).map(n => { const x = conjuro(n); return `<details><summary><span class="chip">Nv ${e(x.l ?? '?')}</span>${e(n)}</summary><p>${e(x.d)}</p></details>`; }).join('')}
          </div>
        </section>` : ''}
        ${(f.rasgos || []).length ? `
        <section class="ficha__bloque"><h3>Rasgos</h3><div class="rasgos">
          ${f.rasgos.map(r => `<details><summary>${e(r.n)}</summary><p>${e(r.d)}</p></details>`).join('')}
        </div></section>` : ''}
        ${persFilas ? `<section class="ficha__bloque"><h3>Personalidad</h3><div class="pers">${persFilas}</div></section>` : ''}
        ${f.idiomas || f.sentidos ? `<section class="ficha__bloque"><h3>Sentidos e idiomas</h3><p class="suave">${e([f.sentidos, f.idiomas].filter(Boolean).join(' · '))}</p></section>` : ''}
        ${f.notas ? `<section class="ficha__bloque"><h3>Notas del DM</h3><p>${e(f.notas)}</p></section>` : ''}
      </article>`;
  }

  F.ficha = { tarjeta, completa, retrato, linea };
})();
