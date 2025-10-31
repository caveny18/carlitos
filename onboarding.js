// ===============================
// ✅ Firebase Imports
// ===============================
import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===============================
// ✅ DOM ELEMENTS
// ===============================
const googleBtn = document.getElementById("googleLogin");
const continueBtn = document.getElementById("continueQuiz");
const userRole = document.getElementById("userRole");
const userExistsModal = document.getElementById("userExistsModal");
const goDashboard = document.getElementById("goDashboard");

// ===============================
// ✅ Provider
// ===============================
const provider = new GoogleAuthProvider();


// ===============================
// ✅ LOGIN GOOGLE
// ===============================
googleBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Guardamos UID
    localStorage.setItem("uid", user.uid);

    // Verificamos si existe en BD
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      // 🟢 Usuario existente
      userExistsModal.classList.remove("hidden");
      return;
    }

    // 🆕 Nuevo usuario → lo creamos
    await setDoc(userRef, {
      nombre: user.displayName,
      email: user.email,
      creado: new Date(),
      perfil: userRole.value
    });

    // Activa continuar
    continueBtn.disabled = false;

  } catch (err) {
    console.error("Error login:", err);
  }
});


// ===============================
// ✅ MONITOREO DE SESIÓN
// ===============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    continueBtn.disabled = false;
  }
});


// ===============================
// ✅ CONTINUAR ➜ PREGUNTAS
// ===============================
continueBtn.addEventListener("click", () => {
  const profile = userRole.value;

  // Guardamos temporal para siguientes rutas
  localStorage.setItem("userProfile", profile);

  // 🚀 Redirige a preguntas
  window.location.href = "./preguntas-mentor.html";
});


// ===============================
// ✅ IR AL DASHBOARD (USUARIO EXISTENTE)
// ===============================
goDashboard.addEventListener("click", () => {
  window.location.href = "./dashboard.html";
});
