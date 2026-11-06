/* Parches de campaña: cambios que se aplican una sola vez sobre los datos guardados.
   Así lo que ya está en el navegador del DM (fichas editadas, imágenes, notas) se conserva
   y solo se añade lo nuevo. Cada parche queda registrado en state.parches. */
(() => {
  const TFF = (window.TFF = window.TFF || {});

  const PARCHES = [
    {
      id: 'sesion-2',
      aplicar(st) {
        const S = TFF.store;
        const find = id => st.personajes.find(f => f.id === id);
        const subir = (id, nivel, extra = {}) => {
          const f = find(id); if (!f) return;
          Object.assign(f, extra);
          if ((f.nivel || 1) < nivel) { f.nivel = nivel; if (f.gen) TFF.npc.recalcular(f); }
        };

        // Niveles tras la segunda sesión. Carlos vuelve al grupo.
        subir('pj-krouds', 4);
        subir('pj-mirrir', 4);
        subir('pj-carlos', 2, { estado: 'activo', enc: true, actitud: 'Amistoso' });
        const carlos = find('pj-carlos');
        if (carlos && carlos.pers && /paradero es desconocido/.test(carlos.pers.gancho || '')) {
          carlos.pers.gancho = 'Volvió al grupo en el coliseo. Ha caído dos veces en la misma sesión.';
        }

        // Personajes nuevos.
        const nuevo = (id, base) => {
          if (find(id)) return;
          const f = Object.assign(TFF.npc.fichaVacia('npc'), base, { id });
          st.personajes.push(f);
        };
        const generado = (id, o, extra) => {
          if (find(id)) return;
          const f = TFF.npc.generar(o);
          Object.assign(f, { id }, extra, { pers: Object.assign(f.pers || {}, extra.pers || {}) });
          st.personajes.push(f);
        };

        nuevo('npc-ronald', {
          nombre: 'Sr. Ronald', raza: 'Paloma', rol: 'Mano derecha de Cira', actitud: 'Amistoso',
          pers: { rasgo: 'Una paloma que habla y da órdenes como si fuera capitán.', vinculo: 'Sirve a Cira.', gancho: 'Acompañó al grupo a la jungla a cazar a María.' }
        });
        const ptera = TFF.bestiario.find(b => b.clave === 'pteranodon');
        if (ptera && !find('npc-maria')) {
          const m = TFF.npc.desdeBestiario(ptera);
          Object.assign(m, {
            id: 'npc-maria', nombre: 'María', tipo: 'npc', rol: 'Pterodáctilo · competidora con paga', actitud: 'Amistoso', enc: false,
            pers: { pasado: 'El grupo la capturó en la jungla para la carrera del coliseo.', rasgo: 'Tras la poción de la doctora piensa, habla y sabe que cobra por competir.', peculiaridad: 'Nadie sabe con certeza si es hembra; ella dice que se llama María.' }
          });
          st.personajes.push(m);
        }
        nuevo('npc-doctora', {
          nombre: 'La doctora', raza: 'Humana', rol: 'Médica y veterinaria del coliseo', actitud: 'Indiferente',
          pers: { rasgo: 'Profesional. Le dio a María la poción que le despertó la conciencia.' }
        });
        nuevo('npc-maximor', {
          nombre: 'Maximor', rol: 'Líder del equipo rival en la carrera', actitud: 'Hostil',
          pers: { rasgo: 'Atacó al grupo incluso en pleno vuelo.', vinculo: 'Su equipo: Alan y Lip.', gancho: 'Krouds mató a Alan delante de él.' }
        });
        generado('npc-alan', { tipo: 'npc', raza: 'elfo', clase: 'explorador', trasfondo: 'forastero', nivel: 4, nombre: 'Alan', sexo: 'm' }, {
          rol: 'Elfo del bosque · equipo de Maximor', actitud: 'Hostil', estado: 'derrotado',
          pers: { pasado: 'Corría la carrera con Maximor y Lip.', gancho: 'Krouds lo mató en la carrera. Un ente sombrío se llevó su alma; su cuerpo está escondido en un cuarto mágico y aún podría revivir.' }
        });
        nuevo('npc-lip', {
          nombre: 'Lip', raza: 'Duende', rol: 'Equipo de Maximor', actitud: 'Hostil',
          pers: { gancho: 'Vio caer a Alan.' }
        });
        nuevo('ene-ente', {
          tipo: 'enemigo', nombre: 'El ente sombrío', rol: 'Apareció en el cielo del coliseo', actitud: 'Hostil',
          pers: { rasgo: 'Se llevó el alma de Alan. Cira no pudo detenerlo.' }
        });

        // Sesión 2 en la crónica. Se quita el adelanto "Antes de zarpar", que no llegó a jugarse.
        st.cronica = st.cronica.filter(e => !(e.sesion === 2 && e.titulo === 'Antes de zarpar' && /tripulación perdida en el mar de llegada/.test(e.texto)));
        const t0 = Date.now();
        const ev = (i, tipo, lugar, titulo, texto, cita, enlaces = [], extra = {}) =>
          Object.assign({ id: S.uid('ev'), sesion: 2, tipo, lugar, titulo, texto, cita, enlaces, img: '', oculto: false, t: t0 + i }, extra);
        const nuevos = [
          ev(1, 'escena', 'Puerto Nyanzaru', 'Carlos, otra vez',
            'El grupo se vuelve a cruzar con Carlos. Está borracho. Esta vez no se separan.',
            '', ['pj-carlos', 'pj-krouds', 'pj-mirrir']),
          ev(2, 'personaje', 'Puerto Nyanzaru', 'Sr. Ronald',
            'Una paloma llamada Sr. Ronald les echa una mano. Es la mano derecha de Cira.',
            '', ['npc-ronald', 'npc-cira']),
          ev(3, 'decision', 'El Gran Coliseo', 'La apuesta de Cira',
            'En el coliseo, Cira les propone competir en la carrera de dinosaurios: si quedan primeros, ganan dinero. Aceptan, pero antes necesitan un dinosaurio.',
            'Primeros o nada.', ['npc-cira', 'pj-krouds', 'pj-mirrir', 'pj-carlos']),
          ev(4, 'combate', 'La jungla', 'La caza de María',
            'Con el Sr. Ronald se internan en la selva para capturar un dinosaurio volador. Carlos queda inconsciente y casi muere, pero lo logran: un pterodáctilo de género dudoso que, más tarde, dirá llamarse María.',
            '', ['npc-maria', 'npc-ronald', 'pj-carlos', 'pj-krouds', 'pj-mirrir']),
          ev(5, 'descubrimiento', 'El Gran Coliseo · enfermería', 'Una competidora con paga',
            'Una doctora y veterinaria profesional le da a María una poción que le despierta la conciencia. Ahora entiende que es competidora, que cobra, y puede hablar con los demás.',
            'Si voy a correr, quiero mi parte.', ['npc-maria', 'npc-doctora']),
          ev(6, 'personaje', 'El puesto de pociones', 'El enano, otra vez',
            'El puesto de pociones lo atiende el enano albino al que casi matan. Momento incómodo y gracioso. No tienen dinero para comprar nada.',
            '', ['npc-enano', 'pj-krouds', 'pj-mirrir', 'pj-carlos']),
          ev(7, 'combate', 'El Gran Coliseo · arena', 'Lucio y Claudio, segunda ronda',
            'Antes de la carrera hay peleas casi a muerte con premio en dinero. Tras un cruce de insultos, el grupo vuelve a enfrentarse a Lucio y Claudio, esta vez con Carlos de su lado. Carlos cae de nuevo y todos acaban muy heridos, pero ganan. Con el premio, y ya en paz con el enano, compran pociones.',
            '', ['npc-lucio', 'npc-claudio', 'pj-carlos', 'pj-krouds', 'pj-mirrir', 'npc-enano']),
          ev(8, 'combate', 'La carrera', 'Diez trofeos',
            'No gana el más rápido: hay diez trofeos repartidos y gana el equipo que reúna más. Compiten contra otros dos equipos. Un velociraptor les cierra el paso y no consiguen derrotarlo. El equipo de Maximor los ataca incluso en el aire.',
            '', ['npc-maximor', 'npc-maria', 'pj-krouds', 'pj-mirrir', 'pj-carlos']),
          ev(9, 'combate', 'La carrera', 'Krouds y Alan',
            'El equipo de Maximor se reagrupa: Alan, un elfo del bosque, y Lip, un duende. La pelea es dura. Krouds mata a Alan delante de su grupo y le roban un trofeo. Con él, ganan la carrera.',
            '', ['pj-krouds', 'npc-alan', 'npc-lip', 'npc-maximor']),
          ev(10, 'descubrimiento', 'El cielo sobre el coliseo', 'El ente sombrío',
            'Cira va a felicitarlos cuando un ente sombrío aparece en el cielo y empieza a llevarse a Alan. Cira lucha, pero no basta: el ente se lleva el alma. El cuerpo cae inconsciente; aún podría revivir. Lo esconden en un cuarto mágico. Ahí termina la sesión.',
            'Ganaron la carrera. Alguien más se llevó el premio.', ['npc-alan', 'npc-cira', 'ene-ente']),
          ev(11, 'descubrimiento', 'Solo DM', 'Lo que se llevó el ente',
            'El alma de Alan es la primera que el grupo ve arrancar. Encaja con la maldición: algo en Chult roba las almas de los muertos y de los revividos. Si intentan revivirlo, no funcionará mientras el alma esté retenida.',
            '', ['npc-alan', 'ene-ente'], { oculto: true }),
          ev(12, 'hito', 'El Gran Coliseo', 'Nivel 4',
            'Krouds y Mirrir suben a nivel 4. Carlos, a nivel 2.',
            '', ['pj-krouds', 'pj-mirrir', 'pj-carlos'])
        ];
        st.cronica.push(...nuevos);

        // Hilos.
        const h1 = st.hilos.find(h => h.id === 'h1');
        if (h1) h1.estado = 'resuelto';
        [
          ['h7', 'El alma de Alan: ¿qué es el ente sombrío y adónde se la llevó?'],
          ['h8', 'El cuerpo de Alan sigue escondido en un cuarto mágico. Aún podría revivir.'],
          ['h9', 'Maximor y Lip vieron a Krouds matar a Alan.'],
          ['h10', 'María, el pterodáctilo: ahora habla y cobra por competir.'],
          ['h11', 'El premio de la carrera y lo que Cira les debe ahora.']
        ].forEach(([id, texto]) => { if (!st.hilos.some(h => h.id === id)) st.hilos.push({ id, texto, estado: 'abierto' }); });

        // Sesiones.
        const c = st.campana;
        c.sesiones = Object.assign({}, c.sesiones, { 2: 'El coliseo y la carrera de dinosaurios', 3: 'Después de la carrera' });
        c.sesionActual = Math.max(c.sesionActual || 1, 3);
        if (/Ahora toca zarpar\.$/.test(c.sinopsis || '')) {
          c.sinopsis = 'Tres viajeros llegan a Puerto Nyanzaru buscando un dios, una tumba y un tesoro. Una deuda con Cira los llevó al coliseo, a cazar un pterodáctilo y a ganar la carrera de dinosaurios. Pero algo bajó del cielo y se llevó un alma.';
        }
      }
    }
  ];

  // Aplica en orden los parches pendientes. Devuelve true si cambió algo.
  TFF.aplicarParches = st => {
    st.parches = st.parches || [];
    let cambio = false;
    for (const p of PARCHES) {
      if (st.parches.includes(p.id)) continue;
      try { p.aplicar(st); st.parches.push(p.id); cambio = true; }
      catch (e) { console.error('Parche ' + p.id, e); }
    }
    return cambio;
  };
})();
