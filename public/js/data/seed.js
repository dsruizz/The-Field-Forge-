/* Datos iniciales: La Tumba de la Aniquilación tras la primera mitad de la campaña de prueba. */
(() => {
  const TFF = (window.TFF = window.TFF || {});

  function pj(id, o, extra) {
    const f = TFF.npc.generar(o);
    const { gen, pers, conj, ...resto } = extra;
    Object.assign(f, { id }, resto);
    if (gen) {
      f.gen = Object.assign(f.gen, gen);
      if (gen.habClase) f.hab = {};
    }
    if (conj) f.conj = conj;
    TFF.npc.recalcular(f, { nuevo: true });
    if (pers) f.pers = Object.assign(f.pers, pers);
    return f;
  }

  TFF.seed = () => {
    const personajes = [
      pj('pj-krouds', { tipo: 'pj', raza: 'draconido', clase: 'picaro', trasfondo: 'criminal', nivel: 2, nombre: 'Krouds Norixius', alineamiento: 'Caótico neutral', sexo: 'm' }, {
        nivel: 2, rol: 'Ladrón de tesoros · PJ del DM', actitud: 'Amistoso', enc: true,
        gen: { base: { fue: 15, des: 14, con: 13, int: 14, sab: 11, car: 8 }, habClase: ['Juego de manos', 'Sigilo', 'Percepción', 'Acrobacias'], linaje: 'ácido',
          armas: [{ n: 'Daga', c: 'fin', d: '1d4', t: 'perforante', r: '6/18 m' }, { n: 'Espada corta', c: 'fin', d: '1d6', t: 'perforante' }, { n: 'Arco corto', c: 'des', d: '1d6', t: 'perforante', r: '24/96 m' }] },
        pers: { pasado: 'Llegó a Chult atraído por los rumores de tesoros de alto valor. Le gusta robar y no lo esconde.', gancho: 'Quiere entrar a la jungla a encontrar tesoros.', peculiaridad: 'Le arrancó su propia daga de las manos a Cira de un flechazo.' }
      }),
      pj('pj-mirrir', { tipo: 'pj', raza: 'semiorco', clase: 'brujo', trasfondo: 'acolito', nivel: 2, nombre: 'Mirrir Hol', alineamiento: 'Caótico neutral', sexo: 'm' }, {
        nivel: 2, rol: 'Brujo guiado por un dios que todo lo ve', actitud: 'Amistoso', enc: true,
        gen: { base: { fue: 15, des: 12, con: 17, int: 15, sab: 14, car: 16 },
          armas: [{ n: 'Ballesta ligera', c: 'des', d: '1d8', t: 'perforante', r: '24/96 m' }, { n: 'Bastón', c: 'fue', d: '1d6', t: 'contundente' }, { n: 'Daga', c: 'fin', d: '1d4', t: 'perforante' }] },
        conj: { trucos: ['Descarga sobrenatural', 'Ilusión menor'], lista: ['Embrujar', 'Hechizar persona', 'Brazos de Hadar'] },
        pers: { pasado: 'Busca deidades. Un dios que todo lo ve lo guió hasta Chult.', gancho: 'Seguir las señales de su dios.', defecto: 'Abre la boca en el peor momento: arruinó el engaño al enano albino.' }
      }),
      pj('pj-carlos', { tipo: 'pj', raza: 'tiefling', clase: 'explorador', trasfondo: 'sabio', nivel: 1, nombre: 'Carlos', alineamiento: 'Neutral', sexo: 'm' }, {
        nivel: 1, rol: 'Buscador de tumbas y lugares olvidados', actitud: 'Indiferente', estado: 'desaparecido', enc: false,
        gen: { base: { fue: 16, des: 17, con: 11, int: 17, sab: 16, car: 13 }, ca: 16, caDesc: 'Equipo de explorador',
          armas: [{ n: 'Ballesta ligera', c: 'des', d: '1d8', t: 'perforante', r: '24/96 m' }, { n: 'Hoz', c: 'fue', d: '1d4', t: 'cortante' }] },
        pers: { pasado: 'Busca tumbas y lugares abandonados con presencia de dioses o de magia.', gancho: 'Se separó del grupo en la taberna. Su paradero es desconocido.' }
      }),
      pj('npc-cira', { tipo: 'npc', raza: 'humano', clase: 'mago', trasfondo: 'sabio', nivel: 9, nombre: 'Cira', alineamiento: 'Legal neutral', sexo: 'f' }, {
        nivel: 9, rol: 'Maga anciana · recibe a quienes llegan al puerto', actitud: 'Receloso',
        pers: { pasado: 'Exploradora de corazón. En una expedición a la jungla perdió a mucha de su gente a manos de piratas no muertos.', rasgo: 'Desconfía de los recién llegados, pero premia la honestidad.', vinculo: 'Crió a Lucio y a Claudio cuando llegaron a Chult siendo niños.', gancho: 'Envía al grupo a buscar a la tripulación perdida en el mar de llegada.', peculiaridad: 'Le quitó la daga a Krouds con magia, y él se la arrancó de un flechazo.' }
      }),
      pj('npc-bloop', { tipo: 'npc', raza: 'humano', clase: 'guerrero', trasfondo: 'marinero', nivel: 3, nombre: 'Capitán Bloop', sexo: 'm' }, {
        nivel: 3, rol: 'Capitán del barco que trajo al grupo', actitud: 'Indiferente',
        pers: { pasado: 'Lleva años cruzando hasta Chult. Quería descansar y ver las carreras de dinosaurios.', vinculo: 'Espera a un amigo: un humanoide con rasgos de ave.', rasgo: 'Prefiere estar solo; echó al grupo de su barco.' }
      }),
      pj('npc-enano', { tipo: 'npc', raza: 'enano', clase: 'picaro', trasfondo: 'criminal', nivel: 2, nombre: 'El enano albino', sexo: 'm' }, {
        nivel: 2, rol: 'Tabernero del bar de mala muerte', actitud: 'Hostil',
        pers: { pasado: 'Atiende un bar donde nadie hace preguntas.', rasgo: 'Barba blanca, ojos rojizos, mirada que no se pierde nada.', vinculo: 'Le cayó bien Carlos y lo dejó marchar.', gancho: 'Lo noquearon y le robaron el oro. Puede saber hacia dónde fue Carlos.' }
      }),
      pj('npc-lucio', { tipo: 'npc', raza: 'goliat', clase: 'guerrero', trasfondo: 'soldado', nivel: 4, nombre: 'Lucio', sexo: 'm' }, {
        nivel: 4, rol: 'Soldado de Chult criado por Cira', actitud: 'Receloso',
        pers: { pasado: 'Llegó a Chult de niño y Cira lo ayudó a convertirse en soldado. Daría la vida por la ciudad.', rasgo: 'Se rió del grupo en el coliseo… hasta que cayó.' }
      }),
      pj('npc-claudio', { tipo: 'npc', raza: 'elfo', clase: 'paladin', trasfondo: 'noble', nivel: 3, nombre: 'Claudio', sexo: 'm' }, {
        nivel: 3, rol: 'Paladín elfo criado por Cira', actitud: 'Hostil',
        pers: { defecto: 'Racista y clasista con quienes no son elfos.', rasgo: 'Fue el primero en caer en el coliseo, por el ácido de Krouds.', vinculo: 'Le debe todo a Cira.' }
      })
    ];

    const B = k => TFF.bestiario.find(b => b.clave === k);
    [1, 2, 3].forEach(n => { const f = TFF.npc.desdeBestiario(B('pirata-ahogado'), n); f.enc = true; personajes.push(f); });
    personajes.push(TFF.npc.desdeBestiario(B('contramaestre-carronero')));
    personajes.push(TFF.npc.desdeBestiario(B('capitan-sin-aliento')));

    const ev = (sesion, tipo, lugar, titulo, texto, cita, enlaces = [], extra = {}) =>
      Object.assign({ id: TFF.store.uid('ev'), sesion, tipo, lugar, titulo, texto, cita, enlaces, img: '', oculto: false, t: Date.now() }, extra);

    const cronica = [
      ev(1, 'escena', 'Puerto Nyanzaru · los muelles', 'Tierra a la vista',
        'Tras semanas de viaje, el barco atraca en Puerto Nyanzaru, la única gran ciudad de Chult. Cada uno trae su motivo: Mirrir busca deidades y lo guía un dios que todo lo ve; Carlos busca tumbas y lugares olvidados; Krouds busca tesoros de alto valor.',
        'Un dios, una tumba y un tesoro. Tres razones para el mismo puerto.', ['pj-mirrir', 'pj-carlos', 'pj-krouds']),
      ev(1, 'personaje', 'El barco', 'El capitán Bloop quiere estar solo',
        'El capitán piensa descansar y ver las carreras de dinosaurios mientras espera a un amigo, un humanoide con rasgos de ave. No quiere más visitas: el grupo baja del barco.',
        '', ['npc-bloop']),
      ev(1, 'personaje', 'Puerto Nyanzaru · los muelles', 'Cira, la que recibe a todos',
        'Una maga anciana recibe a los recién llegados. Advierte que la ciudad es peligrosa, que la Mano Roja tiene problemas con la ciudad y que desaparecen guías y soldados. Le quita la daga a Krouds con magia; Krouds se la arranca de las manos de un flechazo. Desde ese momento, desconfianza y escoltas.',
        'No se metan en problemas. Y no entren en la jungla.', ['npc-cira', 'pj-krouds']),
      ev(1, 'decision', 'Bar de mala muerte', 'Jerga de ladrones',
        'Krouds lee las señales de la jerga de ladrones y lleva al grupo a un bar donde la autoridad no llega. Atiende un enano albino de barba blanca. Krouds y Mirrir se juegan a los dados quién paga la cerveza: gana Krouds. Sellan una alianza para entrar en la jungla.',
        'El que pierde a los dados paga. El que gana elige el rumbo.', ['pj-krouds', 'pj-mirrir', 'npc-enano']),
      ev(1, 'combate', 'Afueras del bar', 'El borracho y los guardias',
        'Para librarse de los escoltas, Mirrir lanza un hechizo que solo produce una música extraña. Krouds finge estar borracho y, en un falso desmayo, les quita las espadas. Ninguna tirada acierta y los guardias devuelven cada golpe, pero al final caen noqueados.',
        '', ['pj-krouds', 'pj-mirrir', 'pj-carlos']),
      ev(1, 'decision', 'Bar de mala muerte', 'Un testigo de barba blanca',
        'El enano albino lo ha visto todo. Carlos casi lo convence, hasta que Mirrir lo reta y arruina la escena. El enano deja marchar a Carlos, que abandona al grupo. Krouds y Mirrir noquean al enano y se llevan su oro y los uniformes de los guardias.',
        'Carlos se fue. Nadie lo detuvo.', ['npc-enano', 'pj-carlos', 'pj-mirrir', 'pj-krouds']),
      ev(1, 'escena', 'Un granero en las afueras', 'Fugitivos',
        'El robo ya está denunciado. En la huida se cruzan con Cira y no se detienen. Pasan la noche escondidos en un granero y recuperan fuerzas.',
        '', ['pj-krouds', 'pj-mirrir', 'npc-cira']),
      ev(1, 'descubrimiento', 'Puerto Nyanzaru', 'Rendirse a tiempo',
        'Al amanecer deciden entregarse a Cira y pedir perdón. Ella acepta a cambio de un servicio. Les cuenta su historia: perdió a mucha gente en la jungla a manos de piratas no muertos. Ahora una tripulación ha desaparecido en el mar de llegada y sospecha que los piratas han salido a patrullar.',
        '¿Qué buscan los muertos fuera de la jungla?', ['npc-cira', 'pj-krouds', 'pj-mirrir']),
      ev(1, 'combate', 'El Gran Coliseo', 'Prueba en el coliseo',
        'Antes de zarpar, Cira los pone a prueba contra Lucio, un goliat guerrero, y Claudio, un elfo paladín clasista. Los dos se ríen del grupo. Claudio cae primero por el ácido de Krouds; Lucio, por la descarga de Mirrir. Mirrir llega a caer, pero Cira lo cura.',
        'Si no van a aportar nada, mejor acabar ya.', ['npc-lucio', 'npc-claudio', 'pj-krouds', 'pj-mirrir', 'npc-cira']),
      ev(1, 'hito', 'Una posada del puerto', 'Nivel 2',
        'Krouds y Mirrir suben a nivel 2. Los llevan a una posada a descansar antes de la misión.',
        '', ['pj-krouds', 'pj-mirrir']),
      ev(2, 'escena', 'Puerto Nyanzaru · los muelles', 'Antes de zarpar',
        'La misión es encontrar a la tripulación perdida en el mar de llegada. Nadie sabe dónde está Carlos. Nadie sabe qué espera en el agua.',
        'El mar devuelve lo que se lleva. No siempre entero.', ['pj-krouds', 'pj-mirrir', 'npc-cira'])
    ];

    const mapa = (nombre, region, desc, hint, ambiente) => ({
      id: TFF.store.uid('map'), nombre, region, desc, img: '', hint, notas: '',
      ambiente: Object.assign({ momento: '', clima: '' }, ambiente),
      overlay: { titulo: true, desc: true, leyenda: true, ambiente: true, vineta: true },
      vista: { x: 0, y: 0, z: 1 }, pois: []
    });

    return {
      version: 1,
      campana: {
        titulo: 'La Tumba de la Aniquilación',
        kicker: 'Crónica de campaña · Chult',
        sinopsis: 'Tres viajeros llegan a Puerto Nyanzaru buscando un dios, una tumba y un tesoro. Una noche de cervezas, guardias noqueados y una deuda con la maga del puerto los ha puesto al servicio de Chult. Ahora toca zarpar.',
        portada: '',
        sesionActual: 2,
        sesiones: { 1: 'Llegada a Puerto Nyanzaru', 2: 'Rumbo al mar de llegada' }
      },
      hilos: [
        { id: 'h1', texto: '¿Dónde está Carlos? Se fue del bar y nadie sabe hacia dónde.', estado: 'abierto' },
        { id: 'h2', texto: 'La tripulación perdida en el mar de llegada.', estado: 'abierto' },
        { id: 'h3', texto: 'Los piratas no muertos: ¿qué buscan fuera de la jungla?', estado: 'abierto' },
        { id: 'h4', texto: 'El grupo le debe un servicio a Cira.', estado: 'abierto' },
        { id: 'h5', texto: 'El enano albino y los guardias noqueados pueden reconocerlos.', estado: 'abierto' },
        { id: 'h6', texto: 'El capitán Bloop espera a un amigo con rasgos de ave.', estado: 'abierto' }
      ],
      cronica,
      personajes,
      mapas: [
        mapa('Puerto Nyanzaru', 'Chult · costa norte', 'La única gran ciudad de Chult. Aquí todo se compra y todo se vende.', '01_Mapas/Ciudad_Port_Nyanzaru/Port_Nyanzaru_City_Map_with_Labels_-_Player_Version_u-mjeleon.png', { momento: 'Amanecer', clima: 'Bochorno' }),
        mapa('Los muelles', 'Puerto Nyanzaru', 'Barcos de medio mundo, cajas, gaviotas y un dinosaurio que carga como una mula.', '01_Mapas/Ciudad_Port_Nyanzaru/Port_Nyanzaru_-_Docks_[35x45]_u-Infinite-Ad5464.jpg', { momento: 'Mañana', clima: 'Despejado' }),
        mapa('Península de Chult', 'Mapa de viaje', 'Jungla, ríos, ruinas y un mar que no devuelve a nadie entero.', '01_Mapas/Regionales_Chult/The_Chultan_Peninsula_por_MapyNiepraktyczne.jpg', { momento: '', clima: '' }),
        mapa('Acantilado costero', 'Costa de Chult', 'Roca negra, olas que golpean y algo que se mueve en la espuma.', '01_Mapas/Jungla_y_Exploracion/Acantilado_costero_Czepeku.jpg', { momento: 'Atardecer', clima: 'Niebla' })
      ]
    };
  };
})();
