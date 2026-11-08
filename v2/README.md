# The Field Forge v2

Versión nueva, en paralelo a la herramienta de la Tumba. Se sirve en `/v2/` desde el servicio `forja` (Node 22, sin dependencias, SQLite en `./data-v2/forge.db`).

## Qué incluye (paso 1)

- Landing, entrar y crear cuenta (máx. 3 usuarios, código de invitación, captcha propio sin servicios externos, límite de intentos).
- Mis campañas: crear (quien la crea es el DM), unirse con código y contraseña, vista previa.
- Permisos comprobados en el servidor: solo el DM edita la campaña y ve el código de invitación.
- Sistema visual nuevo: Poppins + UnifrakturCook (alojadas en `public/fuentes`), modo claro y oscuro.

## Desplegar

```bash
git pull origin v2
docker compose up -d          # crea dnd-forja y recarga nginx con /v2/
docker compose logs forja     # muestra el código de invitación
```

## Consola

```bash
docker compose exec forja node server.js invitacion            # ver el código
docker compose exec forja node server.js invitacion FORJA-NUEVO # cambiarlo
docker compose exec forja node server.js clave USUARIO NUEVA    # restablecer una contraseña
```

Copia de seguridad: copia la carpeta `data-v2/`.
