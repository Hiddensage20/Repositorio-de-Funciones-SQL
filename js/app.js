// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =========================
   CONFIG
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyCeD4TAPK2GuW01J5WQl7vJjmJWC671f-Y",
  authDomain: "codigograbado.firebaseapp.com",
  projectId: "codigograbado",
  storageBucket: "codigograbado.firebasestorage.app",
  messagingSenderId: "346430888474",
  appId: "1:346430888474:web:cbaa641fbf4fc62bca4fa3",
  measurementId: "G-626THBS8CJ",
};
const initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

let db, auth, userId;
let loggedInUser = null;
let functionsList = [];
let editingId = null;
let confirmActionCallback = null;
let isSyntaxValid = false;

const SUPER_ADMIN_KEY = "DT10VazC;#9i";
const DB_ROOT = `/artifacts/public/data/aTvZxvxzBtCnCNlURVrQ`;
const FUNCTIONS_PATH = `${DB_ROOT}/sql_functions`;
const ADMINS_PATH = `${DB_ROOT}/admins`;
const LOGS_PATH = `${DB_ROOT}/logs`;
const NOTIFICATIONS_PATH = `${DB_ROOT}/notifications`;

/* =========================
   THEME (dark/light)
   ========================= */
const initializeTheme = () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let isDark = localStorage.getItem("darkMode") === "true";

  if (localStorage.getItem("darkMode") === null) isDark = prefersDark;

  if (isDark) {
    document.body.classList.add("dark");
    const toggle = document.getElementById("darkModeToggle");
    if (toggle) toggle.checked = true;
  } else {
    document.body.classList.remove("dark");
    const toggle = document.getElementById("darkModeToggle");
    if (toggle) toggle.checked = false;
  }
  applyTailwindClasses(isDark);
};

const applyTailwindClasses = (isDark) => {
  const body = document.body;
  body.classList.toggle("bg-gray-100", !isDark);
  body.classList.toggle("bg-gray-800", isDark);
  body.classList.toggle("text-gray-800", !isDark);
  body.classList.toggle("text-gray-100", isDark);
};

const toggleDarkMode = () => {
  const body = document.body;
  const isDark = !body.classList.contains("dark");
  body.classList.toggle("dark");
  localStorage.setItem("darkMode", isDark);
  applyTailwindClasses(isDark);
};

/* =========================
   MODAL DE CONFIRMACIÓN
   ========================= */
const showConfirmModal = (message, onConfirm) => {
  const msgEl = document.getElementById("confirmModalMessage");
  const modalEl = document.getElementById("confirmModal");
  if (msgEl) msgEl.textContent = message;
  if (modalEl) {
    modalEl.classList.remove("hidden");
    modalEl.classList.add("flex");
  }
  confirmActionCallback = onConfirm;
};
const hideConfirmModal = () => {
  const modalEl = document.getElementById("confirmModal");
  if (modalEl) {
    modalEl.classList.add("hidden");
    modalEl.classList.remove("flex");
  }
  confirmActionCallback = null;
};
const handleConfirm = (isConfirmed) => {
  if (isConfirmed && confirmActionCallback) confirmActionCallback();
  hideConfirmModal();
};

/* =========================
   INIT FIREBASE
   ========================= */
const initFirebase = async () => {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      await signInAnonymously(auth);
    }

    userId = auth.currentUser?.uid;
    const userIdDisplay = document.getElementById("userIdDisplay");
    if (userIdDisplay) userIdDisplay.textContent = `Tu ID de usuario: ${userId}`;
    fetchFunctions();
    console.log("Firebase inicializado.");
  } catch (err) {
    console.error("Error inicializando Firebase:", err);
    showMessage("Error de conexión a Firebase.", "error");
  }
};

/* =========================
   UTIL - Mensajes
   ========================= */
const showMessage = (message, type = "info", targetId = "statusMessage") => {
  const statusMessage = document.getElementById(targetId);
  let target = statusMessage || document.getElementById("recommendationResults");
  if (!target) return;
  target.innerHTML = `<div class="mt-4 text-center p-3 rounded-lg font-medium" id="tempStatusMessage">${message}</div>`;
  const msg = document.getElementById("tempStatusMessage");
  msg.className = "mt-4 text-center p-3 rounded-lg font-medium";
  if (type === "error") msg.classList.add("bg-rose-200", "text-rose-800");
  else if (type === "success") msg.classList.add("bg-emerald-200", "text-emerald-800");
  else msg.classList.add("bg-indigo-200", "text-indigo-800");
  if (targetId !== "statusMessage") setTimeout(() => (target.innerHTML = ""), 6000);
};

/* =========================
   CRUD/Display Functions
   ========================= */
const fetchFunctions = () => {
  if (!db) return;
  const q = collection(db, FUNCTIONS_PATH);
  onSnapshot(
    q,
    (snapshot) => {
      functionsList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      displayFunctions();
    },
    (err) => {
      console.error("Error fetching functions:", err);
      showMessage("Error cargando comandos.", "error");
    }
  );
};

const displayFunctions = (functionsToDisplay = functionsList) => {
  const listEl = document.getElementById("functionsList");
  const searchList = document.getElementById("searchFunctionsList"); // optional
  if (!listEl) return;
  listEl.innerHTML = "";
  if (searchList) searchList.innerHTML = "";

  if (!functionsToDisplay || functionsToDisplay.length === 0) {
    listEl.innerHTML = `<p class="text-center text-gray-500">No se encontraron comandos.</p>`;
    return;
  }

  const isUserLoggedIn = !!loggedInUser;

  functionsToDisplay.forEach((f) => {
    const card = document.createElement("div");
    card.className = "p-4 rounded-lg shadow-md mb-4 bg-gray-100 dark:bg-gray-700";
    card.innerHTML = `
      <h3 class="text-xl font-bold mb-1">${f.name || "sin nombre"}</h3>
      <p class="text-sm mb-2"><strong>Descripción:</strong> ${f.description || ""}</p>
      <div class="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
        <pre class="whitespace-pre-wrap font-mono text-sm">${f.syntax || ""}</pre>
      </div>
      <div class="mt-3 ${isUserLoggedIn ? "" : "hidden"}">
        <button class="edit-btn mr-2 px-4 py-2 rounded-lg bg-purple-600 text-white">Editar</button>
        <button class="delete-btn px-4 py-2 rounded-lg bg-rose-600 text-white">Eliminar</button>
      </div>
    `;
    listEl.appendChild(card);

    if (isUserLoggedIn) {
      const editBtn = card.querySelector(".edit-btn");
      const delBtn = card.querySelector(".delete-btn");
      if (editBtn) editBtn.addEventListener("click", () => editFunction(f));
      if (delBtn) delBtn.addEventListener("click", () => deleteFunction(f.id));
    }

    if (searchList) {
      const li = document.createElement("li");
      li.className = "p-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer";
      li.textContent = f.name || "";
      li.addEventListener("click", () => {
        const ds = document.getElementById("descriptionSearch");
        if (ds) {
          ds.value = f.description || "";
          ds.focus();
        }
      });
      searchList.appendChild(li);
    }
  });
};

/* =========================
   VALIDAR SINTAXIS CON IA
   ========================= */
const validateFunctionWithAI = async () => {
  const name = document.getElementById("funcName")?.value.trim();
  const description = document.getElementById("funcDescription")?.value.trim();
  const syntax = document.getElementById("funcSyntax")?.value.trim();
  const validationMessageDiv = document.getElementById("validationMessage");
  const validateButton = document.getElementById("validateSyntaxButton");

  if (!loggedInUser) {
    if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Debes iniciar sesión para pre-validar la sintaxis.</p>`;
    return;
  }
  if (!name || !description || !syntax) {
    if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Completa Nombre, Descripción y Sintaxis.</p>`;
    return;
  }

  if (validateButton) {
    validateButton.textContent = "Validando...";
    validateButton.disabled = true;
  }
  if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center p-3 rounded-lg font-medium bg-indigo-200 text-indigo-800">Analizando sintaxis con IA...</p>`;
  isSyntaxValid = false;

  const apiKey = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const prompt = `Eres un experto en SQL. El usuario está intentando guardar un comando SQL.
1. Comando: "${name}"
2. Descripción: "${description}"
3. Sintaxis: "${syntax}"
Si la sintaxis es válida responde "SI:VALIDA". Si no, responde "NO:Sugerencia de Comando: [SUGERENCIA]".`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "Responde estrictamente en el formato indicado." }] },
  };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const responseText = text.trim().toUpperCase();

    if (responseText.startsWith("SI:VALIDA")) {
      isSyntaxValid = true;
      if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-emerald-800 bg-emerald-200 p-3 rounded-lg">Sintaxis válida. Puedes guardar.</p>`;
    } else if (responseText.startsWith("NO:SUGERENCIA DE COMANDO:")) {
      const suggestion = responseText.replace("NO:SUGERENCIA DE COMANDO:", "").trim();
      if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Sugerencia IA: ${suggestion}</p>`;
    } else {
      if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Respuesta no válida de la IA.</p>`;
    }
  } catch (err) {
    console.error("Error validando con IA:", err);
    if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Error conectando con IA.</p>`;
  } finally {
    if (validateButton) {
      validateButton.textContent = "Validar con IA ✨";
      validateButton.disabled = false;
    }
  }
};

/* =========================
   GENERAR CONSULTA CON IA
   ========================= */
const generateSQLQuery = async () => {
  const description = document.getElementById("descriptionSearch")?.value.trim();
  const btn = document.getElementById("descriptionSearchButton");
  const resultsDiv = document.getElementById("recommendationResults");

  if (!description) {
    showMessage("Describe tu necesidad primero.", "error", "recommendationResults");
    return;
  }

  if (btn) {
    btn.textContent = "Generando...";
    btn.disabled = true;
  }
  if (resultsDiv) resultsDiv.innerHTML = `<p class="mt-4 p-3 rounded-lg bg-indigo-200 text-indigo-800">Generando consulta SQL...</p>`;

  const apiKey = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const prompt = `Eres un experto en SQL. Genera SOLO la consulta SQL basada en: "${description}". No expliques nada.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "Solo devuelve código SQL." }] },
  };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

    const result = await res.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const sqlCode = text.replace(/```sql|```/g, "").trim();

    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <h3 class="text-lg font-bold mb-2">Consulta Generada:</h3>
        <div class="bg-indigo-100 dark:bg-gray-800 p-3 rounded-lg border border-indigo-300 dark:border-gray-600">
          <pre class="whitespace-pre-wrap font-mono text-sm">${sqlCode}</pre>
        </div>
      `;
    } else {
      console.warn("recommendationResults no encontrado");
    }

    showMessage("Consulta SQL generada con éxito.", "success", "recommendationResults");
  } catch (err) {
    console.error("Error generando consulta:", err);
    if (resultsDiv) resultsDiv.innerHTML = `<p class="mt-4 p-3 rounded-lg bg-rose-200 text-rose-800">Error: ${err.message}</p>`;
  } finally {
    if (btn) {
      btn.textContent = "Generar Consulta SQL ✨";
      btn.disabled = false;
    }
  }
};

/* =========================
   ADD / UPDATE / DELETE
   ========================= */
const addOrUpdateFunction = async (e) => {
  e.preventDefault();
  const name = document.getElementById("funcName")?.value.trim();
  const description = document.getElementById("funcDescription")?.value.trim();
  const syntax = document.getElementById("funcSyntax")?.value.trim();
  const btn = document.getElementById("addFunctionButton");

  if (!loggedInUser) {
    showMessage("Debes iniciar sesión.", "error");
    return;
  }
  if (!name || !description || !syntax) {
    showMessage("Completa todos los campos.", "error");
    return;
  }
  if (!isSyntaxValid && !editingId) {
    const v = document.getElementById("validationMessage");
    if (v) v.innerHTML = `<p class="mt-2 p-3 rounded-lg bg-rose-200 text-rose-800">Pre-valida la sintaxis con IA.</p>`;
    return;
  }

  if (btn) {
    btn.textContent = editingId ? "Actualizando..." : "Guardando...";
    btn.disabled = true;
  }

  try {
    if (editingId) {
      await updateDoc(doc(db, FUNCTIONS_PATH, editingId), { name, description, syntax });
      await addDoc(collection(db, LOGS_PATH), { action: "edited", user: loggedInUser.username, functionName: name, timestamp: new Date() });
      showMessage("Comando actualizado.", "success");
      editingId = null;
    } else {
      await addDoc(collection(db, FUNCTIONS_PATH), { name, description, syntax, createdAt: new Date() });
      await addDoc(collection(db, LOGS_PATH), { action: "added", user: loggedInUser.username, functionName: name, timestamp: new Date() });
      showMessage("Comando agregado.", "success");
    }
    const form = document.getElementById("addFunctionForm");
    if (form) form.reset();
    const v = document.getElementById("validationMessage");
    if (v) v.innerHTML = "";
    isSyntaxValid = false;
  } catch (err) {
    console.error("Error saving:", err);
    showMessage("Error al guardar comando.", "error");
  } finally {
    if (btn) {
      btn.textContent = "Guardar";
      btn.disabled = false;
    }
  }
};

const editFunction = (func) => {
  editingId = func.id;
  const nameEl = document.getElementById("funcName");
  const descEl = document.getElementById("funcDescription");
  const syntaxEl = document.getElementById("funcSyntax");
  if (nameEl) nameEl.value = func.name || "";
  if (descEl) descEl.value = func.description || "";
  if (syntaxEl) syntaxEl.value = func.syntax || "";
  const addSection = document.getElementById("addFunctionSection");
  if (addSection) addSection.scrollIntoView({ behavior: "smooth" });
  const validationDiv = document.getElementById("validationMessage");
  if (validationDiv) validationDiv.innerHTML = `<p class="mt-2 p-3 rounded-lg bg-indigo-200 text-indigo-800">Modo edición: validación previa omitida.</p>`;
  isSyntaxValid = true;
};

const deleteFunction = async (id) => {
  if (!loggedInUser) {
    showMessage("Debes iniciar sesión.", "error");
    return;
  }
  showConfirmModal("¿Eliminar comando? Esta acción no se puede deshacer.", async () => {
    try {
      const ref = doc(db, FUNCTIONS_PATH, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await deleteDoc(ref);
        await addDoc(collection(db, LOGS_PATH), { action: "deleted", user: loggedInUser.username, functionName: snap.data().name, timestamp: new Date() });
        showMessage("Comando eliminado.", "success");
      }
    } catch (err) {
      console.error("Error deleting:", err);
      showMessage("Error al eliminar.", "error");
    }
  });
};

/* =========================
   CREATE ADMIN
   ========================= */
const createAdmin = async (e) => {
  e.preventDefault();
  const newAdminEmail = document.getElementById("newAdminEmail")?.value.trim();
  const newAdminPassword = document.getElementById("newAdminPassword")?.value;
  const newAdminUsername = document.getElementById("newAdminUsername")?.value.trim();
  const adminMessage = document.getElementById("adminMessage");

  if (adminMessage) {
    adminMessage.textContent = "";
    adminMessage.className = "";
  }

  if (!newAdminEmail || !newAdminPassword || !newAdminUsername) {
    if (adminMessage) {
      adminMessage.textContent = "Completa todos los campos.";
      adminMessage.classList.add("text-rose-500");
    }
    return;
  }

  try {
    const uc = await createUserWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
    const uid = uc.user.uid;
    await setDoc(doc(db, ADMINS_PATH, uid), { uid, username: newAdminUsername, email: newAdminEmail, isAdmin: true, lastLogin: null }, { merge: true });
    if (adminMessage) {
      adminMessage.textContent = `Administrador ${newAdminUsername} creado.`;
      adminMessage.classList.add("text-emerald-500");
    }
    const form = document.getElementById("createAdminForm");
    if (form) form.reset();
  } catch (err) {
    console.error("Error createAdmin:", err);
    if (adminMessage) {
      adminMessage.textContent = `Error: ${err.code || err.message}`;
      adminMessage.classList.add("text-rose-500");
    }
  }
};

/* =========================
   LOGIN / LOGOUT
   ========================= */
const logout = async () => {
  try {
    if (auth.currentUser) await signOut(auth);
    loggedInUser = null;

    // hide admin sections
    ["addFunctionSection", "fixErrorSection", "adminManagementSection"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });

    // menu toggles
    const logoutBtn = document.getElementById("logoutButton");
    const showLoginBtn = document.getElementById("showLoginButton");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (showLoginBtn) showLoginBtn.classList.remove("hidden");

    await signInAnonymously(auth);
    userId = auth.currentUser?.uid;
    const userIdDisplay = document.getElementById("userIdDisplay");
    if (userIdDisplay) userIdDisplay.textContent = `Tu ID de usuario: ${userId}`;

    displayFunctions();
    showMessage("Sesión cerrada.", "info");
  } catch (err) {
    console.error("Error logout:", err);
    showMessage("Error cerrando sesión.", "error");
  }
};

const login = async (event) => {
  if (event && event.preventDefault) event.preventDefault();
  const email = document.getElementById("adminEmail")?.value.trim();
  const password = document.getElementById("adminPassword")?.value;
  const loginMessage = document.getElementById("loginMessage");

  if (loginMessage) loginMessa