// aprender.js (module) - Tiles style Duolingo-like (uses firebase-config.js if available)

let auth = null, db = null, onAuthStateChanged = null, signOut = null, docFn=null, getDocFn=null, setDocFn=null;
let FIREBASE_AVAILABLE = false;
try {
  const cfg = await import('./firebase-config.js');
  auth = cfg.auth; db = cfg.db;
  const authMod = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
  onAuthStateChanged = authMod.onAuthStateChanged; signOut = authMod.signOut;
  const fs = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
  docFn = fs.doc; getDocFn = fs.getDoc; setDocFn = fs.setDoc;
  FIREBASE_AVAILABLE = !!(auth && db && onAuthStateChanged);
  console.log('Firebase disponible:', FIREBASE_AVAILABLE);
} catch (e) { console.warn('Firebase no cargado -> modo local', e); FIREBASE_AVAILABLE = false; }

/* DOM */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const tilesGrid = $('#tiles-grid');
const coinsEl = $('#coins'); const xpEl = $('#xp');
const filterSelect = $('#filter-mode'); const btnSimulate = $('#btn-simulate');
const toggleThemeBtn = $('#toggle-theme-btn'); const btnTour = $('#btn-tour');
const modalRoot = $('#modal-root');

const PROFILE_KEY = 'carlitos_profile_data';
const PROGRESS_KEY = 'carlitos_tiles_progress';
const THEME_KEY = 'carlitos_learn_theme';

/* Categories (economía classes) */
const CATEGORIES = [
  { id:'basico1', title:'Básico 1', desc:'Conceptos esenciales', color:'#06b6d4', difficulty:'beginner', icon:'₿' },
  { id:'frases', title:'Frases financieras', desc:'Vocabulario clave', color:'#059669', difficulty:'beginner', icon:'💬' },
  { id:'comida', title:'Economía diaria', desc:'Gastos y ahorro', color:'#F97316', difficulty:'beginner', icon:'🍽️' },
  { id:'ahorro', title:'Ahorro & metas', desc:'Metas cortas y largas', color:'#8B5CF6', difficulty:'med', icon:'🏦' },
  { id:'inversion', title:'Inversión básica', desc:'Riesgo y plazo', color:'#06b6d4', difficulty:'med', icon:'📈' },
  { id:'seguros', title:'Seguros', desc:'Protección financiera', color:'#F59E0B', difficulty:'med', icon:'🛡️' },
  { id:'impuestos', title:'Impuestos', desc:'Qué declarar y cuándo', color:'#9333EA', difficulty:'adv', icon:'🧾' },
  { id:'retiro', title:'Retiro', desc:'Planificación a largo plazo', color:'#0EA5A4', difficulty:'adv', icon:'🕰️' }
];

/* local state */
function loadProfileLocal(){
  try{ return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}; } catch { return {}; }
}
let profile = loadProfileLocal();
if (!profile.name) profile.name = 'Explorador';
if (!profile.carlitosCoins) profile.carlitosCoins = 0;
if (!profile.totalXP) profile.totalXP = 0;

let progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null') || {};
if (!progress || Object.keys(progress).length === 0) {
  CATEGORIES.forEach((c,i) => progress[c.id] = { pct: i===0 ? 30 : 0, unlocked: i < 2, completed: i===0 });
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

/* utils */
function showToast(msg, ttl=1600){
  let el = document.getElementById('carlitos-toast');
  if (!el){ el = document.createElement('div'); el.id='carlitos-toast'; el.style.position='fixed'; el.style.left='50%'; el.style.transform='translateX(-50%)'; el.style.bottom='110px'; el.style.background='rgba(2,6,23,0.85)'; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='999px'; el.style.zIndex=99999; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  setTimeout(()=> el.style.opacity = '0', ttl);
}
function openModal(html){ modalRoot.innerHTML = ''; const backdrop = document.createElement('div'); backdrop.className='tour-overlay'; const box = document.createElement('div'); box.className='tour-bubble'; box.innerHTML = html; backdrop.appendChild(box); modalRoot.appendChild(backdrop); backdrop.addEventListener('click', (e)=> { if (e.target===backdrop) closeModal(); }); return box; }
function closeModal(){ const el = document.querySelector('.tour-overlay'); if (el) el.remove(); }

/* render */
function renderHeader(){
  coinsEl.textContent = Number(profile.carlitosCoins || 0);
  xpEl.textContent = Number(profile.totalXP || 0);
}

function buildTiles(filter='all'){
  tilesGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  CATEGORIES.forEach(cat => {
    if (filter !== 'all' && cat.difficulty !== filter) return;
    const st = progress[cat.id] || { pct:0, unlocked:false, completed:false };
    const tile = document.createElement('div');
    tile.className = 'tile tile-gamer' + (st.completed ? ' completed' : '') + (st.unlocked ? '' : ' locked');
    tile.dataset.id = cat.id;
    tile.innerHTML = `
      <div class="tile-head">
        <div class="tile-cat">${cat.title}</div>
        <div class="tile-level">${cat.difficulty === 'beginner' ? 'Principiante' : (cat.difficulty==='med'?'Intermedio':'Avanzado')}</div>
      </div>
      <div class="tile-hero">
        <div class="tile-icon" style="background:linear-gradient(135deg, ${cat.color}, ${shadeColor(cat.color,-12)})">${cat.icon}</div>
        <div class="tile-info">
          <div class="tile-title">${cat.title}</div>
          <div class="tile-desc muted">${cat.desc}</div>
        </div>
      </div>
      <div class="tile-footer">
        <div class="progress-wrap">
          <div class="progress-ring" style="--p:${st.pct}; width:56px; height:56px; border-radius:999px;">
            <div style="font-size:12px;font-weight:800">${st.pct}%</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn-start">${st.unlocked ? (st.completed ? 'Revisar' : 'EMPEZAR') : 'Bloqueado'}</button>
        </div>
      </div>
    `;
    // interactions
    const startBtn = tile.querySelector('.btn-start');
    startBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!st.unlocked) { showToast('Nivel bloqueado — completa anteriores'); return; }
      if (st.completed) { openPreview(cat); return; }
      // start flow: open modal confirmation -> simulate completion
      const m = openModal(`<h3 style="margin:0">${cat.title}</h3><p class="muted" style="margin-top:8px">${cat.desc}</p>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button id="m-cancel" class="btn ghost">Cerrar</button>
          <button id="m-go" class="btn primary">Empezar</button>
        </div>`);
      m.querySelector('#m-cancel').onclick = closeModal;
      m.querySelector('#m-go').onclick = () => { closeModal(); startAndComplete(cat.id); };
    });

    tile.addEventListener('click', ()=> openPreview(cat));
    frag.appendChild(tile);
  });
  tilesGrid.appendChild(frag);
}

/* preview */
function openPreview(cat){
  const st = progress[cat.id] || { pct:0, unlocked:false, completed:false };
  const html = `<h3 style="margin:0">${cat.title}</h3>
    <p class="muted" style="margin-top:8px">${cat.desc}</p>
    <div style="display:flex;gap:12px;margin-top:12px;align-items:center">
      <div style="width:72px;height:72px;border-radius:12px;background:${cat.color};display:grid;place-items:center;color:white;font-weight:900;font-size:28px">${cat.icon}</div>
      <div>
        <div style="font-weight:800">${st.completed ? 'Completado' : (st.unlocked ? 'Listo para empezar' : 'Bloqueado')}</div>
        <div class="muted" style="font-size:13px">${st.pct}% completado</div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button id="pv-close" class="btn ghost">Cerrar</button>
      <button id="pv-start" class="btn primary">${st.completed ? 'Revisar' : 'Empezar'}</button>
    </div>`;
  const modal = openModal(html);
  modal.querySelector('#pv-close').onclick = closeModal;
  modal.querySelector('#pv-start').onclick = () => { closeModal(); if (!st.completed) startAndComplete(cat.id); else showToast('Revisando sección...'); };
}

/* simulate flow: start + award */
function startAndComplete(id){
  // micro-animation: scale icon
  const tile = document.querySelector(`.tile[data-id="${id}"]`);
  const icon = tile?.querySelector('.tile-icon');
  if (icon) icon.animate([{ transform:'scale(1)'},{ transform:'scale(1.08)'},{ transform:'scale(1)'}],{ duration:800, easing:'ease' });

  // simulate progress steps
  let st = progress[id] || { pct:0, unlocked:true, completed:false };
  st.pct = Math.min(100, st.pct + 60);
  if (st.pct >= 100) { st.completed = true; st.pct = 100; }
  progress[id] = st;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));

  // award
  const awardCoins = 20; const awardXP = 70;
  profile.carlitosCoins = (profile.carlitosCoins || 0) + awardCoins;
  profile.totalXP = (profile.totalXP || 0) + awardXP;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  renderHeader();
  buildTiles(filterSelect.value);

  // confetti if completed
  if (st.completed && typeof confetti === 'function') {
    confetti({ particleCount: 60, spread: 80, colors:['#06b6d4','#059669','#7c3aed'] });
    showToast(`¡Sección completada! +${awardCoins} coins · +${awardXP} XP`);
  } else showToast(`Progreso guardado +${awardXP} XP`);

  // unlock next tile if exists
  const idx = CATEGORIES.findIndex(c => c.id === id);
  if (idx >= 0 && idx+1 < CATEGORIES.length) {
    progress[CATEGORIES[idx+1].id].unlocked = true;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  // sync best-effort to firestore
  trySyncToFirestore();
}

/* try to sync simple state to firestore */
async function trySyncToFirestore(){
  if (!FIREBASE_AVAILABLE || !db || !auth || !auth.currentUser) return;
  try {
    const udoc = docFn(db, 'usuarios', auth.currentUser.uid);
    await setDocFn(udoc, { profile: { name: profile.name, totalXP: profile.totalXP, carlitosCoins: profile.carlitosCoins }, progress }, { merge: true });
  } catch (e) { console.warn('sync fail', e); }
}

/* small helpers */
function shadeColor(hex, percent) {
  const f = hex.slice(1), t = percent < 0 ? 0 : 255, p = Math.abs(percent)/100;
  const R = parseInt(f.substring(0,2),16), G = parseInt(f.substring(2,4),16), B = parseInt(f.substring(4,6),16);
  const newR = Math.round((t - R) * p) + R;
  const newG = Math.round((t - G) * p) + G;
  const newB = Math.round((t - B) * p) + B;
  return `rgb(${newR},${newG},${newB})`;
}

/* theme */
function initTheme(){
  const stored = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(stored);
  toggleThemeBtn.onclick = () => {
    const cur = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };
}
function applyTheme(theme){
  if (theme === 'dark') { document.body.classList.add('dark-theme'); toggleThemeBtn.textContent='💡'; } else { document.body.classList.remove('dark-theme'); toggleThemeBtn.textContent='🌙'; }
  localStorage.setItem(THEME_KEY, theme);
  setTimeout(()=> {}, 120);
}

/* simulate demo generation */
btnSimulate.addEventListener('click', ()=>{
  if (!confirm('Generar demo local de progreso?')) return;
  CATEGORIES.forEach((c,i) => {
    progress[c.id] = { pct: Math.floor(Math.random()*100), unlocked:true, completed: Math.random()>.5 };
  });
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  showToast('Demo creado (local)');
  buildTiles(filterSelect.value);
});

/* filter */
filterSelect.addEventListener('change', (e)=> buildTiles(e.target.value));

/* tour - simple */
btnTour.addEventListener('click', ()=> {
  const root = document.getElementById('tour-root'); root.innerHTML='';
  const ov = document.createElement('div'); ov.className='tour-overlay'; const b = document.createElement('div'); b.className='tour-bubble';
  root.appendChild(ov); root.appendChild(b);
  b.innerHTML = `<strong style="display:block;margin-bottom:8px">Tour rápido</strong><div class="muted">Explora las secciones. Pulsa EMPEZAR para completar y ganar recompensas.</div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><button id="t-close" class="btn ghost">Cerrar</button></div>`;
  b.querySelector('#t-close').onclick = ()=> root.innerHTML='';
  ov.onclick = ()=> root.innerHTML='';
});

/* auth watcher (best-effort) */
async function onAuthReady(){
  if (!FIREBASE_AVAILABLE || !onAuthStateChanged) {
    // local: render header + tiles
    renderHeader(); buildTiles();
    return;
  }
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // no auth -> show modal to go login
      const m = openModal(`<strong>No estás autenticado</strong><p class="muted" style="margin-top:8px">Inicia sesión con Google para sincronizar tu progreso.</p>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button id="m-close" class="btn ghost">Cerrar</button><button id="m-login" class="btn primary">Ir a Iniciar</button></div>`);
      m.querySelector('#m-close').onclick = closeModal;
      m.querySelector('#m-login').onclick = ()=> { window.location.href = './index.html'; };
      return;
    }
    // fetch profile if exists
    try {
      const ref = docFn(db, 'usuarios', user.uid);
      const snap = await getDocFn(ref);
      if (snap && snap.exists && snap.exists()) {
        const data = snap.data();
        profile = Object.assign({}, profile, data.profile || {});
        if (data.progress) progress = Object.assign({}, progress, data.progress);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } else {
        // create basic doc
        await setDocFn(ref, { profile: { name: user.displayName || 'Explorador', totalXP: profile.totalXP || 0, carlitosCoins: profile.carlitosCoins || 0 } }, { merge: true });
      }
    } catch (e) { console.warn('fetch profile', e); }
    renderHeader(); buildTiles();
  });
}

/* init */
(function init(){
  initTheme();
  renderHeader();
  buildTiles();
  onAuthReady();
  // observe resize to redraw (no heavy)
  new ResizeObserver(()=> {}).observe(tilesGrid);
})();
