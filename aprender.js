// aprender.js — adaptado a finanzas personales con movimiento, mentor y tour
const PROFILE_KEY = 'carlitos_profile_data';
const IMG_PATH = ''; // coloca ruta si las imágenes están en carpeta
const TUTOR_IMG_VARIANTS = {
  'Mono': ['mononormal.png','iconomono.png'],
  'Ardilla': ['ardillanormal.png','iconoardilla.png'],
  'Condor': ['condornormal.png','iconocondor.png'],
  'Gata': ['gatanormal.png','iconogata.png']
};

// DOM helpers
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// Elements
const playerNameEl = $('#player-name');
const badgeStars = $('#badge-stars');
const badgeCoins = $('#badge-coins');
const badgeLives = $('#badge-lives');
const levelsGrid = $('#levels-grid');
const detailPanel = $('#detail-panel');
const detailTitle = $('#detail-title');
const detailDesc = $('#detail-desc');
const detailIcon = $('#detail-icon');
const btnStartSection = $('#btn-start-section');
const btnPreview = $('#btn-preview');
const btnSimulate = $('#btn-simulate');
const mentorImg = $('#mentor-aside-img');
const mentorName = $('#mentor-name');
const mentorAdvice = $('#mentor-advice');
const streakEl = $('#streak');
const currentLevelEl = $('#current-level');
const progressMonthEl = $('#progress-month');

// load local profile (onboarding should have saved)
function loadProfile(){
  try{
    const pRaw = localStorage.getItem(PROFILE_KEY);
    if (!pRaw) return { name:'Explorador', totalXP:0, carlitosCoins:0, badgeStars:0, lives:5, assignedTutor:'Ardilla', streak:0, levelName:'Novato' };
    const p = JSON.parse(pRaw);
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
  } catch(e){
    return { name:'Explorador', totalXP:0, carlitosCoins:0, badgeStars:0, lives:5, assignedTutor:'Ardilla', streak:0, levelName:'Novato' };
  }
}
let profile = loadProfile();
function renderHeader(){
  playerNameEl.textContent = profile.name;
  badgeStars.textContent = profile.badgeStars;
  badgeCoins.textContent = profile.carlitosCoins;
  badgeLives.textContent = profile.lives;
  streakEl.textContent = (profile.streak || 0) + ' días';
  currentLevelEl.textContent = profile.levelName;
  const monthly = Math.min(100, (profile.totalXP % 800) / 8);
  if (progressMonthEl) progressMonthEl.style.width = monthly + '%';
}
renderHeader();

// FINANCE topics as categories
const CATEGORIES = [
  { id:'presupuesto', title:'Presupuesto', desc:'Aprende a dividir ingresos y gasto en 50/30/20 y ajustar tu flujo.', color:'#10B981', difficulty:'beginner' },
  { id:'ahorro', title:'Ahorro', desc:'Métodos de ahorro, cajas, metas y automatización.', color:'#F97316', difficulty:'beginner' },
  { id:'deuda', title:'Deuda', desc:'Prioriza y paga de forma eficiente (avalancha vs bola de nieve).', color:'#FB7185', difficulty:'beginner' },
  { id:'inversion', title:'Inversión', desc:'Conceptos básicos: riesgo, diversificación y horizonte.', color:'#06B6D4', difficulty:'med' },
  { id:'fondo_emergencia', title:'Fondo Emergencia', desc:'Cuándo y cómo construir tu colchón de 3–6 meses.', color:'#8B5CF6', difficulty:'med' },
  { id:'seguros', title:'Seguros', desc:'Seguro de salud, vida y bienes — por qué son importantes.', color:'#F59E0B', difficulty:'med' },
  { id:'impuestos', title:'Impuestos', desc:'Conceptos básicos y cómo optimizar dentro de la ley.', color:'#9333EA', difficulty:'adv' },
  { id:'retiro', title:'Retiro', desc:'Planificación temprana: cuentas y composición a largo plazo.', color:'#0EA5A4', difficulty:'adv' }
];

// progress state in localStorage
let progressState = JSON.parse(localStorage.getItem('carlitos_levels_progress') || 'null') || {};
if (!progressState || Object.keys(progressState).length === 0) {
  CATEGORIES.forEach((c, i) => {
    progressState[c.id] = { pct: i===0 ? 14 : 0, completed: false, unlocked: i<2 };
  });
  localStorage.setItem('carlitos_levels_progress', JSON.stringify(progressState));
}

// create ring svg (to avoid blurry canvas)
function createRingSVG(pct, color){
  const size = 56, stroke = 6, r = (size - stroke)/2;
  const c = 2 * Math.PI * r;
  const offs = c * (1 - pct/100);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('ring');
  const bg = document.createElementNS(ns,'circle'); bg.setAttribute('cx',size/2); bg.setAttribute('cy',size/2); bg.setAttribute('r', r);
  bg.setAttribute('stroke','#ffffff66'); bg.setAttribute('stroke-width', stroke); bg.setAttribute('fill','none');
  const fg = document.createElementNS(ns,'circle'); fg.setAttribute('cx',size/2); fg.setAttribute('cy',size/2); fg.setAttribute('r', r);
  fg.setAttribute('stroke', color); fg.setAttribute('stroke-width', stroke); fg.setAttribute('fill','none');
  fg.setAttribute('stroke-dasharray', c); fg.setAttribute('stroke-dashoffset', offs); fg.setAttribute('stroke-linecap','round');
  svg.appendChild(bg); svg.appendChild(fg);
  return svg;
}

// render grid
function renderLevelsGrid(filter='all'){
  levelsGrid.innerHTML = '';
  const list = CATEGORIES.filter(c => filter==='all' ? true : c.difficulty === filter);
  list.forEach(c => {
    const st = progressState[c.id] || { pct:0, completed:false, unlocked:false };
    const card = document.createElement('div'); card.className = 'level-card';
    if (!st.unlocked) card.classList.add('locked');

    const icon = document.createElement('div'); icon.className = 'level-icon floating';
    icon.style.background = `linear-gradient(180deg, ${c.color}, ${shadeColor(c.color, -12)})`;
    // add ring + center
    const ring = createRingSVG(st.pct, 'rgba(255,255,255,0.95)');
    icon.appendChild(ring);
    const center = document.createElement('div'); center.className = 'center-dot';
    center.textContent = st.completed ? '★' : c.title[0];
    icon.appendChild(center);

    const label = document.createElement('div'); label.className = 'level-label'; label.textContent = c.title;

    card.appendChild(icon); card.appendChild(label);

    // subtle bounce on appear
    card.animate([{transform:'translateY(12px)', opacity:0},{transform:'translateY(0)', opacity:1}],{duration:520, fill:'forwards', easing:'cubic-bezier(.2,.9,.3,1)'});

    card.addEventListener('click', () => {
      if (!st.unlocked) {
        card.animate([{transform:'translateX(0)'},{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],{duration:240});
        showToast('Nivel bloqueado — completa niveles anteriores');
        return;
      }
      openDetail(c);
    });

    levelsGrid.appendChild(card);
  });
}
renderLevelsGrid();
// --- Reemplaza la función openDetail existente por esta ---
function openDetail(category){
  detailPanel.classList.remove('hidden');
  detailTitle.textContent = category.title;
  detailDesc.textContent = category.desc;
  detailIcon.innerHTML = `<div style="width:72px;height:72px;border-radius:12px;background:${category.color};display:grid;place-items:center;color:white;font-weight:900">${category.title[0]}</div>`;
  $('#detail-coins').textContent = '+20';
  $('#detail-xp').textContent = '+50';
  $('#detail-difficulty').textContent = category.difficulty === 'beginner' ? 'Principiante' : (category.difficulty === 'med' ? 'Intermedio' : 'Avanzado');
  detailPanel.dataset.selected = category.id;
  detailPanel.scrollIntoView({behavior:'smooth', block:'center'});

  // --- importante: asignamos el comportamiento de "EMPEZAR" ---
  // Navegará a "leccion_<id>.html". Ej: leccion_presupuesto.html
  if (btnStartSection) {
    btnStartSection.onclick = (e) => {
      e.preventDefault();
      const targetId = category.id;
      const filename = `leccion_${targetId}.html`;
      // si quieres abrir en nueva pestaña: window.open(filename, '_blank');
      window.location.href = filename;
    };
  }

  // Preview: por defecto solo muestra una vista previa modal (opcional)
  if (btnPreview) {
    btnPreview.onclick = (ev) => {
      ev.preventDefault();
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
}


// complete level (simulate) => reward, confetti, mentor advice update
btnStartSection.addEventListener('click', () => {
  const id = detailPanel.dataset.selected;
  if (!id) return showToast('Selecciona una sección primero');
  simulateCompleteLevel(id);
});

function simulateCompleteLevel(id){
  const st = progressState[id] || { pct:0, unlocked:true };
  st.pct = Math.min(100, (st.pct || 0) + (st.pct > 60 ? 40 : 30));
  if (st.pct >= 100) st.completed = true;
  progressState[id] = st;
  localStorage.setItem('carlitos_levels_progress', JSON.stringify(progressState));

  // award rewards based on topic type (finance)
  const awardCoins = 25;
  const awardXP = 75;
  profile.carlitosCoins = (profile.carlitosCoins || 0) + awardCoins;
  profile.totalXP = (profile.totalXP || 0) + awardXP;
  if (st.completed) profile.badgeStars = (profile.badgeStars || 0) + 1;

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  renderHeader();
  renderLevelsGrid($('#filter-mode').value);

  // confetti & pulse
  if (st.completed) {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 }});
    showToast(`¡Sección completada! +${awardCoins} coins · +${awardXP} XP`);
  } else {
    showToast(`Progreso guardado +${awardXP} XP`);
  }

  // update mentor advice depending on spending-like mapping
  mentorAdvice.textContent = getAdviceBySpendingPattern();
}

// load mentor image and advice
(async function loadMentor(){
  const key = profile.assignedTutor || 'Ardilla';
  mentorName.textContent = key;
  mentorAdvice.textContent = getAdviceBySpendingPattern();
  for (const fn of (TUTOR_IMG_VARIANTS[key] || [])){
    const url = fn.startsWith('http') ? fn : (IMG_PATH + fn);
    try {
      const res = await fetch(url, { method:'HEAD' });
      if (res.ok) { mentorImg.src = url; return; }
    } catch(e){}
  }
  mentorImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="%23ecfccb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="14">Mentor</text></svg>';
})();

// advice generator (finance oriented) — simple heuristic using progress & coins
function getAdviceBySpendingPattern(){
  const xp = profile.totalXP || 0;
  if (xp < 150) return 'Empieza con el reto de presupuesto: separa 50% necesidades, 30% deseos, 20% ahorro.';
  if (xp < 500) return 'Buen ritmo. Automatiza tu ahorro mensual y crea un fondo de emergencia de 3 meses.';
  return 'Avanzado: diversifica, revisa comisiones y optimiza impuestos dentro de la ley.';
}

// shade color helper
function shadeColor(hex, percent) {
  const f = hex.slice(1), t = percent<0?0:255, p = Math.abs(percent)/100;
  const R = parseInt(f.substring(0,2),16), G = parseInt(f.substring(2,4),16), B = parseInt(f.substring(4,6),16);
  const newR = Math.round((t - R) * p) + R;
  const newG = Math.round((t - G) * p) + G;
  const newB = Math.round((t - B) * p) + B;
  return `rgb(${newR},${newG},${newB})`;
}

// simulate demo data
btnSimulate.addEventListener('click', async () => {
  if (!confirm('Generar demo local de progreso? (no tocará datos reales en Firestore)')) return;
  CATEGORIES.forEach((c,i) => {
    progressState[c.id] = { pct: Math.floor(Math.random()*100), completed: Math.random()>.6, unlocked: true };
  });
  localStorage.setItem('carlitos_levels_progress', JSON.stringify(progressState));
  showToast('Demo de lecciones creado (local)');
  renderLevelsGrid($('#filter-mode').value);
});

// quick action: Button "Ir" (reto rápido)
$('#btn-quick').addEventListener('click', ()=> {
  const unlocked = Object.keys(progressState).find(k => progressState[k].unlocked);
  if (!unlocked) return showToast('Aún no hay niveles desbloqueados');
  progressState[unlocked].pct = Math.min(100, (progressState[unlocked].pct||0) + 25);
  if (progressState[unlocked].pct >= 100) progressState[unlocked].completed = true;
  localStorage.setItem('carlitos_levels_progress', JSON.stringify(progressState));
  showToast('Reto rápido completado — revisa tu mentor');
  renderLevelsGrid($('#filter-mode').value);
});

// filter
$('#filter-mode').addEventListener('change', (e)=> renderLevelsGrid(e.target.value));

// toast helper
function showToast(msg, ttl=1600){
  let el = document.getElementById('carlitos-toast');
  if (!el){
    el = document.createElement('div'); el.id = 'carlitos-toast';
    el.style.position = 'fixed'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)';
    el.style.bottom = '110px'; el.style.background = 'rgba(2,6,23,0.9)'; el.style.color = '#fff';
    el.style.padding = '10px 14px'; el.style.borderRadius = '999px'; el.style.zIndex = 9999; el.style.opacity='0';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
  setTimeout(()=> el.style.opacity = '0', ttl);
}

// TOUR / spotlight
function startTour(){
  const steps = [
    { sel: '.topbar', title: 'Panel superior', text: 'Aquí ves tus monedas, estrellas y vidas. Mantén la racha diaria.' },
    { sel: '#levels-grid', title: 'Niveles de Finanzas', text: 'Cada círculo es una sección (presupuesto, ahorro, deuda...). Completa anillos y gana rewards.' },
    { sel: '#mentor-aside-img', title: 'Tu Mentor', text: 'Tu mentor ofrece consejos personalizados según tu progreso y gastos.' },
    { sel: '.mentor-card', title: 'Analizar gastos', text: 'Usa "Analizar mis gastos" para recibir tips prácticos según tus patrones.' }
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
    bubble.innerHTML = `<strong style="display:block;margin-bottom:6px">${step.title}</strong><div style="color:#334155">${step.text}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <button id="tour-prev" class="btn-ghost">Atrás</button>
        <button id="tour-next" class="btn-primary-sm">${n===steps.length-1 ? 'Finalizar' : 'Siguiente'}</button>
      </div>`;
    document.getElementById('tour-next').onclick = ()=> { idx++; showStep(idx); };
    document.getElementById('tour-prev').onclick = ()=> { idx = Math.max(0, idx-1); showStep(idx); };
    overlay.onclick = endTour;
    if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
  }
  function endTour(){ root.innerHTML = ''; }
  showStep(0);
}
$('#btn-tour').addEventListener('click', startTour);

// init
(function init(){
  renderLevelsGrid();
})();
