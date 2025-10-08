// onboarding.js (REEMPLAZAR TODO)
// Requiere: ./firebase-config.js que exporte { db, auth, provider }
// Asegúrate de que el HTML carga firebase-config.js antes de este archivo (type="module").

import { db, auth, provider } from './firebase-config.js';
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ---------------- CONFIG / ESTADO GLOBAL ----------------
const PROFILE_KEY = 'carlitos_profile_data';
let currentStep = 1;
const totalSteps = 8;
let assignedTutor = null;

// Objeto donde meteremos referencias DOM (evita globals dispersos)
const DOM = {};

// ---------------- TUTORES (rutas relativas en la misma carpeta) ----------------
const TUTORS = {
    MONO_CHORO: {
        name: "Mono Choro",
        role: "El Ilustrador – Principiante curioso",
        image: "./iconomono.png",
        description: "Alegre, espontáneo y creativo. Usa ejemplos cotidianos y humor. “¡Equivocarse también cuesta, pero se aprende!”",
        color: "#4CAF50"
    },
    CONDOR_ANDINO: {
        name: "Cóndor Andino",
        role: "El Mentor – Estratégico / Avanzado",
        image: "./iconocondor.png",
        description: "Sabio, analítico y protector. Usa metáforas y planificación. “Desde arriba todo tiene sentido, solo hay que saber mirar.”",
        color: "#1E3A8A"
    },
    GATA_ANDINA: {
        name: "Gata de los Andes",
        role: "La Analítica – Intermedia / Práctica",
        image: "./iconoleopardo.png",
        description: "Inteligente, observadora y detallista. Ama los números y te reta con pequeños cálculos. “Cada número cuenta, incluso los que no miras.”",
        color: "#8B5CF6"
    },
    SAISON_ARDILLA: {
        name: "Saison",
        role: "La Ardilla – Emprendedora / Motivacional",
        image: "./iconoardilla.png",
        description: "Enérgica y optimista. Motiva con recompensas y celebra logros. “¡Cada sol ahorrado es un salto hacia adelante!”",
        color: "#FB923C"
    }
};

// ---------------- UTILIDADES ----------------
function safeGet(id) {
    return document.getElementById(id) || null;
}

function showError(message) {
    if (!DOM.errorMessage) { console.error("Error UI missing:", message); return; }
    DOM.errorText.innerHTML = message;
    DOM.errorMessage.classList.remove('hidden');
    setTimeout(() => DOM.errorMessage.classList.add('hidden'), 4000);
}

// ----------------- LÓGICA DE ASIGNACIÓN -----------------
function assignTutorFromAnswers(profileAnswers) {
    // Si hay meta concreta en primaryGoal intenta mapear directamente
    const goal = (profileAnswers.primaryGoal || '').toString().toLowerCase();

    if (goal.includes('emprender')) return TUTORS.SAISON_ARDILLA;
    if (goal.includes('ahorrar') || goal.includes('ahorro')) return TUTORS.GATA_ANDINA;
    if (goal.includes('invertir') || goal.includes('inversión')) return TUTORS.CONDOR_ANDINO;
    if (goal.includes('presupuesto') || goal.includes('gastos') || goal.includes('controlar')) return TUTORS.MONO_CHORO;

    // Si no hay correspondencia textual, aplica puntaje balanceado
    const scores = { MONO_CHORO: 0, SAISON_ARDILLA: 0, CONDOR_ANDINO: 0, GATA_ANDINA: 0 };
    const { knowledgeLevel, feeling, learningStyle, discipline } = profileAnswers;

    // --- Nivel de conocimiento ---
    if (knowledgeLevel === 'Basico') {
        scores.MONO_CHORO += 3;
        scores.SAISON_ARDILLA += 2;
    }
    if (knowledgeLevel === 'Intermedio') {
        scores.SAISON_ARDILLA += 3;
        scores.CONDOR_ANDINO += 1;
    }
    if (knowledgeLevel === 'Avanzado') {
        scores.CONDOR_ANDINO += 3;
        scores.GATA_ANDINA += 1;
    }

    // --- Sentimiento ---
    if (feeling === 'Empezando') scores.MONO_CHORO += 3;
    if (feeling === 'Aprendiendo') scores.SAISON_ARDILLA += 3;
    if (feeling === 'Mejorando') scores.CONDOR_ANDINO += 3;
    if (feeling === 'Optimizando') scores.GATA_ANDINA += 3;

    // --- Estilo de aprendizaje ---
    if (learningStyle === 'Juegos') scores.MONO_CHORO += 2;
    if (learningStyle === 'Videos') scores.SAISON_ARDILLA += 2;
    if (learningStyle === 'Ejemplos') scores.GATA_ANDINA += 2;
    if (learningStyle === 'Practico') scores.CONDOR_ANDINO += 2;

    // --- Disciplina ---
    if (discipline === 'Baja') scores.MONO_CHORO += 3;
    if (discipline === 'Intermedia') scores.SAISON_ARDILLA += 3;
    if (discipline === 'Constante') scores.CONDOR_ANDINO += 3;
    if (discipline === 'Alta') scores.GATA_ANDINA += 3;

    // --- Desempate aleatorio si hay empate ---
    const maxScore = Math.max(...Object.values(scores));
    const topTutors = Object.keys(scores).filter(k => scores[k] === maxScore);
    const bestKey = topTutors[Math.floor(Math.random() * topTutors.length)];

    console.log("🎯 Puntuaciones:", scores, "→ Asignado:", bestKey);
    return TUTORS[bestKey] || TUTORS.MONO_CHORO;
}


// ---------------- MAIN: inicialización y lógica UI ----------------
document.addEventListener('DOMContentLoaded', () => {
    // --- referencias DOM
    DOM.nextButton = safeGet('nextButton');
    DOM.backButton = safeGet('backButton');
    DOM.nextText = safeGet('next-text');
    DOM.nextSpinner = safeGet('next-spinner');
    DOM.progressBar = safeGet('progress-bar');
    DOM.progressIndicator = safeGet('progress-indicator');

    DOM.goalPriorityContainer = safeGet('goalPriorityContainer');
    DOM.feelingContainer = safeGet('feelingContainer');
    DOM.priorityContainer = safeGet('priorityContainer');
    DOM.learningStyleContainer = safeGet('learningStyleContainer');
    DOM.disciplineContainer = safeGet('disciplineContainer');
    DOM.motivationContainer = safeGet('motivationContainer');
    DOM.financialKnowledgeSelect = safeGet('financialKnowledge');

    DOM.userName = safeGet('userName');
    DOM.userRole = safeGet('userRole');
    DOM.dailyTime = safeGet('dailyTime');

    DOM.googleLoginBtn = safeGet('googleLogin');

    DOM.tutorName = safeGet('tutor-name');
    DOM.tutorRole = safeGet('tutor-role');
    DOM.tutorImage = safeGet('tutor-image');
    DOM.tutorDescription = safeGet('tutor-description');
    DOM.tutorCard = safeGet('tutor-card');

    DOM.fixedFooter = safeGet('fixed-footer');
    DOM.loadingMessage = safeGet('loading-message');
    DOM.errorMessage = safeGet('error-message');
    DOM.errorText = safeGet('error-text');

    // contenedores para delegación
    const allOptionContainers = [
        DOM.goalPriorityContainer, DOM.feelingContainer, DOM.priorityContainer,
        DOM.learningStyleContainer, DOM.disciplineContainer, DOM.motivationContainer
    ];

    // --- estado de respuestas
    const profileAnswers = {
        primaryGoal: null,
        feeling: null,
        currentPriority: null,
        learningStyle: null,
        discipline: null,
        motivation: null,
        knowledgeLevel: DOM.financialKnowledgeSelect ? DOM.financialKnowledgeSelect.value : null
    };

    // --- manejador de selección (delegación)
    function handleOptionSelection(ev) {
        const t = ev.target.closest('.option-card, .discipline-card');
        if (!t) return;
        const key = t.dataset.question;
        const val = t.dataset.value;
        const container = t.parentElement;
        const cardClass = t.classList.contains('discipline-card') ? 'discipline-card' : 'option-card';
        container.querySelectorAll(`.${cardClass}`).forEach(c => c.classList.remove('selected'));
        t.classList.add('selected');
        profileAnswers[key] = val;
        updateNextButtonState(currentStep);
    }
    allOptionContainers.forEach(c => c && c.addEventListener('click', handleOptionSelection));

    // change select knowledge
    if (DOM.financialKnowledgeSelect) {
        profileAnswers.knowledgeLevel = DOM.financialKnowledgeSelect.value;
        DOM.financialKnowledgeSelect.addEventListener('change', e => {
            profileAnswers.knowledgeLevel = e.target.value;
            updateNextButtonState(currentStep);
        });
    }

    // input nombre
    if (DOM.userName) DOM.userName.addEventListener('input', () => updateNextButtonState(1));

    // --- validación de pasos y estado del botón Next
    function validateStep(stepNumber, showAlert = true) {
        if (DOM.errorMessage) DOM.errorMessage.classList.add('hidden');

        if (stepNumber === totalSteps) return true;
        if (stepNumber === 1) {
            const v = (DOM.userName?.value || '').trim();
            if (!v) { if (showAlert) showError("Por favor, ingresa tu nombre o apodo."); return false; }
        } else if (stepNumber === 2) {
            if (!profileAnswers.primaryGoal) { if (showAlert) showError("Debes seleccionar tu propósito principal (Paso 2)."); return false; }
        } else if (stepNumber === 3) {
            if (!profileAnswers.feeling) { if (showAlert) showError("Selecciona cómo te sientes con tus finanzas (Paso 3)."); return false; }
        } else if (stepNumber === 4) {
            if (!profileAnswers.learningStyle) { if (showAlert) showError("Selecciona qué prefieres al aprender (Paso 4)."); return false; }
        } else if (stepNumber === 5) {
            if (!profileAnswers.discipline) { if (showAlert) showError("Selecciona tu nivel de disciplina (Paso 5)."); return false; }
        } else if (stepNumber === 6) {
            if (!profileAnswers.motivation) { if (showAlert) showError("Selecciona qué te motiva más (Paso 6)."); return false; }
        } else if (stepNumber === 7) {
            if (!profileAnswers.currentPriority) { if (showAlert) showError("Selecciona tu prioridad actual (Paso 7)."); return false; }
        }
        return true;
    }

    function updateNextButtonState(stepNumber) {
        if (!DOM.nextButton) return;
        const valid = validateStep(stepNumber, false);
        DOM.nextButton.disabled = !valid;
        if (!valid) DOM.nextButton.classList.add('opacity-50', 'pointer-events-none');
        else DOM.nextButton.classList.remove('opacity-50', 'pointer-events-none');
    }

    // --- navegación y render de pasos
    function showStep(stepNumber) {
        document.querySelectorAll('.step-content').forEach(x => x.classList.add('hidden'));
        const el = document.getElementById(`step-${stepNumber}`);
        if (el) el.classList.remove('hidden');

        if (DOM.fixedFooter) DOM.fixedFooter.classList.remove('hidden');

        // indicadores
        document.querySelectorAll('[id^="indicator-"]').forEach((node, idx) => {
            node.classList.remove('bg-purple-500', 'bg-gray-700', 'opacity-50');
            const s = idx + 1;
            if (s === stepNumber) node.classList.add('bg-purple-500');
            else if (s < stepNumber) node.classList.add('bg-purple-500', 'opacity-50');
            else node.classList.add('bg-gray-700');
        });

        // barra progreso
        if (DOM.progressBar) {
            if (stepNumber > 1 && stepNumber < totalSteps) DOM.progressBar.classList.remove('opacity-0', 'pointer-events-none');
            else DOM.progressBar.classList.add('opacity-0', 'pointer-events-none');
        }
        if (DOM.progressIndicator) {
            const pct = (stepNumber - 1) / (totalSteps - 1) * 100;
            DOM.progressIndicator.style.width = `${pct}%`;
        }

        if (DOM.backButton) {
            DOM.backButton.disabled = stepNumber === 1;
            DOM.backButton.classList[stepNumber === 1 ? 'add' : 'remove']('opacity-50');
        }

        if (DOM.nextText && DOM.nextButton) {
            if (stepNumber === totalSteps) {
                DOM.nextText.textContent = "¡Empezar Carlitos!";
                DOM.nextButton.classList.remove('bg-purple-600', 'hover:bg-purple-700');
                DOM.nextButton.classList.add('bg-green-500', 'hover:bg-green-600');
            } else {
                DOM.nextText.textContent = "Continuar";
                DOM.nextButton.classList.remove('bg-green-500', 'hover:bg-green-600');
                DOM.nextButton.classList.add('bg-purple-600', 'hover:bg-purple-700');
            }
        }

        updateNextButtonState(stepNumber);
        currentStep = stepNumber;
    }

    function nextStep() {
        if (!validateStep(currentStep)) return;

        // Si estamos justo antes del paso final: asignar tutor y preparar vista
        if (currentStep === totalSteps - 1) {
            assignedTutor = assignTutorFromAnswers(profileAnswers);
            if (assignedTutor) {
                if (DOM.tutorName) DOM.tutorName.textContent = assignedTutor.name;
                if (DOM.tutorRole) DOM.tutorRole.textContent = assignedTutor.role;
                if (DOM.tutorDescription) DOM.tutorDescription.textContent = assignedTutor.description;
                if (DOM.tutorImage) {
                    DOM.tutorImage.src = assignedTutor.image || './iconomono.png';
                    DOM.tutorImage.onerror = () => { DOM.tutorImage.src = './iconomono.png'; };
                }
                if (DOM.tutorCard) DOM.tutorCard.style.borderColor = assignedTutor.color || '';
                if (DOM.tutorName) DOM.tutorName.style.color = assignedTutor.color || '';
            } else {
                console.error("No se pudo asignar un tutor.");
            }

            showStep(currentStep + 1);
            return;
        }

        // ✅ Si ya estamos en el paso final (mentor mostrado), finalizar y redirigir
        if (currentStep === totalSteps) {
            finishOnboarding();
            return;
        }

        // Para todos los demás pasos normales
        showStep(currentStep + 1);
    }

    function prevStep() {
        if (currentStep > 1) showStep(currentStep - 1);
    }

    // listeners botones
    if (DOM.nextButton) DOM.nextButton.addEventListener('click', nextStep);
    if (DOM.backButton) DOM.backButton.addEventListener('click', prevStep);

// --- Google Login ---
if (DOM.googleLoginBtn) {
  DOM.googleLoginBtn.addEventListener('click', async () => {
    try {
      const res = await signInWithPopup(auth, provider);
      const user = res.user;
      console.log("✅ Usuario autenticado:", user.displayName, user.email);

      // 🔓 Habilitar el campo de apodo (userName)
      if (DOM.userName) {
        DOM.userName.disabled = false;
        DOM.userName.placeholder = "Elige tu apodo para usar en la app ✨";
        if (!DOM.userName.value && user.displayName) {
          DOM.userName.value = user.displayName.split(" ")[0]; // Sugerencia inicial
        }
      }

      // Guardar datos mínimos de sesión
      localStorage.setItem('userUID', user.uid);
      localStorage.setItem('userEmail', user.email);

      // Mostrar mensaje amigable
      alert(`¡Hola ${user.displayName || "usuario"}! Ahora elige tu apodo antes de continuar.`);

      // 👇 IMPORTANTE: ya NO avanzamos de paso automáticamente
      // Se espera a que el usuario elija su apodo y presione "Continuar"
    } catch (err) {
      console.error("❌ Error al iniciar sesión con Google:", err);
      showError("No se pudo iniciar sesión con Google. Intenta nuevamente.");
    }
  });
}


    // --- finalizar onboarding: guardar local y Firestore ---
    async function finishOnboarding() {
        const uName = (DOM.userName?.value || '').trim();
        const uRole = (DOM.userRole?.value || '').trim();
        const dailyTime = (DOM.dailyTime?.value || '').trim();

        if (DOM.nextButton) DOM.nextButton.disabled = true;
        if (DOM.nextText) DOM.nextText.classList.add('hidden');
        if (DOM.nextSpinner) DOM.nextSpinner.classList.remove('hidden');

        const profileData = {
            name: uName,
            role: uRole,
            dailyTime,
            knowledgeLevel: profileAnswers.knowledgeLevel,
            primaryGoal: profileAnswers.primaryGoal,
            financialFeeling: profileAnswers.feeling,
            learningStyle: profileAnswers.learningStyle,
            disciplineLevel: profileAnswers.discipline,
            motivationType: profileAnswers.motivation,
            currentPriority: profileAnswers.currentPriority,
            assignedTutor: assignedTutor ? assignedTutor.name : 'Mono Choro',
            assignedTutorRole: assignedTutor ? assignedTutor.role : 'El Ilustrador',
            onboardingCompleted: true,
            createdAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));

            const user = auth.currentUser;
            if (user && db) {
                await setDoc(doc(db, "usuarios", user.uid), {
                    uid: user.uid,
                    name: profileData.name,
                    role: profileData.role,
                    email: user.email,
                    profile: profileData,
                    fecha: new Date().toISOString()
                });
                console.log("Guardado en Firestore para:", user.email);
            }

            setTimeout(() => window.location.href = 'Carlitos.html', 700);
        } catch (e) {
            console.error("Error guardando perfil:", e);
            showError("Hubo un error guardando tu perfil. Revisa la consola.");
            if (DOM.nextButton) DOM.nextButton.disabled = false;
            if (DOM.nextText) DOM.nextText.classList.remove('hidden');
            if (DOM.nextSpinner) DOM.nextSpinner.classList.add('hidden');
        }
    }

    // Exponer por si el HTML llama directamente a window.finishOnboarding()
    window.finishOnboarding = finishOnboarding;

    // --- check local profile y arranca ---
    (function checkProfileAndRedirect() {
        if (DOM.loadingMessage) DOM.loadingMessage.classList.add('hidden');
        const pj = localStorage.getItem(PROFILE_KEY);
        if (!pj) { showStep(1); return; }
        try {
            const p = JSON.parse(pj);
            if (p.onboardingCompleted) { window.location.href = 'Carlitos.html'; return; }
        } catch (e) {
            console.error("Error parse local profile:", e);
            localStorage.removeItem(PROFILE_KEY);
        }
        showStep(1);
    })();

    // inicializa botón
    updateNextButtonState(1);
}); // end DOMContentLoaded
