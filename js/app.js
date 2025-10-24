import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, getDocs, setDoc, getDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuración de Firebase (Se mantiene la configuración original del usuario)
const firebaseConfig = {
    apiKey: "AIzaSyCeD4TAPK2GuW01J5WQl7vJjmJWC671f-Y",
    authDomain: "codigograbado.firebaseapp.com",
    projectId: "codigograbado",
    storageBucket: "codigograbado.firebasestorage.app",
    messagingSenderId: "346430888474",
    appId: "1:346430888474:web:cbaa641fbf4fc62bca4fa3",
    measurementId: "G-626THBS8CJ"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, userId, loggedInUser = null;
let functionsList = [];
let editingId = null;
let confirmActionCallback = null;

let isSyntaxValid = false; 

// SE ELIMINAN LAS CREDENCIALES CODIFICADAS DEL SUPER ADMIN
const SUPER_ADMIN_KEY = 'DT10VazC;#9i'; 

// Rutas de Firestore
const DB_ROOT = `/artifacts/public/data/aTvZxvxzBtCnCNlURVrQ`;
const FUNCTIONS_PATH = `${DB_ROOT}/sql_functions`;
const ADMINS_PATH = `${DB_ROOT}/admins`;
const LOGS_PATH = `${DB_ROOT}/logs`;
const NOTIFICATIONS_PATH = `${DB_ROOT}/notifications`; 


// ************************************************************
// ********* FUNCIÓN DE MANEJO DE TEMAS ***********************
// ************************************************************
const initializeTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = localStorage.getItem('darkMode') === 'true';

    if (localStorage.getItem('darkMode') === null) {
        isDark = prefersDark;
    }

    if (isDark) {
        document.body.classList.add('dark');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.checked = true;
    } else {
        document.body.classList.remove('dark');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.checked = false;
    }
    applyTailwindClasses(isDark);
};

 // ************************************************************
 // ********* FUNCIÓN DE TEMA CORREGIDA **********************
 // ************************************************************
const applyTailwindClasses = (isDark) => {
     const body = document.body;
     
     // Base body color (Solo para asegurar la coherencia)
     body.classList.toggle('bg-gray-100', !isDark);
     body.classList.toggle('bg-gray-800', isDark);
     body.classList.toggle('text-gray-800', !isDark);
     body.classList.toggle('text-gray-100', isDark);

     // --- BLOQUES REDUNDANTES ELIMINADOS ---
     // Los prefijos 'dark:' en el HTML (ej: dark:bg-gray-700)
     // y en el JS (ej: displayFunctions) ya manejan el estilo
     // automáticamente cuando la clase '.dark' se aplica al <body>.
     
     // El código manual que estaba aquí (con document.querySelectorAll)
     // era la fuente del bug, ya que no seleccionaba el 'div'
     // de la card "Listado de Comandos", causando el "cuadro blanco".
};

const toggleDarkMode = () => {
    const body = document.body;
    const isDark = !body.classList.contains('dark');

    body.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
    
    applyTailwindClasses(isDark);
};
// ************************************************************


// --- Funciones del Modal de Confirmación ---
const showConfirmModal = (message, onConfirm) => {
    const msgEl = document.getElementById('confirmModalMessage');
    const modalEl = document.getElementById('confirmModal');
    if (msgEl) msgEl.textContent = message;
    if (modalEl) {
        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
    }
    confirmActionCallback = onConfirm;
};

const hideConfirmModal = () => {
    const modalEl = document.getElementById('confirmModal');
    if (modalEl) {
        modalEl.classList.add('hidden');
        modalEl.classList.remove('flex');
    }
    confirmActionCallback = null;
};

const handleConfirm = (isConfirmed) => {
    if (isConfirmed && confirmActionCallback) {
        confirmActionCallback();
    }
    hideConfirmModal();
};
// --- Fin Funciones del Modal de Confirmación ---


// Función para inicializar Firebase
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
        const userIdDisplay = document.getElementById('userIdDisplay');
        if (userIdDisplay) userIdDisplay.textContent = `Tu ID de usuario: ${userId}`;
        
        console.log("Firebase inicializado y autenticación exitosa.");
        fetchFunctions();
    } catch (error) {
        console.error("Error al inicializar Firebase o autenticar:", error);
        showMessage("Error: No se pudo conectar a la base de datos.", 'error');
    }
};

const showMessage = (message, type = 'info') => {
    const statusMessage = document.getElementById('statusMessage');
    let targetElement = statusMessage; 
    if (!targetElement) {
        targetElement = document.getElementById('recommendationResults');
    }

    if (!targetElement) return; 

    targetElement.innerHTML = `<div class="mt-4 text-center p-3 rounded-lg font-medium" id="tempStatusMessage">${message}</div>`;
    const tempStatusMessage = document.getElementById('tempStatusMessage');

    tempStatusMessage.className = 'mt-4 text-center p-3 rounded-lg font-medium';
    if (type === 'error') {
        tempStatusMessage.classList.add('bg-rose-200', 'text-rose-800');
    } else if (type === 'success') {
        tempStatusMessage.classList.add('bg-emerald-200', 'text-emerald-800');
    } else {
        tempStatusMessage.classList.add('bg-indigo-200', 'text-indigo-800');
    }

    if (targetElement !== statusMessage) {
        setTimeout(() => {
            targetElement.innerHTML = '';
        }, 5000);
    }
};

const fetchFunctions = () => {
    if (!db) return;
    const q = collection(db, FUNCTIONS_PATH);
    onSnapshot(q, (snapshot) => {
        functionsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        displayFunctions();
    }, (error) => {
        console.error("Error al obtener comandos:", error);
        showMessage("Error al cargar los comandos.", 'error');
    });
};

const fetchNotifications = () => {
    console.log("Carga de notificaciones deshabilitada en la interfaz.");
    return;
};

const addNotification = async (func) => { /* No hace nada, el log ya se crea en addOrUpdateFunction */ };
const deleteNotification = async (functionName) => { /* No hace nada, el log ya se crea en deleteFunction */ };

const displayNotifications = (notifications) => {
    const notificationsList = document.getElementById('notificationsList');
    if (notificationsList) {
        notificationsList.innerHTML = '<p class="text-center text-gray-500 text-sm py-2">Esta funcionalidad está deshabilitada en la interfaz. La actividad se registra en Firestore Logs.</p>';
    }
};

const displayFunctions = (functionsToDisplay = functionsList) => {
    const listElement = document.getElementById('functionsList');
    const searchList = document.getElementById('searchFunctionsList');
    if (listElement) listElement.innerHTML = '';
    if (searchList) searchList.innerHTML = '';

    if (!listElement || !searchList) return;

    const isUserLoggedIn = loggedInUser !== null;

    if (functionsToDisplay.length === 0) {
        listElement.innerHTML = '<p class="text-center text-gray-500">No se encontraron comandos.</p>';
    }

    functionsToDisplay.forEach(func => {
        const funcItem = document.createElement('div');
        // Ajuste de clases de tema para las cards
        funcItem.className = 'p-4 rounded-lg shadow-md mb-4 bg-gray-200 dark:bg-gray-600';
        
        funcItem.innerHTML = `
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">${func.name}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>Descripción:</strong> ${func.description}</p>
            <div class="p-3 rounded-lg border border-gray-400 dark:border-gray-500 overflow-x-auto bg-white dark:bg-gray-700">
                <pre class="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200"><code>${func.syntax}</code></pre>
            </div>
            <div class="mt-4 flex space-x-2 ${isUserLoggedIn ? '' : 'hidden'}">
                <button class="edit-btn bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm" data-id="${func.id}">Editar</button>
                <button class="delete-btn bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm" data-id="${func.id}">Eliminar</button>
            </div>
        `;
        listElement.appendChild(funcItem);

        if (isUserLoggedIn) {
            const editBtn = funcItem.querySelector('.edit-btn');
            const delBtn = funcItem.querySelector('.delete-btn');
            if (editBtn) editBtn.addEventListener('click', () => editFunction(func));
            if (delBtn) delBtn.addEventListener('click', () => deleteFunction(func.id));
        }

        const searchItem = document.createElement('li');
        searchItem.className = 'hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer p-2 rounded-md transition duration-150';
        searchItem.textContent = func.name;
        searchItem.onclick = () => {
            const descEl = document.getElementById('descriptionSearch');
            if (descEl) descEl.value = func.description;
            const focusEl = document.getElementById('descriptionSearch');
            if (focusEl) focusEl.focus();
            showMessage(`Descripción del comando "${func.name}" cargada en el generador de consultas.`, 'info');
        };
        searchList.appendChild(searchItem);
    });
};

const validateFunctionWithAI = async () => {
    const name = document.getElementById('funcName')?.value.trim();
    const description = document.getElementById('funcDescription')?.value.trim();
    const syntax = document.getElementById('funcSyntax')?.value.trim();
    const validationMessageDiv = document.getElementById('validationMessage');
    const validateButton = document.getElementById('validateSyntaxButton');

    if (!loggedInUser) {
        if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Debes iniciar sesión para pre-validar la sintaxis.</p>`;
        return;
    }

    if (!name || !description || !syntax) {
        if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Completa los campos Nombre, Descripción y Sintaxis para validar.</p>`;
        return;
    }

    if (validateButton) {
        validateButton.textContent = 'Validando...';
        validateButton.disabled = true;
    }
    if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center p-3 rounded-lg font-medium bg-indigo-200 text-indigo-800">Analizando sintaxis con IA...</p>`;
    isSyntaxValid = false; 

    const apiKey = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`; 
    
    let prompt = `Eres un experto en SQL. El usuario está intentando guardar un comando SQL.

    1. **Comando/Concepto Intendado:** "${name}"
    2. **Descripción:** "${description}"
    3. **Sintaxis proporcionada:** "${syntax}"

    Evalúa si la 'Sintaxis proporcionada' es un comando SQL bien formado (DDL, DML, TCL, o una función SQL) y que esté razonablemente relacionado con el 'Comando/Concepto Intendado'.

    - Si la Sintaxis es un comando SQL válido, responde con: SI:VALIDA
    - Si la Sintaxis NO es un comando SQL válido (ej. está incompleto o es erróneo), analiza la sintaxis y la descripción para sugerir el comando SQL que el usuario probablemente pretendía usar.
    
    Responde con: NO:Sugerencia de Comando: [Comando/Corrección sugerida]`;


    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Responde estrictamente con 'SI:VALIDA' o 'NO:Sugerencia de Comando: [COMANDO SUGERIDO/CORRECCIÓN]'. No uses comillas ni explicaciones adicionales." }] },
    };
    
    let attempts = 0;
    const maxAttempts = 3;
    const initialDelay = 1000;

    const makeApiCall = async () => {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.status === 429 && attempts < maxAttempts - 1) {
            throw new Error("Rate limit exceeded");
        }
        return response;
    };

    try {
        let response;
        while (attempts < maxAttempts) {
            try {
                response = await makeApiCall();
                break;
            } catch (error) {
                if (error.message === "Rate limit exceeded") {
                    const delay = initialDelay * Math.pow(2, attempts);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    attempts++;
                } else {
                    throw error;
                }
            }
        }
        
        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        const responseText = text.trim().toUpperCase();

        if (responseText.startsWith('SI:VALIDA')) {
            isSyntaxValid = true;
            if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-emerald-800 bg-emerald-200 p-3 rounded-lg">¡Validación exitosa! La sintaxis es un comando SQL válido. Puedes guardar.</p>`;
            return { valid: true };
        } else if (responseText.startsWith('NO:SUGERENCIA DE COMANDO:')) {
            const suggestion = responseText.replace('NO:SUGERENCIA DE COMANDO:', '').trim();
            
            const userMessage = `Error de Sintaxis: Lo que ingresaste NO es un comando SQL válido. Sugerencia de la IA: **${suggestion}**. Por favor, ajusta la sintaxis y vuelve a validar.`;
            
            if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">${userMessage}</p>`;
            return { valid: false };
        } else {
            if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Error: La sintaxis no es válida. Inténtalo de nuevo.</p>`;
            return { valid: false };
        }
    } catch (error) {
        console.error("Error al validar con IA:", error);
        if (validationMessageDiv) validationMessageDiv.innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Error de conexión: No se pudo validar con la IA.</p>`;
        return { valid: false };
    } finally {
        if (validateButton) {
            validateButton.textContent = 'Pre-validar Sintaxis con IA ✨';
            validateButton.disabled = false;
        }
    }
};


// ************************************************************
// ********* FUNCIÓN PARA GENERAR CONSULTA SQL (CORREGIDA) *****
// ************************************************************
const generateSQLQuery = async () => {
    const description = document.getElementById('descriptionSearch')?.value.trim();
    const button = document.getElementById('descriptionSearchButton');
    const resultsDiv = document.getElementById('recommendationResults');
    
    if (!description) {
        showMessage('Por favor, describe tu necesidad para generar la consulta.', 'error');
        return;
    }

    if (button) {
        button.textContent = 'Generando...';
        button.disabled = true;
    }
    if (resultsDiv) resultsDiv.innerHTML = '';
    
    if (resultsDiv) resultsDiv.innerHTML = `<p class="mt-4 text-center p-3 rounded-lg font-medium bg-indigo-200 text-indigo-800">Generando consulta SQL...</p>`;

    const apiKey = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q"; // Tu API Key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    
    const prompt = `Eres un experto en SQL. Genera una consulta SQL (solo el código, no expliques nada) basada en la siguiente descripción. No incluyas comentarios o texto adicional. Descripción: "${description}".`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Genera exclusivamente código SQL para bases de datos relacionales, sin ningún texto, explicación o comentarios." }] },
    };
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.statusText}`);
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        const sqlCode = text.replace(/```sql|```/g, '').trim(); 
        
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <h3 class="text-xl font-bold mt-4 mb-2 text-gray-900">Consulta Generada:</h3>
                <div class="bg-indigo-100 p-4 rounded-lg border border-indigo-400 overflow-x-auto">
                    <pre class="whitespace-pre-wrap font-mono text-indigo-800"><code>${sqlCode}</code></pre>
                </div>
            `;
        }
        showMessage('Consulta SQL generada con éxito.', 'success');
        
    } catch (error) {
        console.error("Error al generar la consulta SQL:", error);
        if (resultsDiv) resultsDiv.innerHTML = `<p class="mt-4 text-center p-3 rounded-lg font-medium bg-rose-200 text-rose-800">Error al generar la consulta: ${error.message}. Intenta de nuevo.</p>`;
    } finally {
        if (button) {
            button.textContent = 'Generar Consulta SQL ✨';
            button.disabled = false;
        }
    }
};


const addOrUpdateFunction = async (event) => {
    event.preventDefault();
    const name = document.getElementById('funcName')?.value.trim();
    const description = document.getElementById('funcDescription')?.value.trim();
    const syntax = document.getElementById('funcSyntax')?.value.trim();
    const button = document.getElementById('addFunctionButton');
    const originalButtonText = editingId ? 'Actualizar Comando' : 'Guardar Comando';
    
    if (!loggedInUser) {
        showMessage('Debes iniciar sesión para realizar esta acción.', 'error');
        return;
    }

    if (!name || !description || !syntax) {
        showMessage('Todos los campos son obligatorios.', 'error');
        return;
    }
    
    if (!isSyntaxValid && !editingId) {
        document.getElementById('validationMessage').innerHTML = `<p class="mt-2 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">¡Atención! La sintaxis no ha sido pre-validada o la validación falló. Usa el botón "Pre-validar" antes de guardar.</p>`;
        return;
    }

    if (button) {
        button.textContent = 'Guardando...';
        button.disabled = true;
    }

    try {
        if (editingId) {
            await updateDoc(doc(db, FUNCTIONS_PATH, editingId), {
                name,
                description,
                syntax,
            });
            // CREACIÓN DE LOG
            await addDoc(collection(db, LOGS_PATH), {
                action: "edited",
                user: loggedInUser.username,
                functionName: name,
                timestamp: new Date()
            });
            showMessage(`Comando actualizado con éxito.`, 'success');
            editingId = null;
            const addBtn = document.getElementById('addFunctionButton');
            if (addBtn) addBtn.textContent = 'Guardar Comando';
        } else {
            await addDoc(collection(db, FUNCTIONS_PATH), {
                name,
                description,
                syntax,
                createdAt: new Date()
            });
            // CREACIÓN DE LOG
            await addDoc(collection(db, LOGS_PATH), {
                action: "added",
                user: loggedInUser.username,
                functionName: name,
                timestamp: new Date()
            });
            showMessage(`Comando agregado con éxito.`, 'success');
        }
        const form = document.getElementById('addFunctionForm');
        if (form) form.reset();
        const validationMessage = document.getElementById('validationMessage');
        if (validationMessage) validationMessage.innerHTML = '';
        isSyntaxValid = false;
    } catch (e) {
        console.error("Error al agregar/actualizar documento: ", e);
        showMessage("Error al guardar el comando. Verifica la consola de Firebase.", 'error');
    } finally {
        if (button) {
            button.textContent = originalButtonText;
            button.disabled = false;
        }
    }
};

const editFunction = (func) => {
    editingId = func.id;
    const nameEl = document.getElementById('funcName');
    const descEl = document.getElementById('funcDescription');
    const syntaxEl = document.getElementById('funcSyntax');
    if (nameEl) nameEl.value = func.name;
    if (descEl) descEl.value = func.description;
    if (syntaxEl) syntaxEl.value = func.syntax;
    const addBtn = document.getElementById('addFunctionButton');
    if (addBtn) addBtn.textContent = 'Actualizar Comando';
    const addSection = document.getElementById('addFunctionSection');
    if (addSection) addSection.scrollIntoView({ behavior: 'smooth' });
    const validationDiv = document.getElementById('validationMessage');
    if (validationDiv) validationDiv.innerHTML = '<p class="mt-2 text-center text-indigo-800 bg-indigo-200 p-3 rounded-lg">Modo Edición: La validación previa se omite al guardar.</p>';
    isSyntaxValid = true; 
};

const deleteFunction = async (id) => {
    if (!loggedInUser) {
        showMessage('Debes iniciar sesión para realizar esta acción.', 'error');
        return;
    }
    
    showConfirmModal('¿Estás seguro de que quieres eliminar este comando? Esta acción no se puede deshacer.', async () => {
        try {
            const docRef = doc(db, FUNCTIONS_PATH, id);
            const funcSnap = await getDoc(docRef);
            if (funcSnap.exists()) {
                await deleteDoc(docRef);
                
                // CREACIÓN DE LOG
                await addDoc(collection(db, LOGS_PATH), {
                    action: "deleted",
                    user: loggedInUser.username,
                    functionName: funcSnap.data().name,
                    timestamp: new Date()
                });

                showMessage('Comando eliminado con éxito.', 'success');
            }
        } catch (e) {
            console.error("Error al eliminar documento: ", e);
            showMessage("Error al eliminar el comando.", 'error');
        }
    });
};

const createAdmin = async (event) => {
    event.preventDefault();
    const newAdminEmail = document.getElementById('newAdminEmail')?.value.trim();
    const newAdminPassword = document.getElementById('newAdminPassword')?.value;
    const newAdminUsername = document.getElementById('newAdminUsername')?.value.trim();
    const secretKey = document.getElementById('secretKey')?.value;
    const adminMessage = document.getElementById('adminMessage');

    if (adminMessage) {
        adminMessage.textContent = '';
        adminMessage.className = 'mt-4 text-center text-sm';
    }
    
    const isPromotingExistingUser = secretKey === SUPER_ADMIN_KEY;
    
    if (!newAdminEmail || !newAdminPassword || !newAdminUsername) {
        if (adminMessage) {
            adminMessage.textContent = 'Todos los campos son obligatorios.';
            adminMessage.classList.add('text-rose-500');
        }
        return;
    }
    
    let uid = null;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
        uid = userCredential.user.uid;
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            if (isPromotingExistingUser) {
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
                    uid = userCredential.user.uid;
                    await signOut(auth); 
                    if (adminMessage) {
                        adminMessage.textContent = 'Advertencia: El email ya existía. Se asignarán permisos de administrador.';
                        adminMessage.classList.add('text-yellow-500');
                    }
                } catch (signInError) {
                     let displayError = 'Error: El email ya está registrado, pero la contraseña no coincide. No se puede obtener el UID para asignar permisos.';
                     if (adminMessage) {
                        adminMessage.textContent = displayError;
                        adminMessage.classList.add('text-rose-500');
                     }
                     return;
                }
            } else {
                if (adminMessage) {
                    adminMessage.textContent = 'Error: El email ya está registrado. Para promocionar a un usuario existente, ingrese la clave secreta.';
                    adminMessage.classList.add('text-rose-500');
                }
                return;
            }
        } else if (e.code === 'auth/weak-password') {
            if (adminMessage) {
                adminMessage.textContent = 'Error: La contraseña debe tener al menos 6 caracteres.';
                adminMessage.classList.add('text-rose-500');
            }
            return;
        } else {
            console.error("Error al crear usuario Auth:", e);
            if (adminMessage) {
                adminMessage.textContent = `Error (${e.code || 'unknown-error'}): No se pudo crear la cuenta de usuario.`;
                adminMessage.classList.add('text-rose-500');
            }
            return;
        }
    }
    
    if (!uid) { return; } 

    try {
        await setDoc(doc(db, ADMINS_PATH, uid), {
            uid: uid,
            username: newAdminUsername,
            email: newAdminEmail,
            isAdmin: true, 
            lastLogin: null
        }, { merge: true });

        if (adminMessage && !adminMessage.classList.contains('text-yellow-500')) {
            adminMessage.textContent = `Administrador ${newAdminUsername} creado con éxito. Ahora puede iniciar sesión con su email y contraseña.`;
            adminMessage.classList.add('text-emerald-500');
        }
        const form = document.getElementById('createAdminForm');
        if (form) form.reset();
    } catch (e) {
        console.error("Error al registrar administrador en Firestore:", e);
        if (adminMessage) {
            adminMessage.textContent = 'Error: Se creó la cuenta de Auth, pero falló el registro de permisos en Firestore.';
            adminMessage.classList.add('text-rose-500');
        }
    }
};

const logout = async () => {
    try {
        if (auth.currentUser) {
            await signOut(auth);
        }
        
        loggedInUser = null; 

        // Ocultar secciones de administración
        const addFunctionSection = document.getElementById('addFunctionSection');
        const fixErrorSection = document.getElementById('fixErrorSection');
        const adminManagementSection = document.getElementById('adminManagementSection');
        const notificationsSection = document.getElementById('notificationsSection');
        if (addFunctionSection) addFunctionSection.classList.add('hidden');
        if (fixErrorSection) fixErrorSection.classList.add('hidden');
        if (adminManagementSection) adminManagementSection.classList.add('hidden');
        if (notificationsSection) notificationsSection.classList.add('hidden');
        
        // Mostrar/Ocultar elementos del menú
        const adminDropdownLogin = document.getElementById('adminDropdownLogin');
        const adminDropdownLogout = document.getElementById('adminDropdownLogout');
        const adminDropdownManagement = document.getElementById('adminDropdownManagement');
        const welcomeMessageEl = document.getElementById('welcomeMessage');
        if (adminDropdownLogin) adminDropdownLogin.classList.remove('hidden');
        if (adminDropdownLogout) adminDropdownLogout.classList.add('hidden');
        if (adminDropdownManagement) adminDropdownManagement.classList.add('hidden');
        if (welcomeMessageEl) welcomeMessageEl.classList.add('hidden');


        await signInAnonymously(auth);
        userId = auth.currentUser.uid;
        const userIdDisplay = document.getElementById('userIdDisplay');
        if (userIdDisplay) userIdDisplay.textContent = `Tu ID de usuario: ${userId}`;

        displayFunctions(); 

        showMessage('Sesión cerrada correctamente.', 'info');
    } catch (error) {
        console.error("Error al cerrar sesión o al re-autenticar anónimamente:", error);
        showMessage('Error al cerrar sesión.', 'error');
    }
};

const login = async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    const loginEmail = document.getElementById('loginEmail')?.value.trim();
    const loginPassword = document.getElementById('loginPassword')?.value;
    const loginMessage = document.getElementById('loginMessage');
    
    if (loginMessage) loginMessage.textContent = '';
    loggedInUser = null; 
    
    let userFound = false;
    let uid = null;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        const user = userCredential.user;
        uid = user.uid;

        loggedInUser = { 
            uid: uid,
            username: loginEmail.split('@')[0], 
            isAdmin: true, 
            lastLogin: null 
        };
        userFound = true;

        try {
            const docRef = doc(db, ADMINS_PATH, uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                loggedInUser.lastLogin = docSnap.data().lastLogin;
                loggedInUser.username = docSnap.data().username || loggedInUser.username;
            }
        } catch (e) {
            console.warn("No se pudo obtener el documento de admin para la verificación de logs.", e);
        }

    } catch (e) {
        console.error("Error de autenticación:", e);
        const errorCode = e.code || '';
        
        if (loginMessage) {
            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                loginMessage.textContent = 'Credenciales incorrectas.';
            } else {
                loginMessage.textContent = 'Error de autenticación. Verifica tus datos.';
            }
            loginMessage.classList.add('text-rose-500');
        }
        return;
    }


    if (userFound) {
        closeAdminModal(); // Cierra el modal al iniciar sesión
        
        // Mostrar botones de administración en el menú
        const adminDropdownLogin = document.getElementById('adminDropdownLogin');
        const adminDropdownLogout = document.getElementById('adminDropdownLogout');
        const adminDropdownManagement = document.getElementById('adminDropdownManagement');
        if (adminDropdownLogin) adminDropdownLogin.classList.add('hidden');
        if (adminDropdownLogout) adminDropdownLogout.classList.remove('hidden');
        if (adminDropdownManagement) adminDropdownManagement.classList.remove('hidden');


        const addFunctionSection = document.getElementById('addFunctionSection');
        const fixErrorSection = document.getElementById('fixErrorSection');
        const adminManagementSection = document.getElementById('adminManagementSection');
        if (addFunctionSection) addFunctionSection.classList.remove('hidden');
        if (fixErrorSection) fixErrorSection.classList.remove('hidden');
        if (adminManagementSection) adminManagementSection.classList.remove('hidden');
        
        displayFunctions(); // Refresca botones de editar/eliminar

        const userDataRef = doc(db, ADMINS_PATH, loggedInUser.uid);
        
        await sendWelcomeMessage(loggedInUser.lastLogin, loggedInUser.username);
        
        await setDoc(userDataRef, { 
            lastLogin: new Date(),
            username: loggedInUser.username,
            uid: loggedInUser.uid,
            isAdmin: true 
        }, { merge: true });

        const welcomeMessageDiv = document.getElementById('welcomeMessage');
        if (welcomeMessageDiv) welcomeMessageDiv.classList.remove('hidden');

        showMessage(`¡Bienvenido, ${loggedInUser.username}! Has iniciado sesión con éxito.`, 'success');
    }
};

const sendWelcomeMessage = async (lastLogin, username) => {
    const welcomeMessageDiv = document.getElementById('welcomeMessage');
    let actionsSummary = '';
    
    if (lastLogin) {
        const logsRef = collection(db, LOGS_PATH);
        const q = query(logsRef, where("user", "==", username));
        try {
            const querySnapshot = await getDocs(q);

            const recentActions = [];
            querySnapshot.forEach(doc => {
                const log = doc.data();
                if (log.timestamp.toDate() > lastLogin.toDate()) {
                    recentActions.push(log);
                }
            });

            if (recentActions.length > 0) {
                const added = recentActions.filter(a => a.action === 'added').map(a => a.functionName).join(', ');
                const edited = recentActions.filter(a => a.action === 'edited').map(a => a.functionName).join(', ');
                const deleted = recentActions.filter(a => a.action === 'deleted').map(a => a.functionName).join(', ');
                actionsSummary = `Resumen de tu actividad: ${added.length > 0 ? `agregaste: ${added}. ` : ''}${edited.length > 0 ? `editaste: ${edited}. ` : ''}${deleted.length > 0 ? `eliminaste: ${deleted}. ` : ''}`;
            }
        } catch (error) {
            console.error("Error al obtener logs:", error);
        }
    }
    
    const diffMs = lastLogin ? new Date() - lastLogin.toDate() : null;
    const diffDays = diffMs ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : null;
    const timeAgo = diffDays !== null ? `${diffDays} día(s)` : 'primera vez';

    if (welcomeMessageDiv) welcomeMessageDiv.textContent = 'Generando mensaje de bienvenida...';

    const apiKey = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const prompt = `Genera un mensaje de bienvenida para un administrador de una base de datos de comandos de SQL. El nombre del usuario es "${username}". Su última sesión fue hace "${timeAgo}". El mensaje debe ser breve, motivador y debe recordarle revisar el panel de logs. Incluye el siguiente resumen de su actividad: "${actionsSummary}". Termina el mensaje con la frase "¡Buen código!".`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Genera un mensaje de bienvenida amigable y motivador." }] },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || `¡Bienvenido de nuevo, ${username}!`;
        if (welcomeMessageDiv) welcomeMessageDiv.textContent = text;
    } catch (error) {
        console.error("Error al generar el mensaje de bienvenida:", error);
        if (welcomeMessageDiv) welcomeMessageDiv.textContent = `¡Bienvenido de nuevo, ${username}! Te recordamos que revises el panel de logs. ¡Buen código!`;
    }
};

const fixSyntaxWithAI = async () => {
    const syntax = document.getElementById('errorInput')?.value.trim();
    const correctionKey = document.getElementById('correctionKey')?.value.trim();
    const resultDiv = document.getElementById('correctionResult');
    const button = document.getElementById('fixButton');

    if (!syntax) {
        if (resultDiv) resultDiv.innerHTML = `<p class="mt-4 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Por favor, ingresa el código SQL a corregir.</p>`;
        return;
    }

    if (correctionKey !== SUPER_ADMIN_KEY) {
        if (resultDiv) resultDiv.innerHTML = `<p class="mt-4 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Clave de Promoción incorrecta. Debes ser administrador para usar esta función.</p>`;
        return;
    }

    if (button) {
        button.textContent = 'Corrigiendo...';
        button.disabled = true;
    }
    if (resultDiv) resultDiv.innerHTML = `<p class="mt-4 text-center p-3 rounded-lg font-medium bg-indigo-200 text-indigo-800">Analizando y corrigiendo sintaxis con IA...</p>`;

    const apiKey = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const prompt = `Eres un experto en optimización y corrección de código SQL. Corrige cualquier error de sintaxis en el siguiente código y, si es posible, ofréceme una versión optimizada. Devuelve SÓLO el código SQL final corregido y optimizado. No uses comentarios ni ninguna explicación. Código SQL: ${syntax}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Corrige y optimiza el código SQL, devolviendo exclusivamente la consulta SQL resultante." }] },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una corrección.';

        const correctedCode = text.replace(/```sql|```/g, '').trim();

        if (resultDiv) {
            resultDiv.innerHTML = `
                <h3 class="text-xl font-bold mt-4 mb-2 text-gray-900">Código Corregido/Optimizado:</h3>
                <div class="bg-emerald-100 p-4 rounded-lg border border-emerald-400 overflow-x-auto">
                    <pre class="whitespace-pre-wrap font-mono text-emerald-800"><code>${correctedCode}</code></pre>
                </div>
            `;
        }

    } catch (error) {
        console.error("Error al corregir con IA:", error);
        if (resultDiv) resultDiv.innerHTML = `<p class="mt-4 text-center text-rose-800 bg-rose-200 p-3 rounded-lg">Error al conectar con la IA para la corrección.</p>`;
    } finally {
        if (button) {
            button.textContent = 'Corregir Sintaxis ✨';
            button.disabled = false;
        }
    }
};

const searchFunctions = (event) => {
    const searchTerm = event.target.value.toLowerCase();
    const filteredFunctions = functionsList.filter(func => 
        (func.name || '').toLowerCase().includes(searchTerm) || 
        (func.description || '').toLowerCase().includes(searchTerm) || 
        (func.syntax || '').toLowerCase().includes(searchTerm)
    );
    displayFunctions(filteredFunctions);
};

// ************************************************************
// ********* FUNCIONES PARA EL MODAL DE ADMINISTRACIÓN *********
// ************************************************************
const showAdminLogin = () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    const loginContainer = document.getElementById('adminLoginContainer');
    const createContainer = document.getElementById('createAdminContainer');
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (createContainer) createContainer.classList.add('hidden');
};

const showAdminManagement = () => {
     const modal = document.getElementById('adminLoginModal');
     if (modal) {
         modal.classList.remove('hidden');
         modal.classList.add('flex');
     }
     const loginContainer = document.getElementById('adminLoginContainer');
     const createContainer = document.getElementById('createAdminContainer');
     if (loginContainer) loginContainer.classList.add('hidden');
     if (createContainer) createContainer.classList.remove('hidden');
};

const closeAdminModal = () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};


document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initFirebase();
    
    // ************************************************************
    // ********* EVENT LISTENERS CORREGIDOS *************************
    // ************************************************************
    const showLoginBtn = document.getElementById('showLoginButton');
    if (showLoginBtn) showLoginBtn.addEventListener('click', showAdminLogin);

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const showAdminManagementButton = document.getElementById('showAdminManagementButton');
    if (showAdminManagementButton) showAdminManagementButton.addEventListener('click', showAdminManagement);

    const closeAdminModalButton = document.getElementById('closeAdminModalButton');
    if (closeAdminModalButton) closeAdminModalButton.addEventListener('click', closeAdminModal);

    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) darkToggle.addEventListener('change', toggleDarkMode);

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', login);

    const addFunctionForm = document.getElementById('addFunctionForm');
    if (addFunctionForm) addFunctionForm.addEventListener('submit', addOrUpdateFunction);

    const validateSyntaxButton = document.getElementById('validateSyntaxButton');
    if (validateSyntaxButton) validateSyntaxButton.addEventListener('click', validateFunctionWithAI);

    const descriptionSearchButton = document.getElementById('descriptionSearchButton');
    if (descriptionSearchButton) descriptionSearchButton.addEventListener('click', generateSQLQuery); // <-- Botón Generador

    const fixBtn = document.getElementById('fixButton');
    if (fixBtn) fixBtn.addEventListener('click', fixSyntaxWithAI);

    const createAdminForm = document.getElementById('createAdminForm');
    if (createAdminForm) createAdminForm.addEventListener('submit', createAdmin);

    const functionSearchInput = document.getElementById('functionSearchInput');
    if (functionSearchInput) functionSearchInput.addEventListener('input', searchFunctions);

    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => handleConfirm(true));

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => handleConfirm(false));

    const resetValidation = () => {
        isSyntaxValid = false;
        const validationDiv = document.getElementById('validationMessage');
        if (validationDiv) validationDiv.innerHTML = '';
        const statusMsg = document.getElementById('statusMessage');
        if (statusMsg) statusMsg.innerHTML = '';
    };
    const funcNameEl = document.getElementById('funcName');
    const funcDescEl = document.getElementById('funcDescription');
    const funcSyntaxEl = document.getElementById('funcSyntax');
    if (funcNameEl) funcNameEl.addEventListener('input', resetValidation);
    if (funcDescEl) funcDescEl.addEventListener('input', resetValidation);
    if (funcSyntaxEl) funcSyntaxEl.addEventListener('input', resetValidation);
});

// =====================================================
// EXPONER FUNCIONES GLOBALES PARA EVENTOS EN EL DOM
// =====================================================
window.generateSQLQuery = generateSQLQuery;
window.login = login;
