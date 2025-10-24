import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
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
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==============================
// CONFIGURACIÓN DE FIREBASE
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyCeD4TAPK2GuW01J5WQl7vJjmJWC671f-Y",
  authDomain: "codigograbado.firebaseapp.com",
  projectId: "codigograbado",
  storageBucket: "codigograbado.firebasestorage.app",
  messagingSenderId: "346430888474",
  appId: "1:346430888474:web:cbaa641fbf4fc62bca4fa3",
  measurementId: "G-626THBS8CJ",
};
const initialAuthToken =
  typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

let db,
  auth,
  userId,
  loggedInUser = null;
let functionsList = [];
let editingId = null;
let confirmActionCallback = null;
let isSyntaxValid = false;

const SUPER_ADMIN_KEY = "DT10VazC;#9i";

// Firestore paths
const DB_ROOT = `/artifacts/public/data/aTvZxvxzBtCnCNlURVrQ`;
const FUNCTIONS_PATH = `${DB_ROOT}/sql_functions`;
const ADMINS_PATH = `${DB_ROOT}/admins`;
const LOGS_PATH = `${DB_ROOT}/logs`;
const NOTIFICATIONS_PATH = `${DB_ROOT}/notifications`;

// ==============================
// TEMAS (LIGHT / DARK MODE)
// ==============================
const initializeTheme = () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let isDark = localStorage.getItem("darkMode") === "true";

  if (localStorage.getItem("darkMode") === null) {
    isDark = prefersDark;
  }

  if (isDark) {
    document.body.classList.add("dark");
    document.getElementById("darkModeToggle").checked = true;
  } else {
    document.body.classList.remove("dark");
    document.getElementById("darkModeToggle").checked = false;
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

// ==============================
// MODAL DE CONFIRMACIÓN
// ==============================
const showConfirmModal = (message, onConfirm) => {
  document.getElementById("confirmModalMessage").textContent = message;
  document.getElementById("confirmModal").classList.remove("hidden");
  document.getElementById("confirmModal").classList.add("flex");
  confirmActionCallback = onConfirm;
};
const hideConfirmModal = () => {
  document.getElementById("confirmModal").classList.add("hidden");
  document.getElementById("confirmModal").classList.remove("flex");
  confirmActionCallback = null;
};
const handleConfirm = (isConfirmed) => {
  if (isConfirmed && confirmActionCallback) {
    confirmActionCallback();
  }
  hideConfirmModal();
};

// ==============================
// FIREBASE INIT
// ==============================
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

    userId = auth.currentUser.uid;
    document.getElementById(
      "userIdDisplay"
    ).textContent = `Tu ID de usuario: ${userId}`;
    fetchFunctions();
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    showMessage("Error: No se pudo conectar a la base de datos.", "error");
  }
};

// ==============================
// UTILIDADES
// ==============================
const showMessage = (message, type = "info") => {
  const statusMessage = document.getElementById("statusMessage");
  let target = statusMessage || document.getElementById("recommendationResults");
  if (!target) return;
  target.innerHTML = `<div class="mt-4 text-center p-3 rounded-lg font-medium" id="tempStatusMessage">${message}</div>`;
  const msg = document.getElementById("tempStatusMessage");
  msg.className = "mt-4 text-center p-3 rounded-lg font-medium";
  if (type === "error") msg.classList.add("bg-rose-200", "text-rose-800");
  else if (type === "success")
    msg.classList.add("bg-emerald-200", "text-emerald-800");
  else msg.classList.add("bg-indigo-200", "text-indigo-800");
  if (target !== statusMessage)
    setTimeout(() => (target.innerHTML = ""), 5000);
};

// ==============================
// FUNCIONES CRUD
// ==============================
const fetchFunctions = () => {
  if (!db) return;
  const q = collection(db, FUNCTIONS_PATH);
  onSnapshot(
    q,
    (snapshot) => {
      functionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      displayFunctions();
    },
    (error) => {
      console.error("Error al obtener comandos:", error);
      showMessage("Error al cargar los comandos.", "error");
    }
  );
};

const displayFunctions = (functionsToDisplay = functionsList) => {
  const list = document.getElementById("functionsList");
  const searchList = document.getElementById("searchFunctionsList");
  list.innerHTML = "";
  searchList.innerHTML = "";
  const isUserLoggedIn = loggedInUser !== null;

  if (functionsToDisplay.length === 0) {
    list.innerHTML = '<p class="text-center text-gray-500">No hay comandos.</p>';
  }

  functionsToDisplay.forEach((func) => {
    const funcItem = document.createElement("div");
    funcItem.className =
      "p-4 rounded-lg shadow-md mb-4 bg-gray-200 dark:bg-gray-600";
    funcItem.innerHTML = `
      <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">${func.name}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>Descripción:</strong> ${func.description}</p>
      <div class="p-3 rounded-lg border border-gray-400 dark:border-gray-500 overflow-x-auto bg-white dark:bg-gray-700">
        <pre class="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200"><code>${func.syntax}</code></pre>
      </div>
      <div class="mt-4 flex space-x-2 ${isUserLoggedIn ? "" : "hidden"}">
        <button class="edit-btn bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm" data-id="${func.id}">Editar</button>
        <button class="delete-btn bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg text-sm" data-id="${func.id}">Eliminar</button>
      </div>
    `;
    list.appendChild(funcItem);
    if (isUserLoggedIn) {
      funcItem
        .querySelector(".edit-btn")
        .addEventListener("click", () => editFunction(func));
      funcItem
        .querySelector(".delete-btn")
        .addEventListener("click", () => deleteFunction(func.id));
    }

    const searchItem = document.createElement("li");
    searchItem.className =
      "hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer p-2 rounded-md";
    searchItem.textContent = func.name;
    searchItem.onclick = () => {
      document.getElementById("descriptionSearch").value = func.description;
      document.getElementById("descriptionSearch").focus();
      showMessage(
        `Descripción del comando "${func.name}" cargada en el generador.`,
        "info"
      );
    };
    searchList.appendChild(searchItem);
  });
};

// ==============================
// EVENTOS PRINCIPALES
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initFirebase();

  document
    .getElementById("darkModeToggle")
    .addEventListener("change", toggleDarkMode);
  document
    .getElementById("cancelBtn")
    .addEventListener("click", () => handleConfirm(false));
  document
    .getElementById("confirmBtn")
    .addEventListener("click", () => handleConfirm(true));
});
