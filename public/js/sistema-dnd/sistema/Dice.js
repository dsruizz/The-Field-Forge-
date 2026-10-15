// Copiado de Sistema_DND (Dillan, github.com/dillan031/Sistema_DND, commit 0fa1bf5).
// Reglas sin cambios: si se modifican aquí, sincronizar con el repositorio original.
//Se crea en sistema una funcion llamada rollDie que se encarga de simular el lanzaimiento de un dado de 20 caras.
export function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}
// se crea una funcion llamada rollDice esta funcion tiene Count y sides.
//Count es la cantidad de veces que se lanzara el dado y sides la cantidad de caras del dado. 
export function rollDice(count, sides){
    let total= 0;
//Se usa un bucle For para calcular el total de lanzamientos de los dados.
//se llama a la funcion rollDie para obtener el resultado y se suma al total.
//el bucle cumple la funcion de repetir el lanzamiento la cantidad de veces que se indique en count.
    for (let i = 0; i < count; i++) {
        total += rollDie(sides);
    }
//por ultimo se retorna el total de lanzamientos de cada dado.
    return total;
}

//Se crea una funcion que ´permita registrar le puesta de los valores de los dados de forma manual
export const randomRoller = {
    //Se declara la variable motivo que detecta para que es la tirada siendo ignorada por la fuente aleatoria.
    //RollDie representa el dado de 20 caras.
    //d20 representa el metodo manual de asignacion del valor de el dado de 20.
  d20: (motivo) => rollDie(20),
  //dice representa el metodo manual de la asignacion de valor de varios dados y caras.
  //el => rollDice(count,sides) representa la fuente aleatoria.
  dice: (count, sides, motivo) => rollDice(count, sides),
};