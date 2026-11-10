/* Balance de encuentros con las reglas de la Guía del Dungeon Master (5e):
   umbrales de PX por nivel, multiplicador por número de enemigos y ajuste por tamaño del grupo.
   Añade avisos prácticos para la mesa (golpes que tumban de un solo impacto, oleadas…). */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const ESCALA = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
  const NIVELES = [
    { k: 'trivial', label: 'Trivial' }, { k: 'facil', label: 'Fácil' }, { k: 'medio', label: 'Medio' },
    { k: 'dificil', label: 'Difícil' }, { k: 'mortal', label: 'Mortal' }
  ];

  const xpDe = f => f.xp || TFF.reglas.XP_VD[f.vd] || 0;
  function multiplicador(n, grupo) {
    if (!n) return 1;
    let i = n === 1 ? 1 : n === 2 ? 2 : n <= 6 ? 3 : n <= 10 ? 4 : n <= 14 ? 5 : 6;
    if (grupo < 3) i += 1; else if (grupo >= 6) i -= 1;
    return ESCALA[Math.max(0, Math.min(ESCALA.length - 1, i))];
  }
  function umbrales(pjs) {
    const U = TFF.reglas.UMBRALES;
    return pjs.reduce((acc, f) => { const u = U[Math.max(1, Math.min(20, f.nivel || 1))]; return acc.map((v, i) => v + u[i]); }, [0, 0, 0, 0]);
  }
  function nivelDe(xp, u) {
    if (xp < u[0]) return 0; if (xp < u[1]) return 1; if (xp < u[2]) return 2; if (xp < u[3]) return 3; return 4;
  }
  function ajustado(enemigos, grupo) {
    const base = enemigos.reduce((s, f) => s + xpDe(f), 0);
    const m = multiplicador(enemigos.length, grupo);
    return { base, m, aj: Math.round(base * m) };
  }
  // "2d6+3" → { max, media }
  function dano(d) {
    const m = String(d || '').replace('−', '-').match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/);
    if (!m) { const n = parseInt(d, 10); return isNaN(n) ? { max: 0, media: 0 } : { max: n, media: n }; }
    const [, n, c, k] = m; const bonus = k ? parseInt(k.replace(/\s/g, ''), 10) : 0;
    return { max: +n * +c + bonus, media: +n * (+c + 1) / 2 + bonus, critMax: 2 * +n * +c + bonus };
  }

  function calcular(pjs, enemigos) {
    const u = umbrales(pjs);
    const { base, m, aj } = ajustado(enemigos, pjs.length);
    const nv = pjs.length && enemigos.length ? nivelDe(aj, u) : -1;
    const tips = [];
    if (!pjs.length) tips.push('Marca qué PJ participan (botón “Encuentro” en su tarjeta).');
    if (!enemigos.length) tips.push('Añade enemigos con el botón “Encuentro” o desde el Bestiario.');
    if (pjs.length && enemigos.length) {
      if (pjs.length < 3) tips.push(`Grupo de ${pjs.length}: cada enemigo pesa más de lo normal (multiplicador ×${m}).`);
      // Ajuste hacia Medio.
      if (nv >= 3) {
        const resto = [...enemigos].sort((a, b) => xpDe(b) - xpDe(a));
        const quitados = [];
        while (resto.length > 1 && ajustado(resto, pjs.length).aj >= u[2]) quitados.push(resto.shift());
        if (quitados.length) {
          const cuenta = {}; quitados.forEach(f => { const n = f.base ? f.nombre.replace(/\s\d+$/, '') : f.nombre; cuenta[n] = (cuenta[n] || 0) + 1; });
          const nuevo = nivelDe(ajustado(resto, pjs.length).aj, u);
          tips.push(`Para dejarlo en ${NIVELES[nuevo].label.toLowerCase()}: quita ${Object.entries(cuenta).map(([n, c]) => `${c} × ${n}`).join(' y ')}.`);
        } else tips.push('Un solo enemigo ya lo hace muy duro: baja sus PG a la mitad o úsalo como amenaza que huye.');
      }
      if (nv >= 0 && nv <= 1) {
        const ref = [...enemigos].sort((a, b) => xpDe(a) - xpDe(b))[0];
        const extra = []; let k = 0;
        while (k < 8 && ajustado(enemigos.concat(extra), pjs.length).aj < u[1]) { extra.push(ref); k++; }
        if (k && k < 8) tips.push(`Para que sea medio: añade ${k} × ${ref.base ? ref.nombre.replace(/\s\d+$/, '') : ref.nombre}.`);
      }
      // Golpes que tumban de un solo impacto.
      const vivos = pjs.filter(f => f.pg > 0);
      const fragil = vivos.sort((a, b) => a.pg - b.pg)[0];
      if (fragil) {
        let peor = null;
        enemigos.forEach(e => (e.ataques || []).forEach(a => { const d = dano(a.d); if (!peor || d.max > peor.max) peor = Object.assign({ e, a }, d); }));
        if (peor && peor.max >= fragil.pg) tips.push(`${peor.a.n} de ${peor.e.nombre.replace(/\s\d+$/, '')} (hasta ${peor.max} de daño) puede tumbar a ${fragil.nombre} (${fragil.pg} PG) de un golpe.`);
        else if (peor && peor.critMax >= fragil.pg) tips.push(`Un crítico de ${peor.e.nombre.replace(/\s\d+$/, '')} (hasta ${peor.critMax}) tumbaría a ${fragil.nombre} (${fragil.pg} PG).`);
      }
      // Rondas que aguanta el grupo (acertando ~60 %).
      const dpr = enemigos.reduce((s, e) => s + Math.max(0, ...(e.ataques || []).map(a => dano(a.d).media)) * .6, 0);
      const vida = pjs.reduce((s, f) => s + Math.max(0, f.pg), 0);
      if (dpr > 0) tips.push(`Daño esperado de los enemigos: ~${Math.round(dpr)} por ronda. El grupo (${vida} PG) aguanta unas ${Math.max(1, Math.round(vida / dpr))} rondas.`);
      if (enemigos.length >= pjs.length * 3) tips.push('Muchos enemigos para tan pocos PJ: haz que lleguen en oleadas o que algunos huyan al caer el primero.');
    }
    return { umbrales: u, base, m, aj, nivel: nv, etiqueta: nv >= 0 ? NIVELES[nv] : null, tips, NIVELES };
  }

  TFF.encuentro = { calcular, multiplicador, dano, xpDe };
})();
