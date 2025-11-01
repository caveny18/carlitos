// aprender.js (module)
// Mapa interactivo + modo oscuro gamer pro
const PROFILE_KEY = 'carlitos_profile_data';
const LEVELS_PROGRESS_KEY = 'carlitos_levels_progress';
const THEME_KEY = 'carlitos_learn_theme';
const IMG_PATH = ''; // ajusta si tus imágenes están en subcarpeta

// DOM
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const playerNameEl = $('#player-name');
const badgeStars = $('#badge-stars');
const badgeCoins = $('#badge-coins');
const badgeLives = $('#badge-lives');
const levelsGridWrap = $('#map-nodes');
const svgEl = $('#map-svg');
const detailPanel = $('#detail-panel');
const detailTitle = $('#detail-title');
const detailDesc = $('#detail-desc');
const detailIcon = $('#detail-icon');
const btnStartSection = $('#btn-start-section');
const btnPreview = $('#btn-preview');
const btnSimulate = $('#btn-simulate');
const streakEl = $('#streak');
const currentLevelEl = $('#current-level');
const progressMonthEl = $('#progress-month');
const toggleThemeBtn = $('#toggle-theme-btn');
const mapWrap = $('#map-canvas-wrap');
const btnTour = $('#btn-tour');
const btnQuick = $('#btn-quick');
const filterSelect = $('#filter-mode');

// CATEGORIES (map nodes)
const CATEGORIES = [
  { id:'presupuesto', title:'Presupuesto', desc:'Divide ingresos con la regla 50/30/20. Ajusta tu flujo.', color:'#10B981', difficulty:'beginner' },
  { id:'ahorro', title:'Ahorro', desc:'Cajas, metas y automatización del ahorro.', color:'#F97316', difficulty:'beginner' },
  { id:'deuda', title:'Deuda', desc:'Prioriza y reduce deuda con estrategia.', color:'#FB7185', difficulty:'beginner' },
  { id:'fondo_emergencia', title:'Fondo Emergencia', desc:'Construye un colchón de 3–6 meses.', color:'#8B5CF6', difficulty:'med' },
  { id:'inversion', title:'Inversión', desc:'Riesgo, diversificación y horizonte temporal.', color:'#06B6D4', difficulty:'med' },
  { id:'seguros', title:'Seguros', desc:'Protege tu salud y bienes eficientemente.', color:'#F59E0B', difficulty:'med' },
  { id:'impuestos', title:'Impuestos', desc:'Optimiza impuestos dentro de la ley.', color:'#9333EA', difficulty:'adv' },
  { id:'retiro', title:'Retiro', desc:'Planifica tu jubilación con anticipación.', color:'#0EA5A4', difficulty:'adv' }
];

// cargar perfil local
function loadProfile(){
  try{
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { name:'Explorador', totalXP:0, carlitosCoins:0, badgeStars:0, lives:5, assignedTutor:'Ardilla', streak:0, levelName:'Novato' };
    const p = JSON.parse(raw);
    return {
      name: p.name || p.nombre || 'Explorador',
      totalXP: Number(p.totalXP || p.xp || 0),
      carlitosCoins: Number(p.carlitosCoins || p.coins || 0),
      badgeStars: Number(p.badgeStars || 0),
      lives: Number(p.lives || 5),
      assignedTutor: p.assignedTutor || 'Ardilla',
      streak: Number(p.streak || 0),
      levelName: p.levelName || 'Novato'
    };
  } catch(e){ return { name:'Explorador', totalXP:0, carlitosCoins:0, badgeStars:0, lives:5, assignedTutor:'Ardilla', streak:0, levelName:'Novato' }; }
}
let profile = loadProfile();

// progress
let progressState = JSON.parse(localStorage.getItem(LEVELS_PROGRESS_KEY) || 'null') || {};
if (!progressState || Object.keys(progressState).length === 0) {
  CATEGORIES.forEach((c,i) => {
    progressState[c.id] = { pct: i===0 ? 20 : 0, completed: i===0, unlocked: i<2 };
  });
  localStorage.setItem(LEVELS_PROGRESS_KEY, JSON.stringify(progressState));
}

// RENDER HEADER
function renderHeader(){
  playerNameEl.textContent = profile.name;
  badgeStars.textContent = profile.badgeStars || 0;
  badgeCoins.textContent = profile.carlitosCoins || 0;
  badgeLives.textContent = profile.lives || 5;
  streakEl.textContent = (profile.streak || 0) + ' días';
  currentLevelEl.textContent = profile.levelName || 'Novato';
  const monthly = Math.min(100, (profile.totalXP % 800) / 8);
  if (progressMonthEl) progressMonthEl.style.width = monthly + '%';
}
renderHeader();

// MAP LAYOUT: predefined coordinates for nodes (you can tweak positions)
const NODE_LAYOUT = [
  { x: 120, y: 60 },   // presupuesto
  { x: 340, y: 40 },   // ahorro
  { x: 560, y: 90 },   // deuda
  { x: 780, y: 150 },  // fondo_emergencia
  { x: 980, y: 220 },  // inversion
  { x: 760, y: 320 },  // seguros
  { x: 520, y: 360 },  // impuestos
  { x: 300, y: 300 }   // retiro
];

// create node DOM + attach
function buildMap(filter='all'){
  levelsGridWrap.innerHTML = '';
  svgEl.innerHTML = '';
  // place nodes
  CATEGORIES.forEach((c, idx) => {
    if (filter !== 'all' && c.difficulty !== filter) return;
    const pos = NODE_LAYOUT[idx] || { x: 120 + idx*100, y: 80 + (idx%3)*80 };
    const node = document.createElement('div');
    node.className = 'map-node';
    node.dataset.id = c.id;
    node.dataset.index = idx;
    node.style.left = pos.x + 'px';
    node.style.top = pos.y + 'px';
    node.style.background = `linear-gradient(180deg, ${c.color}, ${shadeColor(c.color,-12)})`;
    // locked / completed
    const st = progressState[c.id] || { pct:0, completed:false, unlocked:false };
    if (!st.unlocked) node.classList.add('locked');
    if (st.completed) node.classList.add('completed');

    // inner content
    node.innerHTML = `
      <div class="node-ring" aria-hidden="true"></div>
      <div class="node-core">${c.title[0]}</div>
      <div class="node-sparkle" aria-hidden="true"></div>
      <div class="node-label">${c.title}</div>
    `;
    // attach events
    node.addEventListener('click', () => openDetail(c));
    node.addEventListener('touchstart', () => openDetail(c));
    levelsGridWrap.appendChild(node);
  });

  // draw connections (simple: connect sequential nodes; also connect branches)
  drawConnections();
  // add small entrance animations
  $$('.map-node').forEach((n,i)=> {
    n.animate([{ transform: 'translateY(18px)', opacity: 0 }, { transform: 'translateY(0px)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,.9,.3,1)', delay: i*60, fill:'forwards' });
  });
}

// draw svg paths connecting nodes (basic polyline between center points)
function drawConnections(){
  const nodes = $$('.map-node');
  if (!nodes.length) return;
  // build map of id->center
  const centers = nodes.map(n => {
    const r = n.getBoundingClientRect();
    const parent = levelsGridWrap.getBoundingClientRect();
    return {
      id: n.dataset.id,
      x: (r.left - parent.left) + r.width/2,
      y: (r.top - parent.top) + r.height/2
    };
  });
  // helper to create path between two points
  function makePath(p1, p2){
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const mx = p1.x + dx/2;
    // cubic bezier control points for smooth curve
    const cp1x = p1.x + Math.sign(dx) * Math.abs(dx) * 0.25;
    const cp1y = p1.y;
    const cp2x = p2.x - Math.sign(dx) * Math.abs(dx) * 0.25;
    const cp2y = p2.y;
    return `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  // simple strategy: connect in index order and a few cross-links for map feeling
  const order = centers; // index order
  const paths = [];
  for (let i=0;i<order.length-1;i++){
    paths.push(makePath(order[i], order[i+1]));
  }
  // add a couple of extra links to look like a map
  if (order.length >= 5) paths.push(makePath(order[1], order[4]));
  if (order.length >= 7) paths.push(makePath(order[2], order[6]));

  // render paths to svg
  svgEl.innerHTML = '';
  paths.forEach((d,i) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke', (document.body.classList.contains('dark-theme') ? 'rgba(0,255,213,0.22)' : 'rgba(15,23,42,0.06)'));
    path.setAttribute('stroke-width','3');
    path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');
    path.style.opacity = 0;
    svgEl.appendChild(path);
    // animate stroke draw
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    setTimeout(()=> {
      path.style.transition = 'stroke-dashoffset 900ms ease, opacity 600ms ease';
      path.style.strokeDashoffset = '0';
      path.style.opacity = 1;
    }, 200 + i*120);
  });
}

// shade color (helper)
function shadeColor(hex, percent) {
  const f = hex.slice(1), t = percent < 0 ? 0 : 255, p = Math.abs(percent)/100;
  const R = parseInt(f.substring(0,2),16), G = parseInt(f.substring(2,4),16), B = parseInt(f.substring(4,6),16);
  const newR = Math.round((t - R) * p) + R;
  const newG = Math.round((t - G) * p) + G;
  const newB = Math.round((t - B) * p) + B;
  return `rgb(${newR},${newG},${newB})`;
}

// OPEN DETAIL CARD
function openDetail(category){
  detailPanel.scrollIntoView({behavior:'smooth', block:'center'});
  detailTitle.textContent = category.title;
  detailDesc.textContent = category.desc;
  detailIcon.innerHTML = `<div style="width:72px;height:72px;border-radius:12px;background:${category.color};display:grid;place-items:center;color:white;font-weight:900">${category.title[0]}</div>`;
  $('#detail-coins').textContent = '+20';
  $('#detail-xp').textContent = '+50';
  $('#detail-difficulty').textContent = category.difficulty === 'beginner' ? 'Principiante' : (category.difficulty === 'med' ? 'Intermedio' : 'Avanzado');
  detailPanel.dataset.selected = category.id;

  // Setup start button
  btnStartSection.onclick = () => {
    simulateCompleteLevel(category.id);
  };

  // Preview modal
  btnPreview.onclick = () => {
    const html = `<h3 style="margin:0">${category.title} — Vista previa</h3>
    <p class="muted" style="margin-top:8px">${category.desc}</p>
    <div style="margin-top:12px"><strong>Contenido:</strong> Mini juego de decisiones + 5 preguntas rápidas.</div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px">
      <button id="pv-close" class="btn-ghost">Cerrar</button>
      <button id="pv-go" class="btn-primary-sm" style="margin-left:8px">Ir a lección</button>
    </div>`;
    const modal = openModal(html);
    modal.querySelector('#pv-close').onclick = closeModal;
    modal.querySelector('#pv-go').onclick = () => {
      closeModal();
      window.location.href = `leccion_${category.id}.html`;
    };
  };
}

// simulate completing a level (rewards + confetti)
function simulateCompleteLevel(id){
  const st = progressState[id] || { pct:0, unlocked:true };
  st.pct = Math.min(100, (st.pct || 0) + (st.pct > 60 ? 40 : 30));
  if (st.pct >= 100) st.completed = true;
  progressState[id] = st;
  localStorage.setItem(LEVELS_PROGRESS_KEY, JSON.stringify(progressState));

  // award
  const awardCoins = 25;
  const awardXP = 75;
  profile.carlitosCoins = (profile.carlitosCoins || 0) + awardCoins;
  profile.totalXP = (profile.totalXP || 0) + awardXP;
  if (st.completed) profile.badgeStars = (profile.badgeStars || 0) + 1;

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  renderHeader();
  buildMap(filterSelect.value);

  // effects
  if (st.completed) {
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.3 }});
    showToast(`¡Sección completada! +${awardCoins} coins · +${awardXP} XP`);
  } else {
    showToast(`Progreso guardado +${awardXP} XP`);
  }
}

// MODALS (simple)
function openModal(html){
  const backdrop = document.createElement('div');
  backdrop.className = 'tour-overlay';
  const box = document.createElement('div');
  box.className = 'tour-bubble';
  box.innerHTML = html;
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e)=> { if (e.target === backdrop) closeModal(); });
  return box;
}
function closeModal(){ const el = document.querySelector('.tour-overlay'); if (el) el.remove(); }

// TOAST
function showToast(msg, ttl=1700){
  let el = document.getElementById('carlitos-toast');
  if (!el){
    el = document.createElement('div'); el.id = 'carlitos-toast';
    el.style.position = 'fixed'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)';
    el.style.bottom = '110px'; el.style.background = 'rgba(2,6,23,0.9)'; el.style.color = '#fff';
    el.style.padding = '10px 14px'; el.style.borderRadius = '999px'; el.style.zIndex = 99999; el.style.opacity='0';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
  setTimeout(()=> el.style.opacity = '0', ttl);
}

// TOUR: simple spotlight
function startTour(){
  const steps = [
    { sel: '.topbar', title: 'Panel superior', text: 'Aquí ves tus monedas, estrellas y vidas.' },
    { sel: '#map-canvas-wrap', title: 'Mapa interactivo', text: 'Explora los nodos, completa niveles y gana recompensas.' },
    { sel: '#detail-panel', title: 'Panel detalle', text: 'Desde aquí puedes empezar la sección o ver una vista previa.' },
    { sel: '.stat-card', title: 'Progreso', text: 'Mira tu racha, nivel y progreso mensual.' }
  ];
  const root = $('#tour-root'); root.innerHTML = '';
  const overlay = document.createElement('div'); overlay.className = 'tour-overlay';
  const bubble = document.createElement('div'); bubble.className = 'tour-bubble';
  root.appendChild(overlay); root.appendChild(bubble);
  let idx = 0;
  function showStep(n){
    if (n < 0 || n >= steps.length) return endTour();
    const step = steps[n];
    const el = document.querySelector(step.sel);
    const rect = el ? el.getBoundingClientRect() : { left: window.innerWidth/2 - 200, top: window.innerHeight/2 - 80, width: 400, height:120 };
    let left = Math.min(window.innerWidth - 460, Math.max(12, rect.left + rect.width/2 - 200));
    let top = rect.top - 160; if (top < 20) top = rect.bottom + 12;
    bubble.style.left = left + 'px'; bubble.style.top = top + 'px';
    bubble.innerHTML = `<strong style="display:block;margin-bottom:6px">${step.title}</strong><div style="color:var(--muted)">${step.text}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <button id="tour-prev" class="btn-ghost">Atrás</button>
        <button id="tour-next" class="btn-primary-sm">${n===steps.length-1 ? 'Finalizar' : 'Siguiente'}</button>
      </div>`;
    $('#tour-next').onclick = ()=> { idx++; showStep(idx); };
    $('#tour-prev').onclick = ()=> { idx = Math.max(0, idx-1); showStep(idx); };
    overlay.onclick = endTour;
    if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
  }
  function endTour(){ root.innerHTML = ''; }
  showStep(0);
}

// THEME TOGGLE (persistente)
function initTheme(){
  const stored = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(stored);
  toggleThemeBtn.onclick = () => {
    const cur = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };
}
function applyTheme(theme){
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    toggleThemeBtn.textContent = '💡 Modo Gamer (ON)';
    toggleThemeBtn.classList.remove('btn-ghost');
    toggleThemeBtn.classList.add('btn-primary-sm');
  } else {
    document.body.classList.remove('dark-theme');
    toggleThemeBtn.textContent = '🌙 Modo Oscuro';
    toggleThemeBtn.classList.remove('btn-primary-sm');
    toggleThemeBtn.classList.add('btn-ghost');
  }
  localStorage.setItem(THEME_KEY, theme);
  // redraw connections to apply color
  setTimeout(()=> drawConnections(), 120);
}

// DRAG / PAN for map (desktop & mobile)
let isDown = false, startX=0, startY=0, scrollLeft=0, scrollTop=0;
mapWrap.addEventListener('pointerdown', (e) => {
  isDown = true;
  startX = e.clientX;
  startY = e.clientY;
  scrollLeft = mapWrap.scrollLeft;
  scrollTop = mapWrap.scrollTop;
  mapWrap.setPointerCapture(e.pointerId);
});
mapWrap.addEventListener('pointermove', (e) => {
  if (!isDown) return;
  const dx = startX - e.clientX;
  const dy = startY - e.clientY;
  mapWrap.scrollLeft = scrollLeft + dx;
  mapWrap.scrollTop = scrollTop + dy;
});
mapWrap.addEventListener('pointerup', (e) => { isDown = false; mapWrap.releasePointerCapture?.(e.pointerId); });
mapWrap.addEventListener('pointerleave', ()=> isDown = false);

// SIMULATE DATA
btnSimulate.addEventListener('click', () => {
  if (!confirm('Generar demo local de progreso? (no tocará datos reales)')) return;
  CATEGORIES.forEach((c,i) => {
    progressState[c.id] = { pct: Math.floor(Math.random()*100), completed: Math.random()>.6, unlocked: true };
  });
  localStorage.setItem(LEVELS_PROGRESS_KEY, JSON.stringify(progressState));
  showToast('Demo creado (local)');
  buildMap(filterSelect.value);
});

// QUICK action
btnQuick.addEventListener('click', ()=> {
  const unlocked = Object.keys(progressState).find(k => progressState[k].unlocked);
  if (!unlocked) return showToast('Aún no hay niveles desbloqueados');
  progressState[unlocked].pct = Math.min(100, (progressState[unlocked].pct||0) + 25);
  if (progressState[unlocked].pct >= 100) progressState[unlocked].completed = true;
  localStorage.setItem(LEVELS_PROGRESS_KEY, JSON.stringify(progressState));
  showToast('Reto rápido completado — revisa tu mentor');
  buildMap(filterSelect.value);
});

// filter
filterSelect.addEventListener('change', (e)=> buildMap(e.target.value));

// Start tour
btnTour.addEventListener('click', startTour);

// initial render
(function init(){
  initTheme();
  renderHeader();
  buildMap();
})();

// resize observer: redraw connections when layout changes
const ro = new ResizeObserver(()=> drawConnections());
ro.observe(levelsGridWrap);

// Helper: open modal reused in this file
function openModal(html){
  const backdrop = document.createElement('div');
  backdrop.className = 'tour-overlay';
  const box = document.createElement('div');
  box.className = 'tour-bubble';
  box.innerHTML = html;
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e)=> { if (e.target === backdrop) closeModal(); });
  return box;
}
function closeModal(){ const el = document.querySelector('.tour-overlay'); if (el) el.remove(); }
