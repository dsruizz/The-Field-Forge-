// Copiado de Sistema_DND (Dillan, github.com/dillan031/Sistema_DND, commit 0fa1bf5).
// Reglas sin cambios: si se modifican aquí, sincronizar con el repositorio original.
// se crea personajes.js que define los atributos de cada personaje del equipo.
// Se importa getModifier para calcular los puntos de vida maximos de nivel 1.
import { getModifier } from "../sistema/abilities.js";
 
// Dado de golpe (caras del dado), Constitucion y PG maximos (dado + modificador de Constitucion).
const hitDie = 10;
const con = 11;
//Se calcula el maximo de puntos de vida del personaje con anterioridad.
const maxHp = hitDie + getModifier(con);
 
export const carlos = {
  name: "Carlos",
  level: 1,
  className: "Explorador",
  species: "Tiefling",
  armorClass: 16,
  speed: 9, // metros
  proficiencyBonus: 2,
  hitDie,
  maxHp,
  currentHp: maxHp,
  abilities: {
    str: 16, dex: 17, con, int: 17, wis: 16, cha: 13,
  },
  savingThrowProficiencies: ["str", "dex"],
  weapons: [
    {
      name: "Ballesta ligera",
      type: "Arma a distancia",
      damageDice: { count: 1, sides: 8 },
      damageType: "Perforante",
      ability: "dex",
    },
    {
      name: "Hoz",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 4 },
      damageType: "Cortante",
      ability: "str",
    },
  ],
};

const hitDie1 = 8; 
const con1 = 13;
const maxHp1 = hitDie1 + getModifier(con1);
 
export const krouds = {
  name: "Krouds Norixius",
  level: 1,
  className: "Picaro",
  species: "Draconico",
  armorClass: 13,
  speed: 9, // metros
  proficiencyBonus: 2,
  hitDie: hitDie1,
  maxHp: maxHp1,
  currentHp: maxHp1,
  abilities: {
    str: 15, dex: 14, con: con1, int: 14, wis: 11, cha: 8,
  },
  savingThrowProficiencies: ["dex", "int"],
  weapons: [
    {
      name: "Daga",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 4 },
      damageType: "Perforante",
      ability: "dex",
    },
    {
      name: "Espada corta",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 6 },
      damageType: "Perforante",
      ability: "str",
    },
    {
      name: "Arco",
      type: "Arma a distancia",
      damageDice: { count: 1, sides: 6 },
      damageType: "Perforante",
      ability: "dex",
    },
  ],
};
 
const hitDie2 = 8; 
const con2 = 17;
const maxHp2 = hitDie2 + getModifier(con2);
 
export const mirrir = {
  name: "Mirrir Hol",
  level: 1,
  className: "Brujo",
  species: "Semiorco",
  armorClass: 12,
  speed: 9, // metros
  proficiencyBonus: 2,
  hitDie: hitDie2,
  maxHp: maxHp2,
  currentHp: maxHp2,
  abilities: {
    str: 15, dex: 12, con: con2, int: 15, wis: 14, cha: 16,
  },
  savingThrowProficiencies: ["wis", "cha"],
  weapons: [
    {
      name: "Ballesta ligera",
      type: "Arma a distancia",
      damageDice: { count: 1, sides: 8 },
      damageType: "Perforante",
      ability: "dex",
    },
    {
      name: "Baston",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 6 },
      damageType: "Contundente",
      ability: "str",
    },
    {
      name: "Daga",
      type: "Arma cuerpo a cuerpo",
      damageDice: { count: 1, sides: 4 },
      damageType: "Perforante",
      ability: "dex",
    },
  ],
};

//Creación de una especie de catalogo personajes.
export const personajes = {carlos,krouds,mirrir};