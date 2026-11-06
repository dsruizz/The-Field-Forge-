# The Field Forge · La Tumba de la Aniquilación

Herramienta de mesa para la campaña: crónica en vivo, personajes y mapas, con una ventana aparte para el proyector. Es un sitio estático (HTML, CSS y JS sin compilación) servido por nginx.

## Servidor

```bash
git pull origin main
```

nginx monta `./public` como volumen, así que para cambios en la web basta con el pull.

**La primera vez tras añadir la sala de jugadores** hay que levantar el servicio nuevo y recargar nginx:

```bash
git pull origin main
docker compose up -d
```

Eso crea `dnd-api` (Node 22, sin dependencias) y monta `nginx/default.conf`, que envía `/api/` a ese servicio. Las salas se guardan en `./data/` (no va al repo: haz copia de esa carpeta si quieres respaldo). Si cambias algo en `server/`, reinícialo con `docker compose restart api`.

## Páginas

| Página | Para qué |
|---|---|
| `index.html` · Crónica | Historia continua por sesiones. `N` o “+ Acontecimiento” añade uno; “Guardar y proyectar” lo manda a la pantalla. |
| `personajes.html` | PJ, NPC y enemigos. Forja de NPC al azar, bestiario 5e y balance de encuentros. |
| `mapas.html` | Biblioteca de mapas, encuadre, puntos de interés y capas que se ven en la pantalla. |
| `mesa.html` | La mesa del DM: sala, tarjetas de los PJ, peticiones y vista del móvil de cada jugador. |
| `jugar.html` | Lo que ve cada jugador en su móvil: vida, conjuros, espacios, ficha, grupo y notas. Se entra con el QR de la sala. |
| `proyector.html` | Lo que ven los jugadores. Se abre con “Abrir proyector ↗”, se lleva a la segunda pantalla y se pulsa `F`. |

Desde cualquier página, la barra superior cambia lo que muestra el proyector (Portada, Crónica, Mapa, Fichas, Negro · `Alt+1…4`, `Alt+0`).

## Sala de jugadores

En **Mesa** (barra superior) → **Crear sala**. En **Invitar** aparecen el código y un QR que lleva a `jugar.html?sala=CÓDIGO`. Cada PJ tiene su tarjeta: foto (arrastra, pega o haz clic), nivel, vida, recursos y jugador; **Ver su móvil** muestra lo que ve el jugador.

1. Cada jugador escanea el QR y escribe su nombre.
2. En la tarjeta del PJ eliges qué jugador lo lleva. Las fichas de los PJ se envían solas y se actualizan cuando las cambias aquí (subir de nivel, editar ataques…).
3. El jugador pulsa **Pedir lanzar** en un conjuro o poder. Te aparece en su tarjeta de la Mesa (y abajo a la izquierda en las demás páginas): pide la tirada y marca **Acierta** o **Falla**.
4. Si acierta, en su móvil se ilumina **¡Lanzar!**; al pulsarlo se gasta el espacio y ve el efecto. Si falla, no se gasta nada.
5. Los espacios gastados se ven en la tarjeta; un clic en un rombo recarga un espacio, ↻ lo recarga todo. **Descanso corto** recarga pactos de brujo y el arma de aliento; **Descanso largo**, todo y la vida.

Los trucos no gastan nada: se pueden lanzar siempre, con una pequeña recarga visual de un asalto. **Lanzamiento libre** quita el permiso del DM (útil fuera de combate). La vida la ajustas tú desde la Mesa y se ve al instante en su móvil.

La clave de DM (botón **Copiar clave de DM**) permite controlar la misma sala desde otro equipo. Para exigir una clave al crear salas, define `TFF_CLAVE_CREAR` en `compose.yml`.

## Datos

La crónica, los mapas y las fichas completas se guardan en el navegador donde se usa (localStorage + IndexedDB para las imágenes). Usa **⋯ → Exportar copia** al terminar cada sesión; **Importar** la restaura en otro equipo.

Las imágenes se suben arrastrándolas, pegándolas o con clic; también por URL.

La página anterior (Prípiat) queda en `archivo/pripiat/`.

Reglas y criaturas basadas en el SRD 5.1 (CC BY 4.0).
