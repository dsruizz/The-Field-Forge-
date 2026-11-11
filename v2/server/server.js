/* The Field Forge v2 · servidor
   Node 22 sin dependencias: sirve la web de /public y la API en /api.
   Datos en SQLite (node:sqlite), un solo archivo en DATA_DIR/forge.db.

   Uso por consola (dentro del contenedor):
     node server.js invitacion           → muestra el código de invitación
     node server.js invitacion NUEVO     → lo cambia
     node server.js clave USUARIO NUEVA  → restablece una contraseña */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3100);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');
const BASE = (process.env.TFF_BASE || '/').replace(/\/?$/, '/'); // ruta pública, p. ej. /v2/
const MAX_USUARIOS = Number(process.env.TFF_MAX_USUARIOS || 10);
const DURACION_SESION = 30 * 24 * 3600 * 1000; // 30 días

/* ---------- Base de datos ---------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'forge.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
    correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    hash TEXT NOT NULL,
    creado INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS campanas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    ambientacion TEXT NOT NULL DEFAULT '',
    sinopsis TEXT NOT NULL DEFAULT '',
    codigo TEXT NOT NULL UNIQUE,
    clave_hash TEXT NOT NULL,
    dueno_id INTEGER NOT NULL REFERENCES usuarios(id),
    creada INTEGER NOT NULL,
    actualizada INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS membresias (
    campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('dm', 'jugador')),
    unido INTEGER NOT NULL,
    PRIMARY KEY (campana_id, usuario_id)
  );
  CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY,
    campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    titulo TEXT NOT NULL DEFAULT '',
    fecha INTEGER,
    UNIQUE (campana_id, numero)
  );
  CREATE TABLE IF NOT EXISTS personajes (
    id TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    datos TEXT NOT NULL,
    creado INTEGER NOT NULL,
    actualizado INTEGER NOT NULL
  );
`);
// Columnas añadidas después: el contenido de la campaña (crónica, personajes, hilos, mapas) como un documento JSON.
const columnas = db.prepare('PRAGMA table_info(campanas)').all().map(c => c.name);
if (!columnas.includes('datos')) db.exec("ALTER TABLE campanas ADD COLUMN datos TEXT NOT NULL DEFAULT '{}'");
if (!columnas.includes('rev')) db.exec('ALTER TABLE campanas ADD COLUMN rev INTEGER NOT NULL DEFAULT 0');
const IMG_DIR = path.join(DATA_DIR, 'img');
fs.mkdirSync(IMG_DIR, { recursive: true });

const ajuste = (clave, def) => {
  const r = db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(clave);
  if (r) return r.valor;
  if (def === undefined) return null;
  db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?)').run(clave, def);
  return def;
};
const fijarAjuste = (clave, valor) =>
  db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, valor);

const SECRETO = ajuste('secreto', crypto.randomBytes(32).toString('hex'));
const codigoLegible = n => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
  return Array.from(crypto.randomBytes(n), b => A[b % A.length]).join('');
};
const invitacion = () => process.env.TFF_INVITACION || ajuste('invitacion', 'FORJA-' + codigoLegible(4));

/* ---------- Contraseñas (scrypt) ---------- */
const hashClave = clave => {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(clave, sal, 64);
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
};
const comprobarClave = (clave, guardado) => {
  const [, salHex, hHex] = String(guardado).split('$');
  if (!salHex || !hHex) return false;
  const h = crypto.scryptSync(clave, Buffer.from(salHex, 'hex'), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hHex, 'hex'));
};
const HASH_FALSO = hashClave(crypto.randomBytes(12).toString('hex')); // iguala tiempos si el usuario no existe

const DATOS_VACIOS = () => JSON.stringify({ version: 1, campana: { titulo: '', sinopsis: '', sesionActual: 1, sesiones: { 1: 'Sesión 1' } }, hilos: [], cronica: [], personajes: [], mapas: [] });
function crearCampana(usuarioId, { nombre, ambientacion = '', sinopsis = '', clave, datos }) {
  const id = crypto.randomBytes(6).toString('base64url');
  let codigo; do codigo = codigoLegible(6); while (db.prepare('SELECT 1 FROM campanas WHERE codigo = ?').get(codigo));
  const ahora = Date.now();
  db.prepare(`INSERT INTO campanas (id, nombre, ambientacion, sinopsis, codigo, clave_hash, dueno_id, creada, actualizada, datos, rev)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(id, nombre, ambientacion, sinopsis, codigo, hashClave(clave), usuarioId, ahora, ahora, datos || DATOS_VACIOS());
  db.prepare("INSERT INTO membresias (campana_id, usuario_id, rol, unido) VALUES (?, ?, 'dm', ?)").run(id, usuarioId, ahora);
  return db.prepare('SELECT * FROM campanas WHERE id = ?').get(id);
}

/* ---------- Consola ---------- */
const [, , orden, a1, a2] = process.argv;
if (orden === 'invitacion') {
  if (a1) { fijarAjuste('invitacion', a1); console.log('Código de invitación cambiado a', a1); }
  else console.log('Código de invitación:', invitacion());
  process.exit(0);
}
if (orden === 'importar-tumba') {
  const u = a1 && db.prepare('SELECT * FROM usuarios WHERE correo = ? OR usuario = ?').get(a1.toLowerCase(), a1);
  if (!u) {
    const cuentas = db.prepare('SELECT usuario, correo FROM usuarios ORDER BY id').all();
    console.log(a1 ? `No hay ninguna cuenta con "${a1}".` : 'Uso: node server.js importar-tumba CORREO_O_USUARIO');
    console.log(cuentas.length ? 'Cuentas registradas:\n' + cuentas.map(c => `  ${c.usuario} · ${c.correo}`).join('\n') : 'Todavía no hay cuentas registradas.');
    process.exit(1);
  }
  const ya = db.prepare("SELECT codigo FROM campanas WHERE dueno_id = ? AND nombre = 'La Tumba de la Aniquilación'").get(u.id);
  if (ya && a2 !== '--otra') { console.log(`${u.usuario} ya tiene La Tumba de la Aniquilación (código ${ya.codigo}). Si olvidaste la contraseña, cámbiala en la web: Grupo y ajustes → Editar campaña.`); process.exit(0); }
  const datos = fs.readFileSync(path.join(__dirname, 'semillas', 'tumba.json'), 'utf8');
  const clave = codigoLegible(6).toLowerCase();
  const c = crearCampana(u.id, { nombre: 'La Tumba de la Aniquilación', ambientacion: 'Chult · Reinos Olvidados', sinopsis: JSON.parse(datos).campana.sinopsis, clave, datos });
  console.log(`Campaña creada para ${u.usuario}. Código: ${c.codigo} · Contraseña: ${clave}`);
  process.exit(0);
}
if (orden === 'clave') {
  if (!a1 || !a2 || a2.length < 8) { console.log('Uso: node server.js clave USUARIO NUEVA (mínimo 8 caracteres)'); process.exit(1); }
  const r = db.prepare('UPDATE usuarios SET hash = ? WHERE usuario = ?').run(hashClave(a2), a1);
  if (r.changes) db.prepare('DELETE FROM sesiones WHERE usuario_id = (SELECT id FROM usuarios WHERE usuario = ?)').run(a1);
  console.log(r.changes ? 'Contraseña cambiada. Sus sesiones abiertas se han cerrado.' : 'No existe ese usuario.');
  process.exit(r.changes ? 0 : 1);
}

/* ---------- Captcha propio (prueba de trabajo, compatible con el formato ALTCHA) ----------
   El servidor firma un reto; el navegador busca el número que lo resuelve (≈1 s de cálculo).
   Un bot tiene que gastar ese cálculo en cada intento, y cada reto solo vale una vez. */
const CAPTCHA_MAX = 60000;
const CAPTCHA_VIDA = 10 * 60 * 1000;
const captchasUsados = new Map(); // firma → expira
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRETO).update(s).digest('hex');

function nuevoCaptcha() {
  const expira = Date.now() + CAPTCHA_VIDA;
  const salt = crypto.randomBytes(12).toString('hex') + '?expires=' + Math.floor(expira / 1000);
  const numero = crypto.randomInt(CAPTCHA_MAX);
  const challenge = sha256(salt + numero);
  return { algorithm: 'SHA-256', challenge, maxnumber: CAPTCHA_MAX, salt, signature: hmac(challenge) };
}
function captchaValido(payload) {
  try {
    const p = typeof payload === 'string' ? JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) : payload;
    if (!p || p.algorithm !== 'SHA-256') return false;
    const exp = Number((/expires=(\d+)/.exec(p.salt) || [])[1]) * 1000;
    if (!exp || exp < Date.now()) return false;
    if (sha256(p.salt + p.number) !== p.challenge) return false;
    const firma = hmac(p.challenge);
    if (firma.length !== String(p.signature).length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(String(p.signature)))) return false;
    if (captchasUsados.has(firma)) return false;
    captchasUsados.set(firma, exp);
    return true;
  } catch { return false; }
}

/* ---------- Límite de intentos por IP ---------- */
const intentos = new Map(); // ip → [marcas de tiempo]
function limitar(ip, max = 10, ventana = 15 * 60 * 1000) {
  const ahora = Date.now();
  const lista = (intentos.get(ip) || []).filter(t => ahora - t < ventana);
  lista.push(ahora);
  intentos.set(ip, lista);
  return lista.length > max;
}
setInterval(() => {
  const ahora = Date.now();
  for (const [k, v] of captchasUsados) if (v < ahora) captchasUsados.delete(k);
  for (const [k, v] of intentos) if (!v.some(t => ahora - t < 15 * 60 * 1000)) intentos.delete(k);
  db.prepare('DELETE FROM sesiones WHERE expira < ?').run(ahora);
}, 10 * 60 * 1000).unref();

/* ---------- Utilidades HTTP ---------- */
class ErrorApi extends Error { constructor(estado, msg) { super(msg); this.estado = estado; } }
const fallo = (estado, msg) => { throw new ErrorApi(estado, msg); };

function json(res, estado, datos, cabeceras = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabeceras });
  res.end(JSON.stringify(datos));
}
function leerCuerpo(req, limite = 64 * 1024) {
  return new Promise((ok, ko) => {
    let tam = 0; const partes = [];
    req.on('data', c => { tam += c.length; if (tam > limite) { ko(new ErrorApi(413, 'Demasiados datos.')); req.destroy(); } else partes.push(c); });
    req.on('end', () => {
      if (!partes.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch { ko(new ErrorApi(400, 'Formato no válido.')); }
    });
    req.on('error', ko);
  });
}
// La IP real la añade el proxy de fuera; el cliente puede falsear las primeras entradas de X-Forwarded-For,
// así que se toma la penúltima (la que añadió el proxy externo antes de nginx). Hay además un límite global.
const ipDe = req => {
  const lista = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return lista.length >= 2 ? lista[lista.length - 2] : lista[0] || req.socket.remoteAddress || '';
};
const esHttps = req => req.headers['x-forwarded-proto'] === 'https' || process.env.TFF_COOKIE_SEGURA === '1';
const leerCookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const cookieSesion = (req, valor, maxAge) =>
  `tff_s=${valor}; Path=${BASE}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${esHttps(req) ? '; Secure' : ''}`;
const texto = (v, max) => String(v ?? '').trim().slice(0, max);

function usuarioActual(req) {
  const t = leerCookies(req).tff_s;
  if (!t) return null;
  return db.prepare(`SELECT u.id, u.usuario, u.correo FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
                     WHERE s.token = ? AND s.expira > ?`).get(sha256(t), Date.now()) || null;
}
const exigirUsuario = req => usuarioActual(req) || fallo(401, 'Inicia sesión para continuar.');

function abrirSesion(req, usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)').run(sha256(token), usuarioId, Date.now() + DURACION_SESION);
  return cookieSesion(req, token, DURACION_SESION / 1000);
}

/* ---------- Campañas ---------- */
// Las campañas creadas antes de que existiera el contenido guardaban '{}': siempre se devuelve la forma completa.
function leerDatos(c) {
  let d = {};
  try { d = JSON.parse(c.datos || '{}') || {}; } catch { /* datos corruptos: se parte de cero */ }
  const lista = k => Array.isArray(d[k]) ? d[k] : [];
  const camp = (d.campana && typeof d.campana === 'object') ? d.campana : {};
  return { ...d, version: d.version || 1,
    campana: { ...camp, sesionActual: camp.sesionActual || 1, sesiones: (camp.sesiones && typeof camp.sesiones === 'object') ? camp.sesiones : { 1: 'Sesión 1' } },
    cronica: lista('cronica'), personajes: lista('personajes'), hilos: lista('hilos'), mapas: lista('mapas') };
}
function resumenCampana(c, rol) {
  const jugadores = db.prepare("SELECT COUNT(*) n FROM membresias WHERE campana_id = ? AND rol = 'jugador'").get(c.id).n;
  const dm = db.prepare('SELECT usuario FROM usuarios WHERE id = ?').get(c.dueno_id);
  // Vista previa calculada con lo que la propia campaña va registrando.
  const d = leerDatos(c);
  const visibles = (d.cronica || []).filter(e => !e.oculto);
  const sesiones = new Set(visibles.map(e => e.sesion)).size;
  const pjs = (d.personajes || []).filter(p => p.tipo === 'pj' && p.estado !== 'muerto');
  const nivelMedio = pjs.length ? Math.round(pjs.reduce((t, p) => t + (Number(p.nivel) || 1), 0) / pjs.length) : null;
  const ultimo = visibles.slice().sort((a, b) => (b.sesion || 0) - (a.sesion || 0) || (b.t || 0) - (a.t || 0))[0];
  return {
    id: c.id, nombre: c.nombre, ambientacion: c.ambientacion, sinopsis: c.sinopsis,
    rol, dm: dm ? dm.usuario : '', jugadores, partidas: sesiones, nivelMedio, pjs: pjs.map(p => p.nombre),
    // La crónica es solo del DM: al jugador no le llega ni el título del último acontecimiento.
    acontecimientos: visibles.length, ultimo: rol === 'dm' && ultimo ? { titulo: ultimo.titulo, sesion: ultimo.sesion } : null,
    actualizada: c.actualizada,
    ...(rol === 'dm' ? { codigo: c.codigo } : {})
  };
}
function membresia(campanaId, usuarioId) {
  return db.prepare('SELECT rol FROM membresias WHERE campana_id = ? AND usuario_id = ?').get(campanaId, usuarioId);
}

/* ---------- Contenido ---------- */
// Lo que ve un jugador: sin acontecimientos ocultos, sin hilos ni notas del DM, y solo los personajes
// que ya aparecieron en la crónica visible (o son PJ).
function vistaJugador(d) {
  const cronica = (d.cronica || []).filter(e => !e.oculto).map(({ notas, ...e }) => e);
  const vistos = new Set(cronica.flatMap(e => e.enlaces || []));
  const personajes = (d.personajes || [])
    .filter(p => p.tipo === 'pj' || vistos.has(p.id))
    .map(p => {
      const { notas, gen, ...resto } = p;
      if (p.tipo === 'pj') return resto;
      // De NPC y enemigos solo lo que se ve en la mesa, sin estadísticas ni ganchos del DM.
      return { id: p.id, tipo: p.tipo, nombre: p.nombre, img: p.img, rol: p.rol, raza: p.raza, actitud: p.actitud, estado: p.estado, pers: { rasgo: (p.pers || {}).rasgo || '' } };
    });
  const c = d.campana || {};
  return { version: d.version, campana: { titulo: c.titulo, sinopsis: c.sinopsis, portada: c.portada, sesiones: c.sesiones, sesionActual: c.sesionActual }, cronica: [], personajes, hilos: [], mapas: [], jugadores: d.jugadores || {} };
}
function validarDatos(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) fallo(400, 'Datos de campaña no válidos.');
  for (const k of ['cronica', 'personajes', 'hilos', 'mapas']) if (d[k] !== undefined && !Array.isArray(d[k])) fallo(400, 'Datos de campaña no válidos.');
  return { ...d, version: d.version || 1, campana: d.campana || {}, cronica: d.cronica || [], personajes: d.personajes || [], hilos: d.hilos || [], mapas: d.mapas || [] };
}
function validarFicha(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) fallo(400, 'Ficha no válida.');
  const nombre = texto(f.nombre, 80);
  if (nombre.length < 1) fallo(400, 'Tu personaje necesita un nombre.');
  if (f.img && !/^data:image\/(png|jpe?g|webp);base64,/.test(f.img)) fallo(400, 'La imagen no es válida.');
  if (f.img && f.img.length > 900 * 1024) fallo(400, 'La imagen es demasiado grande.');
  const { id, actualizado, ...resto } = f;
  return { ...resto, nombre };
}
/* Copia de la partida en .zip (sin comprimir: las imágenes ya lo están). Dentro: partida.json y la carpeta img/. */
const TABLA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(archivos) {
  const partes = [], central = []; let pos = 0;
  for (const { nombre, datos } of archivos) {
    const n = Buffer.from(nombre, 'utf8'), crc = crc32(datos);
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(datos.length, 18); loc.writeUInt32LE(datos.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(datos.length, 20); cen.writeUInt32LE(datos.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(pos, 42);
    partes.push(loc, n, datos); central.push(cen, n); pos += 30 + n.length + datos.length;
  }
  const cd = Buffer.concat(central), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, cd, fin]);
}
function copiaZip(c) {
  const d = leerDatos(c), prefijo = `api/campanas/${c.id}/img/`, imgs = new Set();
  const txt = JSON.stringify(d, (k, v) => { if (typeof v === 'string' && v.startsWith(prefijo)) { const f = path.basename(v); imgs.add(f); return 'img/' + f; } return v; });
  const estado = JSON.parse(txt); delete estado.peticiones;
  const archivos = [{ nombre: 'partida.json', datos: Buffer.from(JSON.stringify({ formato: 'the-field-forge', version: 2, exportada: new Date().toISOString(), campana: { nombre: c.nombre, ambientacion: c.ambientacion, sinopsis: c.sinopsis }, estado }, null, 1)) }];
  for (const f of imgs) { try { archivos.push({ nombre: 'img/' + f, datos: fs.readFileSync(path.join(IMG_DIR, c.id, f)) }); } catch { /* imagen perdida: se omite */ } }
  return zip(archivos);
}
function servirImagen(res, campanaId, nombre) {
  const archivo = path.join(IMG_DIR, campanaId, path.basename(nombre));
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' });
    fs.createReadStream(archivo).pipe(res);
  });
}

/* ---------- Jugadores: su PJ, su inventario y las peticiones al DM ----------
   Lo que toca un jugador (PG, espacios de conjuro gastados, inventario) se guarda sin subir la revisión
   de la campaña, para no echar al DM de su pestaña. Cada cambio deja una marca (_tj) en el personaje:
   si el DM guarda una copia que no la había visto, se conservan esos campos del jugador.
   «jugadores» (quién lleva a quién) y «peticiones» solo cambian por estas rutas. */
const LUGARES = ['equipado', 'mochila', 'guardado'];
const TIPOS_OBJ = ['arma', 'armadura', 'escudo', 'pocion', 'frasco', 'pergamino', 'comida', 'herramienta', 'tesoro', 'objeto'];
const CAMPOS_JUGADOR = ['pg', 'inv', 'usados', 'efectos', 'cuaderno', '_tj'];
const ATRS = ['fue', 'des', 'con', 'int', 'sab', 'car'];
const idCorto = p => p + '_' + crypto.randomBytes(5).toString('base64url');
const entero = (v, min, max, def) => { const n = parseInt(v, 10); return Number.isNaN(n) ? def : Math.min(max, Math.max(min, n)); };
const camposJugador = p => Object.fromEntries(CAMPOS_JUGADOR.map(k => [k, p[k]]));
const marcar = p => { p._tj = Math.max(Date.now(), (p._tj || 0) + 1); };
const fichaJugador = ({ notas, gen, ...p }) => p;
const breve = p => ({ id: p.id, nombre: p.nombre, img: p.img || '', raza: p.raza || '', clase: p.clase || '', nivel: p.nivel || '' });

// La primera vez, el inventario sale de lo que la ficha ya decía: sus armas y su armadura.
function asegurarInv(p) {
  if (Array.isArray(p.inv)) return false;
  const armas = ((p.gen && p.gen.armas) || []).map(a => ({ id: idCorto('ob'), n: texto(a.n, 60), tipo: 'arma', cant: 1, nota: [a.d, a.t].filter(Boolean).join(' '), lugar: 'equipado' }));
  const defensa = String(p.caDesc || '').split(/\s+y\s+|,|\+/).map(x => x.trim()).filter(x => x && !/sin armadura|natural|defensa/i.test(x))
    .map(x => ({ id: idCorto('ob'), n: texto(x.charAt(0).toUpperCase() + x.slice(1), 60), tipo: /escudo/i.test(x) ? 'escudo' : 'armadura', cant: 1, nota: '', lugar: 'equipado' }));
  p.inv = [...armas, ...defensa];
  return true;
}
/* Objetos con efecto (forja de utilidades): curar, sumar a un atributo o a la CA durante unos turnos. */
function validarEfecto(x) {
  if (!x || typeof x !== 'object') return null;
  const clase = ['curar', 'atributo', 'ca'].includes(x.clase) ? x.clase : null;
  if (!clase) return null;
  const ef = { clase };
  if (clase === 'curar') { ef.dados = /^\s*\d{0,2}d\d{1,3}(\s*[+-]\s*\d{1,3})?\s*$|^\s*\d{1,3}\s*$/i.test(String(x.dados || '')) ? String(x.dados).replace(/\s+/g, '') : '1d4'; }
  else { ef.valor = entero(x.valor, -10, 10, 1); ef.turnos = entero(x.turnos, 1, 100, 3); if (clase === 'atributo') ef.atr = ATRS.includes(x.atr) ? x.atr : 'fue'; }
  return ef;
}
function validarObjeto(o) {
  const n = texto(o && o.n, 60); if (!n) fallo(400, 'Ponle un nombre al objeto.');
  const ob = { n, tipo: TIPOS_OBJ.includes(o.tipo) ? o.tipo : 'objeto', cant: entero(o.cant, 1, 9999, 1), nota: texto(o.nota, 300) };
  const ef = validarEfecto(o.efecto); if (ef) ob.efecto = ef;
  if (o.consumible || ef) { ob.consumible = o.consumible !== false; ob.resto = texto(o.resto, 40); }
  return ob;
}
const tirar = expr => {
  const m = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/i.exec(expr);
  if (!m) return Number(expr) || 0;
  let t = 0; for (let i = 0; i < (Number(m[1]) || 1); i++) t += crypto.randomInt(1, Number(m[2]) + 1);
  return t + (Number(m[3]) || 0);
};
const NOMBRE_ATR = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma', ca: 'CA' };
// Gasta una unidad, deja el resto (frasco, jarra…) y aplica el efecto. Devuelve qué pasó, en palabras.
function usarObjeto(p, ob) {
  let que = '';
  const ef = ob.efecto;
  if (ef && ef.clase === 'curar') {
    const r = Math.max(0, tirar(ef.dados)); const antes = Math.max(0, p.pg ?? p.pgMax ?? 0);
    p.pg = Math.min(p.pgMax || 999, antes + r); que = `recupera ${p.pg - antes} PG (${ef.dados} = ${r})`;
  } else if (ef) {
    const atr = ef.clase === 'ca' ? 'ca' : ef.atr;
    p.efectos = (p.efectos || []).filter(x => !(x.n === ob.n && x.atr === atr));
    p.efectos.push({ id: idCorto('ef'), n: ob.n, atr, valor: ef.valor, turnos: ef.turnos });
    que = `${NOMBRE_ATR[atr]} ${ef.valor >= 0 ? '+' : ''}${ef.valor} durante ${ef.turnos} ${ef.turnos === 1 ? 'turno' : 'turnos'}`;
  }
  if (ob.consumible !== false && (ef || ['pocion', 'pergamino', 'comida'].includes(ob.tipo))) {
    ob.cant -= 1;
    if (ob.cant <= 0) p.inv = p.inv.filter(x => x !== ob);
    const resto = ob.resto || (ob.tipo === 'pocion' ? 'Frasco vacío' : '');
    if (resto) {
      const ya = p.inv.find(x => x.tipo === 'frasco' && x.n === resto);
      if (ya) ya.cant += 1; else p.inv.push({ id: idCorto('ob'), n: resto, tipo: 'frasco', cant: 1, nota: 'Era: ' + ob.n, lugar: 'mochila' });
    }
  }
  return que;
}

const guardarDatos = (c, d, subirRev) => {
  const rev = c.rev + (subirRev ? 1 : 0);
  db.prepare('UPDATE campanas SET datos = ?, rev = ?, actualizada = ? WHERE id = ?').run(JSON.stringify(d), rev, Date.now(), c.id);
  return rev;
};
const pendientes = d => (d.peticiones || []).filter(x => x.estado === 'pendiente').map(({ ficha, ...x }) => x);
// Las últimas ya resueltas: el DM las ve aparte, en gris, para saber qué contestó.
const contestadas = d => (d.peticiones || []).filter(x => x.estado !== 'pendiente').slice(-20).reverse().map(({ ficha, ...x }) => x);
function podarPeticiones(d) {
  const p = d.peticiones || [];
  const resueltas = p.filter(x => x.estado !== 'pendiente').slice(-30);
  d.peticiones = [...resueltas, ...p.filter(x => x.estado === 'pendiente')].sort((a, b) => a.t - b.t);
}
// Aplica una petición ya autorizada. Devuelve los personajes que cambian.
function aplicarPeticion(d, pet) {
  if (pet.tipo === 'pj') {
    d.jugadores = d.jugadores || {};
    if (d.jugadores[pet.usuario]) fallo(409, pet.usuario + ' ya lleva otro personaje.');
    let p;
    if (pet.pjCamp) {
      p = d.personajes.find(x => x.id === pet.pjCamp && x.tipo === 'pj') || fallo(409, 'Ese personaje ya no está en la campaña.');
      if (Object.values(d.jugadores).includes(p.id)) fallo(409, 'Ese personaje ya lo lleva otra persona.');
    } else {
      if (d.personajes.filter(x => x.tipo === 'pj').length >= 12) fallo(409, 'La campaña ya tiene demasiados personajes jugadores.');
      p = { ...pet.ficha, id: idCorto('pj'), tipo: 'pj', estado: 'activo', rol: 'PJ de ' + pet.usuario };
      d.personajes.push(p); pet.nuevo = true;
    }
    asegurarInv(p); marcar(p);
    d.jugadores[pet.usuario] = p.id; pet.pj = p.id;
    return [p];
  }
  const p = d.personajes.find(x => x.id === pet.pj && x.tipo === 'pj');
  if (!p) fallo(409, 'Ese personaje ya no está en la campaña.');
  asegurarInv(p);
  const tocados = [p];
  if (pet.tipo === 'anadir') {
    if (p.inv.length >= 80) fallo(409, 'El inventario está lleno.');
    const igual = p.inv.find(x => x.n === pet.nuevo.n && x.tipo === pet.nuevo.tipo && JSON.stringify(x.efecto || null) === JSON.stringify(pet.nuevo.efecto || null));
    if (igual) igual.cant += pet.nuevo.cant; else p.inv.push({ id: idCorto('ob'), ...pet.nuevo, lugar: 'mochila' });
  } else {
    const ob = p.inv.find(x => x.id === pet.objeto);
    if (!ob) fallo(409, 'Ese objeto ya no está en el inventario.');
    if (pet.tipo === 'usar') { pet.resultado = usarObjeto(p, ob); tocados.forEach(marcar); return tocados; }
    const cant = Math.min(pet.cant || 1, ob.cant);
    ob.cant -= cant;
    if (ob.cant <= 0) p.inv = p.inv.filter(x => x !== ob);
    if (pet.tipo === 'dar') {
      const a = d.personajes.find(x => x.id === pet.a && x.tipo === 'pj');
      if (!a) fallo(409, 'Quien iba a recibirlo ya no está en la campaña.');
      asegurarInv(a);
      const igual = a.inv.find(x => x.n === ob.n && x.tipo === ob.tipo && (x.nota || '') === (ob.nota || ''));
      if (igual) igual.cant += cant; else a.inv.push({ ...ob, id: idCorto('ob'), cant, lugar: 'mochila' });
      tocados.push(a);
    }
  }
  tocados.forEach(marcar);
  return tocados;
}

/* Tiempo real (SSE): cada navegador abierto en una campaña escucha aquí los cambios. */
const oyentes = new Map(); // campaña → Set de { res, dm, usuario }
function difundir(campanaId, hacer) {
  for (const o of oyentes.get(campanaId) || []) {
    const dato = hacer(o);
    if (dato) o.res.write('data: ' + JSON.stringify(dato) + '\n\n');
  }
}
// Avisa de que cambiaron estos personajes: al DM le llega el detalle; al jugador, que vuelva a pedir lo suyo.
function avisarCambio(campanaId, d, tocados = [], extra = {}) {
  difundir(campanaId, o => o.dm
    ? { parches: tocados.map(p => ({ id: p.id, campos: camposJugador(p) })), peticiones: pendientes(d), contestadas: contestadas(d), jugadores: d.jugadores || {}, ...extra }
    : { pj: tocados.map(p => p.id), pg: Object.fromEntries(tocados.map(p => [p.id, p.pg])), ...(extra.aviso ? { aviso: extra.aviso } : {}) });
}
setInterval(() => { for (const grupo of oyentes.values()) for (const o of grupo) o.res.write(': sigo aquí\n\n'); }, 20000).unref();

/* ---------- Rutas de la API ---------- */
async function api(req, res, ruta, consulta) {
  const m = req.method;
  const ip = ipDe(req);

  // Defensa CSRF: las escrituras deben venir en JSON y desde el mismo origen.
  if (m !== 'GET') {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) fallo(415, 'Se esperaba JSON.');
    const origen = req.headers.origin;
    if (origen && new URL(origen).host !== req.headers.host) fallo(403, 'Origen no permitido.');
  }

  // Errores del navegador: quedan en el registro del servidor para poder diagnosticar sin abrir la consola.
  if (ruta === 'diag' && m === 'POST') {
    if (limitar('diag:' + ip, 20)) return json(res, 200, { ok: true });
    const b = await leerCuerpo(req, 8 * 1024);
    console.log('[navegador]', JSON.stringify({ pagina: texto(b.pagina, 200), error: texto(b.error, 600), donde: texto(b.donde, 200), ua: texto(req.headers['user-agent'], 160) }));
    return json(res, 200, { ok: true });
  }

  if (ruta === 'captcha' && m === 'GET') return json(res, 200, nuevoCaptcha());

  if (ruta === 'estado' && m === 'GET') {
    const n = db.prepare('SELECT COUNT(*) n FROM usuarios').get().n;
    return json(res, 200, { plazas: MAX_USUARIOS, ocupadas: n, abierto: n < MAX_USUARIOS });
  }

  if (ruta === 'registro' && m === 'POST') {
    if (limitar(ip) || limitar('global:registro', 40)) fallo(429, 'Demasiados intentos. Espera unos minutos.');
    const b = await leerCuerpo(req);
    if (!captchaValido(b.captcha)) fallo(400, 'No pudimos comprobar que eres humano. Vuelve a intentarlo.');
    const usuario = texto(b.usuario, 32), correo = texto(b.correo, 120).toLowerCase(), clave = String(b.clave || '');
    if (texto(b.invitacion, 40).toUpperCase() !== invitacion().toUpperCase()) fallo(403, 'El código de invitación no es correcto.');
    if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(usuario)) fallo(400, 'El usuario debe tener entre 3 y 32 letras, números, puntos o guiones.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) fallo(400, 'Escribe un correo válido.');
    if (clave.length < 8 || clave.length > 200) fallo(400, 'La contraseña necesita al menos 8 caracteres.');
    if (db.prepare('SELECT COUNT(*) n FROM usuarios').get().n >= MAX_USUARIOS) fallo(403, `La beta está completa (${MAX_USUARIOS} plazas).`);
    if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ? OR correo = ?').get(usuario, correo)) fallo(409, 'Ese usuario o correo ya está registrado.');
    const r = db.prepare('INSERT INTO usuarios (usuario, correo, hash, creado) VALUES (?, ?, ?, ?)').run(usuario, correo, hashClave(clave), Date.now());
    const cookie = abrirSesion(req, Number(r.lastInsertRowid));
    return json(res, 201, { usuario: { usuario, correo } }, { 'Set-Cookie': cookie });
  }

  if (ruta === 'entrar' && m === 'POST') {
    if (limitar(ip) || limitar('global:entrar', 60)) fallo(429, 'Demasiados intentos. Espera unos minutos.');
    const b = await leerCuerpo(req);
    if (!captchaValido(b.captcha)) fallo(400, 'No pudimos comprobar que eres humano. Vuelve a intentarlo.');
    const id = texto(b.usuario, 120);
    const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ? OR correo = ?').get(id, id.toLowerCase());
    const ok = comprobarClave(String(b.clave || ''), u ? u.hash : HASH_FALSO);
    if (!u || !ok) fallo(401, 'Usuario o contraseña incorrectos.');
    return json(res, 200, { usuario: { usuario: u.usuario, correo: u.correo } }, { 'Set-Cookie': abrirSesion(req, u.id) });
  }

  if (ruta === 'salir' && m === 'POST') {
    const t = leerCookies(req).tff_s;
    if (t) db.prepare('DELETE FROM sesiones WHERE token = ?').run(sha256(t));
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion(req, '', 0) });
  }

  if (ruta === 'yo' && m === 'GET') {
    const u = usuarioActual(req);
    return json(res, 200, { usuario: u ? { usuario: u.usuario, correo: u.correo } : null });
  }

  if (ruta === 'campanas' && m === 'GET') {
    const u = exigirUsuario(req);
    const filas = db.prepare(`SELECT c.*, m.rol FROM campanas c JOIN membresias m ON m.campana_id = c.id
                              WHERE m.usuario_id = ? ORDER BY c.actualizada DESC`).all(u.id);
    return json(res, 200, { campanas: filas.map(c => resumenCampana(c, c.rol)) });
  }

  if (ruta === 'campanas' && m === 'POST') {
    const u = exigirUsuario(req);
    const b = await leerCuerpo(req);
    const nombre = texto(b.nombre, 80), clave = String(b.clave || '');
    if (nombre.length < 2) fallo(400, 'Ponle un nombre a la campaña.');
    if (clave.length < 4 || clave.length > 100) fallo(400, 'La contraseña de la campaña necesita al menos 4 caracteres.');
    const c = crearCampana(u.id, { nombre, ambientacion: texto(b.ambientacion, 120), sinopsis: texto(b.sinopsis, 1200), clave });
    return json(res, 201, { campana: resumenCampana(c, 'dm') });
  }

  if (ruta === 'campanas/unirse' && m === 'POST') {
    const u = exigirUsuario(req);
    if (limitar('unirse:' + u.id, 8)) fallo(429, 'Demasiados intentos. Espera unos minutos.');
    const b = await leerCuerpo(req);
    const c = db.prepare('SELECT * FROM campanas WHERE codigo = ?').get(texto(b.codigo, 12).toUpperCase());
    const ok = comprobarClave(String(b.clave || ''), c ? c.clave_hash : HASH_FALSO);
    if (!c || !ok) fallo(403, 'Código o contraseña de campaña incorrectos.');
    const ya = membresia(c.id, u.id);
    if (!ya) db.prepare("INSERT INTO membresias (campana_id, usuario_id, rol, unido) VALUES (?, ?, 'jugador', ?)").run(c.id, u.id, Date.now());
    return json(res, ya ? 200 : 201, { campana: resumenCampana(c, ya ? ya.rol : 'jugador') });
  }

  /* ---- Contenido de la campaña ---- */
  const md = /^campanas\/([\w-]{4,20})\/(datos|importar|copia|vivo|jugador|peticion|img|img\/([\w.-]{1,80}))$/.exec(ruta);
  if (md) {
    const u = exigirUsuario(req);
    const c = db.prepare('SELECT * FROM campanas WHERE id = ?').get(md[1]);
    const mem = c && membresia(c.id, u.id);
    if (!c || !mem) fallo(404, 'Esa campaña no existe o no formas parte de ella.');
    const esDm = mem.rol === 'dm';

    if (md[3] && m === 'GET') return servirImagen(res, c.id, md[3]);
    if (md[2] === 'copia' && m === 'GET') {
      if (!esDm) fallo(403, 'Solo el DM puede descargar la partida.');
      const buf = copiaZip(c), fecha = new Date().toISOString().slice(0, 10);
      const nombre = (c.nombre.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'partida') + '-' + fecha + '.zip';
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': buf.length, 'Content-Disposition': `attachment; filename="${nombre}"`, 'Cache-Control': 'no-store' });
      return res.end(buf);
    }
    if (md[2] === 'datos' && m === 'GET') {
      const d = leerDatos(c);
      return json(res, 200, { rev: c.rev, rol: mem.rol, datos: esDm ? d : vistaJugador(d) });
    }
    const fresca = () => db.prepare('SELECT * FROM campanas WHERE id = ?').get(c.id) || fallo(404, 'Esa campaña ya no existe.');

    if (md[2] === 'vivo' && m === 'GET') {
      const grupo = oyentes.get(c.id) || new Set();
      if (grupo.size >= 60) fallo(429, 'Demasiadas ventanas abiertas en esta campaña.');
      oyentes.set(c.id, grupo);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      const o = { res, dm: esDm, usuario: u.usuario };
      grupo.add(o);
      req.on('close', () => { grupo.delete(o); if (!grupo.size) oyentes.delete(c.id); });
      return;
    }

    /* ---- Vista del jugador ---- */
    if (md[2] === 'jugador' && m === 'GET') {
      const d = leerDatos(c);
      const jug = d.jugadores || {};
      const idPj = esDm ? (consulta && consulta.get('pj')) || '' : jug[u.usuario];
      const p = d.personajes.find(x => x.id === idPj && x.tipo === 'pj');
      if (p && asegurarInv(p)) { marcar(p); guardarDatos(c, d); avisarCambio(c.id, d, [p]); }
      const ocupados = new Set(Object.values(jug));
      const pjs = d.personajes.filter(x => x.tipo === 'pj');
      const quien = idp => Object.keys(jug).find(k => jug[k] === idp) || '';
      return json(res, 200, {
        rol: mem.rol, campana: c.nombre, pj: p ? fichaJugador(p) : null,
        elegibles: esDm ? pjs.map(x => ({ ...breve(x), jugador: quien(x.id) })) : p ? [] : pjs.filter(x => !ocupados.has(x.id) && x.estado !== 'muerto').map(breve),
        mios: !esDm && !p ? db.prepare('SELECT id, datos FROM personajes WHERE usuario_id = ? ORDER BY actualizado DESC').all(u.id).map(f => breve({ ...JSON.parse(f.datos), id: f.id })) : [],
        companeros: p ? pjs.filter(x => x.id !== p.id && x.estado !== 'muerto').map(x => ({ id: x.id, nombre: x.nombre })) : [],
        peticiones: (p ? (d.peticiones || []).filter(x => x.pj === p.id) : (d.peticiones || []).filter(x => x.tipo === 'pj' && x.usuario === u.usuario)).slice(-8).map(({ ficha, ...x }) => x)
      });
    }
    if (md[2] === 'jugador' && m === 'POST') {
      if (limitar('jug:' + u.id, 400, 5 * 60 * 1000)) fallo(429, 'Vas muy deprisa. Espera un momento.');
      const b = await leerCuerpo(req);
      const cc = fresca(), d = leerDatos(cc);
      d.jugadores = d.jugadores || {}; d.peticiones = d.peticiones || [];
      const accion = texto(b.accion, 20);
      const pjLibre = idp => { const x = d.personajes.find(y => y.id === idp && y.tipo === 'pj'); return x && !Object.values(d.jugadores).includes(x.id) ? x : null; };

      if (accion === 'asignar') {
        if (!esDm) fallo(403, 'Solo el DM reparte los personajes.');
        const quien = texto(b.usuario, 40);
        const miembro = db.prepare("SELECT u.usuario FROM membresias m JOIN usuarios u ON u.id = m.usuario_id WHERE m.campana_id = ? AND u.usuario = ?").get(cc.id, quien);
        if (!miembro) fallo(404, 'Esa persona no está en la campaña.');
        for (const k of Object.keys(d.jugadores)) if (k === miembro.usuario || d.jugadores[k] === b.pj) delete d.jugadores[k];
        if (b.pj) { if (!d.personajes.some(x => x.id === b.pj && x.tipo === 'pj')) fallo(404, 'Ese personaje no existe.'); d.jugadores[miembro.usuario] = b.pj; }
        guardarDatos(cc, d); avisarCambio(cc.id, d, d.personajes.filter(x => x.id === b.pj));
        difundir(cc.id, o => !o.dm && { pj: ['*'] });
        return json(res, 200, { jugadores: d.jugadores });
      }
      if (!esDm && !d.jugadores[u.usuario]) {
        // Aún sin personaje: elige uno libre de la campaña o trae uno de los suyos.
        // Aún sin personaje: pide al DM uno libre de la campaña o traer uno de los suyos. El DM revisa la ficha y decide.
        const mia = d.peticiones.find(x => x.tipo === 'pj' && x.usuario === u.usuario && x.estado === 'pendiente');
        if (accion === 'cancelar') { if (mia) d.peticiones = d.peticiones.filter(x => x !== mia); }
        else {
          if (mia) fallo(409, 'Ya tienes una petición esperando al DM. Cancélala para pedir otro personaje.');
          const pet = { id: idCorto('pet'), tipo: 'pj', usuario: u.usuario, t: Date.now(), estado: 'pendiente' };
          if (accion === 'elegir') {
            const x = pjLibre(b.pj) || fallo(409, 'Ese personaje ya lo lleva otra persona.');
            Object.assign(pet, { pjCamp: x.id, quien: x.nombre, texto: 'Quiere interpretar a ' + x.nombre });
          } else if (accion === 'traer') {
            const fila = db.prepare('SELECT * FROM personajes WHERE id = ? AND usuario_id = ?').get(texto(b.personaje, 40), u.id);
            if (!fila) fallo(404, 'Ese personaje no existe.');
            const f = JSON.parse(fila.datos);
            Object.assign(pet, { ficha: f, quien: f.nombre, img: f.img && f.img.length < 200 * 1024 ? f.img : '', texto: 'Quiere jugar con su personaje ' + f.nombre });
          } else fallo(400, 'Primero elige tu personaje.');
          d.peticiones.push(pet);
        }
        podarPeticiones(d);
        guardarDatos(cc, d); avisarCambio(cc.id, d, []);
        return json(res, 201, { ok: true });
      }

      // A partir de aquí se actúa sobre un personaje: el propio, o el que el DM tenga abierto.
      const directo = esDm && !b.simular;
      const p = d.personajes.find(x => x.id === (esDm ? b.pj : d.jugadores[u.usuario]) && x.tipo === 'pj');
      if (!p) fallo(404, 'Ese personaje ya no está en la campaña.');
      asegurarInv(p);
      const objeto = () => p.inv.find(x => x.id === b.objeto) || fallo(409, 'Ese objeto ya no está en el inventario.');
      let tocados = [p];

      if (accion === 'soltar') { if (esDm) fallo(400, 'Usa «asignar».'); delete d.jugadores[u.usuario]; }
      else if (['pg', 'espacio', 'descanso'].includes(accion) && !directo) fallo(403, 'La vida y los espacios de conjuro los lleva el DM.');
      else if (accion === 'pg') p.pg = entero(b.valor, -(p.pgMax || 999), p.pgMax || 999, p.pg ?? p.pgMax ?? 0);
      else if (accion === 'notas') {
        const hojas = Array.isArray(b.hojas) ? b.hojas.slice(0, 60).map(h => texto(h, 3000)) : [];
        p.cuaderno = hojas.length ? hojas : [''];
        tocados = []; // solo cambia lo del propio jugador: no hace falta avisar a nadie
        marcar(p);
      }
      else if (accion === 'usar') {
        const ob = objeto();
        if (!ob.efecto && !directo) fallo(403, 'Ese objeto se usa pidiéndoselo al DM.');
        const que = usarObjeto(p, ob);
        tocados.forEach(marcar); guardarDatos(cc, d);
        avisarCambio(cc.id, d, tocados, { aviso: `${p.nombre} usa ${ob.n}${que ? ': ' + que : ''}` });
        return json(res, 200, { ok: true, resultado: que });
      }
      else if (accion === 'dar') {
        if (!esDm) fallo(403, 'Solo el DM reparte objetos de la forja.');
        if (p.inv.length >= 80) fallo(409, 'El inventario está lleno.');
        const ob = validarObjeto(b.objeto);
        aplicarPeticion(d, { tipo: 'anadir', pj: p.id, nuevo: ob });
      }
      else if (accion === 'espacio') {
        const nivel = String(entero(b.nivel, 1, 9, 1)), max = Number(((p.conj || {}).espacios || {})[nivel]) || 0;
        p.usados = { ...(p.usados || {}), [nivel]: entero(b.usados, 0, max, 0) };
      }
      else if (accion === 'descanso') { p.usados = {}; if (b.largo && p.pgMax) p.pg = p.pgMax; }
      else if (accion === 'mover') { if (!LUGARES.includes(b.lugar)) fallo(400, 'Lugar no válido.'); objeto().lugar = b.lugar; }
      else if (accion === 'cancelar') {
        const pet = d.peticiones.find(x => x.id === b.peticion && x.pj === p.id && x.estado === 'pendiente');
        if (pet) d.peticiones = d.peticiones.filter(x => x !== pet);
      }
      else if (accion === 'pedir') {
        const tipo = ['anadir', 'usar', 'dar', 'tirar'].includes(b.tipo) ? b.tipo : fallo(400, 'Petición no válida.');
        const pet = { id: idCorto('pet'), pj: p.id, quien: p.nombre, usuario: u.usuario, tipo, t: Date.now(), estado: 'pendiente' };
        if (tipo === 'anadir') {
          const n = texto(b.n, 60); if (!n) fallo(400, 'Ponle un nombre al objeto.');
          pet.nuevo = { n, tipo: TIPOS_OBJ.includes(b.clase) ? b.clase : 'objeto', cant: entero(b.cant, 1, 9999, 1), nota: texto(b.nota, 140) };
          if (['pocion', 'pergamino', 'comida'].includes(pet.nuevo.tipo)) pet.nuevo.consumible = true;
          pet.texto = 'Añadir ' + (pet.nuevo.cant > 1 ? pet.nuevo.cant + ' × ' : '') + n;
        } else {
          const ob = objeto();
          pet.objeto = ob.id; pet.cant = tipo === 'usar' ? 1 : entero(b.cant, 1, ob.cant, 1);
          const que = (pet.cant > 1 ? pet.cant + ' × ' : '') + ob.n;
          if (tipo === 'dar') {
            const a = d.personajes.find(x => x.id === b.a && x.tipo === 'pj' && x.id !== p.id) || fallo(400, 'Elige a quién se lo das.');
            pet.a = a.id; pet.texto = 'Dar ' + que + ' a ' + a.nombre;
          } else pet.texto = (tipo === 'usar' ? 'Usar ' : 'Soltar ') + que;
        }
        if (directo) { tocados = aplicarPeticion(d, pet); }
        else {
          if (pendientes(d).filter(x => x.pj === p.id).length >= 10) fallo(429, 'Tienes muchas peticiones esperando al DM.');
          d.peticiones.push(pet);
        }
      }
      else fallo(400, 'Acción desconocida.');
      tocados.forEach(marcar);
      podarPeticiones(d);
      guardarDatos(cc, d); if (tocados.length || accion === 'pedir' || accion === 'cancelar') avisarCambio(cc.id, d, tocados);
      return json(res, 200, { ok: true });
    }

    if (!esDm) fallo(403, 'Solo el DM puede cambiar la campaña.');
    if (md[2] === 'peticion' && m === 'GET' && consulta && consulta.get('ficha')) {
      const pet = (leerDatos(c).peticiones || []).find(x => x.id === consulta.get('ficha')) || fallo(404, 'Esa petición ya no existe.');
      const d = leerDatos(c);
      return json(res, 200, { ficha: pet.ficha || d.personajes.find(x => x.id === pet.pjCamp) || null });
    }
    if (md[2] === 'peticion' && m === 'GET') { const d = leerDatos(c); return json(res, 200, { peticiones: pendientes(d), contestadas: contestadas(d), jugadores: d.jugadores || {}, parches: d.personajes.filter(p => p._tj).map(p => ({ id: p.id, campos: camposJugador(p) })) }); }
    if (md[2] === 'peticion' && m === 'POST') {
      const b = await leerCuerpo(req);
      const cc = fresca(), d = leerDatos(cc);
      // Se busca la petición real, no la copia sin ficha que se envía a la mesa: si no, el estado nunca se guardaría.
      const pet = (d.peticiones || []).find(x => x.id === b.id && x.estado === 'pendiente') || fallo(409, 'Esa petición ya estaba resuelta.');
      let tocados = [], aviso = '';
      if (b.ok) { try { tocados = aplicarPeticion(d, pet); pet.estado = 'aprobada'; } catch (err) { if (!(err instanceof ErrorApi)) throw err; pet.estado = 'rechazada'; pet.motivo = aviso = err.message; } }
      else pet.estado = 'rechazada';
      pet.resuelta = Date.now();
      const dueno = d.personajes.find(x => x.id === pet.pj);
      const nuevo = pet.nuevo === true && pet.estado === 'aprobada' ? d.personajes.find(x => x.id === pet.pj) : null;
      delete pet.ficha; delete pet.nuevo;
      podarPeticiones(d);
      // Un personaje nuevo sí cambia la revisión: el DM lo recibe por el canal en vivo junto con ella.
      const rev = guardarDatos(cc, d, !!nuevo);
      avisarCambio(cc.id, d, tocados.length ? tocados : dueno ? [dueno] : [], { ...(nuevo ? { nuevo, rev } : {}), ...(pet.resultado ? { aviso: `${pet.quien}: ${pet.resultado}` } : {}) });
      if (pet.tipo === 'pj') difundir(cc.id, o => !o.dm && { pj: ['*'] });
      return json(res, 200, { estado: pet.estado, aviso: aviso || pet.resultado || '', parches: tocados.map(p => ({ id: p.id, campos: camposJugador(p) })), peticiones: pendientes(d), contestadas: contestadas(d), nuevo, rev });
    }
    if (md[2] === 'datos' && m === 'PUT') {
      const b = await leerCuerpo(req, 12 * 1024 * 1024);
      const cc = fresca();
      if (Number(b.rev) !== cc.rev) fallo(409, 'La campaña cambió en otra ventana. Recarga para ver la última versión.');
      const d = validarDatos(b.datos), antes = leerDatos(cc);
      // Lo que es de los jugadores no se pisa con una copia que no lo había visto.
      d.jugadores = antes.jugadores || {}; d.peticiones = antes.peticiones || [];
      const cambiados = [];
      for (const p of d.personajes) {
        const a = antes.personajes.find(x => x.id === p.id);
        if (!a) continue;
        if (a._tj && a._tj !== p._tj) for (const k of CAMPOS_JUGADOR) { if (a[k] === undefined) delete p[k]; else p[k] = a[k]; }
        else if (p.tipo === 'pj' && (['pg', 'pgMax', 'ca', 'nivel', 'nombre', 'estado', 'img'].some(k => a[k] !== p[k]) || JSON.stringify(a.efectos || []) !== JSON.stringify(p.efectos || []))) cambiados.push(p);
      }
      for (const k of Object.keys(d.jugadores)) if (!d.personajes.some(p => p.id === d.jugadores[k] && p.tipo === 'pj')) delete d.jugadores[k];
      const rev = guardarDatos(cc, d, true);
      // También a las otras ventanas del DM: puede tener abierto el móvil de un personaje.
      if (cambiados.length) difundir(cc.id, () => ({ pj: cambiados.map(p => p.id), pg: Object.fromEntries(cambiados.map(p => [p.id, p.pg])) }));
      return json(res, 200, { rev });
    }
    if (md[2] === 'img' && m === 'POST') {
      const b = await leerCuerpo(req, 9 * 1024 * 1024);
      const mt = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.img || ''));
      if (!mt) fallo(400, 'La imagen no es válida. Usa PNG, JPG o WebP.');
      const nombre = crypto.randomBytes(8).toString('hex') + '.' + mt[1].replace('jpeg', 'jpg');
      fs.mkdirSync(path.join(IMG_DIR, c.id), { recursive: true });
      fs.writeFileSync(path.join(IMG_DIR, c.id, nombre), Buffer.from(mt[2], 'base64'));
      return json(res, 201, { url: `api/campanas/${c.id}/img/${nombre}` });
    }
    if (md[2] === 'importar' && m === 'POST') {
      const b = await leerCuerpo(req, 120 * 1024 * 1024);
      if (!b || b.formato !== 'the-field-forge' || !b.estado) fallo(400, 'Ese archivo no es una copia de The Field Forge.');
      // Las imágenes de la copia (mapas, retratos) pasan a archivos del servidor.
      const mapa = {};
      for (const [ref, url] of Object.entries(b.imagenes || {})) {
        const mt = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/s.exec(String(url));
        if (!mt) continue;
        const nombre = crypto.randomBytes(8).toString('hex') + '.' + mt[1].replace('jpeg', 'jpg');
        fs.mkdirSync(path.join(IMG_DIR, c.id), { recursive: true });
        fs.writeFileSync(path.join(IMG_DIR, c.id, nombre), Buffer.from(mt[2], 'base64'));
        mapa[ref] = `api/campanas/${c.id}/img/${nombre}`;
      }
      const txt = JSON.stringify(b.estado, (k, v) => (typeof v === 'string' && mapa[v]) ? mapa[v] : v);
      const d = validarDatos(JSON.parse(txt)); d.peticiones = [];
      d.jugadores = b.version >= 2 && d.jugadores && typeof d.jugadores === 'object' ? Object.fromEntries(Object.entries(d.jugadores).filter(([, v]) => d.personajes.some(p => p.id === v))) : {};
      const rev = c.rev + 1;
      db.prepare('UPDATE campanas SET datos = ?, rev = ?, actualizada = ?, sinopsis = CASE WHEN sinopsis = \'\' THEN ? ELSE sinopsis END WHERE id = ?')
        .run(JSON.stringify(d), rev, Date.now(), texto(d.campana && d.campana.sinopsis, 1200), c.id);
      return json(res, 200, { rev, imagenes: Object.keys(mapa).length });
    }
    fallo(405, 'Método no permitido.');
  }

  /* ---- Personajes del usuario (creador de personajes) ---- */
  if (ruta === 'personajes' && m === 'GET') {
    const u = exigirUsuario(req);
    const filas = db.prepare('SELECT id, datos, actualizado FROM personajes WHERE usuario_id = ? ORDER BY actualizado DESC').all(u.id);
    return json(res, 200, { personajes: filas.map(f => ({ ...JSON.parse(f.datos), id: f.id, actualizado: f.actualizado })) });
  }
  if (ruta === 'personajes' && m === 'POST') {
    const u = exigirUsuario(req);
    if (db.prepare('SELECT COUNT(*) n FROM personajes WHERE usuario_id = ?').get(u.id).n >= 30) fallo(403, 'Has llegado al máximo de 30 personajes.');
    const b = await leerCuerpo(req, 2 * 1024 * 1024);
    const f = validarFicha(b.personaje);
    const id = 'pj_' + crypto.randomBytes(6).toString('base64url');
    db.prepare('INSERT INTO personajes (id, usuario_id, datos, creado, actualizado) VALUES (?, ?, ?, ?, ?)').run(id, u.id, JSON.stringify(f), Date.now(), Date.now());
    return json(res, 201, { personaje: { ...f, id } });
  }
  const mp = /^personajes\/(pj_[\w-]{4,20})$/.exec(ruta);
  if (mp) {
    const u = exigirUsuario(req);
    const fila = db.prepare('SELECT * FROM personajes WHERE id = ? AND usuario_id = ?').get(mp[1], u.id);
    if (!fila) fallo(404, 'Ese personaje no existe.');
    if (m === 'GET') return json(res, 200, { personaje: { ...JSON.parse(fila.datos), id: fila.id } });
    if (m === 'PUT') {
      const b = await leerCuerpo(req, 2 * 1024 * 1024);
      const f = validarFicha(b.personaje);
      db.prepare('UPDATE personajes SET datos = ?, actualizado = ? WHERE id = ?').run(JSON.stringify(f), Date.now(), fila.id);
      return json(res, 200, { personaje: { ...f, id: fila.id } });
    }
    if (m === 'DELETE') { db.prepare('DELETE FROM personajes WHERE id = ?').run(fila.id); return json(res, 200, { ok: true }); }
  }

  const mc = /^campanas\/([\w-]{4,20})$/.exec(ruta);
  if (mc) {
    const u = exigirUsuario(req);
    const c = db.prepare('SELECT * FROM campanas WHERE id = ?').get(mc[1]);
    const mem = c && membresia(c.id, u.id);
    if (!c || !mem) fallo(404, 'Esa campaña no existe o no formas parte de ella.');

    if (m === 'GET') {
      const miembros = db.prepare(`SELECT u.usuario, m.rol FROM membresias m JOIN usuarios u ON u.id = m.usuario_id
                                   WHERE m.campana_id = ? ORDER BY m.rol, m.unido`).all(c.id);
      return json(res, 200, { campana: resumenCampana(c, mem.rol), miembros });
    }
    if (mem.rol !== 'dm') fallo(403, 'Solo el DM puede cambiar la campaña.');
    if (m === 'PATCH') {
      const b = await leerCuerpo(req);
      const nombre = b.nombre !== undefined ? texto(b.nombre, 80) : c.nombre;
      if (nombre.length < 2) fallo(400, 'Ponle un nombre a la campaña.');
      const ambientacion = b.ambientacion !== undefined ? texto(b.ambientacion, 120) : c.ambientacion;
      const sinopsis = b.sinopsis !== undefined ? texto(b.sinopsis, 1200) : c.sinopsis;
      let claveHash = c.clave_hash;
      if (b.clave) {
        if (String(b.clave).length < 4) fallo(400, 'La contraseña de la campaña necesita al menos 4 caracteres.');
        claveHash = hashClave(String(b.clave));
      }
      db.prepare('UPDATE campanas SET nombre = ?, ambientacion = ?, sinopsis = ?, clave_hash = ?, actualizada = ? WHERE id = ?')
        .run(nombre, ambientacion, sinopsis, claveHash, Date.now(), c.id);
      return json(res, 200, { campana: resumenCampana(db.prepare('SELECT * FROM campanas WHERE id = ?').get(c.id), 'dm') });
    }
    if (m === 'DELETE') {
      const b = await leerCuerpo(req);
      if (texto(b.confirmar, 80) !== c.nombre) fallo(400, 'Escribe el nombre exacto de la campaña para borrarla.');
      db.prepare('DELETE FROM campanas WHERE id = ?').run(c.id);
      return json(res, 200, { ok: true });
    }
  }

  fallo(404, 'Ruta desconocida.');
}

/* ---------- Archivos estáticos ---------- */
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json'
};
function estatico(req, res, ruta, versionado) {
  let rel = decodeURIComponent(ruta);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const archivo = path.normalize(path.join(PUBLIC_DIR, rel));
  if (archivo !== PUBLIC_DIR && !archivo.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(path.join(PUBLIC_DIR, '404.html')).on('error', () => res.end('No encontrado')).pipe(res);
    }
    const ext = path.extname(archivo);
    if (ext === '.html') {
      res.writeHead(200, { 'Content-Type': TIPOS[ext], 'Cache-Control': 'no-cache' });
      return fs.readFile(archivo, 'utf8', (e2, html) => res.end(e2 ? '' : html.replace(/(src|href)="((?:js|css|vendor)\/[^"?]+)"/g, (todo, attr, rec) => {
        try { return `${attr}="${rec}?v=${Math.round(fs.statSync(path.join(PUBLIC_DIR, rec)).mtimeMs / 1000).toString(36)}"`; } catch { return todo; }
      })));
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' || versionado ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    });
    fs.createReadStream(archivo).pipe(res);
  });
}

/* ---------- Servidor ---------- */
const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
};

http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CABECERAS_SEGURIDAD)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  let p = url.pathname;
  // Acepta las rutas con o sin el prefijo público (nginx puede quitarlo o no).
  if (BASE !== '/' && p.startsWith(BASE)) p = '/' + p.slice(BASE.length);
  try {
    if (p.startsWith('/api/')) return await api(req, res, p.slice(5).replace(/\/$/, ''), url.searchParams);
    if (req.method !== 'GET' && req.method !== 'HEAD') fallo(405, 'Método no permitido.');
    return estatico(req, res, p.slice(1), url.searchParams.has("v"));
  } catch (e) {
    if (e instanceof ErrorApi) return json(res, e.estado, { error: e.message });
    console.error(e);
    return json(res, 500, { error: 'Algo falló en el servidor.' });
  }
}).listen(PORT, () => {
  console.log(`The Field Forge v2 en el puerto ${PORT} (ruta pública ${BASE})`);
  console.log(`Plazas: ${MAX_USUARIOS} · Código de invitación: ${invitacion()}`);
});

/* ---------- Copia diaria de la base de datos ----------
   Una copia completa al día en DATA_DIR/copias (se guardan las 7 últimas). Si el disco o una actualización
   dañan forge.db, se recupera copiando encima el archivo del día que haga falta. */
function copiaDiaria() {
  try {
    const dir = path.join(DATA_DIR, 'copias');
    fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, `forge-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(destino)) db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
    const viejas = fs.readdirSync(dir).filter(f => /^forge-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -7);
    for (const f of viejas) fs.unlinkSync(path.join(dir, f));
  } catch (err) { console.error('No se pudo hacer la copia diaria:', err.message); }
}
copiaDiaria();
setInterval(copiaDiaria, 6 * 3600 * 1000).unref();
