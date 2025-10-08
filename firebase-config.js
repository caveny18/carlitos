// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// --- Configuración del proyecto Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBlOWu3kGwDIGw_yIPBjz6--C5_RaXuLd8",
  authDomain: "carlitos-8744c.firebaseapp.com",
  projectId: "carlitos-8744c",
  storageBucket: "carlitos-8744c.appspot.com", // 🔧 CORREGIDO: ".app" → ".appspot.com"
  messagingSenderId: "934449166885",
  appId: "1:934449166885:web:8a51fb741c36f449a71dcc",
  measurementId: "G-DLH0HT67QX"
};

// --- Inicializar Firebase ---
const app = initializeApp(firebaseConfig);

// --- Inicializar servicios ---
const db = getFirestore(app);
const auth = getAuth(app);

// --- Configurar proveedor de Google ---
const provider = new GoogleAuthProvider();

// Opcional (recomendado): Forzar selección de cuenta cada vez
provider.setCustomParameters({ prompt: "select_account" });

// --- Exportar para usar en otros archivos ---
export { db, auth, provider };
