// dashboard.js  (ES module)
// Guardar como dashboard.js y referenciar desde dashboard.html con <script type="module" src="./dashboard.js"></script>
// Requisitos opcionales: ./firebase-config.js exportando { db, auth } para sincronizar con Firestore.
// Chart.js debe estar cargado en el HTML (CDN).

/* ========= DYNAMIC FIREBASE IMPORT (optional) ========= */
let db = null, auth = null, onAuthStateChanged = null, signOut = null;
try {
  const mod = await import('./firebase-config.js'); // si no existe, catch
  db = mod.db;
  auth = mod.auth;
  const authMod = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
  onAuthStateChanged = authMod.onAuthStateChanged;
  signOut = authMod.signOut;
} catch (e) {
  // modo local si no hay firebase
  // console.info('Firebase no disponible -> modo local', e);
}

/* ========= DOM REFS ========= */
const DOM = {
  userName: document.getElementById('user-name'),
  avatarCircle: document.getElementById('avatar-circle'),
  userRole: document.getElementById('user-role'),
  userLevelBadge: document.getElementById('user-level-badge'),
  coinsAmount: document.getElementById('coins-amount'),
  xpBar: document.getElementById('xp-bar'),
  xpText: document.getElementById('xp-text'),
  balanceChartCanvas: document.getElementById('balanceChart'),
  chartLegend: document.getElementById('chart-legend'),
  toolsCompact: document.getElementById('tools-compact'),
  transactionsList: document.getElementById('transactions-list'),
  goalsList: document.getElementById('goals-list'),
  openAddTransaction: document.getElementById('open-add-transaction'),
  openAddGoal: document.getElementById('open-add-goal'),
  modalRoot: document.getElementById('modal-root'),
  startTourBtn: document.getElementById('start-tour'),
  logoutBtn: document.getElementById('logout'),
  simulateBtn: document.getElementById('simulate-data'),
  clearTestBtn: document.getElementById('clear-test-data'),
  chartTypeSelect: document.getElementById('chart-type'),
  manageCategoriesBtn: document.getElementById('manage-categories'),
  fastIncome: document.getElementById('fast-income'),
  fastExpense: document.getElementById('fast-expense'),
};

/* ========= KEYS, PATHS, DEFAULTS ========= */
const PROFILE_KEY = 'carlitos_profile_data';
const UID_KEY = 'carlitos_user_uid';
const CATEGORIES_KEY = 'carlitos_categories';
const TEST_FLAG_KEY = 'carlitos_test_data_created';
const IMG_PATH = ''; // si tus imágenes de mentor están en /assets/ pon '/assets/'

const DEFAULT_CATEGORIES = [
  { id: 'alimentos', name: 'Alimentos', color: '#f97316' },
  { id: 'transporte', name: 'Transporte', color: '#06b6d4' },
  { id: 'salidas', name: 'Salidas', color: '#ef4444' },
  { id: 'suscripciones', name: 'Suscripciones', color: '#8b5cf6' },
  { id: 'otros', name: 'Otros', color: '#94a3b8' },
];

/* evitar canvas borroso */
if (window.Chart) Chart.defaults.devicePixelRatio = window.devicePixelRatio || 1;

let chartInstance = null;
let chartType = localStorage.getItem('carlitos_chart_type') || 'doughnut';

/* ========= LEVELS & TOOLS ========= */
const LEVELS = [
  { name: "Novato", minXP: 0, maxXP: 100, title: "El Curioso", toolsRequired: 0 },
  { name: "Aprendiz", minXP: 100, maxXP: 350, title: "El Experimentador", toolsRequired: 1 },
  { name: "Estratega", minXP: 350, maxXP: 800, title: "El Analista", toolsRequired: 3 },
  { name: "Maestro", minXP: 800, maxXP: 1500, title: "El Optimizador", toolsRequired: 6 },
  { name: "Leyenda", minXP: 1500, maxXP: 99999, title: "El Inmortal", toolsRequired: 10 },
];
const ALL_TOOLS = [
  { id: 'registro_gastos', name: 'Registro de Ingresos y Gastos', requiredLevel: 1 },
  { id: 'planificador_presupuesto', name: 'Planificador de Presupuesto (50/30/20)', requiredLevel: 2 },
  { id: 'simulador_inversiones', name: 'Simulador de Inversiones Básicas', requiredLevel: 3 },
  { id: 'control_deuda', name: 'Control de Deuda', requiredLevel: 4 },
];

function calculateProgress(totalXp) {
  let currentLevel = LEVELS[0];
  let progressPercentage = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp < LEVELS[i].maxXP) {
      currentLevel = LEVELS[i];
      const xpInLevel = totalXp - currentLevel.minXP;
      const levelRange = currentLevel.maxXP - currentLevel.minXP;
      progressPercentage = (xpInLevel / levelRange) * 100;
      return { level: currentLevel, progressPercentage, xpToNextLevel: currentLevel.maxXP, currentLevelXp: totalXp };
    }
  }
  const lastLevel = LEVELS[LEVELS.length - 1];
  return { level: lastLevel, progressPercentage: 100, xpToNextLevel: lastLevel.maxXP, currentLevelXp: totalXp };
}

/* ========= FIRESTORE HELPERS (best-effort) ========= */
async function addTransactionToFirestore(uid, tx) {
  if (!db || !uid) return false;
  try {
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const col = collection(db, 'usuarios', uid, 'transactions');
    await addDoc(col, tx);
    return true;
  } catch (e) { console.error('addTransaction firestore', e); return false; }
}
async function addGoalToFirestore(uid, goal) {
  if (!db || !uid) return false;
  try {
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const col = collection(db, 'usuarios', uid, 'goals');
    await addDoc(col, goal);
    return true;
  } catch (e) { console.error('addGoal firestore', e); return false; }
}
async function addCategoryToFirestore(uid, cat) {
  if (!db || !uid) return false;
  try {
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const col = collection(db, 'usuarios', uid, 'categories');
    await addDoc(col, cat);
    return true;
  } catch (e) { console.error('addCategory firestore', e); return false; }
}
async function fetchTransactionsFirestore(uid) {
  if (!db || !uid) return [];
  try {
    const { collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const col = collection(db, 'usuarios', uid, 'transactions');
    const q = query(col, orderBy('date', 'desc'), limit(200));
    const snap = await getDocs(q);
    const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); return arr;
  } catch (e) { console.error('fetchTransactions firestore', e); return []; }
}
async function fetchGoalsFirestore(uid) {
  if (!db || !uid) return [];
  try {
    const { collection, query, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const col = collection(db, 'usuarios', uid, 'goals');
    const q = query(col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); return arr;
  } catch (e) { console.error('fetchGoals firestore', e); return []; }
}
async function fetchCategoriesFirestore(uid) {
  if (!db || !uid) return [];
  try {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const col = collection(db, 'usuarios', uid, 'categories');
    const snap = await getDocs(col);
    const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); return arr;
  } catch (e) { console.error('fetchCategories firestore', e); return []; }
}

/* ========= LOCAL STORAGE HELPERS ========= */
function readLocalCategories() {
  const raw = localStorage.getItem(CATEGORIES_KEY);
  if (!raw) { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES)); return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); }
  try { return JSON.parse(raw); } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); }
}
function saveLocalCategories(list) { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list)); }
function saveLocalTx(tx) { const l = JSON.parse(localStorage.getItem('local_tx') || '[]'); l.unshift(tx); localStorage.setItem('local_tx', JSON.stringify(l)); }
function saveLocalGoal(g) { const l = JSON.parse(localStorage.getItem('local_goals') || '[]'); l.unshift(g); localStorage.setItem('local_goals', JSON.stringify(l)); }

/* ========= RENDERERS ========= */
function renderTransactions(list = []) {
  DOM.transactionsList.innerHTML = '';
  if (!list.length) { DOM.transactionsList.innerHTML = `<div class="small-muted p-2">Aún no hay transacciones.</div>`; return; }
  list.slice(0, 50).forEach(tx => {
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between p-2 border rounded-lg';
    el.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">${tx.type === 'income' ? '💵' : '🧾'}</div>
        <div>
          <div class="font-medium">${tx.title}</div>
          <div class="small-muted text-xs">${new Date(tx.date).toLocaleString()}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="${tx.type === 'income' ? 'positive' : 'negative'} font-semibold">${tx.amount >= 0 ? 'S/ ' + Number(tx.amount).toLocaleString('es-CL') : 'S/ ' + Math.abs(tx.amount).toLocaleString('es-CL')}</div>
        <div class="small-muted text-xs">${tx.category || '—'}</div>
      </div>
    `;
    DOM.transactionsList.appendChild(el);
  });
}

function renderGoals(goals = []) {
  DOM.goalsList.innerHTML = '';
  if (!goals || !goals.length) { DOM.goalsList.innerHTML = `<div class="small-muted p-2">Sin metas. Crea una para empezar a ahorrar.</div>`; return; }
  goals.forEach(g => {
    const current = Number(g.current || 0); const target = Number(g.target || 1);
    const pct = Math.min(100, Math.round((current / target) * 100));
    const wrapper = document.createElement('div');
    wrapper.className = 'p-3 border rounded-lg';
    wrapper.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold">${g.title}</div>
          <div class="small-muted text-xs">${current.toLocaleString('es-CL')} / ${target.toLocaleString('es-CL')}</div>
        </div>
        <div class="text-sm font-bold text-pink-500">${pct}%</div>
      </div>
      <div class="mt-3 w-full bg-gray-100 h-2 rounded-full overflow-hidden">
        <div style="width:${pct}%" class="h-2 bg-gradient-to-r from-pink-500 to-pink-300"></div>
      </div>
    `;
    DOM.goalsList.appendChild(wrapper);
  });
}

function renderTools(level) {
  DOM.toolsCompact.innerHTML = '';
  const currentLevelIndex = LEVELS.findIndex(l => l.name === level.name) + 1;
  ALL_TOOLS.forEach(t => {
    const unlocked = t.requiredLevel <= currentLevelIndex;
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between p-2 rounded-lg';
    el.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-md bg-white/60 flex items-center justify-center">${unlocked ? '🟢' : '🔒'}</div>
        <div>
          <div class="${unlocked ? 'font-semibold' : 'small-muted'}">${t.name}</div>
          <div class="small-muted text-xs">Nivel ${t.requiredLevel}</div>
        </div>
      </div>
    `;
    DOM.toolsCompact.appendChild(el);
  });
}

/* ========= CHART HELPERS ========= */
function buildCategorySums(transactions = [], categories = []) {
  const map = {};
  categories.forEach(c => map[c.id] = { name: c.name, color: c.color, sum: 0 });
  transactions.forEach(tx => {
    const catId = (tx.category || '').toString().toLowerCase().replace(/\s+/g, '_') || 'otros';
    if (!map[catId]) {
      const found = categories.find(c => c.name.toLowerCase() === (tx.category || '').toLowerCase());
      if (found) map[found.id].sum += Math.abs(Number(tx.amount || 0));
      else { if (!map['otros']) map['otros'] = { name: 'Otros', color: '#94a3b8', sum: 0 }; map['otros'].sum += Math.abs(Number(tx.amount || 0)); }
    } else map[catId].sum += Math.abs(Number(tx.amount || 0));
  });
  return Object.values(map);
}

function drawBalanceChart(transactions = [], categories = []) {
  const catSums = buildCategorySums(transactions, categories);
  const labels = catSums.map(c => c.name);
  const colors = catSums.map(c => c.color);
  const data = catSums.map(c => Math.round(c.sum));

  DOM.chartLegend.innerHTML = '';
  catSums.forEach(c => {
    const item = document.createElement('div');
    item.className = 'tag';
    item.innerHTML = `<span class="color-preview" style="background:${c.color}"></span><span class="small-muted">${c.name}</span> <strong style="margin-left:8px">${c.sum ? 'S/ ' + c.sum.toLocaleString('es-CL') : ''}</strong>`;
    DOM.chartLegend.appendChild(item);
  });

  if (chartInstance) try { chartInstance.destroy(); } catch (e) {}
  const ctx = DOM.balanceChartCanvas.getContext('2d');

  const cfg = {
    type: chartType === 'bar' ? 'bar' : (chartType === 'line' ? 'line' : 'doughnut'),
    data: {
      labels,
      datasets: [{
        label: 'Gastos por categoría',
        data,
        backgroundColor: colors,
        borderColor: colors,
        fill: chartType === 'line',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: chartType === 'doughnut' } },
      scales: chartType === 'doughnut' ? {} : { x: { grid: { display: false } }, y: { ticks: { beginAtZero: true } } }
    }
  };

  chartInstance = new Chart(ctx, cfg);
}

/* ========= MODAL HELPERS ========= */
function openModal(html) {
  DOM.modalRoot.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = html;
  backdrop.appendChild(m);
  DOM.modalRoot.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  return m;
}
function closeModal() { DOM.modalRoot.innerHTML = ''; }

/* ========= TRANSACTION & GOAL UI ========= */
DOM.openAddTransaction?.addEventListener('click', () => openAddTransactionModal());
function openAddTransactionModal(prefill = {}) {
  const html = `
    <h3 class="text-lg font-bold mb-2">Añadir transacción</h3>
    <div class="space-y-2">
      <label class="text-xs small-muted">Título</label>
      <input id="tx-title" class="w-full border p-2 rounded" placeholder="Ej: Pago sueldo / Cena" value="${prefill.title || ''}" />
      <label class="text-xs small-muted">Tipo</label>
      <select id="tx-type" class="w-full border p-2 rounded">
        <option value="expense">Gasto</option>
        <option value="income">Ingreso</option>
      </select>
      <label class="text-xs small-muted">Categoría</label>
      <select id="tx-category" class="w-full border p-2 rounded"></select>
      <label class="text-xs small-muted">Monto (S/)</label>
      <input id="tx-amount" type="number" class="w-full border p-2 rounded" placeholder="0" value="${prefill.amount || ''}" />
      <div class="flex justify-end gap-2 mt-3">
        <button id="tx-cancel" class="px-3 py-2 rounded border">Cancelar</button>
        <button id="tx-save" class="px-4 py-2 rounded btn-primary">Guardar</button>
      </div>
    </div>
  `;
  const modal = openModal(html);
  const sel = modal.querySelector('#tx-category');
  const cats = readLocalCategories();
  cats.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; sel.appendChild(o); });
  if (prefill.type) modal.querySelector('#tx-type').value = prefill.type;
  modal.querySelector('#tx-cancel').onclick = closeModal;
  modal.querySelector('#tx-save').onclick = async () => {
    const title = modal.querySelector('#tx-title').value.trim() || 'Transacción';
    const type = modal.querySelector('#tx-type').value;
    const category = modal.querySelector('#tx-category').value || 'Otros';
    let amount = Number(modal.querySelector('#tx-amount').value) || 0;
    if (type === 'expense') amount = -Math.abs(amount);
    const tx = { title, type, category, amount, date: new Date().toISOString(), test: false };

    const uid = (currentUser && currentUser.uid) || localStorage.getItem(UID_KEY);
    if (db && uid) {
      const ok = await addTransactionToFirestore(uid, tx);
      if (!ok) saveLocalTx(tx);
    } else saveLocalTx(tx);

    closeModal();
    await refreshData();
  };
}

DOM.openAddGoal?.addEventListener('click', () => openAddGoalModal());
function openAddGoalModal() {
  const html = `
    <h3 class="text-lg font-bold mb-2">Crear Meta</h3>
    <div class="space-y-2">
      <label class="text-xs small-muted">Título</label>
      <input id="goal-title" class="w-full border p-2 rounded" placeholder="Ej: Ahorrar para laptop" />
      <label class="text-xs small-muted">Objetivo (S/)</label>
      <input id="goal-target" type="number" class="w-full border p-2 rounded" placeholder="1000" />
      <div class="flex justify-end gap-2 mt-3">
        <button id="goal-cancel" class="px-3 py-2 rounded border">Cancelar</button>
        <button id="goal-save" class="px-4 py-2 rounded btn-accent">Crear</button>
      </div>
    </div>
  `;
  const modal = openModal(html);
  modal.querySelector('#goal-cancel').onclick = closeModal;
  modal.querySelector('#goal-save').onclick = async () => {
    const title = modal.querySelector('#goal-title').value.trim() || 'Meta';
    const target = Number(modal.querySelector('#goal-target').value) || 1;
    const g = { title, target, current: 0, createdAt: new Date().toISOString(), test: false };

    const uid = (currentUser && currentUser.uid) || localStorage.getItem(UID_KEY);
    if (db && uid) {
      const ok = await addGoalToFirestore(uid, g);
      if (!ok) saveLocalGoal(g);
    } else saveLocalGoal(g);

    closeModal();
    await refreshData();
  };
}

/* ========= CATEGORIES UI ========= */
DOM.manageCategoriesBtn?.addEventListener('click', () => openManageCategoriesModal());
function openManageCategoriesModal() {
  const html = `
    <h3 class="text-lg font-bold mb-2">Categorías</h3>
    <div class="space-y-3">
      <div id="categories-list" class="space-y-2" style="max-height:240px; overflow:auto;"></div>
      <div class="pt-2 border-t">
        <div class="grid grid-cols-2 gap-2">
          <input id="new-cat-name" placeholder="Nombre categoría" class="border p-2 rounded" />
          <input id="new-cat-color" type="color" value="#06b6d4" class="border p-1 rounded" />
        </div>
        <div class="flex justify-end gap-2 mt-3">
          <button id="cat-close" class="px-3 py-2 rounded border">Cerrar</button>
          <button id="cat-add" class="px-4 py-2 rounded btn-primary">Agregar</button>
        </div>
      </div>
    </div>
  `;
  const modal = openModal(html);

  function renderList() {
    const listWrap = modal.querySelector('#categories-list');
    const list = readLocalCategories();
    listWrap.innerHTML = '';
    list.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2 border rounded';
      row.innerHTML = `<div class="flex items-center gap-3"><span class="color-preview" style="background:${c.color}"></span><div><div class="font-semibold">${c.name}</div><div class="small-muted text-xs">id: ${c.id}</div></div></div><div><button class="px-2 py-1 rounded border delete-cat" data-id="${c.id}">Eliminar</button></div>`;
      listWrap.appendChild(row);
    });
    listWrap.querySelectorAll('.delete-cat').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const list = readLocalCategories().filter(x => x.id !== id);
        saveLocalCategories(list);
        if (db && currentUser) {
          // intentar eliminar en firestore (best-effort)
          try {
            const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
            const col = collection(db, 'usuarios', currentUser.uid, 'categories');
            const snap = await getDocs(col);
            for (const d of snap.docs) {
              const data = d.data();
              if ((data.id || '').toString() === id || (data.name || '').toString().toLowerCase() === id.toLowerCase()) {
                await deleteDoc(doc(db, `usuarios/${currentUser.uid}/categories/${d.id}`));
              }
            }
          } catch (e) { console.warn('no se pudo eliminar categoria firestore', e); }
        }
        await refreshData();
        renderList();
      };
    });
  }
  renderList();
  modal.querySelector('#cat-close').onclick = closeModal;
  modal.querySelector('#cat-add').onclick = async () => {
    const name = modal.querySelector('#new-cat-name').value.trim();
    const color = modal.querySelector('#new-cat-color').value;
    if (!name) { alert('Pon nombre'); return; }
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const newCat = { id, name, color };
    const list = readLocalCategories();
    list.unshift(newCat);
    saveLocalCategories(list);
    if (db && currentUser) await addCategoryToFirestore(currentUser.uid, newCat).catch(() => {});
    modal.querySelector('#new-cat-name').value = '';
    renderList();
    await refreshData();
  };
}

/* ========= SIMULATION & CLEAR TEST DATA ========= */
DOM.simulateBtn?.addEventListener('click', () => simulateDataPrompt());
async function simulateDataPrompt() {
  const ok = confirm('Generará transacciones de ejemplo para los últimos 30 días. ¿Continuar?');
  if (!ok) return;
  await simulateData();
  alert('Datos de prueba generados. Usa "Limpiar prueba" para eliminarlos.');
}
async function simulateData() {
  const categories = readLocalCategories();
  const generated = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const count = Math.floor(Math.random() * 3) + 1;
    for (let k = 0; k < count; k++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      let amount = 0;
      const name = (cat.name || '').toLowerCase();
      if (name.includes('aliment')) amount = (Math.random() * 20 + 5);
      else if (name.includes('transp')) amount = (Math.random() * 6 + 1);
      else if (name.includes('salid')) amount = (Math.random() * 40 + 10);
      else if (name.includes('suscrip')) amount = (Math.random() * 15 + 5);
      else amount = (Math.random() * 30 + 5);
      amount = Math.round(amount * 100) / 100;
      const tx = {
        title: `${cat.name} - gasto`,
        type: 'expense',
        category: cat.name,
        amount: -Math.abs(amount),
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(Math.random() * 23), Math.floor(Math.random() * 59)).toISOString(),
        test: true
      };
      generated.push(tx);
    }
  }

  if (db && currentUser) {
    for (const tx of generated) {
      try { await addTransactionToFirestore(currentUser.uid, tx); } catch (e) { saveLocalTx(tx); }
    }
  } else {
    const l = JSON.parse(localStorage.getItem('local_tx') || '[]');
    localStorage.setItem('local_tx', JSON.stringify(generated.concat(l)));
  }
  localStorage.setItem(TEST_FLAG_KEY, 'true');
  await refreshData();
}

DOM.clearTestBtn?.addEventListener('click', () => {
  const ok = confirm('Eliminará solo los datos de prueba (marcados como test) localmente y en Firestore si estás logueado. ¿Continuar?');
  if (!ok) return;
  clearTestData();
});
async function clearTestData() {
  // Local cleanup
  try {
    localStorage.removeItem(TEST_FLAG_KEY);
    const localTx = JSON.parse(localStorage.getItem('local_tx') || '[]');
    localStorage.setItem('local_tx', JSON.stringify(localTx.filter(tx => !tx.test)));
    const localGoals = JSON.parse(localStorage.getItem('local_goals') || '[]');
    localStorage.setItem('local_goals', JSON.stringify(localGoals.filter(g => !g.test)));
  } catch (e) { console.warn('clearTestData local error', e); }

  // Firestore cleanup (best-effort)
  if (db && currentUser) {
    try {
      const mods = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const { collection, query, where, getDocs, deleteDoc, doc } = mods;
      // transactions
      try {
        const txCol = collection(db, 'usuarios', currentUser.uid, 'transactions');
        const qTx = query(txCol, where('test', '==', true));
        const snapTx = await getDocs(qTx);
        for (const d of snapTx.docs) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/transactions/${d.id}`));
      } catch (e) { console.warn('clearTestData transactions error', e); }
      // goals
      try {
        const gCol = collection(db, 'usuarios', currentUser.uid, 'goals');
        const qG = query(gCol, where('test', '==', true));
        const snapG = await getDocs(qG);
        for (const d of snapG.docs) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/goals/${d.id}`));
      } catch (e) { console.warn('clearTestData goals error', e); }
      // categories (if any created as test)
      try {
        const cCol = collection(db, 'usuarios', currentUser.uid, 'categories');
        const qC = query(cCol, where('test', '==', true));
        const snapC = await getDocs(qC);
        for (const d of snapC.docs) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/categories/${d.id}`));
      } catch (e) { console.warn('clearTestData categories error', e); }
    } catch (e) { console.warn('clearTestData firestore module error', e); }
  }

  await refreshData();
  alert('Datos de prueba eliminados (si existían).');
}

/* ========= QUICK ACTIONS & CHART TYPE ========= */
DOM.fastIncome?.addEventListener('click', () => openAddTransactionModal({ title: 'Ingreso rápido', amount: 100, type: 'income' }));
DOM.fastExpense?.addEventListener('click', () => openAddTransactionModal({ title: 'Gasto rápido', amount: 20, type: 'expense' }));

DOM.chartTypeSelect && (DOM.chartTypeSelect.value = chartType);
DOM.chartTypeSelect?.addEventListener('change', (e) => {
  chartType = e.target.value;
  localStorage.setItem('carlitos_chart_type', chartType);
  refreshChartOnly();
});

/* ========= AUTH WATCHER & DATA REFRESH ========= */
let currentUser = null;
if (onAuthStateChanged && auth) {
  onAuthStateChanged(auth, async (user) => {
    if (user) { currentUser = user; localStorage.setItem(UID_KEY, user.uid); }
    else { currentUser = null; localStorage.removeItem(UID_KEY); }
    await refreshData();
  });
} else {
  (async () => { await refreshData(); })();
}

function renderProfile(profile = {}) {
  DOM.userName.textContent = profile.name || profile.nombre || 'Usuario';
  DOM.avatarCircle.textContent = (profile.name ? profile.name[0].toUpperCase() : 'C');
  DOM.userRole.textContent = profile.role || '';
  DOM.coinsAmount.textContent = Number(profile.carlitosCoins || profile.coins || 0).toLocaleString('es-CL');
  const prog = calculateProgress(Number(profile.totalXP || profile.xp || 0));
  DOM.userLevelBadge.textContent = `${prog.level.name}`;
  DOM.xpBar.style.width = `${Math.min(100, Math.round(prog.progressPercentage))}%`;
  DOM.xpText.textContent = `${(prog.currentLevelXp || 0).toLocaleString('es-CL')} / ${prog.xpToNextLevel.toLocaleString('es-CL')} XP`;
  renderTools(prog.level);
}

async function refreshChartOnly() {
  if (currentUser && db) {
    try {
      const txFS = await fetchTransactionsFirestore(currentUser.uid);
      const catsFS = await fetchCategoriesFirestore(currentUser.uid);
      const localTx = JSON.parse(localStorage.getItem('local_tx') || '[]');
      const txAll = localTx.concat(txFS);
      const catsLocal = readLocalCategories();
      const catsAll = (catsFS && catsFS.length) ? catsFS.map(c => ({ id: c.id || (c.name || '').toLowerCase().replace(/\s+/g, '_'), name: c.name, color: c.color })) : catsLocal;
      drawBalanceChart(txAll, catsAll);
      return;
    } catch (e) { console.warn('refreshChartOnly firestore failed', e); }
  }
  const tx = JSON.parse(localStorage.getItem('local_tx') || '[]');
  const cats = readLocalCategories();
  drawBalanceChart(tx, cats);
}

async function refreshData() {
  const localProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
  if (!currentUser || !db) {
    renderProfile(localProfile);
    const tx = JSON.parse(localStorage.getItem('local_tx') || '[]');
    const goals = JSON.parse(localStorage.getItem('local_goals') || '[]');
    const cats = readLocalCategories();
    renderTransactions(tx);
    renderGoals(goals);
    drawBalanceChart(tx, cats);
    return;
  }

  try {
    const profFS = await fetchProfileFromFirestore(currentUser.uid).catch(()=>null);
    const txFS = await fetchTransactionsFirestore(currentUser.uid).catch(()=>[]);
    const goalsFS = await fetchGoalsFirestore(currentUser.uid).catch(()=>[]);
    const catsFS = await fetchCategoriesFirestore(currentUser.uid).catch(()=>[]);

    const localTx = JSON.parse(localStorage.getItem('local_tx') || '[]');
    const localGoals = JSON.parse(localStorage.getItem('local_goals') || '[]');
    const txAll = localTx.concat(txFS);
    const goalsAll = localGoals.concat(goalsFS);
    const catsLocal = readLocalCategories();
    const catsAll = (catsFS && catsFS.length) ? catsFS.map(c => ({ id: c.id || (c.name || '').toLowerCase().replace(/\s+/g, '_'), name: c.name, color: c.color })) : catsLocal;

    renderProfile(profFS || localProfile);
    renderTransactions(txAll);
    renderGoals(goalsAll);
    drawBalanceChart(txAll, catsAll);
  } catch (e) {
    console.error('refreshData error', e);
    const tx = JSON.parse(localStorage.getItem('local_tx') || '[]');
    const goals = JSON.parse(localStorage.getItem('local_goals') || '[]');
    const cats = readLocalCategories();
    renderProfile(localProfile);
    renderTransactions(tx);
    renderGoals(goals);
    drawBalanceChart(tx, cats);
  }
}

/* ========= INIT UI ========= */
(function initLocal() {
  if (!localStorage.getItem(CATEGORIES_KEY)) saveLocalCategories(DEFAULT_CATEGORIES);
  DOM.chartTypeSelect && (DOM.chartTypeSelect.value = chartType);
  refreshData();
})();

/* ========= LOGOUT ========= */
DOM.logoutBtn?.addEventListener('click', async () => {
  if (signOut && auth) {
    try { await signOut(auth); localStorage.removeItem(UID_KEY); window.location.href = './index.html'; } catch (e) { console.error(e); alert('Error cerrando sesión'); }
  } else {
    localStorage.removeItem(UID_KEY); window.location.href = './index.html';
  }
});

/* ========= TOUR (Spotlight + Mentor Float + Typing) ========= */
/* Tutor images: coloca nombres de archivos reales en IMG_PATH si quieres */
const TUTOR_IMG_VARIANTS = {
  'Mono': ['mononormal.png','monoenseñando.png','monoriendo.png','iconomono.png'],
  'Ardilla': ['ardillanormal.png','ardillaenseñando.png','ardillariendo.png','iconoardilla.png'],
  'Condor': ['condornormal.png','condorenseñando.png','condorriendo.png','iconocondor.png'],
  'Gata': ['gatanormal.png','gataenseñando.png','gatariendo.png','iconogata.png'],
};

function normalizeTutorKey(raw) {
  if (!raw) return 'Mono';
  const s = raw.toString().toLowerCase();
  if (s.includes('condor') || s.includes('cóndor') || s.includes('inti')) return 'Condor';
  if (s.includes('ardilla') || s.includes('saison')) return 'Ardilla';
  if (s.includes('gata') || s.includes('leopardo') || s.includes('auri') || s.includes('gato')) return 'Gata';
  if (s.includes('mono') || s.includes('kantu')) return 'Mono';
  return 'Mono';
}
function createImgWithFallbacks(variants = [], onReady) {
  const img = new Image();
  img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
  let i = 0;
  function tryNext() {
    if (i >= variants.length) { if (onReady) onReady(img); return; }
    const candidate = variants[i++];
    img.onerror = tryNext;
    img.onload = () => { if (onReady) onReady(img); };
    img.src = candidate.startsWith('http') || candidate.startsWith('/') ? candidate : (IMG_PATH + candidate);
  }
  tryNext();
  return img;
}
function getFirstValidImage(list) { return new Promise(resolve => createImgWithFallbacks(list, el => resolve(el))); }

let tourState = { active: false, step: 0, steps: [], overlayEl: null, mentorEl: null, bubbleEl: null, typing: false, typingTimer: null };

function buildTourSteps(profile = {}) {
  const assigned = profile.assignedTutor || profile.tutor || '';
  const tutorKey = normalizeTutorKey(assigned);
  const variants = TUTOR_IMG_VARIANTS[tutorKey] || [];
  return [
    { sel: '.card:first-of-type', title: 'Bienvenida', text: `¡Hola! Soy tu mentor. Te guiaré por este Dashboard.` , imgVariantList: variants },
    { sel: '#balanceChart', title: 'Gráficos', text: 'Aquí ves la distribución de tus gastos. Cambia el tipo: Circular / Barras / Línea.' , imgVariantList: variants },
    { sel: '#transactions-list', title: 'Transacciones', text: 'En Transacciones verás tus movimientos y podrás añadir nuevos.' , imgVariantList: variants },
    { sel: '#manage-categories', title: 'Categorías', text: 'Agrega, elimina o cambia colores de categorías para personalizar tus informes.' , imgVariantList: variants },
    { sel: '#simulate-data', title: 'Simular', text: 'Pulsa "Simular datos" para autogenerar gastos de ejemplo (se marcan con test:true).' , imgVariantList: variants },
    { sel: '#clear-test-data', title: 'Limpiar pruebas', text: 'Usa "Limpiar prueba" para borrar únicamente los datos marcados como prueba.' , imgVariantList: variants },
    { sel: '#open-add-transaction', title: 'Añadir', text: 'Desde + Añadir registra gastos o ingresos reales — se guardan en Firebase si estás logueado.' , imgVariantList: variants },
    { sel: '#bottom-nav', title: 'Menú', text: 'La barra inferior te ayuda a navegar entre las secciones principales.' , imgVariantList: variants },
    { sel: '.card:first-of-type', title: '¡Listo!', text: 'Eso es todo. Repite el tour cuando quieras.' , imgVariantList: variants },
  ];
}

function createTourUI(profile) {
  document.getElementById('tour-overlay')?.remove();
  document.getElementById('tour-mentor-image')?.remove();
  document.getElementById('tour-mentor-bubble')?.remove();

  // overlay
  const overlay = document.createElement('div');
  overlay.id = 'tour-overlay';
  overlay.className = 'tour-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '10050';
  overlay.style.pointerEvents = 'auto';
  overlay.style.transition = 'background 400ms ease';
  overlay.style.setProperty('--spot-x', '50px');
  overlay.style.setProperty('--spot-y', '50px');
  overlay.style.setProperty('--spot-r', '80px');
  overlay.style.background = 'radial-gradient(circle at 50px 50px, rgba(0,0,0,0) calc(80px - 6px), rgba(0,0,0,0.55) calc(80px - 6px + 8px))';
  document.body.appendChild(overlay);
  tourState.overlayEl = overlay;

  // mentor image
  const mentorImg = document.createElement('img');
  mentorImg.id = 'tour-mentor-image';
  mentorImg.className = 'mentor-image-tour mentor-float';
  mentorImg.alt = 'Mentor';
  mentorImg.style.width = '120px'; mentorImg.style.height = '120px';
  mentorImg.style.position = 'fixed'; mentorImg.style.borderRadius = '12px'; mentorImg.style.zIndex = '10090';
  mentorImg.style.pointerEvents = 'none';
  mentorImg.style.boxShadow = '0 20px 50px rgba(6,8,15,0.08)';
  mentorImg.style.backgroundColor = '#fff';
  mentorImg.style.transition = 'transform 700ms cubic-bezier(.22,.9,.32,1), left 700ms, top 700ms';
  document.body.appendChild(mentorImg);
  tourState.mentorEl = mentorImg;

  // bubble
  const bubble = document.createElement('div');
  bubble.id = 'tour-mentor-bubble';
  bubble.className = 'mentor-bubble';
  bubble.style.position = 'fixed';
  bubble.style.zIndex = '10095';
  bubble.style.maxWidth = '420px';
  bubble.style.background = 'linear-gradient(180deg,#f8fafc,#f1f5f9)';
  bubble.style.border = '1px solid rgba(159,122,234,0.12)';
  bubble.style.color = '#0f172a';
  bubble.style.padding = '12px 14px';
  bubble.style.borderRadius = '12px';
  bubble.style.boxShadow = '0 18px 50px rgba(2,6,23,0.08)';
  bubble.style.transition = 'left 700ms, top 700ms, transform 300ms';
  bubble.innerHTML = `<div id="tour-bubble-content"><strong>Hola</strong><div class="bubble-text" style="min-height:36px;"></div></div>
    <div class="tour-controls" style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
      <button id="tour-skip" class="btn-ghost">Omitir</button>
      <button id="tour-prev" class="btn-ghost">Atrás</button>
      <button id="tour-next" class="btn-primary">Siguiente</button>
    </div>`;
  document.body.appendChild(bubble);
  tourState.bubbleEl = bubble;

  bubble.querySelector('#tour-skip').onclick = () => endTour(true);
  bubble.querySelector('#tour-prev').onclick = () => { if (tourState.step > 0) { tourState.step--; showTourStep(); } };
  bubble.querySelector('#tour-next').onclick = () => {
    if (tourState.typing) { finishTypingNow(); return; }
    tourState.step++;
    if (tourState.step >= tourState.steps.length) return endTour();
    showTourStep();
  };
}

function setSpotlightForRect(rect) {
  const overlay = tourState.overlayEl;
  if (!overlay) return;
  const isNav = rect.top > (window.innerHeight - 160) || rect.selector === '#bottom-nav';
  if (isNav) {
    const top = Math.max(0, rect.top - 12);
    const bottom = Math.min(window.innerHeight, rect.bottom + 12);
    overlay.style.background = `linear-gradient(to bottom,
      rgba(0,0,0,0.55) 0%,
      rgba(0,0,0,0.55) ${top}px,
      rgba(0,0,0,0) ${top}px,
      rgba(0,0,0,0) ${bottom}px,
      rgba(0,0,0,0.55) ${bottom}px,
      rgba(0,0,0,0.55) 100%)`;
    return;
  }
  const cx = Math.round(rect.left + rect.width / 2);
  const cy = Math.round(rect.top + rect.height / 2);
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const r = Math.ceil(Math.sqrt(halfW * halfW + halfH * halfH) + 28);
  overlay.style.removeProperty('background');
  overlay.style.setProperty('--spot-x', cx + 'px');
  overlay.style.setProperty('--spot-y', cy + 'px');
  overlay.style.setProperty('--spot-r', r + 'px');
  overlay.style.background = `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) calc(${r}px - 6px), rgba(0,0,0,0.55) calc(${r}px - 6px + 8px))`;
}

function moveMentorToTarget(targetRect) {
  const mentor = tourState.mentorEl;
  const bubble = tourState.bubbleEl;
  if (!mentor || !bubble) return;
  const margin = 12;
  let preferredLeft = Math.min(window.innerWidth - mentor.offsetWidth - 16, targetRect.right + 12);
  let preferredTop = targetRect.top + (targetRect.height / 2) - (mentor.offsetHeight / 2);
  if (preferredLeft + mentor.offsetWidth + margin > window.innerWidth - 8) {
    preferredLeft = Math.max(margin, targetRect.left - mentor.offsetWidth - 12);
  }
  if (preferredLeft < margin) preferredLeft = margin;
  let left = Math.round(preferredLeft);
  let top = Math.round(preferredTop);
  if (top < margin) top = margin + 16;
  if (top + mentor.offsetHeight + margin > window.innerHeight) top = window.innerHeight - mentor.offsetHeight - margin;
  mentor.style.left = `${left}px`; mentor.style.top = `${top}px`;

  const bubbleLeft = left - (bubble.offsetWidth / 2) + (mentor.offsetWidth / 2);
  let bubbleTop = top - bubble.offsetHeight - 12;
  if (bubbleTop < 12) bubbleTop = top + mentor.offsetHeight + 12;
  bubble.style.left = `${Math.max(12, Math.min(window.innerWidth - bubble.offsetWidth - 12, bubbleLeft))}px`;
  bubble.style.top = `${Math.max(12, Math.min(window.innerHeight - bubble.offsetHeight - 12, bubbleTop))}px`;
}

function focusOnSelector(selector) {
  const target = document.querySelector(selector);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    return new Promise((resolve) => {
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        rect.selector = selector;
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
        target.classList.add('tour-highlight');
        resolve(rect);
      }, 520);
    });
  } else {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ left: window.innerWidth / 2 - 60, top: window.innerHeight / 2 - 60, right: window.innerWidth / 2 + 60, width: 120, height: 120 }), 350);
    });
  }
}

function typeText(containerEl, text, speed = 18, cb) {
  tourState.typing = true;
  containerEl.innerHTML = '';
  let i = 0;
  setMentorStateImage(normalizeTutorKey(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}').assignedTutor || ''), 'enseñando');
  tourState.typingTimer = setInterval(() => {
    containerEl.innerHTML += text[i] === ' ' ? ' ' : text[i];
    i++;
    if (i >= text.length) {
      clearInterval(tourState.typingTimer);
      tourState.typingTimer = null;
      tourState.typing = false;
      setTimeout(() => setMentorStateImage(normalizeTutorKey(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}').assignedTutor || ''), 'normal'), 350);
      if (cb) cb();
    }
  }, speed);
}
function finishTypingNow() {
  if (!tourState.typing) return;
  clearInterval(tourState.typingTimer);
  tourState.typingTimer = null;
  tourState.typing = false;
  const bubbleTextEl = tourState.bubbleEl.querySelector('.bubble-text');
  const step = tourState.steps[tourState.step];
  bubbleTextEl.innerHTML = step ? step.text : '';
  setMentorStateImage(normalizeTutorKey(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}').assignedTutor || ''), 'normal');
}

async function setMentorStateImage(tutorKeyRaw, state = 'normal') {
  const tutorKey = normalizeTutorKey(tutorKeyRaw);
  const list = (TUTOR_IMG_VARIANTS[tutorKey] || []).slice();
  const prioritized = [];
  const stateLower = state.toLowerCase().replace('ñ', 'n');
  list.forEach(fn => {
    const lower = fn.toLowerCase();
    if (lower.includes(stateLower) || lower.includes(stateLower.replace('n', 'ñ'))) prioritized.push(fn);
  });
  const combined = prioritized.concat(list.filter(x => !prioritized.includes(x)));
  const img = await getFirstValidImage(combined.map(fn => (fn.startsWith('http') ? fn : IMG_PATH + fn)));
  if (img && tourState.mentorEl) tourState.mentorEl.src = img.src;
}

async function showTourStep() {
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
  const step = tourState.steps[tourState.step];
  const bubble = tourState.bubbleEl;
  const mentor = tourState.mentorEl;
  if (!step || !bubble || !mentor) return endTour();

  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

  focusOnSelector(step.sel).then(async rect => {
    setSpotlightForRect(rect);
    moveMentorToTarget(rect);
    bubble.querySelector('#tour-bubble-content strong').textContent = step.title || '';
    const bubbleTextEl = bubble.querySelector('.bubble-text');

    await setMentorStateImage(profile.assignedTutor || '', 'enseñando');
    typeText(bubbleTextEl, step.text || '', 18);

    const nextBtn = bubble.querySelector('#tour-next');
    nextBtn.textContent = (tourState.step === tourState.steps.length - 1) ? 'Finalizar' : 'Siguiente';
  });
}

function startTour(profile = null) {
  if (tourState.active) return;
  if (!profile) profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
  tourState.steps = buildTourSteps(profile);
  tourState.step = 0;
  createTourUI(profile);
  tourState.active = true;
  setTimeout(() => showTourStep(), 350);
}
function endTour(skipSave = false) {
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  tourState.overlayEl?.remove();
  tourState.mentorEl?.remove();
  tourState.bubbleEl?.remove();
  tourState = { active: false, step: 0, steps: [], overlayEl: null, mentorEl: null, bubbleEl: null, typing: false, typingTimer: null };
  if (!skipSave) localStorage.setItem('tutorialCompleted', 'true');
}

DOM.startTourBtn?.addEventListener('click', () => startTour(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}));
window.addEventListener('resize', () => {
  if (tourState.active && tourState.steps.length > 0) {
    const step = tourState.steps[tourState.step];
    const el = document.querySelector(step.sel);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightForRect(rect);
      moveMentorToTarget(rect);
    }
  }
});

/* autostart tour if not seen */
(function autoStartTourIfNew() {
  const seen = localStorage.getItem('tutorialCompleted');
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
  if (!seen) setTimeout(() => startTour(profile), 750);
})();

/* ========= POLLING / AUTO REFRESH ========= */
setInterval(() => { if (currentUser) refreshData(); }, 60_000);
/* ========= THEME TOGGLE: light <-> dark (gamer pro) ========= */
(function themeToggleInit() {
  const THEME_KEY = 'carlitos_theme';
  const stored = localStorage.getItem(THEME_KEY) || 'light';
  const body = document.body;

  function applyTheme(theme) {
    if (theme === 'dark') {
      body.classList.add('dark-theme');
      // quick neon flash for effect
      body.style.transition = 'box-shadow 260ms ease, background 420ms ease';
      // small glow pulse
      document.querySelectorAll('.card').forEach((c,i) => {
        c.style.transition = 'box-shadow 420ms ease, transform 420ms ease';
        if (i % 2 === 0) c.classList.add('neon-outline');
        setTimeout(()=> c.classList.remove('neon-outline'), 900 + (i*40));
      });
    } else {
      body.classList.remove('dark-theme');
    }
    // persist
    localStorage.setItem(THEME_KEY, theme);
    updateToggleBtn(theme);
  }

  // create button in header if not exists
  function ensureToggleButton() {
    const header = document.querySelector('header');
    if (!header) return null;
    // try to find existing
    let btn = document.getElementById('toggle-theme-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'toggle-theme-btn';
      btn.title = 'Cambiar tema (Claro / Oscuro)';
      btn.className = 'btn-ghost';
      btn.style.marginLeft = '6px';
      btn.innerHTML = `<span id="toggle-theme-icon">🌙</span><span id="toggle-theme-text" style="font-weight:700; margin-left:6px;">Modo Oscuro</span>`;
      // place before logout if exists, else append
      const logout = document.getElementById('logout');
      if (logout && logout.parentElement) logout.parentElement.insertBefore(btn, logout);
      else header.appendChild(btn);
    }
    btn.onclick = () => {
      const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    };
    return btn;
  }

  function updateToggleBtn(theme) {
    const icon = document.getElementById('toggle-theme-icon');
    const text = document.getElementById('toggle-theme-text');
    if (!icon || !text) return;
    if (theme === 'dark') {
      icon.textContent = '💡';
      text.textContent = 'Modo Gamer (ON)';
      // neon style
      const btn = document.getElementById('toggle-theme-btn');
      if (btn) {
        btn.classList.remove('btn-ghost'); btn.classList.add('btn-primary');
        btn.style.boxShadow = '0 8px 30px rgba(0,255,213,0.08)';
      }
    } else {
      icon.textContent = '🌙';
      text.textContent = 'Modo Oscuro';
      const btn = document.getElementById('toggle-theme-btn');
      if (btn) {
        btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost');
        btn.style.boxShadow = '';
      }
    }
  }

  // Init: ensure button and apply stored theme
  const btn = ensureToggleButton();
  applyTheme(stored === 'dark' ? 'dark' : 'light');

  // minor: also allow quick toggle with "T" key (dev)
  window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 't' && (e.ctrlKey || e.metaKey)) { const cur = body.classList.contains('dark-theme') ? 'dark' : 'light'; applyTheme(cur === 'dark' ? 'light' : 'dark'); }});
})();

/* ========= FIN ========= */
// ya está todo: funciones para CRUD local + sync firestore, simulador, limpieza selectiva,
// gráficas adaptables y tour spotlight con mentor flotante.
