/* Bestiario para la segunda mitad de la campaña.
   Estadísticas del SRD 5.1 (CC BY 4.0) traducidas y resumidas para consulta en mesa.
   Las “variantes de campaña” reutilizan un bloque del SRD con otro nombre y un rasgo
   narrativo; se indica siempre en qué criatura se basan. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const A = (fue, des, con, int, sab, car) => ({ fue, des, con, int, sab, car });
  const at = (n, b, d, t, r = '', nota = '') => ({ n, b, d, t, r, nota });
  const ra = (n, d) => ({ n, d });

  const NO_MUERTO_MAR = 'Piratas no muertos';

  TFF.bestiario = [
    /* ---- Variantes de campaña: los piratas no muertos de Cira ---- */
    { clave: 'pirata-ahogado', nombre: 'Pirata ahogado', grupo: NO_MUERTO_MAR, categoria: 'No muerto mediano', vd: '1/4', xp: 50, ca: 8, caDesc: 'Harapos empapados', pgMax: 22, pgDado: '3d8+9', vel: '6 m, nadar 6 m', atr: A(13, 6, 16, 3, 6, 5), comp: 2,
      salvTxt: 'Sab +0', sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 8', idiomas: 'Entiende el común, no habla', resist: 'Inmune a veneno · no puede ser envenenado',
      ataques: [at('Garfio oxidado', 3, '1d6+1', 'cortante')],
      rasgos: [ra('Fortaleza de no muerto', 'Si el daño lo deja a 0 PG, salvación de Con (CD 5 + daño); si la supera queda a 1 PG. No funciona con daño radiante ni críticos.'), ra('Peso del fondo', 'Camina por el lecho marino sin flotar; no necesita respirar.')],
      rol: 'Tripulante devuelto por el mar. Lento, insistente, huele a salitre y podredumbre.', fuente: 'Variante de campaña · base: Zombi (SRD)', imgSugerida: '03_Enemigos_Criaturas/Zombie.jpg' },
    { clave: 'grumete-calavera', nombre: 'Grumete calavera', grupo: NO_MUERTO_MAR, categoria: 'No muerto mediano', vd: '1/4', xp: 50, ca: 13, caDesc: 'Restos de armadura', pgMax: 13, pgDado: '2d8+4', vel: '9 m', atr: A(10, 14, 15, 6, 8, 5), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 9', idiomas: 'Entiende el común, no habla', resist: 'Vulnerable a contundente · inmune a veneno · no puede ser envenenado ni agotado',
      ataques: [at('Alfanje', 4, '1d6+2', 'cortante'), at('Arco corto', 4, '1d6+2', 'perforante', '24/96 m')],
      rasgos: [ra('Huesos de cubierta', 'Trepa por jarcias y mástiles sin prueba.')],
      rol: 'Lo que queda de los marineros más jóvenes. Rápidos, ruidosos, se rompen con un buen golpe.', fuente: 'Variante de campaña · base: Esqueleto (SRD)', imgSugerida: '' },
    { clave: 'contramaestre-carronero', nombre: 'Contramaestre carroñero', grupo: NO_MUERTO_MAR, categoria: 'No muerto mediano', vd: '1', xp: 200, ca: 12, pgMax: 22, pgDado: '5d8', vel: '9 m', atr: A(13, 15, 10, 7, 10, 6), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 10', idiomas: 'Común', resist: 'Inmune a veneno · no puede ser hechizado, agotado ni envenenado',
      ataques: [at('Mordisco', 2, '2d6+2', 'perforante'), at('Garras', 4, '2d4+2', 'cortante', '', 'Salv. Con CD 10 o paralizado 1 min (repite al final de cada turno). Los elfos y no muertos son inmunes.')],
      rasgos: [ra('Látigo de mando', 'Los piratas ahogados a 9 m que lo oigan pueden moverse 3 m extra en su turno.')],
      rol: 'Mantiene la disciplina a mordiscos. Si cae, los ahogados dudan un turno.', fuente: 'Variante de campaña · base: Necrófago (SRD)', imgSugerida: '03_Enemigos_Criaturas/Ghoul.png' },
    { clave: 'capitan-sin-aliento', nombre: 'Capitán sin aliento', grupo: NO_MUERTO_MAR, categoria: 'No muerto mediano · jefe', vd: '3', xp: 700, ca: 14, caDesc: 'Cuero tachonado', pgMax: 45, pgDado: '6d8+18', vel: '9 m', atr: A(15, 14, 16, 10, 13, 15), comp: 2,
      habTxt: 'Percepción +3, Sigilo +4', sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 13', idiomas: 'Común y los que hablaba en vida',
      resist: 'Resiste necrótico y armas no mágicas ni plateadas · inmune a veneno · no puede ser agotado ni envenenado',
      ataques: [at('Drenaje de vida', 4, '1d6+2', 'necrótico', '', 'Salv. Con CD 13 o sus PG máximos se reducen en el daño recibido.'), at('Sable', 4, '1d8+2', 'cortante'), at('Arco largo', 4, '1d8+2', 'perforante', '45/180 m')],
      rasgos: [ra('Multiataque', 'Dos ataques con el sable o el arco. Puede cambiar uno por Drenaje de vida.'), ra('Sensibilidad a la luz solar', 'Desventaja en ataques y Percepción a la luz del sol.'), ra('Ancla al barco', 'Si su barco se hunde o arde, pierde la resistencia a armas no mágicas.')],
      rol: 'Busca algo en la jungla y recluta muertos por el camino. Mortal para un grupo de nivel 2: úsalo como amenaza, no como pelea directa.', fuente: 'Variante de campaña · base: Tumulario (SRD)', imgSugerida: '' },

    /* ---- No muertos del SRD ---- */
    { clave: 'zombi', nombre: 'Zombi', grupo: 'No muertos', categoria: 'No muerto mediano', vd: '1/4', xp: 50, ca: 8, pgMax: 22, pgDado: '3d8+9', vel: '6 m', atr: A(13, 6, 16, 3, 6, 5), comp: 2,
      salvTxt: 'Sab +0', sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 8', idiomas: 'Entiende los que conocía, no habla', resist: 'Inmune a veneno · no puede ser envenenado',
      ataques: [at('Golpe', 3, '1d6+1', 'contundente')], rasgos: [ra('Fortaleza de no muerto', 'A 0 PG, salvación de Con (CD 5 + daño) para quedar a 1 PG, salvo radiante o crítico.')], fuente: 'SRD 5.1', imgSugerida: '03_Enemigos_Criaturas/Zombie.jpg' },
    { clave: 'esqueleto', nombre: 'Esqueleto', grupo: 'No muertos', categoria: 'No muerto mediano', vd: '1/4', xp: 50, ca: 13, caDesc: 'Restos de armadura', pgMax: 13, pgDado: '2d8+4', vel: '9 m', atr: A(10, 14, 15, 6, 8, 5), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 9', resist: 'Vulnerable a contundente · inmune a veneno',
      ataques: [at('Espada corta', 4, '1d6+2', 'perforante'), at('Arco corto', 4, '1d6+2', 'perforante', '24/96 m')], rasgos: [], fuente: 'SRD 5.1' },
    { clave: 'necrofago', nombre: 'Necrófago', grupo: 'No muertos', categoria: 'No muerto mediano', vd: '1', xp: 200, ca: 12, pgMax: 22, pgDado: '5d8', vel: '9 m', atr: A(13, 15, 10, 7, 10, 6), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 10', resist: 'Inmune a veneno · no puede ser hechizado, agotado ni envenenado',
      ataques: [at('Mordisco', 2, '2d6+2', 'perforante'), at('Garras', 4, '2d4+2', 'cortante', '', 'Salv. Con CD 10 o paralizado 1 min. Elfos y no muertos inmunes.')], rasgos: [], fuente: 'SRD 5.1', imgSugerida: '03_Enemigos_Criaturas/Ghoul.png' },
    { clave: 'ghast', nombre: 'Ghast', grupo: 'No muertos', categoria: 'No muerto mediano', vd: '2', xp: 450, ca: 13, pgMax: 36, pgDado: '8d8', vel: '9 m', atr: A(16, 17, 10, 11, 10, 8), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 10', resist: 'Resiste necrótico · inmune a veneno',
      ataques: [at('Mordisco', 3, '2d8+3', 'perforante'), at('Garras', 5, '2d6+3', 'cortante', '', 'Salv. Con CD 10 o paralizado 1 min (no elfos).')],
      rasgos: [ra('Hedor', 'Quien empiece su turno a 1,5 m: salv. Con CD 10 o envenenado hasta su siguiente turno.'), ra('Desafiar la expulsión', 'Él y los necrófagos a 9 m tienen ventaja contra Expulsar muertos vivientes.')], fuente: 'SRD 5.1' },
    { clave: 'sombra', nombre: 'Sombra', grupo: 'No muertos', categoria: 'No muerto mediano', vd: '1/2', xp: 100, ca: 12, pgMax: 16, pgDado: '3d8+3', vel: '12 m', atr: A(6, 14, 13, 6, 10, 8), comp: 2,
      habTxt: 'Sigilo +4 (+6 en penumbra)', sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 10', resist: 'Resiste ácido, frío, fuego, relámpago, trueno y armas no mágicas · vulnerable a radiante · inmune a necrótico y veneno',
      ataques: [at('Toque drenafuerza', 4, '2d6+2', 'necrótico', '', 'La Fuerza del objetivo baja 1d4 hasta un descanso. Si llega a 0, muere y se alza otra sombra.')],
      rasgos: [ra('Amorfa', 'Pasa por huecos de 2,5 cm.'), ra('Sigilo sombrío', 'En penumbra se esconde como acción adicional.'), ra('Debilidad a la luz solar', 'Desventaja en todo a la luz del sol.')], fuente: 'SRD 5.1' },
    { clave: 'espectro', nombre: 'Espectro', grupo: 'No muertos', categoria: 'No muerto mediano', vd: '1', xp: 200, ca: 12, pgMax: 22, pgDado: '5d8', vel: '0 m, volar 15 m (flotar)', atr: A(1, 14, 11, 10, 10, 11), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 10', resist: 'Resiste daño físico no mágico y varios elementos · inmune a necrótico y veneno',
      ataques: [at('Drenaje de vida', 4, '3d6', 'necrótico', '', 'Salv. Con CD 10 o sus PG máximos bajan en el daño recibido.')],
      rasgos: [ra('Movimiento incorpóreo', 'Atraviesa criaturas y objetos (1d10 de fuerza si termina dentro).'), ra('Sensibilidad a la luz solar', 'Desventaja a la luz del sol.')], fuente: 'SRD 5.1' },

    /* ---- Gente ---- */
    { clave: 'bandido', nombre: 'Bandido', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '1/8', xp: 25, ca: 12, caDesc: 'Cuero', pgMax: 11, pgDado: '2d8+2', vel: '9 m', atr: A(11, 12, 12, 10, 10, 10), comp: 2,
      sentidos: 'Percepción pasiva 10', ataques: [at('Cimitarra', 3, '1d6+1', 'cortante'), at('Ballesta ligera', 3, '1d8+1', 'perforante', '24/96 m')], rasgos: [], fuente: 'SRD 5.1' },
    { clave: 'maton', nombre: 'Matón', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '1/2', xp: 100, ca: 11, caDesc: 'Cuero', pgMax: 32, pgDado: '5d8+10', vel: '9 m', atr: A(15, 11, 14, 10, 10, 11), comp: 2,
      habTxt: 'Intimidación +2', sentidos: 'Percepción pasiva 10', ataques: [at('Maza', 4, '1d6+2', 'contundente'), at('Ballesta pesada', 2, '1d10', 'perforante', '30/120 m')],
      rasgos: [ra('Multiataque', 'Dos ataques cuerpo a cuerpo.'), ra('Tácticas de manada', 'Ventaja si un aliado está a 1,5 m del objetivo.')], fuente: 'SRD 5.1' },
    { clave: 'capitan-bandido', nombre: 'Capitán pirata', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '2', xp: 450, ca: 15, caDesc: 'Cuero tachonado', pgMax: 65, pgDado: '10d8+20', vel: '9 m', atr: A(15, 16, 14, 14, 11, 14), comp: 2,
      salvTxt: 'Fue +4, Des +5, Sab +2', habTxt: 'Atletismo +4, Engaño +4', sentidos: 'Percepción pasiva 10', ataques: [at('Cimitarra', 5, '1d6+3', 'cortante'), at('Daga', 5, '1d4+3', 'perforante', '6/18 m')],
      rasgos: [ra('Multiataque', 'Dos cimitarras y una daga, o dos dagas lanzadas.'), ra('Parada', 'Reacción: +2 a la CA contra un ataque cuerpo a cuerpo.')], fuente: 'SRD 5.1 · Capitán bandido' },
    { clave: 'guardia', nombre: 'Guardia de Nyanzaru', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '1/8', xp: 25, ca: 16, caDesc: 'Cota de malla parcial y escudo', pgMax: 11, pgDado: '2d8+2', vel: '9 m', atr: A(13, 12, 12, 10, 11, 10), comp: 2,
      habTxt: 'Percepción +2', sentidos: 'Percepción pasiva 12', ataques: [at('Lanza', 3, '1d6+1', 'perforante', '6/18 m', '1d8+1 a dos manos')], rasgos: [], fuente: 'SRD 5.1 · Guardia' },
    { clave: 'veterano', nombre: 'Veterano', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '3', xp: 700, ca: 17, caDesc: 'Bandas', pgMax: 58, pgDado: '9d8+18', vel: '9 m', atr: A(16, 13, 14, 10, 11, 10), comp: 2,
      habTxt: 'Atletismo +5, Percepción +2', sentidos: 'Percepción pasiva 12', ataques: [at('Espada larga', 5, '1d8+3', 'cortante'), at('Espada corta', 5, '1d6+3', 'perforante'), at('Ballesta pesada', 3, '1d10+1', 'perforante', '30/120 m')],
      rasgos: [ra('Multiataque', 'Dos espadas largas; con la espada corta desenvainada, un ataque más.')], fuente: 'SRD 5.1' },
    { clave: 'explorador-npc', nombre: 'Guía explorador', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '1/2', xp: 100, ca: 13, caDesc: 'Cuero', pgMax: 16, pgDado: '3d8+3', vel: '9 m', atr: A(11, 14, 12, 11, 13, 11), comp: 2,
      habTxt: 'Naturaleza +4, Percepción +5, Sigilo +6, Supervivencia +5', sentidos: 'Percepción pasiva 15', ataques: [at('Espada corta', 4, '1d6+2', 'perforante'), at('Arco largo', 4, '1d8+2', 'perforante', '45/180 m')],
      rasgos: [ra('Multiataque', 'Dos ataques.'), ra('Oído y vista agudos', 'Ventaja en Percepción con oído o vista.')], fuente: 'SRD 5.1 · Explorador' },
    { clave: 'plebeyo', nombre: 'Plebeyo', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '0', xp: 10, ca: 10, pgMax: 4, pgDado: '1d8', vel: '9 m', atr: A(10, 10, 10, 10, 10, 10), comp: 2,
      sentidos: 'Percepción pasiva 10', ataques: [at('Garrote', 2, '1d4', 'contundente')], rasgos: [], fuente: 'SRD 5.1' },
    { clave: 'hombre-lagarto', nombre: 'Hombre lagarto', grupo: 'Gente', categoria: 'Humanoide mediano', vd: '1/2', xp: 100, ca: 15, caDesc: 'Natural y escudo', pgMax: 22, pgDado: '4d8+4', vel: '9 m, nadar 9 m', atr: A(15, 10, 13, 7, 12, 7), comp: 2,
      habTxt: 'Percepción +3, Sigilo +4, Supervivencia +5', sentidos: 'Percepción pasiva 13', idiomas: 'Dracónico',
      ataques: [at('Mordisco', 4, '1d6+2', 'perforante'), at('Garrote pesado', 4, '1d6+2', 'contundente'), at('Jabalina', 4, '1d6+2', 'perforante', '9/36 m')],
      rasgos: [ra('Contener el aliento', '15 minutos.'), ra('Multiataque', 'Dos ataques cuerpo a cuerpo con armas distintas.')], fuente: 'SRD 5.1', imgSugerida: '03_Enemigos_Criaturas/Lizardfolk.jpg' },

    /* ---- Mar y costa ---- */
    { clave: 'cangrejo-gigante', nombre: 'Cangrejo gigante', grupo: 'Mar y costa', categoria: 'Bestia mediana', vd: '1/8', xp: 25, ca: 15, caDesc: 'Natural', pgMax: 13, pgDado: '3d8', vel: '9 m, nadar 9 m', atr: A(13, 15, 11, 1, 9, 3), comp: 2,
      habTxt: 'Sigilo +4', sentidos: 'Vista ciega 9 m · Percepción pasiva 9', ataques: [at('Pinza', 3, '1d6+1', 'contundente', '', 'Agarrado (escapar CD 11). Tiene dos pinzas.')], rasgos: [ra('Anfibio', 'Respira aire y agua.')], fuente: 'SRD 5.1' },
    { clave: 'tiburon-arrecife', nombre: 'Tiburón de arrecife', grupo: 'Mar y costa', categoria: 'Bestia mediana', vd: '1/2', xp: 100, ca: 12, caDesc: 'Natural', pgMax: 22, pgDado: '4d8+4', vel: '0 m, nadar 12 m', atr: A(14, 13, 13, 1, 10, 4), comp: 2,
      habTxt: 'Percepción +2', sentidos: 'Vista ciega 9 m · Percepción pasiva 12', ataques: [at('Mordisco', 4, '1d8+2', 'perforante')], rasgos: [ra('Tácticas de manada', 'Ventaja si un aliado está junto al objetivo.'), ra('Respiración acuática', 'Solo respira bajo el agua.')], fuente: 'SRD 5.1' },
    { clave: 'enjambre-quippers', nombre: 'Enjambre de quippers', grupo: 'Mar y costa', categoria: 'Enjambre mediano', vd: '1', xp: 200, ca: 13, pgMax: 28, pgDado: '8d8−8', vel: '0 m, nadar 12 m', atr: A(13, 16, 9, 1, 7, 2), comp: 2,
      sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 8', resist: 'Resiste contundente, cortante y perforante',
      ataques: [at('Mordiscos', 5, '4d6', 'perforante', '', '2d6 si al enjambre le quedan la mitad de PG o menos.')], rasgos: [ra('Frenesí de sangre', 'Ventaja contra criaturas heridas.'), ra('Enjambre', 'Ocupa el espacio de otras criaturas; no recupera PG.')], fuente: 'SRD 5.1' },
    { clave: 'pulpo-gigante', nombre: 'Pulpo gigante', grupo: 'Mar y costa', categoria: 'Bestia grande', vd: '1', xp: 200, ca: 11, pgMax: 52, pgDado: '8d10+8', vel: '3 m, nadar 18 m', atr: A(17, 13, 13, 4, 10, 4), comp: 2,
      habTxt: 'Percepción +4, Sigilo +5', sentidos: 'Visión en la oscuridad 18 m · Percepción pasiva 14', ataques: [at('Tentáculos', 5, '2d6+3', 'contundente', '4,5 m', 'Agarrado y apresado (escapar CD 16).')],
      rasgos: [ra('Nube de tinta', 'Reacción, 1 por descanso: nube de 6 m que oscurece la zona.'), ra('Camuflaje subacuático', 'Ventaja en Sigilo bajo el agua.')], fuente: 'SRD 5.1' },
    { clave: 'cocodrilo', nombre: 'Cocodrilo', grupo: 'Mar y costa', categoria: 'Bestia grande', vd: '1/2', xp: 100, ca: 12, caDesc: 'Natural', pgMax: 19, pgDado: '3d10+3', vel: '6 m, nadar 9 m', atr: A(15, 10, 13, 2, 10, 5), comp: 2,
      habTxt: 'Sigilo +2', sentidos: 'Percepción pasiva 10', ataques: [at('Mordisco', 4, '1d10+2', 'perforante', '', 'Agarrado (escapar CD 12).')], rasgos: [ra('Contener el aliento', '15 minutos.')], fuente: 'SRD 5.1', imgSugerida: '03_Enemigos_Criaturas/Crocodile.png' },
    { clave: 'plesiosaurio', nombre: 'Plesiosaurio', grupo: 'Mar y costa', categoria: 'Bestia grande', vd: '2', xp: 450, ca: 13, caDesc: 'Natural', pgMax: 68, pgDado: '8d10+24', vel: '6 m, nadar 12 m', atr: A(18, 15, 16, 2, 12, 5), comp: 2,
      habTxt: 'Percepción +3, Sigilo +4', sentidos: 'Percepción pasiva 13', ataques: [at('Mordisco', 6, '3d6+4', 'perforante', '3 m')], rasgos: [ra('Contener el aliento', '1 hora.')], fuente: 'SRD 5.1' },

    /* ---- Jungla ---- */
    { clave: 'serpiente-venenosa', nombre: 'Serpiente venenosa gigante', grupo: 'Jungla', categoria: 'Bestia mediana', vd: '1/4', xp: 50, ca: 14, pgMax: 11, pgDado: '2d8+2', vel: '9 m, nadar 9 m', atr: A(10, 18, 13, 2, 10, 3), comp: 2,
      habTxt: 'Percepción +2', sentidos: 'Vista ciega 3 m · Percepción pasiva 12', ataques: [at('Mordisco', 6, '1d4+4', 'perforante', '3 m', 'Salv. Con CD 11 o 3d6 de veneno (mitad si la supera).')], rasgos: [], fuente: 'SRD 5.1' },
    { clave: 'serpiente-constrictora', nombre: 'Serpiente constrictora', grupo: 'Jungla', categoria: 'Bestia grande', vd: '1/4', xp: 50, ca: 12, pgMax: 13, pgDado: '2d10+2', vel: '9 m, nadar 9 m', atr: A(15, 14, 12, 1, 10, 3), comp: 2,
      sentidos: 'Vista ciega 3 m · Percepción pasiva 10', ataques: [at('Mordisco', 4, '1d6+2', 'perforante'), at('Constreñir', 4, '1d8+2', 'contundente', '', 'Agarrado y apresado (escapar CD 14).')], rasgos: [], fuente: 'SRD 5.1' },
    { clave: 'simio', nombre: 'Simio', grupo: 'Jungla', categoria: 'Bestia mediana', vd: '1/2', xp: 100, ca: 12, pgMax: 19, pgDado: '3d8+6', vel: '9 m, trepar 9 m', atr: A(16, 14, 14, 6, 12, 7), comp: 2,
      habTxt: 'Atletismo +5, Percepción +3', sentidos: 'Percepción pasiva 13', ataques: [at('Puño', 5, '1d6+3', 'contundente'), at('Roca', 5, '1d6+3', 'contundente', '7,5/15 m')], rasgos: [ra('Multiataque', 'Dos puñetazos.')], fuente: 'SRD 5.1' },
    { clave: 'pteranodon', nombre: 'Pteranodon', grupo: 'Dinosaurios', categoria: 'Bestia mediana', vd: '1/4', xp: 50, ca: 13, caDesc: 'Natural', pgMax: 13, pgDado: '3d8', vel: '3 m, volar 18 m', atr: A(12, 15, 10, 2, 9, 5), comp: 2,
      habTxt: 'Percepción +1', sentidos: 'Percepción pasiva 11', ataques: [at('Mordisco', 3, '2d4+1', 'perforante')], rasgos: [ra('Pasada', 'No provoca ataques de oportunidad al salir del alcance volando.')], fuente: 'SRD 5.1' },
    { clave: 'alosaurio', nombre: 'Alosaurio', grupo: 'Dinosaurios', categoria: 'Bestia grande', vd: '2', xp: 450, ca: 13, caDesc: 'Natural', pgMax: 51, pgDado: '6d10+18', vel: '18 m', atr: A(19, 13, 17, 2, 12, 5), comp: 2,
      habTxt: 'Percepción +5', sentidos: 'Percepción pasiva 15', ataques: [at('Mordisco', 6, '2d10+4', 'perforante'), at('Garra', 6, '1d8+4', 'cortante')],
      rasgos: [ra('Abalanzarse', 'Si corre 9 m en línea recta y acierta con la garra: salv. Fue CD 13 o derribado, y muerde como acción adicional.')], fuente: 'SRD 5.1' },
    { clave: 'anquilosaurio', nombre: 'Anquilosaurio', grupo: 'Dinosaurios', categoria: 'Bestia enorme', vd: '3', xp: 700, ca: 15, caDesc: 'Natural', pgMax: 68, pgDado: '8d12+16', vel: '9 m', atr: A(19, 11, 15, 2, 12, 5), comp: 2,
      sentidos: 'Percepción pasiva 11', ataques: [at('Cola', 7, '4d6+4', 'contundente', '3 m', 'Salv. Fue CD 14 o derribado.')], rasgos: [], fuente: 'SRD 5.1' },
    { clave: 'triceratops', nombre: 'Triceratops', grupo: 'Dinosaurios', categoria: 'Bestia enorme', vd: '5', xp: 1800, ca: 13, caDesc: 'Natural', pgMax: 95, pgDado: '10d12+30', vel: '15 m', atr: A(22, 9, 17, 2, 11, 5), comp: 3,
      sentidos: 'Percepción pasiva 10', ataques: [at('Cornada', 9, '4d8+6', 'perforante'), at('Pisotón', 9, '3d10+6', 'contundente', '', 'Solo contra criaturas derribadas.')],
      rasgos: [ra('Embestida', 'Si corre 6 m y acierta la cornada: salv. Fue CD 13 o derribado, y pisotea como acción adicional.')], fuente: 'SRD 5.1' },
    { clave: 'tiranosaurio', nombre: 'Tiranosaurio rex', grupo: 'Dinosaurios', categoria: 'Bestia enorme', vd: '8', xp: 3900, ca: 13, caDesc: 'Natural', pgMax: 136, pgDado: '13d12+52', vel: '15 m', atr: A(25, 10, 19, 2, 12, 9), comp: 3,
      habTxt: 'Percepción +4', sentidos: 'Percepción pasiva 14', ataques: [at('Mordisco', 10, '4d12+7', 'perforante', '3 m', 'Agarrado y apresado (escapar CD 17).'), at('Cola', 10, '3d8+7', 'contundente', '3 m')],
      rasgos: [ra('Multiataque', 'Mordisco y cola contra objetivos distintos.')], fuente: 'SRD 5.1' }
  ];
})();
