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
const MAX_USUARIOS = Number(process.env.TFF_MAX_USUARIOS || 3);
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
`);

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

/* ---------- Consola ---------- */
const [, , orden, a1, a2] = process.argv;
if (orden === 'invitacion') {
  if (a1) { fijarAjuste('invitacion', a1); console.log('Código de invitación cambiado a', a1); }
  else console.log('Código de invitación:', invitacion());
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
function resumenCampana(c, rol) {
  const jugadores = db.prepare("SELECT COUNT(*) n FROM membresias WHERE campana_id = ? AND rol = 'jugador'").get(c.id).n;
  const partidas = db.prepare('SELECT COUNT(*) n, MAX(fecha) ultima FROM partidas WHERE campana_id = ?').get(c.id);
  const dm = db.prepare('SELECT usuario FROM usuarios WHERE id = ?').get(c.dueno_id);
  return {
    id: c.id, nombre: c.nombre, ambientacion: c.ambientacion, sinopsis: c.sinopsis,
    rol, dm: dm ? dm.usuario : '', jugadores, partidas: partidas.n, ultimaPartida: partidas.ultima || null,
    actualizada: c.actualizada,
    ...(rol === 'dm' ? { codigo: c.codigo } : {})
  };
}
function membresia(campanaId, usuarioId) {
  return db.prepare('SELECT rol FROM membresias WHERE campana_id = ? AND usuario_id = ?').get(campanaId, usuarioId);
}

/* ---------- Rutas de la API ---------- */
async function api(req, res, ruta) {
  const m = req.method;
  const ip = ipDe(req);

  // Defensa CSRF: las escrituras deben venir en JSON y desde el mismo origen.
  if (m !== 'GET') {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) fallo(415, 'Se esperaba JSON.');
    const origen = req.headers.origin;
    if (origen && new URL(origen).host !== req.headers.host) fallo(403, 'Origen no permitido.');
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
    const id = crypto.randomBytes(6).toString('base64url');
    let codigo; do codigo = codigoLegible(6); while (db.prepare('SELECT 1 FROM campanas WHERE codigo = ?').get(codigo));
    const ahora = Date.now();
    db.prepare(`INSERT INTO campanas (id, nombre, ambientacion, sinopsis, codigo, clave_hash, dueno_id, creada, actualizada)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, nombre, texto(b.ambientacion, 120), texto(b.sinopsis, 1200), codigo, hashClave(clave), u.id, ahora, ahora);
    db.prepare("INSERT INTO membresias (campana_id, usuario_id, rol, unido) VALUES (?, ?, 'dm', ?)").run(id, u.id, ahora);
    const c = db.prepare('SELECT * FROM campanas WHERE id = ?').get(id);
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
function estatico(req, res, ruta) {
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
    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    });
    fs.createReadStream(archivo).pipe(res);
  });
}

/* ---------- Servidor ---------- */
const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CABECERAS_SEGURIDAD)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  let p = url.pathname;
  // Acepta las rutas con o sin el prefijo público (nginx puede quitarlo o no).
  if (BASE !== '/' && p.startsWith(BASE)) p = '/' + p.slice(BASE.length);
  try {
    if (p.startsWith('/api/')) return await api(req, res, p.slice(5).replace(/\/$/, ''));
    if (req.method !== 'GET' && req.method !== 'HEAD') fallo(405, 'Método no permitido.');
    return estatico(req, res, p.slice(1));
  } catch (e) {
    if (e instanceof ErrorApi) return json(res, e.estado, { error: e.message });
    console.error(e);
    return json(res, 500, { error: 'Algo falló en el servidor.' });
  }
}).listen(PORT, () => {
  console.log(`The Field Forge v2 en el puerto ${PORT} (ruta pública ${BASE})`);
  console.log(`Plazas: ${MAX_USUARIOS} · Código de invitación: ${invitacion()}`);
});
