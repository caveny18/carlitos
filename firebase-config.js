/* aprender.js - versión bravaza: mapa de niveles, tour spotlight, confetti, animaciones */

// minimal helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* CONFIG */
const TOTAL_LEVELS = 12;           // puedes aumentar
const LEVELS_KEY = 'carlitos_levels_progress';
const PROFILE_KEY = 'carlitos_profile_data';

/* DOM */
const ROOT = $('#levels-root');
const XP_BAR = $('#xp-bar');
const XP_TEXT = $('#xp-text');
const HEADER_XP = $('#hero-username'); // usamos hero-username to show name
const AVATAR = $('#avatar');
const LEVEL_BADGE = $('#level-badge');
const MENTOR_COMMENT = $('#mentor-comment');

/* Visual niceties */
const CONFETTI = window.confetti || null;

/* particle background (simple canvas particles) */
(function particleBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  canvas.width = innerWidth; canvas.height = innerHeight;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const N = Math.round((innerWidth * innerHeight) / 100000);
  for (let i=0;i<N;i++){
    particles.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      r: Math.random()*1.6 + 0.3,
      vx: (Math.random()-0.5)*0.1,
      vy: (Math.random()-0.5)*0.2,
      hue: 240 + Math.random()*80
    });
  }
  function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},80%,60%,${0.06})`;
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    });
    requestAnimationFrame(loop);
  }
  loop();
  window.addEventListener('resize', ()=> { canvas.width = innerWidth; canvas.height = innerHeight; });
})();

/* levels state */
function readLevels() {
  try {
    const s = localStorage.getItem(LEVELS_KEY);
    if (!s) return initLevels();
    return JSON.parse(s);
  } catch (e) { return initLevels(); }
}
function saveLevels(l) { localStorage.setItem(LEVELS_KEY, JSON.stringify(l)); }
function initLevels(){
  const arr = [];
  for (let i=1;i<=TOTAL_LEVELS;i++){
    arr.push({ id:i, status: i===1 ? 'unlocked' : 'locked', bestScore:0, tries:0 });
  }
  saveLevels(arr);
  return arr;
}
let levels = readLevels();

/* profile */
function readProfile(){
  try {
    const s = localStorage.getItem(PROFILE_KEY);
    if (!s) {
      const p = { name: 'Explorador', totalXP:0, carlitosCoins:0 };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      return p;
    }
    return JSON.parse(s);
  } catch (e) { return { name: 'Explorador', totalXP:0, carlitosCoins:0 }; }
}
function saveProfile(p){ localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
let profile = readProfile();

/* UI render header */
function renderHeader(){
  $('#hero-username').textContent = profile.name || 'Explorador';
  AVATAR.textContent = (profile.name ? profile.name[0].toUpperCase() : 'C');
  const xp = Number(profile.totalXP || 0);
  const next = xp < 100 ? 100 : (xp < 350 ? 350 : (xp < 800 ? 800 : 1500));
  const pct = Math.min(100, Math.round((xp / (next || 100)) * 100));
  XP_BAR.style.width = pct + '%';
  XP_TEXT.textContent = `${xp.toLocaleString('es-CL')} XP • Próximo objetivo ${next.toLocaleString('es-CL')} XP`;
  LEVEL_BADGE.textContent = xp < 100 ? 'Novato' : (xp < 350 ? 'Aprendiz' : xp < 800 ? 'Estratega' : 'Maestro');
  $('#hero-stats')?.textContent = `${xp.toLocaleString('es-CL')} XP • ${Number(profile.carlitosCoins||0).toLocaleString('es-CL')} Coins`;
}
renderHeader();

/* Place nodes along SVG path (distribute by path length) */
async function renderLevels(){
  ROOT.innerHTML = '';
  const svgPath = document.getElementById('curve');
  if (!svgPath) return;
  const pathLen = svgPath.getTotalLength();
  // prepare container size equal to SVG bounding box
  const svgBox = document.getElementById('levels-path').getBoundingClientRect();
  ROOT.style.height = svgBox.height + 'px';
  ROOT.style.width = '100%';
  // positions at equal intervals along curve
  for (let i=0;i<levels.length;i++){
    const t = (i + 0.5) / levels.length;
    const pos = svgPath.getPointAtLength(pathLen * t);
    const el = document.createElement('div');
    el.className = 'level-node ' + (levels[i].status || 'locked');
    el.style.left = (pos.x / svgBox.width * 100) + '%';
    // y adjust relative to svg top (the SVG in layout may scale; align by percentage)
    const yPercent = (pos.y / svgBox.height * 100);
    el.style.top = (yPercent) + '%';
    el.dataset.id = levels[i].id;
    el.innerHTML = `<div class="num">${levels[i].status === 'locked' ? '🔒' : levels[i].id}</div>
                    <div class="level-tooltip">Nivel ${levels[i].id} — ${levels[i].status}</div>`;
    // click behavior
    el.addEventListener('click', (ev) => {
      const id = Number(el.dataset.id);
      if (levels.find(l=>l.id===id).status === 'locked') {
        // shake
        el.animate([{transform:'translateX(0)'},{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],{duration:340});
        showToast('Nivel bloqueado — avanza para desbloquearlo');
        return;
      }
      // on unlocked click: simulate entering lesson and completing
      openLessonPreview(id, el);
    });
    ROOT.appendChild(el);
    // small stagger animation
    el.style.transform = 'translateY(12px) scale(.98)';
    setTimeout(()=>{ el.style.transform = ''; el.style.transition = 'transform .5s cubic-bezier(.2,.9,.3,1)'; }, 60*i);
  }
}

/* Lesson preview modal (fancy) */
function openLessonPreview(id, nodeEl) {
  const modal = document.createElement('div');
  modal.className = 'modal-root fixed inset-0 z-50 flex items-center justify-center';
  modal.style.background = 'linear-gradient(90deg, rgba(2,6,23,0.6), rgba(2,6,23,0.85))';
  const content = document.createElement('div');
  content.className = 'glass-card p-6 rounded-2xl w-[92%] max-w-2xl';
  content.innerHTML = `
    <div class="flex items-start gap-4">
      <div class="w-20 h-20 rounded-xl bg-gradient-to-r from-pink-400 to-indigo-500 flex items-center justify-center text-black font-bold">L${id}</div>
      <div class="flex-1">
        <div class="text-xl font-bold">Lección ${id} — Título llamativo</div>
        <div class="text-sm text-slate-300 mt-1">Minijuego, ejemplos y prácticas para mejorar tus finanzas personales.</div>
        <div class="mt-4 flex gap-2">
          <button id="open-lesson" class="btn-primary px-4 py-2 rounded-lg">Abrir Lección</button>
          <button id="complete-lesson" class="btn-glow px-4 py-2 rounded-lg">Completar (demo)</button>
          <button id="close-lesson" class="btn-ghost px-3 py-2 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);
  // handlers
  $('#close-lesson').onclick = () => modal.remove();
  $('#open-lesson').onclick = () => { window.location.href = `./leccion${id}.html`; };
  $('#complete-lesson').onclick = async () => {
    await completeLevel(id);
    modal.remove();
  };
}

/* complete level: set to completed, give XP, unlock next, confetti */
async function completeLevel(id) {
  const idx = levels.findIndex(l => l.id === id);
  if (idx < 0) return;
  levels[idx].status = 'completed';
  levels[idx].bestScore = Math.max(levels[idx].bestScore || 0, Math.floor(Math.random()*100));
  levels[idx].tries = (levels[idx].tries || 0) + 1;
  // unlock next
  if (idx+1 < levels.length && levels[idx+1].status === 'locked') levels[idx+1].status = 'unlocked';
  saveLevels(levels);
  // award XP and coins
  profile.totalXP = (Number(profile.totalXP || 0) + 120);
  profile.carlitosCoins = (Number(profile.carlitosCoins || 0) + 20);
  saveProfile(profile);
  renderHeader();
  renderLevels();
  showToast(`Nivel ${id} completado — +120 XP 🎉`);
  // confetti burst at node position
  try {
    const rect = document.querySelector(`.level-node[data-id="${id}"]`).getBoundingClientRect();
    const x = (rect.left + rect.width/2) / innerWidth;
    const y = (rect.top + rect.height/2) / innerHeight;
    if (CONFETTI) {
      confetti({ particleCount: 60, spread: 70, origin: { x, y }, colors: ['#FF8BD9','#7C3AED','#06B6D4','#FFD166'] });
    }
  } catch (e) { console.warn(e); }
  // mentor advice update
  updateMentorComment();
}

/* toast */
function showToast(msg, t = 2200) {
  let el = document.getElementById('appr-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appr-toast';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.bottom = '96px';
    el.style.zIndex = 9999;
    el.style.padding = '10px 16px';
    el.style.borderRadius = '999px';
    el.style.background = 'rgba(0,0,0,0.7)';
    el.style.color = 'white';
    el.style.fontWeight = '700';
    el.style.backdropFilter = 'blur(6px)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(()=> { el.style.opacity = '0'; }, t);
}

/* Tour spotlight with mentor bubble */
function startSpotlightTour() {
  const steps = [
    { sel: '.glass-card', title: 'Tu perfil', text: 'Aquí ves tu avatar, XP y acceso rápido al perfil.' },
    { sel: '#levels-path', title: 'Mapa de niveles', text: 'Niveles organizados en un mapa. Toca un nodo desbloqueado para acceder.' },
    { sel: '#mentor-fab', title: 'Mentor', text: 'Tus consejos y misiones aparecen aquí.' },
    { sel: '#start-first-lesson', title: 'Lección 1', text: 'Pulsa para abrir la primera lección interactiva.' }
  ];

  // create overlay (radial spotlight)
  const overlay = document.createElement('div');
  overlay.id = 'tour-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = 9998;
  overlay.style.background = 'rgba(2,6,23,0.7)';
  overlay.style.backdropFilter = 'blur(2px)';
  document.body.appendChild(overlay);

  // mentor bubble
  const bubble = document.createElement('div');
  bubble.id = 'tour-bubble';
  bubble.style.position = 'fixed';
  bubble.style.zIndex = 9999;
  bubble.style.maxWidth = '420px';
  bubble.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))';
  bubble.style.border = '1px solid rgba(255,255,255,0.06)';
  bubble.style.padding = '12px 14px';
  bubble.style.borderRadius = '12px';
  bubble.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
  bubble.innerHTML = `<strong id="tb-title" style="display:block;color:#fff;font-weight:800;margin-bottom:6px"></strong><div id="tb-text" style="color:#e6e6ff"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
      <button id="tb-prev" class="btn-ghost" style="padding:.4rem .6rem;border-radius:8px">Atrás</button>
      <button id="tb-next" class="btn-glow-sm" style="padding:.4rem .6rem;border-radius:8px">Siguiente</button>
    </div>`;
  document.body.appendChild(bubble);

  let i = 0;
  function show(iIdx) {
    const s = steps[iIdx];
    if (!s) { end(); return; }
    const el = document.querySelector(s.sel);
    // if element exists, compute rect else center
    let rect;
    if (el) rect = el.getBoundingClientRect();
    else rect = { left: innerWidth/2-120, top: innerHeight/2-60, width: 240, height:120 };

    // set spotlight using radial gradient positioned at rect center
    const cx = Math.round(rect.left + rect.width/2);
    const cy = Math.round(rect.top + rect.height/2);
    overlay.style.background = `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) 120px, rgba(2,6,23,0.85) 160px)`;

    // position bubble above target if space otherwise below
    let bx = Math.min(innerWidth - 440, Math.max(12, cx - 200));
    let by = rect.top - 160;
    if (by < 20) by = rect.bottom + 18;
    bubble.style.left = bx + 'px'; bubble.style.top = by + 'px';
    $('#tb-title').textContent = s.title;
    $('#tb-text').textContent = s.text;
    // scroll into view
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('#tb-next').onclick = ()=> { i++; if (i >= steps.length) end(); else show(i); };
  $('#tb-prev').onclick = ()=> { i = Math.max(0, i-1); show(i); };
  overlay.onclick = (e) => { if (e.target === overlay) end(); };

  function end(){
    overlay.remove(); bubble.remove();
  }
  show(0);
}

/* quick simulate: mark some levels completed and award XP */
$('#simulate').addEventListener('click', async () => {
  // complete first locked or some random ones
  for (let i=0;i<Math.min(3, levels.length); i++){
    if (levels[i].status === 'unlocked') levels[i].status = 'completed';
    if (i+1 < levels.length && levels[i+1].status === 'locked') levels[i+1].status = 'unlocked';
  }
  saveLevels(levels);
  profile.totalXP = Number(profile.totalXP || 0) + 300;
  profile.carlitosCoins = Number(profile.carlitosCoins || 0) + 50;
  saveProfile(profile);
  renderHeader();
  renderLevels();
  showToast('Demo: varios niveles completados y +300 XP!');
});

/* unlock all demo */
$('#unlock-all').addEventListener('click', ()=> {
  if (!confirm('Desbloquear todos los niveles para demo?')) return;
  levels.forEach(l=> l.status = 'unlocked');
  saveLevels(levels); renderLevels();
  showToast('Todos los niveles desbloqueados.');
});

/* reset progress */
$('#reset-prog').addEventListener('click', ()=> {
  const r = prompt('Escribe CONFIRMAR para reiniciar todo el progreso');
  if (r && r.toUpperCase() === 'CONFIRMAR') {
    localStorage.removeItem(LEVELS_KEY);
    localStorage.removeItem(PROFILE_KEY);
    levels = initLevels();
    profile = readProfile();
    renderHeader();
    renderLevels();
    showToast('Progreso reiniciado.');
  }
});

/* helper update mentor comment (demo: advice based on XP) */
function updateMentorComment(){
  const xp = Number(profile.totalXP || 0);
  let advice = 'Empieza la Lección 1 para obtener XP rápido.';
  if (xp >= 350) advice = 'Vas muy bien — considera abrir el simulador de inversiones.';
  else if (xp >= 100) advice = 'Buen progreso — intenta mantener la racha 3 días seguidos.';
  else if (xp > 0) advice = 'Sigue completando lecciones cortas para consolidar hábitos.';
  MENTOR_COMMENT.textContent = advice;
}

/* initial render and handlers */
renderLevels();
renderHeader();
updateMentorComment();

/* small UX binds */
$('#start-first-lesson').addEventListener('click', ()=> {
  // ensure first unlocked
  if (levels[0].status === 'locked') { levels[0].status = 'unlocked'; saveLevels(levels); renderLevels(); }
  window.location.href = './leccion1.html';
});

/* mentor fab click opens tour */
$('#mentor-fab')?.addEventListener('click', ()=> { startSpotlightTour(); });

/* start tour button */
$('#btn-tutorial')?.addEventListener('click', ()=> { startSpotlightTour(); });

/* handle window resize to re-render nodes (positions are based on svg path) */
window.addEventListener('resize', ()=> { setTimeout(()=> renderLevels(), 120); });
