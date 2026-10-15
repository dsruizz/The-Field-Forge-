/* 
(function () {
  const archivos = ["/", "/css/style.css", "/js/script.js"];
  const versiones = {};

  async function revisar() {
    for (const url of archivos) {
      try {
        const r = await fetch(url, { method: "HEAD", cache: "no-store" });
        const v = r.headers.get("etag") || r.headers.get("last-modified");
        if (versiones[url] && versiones[url] !== v) {
          location.reload();
          return;
        }
        versiones[url] = v;
      } catch (e) {}
    }
  }

  setInterval(revisar, 1000);
})();*/
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // GSAP scroll choreography. Falls back to visible content if CDN is unavailable.
  if (window.gsap && window.ScrollTrigger && !reduceMotion) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.from('.hero .reveal', {y:34, opacity:0, duration:.85, stagger:.13, ease:'power3.out', delay:.15});
    gsap.from('.hero-art', {y:35, opacity:0, rotate:4, duration:1.15, ease:'power3.out', delay:.25});
    $$('.section-head .reveal, .intro-grid .reveal, .mini-card.reveal, .dashboard.reveal, .phone.reveal, .phone-layout .reveal, .geiger-device.reveal, .geiger-copy.reveal').forEach(el => {
      gsap.from(el, {y:35, opacity:0, duration:.75, ease:'power2.out', scrollTrigger:{trigger:el, start:'top 86%', once:true}});
    });
    $$('.scene').forEach((scene, i) => {
      const visual = $('.scene-visual', scene), copy = $('.scene-copy', scene);
      gsap.from(copy, {x:-25, opacity:0, duration:.7, ease:'power2.out', scrollTrigger:{trigger:scene,start:'top 72%',once:true}});
      gsap.from(visual, {x:25, opacity:0, rotate:i%2 ? 2 : -2, duration:.8, ease:'power2.out', scrollTrigger:{trigger:scene,start:'top 72%',once:true}});
      gsap.to(visual, {y:-16, ease:'none', scrollTrigger:{trigger:scene,start:'top bottom',end:'bottom top',scrub:.7}});
    });
    gsap.to('.hero-art', {y:45, ease:'none', scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:.8}});
  } else {
    $$('.reveal').forEach(el => {el.style.opacity=1;el.style.transform='none';});
  }

  // Geiger state shared between large device, HUD and player preview.
  let exposure = 3;
  const statusFor = n => n >= 10 ? ['CRÍTICO','critical'] : n >= 8 ? ['ALERTA','warn'] : n >= 5 ? ['RIESGO','warn'] : ['NORMAL','safe'];
  function renderGeiger() {
    const [label, level] = statusFor(exposure);
    ['#bigGeigerValue','#hudValue'].forEach(s => {const el=$(s); if(el) el.textContent=exposure;});
    $('#bigGeigerStatus').textContent = exposure >= 10 ? 'EVENTO CRÍTICO — DECISIÓN DEL DM' : exposure >= 8 ? 'ALERTA — RASTREO ENEMIGO' : exposure >= 5 ? 'RIESGO — TIRADA DE MUTACIÓN' : 'NORMAL — SIN EFECTOS';
    $('#hudStatus').textContent = '● ' + label;
    $('#dashRisk').textContent = String(exposure).padStart(2,'0') + '/10';
    $('#phoneGeiger').textContent = String(exposure).padStart(2,'0') + '/10';
    ['#bigMeter','#hudTrack'].forEach(sel => {
      const node=$(sel); node.innerHTML='';
      for(let i=0;i<10;i++){const span=document.createElement('span');if(i<exposure)span.className=i>=7?'critical':i>=4?'warn':'on';node.appendChild(span);}
    });
  }
  function setExposure(n){exposure=Math.max(0,Math.min(10,n));renderGeiger();}
  $('#geoUp').addEventListener('click',()=>setExposure(exposure+1));
  $('#geoDown').addEventListener('click',()=>setExposure(exposure-1));
  $('#geoReset').addEventListener('click',()=>setExposure(0));
  $('#hudUp').addEventListener('click',()=>setExposure(exposure+1));
  $('#hudDown').addEventListener('click',()=>setExposure(exposure-1));
  renderGeiger();

  // Movable HUD and basic resizing.
  const hud=$('#geigerHud'), drag=$('#hudDrag');
  let dragging=false, startX=0, startY=0, startLeft=0, startTop=0;
  drag.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')) return;
    dragging=true; const r=hud.getBoundingClientRect(); startX=e.clientX;startY=e.clientY;startLeft=r.left;startTop=r.top;
    drag.setPointerCapture(e.pointerId); hud.style.right='auto';hud.style.bottom='auto';hud.style.left=r.left+'px';hud.style.top=r.top+'px';
  });
  drag.addEventListener('pointermove',e=>{
    if(!dragging)return;
    hud.style.left=Math.max(0,Math.min(innerWidth-hud.offsetWidth,startLeft+e.clientX-startX))+'px';
    hud.style.top=Math.max(60,Math.min(innerHeight-hud.offsetHeight,startTop+e.clientY-startY))+'px';
  });
  drag.addEventListener('pointerup',()=>dragging=false);
  let resizing=false, resizeX=0, resizeW=0;
  $('#hudResize').addEventListener('pointerdown',e=>{resizing=true;resizeX=e.clientX;resizeW=hud.offsetWidth;e.target.setPointerCapture(e.pointerId);e.preventDefault();});
  $('#hudResize').addEventListener('pointermove',e=>{if(resizing)hud.style.width=Math.max(145,Math.min(320,resizeW+e.clientX-resizeX))+'px';});
  $('#hudResize').addEventListener('pointerup',()=>resizing=false);
  function hideHud(){hud.classList.add('hidden');$('#showHud').classList.add('show');}
  function showHud(){hud.classList.remove('hidden');$('#showHud').classList.remove('show');}
  $('#hudClose').addEventListener('click',hideHud);$('#toggleHud').addEventListener('click',()=>hud.classList.contains('hidden')?showHud():hideHud());$('#showHud').addEventListener('click',showHud);

  // Edit panel + replaceable art containers.
  $('#editToggle').addEventListener('click',()=>$('#editPanel').classList.toggle('open'));
  const targets = {
    hero: {container:$('.art-frame'), placeholder:$('#heroPlaceholder')},
    scene1: {container:$('.scene')[0]?.querySelector('.scene-visual')},
    scene2: {container:$('.scene')[1]?.querySelector('.scene-visual')},
    scene3: {container:$('.scene')[2]?.querySelector('.scene-visual')},
    scene4: {container:$('.scene')[3]?.querySelector('.scene-visual')},
    scene5: {container:$('.scene')[4]?.querySelector('.scene-visual')}
  };
  $('#applyImage').addEventListener('click',()=>{
    const key=$('#imageTarget').value, url=$('#imageUrl').value.trim();
    if(!url){alert('Pega primero una URL de imagen.');return;}
    const target=targets[key]; if(!target)return;
    let img=target.container.querySelector('img');
    if(!img){img=document.createElement('img');img.alt='Imagen de campaña editable';target.container.prepend(img);}
    img.src=url;img.style.display='block';img.onerror=()=>alert('No se pudo cargar la imagen. Comprueba la URL y que permita mostrar imágenes externas.');
    const ph=target.container.querySelector('.visual-placeholder');if(ph)ph.style.opacity='.18';
    if(target.placeholder)target.placeholder.style.display='none';
    $('#imageUrl').value='';
  });
  $$('.scene-copy p, .story-card-content p, .hero-lede, .art-caption strong').forEach(el=>{
    el.setAttribute('title','Haz clic para editar este texto');
  });

  // Conceptual dashboard tabs.
  const tabContent={
    map:{title:'Zonas de Prípiat',label:'Mapa / editable en concepto',html:$('#campaignMap').outerHTML,button:'+ Añadir zona'},
    session:{title:'Registro de sesión',label:'Memoria / acontecimientos',html:'<div style="display:grid;gap:10px;margin-top:14px"><div style="padding:14px;background:#d9d9d1;border-left:3px solid #9f2c27"><small>ACTO I · ENCUENTRO</small><h3 style="font-size:24px;margin:7px 0">Reese y Michael</h3><p style="font-size:11px;margin:0">Dos supervivientes entran juntos en la casa real.</p></div><div style="padding:14px;background:#d9d9d1;border-left:3px solid #465173"><small>ACTO III · CONSECUENCIA</small><h3 style="font-size:24px;margin:7px 0">La caída del rey</h3><p style="font-size:11px;margin:0">La familia real ha sido alcanzada por la contaminación.</p></div></div>',button:'+ Nuevo acontecimiento'},
    entities:{title:'Personajes y NPC',label:'Entidades / archivo de campaña',html:'<div class="entity-list" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px"><div class="entity"><div class="entity-icon">R</div><div><b>Reese</b><span>Vagabundo / fallecido</span></div></div><div class="entity"><div class="entity-icon">M</div><div><b>Michael T.</b><span>Soldado / superviviente</span></div></div><div class="entity"><div class="entity-icon">K</div><div><b>El Rey</b><span>Corrompido</span></div></div><div class="entity"><div class="entity-icon">☠</div><div><b>Corrompido alfa</b><span>Enemigo / peligro alto</span></div></div></div>',button:'+ Crear entidad'},
    inventory:{title:'Inventario',label:'Recursos / equipo',html:'<div class="entity-list" style="margin-top:14px"><div class="entity"><div class="entity-icon">▣</div><div><b>Camioneta real</b><span>Transporte / obtenida</span></div></div><div class="entity"><div class="entity-icon">✚</div><div><b>Botiquín de campo</b><span>Medicina / recurso</span></div></div><div class="entity"><div class="entity-icon">☢</div><div><b>Filtros Geiger</b><span>Protección / consumible</span></div></div></div>',button:'+ Añadir objeto'},
    stats:{title:'Estadísticas',label:'Datos / combate',html:'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px"><div class="dash-stat"><b>+3</b><span>Fuerza</span></div><div class="dash-stat"><b>+2</b><span>Reflejos</span></div><div class="dash-stat"><b>12/15</b><span>Puntos de vida</span></div><div class="dash-stat"><b>03/10</b><span>Exposición</span></div></div>',button:'Editar estadísticas'}
  };
  $$('.dash-nav button').forEach(btn=>btn.addEventListener('click',()=>{
    $$('.dash-nav button').forEach(b=>b.classList.toggle('active',b===btn));
    const data=tabContent[btn.dataset.tab];$('#dashTitle').textContent=data.title;$('#panelLabel').textContent=data.label;$('#mainDashPanel').innerHTML='<div class="panel-label" id="panelLabel">'+data.label+'</div>'+data.html+'<p style="font-size:10px;color:#777;margin:12px 0 0">Prototipo visual: los datos son de demostración y no se guardan.</p>';$('#addMapPin').textContent=data.button;
    if(btn.dataset.tab==='map') wireMap(); else $('#addMapPin').onclick=()=>alert('Acción conceptual: esta función se definiría en una siguiente iteración.');
  }));
  function wireMap(){
    const map=$('#campaignMap'); if(!map)return;
    $('#addMapPin').onclick=()=>{
      const pin=document.createElement('div');pin.className='map-pin';pin.style.left=(10+Math.random()*75)+'%';pin.style.top=(12+Math.random()*70)+'%';pin.style.background='#AAD431';pin.style.boxShadow='0 0 0 1px #262626';map.appendChild(pin);
    };
  }
  wireMap();

  // Player view interactions.
  let hp=12;const maxHp=15;
  function renderHp(){ $('#playerHp').textContent=hp+' / '+maxHp;$('#playerHpBar').style.width=(hp/maxHp*100)+'%';$('#playerHpBar').style.background=hp<=4?'#9f2c27':hp<=8?'#fde134':'#9f2c27';}
  $('#playerDamage').addEventListener('click',()=>{hp=Math.max(0,hp-3);renderHp();});
  $('#playerHeal').addEventListener('click',()=>{hp=Math.min(maxHp,hp+2);renderHp();});
  renderHp();
})();