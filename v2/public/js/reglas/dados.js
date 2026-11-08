/* Dados y utilidades que necesita el motor de reglas (copiado del motor de la versión clásica). */
(() => {
  const TFF = (window.TFF = window.TFF || {});
  const roll = (n, d) => { let t = 0; for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * d); return t; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtMod = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const mod = s => Math.floor((s - 10) / 2);
  TFF.dice = { roll, pick, shuffle, fmtMod, mod };
  TFF.esc = TFF.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
})();
(() => {
  const TFF = window.TFF;
  TFF.store = TFF.store || { uid: (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4) };
})();
