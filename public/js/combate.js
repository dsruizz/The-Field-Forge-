// Apartado de combate: interfaz web sobre el motor Sistema_DND de Dillan.
// Las reglas viven en js/sistema-dnd/ (copia del repositorio original). Este archivo
// solo sustituye la consola (readline-sync) por un flujo paso a paso en el navegador:
// cada tirada se pide al usuario (dado físico) o se lanza con el dado virtual.
import { personajes } from "./sistema-dnd/Datos/Personajes.js";
import { enemigos } from "./sistema-dnd/Datos/Mounstros.js";
import { performAttack, rollDamage, applyDamage, getTurnOrder, executeAttack } from "./sistema-dnd/sistema/combate.js";
import { getModifier } from "./sistema-dnd/sistema/abilities.js";
import { randomRoller, rollDie, rollDice } from "./sistema-dnd/sistema/Dice.js";

const $ = (s) => document.querySelector(s);
const heroSelect = $("#combatHero");
const enemySelect = $("#combatEnemy");
const consoleBody = $("#consoleBody");
const consoleRound = $("#consoleRound");
const log = $("#combatLog");

const ABILITY_LABELS = { str: "FUE", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR" };
const signed = (n) => (n >= 0 ? "+" + n : String(n));
const escape = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Roller que entrega valores ya conocidos (los que escribió el usuario) en el orden
// en que el motor los pide. Mantiene la misma interfaz que randomRoller y createManualRoller.
function fixedRoller(values) {
  const queue = [...values];
  return { d20: () => queue.shift(), dice: () => queue.shift() };
}

let state = null;

function fillSelect(select, catalog) {
  select.innerHTML = Object.entries(catalog)
    .map(([id, c]) => `<option value="${id}">${escape(c.name)}${c.className ? " · " + escape(c.className) : ""}</option>`)
    .join("");
}

function renderFighter(el, c, side) {
  if (!c) { el.innerHTML = ""; return; }
  const pct = Math.round((c.currentHp / c.maxHp) * 100);
  const hpLevel = pct <= 30 ? "low" : pct <= 60 ? "mid" : "";
  const sub = [c.species !== c.name ? c.species : "", c.className, c.level ? "Nivel " + c.level : ""].filter(Boolean).map(escape).join(" · ");
  el.classList.toggle("down", c.currentHp === 0);
  el.innerHTML = `
    <div class="fighter-label">${side === "hero" ? "Personaje" : "Enemigo"}</div>
    <h3>${escape(c.name)}</h3>
    <p class="fighter-sub">${sub}</p>
    <div class="fighter-stats">
      <div><b>${c.armorClass}</b><span>CA</span></div>
      <div><b>${c.currentHp}<small>/${c.maxHp}</small></b><span>PG</span></div>
      <div><b>${signed(c.proficiencyBonus)}</b><span>Competencia</span></div>
    </div>
    <div class="fighter-hp ${hpLevel}" role="progressbar" aria-label="Puntos de golpe de ${escape(c.name)}" aria-valuemin="0" aria-valuemax="${c.maxHp}" aria-valuenow="${c.currentHp}"><span style="width:${pct}%"></span></div>
    <div class="fighter-abilities">${Object.entries(c.abilities)
      .map(([k, v]) => `<div><span>${ABILITY_LABELS[k]}</span><b>${v}</b><small>${signed(getModifier(v))}</small></div>`)
      .join("")}</div>
    <ul class="fighter-weapons">${c.weapons
      .map((w) => `<li><b>${escape(w.name)}</b><span>${w.damageDice.count}d${w.damageDice.sides} ${escape(w.damageType.toLowerCase())} · ${ABILITY_LABELS[w.ability]}</span></li>`)
      .join("")}</ul>`;
}

function renderFighters() {
  const heroe = state?.heroe ?? personajes[heroSelect.value];
  const enemigo = state?.enemigo ?? enemigos[enemySelect.value];
  renderFighter($("#fighterHero"), heroe, "hero");
  renderFighter($("#fighterEnemy"), enemigo, "enemy");
}

function addLog(text, type = "") {
  const li = document.createElement("li");
  if (type) li.className = type;
  li.textContent = text;
  log.appendChild(li);
  log.scrollTop = log.scrollHeight;
}

// Mismo texto que mostrarAtaque() en el Index.js de Sistema_DND.
function logAttack(atacante, objetivo, weapon, attack) {
  addLog(`${atacante.name} ataca con ${weapon.name}: d20 = ${attack.roll} + ${attack.bonus} = ${attack.total} contra CA ${objetivo.armorClass}`);
  if (attack.critical) addLog(`¡Golpe crítico de ${atacante.name}!`, "crit");
  else if (attack.fumble) addLog(`${atacante.name} pifia el ataque.`, "miss");
  else if (attack.hit) addLog(`${atacante.name} impacta.`, "hit");
  else addLog(`${atacante.name} falla el ataque.`, "miss");
}

function logDamage(atacante, objetivo, weapon, damage) {
  addLog(`${atacante.name} hace ${damage} de daño ${weapon.damageType.toLowerCase()} a ${objetivo.name}.`, "hit");
  addLog(`${objetivo.name} tiene ${objetivo.currentHp}/${objetivo.maxHp} PG.`);
  if (objetivo.currentHp === 0) addLog(`${objetivo.name} ha caído.`, "crit");
}

function logRoundEnd() {
  const { heroe, enemigo, ronda } = state;
  addLog(`Fin de la ronda ${ronda}: ${heroe.name} ${heroe.currentHp}/${heroe.maxHp} PG | ${enemigo.name} ${enemigo.currentHp}/${enemigo.maxHp} PG`, "round");
}

function logWinner() {
  const { heroe, enemigo, ronda } = state;
  const texto = ronda === 1 ? "ronda" : "rondas";
  const ganador = heroe.currentHp > 0 ? heroe : enemigo;
  addLog(`${ganador.name} gana el combate en ${ronda} ${texto}.`, "win");
  return ganador;
}

function newCombat() {
  const heroe = structuredClone(personajes[heroSelect.value]);
  const enemigo = structuredClone(enemigos[enemySelect.value]);
  log.innerHTML = "";
  addLog(`${heroe.name}: CA ${heroe.armorClass}, PG ${heroe.currentHp}/${heroe.maxHp}`);
  addLog(`${enemigo.name}: CA ${enemigo.armorClass}, PG ${enemigo.currentHp}/${enemigo.maxHp}`);
  return { heroe, enemigo, orden: null, ronda: 1, idx: 0, initiative: [], step: null, mode: "manual" };
}

// ---- Flujo paso a paso (dado físico) ----

function currentAttacker() {
  const atacante = state.orden[state.idx].combatant;
  return { atacante, objetivo: atacante === state.heroe ? state.enemigo : state.heroe };
}

function nextStep() {
  const { heroe, enemigo } = state;
  if (!state.orden) {
    const c = state.initiative.length === 0 ? heroe : enemigo;
    state.step = { kind: "initiative", min: 1, max: 20, sides: 20, count: 1,
      title: `Iniciativa de ${c.name}`, question: "¿Qué sacaste en el d20? (sin sumar modificadores)",
      hint: `Se suma tu modificador de DES (${signed(getModifier(c.abilities.dex))}).` };
  } else if (heroe.currentHp === 0 || enemigo.currentHp === 0) {
    logRoundEnd();
    const ganador = logWinner();
    state.step = { kind: "end", winner: ganador };
  } else {
    const { atacante, objetivo } = currentAttacker();
    state.step = { kind: "attack", min: 1, max: 20, sides: 20, count: 1, atacante, objetivo,
      title: `${atacante.name} ataca a ${objetivo.name}`,
      question: "¿Qué sacaste en el d20? (sin sumar modificadores)",
      hint: `20 natural es crítico; 1 natural es pifia. CA objetivo: ${objetivo.armorClass}.` };
  }
  renderConsole();
}

function weaponPicker(atacante) {
  // Sistema_DND ataca con weapons[0]; el personaje puede cambiar de arma desde aquí.
  if (atacante !== state.heroe || atacante.weapons.length < 2) return "";
  return `<label class="console-label" for="weaponPick">Arma</label>
    <select id="weaponPick">${atacante.weapons.map((w, i) => `<option value="${i}" ${i === (state.weaponIdx ?? 0) ? "selected" : ""}>${escape(w.name)} (${w.damageDice.count}d${w.damageDice.sides})</option>`).join("")}</select>`;
}

function renderConsole() {
  const s = state.step;
  consoleRound.textContent = state.orden ? `RONDA ${state.ronda}` : "INICIATIVA";
  renderFighters();
  if (s.kind === "end") {
    const quick = state.mode === "quick";
    consoleBody.innerHTML = `<p class="console-result">${escape(s.winner.name)} gana el combate.</p>
      <div class="console-actions"><button class="btn" type="button" id="combatAgain">${quick ? "Otra simulación" : "Revancha"}</button></div>`;
    $("#combatAgain").addEventListener("click", quick ? quickSimulation : startManual);
    $("#combatAgain").focus();
    return;
  }
  consoleBody.innerHTML = `
    <form class="console-form" id="rollForm" novalidate>
      <p class="console-step">${escape(s.title)}</p>
      ${s.kind === "attack" ? weaponPicker(s.atacante) : ""}
      <label class="console-label" for="rollInput">${escape(s.question)}</label>
      <div class="roll-row">
        <input id="rollInput" type="number" inputmode="numeric" min="${s.min}" max="${s.max}" step="1" placeholder="${s.min}–${s.max}" required aria-describedby="rollHint rollError">
        <button class="btn" type="submit">Confirmar</button>
      </div>
      <p class="console-hint" id="rollHint">${escape(s.hint)}</p>
      <p class="console-error" id="rollError" role="alert"></p>
      <button class="btn ghost dice-btn" type="button" id="virtualRoll">🎲 Dado virtual (${s.count}d${s.sides})</button>
    </form>`;
  const input = $("#rollInput");
  $("#rollForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = Number(input.value);
    // Misma validación que pedirNumero() en Consola/dados-manuales.js.
    if (input.value.trim() === "" || !Number.isInteger(valor) || valor < s.min || valor > s.max) {
      $("#rollError").textContent = `Valor no válido: escribe un entero entre ${s.min} y ${s.max}.`;
      input.focus();
      return;
    }
    resolveStep(valor);
  });
  $("#virtualRoll").addEventListener("click", () => {
    input.value = s.sides === 20 && s.count === 1 ? rollDie(20) : rollDice(s.count, s.sides);
    $("#rollError").textContent = "";
  });
  $("#weaponPick")?.addEventListener("change", (e) => { state.weaponIdx = Number(e.target.value); });
  input.focus({ preventScroll: true });
}

function advanceTurn() {
  state.idx++;
  if (state.heroe.currentHp === 0 || state.enemigo.currentHp === 0) return nextStep();
  if (state.idx >= state.orden.length) {
    logRoundEnd();
    state.ronda++;
    state.idx = 0;
    addLog(`--- Ronda ${state.ronda} ---`, "round");
  }
  nextStep();
}

function resolveStep(valor) {
  const s = state.step;
  if (s.kind === "initiative") {
    state.initiative.push(valor);
    if (state.initiative.length === 2) {
      // getTurnOrder pide el d20 de cada combatiente en el orden de la lista.
      state.orden = getTurnOrder([state.heroe, state.enemigo], fixedRoller(state.initiative));
      for (const { combatant, initiative } of state.orden) addLog(`${combatant.name}: iniciativa ${initiative}`);
      addLog(`--- Ronda ${state.ronda} ---`, "round");
    }
    return nextStep();
  }
  if (s.kind === "attack") {
    const weapon = s.atacante === state.heroe ? s.atacante.weapons[state.weaponIdx ?? 0] : s.atacante.weapons[0];
    const attack = performAttack(s.atacante, weapon, s.objetivo, fixedRoller([valor]));
    logAttack(s.atacante, s.objetivo, weapon, attack);
    if (!attack.hit) return advanceTurn();
    const count = attack.critical ? weapon.damageDice.count * 2 : weapon.damageDice.count;
    const sides = weapon.damageDice.sides;
    state.step = { kind: "damage", min: count, max: count * sides, sides, count, weapon, attack,
      atacante: s.atacante, objetivo: s.objetivo,
      title: `${s.atacante.name}: daño de ${weapon.name}${attack.critical ? " (crítico)" : ""}`,
      question: `Suma de ${count}d${sides} (sin sumar modificadores)`,
      hint: `Se suma el modificador de ${ABILITY_LABELS[weapon.ability]} (${signed(getModifier(s.atacante.abilities[weapon.ability]))}).` };
    return renderConsole();
  }
  if (s.kind === "damage") {
    const damage = rollDamage(s.atacante, s.weapon, s.attack.critical, fixedRoller([valor]));
    applyDamage(s.objetivo, damage);
    logDamage(s.atacante, s.objetivo, s.weapon, damage);
    advanceTurn();
  }
}

function startManual() {
  state = newCombat();
  nextStep();
}

// ---- Simulación rápida: mismo bucle que Index.js con randomRoller ----

function quickSimulation() {
  state = newCombat();
  state.mode = "quick";
  const { heroe, enemigo } = state;
  state.orden = getTurnOrder([heroe, enemigo], randomRoller);
  for (const { combatant, initiative } of state.orden) addLog(`${combatant.name}: iniciativa ${initiative}`);
  state.ronda = 1;
  while (heroe.currentHp > 0 && enemigo.currentHp > 0) {
    addLog(`--- Ronda ${state.ronda} ---`, "round");
    for (const { combatant } of state.orden) {
      const objetivo = combatant === heroe ? enemigo : heroe;
      if (combatant.currentHp === 0 || objetivo.currentHp === 0) break;
      const { weapon, attack, damage } = executeAttack(combatant, objetivo, randomRoller);
      logAttack(combatant, objetivo, weapon, attack);
      if (attack.hit) logDamage(combatant, objetivo, weapon, damage);
    }
    if (heroe.currentHp > 0 && enemigo.currentHp > 0) { logRoundEnd(); state.ronda++; }
  }
  nextStep(); // registra fin de ronda y ganador, y muestra el resultado
}

fillSelect(heroSelect, personajes);
fillSelect(enemySelect, enemigos);
heroSelect.addEventListener("change", () => { state = null; renderFighters(); });
enemySelect.addEventListener("change", () => { state = null; renderFighters(); });
$("#combatSetup").addEventListener("submit", (e) => { e.preventDefault(); startManual(); });
$("#combatQuick").addEventListener("click", quickSimulation);
renderFighters();
