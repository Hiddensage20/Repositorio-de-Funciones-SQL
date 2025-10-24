// -------------- imports (firebase) --------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
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
  getDoc,
  setDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ========== config ==========
const firebaseConfig = {
  apiKey: "AIzaSyCeD4TAPK2GuW01J5WQl7vJjmJWC671f-Y",
  authDomain: "codigograbado.firebaseapp.com",
  projectId: "codigograbado",
  storageBucket: "codigograbado.firebasestorage.app",
  messagingSenderId: "346430888474",
  appId: "1:346430888474:web:cbaa641fbf4fc62bca4fa3",
  measurementId: "G-626THBS8CJ"
};
const GEMINI_API_KEY = "AIzaSyBUjsv2ZW2vRjLuD2pAwVtgurMdTkXCO4Q";

const SUPER_ADMIN_KEY = "DT10VazC;#9i";
const DB_ROOT = `/artifacts/public/data/aTvZxvxzBtCnCNlURVrQ`;
const FUNCTIONS_PATH = `${DB_ROOT}/sql_functions`;
const ADMINS_PATH = `${DB_ROOT}/admins`;
const LOGS_PATH = `${DB_ROOT}/logs`;

// ========== global state ==========
let db, auth, userId, loggedInUser = null, functionsList = [], editingId = null, isSyntaxValid = false;

// ========== utils ==========
const el = (id)=> document.getElementById(id);
const show = (id)=> el(id)?.classList.remove('hidden');
const hide = (id)=> el(id)?.classList.add('hidden');

const showMessage = (targetId, text, type='info')=>{
  const tgt = el(targetId);
  if(!tgt) return;
  let color = 'bg-indigo-200 text-indigo-800';
  if(type==='error') color='bg-rose-200 text-rose-800';
  if(type==='success') color='bg-emerald-200 text-emerald-800';
  tgt.innerHTML = `<div class="p-3 rounded ${color}">${text}</div>`;
};

// ========== theme ==========
const initializeTheme = ()=>{
  const isDark = localStorage.getItem('darkMode') === 'true';
  if(isDark) document.body.classList.add('dark');
  el('darkModeToggle').checked = !!isDark;
  el('darkModeToggle').addEventListener('change', ()=>{
    const now = el('darkModeToggle').checked;
    localStorage.setItem('darkMode', now);
    document.body.classList.toggle('dark', now);
  });
};

// ========== firebase init ==========
async function initFirebase(){
  try{
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    await signInAnonymously(auth);
    userId = auth.currentUser?.uid;
    console.log('Firebase OK, uid=', userId);
    watchFunctions();
  }catch(e){ 
    console.error('FB init error', e); 
    showMessage('recommendationResults','Error inicializando Firebase: '+e.message,'error'); 
  }
}

// ========== firestore sync ==========
function watchFunctions(){
  if(!db) return;
  const q = collection(db, FUNCTIONS_PATH);
  onSnapshot(q, snapshot=>{
    functionsList = snapshot.docs.map(d=>({ id:d.id, ...d.data() }));
    renderFunctions();
  }, err=>{
    console.error('listen err', err);
    showMessage('recommendationResults','No se pudo cargar comandos','error');
  });
}

function renderFunctions(){
  const out = el('functionsList');
  if(!out) return;
  out.innerHTML = '';
  if(!functionsList.length) { out.innerHTML = '<p class="text-gray-500">No hay comandos.</p>'; return; }
  functionsList.forEach(f=>{
    const card = document.createElement('div');
    card.className = 'mb-4 p-3 border rounded';
    card.innerHTML = `<h4 class="font-bold">${f.name}</h4>
      <p class="text-sm">${f.description||''}</p>
      <pre class="mt-2 p-2 bg-gray-50 rounded text-sm">${(f.syntax||'').replace(/</g,'&lt;')}</pre>
      <div class="mt-2"><button class="edit inline-block mr-2 px-3 py-1 bg-purple-600 text-white rounded">Editar</button><button class="del inline-block px-3 py-1 bg-rose-600 text-white rounded">Eliminar</button></div>`;
    out.appendChild(card);
    const editBtn = card.querySelector('.edit');
    const delBtn = card.querySelector('.del');
    editBtn?.addEventListener('click', ()=> {
      el('funcName').value = f.name||'';
      el('funcDescription').value = f.description||'';
      el('funcSyntax').value = f.syntax||'';
      editingId = f.id;
      show('addFunctionSection');
      window.scrollTo({top:0,behavior:'smooth'});
    });
    delBtn?.addEventListener('click', async ()=>{
  if (!loggedInUser) {
    alert('⚠️ Debes iniciar sesión como administrador para eliminar comandos.');
    return;
  }
  if (!confirm('¿Seguro que deseas eliminar este comando?')) return;
  try {
    await deleteDoc(doc(db, FUNCTIONS_PATH, f.id));
    alert('Comando eliminado con éxito.');
  } catch (e) {
    alert('Error eliminando: ' + e.message);
  }
});
}

// ========== GENERAR CONSULTA (Gemini) ==========
async function generateSQLQuery(){
  const description = el('descriptionSearch')?.value.trim();
  if(!description){ showMessage('recommendationResults','Describe la necesidad primero','error'); return; }
  const btn = el('descriptionSearchButton'); btn.disabled = true; btn.textContent = 'Generando...';
  const resultsDiv = el('recommendationResults'); if(resultsDiv) resultsDiv.innerHTML = '';
  try{
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Eres un experto en SQL. Genera SOLO la consulta SQL basándote en: "${description}". Sólo devuelve código SQL.`;
    const payload = { contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: "Solo devuelve código SQL." }] } };
    const r = await fetch(apiUrl, { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(!r.ok) throw new Error('API status '+r.status);
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const sql = text.replace(/```sql|```/g,'').trim();
    if(resultsDiv) resultsDiv.innerHTML = `<h4 class="font-bold">Consulta generada</h4><pre class="mt-2 p-3 bg-indigo-50 rounded">${(sql||'').replace(/</g,'&lt;')}</pre>`;
  }catch(e){
    console.error('gen err', e);
    if(resultsDiv) resultsDiv.innerHTML = `<p class="text-rose-600">Error generando: ${e.message}</p>`;
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = 'Generar Consulta SQL ✨'; }
  }
}

// ========== LOGIN ==========
async function login(e){
  if(e && e.preventDefault) e.preventDefault();
  const email = el('adminEmail')?.value?.trim();
  const pass = el('adminPassword')?.value;
  const msg = el('loginMessage'); if(msg) msg.textContent = '';
  try{
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    loggedInUser = { uid, username: email.split('@')[0] };
    ['addFunctionSection','fixErrorSection','adminManagementSection'].forEach(show);
    hide('adminLoginModal');
    el('adminEmail').value = ''; el('adminPassword').value='';
    alert('Login OK como '+loggedInUser.username);
  }catch(err){
    console.error('login err', err);
    if(msg) msg.textContent = 'Credenciales incorrectas o error.';
  }
}

// ========== ADD / UPDATE FUNCTION ==========
async function addOrUpdateFunction(e){ 
  e.preventDefault();
  if(!loggedInUser){ alert('Inicia sesión primero'); return; }
  const name = el('funcName')?.value.trim(), description = el('funcDescription')?.value.trim(), syntax = el('funcSyntax')?.value.trim();
  if(!name||!description||!syntax){ alert('Completa campos'); return; }
  try{
    if(editingId){
      await updateDoc(doc(db, FUNCTIONS_PATH, editingId), { name, description, syntax });
      editingId = null;
      alert('Actualizado');
    } else {
      await addDoc(collection(db, FUNCTIONS_PATH), { name, description, syntax, createdAt: new Date() });
      alert('Agregado');
    }
    el('addFunctionForm').reset();
  }catch(e){ alert('Error: '+e.message); }
}

// ========== CREAR ADMIN ==========
async function createAdmin(e){
  e.preventDefault();
  const email = el('newAdminEmail')?.value.trim();
  const pass = el('newAdminPassword')?.value;
  const username = el('newAdminUsername')?.value.trim();
  if(!email||!pass||!username){ el('adminMessage').textContent = 'Completa todos los campos'; return; }
  try{
    const uc = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, ADMINS_PATH, uc.user.uid), { uid: uc.user.uid, username, email, isAdmin:true, lastLogin:null });
    el('adminMessage').textContent = 'Admin creado';
    el('createAdminForm').reset();
  }catch(err){ el('adminMessage').textContent = 'Err: '+(err.code||err.message); }
}

// ========== FIX SQL (IA) ==========
async function fixSyntaxWithAI(){
  const syntax = el('errorInput')?.value?.trim();
  const key = el('correctionKey')?.value?.trim();
  const out = el('correctionResult');
  if(!syntax){ if(out) out.innerHTML = 'Ingresa SQL'; return; }
  if(key && key !== SUPER_ADMIN_KEY){ if(out) out.innerHTML = 'Clave incorrecta'; return; }
  try{
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Corrige y optimiza este SQL, devuelve solo el código: ${syntax}`;
    const payload = { contents:[{ parts:[{ text: prompt }] }], systemInstruction:{ parts:[{ text: "Devuelve solo SQL" }] } };
    const r = await fetch(apiUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const corrected = txt.replace(/```sql|```/g,'').trim();
    if(out) out.innerHTML = `<pre class="p-2 bg-emerald-50 rounded">${(corrected||'').replace(/</g,'&lt;')}</pre>`;
  }catch(e){ if(out) out.innerHTML = 'Error IA: '+e.message; }
}

// ========== DOM READY ==========
document.addEventListener('DOMContentLoaded', ()=>{
  initializeTheme();
  initFirebase();

  el('descriptionSearchButton')?.addEventListener('click', generateSQLQuery);
  el('adminDropdown')?.addEventListener('click', ()=> el('adminLoginModal').classList.toggle('hidden'));
  el('closeAdminModalButton')?.addEventListener('click', ()=> el('adminLoginModal').classList.add('hidden'));
  el('loginForm')?.addEventListener('submit', login);
  el('addFunctionForm')?.addEventListener('submit', addOrUpdateFunction);
  el('createAdminForm')?.addEventListener('submit', createAdmin);
  el('fixButton')?.addEventListener('click', fixSyntaxWithAI);
  el('searchInput')?.addEventListener('input', (e)=> {
    const term = e.target.value.toLowerCase();
    const filtered = functionsList.filter(f => ((f.name||'')+(f.description||'')+(f.syntax||'')).toLowerCase().includes(term));
    renderFunctions(filtered);
  });

  // expose globally
  window.generateSQLQuery = generateSQLQuery;
  window.login = login;
  window.fixSyntaxWithAI = fixSyntaxWithAI;

  console.log('App JS listo');
});
