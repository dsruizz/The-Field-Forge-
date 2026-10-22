/* The Field Forge — almacén local de la campaña.
   Estado en localStorage, imágenes en IndexedDB y sincronía entre ventanas
   (ventana del DM ↔ ventana del proyector) con BroadcastChannel. */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const KEY = 'tff.tumba.v1';
  const STAGE_KEY = 'tff.tumba.escenario';
  const listeners = new Set();
  let state = null;
  let stage = null;

  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const clone = o => JSON.parse(JSON.stringify(o));

  const stageDefault = () => ({
    modo: 'portada',          // portada | cronica | mapa | fichas | negro
    cronicaFoco: null,        // id de acontecimiento enfocado
    mapaId: null,
    fichas: [],               // ids de fichas en escena
    detalle: 'basico',        // oculto | basico | completo
    pulso: null,              // {tipo, id, t}: animaciones puntuales en el proyector
    t: 0
  });

  function readJSON(k) {
    try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { console.error(e); TFF.ui?.toast?.('No se pudo guardar: el almacenamiento del navegador está lleno. Exporta una copia y borra imágenes grandes.', 'error'); return false; }
  }

  function load() {
    state = readJSON(KEY);
    if (!state || !state.version) { state = clone(TFF.seed()); writeJSON(KEY, state); }
    stage = Object.assign(stageDefault(), readJSON(STAGE_KEY) || {});
    return state;
  }

  // Canal entre ventanas del mismo navegador.
  let channel = null;
  try { channel = new BroadcastChannel('tff-tumba'); } catch (e) { channel = null; }
  const send = msg => { try { channel && channel.postMessage(msg); } catch (e) {} };
  function receive(msg) {
    if (!msg || !msg.t) return;
    if (msg.t === 'state') { state = readJSON(KEY) || state; emit('state', true); }
    if (msg.t === 'stage') { stage = Object.assign(stageDefault(), readJSON(STAGE_KEY) || {}); emit('stage', true); }
    if (msg.t === 'ping') send({ t: 'pong', who: TFF.role || 'dm' });
    if (msg.t === 'pong') emit('pong:' + msg.who, true);
  }
  if (channel) channel.onmessage = e => receive(e.data);
  // Respaldo si BroadcastChannel no existe (p. ej. algunos file://).
  window.addEventListener('storage', e => {
    if (e.key === KEY) receive({ t: 'state' });
    if (e.key === STAGE_KEY) receive({ t: 'stage' });
  });

  function emit(kind, remote) { listeners.forEach(fn => { try { fn(kind, remote); } catch (e) { console.error(e); } }); }

  const store = {
    uid, clone,
    get state() { return state || load(); },
    get stage() { if (!stage) load(); return stage; },
    load,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // Muta el estado con fn(state) y lo guarda/difunde.
    update(fn) {
      fn(store.state);
      writeJSON(KEY, state);
      send({ t: 'state' });
      emit('state', false);
    },
    setStage(patch) {
      Object.assign(store.stage, patch, { t: Date.now() });
      writeJSON(STAGE_KEY, stage);
      send({ t: 'stage' });
      emit('stage', false);
    },
    pulse(tipo, id) { store.setStage({ pulso: { tipo, id, t: Date.now() } }); },
    ping() { send({ t: 'ping' }); },
    find(col, id) { return (store.state[col] || []).find(x => x.id === id); },
    reset() {
      state = clone(TFF.seed()); writeJSON(KEY, state);
      stage = stageDefault(); writeJSON(STAGE_KEY, stage);
      send({ t: 'state' }); send({ t: 'stage' }); emit('state', false); emit('stage', false);
    },
    async exportar() {
      const data = { formato: 'the-field-forge', version: 1, exportado: new Date().toISOString(), estado: state, imagenes: {} };
      const refs = new Set();
      JSON.stringify(state, (k, v) => { if (typeof v === 'string' && v.startsWith('idb:')) refs.add(v); return v; });
      for (const ref of refs) {
        const blob = await TFF.img.blob(ref);
        if (blob) data.imagenes[ref] = await blobToDataURL(blob);
      }
      const file = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = 'field-forge-tumba-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    async importar(file) {
      const data = JSON.parse(await file.text());
      if (data.formato !== 'the-field-forge' || !data.estado) throw new Error('El archivo no es una copia de The Field Forge.');
      for (const [ref, url] of Object.entries(data.imagenes || {})) {
        const blob = await (await fetch(url)).blob();
        await TFF.img.putBlob(ref.slice(4), blob);
      }
      state = data.estado; writeJSON(KEY, state); send({ t: 'state' }); emit('state', false);
    }
  };

  function blobToDataURL(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  }

  /* ---------- Imágenes: IndexedDB ---------- */
  const DB = 'tff-imagenes', OS = 'img';
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(OS);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(OS, mode); const s = t.objectStore(OS);
      const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
    });
  }
  const urlCache = new Map();

  // Reduce imágenes enormes para no llenar el navegador. Mapas: 3200px, retratos: 1400px.
  async function shrink(file, max) {
    if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 2.5e6) { bmp.close?.(); return file; }
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
      const out = await new Promise(r => c.toBlob(r, 'image/webp', 0.88));
      return out && out.size < file.size ? out : file;
    } catch (e) { return file; }
  }

  TFF.img = {
    async put(file, { max = 1400 } = {}) {
      const blob = await shrink(file, max);
      const id = uid('img');
      await TFF.img.putBlob(id, blob);
      return 'idb:' + id;
    },
    putBlob(id, blob) { return tx('readwrite', s => s.put(blob, id)); },
    async blob(ref) {
      if (!ref || !ref.startsWith('idb:')) return null;
      return tx('readonly', s => s.get(ref.slice(4)));
    },
    async url(ref) {
      if (!ref) return '';
      if (!ref.startsWith('idb:')) return ref;
      if (urlCache.has(ref)) return urlCache.get(ref);
      const b = await TFF.img.blob(ref);
      if (!b) return '';
      const u = URL.createObjectURL(b); urlCache.set(ref, u); return u;
    },
    async remove(ref) {
      if (!ref || !ref.startsWith('idb:')) return;
      urlCache.delete(ref);
      await tx('readwrite', s => s.delete(ref.slice(4)));
    },
    // Rellena <img data-img="ref"> y [data-bg="ref"] dentro de root.
    hydrate(root = document) {
      root.querySelectorAll('[data-img]').forEach(async el => {
        const ref = el.getAttribute('data-img'); if (!ref) return;
        const u = await TFF.img.url(ref);
        if (u && el.getAttribute('data-img') === ref) { el.src = u; el.classList.add('is-loaded'); }
      });
      root.querySelectorAll('[data-bg]').forEach(async el => {
        const ref = el.getAttribute('data-bg'); if (!ref) return;
        const u = await TFF.img.url(ref);
        if (u && el.getAttribute('data-bg') === ref) el.style.backgroundImage = 'url("' + u + '")';
      });
    }
  };

  TFF.store = store;
})();
