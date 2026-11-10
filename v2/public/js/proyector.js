/* Proyector: la pantalla que ve la mesa. No tiene controles: refleja lo que el DM prepara en la mesa.
   Se abre en el mismo navegador que la mesa del DM y se arrastra a la pantalla o al proyector. */
(() => {
  const F = window.Forja;
  const id = new URLSearchParams(location.search).get('id') || '';
  const tab = F.tablero.montar(document.querySelector('[data-tablero]'));
  const espera = document.querySelector('[data-espera]'), pista = document.querySelector('[data-completa]');
  const CLAVE = 'forja.mesa.' + id;

  const aplicar = s => {
    if (!s || typeof s !== 'object') return;
    espera.hidden = true;
    if (s.parcial) return tab.pintar(s.escena);
    tab.estado(s);
  };
  try { aplicar(JSON.parse(localStorage.getItem(CLAVE))); } catch { /* sin estado guardado */ }
  if ('BroadcastChannel' in window) {
    const canal = new BroadcastChannel('forja-mesa-' + id);
    canal.onmessage = ev => aplicar(ev.data);
    canal.postMessage('hola');
  }
  addEventListener('storage', ev => { if (ev.key === CLAVE && ev.newValue) { try { aplicar(JSON.parse(ev.newValue)); } catch { /* ignorar */ } } });

  const completa = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); };
  pista.addEventListener('click', completa);
  addEventListener('keydown', ev => { if (ev.key === 'f' || ev.key === 'F') completa(); });
  document.addEventListener('fullscreenchange', () => { pista.hidden = !!document.fullscreenElement; });
  // El ratón y la pista se esconden solos para no ensuciar la proyección.
  let reloj;
  const despertar = () => { document.body.classList.remove('is-quieto'); clearTimeout(reloj); reloj = setTimeout(() => document.body.classList.add('is-quieto'), 2500); };
  addEventListener('pointermove', despertar); despertar();
})();
