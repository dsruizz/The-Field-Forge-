/* The Field Forge — servidor de salas.
   Node 22 sin dependencias. Guarda cada sala en un JSON dentro de DATA_DIR y avisa
   de los cambios en tiempo real con Server-Sent Events (SSE).

   Roles:
   - DM: crea la sala y recibe un token secreto. Sube las fichas de los PJ, asigna
     personajes, resuelve las peticiones de lanzar y marca los descansos.
   - Jugador: entra con el código de sala y su nombre. Ve solo su PJ, ajusta su vida,
     escribe notas, pide lanzar y lanza cuando el DM lo permite. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SALAS_DIR = path.join(DATA_DIR, 'salas');
const IMG_DIR = path.join(DATA_DIR, 'img');
const CLAVE_CREAR = process.env.TFF_CLAVE_CREAR || ''; // si existe, hace falta para crear salas
const MAX_SALAS = 50;
const MAX_BODY = 3 * 1024 * 1024;

fs.mkdirSync(SALAS_DIR, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });

/* ---------- utilidades ---------- */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
const codigoNuevo = () => Array.from(crypto.randomBytes(6), b => ALFABETO[b % ALFABETO.length]).join('');
const token = () => crypto.randomBytes(24).toString('base64url');
const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const igual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const uid = p => p + '_' + crypto.randomBytes(5).toString('hex');
const texto = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const entero = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null; };

class Fallo extends Error { constructor(status, msg) { super(msg); this.status = status; } }

/* ---------- almacenamiento ---------- */
const salas = new Map();
const pendientes = new Map();

function cargarSalas() {
  for (const f of fs.readdirSync(SALAS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try { const s = JSON.parse(fs.readFileSync(path.join(SALAS_DIR, f), 'utf8')); salas.set(s.codigo, s); }
    catch (e) { console.error('No se pudo leer', f, e.message); }
  }
  console.log(`${salas.size} sala(s) cargada(s)`);
}

// Escritura atómica y agrupada: como mucho una vez cada 400 ms por sala.
function guardar(s) {
  if (pendientes.has(s.codigo)) return;
  pendientes.set(s.codigo, setTimeout(async () => {
    pendientes.delete(s.codigo);
    const destino = path.join(SALAS_DIR, s.codigo + '.json');
    const tmp = destino + '.tmp';
    try { await fsp.writeFile(tmp, JSON.stringify(s)); await fsp.rename(tmp, destino); }
    catch (e) { console.error('No se pudo guardar', s.codigo, e.message); }
  }, 400));
}

/* ---------- tiempo real (SSE) ---------- */
const clientes = new Map(); // codigo -> Set<{res, rol, jugadorId}>

function vistaDM(s) {
  const conectados = conectadosDe(s.codigo);
  return {
    sala: { codigo: s.codigo, nombre: s.nombre, libre: !!s.libre, creada: s.creada },
    jugadores: s.jugadores.map(j => ({ id: j.id, nombre: j.nombre, pjId: j.pjId, notas: j.notas, conectado: conectados.has(j.id) })),
    fichas: s.fichas,
    solicitudes: s.solicitudes.filter(x => x.estado === 'pendiente' || x.estado === 'permitida'),
    registro: s.registro.slice(-30)
  };
}
function vistaJugador(s, jugadorId) {
  const j = s.jugadores.find(x => x.id === jugadorId);
  if (!j) return null;
  const grupo = s.jugadores.filter(x => x.pjId && s.fichas[x.pjId]).map(x => {
    const f = s.fichas[x.pjId];
    return { jugador: x.nombre, pjId: x.pjId, nombre: f.nombre, img: f.img || '', pg: f.pg, pgMax: f.pgMax, yo: x.id === j.id };
  });
  return {
    sala: { codigo: s.codigo, nombre: s.nombre, libre: !!s.libre },
    yo: { id: j.id, nombre: j.nombre, notas: j.notas, pjId: j.pjId },
    pj: j.pjId ? s.fichas[j.pjId] || null : null,
    solicitudes: s.solicitudes.filter(x => x.jugadorId === j.id && (x.estado === 'pendiente' || x.estado === 'permitida' || Date.now() - x.t < 15000)),
    grupo
  };
}
function conectadosDe(codigo) {
  const set = new Set();
  (clientes.get(codigo) || new Set()).forEach(c => { if (c.jugadorId) set.add(c.jugadorId); });
  return set;
}
function enviar(res, evento, datos) { res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`); }

function difundir(s, extra) {
  const set = clientes.get(s.codigo); if (!set) return;
  for (const c of set) {
    try {
      if (c.rol === 'dm') enviar(c.res, 'estado', vistaDM(s));
      else { const v = vistaJugador(s, c.jugadorId); if (v) enviar(c.res, 'estado', v); else { enviar(c.res, 'fuera', {}); c.res.end(); } }
      if (extra) enviar(c.res, extra.evento, extra.datos);
    } catch (e) { /* conexión cerrada */ }
  }
}
function cambio(s, extra) { s.t = Date.now(); guardar(s); difundir(s, extra); }
function anotar(s, txt) { s.registro.push({ t: Date.now(), texto: txt }); if (s.registro.length > 200) s.registro.splice(0, s.registro.length - 200); }

// Latido para que proxies y móviles no corten la conexión.
setInterval(() => { clientes.forEach(set => set.forEach(c => { try { c.res.write(': latido\n\n'); } catch (e) {} })); }, 20000);

/* ---------- autenticación ---------- */
function bearer(req, url) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return url.searchParams.get('token') || '';
}
function sala(codigo) {
  const s = salas.get(String(codigo || '').toUpperCase());
  if (!s) throw new Fallo(404, 'No existe una sala con ese código.');
  return s;
}
function comoDM(s, t) { if (!t || !igual(hash(t), s.dmHash)) throw new Fallo(401, 'Solo el DM puede hacer esto.'); }
function comoJugador(s, t) {
  const h = hash(t || '');
  const j = s.jugadores.find(x => igual(h, x.tokenHash));
  if (!j) throw new Fallo(401, 'Tu sesión ya no es válida. Vuelve a entrar con tu nombre.');
  return j;
}

/* ---------- reglas de juego ---------- */
const CAMPOS_FICHA = ['nombre', 'img', 'raza', 'clase', 'subclase', 'nivel', 'ca', 'pg', 'pgMax', 'pgTemp', 'vel', 'iniciativa', 'comp', 'atr', 'ataques', 'rasgos', 'conj', 'usados', 'poderes', 'percepcionPasiva', 'estado'];

function aplicarFicha(s, id, datos) {
  const f = s.fichas[id] || (s.fichas[id] = { id, usos: {} });
  for (const k of CAMPOS_FICHA) if (k in datos) f[k] = datos[k];
  if (typeof f.nombre === 'string') f.nombre = texto(f.nombre, 80);
  f.pgMax = entero(f.pgMax, 1, 999) || 1;
  f.pg = entero(f.pg, 0, f.pgMax) ?? f.pgMax;
  f.pgTemp = entero(f.pgTemp, 0, 999) || 0;
  f.usados = f.usados && typeof f.usados === 'object' ? f.usados : {};
  f.usos = f.usos || {};
  return f;
}

// Elige el espacio más bajo disponible que sea >= nivel. Devuelve la clave o null.
function espacioLibre(f, nivel) {
  const esp = (f.conj && f.conj.espacios) || {};
  const claves = Object.keys(esp).map(Number).filter(k => k >= nivel).sort((a, b) => a - b);
  return claves.find(k => (f.usados[k] || 0) < esp[k]) ?? null;
}

function gastar(s, f, sol) {
  if (sol.tipo === 'conjuro' && sol.nivel > 0) {
    const k = espacioLibre(f, sol.nivel);
    if (k == null) throw new Fallo(409, 'No te quedan espacios de conjuro de ese nivel.');
    f.usados[k] = (f.usados[k] || 0) + 1;
    sol.espacio = k;
  }
  if (sol.tipo === 'poder') {
    const p = (f.poderes || []).find(x => x.n === sol.nombre);
    if (!p) throw new Fallo(404, 'Ese poder no está en tu ficha.');
    const u = f.usos[p.n] || 0;
    if (u >= (p.max || 1)) throw new Fallo(409, 'Ya lo usaste. Se recarga con un descanso.');
    f.usos[p.n] = u + 1;
  }
}

function descanso(s, tipo, pjIds) {
  for (const id of pjIds) {
    const f = s.fichas[id]; if (!f) continue;
    const pacto = f.conj && f.conj.pacto;
    if (tipo === 'largo') { f.usados = {}; f.usos = {}; f.pg = f.pgMax; f.pgTemp = 0; }
    else {
      if (pacto) f.usados = {};
      (f.poderes || []).forEach(p => { if (p.recarga === 'corto') delete f.usos[p.n]; });
    }
  }
}

/* ---------- acciones ---------- */
function accionDM(s, b) {
  switch (b.accion) {
    case 'fichas': {
      const lista = Array.isArray(b.fichas) ? b.fichas.slice(0, 20) : [];
      lista.forEach(x => { if (x && typeof x.id === 'string') aplicarFicha(s, texto(x.id, 60), x); });
      if (Array.isArray(b.quitar)) b.quitar.forEach(id => { delete s.fichas[id]; s.jugadores.forEach(j => { if (j.pjId === id) j.pjId = null; }); });
      return;
    }
    case 'asignar': {
      const j = s.jugadores.find(x => x.id === b.jugadorId); if (!j) throw new Fallo(404, 'Ese jugador ya no está.');
      const pjId = b.pjId ? String(b.pjId) : null;
      if (pjId && !s.fichas[pjId]) throw new Fallo(404, 'Esa ficha no está en la sala.');
      j.pjId = pjId;
      anotar(s, pjId ? `${j.nombre} juega con ${s.fichas[pjId].nombre}.` : `${j.nombre} queda sin personaje.`);
      return;
    }
    case 'expulsar': { s.jugadores = s.jugadores.filter(x => x.id !== b.jugadorId); return; }
    case 'resolver': {
      const sol = s.solicitudes.find(x => x.id === b.solicitudId && x.estado === 'pendiente');
      if (!sol) throw new Fallo(404, 'Esa petición ya no está pendiente.');
      sol.estado = b.ok ? 'permitida' : 'fallida'; sol.t = Date.now();
      const f = s.fichas[sol.pjId];
      anotar(s, `${f ? f.nombre : '?'}: ${sol.nombre} ${b.ok ? 'acierta' : 'falla'}.`);
      return { evento: 'resuelta', datos: { id: sol.id, jugadorId: sol.jugadorId, ok: !!b.ok, nombre: sol.nombre } };
    }
    case 'descanso': {
      const tipo = b.tipo === 'largo' ? 'largo' : 'corto';
      descanso(s, tipo, Array.isArray(b.pjIds) ? b.pjIds : Object.keys(s.fichas));
      anotar(s, tipo === 'largo' ? 'Descanso largo.' : 'Descanso corto.');
      return { evento: 'descanso', datos: { tipo } };
    }
    case 'recargar': {
      // Recarga manual del DM: todos los espacios y poderes de un PJ, o un nivel concreto.
      const f = s.fichas[b.pjId]; if (!f) throw new Fallo(404, 'Esa ficha no está en la sala.');
      const nivel = entero(b.nivel, 1, 9);
      if (nivel) { if (f.usados[nivel]) f.usados[nivel]--; }
      else if (b.poder) delete f.usos[texto(b.poder, 80)];
      else { f.usados = {}; f.usos = {}; }
      anotar(s, `${f.nombre}: recarga${nivel ? ` un espacio de nivel ${nivel}` : b.poder ? ` ${texto(b.poder, 80)}` : ' completa'}.`);
      return { evento: 'recarga', datos: { pjId: f.id } };
    }
    case 'libre': { s.libre = !!b.valor; anotar(s, s.libre ? 'Lanzamiento libre activado.' : 'Lanzamiento con permiso del DM.'); return; }
    case 'nombre': { s.nombre = texto(b.nombre, 80) || s.nombre; return; }
    default: throw new Fallo(400, 'Acción desconocida.');
  }
}

function accionJugador(s, j, b) {
  const f = j.pjId ? s.fichas[j.pjId] : null;
  const necesitaPJ = () => { if (!f) throw new Fallo(409, 'El DM todavía no te ha asignado personaje.'); };
  switch (b.accion) {
    case 'notas': { j.notas = String(b.texto ?? '').slice(0, 20000); return { soloGuardar: true }; }
    case 'pg': {
      necesitaPJ();
      if (b.delta != null) { const d = entero(b.delta, -999, 999) || 0; if (d < 0 && f.pgTemp) { const a = Math.min(f.pgTemp, -d); f.pgTemp -= a; f.pg = Math.max(0, f.pg + d + a); } else f.pg = Math.max(0, Math.min(f.pgMax, f.pg + d)); }
      if (b.valor != null) f.pg = entero(b.valor, 0, f.pgMax) ?? f.pg;
      if (b.temp != null) f.pgTemp = entero(b.temp, 0, 999) || 0;
      return;
    }
    case 'solicitar': {
      necesitaPJ();
      const tipo = b.tipo === 'poder' ? 'poder' : 'conjuro';
      const nombre = texto(b.nombre, 80); if (!nombre) throw new Fallo(400, 'Falta el nombre.');
      const nivel = tipo === 'conjuro' ? entero(b.nivel, 0, 9) || 0 : 0;
      if (tipo === 'conjuro') {
        const c = f.conj || {};
        const conoce = (c.trucos || []).includes(nombre) || (c.lista || []).includes(nombre);
        if (!conoce) throw new Fallo(404, 'Ese conjuro no está en tu ficha.');
        if (nivel > 0 && espacioLibre(f, nivel) == null) throw new Fallo(409, 'No te quedan espacios de conjuro de ese nivel.');
      }
      if (tipo === 'poder') {
        const p = (f.poderes || []).find(x => x.n === nombre);
        if (!p) throw new Fallo(404, 'Ese poder no está en tu ficha.');
        if ((f.usos[p.n] || 0) >= (p.max || 1)) throw new Fallo(409, 'Ya lo usaste. Se recarga con un descanso.');
      }
      // Una petición abierta por jugador: la nueva sustituye a la anterior.
      s.solicitudes.forEach(x => { if (x.jugadorId === j.id && (x.estado === 'pendiente' || x.estado === 'permitida')) x.estado = 'cancelada'; });
      const sol = { id: uid('sol'), jugadorId: j.id, pjId: f.id, tipo, nombre, nivel, tema: texto(b.tema, 20), estado: s.libre ? 'permitida' : 'pendiente', t: Date.now() };
      s.solicitudes.push(sol);
      if (s.solicitudes.length > 100) s.solicitudes.splice(0, s.solicitudes.length - 100);
      return s.libre ? null : { evento: 'solicitud', datos: { id: sol.id, pj: f.nombre, nombre, nivel } };
    }
    case 'cancelar': {
      s.solicitudes.forEach(x => { if (x.jugadorId === j.id && (x.estado === 'pendiente' || x.estado === 'permitida')) x.estado = 'cancelada'; });
      return;
    }
    case 'lanzar': {
      necesitaPJ();
      const sol = s.solicitudes.find(x => x.id === b.solicitudId && x.jugadorId === j.id);
      if (!sol || sol.estado !== 'permitida') throw new Fallo(409, 'El DM todavía no ha desbloqueado este poder.');
      gastar(s, f, sol);
      sol.estado = 'lanzada'; sol.t = Date.now();
      anotar(s, `${f.nombre} lanza ${sol.nombre}${sol.espacio ? ` (espacio de nivel ${sol.espacio})` : ''}.`);
      return { evento: 'efecto', datos: { pjId: f.id, pj: f.nombre, nombre: sol.nombre, tema: sol.tema, nivel: sol.espacio || sol.nivel, t: Date.now() } };
    }
    default: throw new Fallo(400, 'Acción desconocida.');
  }
}

/* ---------- HTTP ---------- */
function leerCuerpo(req) {
  return new Promise((res, rej) => {
    let n = 0; const partes = [];
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { rej(new Fallo(413, 'Demasiado grande.')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { res(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch (e) { rej(new Fallo(400, 'JSON no válido.')); } });
    req.on('error', rej);
  });
}
function json(res, status, datos) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(datos));
}

// Límite sencillo por IP para entrar y crear salas.
const intentos = new Map();
function limitar(req, clave, max) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = clave + ':' + ip, ahora = Date.now();
  const lista = (intentos.get(k) || []).filter(t => ahora - t < 60000);
  if (lista.length >= max) throw new Fallo(429, 'Demasiados intentos. Espera un minuto.');
  lista.push(ahora); intentos.set(k, lista);
}

async function rutas(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean);
  const m = req.method;

  if (m === 'GET' && p[0] === 'salud') return json(res, 200, { ok: true, salas: salas.size });

  // Imágenes subidas por el DM (retratos).
  if (m === 'GET' && p[0] === 'img' && p[1]) {
    const nombre = path.basename(p[1]);
    if (!/^[a-f0-9]{32}\.(webp|png|jpe?g)$/.test(nombre)) throw new Fallo(404, 'No encontrada.');
    const archivo = path.join(IMG_DIR, nombre);
    if (!fs.existsSync(archivo)) throw new Fallo(404, 'No encontrada.');
    const tipo = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[nombre.split('.').pop()];
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=31536000, immutable' });
    return fs.createReadStream(archivo).pipe(res);
  }

  if (p[0] !== 'salas') throw new Fallo(404, 'Ruta desconocida.');

  // Crear sala.
  if (m === 'POST' && p.length === 1) {
    limitar(req, 'crear', 5);
    const b = await leerCuerpo(req);
    if (CLAVE_CREAR && !igual(hash(b.clave || ''), hash(CLAVE_CREAR))) throw new Fallo(401, 'Clave de creación incorrecta.');
    if (salas.size >= MAX_SALAS) throw new Fallo(507, 'Se alcanzó el máximo de salas en este servidor.');
    let codigo; do { codigo = codigoNuevo(); } while (salas.has(codigo));
    const dm = token();
    const s = { codigo, nombre: texto(b.nombre, 80) || 'Campaña sin nombre', dmHash: hash(dm), creada: Date.now(), t: Date.now(), libre: false, jugadores: [], fichas: {}, solicitudes: [], registro: [] };
    anotar(s, 'Sala creada.');
    salas.set(codigo, s); guardar(s);
    return json(res, 201, { codigo, dmToken: dm, nombre: s.nombre });
  }

  const s = sala(p[1]);
  const t = bearer(req, url);

  if (m === 'GET' && p.length === 2) return json(res, 200, { codigo: s.codigo, nombre: s.nombre });

  if (m === 'POST' && p[2] === 'unirse') {
    limitar(req, 'unirse', 12);
    const b = await leerCuerpo(req);
    const nombre = texto(b.nombre, 40);
    if (!nombre) throw new Fallo(400, 'Escribe tu nombre.');
    const tk = token();
    // Si ya existe alguien con ese nombre, se le da una sesión nueva (cambio de teléfono, caché borrada…).
    let j = s.jugadores.find(x => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (j) j.tokenHash = hash(tk);
    else {
      if (s.jugadores.length >= 12) throw new Fallo(409, 'La sala está llena.');
      j = { id: uid('jug'), nombre, tokenHash: hash(tk), pjId: null, notas: '' };
      s.jugadores.push(j);
      anotar(s, `${nombre} entra en la sala.`);
    }
    cambio(s);
    return json(res, 200, { jugadorId: j.id, token: tk, nombre: j.nombre, sala: { codigo: s.codigo, nombre: s.nombre } });
  }

  if (m === 'GET' && p[2] === 'stream') {
    let cliente;
    if (url.searchParams.get('rol') === 'dm') { comoDM(s, t); cliente = { rol: 'dm' }; }
    else { const j = comoJugador(s, t); cliente = { rol: 'jugador', jugadorId: j.id }; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    cliente.res = res;
    if (!clientes.has(s.codigo)) clientes.set(s.codigo, new Set());
    clientes.get(s.codigo).add(cliente);
    req.on('close', () => { clientes.get(s.codigo)?.delete(cliente); if (cliente.jugadorId) difundir(s); });
    if (cliente.jugadorId) difundir(s); // avisa al DM de la conexión y envía el estado a todos
    else enviar(res, 'estado', vistaDM(s));
    return;
  }

  if (m === 'POST' && p[2] === 'dm') {
    comoDM(s, t);
    const b = await leerCuerpo(req);
    const extra = accionDM(s, b);
    cambio(s, extra);
    return json(res, 200, { ok: true });
  }

  if (m === 'POST' && p[2] === 'imagen') {
    comoDM(s, t);
    const b = await leerCuerpo(req);
    const mm = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || '');
    if (!mm) throw new Fallo(400, 'Imagen no válida (webp, png o jpeg).');
    const buf = Buffer.from(mm[2], 'base64');
    const nombre = crypto.createHash('md5').update(buf).digest('hex') + '.' + (mm[1] === 'jpeg' ? 'jpg' : mm[1]);
    await fsp.writeFile(path.join(IMG_DIR, nombre), buf);
    return json(res, 200, { url: '/api/img/' + nombre });
  }

  if (m === 'POST' && p[2] === 'jugador') {
    const j = comoJugador(s, t);
    const b = await leerCuerpo(req);
    const extra = accionJugador(s, j, b);
    if (extra && extra.soloGuardar) { guardar(s); return json(res, 200, { ok: true }); }
    cambio(s, extra);
    return json(res, 200, { ok: true });
  }

  throw new Fallo(404, 'Ruta desconocida.');
}

const servidor = http.createServer(async (req, res) => {
  try { await rutas(req, res); }
  catch (e) {
    if (!(e instanceof Fallo)) console.error(e);
    if (!res.headersSent) json(res, e.status || 500, { error: e instanceof Fallo ? e.message : 'Error del servidor.' });
    else res.end();
  }
});

cargarSalas();
servidor.listen(PORT, () => console.log(`The Field Forge · salas en :${PORT} · datos en ${DATA_DIR}`));

// Al apagar, escribe lo pendiente.
function apagar() {
  for (const [codigo, timer] of pendientes) { clearTimeout(timer); const s = salas.get(codigo); if (s) fs.writeFileSync(path.join(SALAS_DIR, codigo + '.json'), JSON.stringify(s)); }
  process.exit(0);
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
