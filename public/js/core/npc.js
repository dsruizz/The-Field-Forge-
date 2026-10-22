/* The Field Forge — motor de la Forja de NPC.
   generar() crea una ficha nueva a partir de raza, clase, nivel y trasfondo.
   recalcular() deriva atributos, PG, CA, ataques, rasgos y conjuros del nivel actual,
   de modo que subir o bajar de nivel a un NPC es un solo cambio. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const R = () => TFF.reglas;
  const D = () => TFF.dice;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const signo = n => (n ? (n > 0 ? '+' : '−') + Math.abs(n) : '');

  // Daño de los trucos que atacan (para mostrarlos como ataques).
  const TRUCOS_DANO = {
    'Descarga sobrenatural': { dado: 10, t: 'fuerza', atk: true, rayos: true },
    'Rayo de fuego': { dado: 10, t: 'fuego', atk: true },
    'Rayo de escarcha': { dado: 8, t: 'frío', atk: true },
    'Toque helado': { dado: 8, t: 'necrótico', atk: true },
    'Agarre electrizante': { dado: 8, t: 'relámpago', atk: true },
    'Producir llama': { dado: 8, t: 'fuego', atk: true },
    'Salpicadura ácida': { dado: 6, t: 'ácido', salv: 'Des' },
    'Rociada venenosa': { dado: 12, t: 'veneno', salv: 'Con' },
    'Llama sagrada': { dado: 8, t: 'radiante', salv: 'Des' },
    'Burla dañina': { dado: 4, t: 'psíquico', salv: 'Sab' }
  };

  function nombreDe(raza, sexo) {
    const n = raza.nombres; const d = D();
    const nom = d.pick(n[sexo] || n.m);
    const ap = d.pick(n.ap || ['']);
    return ap ? nom + ' ' + ap : nom;
  }

  // Matriz estándar (15, 14, 13, 12, 10, 8) según prioridades de la clase, con algo de azar al final.
  function asignarAtributos(clase, raza) {
    const d = D();
    const orden = [...clase.prim];
    const cola = d.shuffle(orden.slice(3));
    const prioridad = orden.slice(0, 3).concat(cola);
    const base = {};
    [15, 14, 13, 12, 10, 8].forEach((v, i) => { base[prioridad[i]] = v; });
    Object.entries(raza.asi || {}).forEach(([k, v]) => { base[k] += v; });
    if (raza.asiLibre) prioridad.filter(k => !(raza.asi || {})[k]).slice(0, raza.asiLibre).forEach(k => { base[k] += 1; });
    return base;
  }

  function generar(o = {}) {
    const r = R(), d = D();
    const raza = r.RAZAS.find(x => x.id === o.raza) || d.pick(r.RAZAS);
    const clase = r.CLASES.find(x => x.id === o.clase) || d.pick(r.CLASES);
    const tras = r.TRASFONDOS.find(x => x.id === o.trasfondo) || d.pick(r.TRASFONDOS);
    const nivel = clamp(parseInt(o.nivel, 10) || 1 + Math.floor(Math.random() * 5), 1, 20);
    const sexo = o.sexo && o.sexo !== 'azar' ? o.sexo : d.pick(['m', 'f']);
    const ideal = d.pick(r.PERS.ideal);
    const alineamiento = o.alineamiento && o.alineamiento !== 'azar' ? o.alineamiento : d.pick(r.ALINEAMIENTOS);
    const f = {
      id: TFF.store.uid('f'),
      tipo: o.tipo || 'npc',
      nombre: (o.nombre || '').trim() || nombreDe(raza, sexo),
      img: '',
      rol: o.rol || '',
      actitud: o.actitud && o.actitud !== 'azar' ? o.actitud : d.pick(r.PERS.actitud),
      estado: 'activo',
      raza: raza.nombre, clase: clase.nombre, subclase: '', nivel,
      trasfondo: tras.nombre, alineamiento,
      pers: {
        pasado: d.pick(tras.pasado),
        rasgo: d.pick(r.PERS.rasgo),
        ideal: ideal[0] + ' (' + ideal[1].toLowerCase() + ')',
        vinculo: d.pick(r.PERS.vinculo),
        defecto: d.pick(r.PERS.defecto),
        peculiaridad: d.pick(r.PERS.peculiaridad),
        gancho: d.pick(r.PERS.gancho)
      },
      notas: '',
      hab: {},
      gen: { raza: raza.id, clase: clase.id, trasfondo: tras.id, sexo, base: asignarAtributos(clase, raza) }
    };
    return recalcular(f, { nuevo: true });
  }

  function recalcular(f, { nuevo = false } = {}) {
    const g = f.gen; if (!g) return f;
    const r = R(), d = D();
    const raza = r.RAZAS.find(x => x.id === g.raza) || r.RAZAS[0];
    const clase = r.CLASES.find(x => x.id === g.clase) || r.CLASES[0];
    const tras = r.TRASFONDOS.find(x => x.id === g.trasfondo);
    const L = f.nivel = clamp(parseInt(f.nivel, 10) || 1, 1, 20);
    const prevAtaques = f.ataques || [], prevRasgos = f.rasgos || [];

    // Atributos con mejoras de característica (+2 a la principal; si topa en 20, a la siguiente).
    const a = Object.assign({}, g.base);
    const mejoras = [4, 8, 12, 16, 19].concat(clase.asiExtra || []).filter(l => l <= L).length;
    for (let i = 0; i < mejoras; i++) {
      let pts = 2;
      for (const k of clase.prim) { while (pts && a[k] < 20) { a[k]++; pts--; } if (!pts) break; }
    }
    if (clase.id === 'barbaro' && L >= 20) { a.fue = Math.min(24, a.fue + 4); a.con = Math.min(24, a.con + 4); }
    f.atr = a;
    const m = {}; r.ATR.forEach(k => { m[k] = d.mod(a[k]); });
    const prof = f.comp = 2 + Math.floor((L - 1) / 4);

    // Puntos de golpe.
    const oldMax = f.pgMax, oldPg = f.pg;
    const pg = clase.dg + m.con + (L - 1) * (clase.dg / 2 + 1 + m.con) + (clase.pgExtra || 0) * L;
    f.pgMax = Math.max(L, pg);
    f.pgDado = `${L}d${clase.dg}`;
    if (nuevo || oldMax == null) f.pg = f.pgMax;
    else f.pg = clamp(f.pgMax - (oldMax - oldPg), 0, f.pgMax);

    // Clase de armadura.
    const ca = g.ca != null ? { v: g.ca, d: g.caDesc || 'Equipo' } : clase.ca(m, L);
    if (raza.id === 'hombre-lagarto' && g.ca == null) { const nat = 13 + m.des; if (nat > ca.v && ['brujo', 'hechicero', 'mago', 'monje', 'barbaro'].includes(clase.id)) { ca.v = nat; ca.d = 'Armadura natural'; } }
    f.ca = ca.v; f.caDesc = ca.d;

    // Velocidad.
    let vel = raza.vel;
    if (clase.id === 'barbaro' && L >= 5) vel += 3;
    if (clase.id === 'monje' && L >= 2) vel += L >= 18 ? 9 : L >= 14 ? 7.5 : L >= 10 ? 6 : L >= 6 ? 4.5 : 3;
    f.vel = String(vel).replace('.', ',') + ' m';

    // Salvaciones y habilidades (competencia = 1, pericia = 2).
    f.salv = clase.id === 'monje' && L >= 14 ? [...r.ATR] : [...clase.salv];
    if (clase.id === 'picaro' && L >= 15 && !f.salv.includes('sab')) f.salv.push('sab');
    f.hab = Object.assign({}, f.hab || {});
    const fijas = [...(tras ? tras.hab : []), ...(raza.hab || [])];
    fijas.forEach(h => { if (!f.hab[h]) f.hab[h] = 1; });
    if (!g.habClase) {
      const libres = d.shuffle(clase.hab.de.filter(h => !f.hab[h]));
      g.habClase = libres.slice(0, clase.hab.n);
      if (raza.habLibre) g.habClase = g.habClase.concat(d.shuffle(Object.keys(r.HABILIDADES).filter(h => !f.hab[h] && !g.habClase.includes(h))).slice(0, raza.habLibre));
    }
    g.habClase.forEach(h => { if (!f.hab[h]) f.hab[h] = 1; });
    const pericias = (clase.pericia || []).filter(([l]) => l <= L).reduce((s, [, n]) => s + n, 0);
    let tiene = Object.values(f.hab).filter(v => v === 2).length;
    const candidatas = d.shuffle(Object.keys(f.hab).filter(h => f.hab[h] === 1));
    while (tiene < pericias && candidatas.length) { f.hab[candidatas.pop()] = 2; tiene++; }

    f.percepcionPasiva = 10 + m.sab + (f.hab['Percepción'] || 0) * prof;
    f.iniciativa = m.des;
    f.sentidos = (raza.rasgos.some(x => x[0] === 'Visión en la oscuridad') ? 'Visión en la oscuridad 18 m · ' : '') + 'Percepción pasiva ' + f.percepcionPasiva;
    f.idiomas = raza.idiomas;
    f.subclase = L >= ({ brujo: 1, clerigo: 1, hechicero: 1, mago: 2, druida: 2 }[clase.id] || 3) ? clase.sub : '';

    // Ataques con armas.
    const marcial = L >= 17 ? 10 : L >= 11 ? 8 : L >= 5 ? 6 : 4;
    const armas = g.armas || clase.armas;
    f.ataques = armas.map(w => {
      const am = w.c === 'fin' ? Math.max(m.fue, m.des) : m[w.c];
      const dado = w.d === 'marcial' ? '1d' + marcial : w.d;
      return { n: w.n, b: am + prof + (w.bono || 0), d: dado + signo(am), t: w.t, r: w.r || '' };
    });
    if (clase.id === 'picaro' && f.ataques[0]) f.ataques[0].nota = `+${Math.ceil(L / 2)}d6 furtivo, 1/turno`;
    if (clase.id === 'barbaro' && f.ataques[0]) f.ataques[0].nota = `+${L >= 16 ? 4 : L >= 9 ? 3 : 2} en furia`;
    if (raza.aliento) {
      const dados = 2 + (L >= 6) + (L >= 11) + (L >= 16);
      f.ataques.push({ n: 'Arma de aliento', b: null, d: dados + 'd6', t: g.linaje || 'ácido', nota: `Salv. Des CD ${8 + m.con + prof} · línea de 1,5 × 9 m · 1 por descanso` });
    }

    // Rasgos de raza y clase hasta el nivel actual.
    f.rasgos = raza.rasgos.map(([n, desc]) => ({ n, d: desc }));
    clase.rasgos.filter(([l]) => l <= L).forEach(([, n, desc]) => f.rasgos.push({ n, d: typeof desc === 'function' ? desc(L) : desc }));
    if (clase.id === 'brujo' && L >= 2) {
      const cuantas = L >= 18 ? 8 : L >= 15 ? 7 : L >= 12 ? 6 : L >= 9 ? 5 : L >= 7 ? 4 : L >= 5 ? 3 : 2;
      g.invoc = (g.invoc || []).slice(0, cuantas);
      const resto = d.shuffle(r.INVOCACIONES.map(x => x[0]).filter(x => !g.invoc.includes(x) && x !== 'Explosión agonizante'));
      if (!g.invoc.includes('Explosión agonizante')) g.invoc.unshift('Explosión agonizante');
      while (g.invoc.length < cuantas && resto.length) g.invoc.push(resto.pop());
      g.invoc = g.invoc.slice(0, cuantas);
      g.invoc.forEach(n => { const inv = r.INVOCACIONES.find(x => x[0] === n); f.rasgos.push({ n: 'Invocación: ' + n, d: inv ? inv[1] : '' }); });
    }

    // Conjuros.
    const lz = clase.lanz;
    if (lz && L >= (lz.desde || 1)) {
      const cm = m[lz.c];
      const esp = {};
      if (lz.tipo === 'completo') r.ESPACIOS[L - 1].forEach((n, i) => { esp[i + 1] = n; });
      if (lz.tipo === 'medio') r.ESPACIOS[Math.ceil(L / 2) - 1].forEach((n, i) => { esp[i + 1] = n; });
      if (lz.tipo === 'pacto') esp[Math.min(5, Math.ceil(L / 2))] = L >= 17 ? 4 : L >= 11 ? 3 : L >= 2 ? 2 : 1;
      const maxNivel = Math.max(...Object.keys(esp).map(Number));
      const cod = r.CLASE_COD[clase.id];
      const nTrucos = lz.trucos ? lz.trucos[L >= 10 ? 2 : L >= 4 ? 1 : 0] + (lz.extraTruco || 0) : 0;
      const nConj = lz.conocidos ? lz.conocidos[L - 1] : Math.max(1, cm + (lz.tipo === 'medio' ? Math.floor(L / 2) : L));
      const prev = f.conj || {};
      const valido = (n, min, max) => { const c = r.CONJURO[n]; return !c || (c.l >= min && c.l <= max); };
      let trucos = (prev.trucos || []).filter(n => valido(n, 0, 0));
      let lista = (prev.lista || []).filter(n => valido(n, 1, maxNivel));
      const poolT = d.shuffle(r.CONJUROS.filter(c => c[1] === 0 && c[2].includes(cod)).map(c => c[0]));
      if (clase.id === 'brujo' && !trucos.includes('Descarga sobrenatural')) trucos.unshift('Descarga sobrenatural');
      while (trucos.length < nTrucos && poolT.length) { const t = poolT.pop(); if (!trucos.includes(t)) trucos.push(t); }
      trucos = trucos.slice(0, Math.max(nTrucos, trucos.length));
      // Primero un conjuro del nivel más alto disponible; el resto, repartido al azar.
      const poolC = r.CONJUROS.filter(c => c[1] >= 1 && c[1] <= maxNivel && c[2].includes(cod));
      const altos = d.shuffle(poolC.filter(c => c[1] === maxNivel).map(c => c[0]));
      if (lista.length < nConj && altos.length && !lista.some(n => (r.CONJURO[n] || {}).l === maxNivel)) lista.push(altos.pop());
      const resto = d.shuffle(poolC.map(c => c[0]).filter(n => !lista.includes(n)));
      while (lista.length < nConj && resto.length) lista.push(resto.pop());
      lista.sort((x, y) => ((r.CONJURO[x] || {}).l || 0) - ((r.CONJURO[y] || {}).l || 0) || x.localeCompare(y));
      const usados = {};
      Object.keys(esp).forEach(k => { usados[k] = Math.min(esp[k], (prev.usados || {})[k] || 0); });
      f.conj = { c: lz.c, cd: 8 + prof + cm, atk: prof + cm, espacios: esp, pacto: lz.tipo === 'pacto', trucos, lista, usados };

      // Trucos ofensivos como ataques.
      const dadosT = 1 + (L >= 5) + (L >= 11) + (L >= 17);
      trucos.forEach(n => {
        const t = TRUCOS_DANO[n]; if (!t) return;
        if (t.rayos) {
          const extra = g.invoc && g.invoc.includes('Explosión agonizante') ? signo(cm) : '';
          f.ataques.push({ n, b: prof + cm, d: `1d10${extra}`, t: t.t, r: '36 m', nota: dadosT > 1 ? `${dadosT} rayos` : '' });
        } else if (t.atk) f.ataques.push({ n, b: prof + cm, d: `${dadosT}d${t.dado}`, t: t.t, r: 'conjuro' });
        else f.ataques.push({ n, b: null, d: `${dadosT}d${t.dado}`, t: t.t, nota: `Salv. ${t.salv} CD ${8 + prof + cm}` });
      });
    } else f.conj = null;

    // Lo editado a mano se conserva y sustituye a lo calculado con el mismo nombre.
    const conservar = (calc, prev) => {
      const man = prev.filter(x => x.manual);
      const nombres = new Set(man.map(x => x.n));
      return calc.filter(x => !nombres.has(x.n)).concat(man);
    };
    f.ataques = conservar(f.ataques, prevAtaques);
    f.rasgos = conservar(f.rasgos, prevRasgos);

    if (f.tipo !== 'pj') { f.vd = r.VD_POR_NIVEL[L]; f.xp = r.XP_VD[f.vd]; }
    return f;
  }

  // Ficha nueva a partir de una criatura del bestiario.
  function desdeBestiario(b, n = 0) {
    const f = JSON.parse(JSON.stringify(b));
    delete f.clave;
    f.id = TFF.store.uid('f');
    f.tipo = f.tipo || 'enemigo';
    f.base = b.clave;
    if (n) f.nombre = f.nombre + ' ' + n;
    f.pg = f.pgMax; f.estado = 'activo'; f.img = f.img || '';
    f.pers = f.pers || {}; f.notas = f.notas || '';
    return f;
  }

  function fichaVacia(tipo = 'npc') {
    return { id: TFF.store.uid('f'), tipo, nombre: 'Sin nombre', img: '', rol: '', actitud: 'Indiferente', estado: 'activo', raza: '', clase: '', nivel: 1, trasfondo: '', alineamiento: 'Neutral', atr: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }, comp: 2, ca: 10, caDesc: '', pg: 4, pgMax: 4, vel: '9 m', salv: [], hab: {}, ataques: [], rasgos: [], conj: null, pers: {}, notas: '', gen: null };
  }

  TFF.npc = { generar, recalcular, desdeBestiario, fichaVacia, TRUCOS_DANO };
})();
