# The Field Forge · La Tumba de la Aniquilación

Herramienta de mesa para la campaña: crónica en vivo, personajes y mapas, con una ventana aparte para el proyector. Es un sitio estático (HTML, CSS y JS sin compilación) servido por nginx.

## Servidor

```bash
git pull origin main
docker compose up -d   # sirve ./public en el puerto de compose.yml
```

## Páginas

| Página | Para qué |
|---|---|
| `index.html` · Crónica | Historia continua por sesiones. `N` o “+ Acontecimiento” añade uno; “Guardar y proyectar” lo manda a la pantalla. |
| `personajes.html` | PJ, NPC y enemigos. Forja de NPC al azar, bestiario 5e y balance de encuentros. |
| `mapas.html` | Biblioteca de mapas, encuadre, puntos de interés y capas que se ven en la pantalla. |
| `proyector.html` | Lo que ven los jugadores. Se abre con “Abrir proyector ↗”, se lleva a la segunda pantalla y se pulsa `F`. |

Desde cualquier página, la barra superior cambia lo que muestra el proyector (Portada, Crónica, Mapa, Fichas, Negro · `Alt+1…4`, `Alt+0`).

## Datos

Todo se guarda en el navegador donde se usa (localStorage + IndexedDB para las imágenes). Usa **⋯ → Exportar copia** al terminar cada sesión; **Importar** la restaura en otro equipo.

Las imágenes se suben arrastrándolas, pegándolas o con clic; también por URL.

La página anterior (Prípiat) queda en `archivo/pripiat/`.

Reglas y criaturas basadas en el SRD 5.1 (CC BY 4.0).
