// firebase-config.js
// Rellena el objeto `firebaseConfig` con los valores de tu proyecto Firebase.
// Guardar en la misma carpeta que index.html

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// --- <<< REEMPLAZA ESTOS VALORES >>> ---
const firebaseConfig = {
  apiKey: "AIzaSyBlOWu3kGwDIGw_yIPBjz6--C5_RaXuLd8",
  authDomain: "carlitos-8744c.firebaseapp.com",
  projectId: "carlitos-8744c",
  storageBucket: "carlitos-8744c.firebasestorage.app",
  messagingSenderId: "934449166885",
  appId:  "1:934449166885:web:8a51fb741c36f449a71dcc",
  measurementId: "G-DLH0HT67QX"
};
// -----------------------------------------

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Opcional: configurar provider params (ej: forzar seleccionar cuenta)
// provider.setCustomParameters({ prompt: 'select_account' });

export default { auth, db, provider };
