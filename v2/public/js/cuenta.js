/* Entrar y crear cuenta. */
(async () => {
  const F = window.Forja;
  F.montarBarra(null);
  const params = new URLSearchParams(location.search);
  const volver = params.get('volver');
  const destino = volver && /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(volver) ? volver : 'campanas.html';

  if (await F.yo().catch(() => null)) return location.replace(destino);

  const tabs = { entrar: document.getElementById('tab-entrar'), registro: document.getElementById('tab-registro') };
  const forms = { entrar: document.getElementById('form-entrar'), registro: document.getElementById('form-registro') };
  const captchas = {};

  function mostrar(modo) {
    for (const k of Object.keys(tabs)) {
      const activo = k === modo;
      tabs[k].setAttribute('aria-selected', String(activo));
      tabs[k].tabIndex = activo ? 0 : -1;
      forms[k].hidden = !activo;
    }
    document.title = (modo === 'registro' ? 'Crear cuenta' : 'Entrar') + ' · The Field Forge';
    history.replaceState(null, '', modo === 'registro' ? '?modo=registro' + (volver ? '&volver=' + encodeURIComponent(volver) : '') : (volver ? '?volver=' + encodeURIComponent(volver) : location.pathname));
  }
  for (const [k, t] of Object.entries(tabs)) {
    t.addEventListener('click', () => mostrar(k));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const otro = k === 'entrar' ? 'registro' : 'entrar'; mostrar(otro); tabs[otro].focus(); }
    });
  }

  for (const [modo, form] of Object.entries(forms)) {
    const cap = captchas[modo] = F.captcha(form.querySelector('.captcha'));
    // Empieza a resolver el reto en cuanto la persona toca el formulario: al enviar ya suele estar listo.
    form.addEventListener('focusin', () => cap.empezar(), { once: true });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const aviso = form.querySelector('.aviso'), boton = form.querySelector('[type=submit]');
      aviso.textContent = '';
      form.querySelectorAll('.entrada').forEach(i => i.removeAttribute('aria-invalid'));
      const invalido = [...form.querySelectorAll('.entrada')].find(i => !i.checkValidity());
      if (invalido) {
        invalido.setAttribute('aria-invalid', 'true'); invalido.focus();
        aviso.textContent = invalido.validationMessage || 'Revisa este campo.';
        return;
      }
      F.ocupado(boton, true, modo === 'registro' ? 'Creando cuenta…' : 'Entrando…');
      try {
        const captcha = await cap.obtener();
        await F.api(modo, { metodo: 'POST', datos: { ...F.datosForm(form), captcha } });
        location.replace(destino);
      } catch (err) {
        aviso.textContent = err.message;
        cap.reiniciar();
        F.ocupado(boton, false);
      }
    });
  }

  mostrar(params.get('modo') === 'registro' ? 'registro' : 'entrar');
})();
