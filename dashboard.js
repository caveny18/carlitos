// dashboard.js
// Módulo para hacer operativo el dashboard Carlitos
// Requiere:
//  - dashboard.html (ya proporcionado)
//  - firebase-config.js exportando { db, auth } (opcional)
//  - Chart.js, Intro.js cargados en el HTML
// Nota: Mantén type="module" cuando lo incluyas en el HTML.

import { db, auth } from './firebase-config.js';
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

/* ==========================
   Estado inicial y utilidades
   ========================== */
const STATE = {
  user: {
    uid: null,
    name: null,
  },
  movimientos: [], // {id, tipo:'ingreso'|'egreso', monto, fecha (ISO), categoria, nota}
  metas: [],       // {id, titulo, tipo, target, createdAt}
  xp: 0,
  coins: 0,
  charts: {},
  overviewRange: 'month', // day | week | month
};

// IDs / DOM
const $ = (id) => document.getElementById(id);

// Safe get for classes
function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// Formateo monetario
const fmt = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
};

// Generar ID simple
const uid = () => 'id' + Math.random().toString(36).slice(2, 9);

/* ==========================
   Inicialización DOM
   ========================== */

document.addEventListener('DOMContentLoaded', () => {
  bindNav();
  bindThemeToggle();
  initializeMentor();
  initializeOverviewChart();
  initializeSimulators();
  initializeHistoric();
  initializeGoals();
  initializeTour();
  loadProfileAndData();
  bindMentorCallButtons();
  bindOverviewFilters();
});

/* ==========================
   NAV / Secciones
   ========================== */
function bindNav() {
  $all('.nav-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const sec = e.currentTarget.dataset.section;
      showSection(sec);
    });
  });

  // Default show inicio
  showSection('inicio');
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');

  // Run contextual mentor hint if visible
  showMentorHintForSection(id);
}

/* ==========================
   THEME
   ========================== */
function bindThemeToggle() {
  const btn = $('toggle-theme-sidebar');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const body = document.body;
    const current = body.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', next);
    if (next === 'dark') {
      body.classList.add('bg-slate-900', 'text-white');
      body.classList.remove('bg-white', 'text-slate-900');
      btn.textContent = 'Modo Claro';
    } else {
      body.classList.remove('bg-slate-900', 'text-white');
      body.classList.add('bg-white', 'text-slate-900');
      btn.textContent = 'Modo Oscuro';
    }
    localStorage.setItem('carlitos_theme', next);
  });

  // load pref
  const pref = localStorage.getItem('carlitos_theme') || 'light';
  if (pref === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.body.classList.add('bg-slate-900', 'text-white');
    btn.textContent = 'Modo Claro';
  }
}

/* ==========================
   PROFILE & DATA (Firestore optional)
   ========================== */
async function loadProfileAndData() {
  // cargar perfil desde localStorage (onboarding guarda 'carlitos_profile_data' en onboarding.js)
  let profileRaw = localStorage.getItem('carlitos_profile_data');
  if (profileRaw) {
    try {
      const p = JSON.parse(profileRaw);
      STATE.user.name = p.nombre || p.name || p.displayName || 'Usuario';
      STATE.xp = p.xp || 0;
      STATE.coins = p.coins || 0;
    } catch (e) {
      console.warn('error parse profile', e);
    }
  } else {
    // fallback: si hay un profile guardado con otra clave
    const p2 = localStorage.getItem('carlitos_profile');
    if (p2) {
      try { STATE.user.name = JSON.parse(p2).name || 'Usuario'; } catch {}
    }
  }

  // update UI
  $('welcome-name').textContent = STATE.user.name || 'Usuario';
  $('user-name').textContent = STATE.user.name || 'Usuario';
  $('xp-current').textContent = STATE.xp;
  $('coins-badge').textContent = STATE.coins;

  // Intenta sincronizar con Firebase si hay sesión
  try {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        STATE.user.uid = user.uid;
        // intenta cargar movimientos de Firestore
        await loadMovementsFromFirestore(user.uid);
        await loadGoalsFromFirestore(user.uid);
      } else {
        // si no hay user, carga local
        loadFromLocal();
      }
      updateAllUI();
    });
  } catch (e) {
    console.warn('Firebase auth not available or not configured', e);
    loadFromLocal();
    updateAllUI();
  }
}

function loadFromLocal() {
  const mv = localStorage.getItem('carlitos_movimientos');
  if (mv) {
    try { STATE.movimientos = JSON.parse(mv); } catch { STATE.movimientos = []; }
  }
  const metas = localStorage.getItem('carlitos_metas');
  if (metas) {
    try { STATE.metas = JSON.parse(metas); } catch { STATE.metas = []; }
  }
}

async function loadMovementsFromFirestore(uid) {
  if (!db) return loadFromLocal();
  try {
    const col = collection(db, 'usuarios', uid, 'movimientos');
    const q = query(col, orderBy('fecha', 'desc'));
    const snap = await getDocs(q);
    STATE.movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // convert fecha to ISO if needed
    STATE.movimientos = STATE.movimientos.map(m => ({ ...m, fecha: m.fecha && m.fecha.seconds ? new Date(m.fecha.seconds * 1000).toISOString() : (m.fecha || new Date().toISOString()) }));
  } catch (e) {
    console.warn('Error leyendo movimientos Firestore', e);
    loadFromLocal();
  }
}

async function loadGoalsFromFirestore(uid) {
  if (!db) return;
  try {
    const col = collection(db, 'usuarios', uid, 'metas');
    const snap = await getDocs(col);
    STATE.metas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Error leyendo metas Firestore', e);
  }
}

/* ==========================
   Guardar (Firestore preferido, fallback local)
   ========================== */
async function saveMovements() {
  localStorage.setItem('carlitos_movimientos', JSON.stringify(STATE.movimientos));
  // if user logged -> save to firestore (basic approach: overwrite each doc or set by id)
  try {
    if (STATE.user.uid && db) {
      const baseCol = collection(db, 'usuarios', STATE.user.uid, 'movimientos');
      // Note: to avoid deleting other docs we'll upsert each item
      for (const m of STATE.movimientos) {
        if (!m.id) m.id = uid();
        await setDoc(doc(db, 'usuarios', STATE.user.uid, 'movimientos', m.id), {
          tipo: m.tipo,
          monto: Number(m.monto),
          fecha: m.fecha,
          categoria: m.categoria,
          nota: m.nota || ''
        });
      }
    }
  } catch (e) {
    console.warn('No se pudo sincronizar movimientos a Firestore', e);
  }
}

async function saveGoals() {
  localStorage.setItem('carlitos_metas', JSON.stringify(STATE.metas));
  try {
    if (STATE.user.uid && db) {
      for (const g of STATE.metas) {
        if (!g.id) g.id = uid();
        await setDoc(doc(db, 'usuarios', STATE.user.uid, 'metas', g.id), {
          titulo: g.titulo,
          tipo: g.tipo,
          target: Number(g.target),
          createdAt: g.createdAt,
        });
      }
    }
  } catch (e) {
    console.warn('No se pudo sincronizar metas a Firestore', e);
  }
}

/* ==========================
   Registrar movimiento (registro rápido y formulario completo opcional)
   ========================== */
function initializeHistoric() {
  // Aquí añadiremos la UI de registro rápido (botones, inputs dinámicos)
  // Como tu HTML no incluye inputs rápidos, crearé un pequeño widget en JS
  const inicioSection = $('inicio');
  if (!inicioSection) return;

  // Crear formulario rápido dinámico dentro del primer card
  const card = inicioSection.querySelector('.p-4.rounded-2xl.border');
  if (!card) return;

  // widget
  const wrapper = document.createElement('div');
  wrapper.className = 'mt-4 p-2 border rounded bg-slate-50 dark:bg-slate-800';
  wrapper.innerHTML = `
    <div class="flex gap-2">
      <input id="quick-amount" type="number" placeholder="Monto" class="p-2 border rounded flex-1"/>
      <select id="quick-type" class="p-2 border rounded">
        <option value="ingreso">Ingreso</option>
        <option value="egreso">Gasto</option>
      </select>
      <input id="quick-categoria" placeholder="Categoría" class="p-2 border rounded w-32"/>
      <button id="quick-add" class="px-3 py-2 border rounded">Añadir</button>
    </div>
  `;
  card.appendChild(wrapper);

  // bind
  $('#quick-add').addEventListener('click', () => {
    const monto = Number($('#quick-amount').value) || 0;
    const tipo = $('#quick-type').value;
    const categoria = $('#quick-categoria').value || (tipo === 'ingreso' ? 'Varios' : 'Gastos Varios');
    if (!monto) {
      toast('Ingresa un monto válido');
      return;
    }
    const mv = {
      id: uid(),
      tipo,
      monto,
      fecha: new Date().toISOString(),
      categoria,
      nota: 'Registro rápido'
    };
    STATE.movimientos.unshift(mv);
    // Recompensa simple: coins/xp
    STATE.xp += Math.round(Math.min(10, Math.abs(monto) / 10));
    STATE.coins += Math.round(Math.min(5, Math.abs(monto) / 20));
    saveMovements();
    saveProfileXP();
    updateAllUI();
    // limpiar inputs
    $('#quick-amount').value = '';
    $('#quick-categoria').value = '';
    showMentorMessage(`¡Listo! He agregado tu ${tipo} de ${fmt(monto)}`, 'ensenando');
  });

  // Also expose a full form on Registro section if exists
  const registroSection = $('registro');
  if (registroSection) {
    // If you have a full form in your real HTML, you should hook it here.
  }

  // HISTORY table render
  renderHistoryTable();
}

// save xp/coins to profile local
function saveProfileXP() {
  try {
    const raw = localStorage.getItem('carlitos_profile_data');
    if (!raw) {
      const p = { nombre: STATE.user.name || 'Usuario', xp: STATE.xp, coins: STATE.coins };
      localStorage.setItem('carlitos_profile_data', JSON.stringify(p));
    } else {
      const obj = JSON.parse(raw);
      obj.xp = STATE.xp;
      obj.coins = STATE.coins;
      localStorage.setItem('carlitos_profile_data', JSON.stringify(obj));
    }
    $('xp-current').textContent = STATE.xp;
    $('coins-badge').textContent = STATE.coins;
  } catch (e) {
    console.warn('error saving profile xp', e);
  }
}

/* ==========================
   HISTORIAL / Tabla / Export
   ========================== */
function renderHistoryTable() {
  const container = $('history-table');
  if (!container) return;

  container.innerHTML = '';
  // header with export buttons
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-2';
  header.innerHTML = `
    <div class="text-sm font-semibold">Movimientos (${STATE.movimientos.length})</div>
    <div class="flex gap-2">
      <button id="export-json" class="px-2 py-1 border rounded text-xs">Exportar JSON</button>
      <button id="export-csv" class="px-2 py-1 border rounded text-xs">Exportar CSV</button>
    </div>
  `;
  container.appendChild(header);

  // table
  const table = document.createElement('table');
  table.className = 'w-full text-sm';
  table.innerHTML = `
    <thead class="sticky top-0 bg-white"><tr>
      <th class="p-2 text-left">Fecha</th><th class="p-2 text-left">Tipo</th><th class="p-2 text-right">Monto</th><th class="p-2 text-left">Categoría</th><th class="p-2">Acciones</th>
    </tr></thead>
    <tbody id="history-body"></tbody>
  `;
  container.appendChild(table);

  const tbody = $('history-body');

  if (STATE.movimientos.length === 0) {
    tbody.innerHTML = `<tr><td class="p-2" colspan="5">No hay movimientos aún. Usa el registro rápido para añadir tu primer movimiento.</td></tr>`;
  } else {
    for (const m of STATE.movimientos) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="p-2">${new Date(m.fecha).toLocaleString()}</td>
        <td class="p-2">${m.tipo}</td>
        <td class="p-2 text-right">${fmt(m.monto)}</td>
        <td class="p-2">${m.categoria || '-'}</td>
        <td class="p-2">
          <button data-id="${m.id}" class="delete-mv px-2 py-1 border rounded text-xs">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  // bind delete buttons
  container.querySelectorAll('.delete-mv').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      STATE.movimientos = STATE.movimientos.filter(x => x.id !== id);
      await saveMovements();
      renderHistoryTable();
      updateAllUI();
      toast('Movimiento eliminado');
    });
  });

  // export
  $('#export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(STATE.movimientos, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'movimientos.json');
  });
  $('#export-csv').addEventListener('click', () => {
    const csv = toCSV(STATE.movimientos);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'movimientos.csv');
  });
}

function toCSV(arr) {
  if (!arr || !arr.length) return '';
  const keys = ['fecha', 'tipo', 'monto', 'categoria', 'nota'];
  const rows = [keys.join(',')];
  for (const a of arr) {
    rows.push(keys.map(k => `"${(a[k] || '').toString().replace(/"/g, '""')}"`).join(','));
  }
  return rows.join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ==========================
   GRÁFICOS (Chart.js)
   ========================== */
function initializeOverviewChart() {
  const ctx = $('chart-overview')?.getContext('2d');
  if (!ctx) return;
  STATE.charts.overview = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [], datasets: [
        { label: 'Ingresos', data: [], stack: 's1', backgroundColor: undefined },
        { label: 'Gastos', data: [], stack: 's1', backgroundColor: undefined }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: false }
      }
    }
  });

  updateOverviewChart();
}

function bindOverviewFilters() {
  ['overview-filter-day','overview-filter-week','overview-filter-month'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      STATE.overviewRange = id.includes('day') ? 'day' : id.includes('week') ? 'week' : 'month';
      updateOverviewChart();
      // visual active
      ['overview-filter-day','overview-filter-week','overview-filter-month'].forEach(i => $(i).classList.remove('bg-indigo-500','text-white'));
      e.currentTarget.classList.add('bg-indigo-500','text-white');
    });
  });
}

function updateOverviewChart() {
  const ch = STATE.charts.overview;
  if (!ch) return;

  // prepare labels based on range
  const range = STATE.overviewRange;
  let labels = [];
  let ingresosData = [];
  let gastosData = [];

  const now = new Date();

  if (range === 'day') {
    // last 24 hours (by hour)
    labels = Array.from({length: 24}, (_, i) => `${i}:00`);
    ingresosData = new Array(24).fill(0);
    gastosData = new Array(24).fill(0);
    STATE.movimientos.forEach(m => {
      const d = new Date(m.fecha);
      const diffHours = Math.floor((now - d) / (1000 * 60 * 60));
      if (diffHours <= 24) {
        const h = d.getHours();
        if (m.tipo === 'ingreso') ingresosData[h] += Number(m.monto);
        else gastosData[h] += Number(m.monto);
      }
    });
  } else if (range === 'week') {
    // last 7 days
    labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i);
      labels.push(d.toLocaleDateString());
    }
    ingresosData = new Array(7).fill(0);
    gastosData = new Array(7).fill(0);
    STATE.movimientos.forEach(m => {
      const d = new Date(m.fecha);
      const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diffDays <= 6) {
        const idx = 6 - diffDays;
        if (m.tipo === 'ingreso') ingresosData[idx] += Number(m.monto);
        else gastosData[idx] += Number(m.monto);
      }
    });
  } else {
    // month -> last 30 days
    labels = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i);
      labels.push(d.toLocaleDateString());
    }
    ingresosData = new Array(30).fill(0);
    gastosData = new Array(30).fill(0);
    STATE.movimientos.forEach(m => {
      const d = new Date(m.fecha);
      const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diffDays <= 29) {
        const idx = 29 - diffDays;
        if (m.tipo === 'ingreso') ingresosData[idx] += Number(m.monto);
        else gastosData[idx] += Number(m.monto);
      }
    });
  }

  ch.data.labels = labels;
  ch.data.datasets[0].data = ingresosData;
  ch.data.datasets[1].data = gastosData;
  ch.update();
}

/* ==========================
   Simuladores
   ========================== */
function initializeSimulators() {
  // ahorro mensual
  const runS1 = $('run-s1');
  const resetS1 = $('reset-s1');
  if (runS1) runS1.addEventListener('click', () => {
    const M = Number($('s1-monthly').value) || 0;
    const r = Number($('s1-rate').value) / 100 || 0;
    const n = Number($('s1-years').value) || 0;
    const total = futureValueMonthly(M, r, n);
    $('s1-result').textContent = fmt(total);
  });
  if (resetS1) resetS1.addEventListener('click', () => {
    $('s1-monthly').value = ''; $('s1-rate').value = ''; $('s1-years').value = '';
    $('s1-result').textContent = '$0';
  });

  // millonario
  const runM = $('run-million');
  const resetM = $('reset-million');
  if (runM) runM.addEventListener('click', () => {
    const M = Number($('million-monthly').value) || 0;
    const r = Number($('million-rate').value) / 100 || 0;
    if (!M || r <= 0) {
      $('million-result').textContent = 'Ingresa aporte y tasa válida';
      return;
    }
    const months = monthsToReachTarget(M, r, 1000000);
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    $('million-result').textContent = `${years} años y ${remMonths} meses (~${months} meses)`;
  });
  if (resetM) resetM.addEventListener('click', () => {
    $('million-monthly').value = ''; $('million-rate').value = ''; $('million-result').textContent = '—';
  });
}

function futureValueMonthly(monthly, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}

function monthsToReachTarget(monthly, annualRate, target) {
  const r = annualRate / 12;
  let bal = 0;
  let months = 0;
  while (bal < target && months < 1000 * 12) { // límite
    bal = bal * (1 + r) + monthly;
    months++;
  }
  return months;
}

/* ==========================
   METAS (Herramientas)
   ========================== */
function initializeGoals() {
  // render existing
  renderGoalsList();

  const addBtn = $('add-goal');
  if (!addBtn) return;
  addBtn.addEventListener('click', async () => {
    const titulo = $('goal-title').value?.trim() || '';
    const target = Number($('goal-target').value) || 0;
    const tipo = $('goal-type').value || 'ahorro';
    if (!titulo || target <= 0) {
      toast('Completa título y monto de la meta');
      return;
    }
    const g = { id: uid(), titulo, target, tipo, createdAt: new Date().toISOString() };
    STATE.metas.push(g);
    await saveGoals();
    renderGoalsList();
    $('goal-title').value = ''; $('goal-target').value = '';
    toast('Meta añadida');
  });
}

function renderGoalsList() {
  const container = $('goals-list');
  if (!container) return;
  container.innerHTML = '';

  if (!STATE.metas.length) {
    container.innerHTML = `<div class="text-sm text-slate-500">No tienes metas aún. Crea una para empezar a ahorrar.</div>`;
    return;
  }

  const list = document.createElement('div');
  list.className = 'space-y-2';
  for (const g of STATE.metas) {
    const progress = computeGoalProgress(g);
    const el = document.createElement('div');
    el.className = 'p-2 border rounded flex items-center justify-between';
    el.innerHTML = `
      <div>
        <div class="font-semibold">${g.titulo} <span class="text-xs text-slate-500">(${g.tipo})</span></div>
        <div class="text-xs text-slate-500">Meta: ${fmt(g.target)} — Progreso: ${Math.round(progress * 100)}%</div>
      </div>
      <div class="flex gap-2 items-center">
        <button data-id="${g.id}" class="delete-goal px-2 py-1 border rounded text-xs">Eliminar</button>
      </div>
    `;
    list.appendChild(el);
  }
  container.appendChild(list);

  container.querySelectorAll('.delete-goal').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      STATE.metas = STATE.metas.filter(x => x.id !== id);
      await saveGoals();
      renderGoalsList();
      toast('Meta eliminada');
    });
  });
}

function computeGoalProgress(goal) {
  // simple heuristic: suma de ingresos recientes / target
  const recentIngresos = STATE.movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  return Math.min(1, recentIngresos / (goal.target || 1));
}

/* ==========================
   Mentor Interactivo
   ========================== */
const MENTOR = {
  visible: false,
  avatarEl: null,
  bubbleEl: null,
  timeoutId: null,
  images: {
    normal: null,
    ensenando: null,
    riendo: null,
    confundido: null
  }
};

function initializeMentor() {
  MENTOR.avatarEl = $('mentor-avatar');
  MENTOR.bubbleEl = $('mentor-bubble');
  // Default avatar: simple emoji or gradient
  if (MENTOR.avatarEl) {
    MENTOR.avatarEl.innerHTML = `<div class="w-full h-full flex items-center justify-center text-4xl">🦊</div>`;
    MENTOR.avatarEl.style.pointerEvents = 'auto';
  }
  // Hide by default (already hidden in HTML)
}

function bindMentorCallButtons() {
  $all('.mentor-call-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const tool = e.currentTarget.dataset.tool || 'inicio';
      openMentorBubbleFor(tool);
    });
  });
}

function openMentorBubbleFor(context) {
  let msg = 'Hola, ¿en qué te ayudo?';
  switch (context) {
    case 'inicio':
      msg = `¡Hola ${STATE.user.name || 'amigo'}! Puedes registrar ingresos/gastos rápido aquí. ¿Quieres ayuda con un simulador?`;
      break;
    case 'registro':
      msg = 'En el registro puedes detallar monto, categoría y fecha. Yo te ayudo a elegir categorías.';
      break;
    case 'historico':
      msg = 'Aquí están tus movimientos. Puedes exportarlos o eliminarlos.';
      break;
    case 'simuladores':
      msg = 'Prueba hacer pequeñas variaciones en la tasa para ver cómo cambia tu ahorro.';
      break;
    default:
      msg = 'Puedo ayudarte con metas, simuladores y con interpretar tus gastos.';
  }
  showMentorMessage(msg, 'ensenando');
}

function showMentorMessage(text, state = 'normal', ttl = 4000) {
  if (!MENTOR.bubbleEl || !MENTOR.avatarEl) return;
  MENTOR.bubbleEl.classList.remove('hidden');
  MENTOR.bubbleEl.style.pointerEvents = 'auto';
  MENTOR.bubbleEl.querySelector('#mentor-text').textContent = text;
  // small show/hide logic
  if (MENTOR.timeoutId) clearTimeout(MENTOR.timeoutId);
  MENTOR.timeoutId = setTimeout(() => {
    MENTOR.bubbleEl.classList.add('hidden');
  }, ttl);
}

function showMentorHintForSection(sectionId) {
  // quick hints when navigating
  if (sectionId === 'inicio') showMentorMessage('Resumen diario: revisa tu saldo estimado y registra movimientos rápidos.', 'ensenando', 3000);
  if (sectionId === 'simuladores') showMentorMessage('¿Quieres simular cuánto ahorrarás? Introduce un aporte mensual y tasa.', 'ensenando', 3500);
}

/* ==========================
   Tour Guiado (Intro.js)
   ========================== */
function initializeTour() {
  const btn = $('tour-general-btn');
  if (!btn) return;
  btn.addEventListener('click', () => startTour());
}

function startTour() {
  const intro = introJs();
  intro.setOptions({
    steps: [
      { intro: "Bienvenido a Carlitos — te guiaré por lo importante." },
      { element: document.querySelector('#welcome-name'), intro: "Aquí está tu nombre y el saludo." },
      { element: document.querySelector('#predicted-balance'), intro: "Tu saldo estimado aparece aquí." },
      { element: document.querySelector('#chart-overview'), intro: "Gráficos rápidos: ingresos vs gastos." },
      { element: document.querySelector('#quick-amount') || '.nav-btn', intro: "Registro rápido para añadir movimientos." },
      { element: document.querySelector('#run-s1'), intro: "Simuladores: prueba ahorro mensual." },
      { element: document.querySelector('#goals-list'), intro: "Metas: configura objetivos de ahorro o reducción de gastos." },
      { intro: "Eso es todo por ahora. ¡A empezar!" }
    ],
    showStepNumbers: false,
    exitOnEsc: true,
    exitOnOverlayClick: true,
    showBullets: true,
  });

  intro.start();
}

/* ==========================
   UTILS: Toast
   ========================== */
function toast(msg, ttl = 2500) {
  // simple toast at bottom-right
  const t = document.createElement('div');
  t.className = 'fixed right-6 bottom-6 px-4 py-2 rounded bg-black text-white shadow';
  t.style.zIndex = 9999;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('opacity-0'), ttl - 200);
  setTimeout(() => t.remove(), ttl);
}

/* ==========================
   UPDATE UI: summary, charts, history
   ========================== */
function updateAllUI() {
  updateSummary();
  updateOverviewChart();
  renderHistoryTable();
  renderGoalsList();
}

function updateSummary() {
  const ingresos = STATE.movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const egresos = STATE.movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0);
  const balance = ingresos - egresos;
  $('total-ingresos').textContent = fmt(ingresos);
  $('total-egresos').textContent = fmt(egresos);
  $('predicted-balance').textContent = fmt(balance);
  $('xp-current').textContent = STATE.xp;
  $('coins-badge').textContent = STATE.coins;
}

/* ==========================
   Buttons / Helpers binding
   ========================== */
function bindOverviewFilters() {
  // already bound in initializeOverviewChart via IDs
}

/* ==========================
   Helper: bind buttons not yet bound
   ========================== */
function bindMentorCallButtons() {
  // already done earlier
}

/* ==========================
   Small extra utilities
   ========================== */
// Convert numbers friendly
function safeNum(v) { return Number(v) || 0; }

/* ==========================
   End of module
   ========================== */

