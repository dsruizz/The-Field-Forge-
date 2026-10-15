// Copiado de Sistema_DND (Dillan, github.com/dillan031/Sistema_DND, commit 0fa1bf5).
// Reglas sin cambios: si se modifican aquí, sincronizar con el repositorio original.
//Se crea en sistema una funcion llamada getModifier que calcula el modificador de habilidad de un personaje.
export function getModifier(score){
    return Math.floor((score - 10) / 2);
}