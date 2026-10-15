// Copiado de Sistema_DND (Dillan, github.com/dillan031/Sistema_DND, commit 0fa1bf5).
// Reglas sin cambios: si se modifican aquí, sincronizar con el repositorio original.
//Se crea un apartado de combate en sistema que permite definir los atributos de el sistema de combate.
//Se importa el bonificador de atributo de armas y el bonificador de competencia.
import { getModifier } from "./abilities.js";

//Se crea en sistema una funcion llamada GetAttackBonus que se encarga de calcular el bonificador de ataque.
export function getAttackBonus(attacker, weapon) {
//Se define un puntaje que toma en cuenta el atacante y el arma que este utilizando. 
  const score = attacker.abilities[weapon.ability];  // paso 1: 17
  const modifier = getModifier(score);               // paso 2: 3
//Se hace el calculo completo de el puntaje de bonificador de ataque mas el bonificador de competencia.
  return modifier + attacker.proficiencyBonus;       // paso 3: 3 + 2 = 5
}

//Se crea en sistema una funcion llamada resolveAttack, que se encarga de calcular si el ataque acierta.
export function resolveAttack(roll, bonus, armorClass){
    //se define un total que toma el resultado del dado mas el bonificador de ataque.
    const total = roll + bonus;
    //Se define que es un ataque critico.
    const critical = roll === 20;
    //Se define que es es una pifia(Fallo critico.).
    const fumble = roll === 1;
    //Se desarrolla un ciclo ifelse que define que es un hit y que no lo es
    let hit;
    //si hay critico el hit impacta
    if (critical) {
        hit = true
    //si hay pifia el hit no impacta y es fallo critico
    } else if (fumble){
        hit = false
    //si no es ninguna de las dos se compara el hit con la clase de armadura del contrincante.
    } else {
        hit = total >= armorClass
    }
    //Se retornan las variables principales al ciclo ifelse
    return {total,critical,fumble,hit}
}

//Se importa la funcion rollDice que simula varios dados y de varias caras
import {randomRoller} from "./Dice.js";

//Se crea en sistema una funcion llamada performAttack que se encarga de simular un ataque de principio a fin.
export function performAttack(attacker, weapon, target, roller = randomRoller) {
//Roll se define como una tirada de un dado de 20
  const roll = roller.d20(`${attacker.name} ataca con ${weapon.name}`);
//Bonus se define como el bonificador de ataque que tiene el atacante mas su arma. 
  const bonus = getAttackBonus(attacker, weapon);
//result es el calculo de el dado mas el bonus en comparacion con la clase de armadura.
  const result = resolveAttack(roll, bonus, target.armorClass);
  return { roll, bonus, ...result };
}



//Se crea la funcion rollDamage que simula cuanto daño se hace cuando se impacta
export function rollDamage(attacker, weapon, critical, roller = randomRoller) {
//baseCount es el daño base que tiene un arma segun los dados de esta.
  const baseCount = weapon.damageDice.count;
//count es la suma entre el daño base y su aumento al doble si existe un critico. 
  const count = critical ? baseCount * 2 : baseCount;
//modifier es la suma que se obtiene de las habilidades del personaje y sus armas.
  const modifier = getModifier(attacker.abilities[weapon.ability]);
  //Se trae motivo para tener en cuenta el valor del dado en el modo manual
  const motivo = `${attacker.name}: daño de ${weapon.name}${critical ? " (crítico)" : ""}`;
  return roller.dice(count, weapon.damageDice.sides, motivo) + modifier;
}

//Se crea la funcion applyDamage que se encarga de guardar el daño aplicado en cada turno.
export function applyDamage(target, damage) {
  //Se restan los puntos de vida actuales del objetivo mas el daño ocasionado.
  const remaining = target.currentHp - damage;
  //Se garantiza que el objetivo no tenga puntos de vida negativos, y si es el caso se mantiene
  //un resultado de 0 en el sistema, evitando contradicciones.
  target.currentHp = Math.max(0, remaining);
}

//Se crea la funcion executeAttack, que le permite a los dos bandos ejecutar ataques.
export function executeAttack(attacker, target, roller = randomRoller) {
  //Se usa la variable weapon para determinar el arma del atacante.
  const weapon = attacker.weapons[0];
  //Se usa la variable attack para referirse a los principales medios de un ataque.
  const attack = performAttack(attacker, weapon, target, roller);
  //se inicia con un daño de 0 que cambia segun el ataque.
  let damage = 0;

  //Ciclo if que simula un ataque exitoso
  if (attack.hit) {
  //el daño se define como el resultado de la tirada de daño,  tomando en cuenta el atacante, el arma.
  //y el bonificador de ataque critico.
  damage = rollDamage(attacker, weapon, attack.critical, roller);
  //Se usa applyDamage para aplicar el daño en el objetivo dependiendo de la variable damage.
  applyDamage(target, damage);
}
  return { weapon, attack, damage };
}

//Se crea la funcion rollInitiative, que define que combatiente toma la iniciativa para atacar primero.
export function rollInitiative(creature, roller = randomRoller) {
  //Se define el modificador que marca la iniciativa del combate.
  const modifier = getModifier(creature.abilities.dex);
  //se suma el puntaje de el dado de 20 caras con el modificador de habilidad.
  return roller.d20(`Iniciativa de ${creature.name}`) + modifier;
}

//Se crea la funcion getTurnOrder que define el turno de los combatientes.
export function getTurnOrder(combatants, roller = randomRoller){
  //Se define la variable withInitiative que toma los combatientes y los pone en una tabla.
  const withInitiative = combatants.map((c) => ({
    //Combatant significa combatiente. 
    combatant: c,
    //Initiative es igual al rollInitiative de combatant.
    initiative: rollInitiative(c, roller),
  }));
//Se organizan los resultados de la iniciativa del sujeto a y del sujeto b.
  withInitiative.sort((a, b) =>
    //Se define un calculo en caso de que sea empate el lanzamiento de dados
  b.initiative - a.initiative ||
  //Se suman las habilidades de destreza en este caso.
  b.combatant.abilities.dex - a.combatant.abilities.dex
);
  return withInitiative;
}