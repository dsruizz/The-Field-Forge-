// Copiado de Sistema_DND (Dillan, github.com/dillan031/Sistema_DND, commit 0fa1bf5).
// Reglas sin cambios: si se modifican aquí, sincronizar con el repositorio original.
// Se crea Mounstros.js que define los atributos de cada mounstro del sistema.
export const goblin = {
  name: "Goblin",
  id: "goblin",
  species: "Goblin",
  armorClass: 15,
  proficiencyBonus: 2,
  maxHp: 7,
  currentHp: 7,
  abilities: {
    str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
  },
  weapons: [
    {
      name: "Cimitarra",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 6 },
      damageType: "Cortante",
      ability: "dex",
    },
  ],
};
 
export const esqueleto = {
  name: "Esqueleto",
  id: "esqueleto",
  species: "Esqueleto",
  armorClass: 13,
  proficiencyBonus: 2,
  maxHp: 13,
  currentHp: 13,
  abilities: {
    str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5,
  },
  weapons: [
    {
      name: "Espada Corta",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 6 },
      damageType: "Perforante",
      ability: "dex",
    },
  ],
};
 
export const lobo = {
  name: "Lobo",
  id: "lobo",
  species: "Lobo",
  armorClass: 13,
  proficiencyBonus: 2,
  maxHp: 11,
  currentHp: 11,
  abilities: {
    str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6,
  },
  weapons: [
    {
      name: "Mordisco",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 2, sides: 4 },
      damageType: "Perforante",
      ability: "dex",
    },
  ],
};
 
export const orco = {
  name: "Orco",
  id: "orco",
  species: "Orco",
  armorClass: 13,
  proficiencyBonus: 2,
  maxHp: 15,
  currentHp: 15,
  abilities: {
    str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10,
  },
  weapons: [
    {
      name: "Hacha a dos manos",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 12 },
      damageType: "Cortante",
      ability: "str",
    },
  ],
};
 

//Creación de una especie de catalogo de mounstros.
export const enemigos = {goblin, esqueleto, lobo, orco};