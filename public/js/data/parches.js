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
    },
    {
      id: 'sesion-3',
      aplicar(st) {
        const S = TFF.store;
        const find = id => st.personajes.find(f => f.id === id);
        const nuevo = (id, base) => {
          if (find(id)) return;
          st.personajes.push(Object.assign(TFF.npc.fichaVacia(base.tipo || 'npc'), base, { id }));
        };

        // Claudio acompaña a Mirrir; murió y volvió. Los enemigos de la misión.
        const claudio = find('npc-claudio');
        if (claudio) Object.assign(claudio, { actitud: 'Amistoso', estado: 'activo', enc: true });
        nuevo('ene-contramaestre', {
          tipo: 'enemigo', nombre: 'El contramaestre', rol: 'Jefe del campamento de no muertos', actitud: 'Hostil', estado: 'derrotado',
          pers: { rasgo: 'Dejó varias veces al grupo a 1 PG.', gancho: 'Lo mataron, pero los no muertos del campamento volvían a levantarse.' }
        });
        nuevo('ene-enano-templo', {
          tipo: 'enemigo', nombre: 'Enano del templo', raza: 'Enano', rol: 'Guardia sospechoso del templo', actitud: 'Hostil', estado: 'muerto',
          pers: { gancho: 'Intentó noquear a Mirrir por la espalda. Claudio lo mató de un solo golpe.' }
        });
        nuevo('ene-humano-templo', {
          tipo: 'enemigo', nombre: 'Humano del templo', raza: 'Humano', rol: 'Guardia sospechoso del templo', actitud: 'Hostil',
          pers: { gancho: 'Acompañaba al enano cuando intentaron noquear a Mirrir.' }
        });
        nuevo('ene-tiefling-picaro', {
          tipo: 'enemigo', nombre: 'El líder tiefling', raza: 'Tiefling', clase: 'Pícaro', rol: 'Líder de los guardias del templo', actitud: 'Hostil', estado: 'derrotado',
          pers: { rasgo: 'Pícaro muy poderoso. La pelea más larga de la sesión.', gancho: 'Dejó inconsciente a Mirrir y mató a Claudio antes de caer.' }
        });
        nuevo('npc-entidad-mayor', {
          nombre: 'La entidad mayor', rol: 'Ocupó el cuerpo de Claudio', actitud: 'Indiferente',
          pers: { rasgo: 'Habló por la boca de Claudio muerto y les urgió a subir por el objeto.' }
        });
        nuevo('npc-espiritus-elficos', {
          nombre: 'Espíritus celestiales élficos', rol: 'Espíritus de las montañas, los mares, el bosque y el infierno', actitud: 'Indiferente',
          pers: { gancho: 'Revivieron a Claudio a cambio de que Mirrir no vuelva a pisar un templo.' }
        });

        const t0 = Date.now();
        const ev = (i, tipo, lugar, titulo, texto, cita, enlaces = [], extra = {}) =>
          Object.assign({ id: S.uid('ev'), sesion: 3, tipo, lugar, titulo, texto, cita, enlaces, img: '', oculto: false, t: t0 + i }, extra);
        st.cronica.push(
          ev(1, 'decision', 'Puerto Nyanzaru', 'Dos misiones',
            'El grupo se separa. Mirrir y Claudio parten a recuperar un objeto mágico de un templo para salvar el alma de Alan. Lucio, Carlos y Krouds salen a otra misión.',
            '', ['pj-mirrir', 'npc-claudio', 'npc-lucio', 'pj-carlos', 'pj-krouds', 'npc-alan']),
          ev(2, 'escena', 'La costa', 'Sin barco',
            'Iban a ir en barco, pero Mirrir lo rompe. Les toca seguir a pie. Por el camino, un no muerto les da algo de guerra, nada grave.',
            '', ['pj-mirrir', 'npc-claudio']),
          ev(3, 'combate', 'El campamento del risco', 'El contramaestre',
            'Un campamento grande en el cruce entre un risco, un río y el paso que necesitan. Se enfrentan a tres no muertos y a un contramaestre. Varias veces quedan a 1 PG. Matan a un no muerto y al contramaestre, pero los caídos vuelven a levantarse.',
            '', ['pj-mirrir', 'npc-claudio', 'ene-contramaestre']),
          ev(4, 'escena', 'Bordeando la costa', 'El barco del enemigo',
            'Huyen en el barco de los no muertos, siguiendo la costa hacia el templo. Un enemigo alcanza a subir y deja inconsciente a Claudio; Mirrir lo salva y se recupera antes de llegar.',
            '', ['pj-mirrir', 'npc-claudio']),
          ev(5, 'combate', 'El templo', 'Una bienvenida sospechosa',
            'En el templo hay un enano y un humano. Mirrir se acerca; en cuanto les da la espalda, intentan noquearlo. Se libera y empieza la pelea. Claudio mata al enano de un solo golpe.',
            '', ['pj-mirrir', 'npc-claudio', 'ene-enano-templo', 'ene-humano-templo']),
          ev(6, 'combate', 'El templo', 'El líder tiefling',
            'Baja su líder, un tiefling pícaro con mucho poder. La pelea es larga: Mirrir cae inconsciente y Claudio aguanta solo hasta que se levanta. Juntos lo vencen, pero Claudio muere en la batalla.',
            '', ['pj-mirrir', 'npc-claudio', 'ene-tiefling-picaro']),
          ev(7, 'descubrimiento', 'El templo', 'Algo en el cuerpo de Claudio',
            'El alma de Claudio sale de su cuerpo y una entidad mayor ocupa su lugar. Les dice que suban rápido a buscar el objeto si quieren salvar a su compañero.',
            'Subid. Rápido.', ['npc-claudio', 'npc-entidad-mayor']),
          ev(8, 'decision', 'La cima del templo', 'El precio de Mirrir',
            'Mirrir pone el objeto en la ruina, lo riega con sangre dorada de los elfos e invoca a los espíritus celestiales élficos de las montañas, los mares, el bosque y el infierno. Lo condenan: nunca más podrá pisar un templo. A cambio, Claudio vuelve a la vida. Mirrir acepta.',
            'Nunca más un templo.', ['pj-mirrir', 'npc-claudio', 'npc-espiritus-elficos']),
          ev(9, 'escena', 'El templo', 'Escombros',
            'El templo se viene abajo sobre ellos. Corren entre los escombros y salen. Fin de la sesión.',
            '', ['pj-mirrir', 'npc-claudio']),
          ev(10, 'descubrimiento', 'Solo DM', 'Un revivido más',
            'Claudio es ahora un revivido: encaja con la maldición que roba las almas de los muertos y de los revividos. La entidad que ocupó su cuerpo pudo notarlo.',
            '', ['npc-claudio', 'npc-entidad-mayor'], { oculto: true })
        );

        [
          ['h12', 'Mirrir no puede volver a pisar un templo. ¿Qué pasa si lo hace?'],
          ['h13', 'La entidad mayor que habló por el cuerpo de Claudio.'],
          ['h14', 'El objeto del templo: ¿basta para devolver el alma de Alan?'],
          ['h15', 'La misión de Lucio, Carlos y Krouds (pendiente de registrar).']
        ].forEach(([id, texto]) => { if (!st.hilos.some(h => h.id === id)) st.hilos.push({ id, texto, estado: 'abierto' }); });

        const c = st.campana;
        c.sesiones = Object.assign({}, c.sesiones, { 3: 'El templo y el precio de Mirrir', 4: 'Siguiente sesión' });
        c.sesionActual = Math.max(c.sesionActual || 1, 4);
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
