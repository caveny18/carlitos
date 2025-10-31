// onboarding_simple.js
// JavaScript funcional para el onboarding simple, ahora con guardado en Firestore.
// Coloca este archivo en la misma carpeta que tu HTML y firebase-config.js

document.addEventListener('DOMContentLoaded', () => {
  /* =========== CONFIG =========== */
  const ASSETS = {
    gato: { normal: 'leopardonormal.png', ensenando: 'leopardoenseñando.png', riendo: 'leopardoriendo.png', confundido: 'leopardoconfundido.png' },
    ardilla: { normal: 'ardillanormal.png', ensenando: 'ardillaensenando.png', riendo: 'ardillariendo.png', confundido: 'ardillaconfundida.png' },
    condor: { normal: 'condornormal.png', ensenando: 'condorenseñando.png', riendo: 'condorriendo.png', confundido: 'condorconfundido.png' },
    mono: { normal: 'mononormal.png', ensenando: 'monoensenando.png', riendo: 'monoriendo.png', confundido: 'monoconfundido.png' }
  };

  const MENTOR_ICONS = ['iconoardilla.png','iconomono.png','iconocondor.png','iconoleopardo.png'];

  const MENTORS = [
    { key: 'Saison', label: 'Saison — La Ardilla Visionaria', icon: 'iconoardilla.png', frase: 'Soñar está bien, pero construirlo día a día es mejor.', desc: 'Ágil, curiosa y previsora. Planea con anticipación y ama ahorrar con propósito.' },
    { key: 'Kantu', label: 'Kantu — El Mono Peruano Emprendedor', icon: 'iconomono.png', frase: 'Si el camino no existe, ¡yo lo invento!', desc: 'Creativo, sociable y entusiasta. Ideal para quienes quieren emprender.' },
    { key: 'Inti', label: 'Inti — El Cóndor Sabio', icon: 'iconocondor.png', frase: 'Solo quien se eleva ve el camino completo.', desc: 'Serio y estratégico. Perfecto si buscas visión y calma en decisiones.' },
    { key: 'Sumaq', label: 'Sumaq — El Gato Andino Protector', icon: 'iconoleopardo.png', frase: 'El silencio también enseña a decidir.', desc: 'Intuitivo y noble. Para quienes confían en su instinto y buscan equilibrio.' }
  ];

  /* =========== PREGUNTAS =========== */
  const questions = [
    { id: 'q1', text: '¿Cómo te llamas o cuál es tu apodo?', type: 'text' },
    { id: 'q2', text: '¿En qué gastas más?', type: 'options', options: ['Comida', 'Ropa', 'Salidas', 'Transporte', 'Suscripciones'] },
    { id: 'q3', text: 'Tu meta mensual (S/)', type: 'options', options: ['500','1000','1500','2000+','Prefiero no decir'] },
    { id: 'q4', text: '¿Quieres recordatorios inteligentes?', type: 'options', options: ['Sí','No'] },
    { id: 'q5', text: '¿Qué estilo de mentor prefieres?', type: 'options', options: ['Estricto','Motivador','Estratégico','Chill'] },
    { id: 'q6', text: '¿Cuánto tiempo semanal planeas dedicar?', type: 'options', options: ['15 min','30 min','1 hora','2 horas','Más de 2 horas'] },
    { id: 'q7', text: 'Elige tu mentor (luego podrás cambiarlo)', type: 'options', options: [] } // will render MENTORS
  ];

  /* =========== ESTADO =========== */
  let idx = 0;
  const answers = JSON.parse(localStorage.getItem('onboard-simple') || '{}');

  /* =========== REFS DOM =========== */
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const avatar = document.getElementById('avatar');
  const questionText = document.getElementById('questionText');
  const optionsWrap = document.getElementById('options');
  const freeInputWrap = document.getElementById('freeInputWrap');
  const freeInput = document.getElementById('freeInput');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const summary = document.getElementById('summary');
  const summaryList = document.getElementById('summaryList');
  const finishBtn = document.getElementById('finishBtn');

  if (!progressBar || !questionText || !optionsWrap) {
    console.error('Elementos DOM faltantes. Revisa tu HTML.');
    return;
  }

  /* =========== UTILIDADES =========== */
  function preloadAll() {
    Object.values(ASSETS).forEach(obj => Object.values(obj).forEach(name => { const i = new Image(); i.src = name; }));
    MENTOR_ICONS.forEach(name => { const i = new Image(); i.src = name; });
  }
  preloadAll();

  function setAvatar(key = 'gato', mood = 'normal') {
    const f = (ASSETS[key] && ASSETS[key][mood]) ? ASSETS[key][mood] : ASSETS.gato.normal;
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = ASSETS.gato.normal || '';
    };
    avatar.src = f;
  }

  function saveAnswersLocal() {
    localStorage.setItem('onboard-simple', JSON.stringify(answers));
  }

  /* -------------------- Guardar en Firestore y redirigir -------------------- */
  async function saveToFirestoreAndRedirect(redirectUrl = 'Carlitos.html') {
    // prepare payload (flatten simple)
    const payload = {};
    Object.keys(answers).forEach(k => {
      const v = answers[k];
      payload[k] = (typeof v === 'object' && v !== null) ? v : v;
    });
    payload.onboardCompletedAt = new Date().toISOString();

    try {
      // dynamic import of firebase-config (uses your file that exports db, auth)
      const cfg = await import('./firebase-config.js'); // expects export { db, auth, provider } as you have
      const db = cfg.db;
      const auth = cfg.auth;

      // import firestore helpers (use same SDK major version as your config)
      const firestoreMod = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const { doc, setDoc, collection, addDoc } = firestoreMod;

      // try uid from localStorage then from auth.currentUser
      let uid = localStorage.getItem('uid') || null;
      if (!uid && auth && auth.currentUser) uid = auth.currentUser.uid;

      if (uid) {
        // write into usuarios/<uid> with merge
        const ref = doc(db, 'usuarios', uid);
        await setDoc(ref, payload, { merge: true });
        console.log('Onboarding guardado en usuarios/' + uid);
      } else {
        // fallback: save to a temporary collection with auto-id
        const tempCol = collection(db, 'onboard_temp');
        const docRef = await addDoc(tempCol, payload);
        console.log('Onboarding guardado en onboard_temp (id):', docRef.id);
      }

      // keep local copy (optional) and redirect
      saveAnswersLocal();
      window.location.href = redirectUrl;

    } catch (err) {
      console.error('Error guardando en Firestore:', err);
      // fallback: guardar local y notificar
      saveAnswersLocal();
      alert('No se pudo guardar en la nube. Tus respuestas se guardaron localmente.');
      window.location.href = redirectUrl;
    }
  }

  /* =========== RENDER PREGUNTA =========== */
  function render() {
    const q = questions[idx];
    questionText.textContent = q.text;
    const pct = Math.round((idx / questions.length) * 100);
    progressBar.style.width = pct + '%';
    progressText.textContent = `Paso ${idx+1}/${questions.length}`;

    optionsWrap.innerHTML = '';
    freeInputWrap.classList.add('hidden');

    const charKeys = ['gato','ardilla','condor','mono'];
    setAvatar(charKeys[idx % charKeys.length], 'ensenando');

    if (q.type === 'options') {
      if (q.id === 'q7') {
        MENTORS.forEach(m => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'option w-full p-4 rounded-xl bg-white/5 border border-white/6 flex items-start gap-4';
          card.style.alignItems = 'center';
          card.innerHTML = `
            <img src="${m.icon}" alt="${m.key}" class="mentor-icon" style="width:48px;height:48px;border-radius:999px;object-fit:cover" />
            <div class="flex-1 text-left">
              <div class="font-semibold">${m.label}</div>
              <div class="text-xs opacity-70 mt-1">${m.desc}</div>
              <div class="text-xs text-green-200 mt-2 italic">"${m.frase}"</div>
            </div>
          `;

          card.addEventListener('mouseenter', () => {
            avatar.src = m.icon;
            card.classList.add('selected');
          });
          card.addEventListener('mouseleave', () => {
            const ck = ['gato','ardilla','condor','mono'];
            setAvatar(ck[idx % ck.length], 'ensenando');
            card.classList.remove('selected');
          });

          card.addEventListener('click', () => {
            optionsWrap.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
            card.classList.add('selected');

            answers[q.id] = { label: m.label, key: m.key };
            saveAnswersLocal();

            const map = { 'Saison': 'ardilla', 'Kantu': 'mono', 'Inti': 'condor', 'Sumaq': 'gato' };
            const ik = map[m.key];
            if (ik) setAvatar(ik, 'riendo');

            const snack = document.createElement('div');
            snack.textContent = `Elegiste a ${m.key}. Avanzando...`;
            Object.assign(snack.style, { position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:'18px', background:'rgba(0,0,0,0.6)', color:'#eafff0', padding:'8px 12px', borderRadius:'8px', zIndex:9999 });
            document.body.appendChild(snack);
            setTimeout(()=> snack.remove(), 900);

            setTimeout(()=> {
              idx++;
              (idx < questions.length) ? render() : showSummary();
            }, 520);
          });

          optionsWrap.appendChild(card);
        });
      } else {
        q.options.forEach(opt => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'option w-full text-left p-4 rounded-xl bg-white/5 border border-white/6 flex items-center gap-3';
          b.innerHTML = `<span class="flex-1">${opt}</span>`;
          b.addEventListener('click', () => {
            optionsWrap.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
            answers[q.id] = opt;
            saveAnswersLocal();
            const ck = ['gato','ardilla','condor','mono'];
            setAvatar(ck[idx % ck.length], 'riendo');
            setTimeout(()=> {
              idx++;
              (idx < questions.length) ? render() : showSummary();
            }, 420);
          });
          optionsWrap.appendChild(b);
        });
      }
    } else {
      freeInputWrap.classList.remove('hidden');
      freeInput.value = answers[q.id] || '';
      freeInput.focus();
      freeInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const v = freeInput.value.trim();
          if (!v) return;
          answers[q.id] = v;
          saveAnswersLocal();
          const ck = ['gato','ardilla','condor','mono'];
          setAvatar(ck[idx % ck.length], 'riendo');
          idx++;
          (idx < questions.length) ? render() : showSummary();
        }
      };
    }

    prevBtn.disabled = idx === 0;
    summary.classList.add('hidden');
  }

  /* =========== SHOW SUMMARY & REDIRECT =========== */
  function showSummary() {
    progressBar.style.width = '100%';
    progressText.textContent = `Completado ${questions.length}/${questions.length}`;
    summaryList.innerHTML = '';

    questions.forEach(q => {
      const raw = answers[q.id];
      const val = (raw === undefined) ? '—' : (typeof raw === 'object' ? raw.label : raw);
      const row = document.createElement('div');
      row.className = 'flex justify-between border-b border-white/6 py-2';
      row.innerHTML = `<div class="text-sm opacity-90">${q.text}</div><div class="text-sm font-semibold text-green-200">${val}</div>`;
      summaryList.appendChild(row);
    });

    summary.classList.remove('hidden');
    setAvatar('gato','riendo');

    // save to Firestore then redirect (with fallback)
    setTimeout(()=> {
      saveToFirestoreAndRedirect('Carlitos.html');
    }, 700);
  }

  /* =========== CONTROLES =========== */
  prevBtn.addEventListener('click', () => {
    if (idx > 0) { idx--; render(); }
  });

  nextBtn.addEventListener('click', () => {
    const q = questions[idx];
    if (q.type === 'text') {
      const v = freeInput.value.trim();
      if (!v) { freeInput.focus(); return; }
      answers[q.id] = v;
      saveAnswersLocal();
      idx++;
      (idx < questions.length) ? render() : showSummary();
    } else {
      const selected = optionsWrap.querySelector('.selected');
      if (selected) {
        idx++;
        (idx < questions.length) ? render() : showSummary();
      } else {
        const first = optionsWrap.querySelector('button');
        if (first) {
          first.classList.add('selected');
          setTimeout(()=> first.classList.remove('selected'), 600);
        }
      }
    }
  });

  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      // save + redirect via Firestore
      saveToFirestoreAndRedirect('Carlitos.html');
    });
  }

  /* =========== DIAGNÓSTICO RÁPIDO (opcional) =========== */
  (async function quickDiagnostic(){
    const flat = [];
    Object.values(ASSETS).forEach(o => Object.values(o).forEach(n => flat.push(n)));
    MENTOR_ICONS.forEach(n => flat.push(n));
    const missing = [];
    for (const f of flat) {
      try {
        const res = await fetch(f, { method: 'HEAD' });
        if (!res.ok) missing.push(f);
      } catch(e) {
        missing.push(f);
      }
    }
    if (missing.length) {
      console.warn('Archivos faltantes o inaccesibles (revisa mayúsculas / rutas):', missing);
      const note = document.createElement('div');
      Object.assign(note.style, { position:'fixed', left:'12px', bottom:'12px', background:'rgba(255,80,80,0.14)', padding:'8px 12px', borderRadius:'8px', color:'#fff', fontSize:'13px', zIndex:9999 });
      note.textContent = 'Algunas imágenes no se encontraron (abre consola para ver la lista).';
      document.body.appendChild(note);
    } else {
      console.log('Diagnóstico OK: todas las imágenes encontradas (misma carpeta).');
    }
  })();

  /* =========== INICIALIZACIÓN =========== */
  (function init() {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount >= questions.length) {
      idx = questions.length;
      showSummary();
      return;
    }
    idx = 0;
    while (idx < questions.length && answers[questions[idx].id]) idx++;
    if (idx >= questions.length) idx = questions.length - 1;
    render();
  })();

}); // DOMContentLoaded end
