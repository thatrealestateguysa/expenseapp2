
// Preloaded backend URL
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwZ2GK6N_0pZHBAk6XdJXRydL-cgtk6HViG2PRwTWtQZqWYkDjxej2HzC2yx3LRo9gpiw/exec";

// Defaults
const DEFAULT_COST_CODES = [
  "Marketing","Travel","Office Supplies","Fuel","Meals & Entertainment",
  "Repairs & Maintenance","Software & Subscriptions","Utilities","Professional Fees",
  "Commissions","Rent","Salaries","Training","Miscellaneous"
];

// Elements
const costCodeSelect = document.getElementById("costCode");
const dateEl = document.getElementById("date");
const descriptionEl = document.getElementById("description");
const amountEl = document.getElementById("amount");
const cameraInput = document.getElementById("cameraInput");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const saveBtn = document.getElementById("saveBtn");
const saveMsg = document.getElementById("saveMsg");
const openSettingsBtn = document.getElementById("openSettings");
const settingsModal = document.getElementById("settingsModal");
const cfgUrl = document.getElementById("cfgUrl");
const cfgCodes = document.getElementById("cfgCodes");
const syncStatus = document.getElementById("syncStatus");

const totalExpensesEl = document.getElementById("totalExpenses");
const totalIncomeEl = document.getElementById("totalIncome");
const netBalanceEl = document.getElementById("netBalance");
const entriesList = document.getElementById("entriesList");

let entryType = "expense";
let chosenFile = null;

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
}

(function init() {  
  // seed URL if not set
  if (!localStorage.getItem("pr.webAppUrl")) {
    localStorage.setItem("pr.webAppUrl", DEFAULT_WEB_APP_URL);
  }

  // Date → today
  const t = new Date();
  const yyyy = t.getFullYear(), mm = String(t.getMonth()+1).padStart(2,"0"), dd = String(t.getDate()).padStart(2,"0");
  dateEl.value = `${yyyy}-${mm}-${dd}`;

  // Load settings
  const url = localStorage.getItem("pr.webAppUrl") || DEFAULT_WEB_APP_URL;
  const codes = JSON.parse(localStorage.getItem("pr.costCodes") || "[]");
  cfgUrl.value = url;
  cfgCodes.value = (codes.length ? codes : DEFAULT_COST_CODES).join(", ");
  applyCostCodes(codes.length ? codes : DEFAULT_COST_CODES);
  updateSyncStatus();

  // Toggle tabs
  document.getElementById("tabExpense").addEventListener("click", () => setType("expense"));
  document.getElementById("tabIncome").addEventListener("click", () => setType("income"));

  // Photo / upload
  document.getElementById("btnCamera").addEventListener("click", ()=> cameraInput.click());
  document.getElementById("btnUpload").addEventListener("click", ()=> fileInput.click());
  cameraInput.addEventListener("change", onPickFile);
  fileInput.addEventListener("change", onPickFile);

  // Settings
  openSettingsBtn.addEventListener("click", () => settingsModal.showModal());
  document.getElementById("saveSettings").addEventListener("click", (e) => {e.preventDefault();
    localStorage.setItem("pr.webAppUrl", cfgUrl.value.trim());
    const list = cfgCodes.value.split(",").map(s=>s.trim()).filter(Boolean);
    localStorage.setItem("pr.costCodes", JSON.stringify(list));
    applyCostCodes(list);
    settingsModal.close();
    updateSyncStatus();
  });

  // Render cache
  renderFromCache();
})();

function setType(type){
  entryType = type;
  document.getElementById("tabExpense").classList.toggle("active", type==="expense");
  document.getElementById("tabIncome").classList.toggle("active", type==="income");
}

function applyCostCodes(list){
  costCodeSelect.innerHTML = `<option disabled selected value="">Select a category</option>` + list.map(c=>`<option value="${c}">${c}</option>`).join("");
}

function updateSyncStatus(){
  const url = localStorage.getItem("pr.webAppUrl");
  if (url) { syncStatus.textContent = "Syncing to Google Sheets"; syncStatus.className = "status status-connected"; }
  else { syncStatus.textContent = "Not connected"; syncStatus.className = "status status-disconnected"; }
}

function onPickFile(ev){
  const f = ev.target.files[0];
  if (!f) return;
  chosenFile = f;
  const reader = new FileReader();
  reader.onload = () => { preview.innerHTML = `<img src="${reader.result}" alt="receipt preview" />`; };
  reader.readAsDataURL(f);
}

document.getElementById("entryForm").addEventListener("submit", async (ev) => {
  ev.preventDefault(); saveMsg.textContent = ""; saveBtn.disabled = true;
  try {
    const payload = await buildPayload();
    const url = localStorage.getItem("pr.webAppUrl") || DEFAULT_WEB_APP_URL;

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "record", data: payload }) });
    if (!res.ok) throw new Error("Network error: " + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Server error");

    const entry = {...payload, receiptUrl: json.receiptUrl, id: json.rowNumber || Date.now()};
    addToCache(entry); renderFromCache(); clearForm();
    saveMsg.textContent = "Saved ✓"; saveMsg.style.color = "#059669";
  } catch (err) {
    console.error(err); saveMsg.textContent = err.message; saveMsg.style.color = "#b91c1c";
  } finally { saveBtn.disabled = false; }
});

async function buildPayload(){
  const date = dateEl.value;
  const description = (descriptionEl.value || "").trim();
  const costCode = costCodeSelect.value;
  const amount = parseFloat(amountEl.value);
  if (!date || !description || !costCode || isNaN(amount)) throw new Error("Please fill in all fields.");

  let receipt = null;
  if (chosenFile) {
    const dataUrl = await fileToDataUrl(chosenFile);
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.split(":")[1].split(";")[0];
    receipt = { name: sanitizeFileName(`${date}-${description}`) + extForMime(mime), mimeType: mime, dataBase64: b64 };
  }
  return { type: entryType, date, description, costCode, amount, receipt };
}

function sanitizeFileName(s){ return s.replace(/[^a-z0-9\-_.]+/gi,"_").slice(0,80) || "receipt"; }
function extForMime(m){ if (m==="image/png") return ".png"; if (m==="image/webp") return ".webp"; if (m==="image/gif") return ".gif"; return ".jpg"; }
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }

function addToCache(item){ const list = JSON.parse(localStorage.getItem("pr.entries") || "[]"); list.unshift(item); localStorage.setItem("pr.entries", JSON.stringify(list.slice(0,200))); }

function renderFromCache(){
  const list = JSON.parse(localStorage.getItem("pr.entries") || "[]");
  let income = 0, expenses = 0;
  list.forEach(e => { if (e.type === "income") income += Number(e.amount||0); else expenses += Number(e.amount||0); });
  totalIncomeEl.textContent = formatMoney(income);
  totalExpensesEl.textContent = formatMoney(expenses);
  netBalanceEl.textContent = formatMoney(income - expenses);

  if (!list.length){ entriesList.classList.add("empty"); entriesList.innerHTML = `<div class="empty-state"><div class="icon">📄</div><div>No entries yet. Add your first transaction above.</div></div>`; return; }
  entriesList.classList.remove("empty");
  entriesList.innerHTML = list.map(e => {
    const cls = e.type === "income" ? "income" : "expense";
    const link = e.receiptUrl ? `<a href="${e.receiptUrl}" target="_blank" rel="noopener">Receipt</a>` : `<span class="meta">No receipt</span>`;
    return `<div class="entry">
      <div>
        <div><strong>${escapeHTML(e.description)}</strong></div>
        <div class="meta">${e.date} • ${escapeHTML(e.costCode)} • ${e.type}</div>
      </div>
      <div class="amount ${cls}">${formatMoney(e.amount)}</div>
      <div>${link}</div>
    </div>`;
  }).join("");
}

function clearForm(){ descriptionEl.value=""; amountEl.value=""; costCodeSelect.value=""; chosenFile=null; preview.innerHTML=""; }

function formatMoney(n){ try { return new Intl.NumberFormat("en-ZA", { style:"currency", currency:"ZAR" }).format(n); } catch(_){ return "R" + (Number(n).toFixed(2)); } }
function escapeHTML(s){ return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
