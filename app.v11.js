
// PR Expenses v11 — robust codes + add-code + bootstrap assist
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby5-P-a9w3GxKBAbXqUaO62vc_n1LD0s1dJMRyx3BOSFT6plKCHUR4yHefuAuWVY93T1g/exec";
const FALLBACK_CODES = {
  expense: ["Marketing","Travel","Office Supplies","Fuel","Meals & Entertainment","Repairs & Maintenance","Software & Subscriptions","Utilities","Professional Fees","Commissions","Rent","Salaries","Training","Miscellaneous"],
  income:  ["Commission","Referral Fee","Consulting Income","Rental Income","Other Income"]
};

const S = id => document.getElementById(id);
const costCodeSelect=S("costCode"), dateEl=S("date"), descriptionEl=S("description"), amountEl=S("amount");
const cameraInput=S("cameraInput"), fileInput=S("fileInput"), preview=S("preview");
const saveBtn=S("saveBtn"), saveMsg=S("saveMsg"), syncStatus=S("syncStatus");
const entriesList=S("entriesList"), totalIncomeEl=S("totalIncome"), totalExpensesEl=S("totalExpenses"), netBalanceEl=S("netBalance");
const cfgUrl=S("cfgUrl"), settingsModal=S("settingsModal"), dbg=S("dbg"), addCodeBtn=S("addCodeBtn");

let entryType="expense", chosenFile=null, codes={...FALLBACK_CODES};

function logDbg(...args){ console.log(...args); if(!dbg)return; dbg.style.display='block'; dbg.textContent=args.map(a=>typeof a==='string'?a:JSON.stringify(a)).join(' | '); }

const skipSW = new URLSearchParams(location.search).has("nosw");
if ("serviceWorker" in navigator && !skipSW) addEventListener("load", () => navigator.serviceWorker.register("sw.v11.js").catch(console.warn));

(async function init(){
  try {
    const t=new Date(); dateEl.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    if(!localStorage.getItem("pr.webAppUrl")) localStorage.setItem("pr.webAppUrl", DEFAULT_WEB_APP_URL);
    cfgUrl.value = localStorage.getItem("pr.webAppUrl") || DEFAULT_WEB_APP_URL;

    S("tabExpense").onclick = () => { setType("expense"); populateCodes("expense"); };
    S("tabIncome").onclick  = () => { setType("income");  populateCodes("income");  };
    addCodeBtn.onclick      = onAddCode;
    S("btnCamera").onclick  = () => cameraInput.click();
    S("btnUpload").onclick  = () => fileInput.click();
    cameraInput.onchange    = onPickFile;
    fileInput.onchange      = onPickFile;

    S("openSettings").onclick = () => settingsModal.showModal();
    S("saveSettings").onclick = (e) => { e.preventDefault(); localStorage.setItem("pr.webAppUrl", cfgUrl.value.trim()); settingsModal.close(); healthCheck(true); };

    S("entryForm").addEventListener("submit", onSubmit);
    S("checkBtn").onclick = () => healthCheck(true);

    await loadCodes();
    populateCodes(entryType);
    renderFromCache();
    await healthCheck(false);
  } catch (err) {
    logDbg("Init error:", err.message);
    syncStatus.textContent='Init error. Try #reset.';
    syncStatus.className='status status-bad';
  }
})();

async function loadCodes(){
  const url = localStorage.getItem("pr.webAppUrl") || DEFAULT_WEB_APP_URL;
  try {
    let res = await fetch(url+"?action=codes", {cache:"no-store",mode:"cors"});
    if (!res.ok) throw new Error("codes "+res.status);
    let js = await res.json();
    if (!(js && js.ok && js.codes)) throw new Error("codes format");
    codes = { expense: js.codes.expense||[], income: js.codes.income||[] };
    localStorage.setItem("pr.codes", JSON.stringify(codes));
  } catch (e) {
    try {
      const boot = await fetch(url+"?action=bootstrap", {cache:"no-store"});
      if (boot.ok) {
        const r2 = await fetch(url+"?action=codes", {cache:"no-store"});
        if (r2.ok) { const j2 = await r2.json(); if (j2 && j2.ok && j2.codes) codes = j2.codes; }
      }
    } catch (_) {}
    const cached = localStorage.getItem("pr.codes");
    if (cached) { try { codes = JSON.parse(cached); } catch (_){ codes = {...FALLBACK_CODES}; } }
  }
}
function populateCodes(type){
  const list=(codes[type]||[]).slice().sort();
  costCodeSelect.innerHTML = `<option disabled selected value="">Select a category</option>` + list.map(c=>`<option value="${c.replace(/\"/g,'&quot;')}">${c.replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}</option>`).join("");
}
async function onAddCode(){
  const url = localStorage.getItem("pr.webAppUrl") || DEFAULT_WEB_APP_URL;
  const label = entryType === "income" ? "New income code" : "New expense code";
  const val = (prompt(label + ":") || "").trim();
  if (!val) return;
  if (!codes[entryType].some(c=>c.toLowerCase()===val.toLowerCase())) codes[entryType].push(val);
  populateCodes(entryType); costCodeSelect.value = val; localStorage.setItem("pr.codes", JSON.stringify(codes));
  try {
    const body = "payload=" + encodeURIComponent(JSON.stringify({ action:"addCode", type:entryType, code:val }));
    const res  = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" }, body, cache:"no-store" });
    if (res.ok) { const js = await res.json(); if (js && js.ok && js.codes) { codes = js.codes; localStorage.setItem("pr.codes", JSON.stringify(codes)); populateCodes(entryType); costCodeSelect.value = val; } }
  } catch(err) { logDbg("addCode failed", err.message||err); }
}

async function healthCheck(alsoReloadCodes){
  syncStatus.textContent="Checking connection…"; syncStatus.className="status";
  const url = localStorage.getItem("pr.webAppUrl") || DEFAULT_WEB_APP_URL;
  try{
    const res = await fetch(url+"?action=summary", {cache:"no-store"});
    if (res.ok) { const js=await res.json(); if (js && typeof js.income==='number') { totalIncomeEl.textContent=money(js.income||0); totalExpensesEl.textContent=money(js.expenses||0); netBalanceEl.textContent=money(js.net||0); } }
    if (alsoReloadCodes) await loadCodes();
    syncStatus.textContent="Syncing to Google Sheets"; syncStatus.className="status status-ok";
  }catch(err){
    syncStatus.textContent="Cannot reach backend. Check deploy & permissions."; syncStatus.className="status status-bad";
  }
}

function setType(t){ entryType=t; S("tabExpense").classList.toggle("active",t==="expense"); S("tabIncome").classList.toggle("active",t==="income"); }
function onPickFile(ev){ const f=ev.target.files[0]; if(!f)return; chosenFile=f; const r=new FileReader(); r.onload=()=>{ preview.innerHTML=`<img src="${r.result}" alt="receipt" />`; }; r.readAsDataURL(f); }
async function onSubmit(ev){
  ev.preventDefault(); saveMsg.textContent=""; saveBtn.disabled=true;
  try{
    const payload=await buildPayload();
    const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;
    const body="payload="+encodeURIComponent(JSON.stringify({ action:"record", data:payload }));
    const res=await fetch(url,{ method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body, cache:"no-store" });
    if(!res.ok) throw new Error("Network error: "+res.status);
    const json=await res.json(); if(!json.ok) throw new Error(json.error||"Server error");
    const entry={...payload, receiptUrl: json.receiptUrl, id: json.rowNumber || Date.now()};
    addToCache(entry); renderFromCache(); clearForm(); saveMsg.textContent="Saved ✓"; saveMsg.style.color="#059669";
  }catch(err){
    saveMsg.textContent = err.message || "Load failed";
    saveMsg.style.color = "#b91c1c";
    logDbg("Save error", err.message||err);
  }finally{ saveBtn.disabled=false; }
}
async function buildPayload(){
  const date=dateEl.value, description=(descriptionEl.value||"").trim(), costCode=costCodeSelect.value, amount=parseFloat(amountEl.value);
  if(!date||!description||!costCode||isNaN(amount)) throw new Error("Please fill in all fields.");
  let receipt=null;
  if(chosenFile){
    const dataUrl=await downscaleToJpegDataUrl(chosenFile,1600,0.85);
    const [meta,b64]=dataUrl.split(","), mime=meta.split(":")[1].split(";")[0];
    receipt={ name: (date+"-"+description).replace(/[^a-z0-9\\-_.]+/gi,"_").slice(0,80)+".jpg", mimeType:mime, dataBase64:b64 };
  }
  return { type:entryType, date, description, costCode, amount, receipt };
}

function addToCache(item){ const list=JSON.parse(localStorage.getItem("pr.entries")||"[]"); list.unshift(item); localStorage.setItem("pr.entries", JSON.stringify(list.slice(0,200))); }
function renderFromCache(){
  const list=JSON.parse(localStorage.getItem("pr.entries")||"[]");
  let income=0,expenses=0; list.forEach(e=>{ if(e.type==="income") income+=Number(e.amount||0); else expenses+=Number(e.amount||0); });
  totalIncomeEl.textContent=money(income);
  totalExpensesEl.textContent=money(expenses);
  netBalanceEl.textContent=money(income-expenses);
  if(!list.length){
    entriesList.classList.add("empty");
    entriesList.innerHTML=`<div class="empty-state"><div class="icon">📄</div><div>No entries yet. Add your first transaction above.</div></div>`;
    return;
  }
  entriesList.classList.remove("empty");
  entriesList.innerHTML=list.map(e=>{
    const cls=e.type==="income"?"income":"expense";
    const link=e.receiptUrl?`<a href="${e.receiptUrl}" target="_blank" rel="noopener">Receipt</a>`:`<span class="meta">No receipt</span>`;
    return `<div class="entry"><div><div><strong>${escapeHTML(e.description)}</strong></div><div class="meta">${e.date} • ${escapeHTML(e.costCode)} • ${e.type}</div></div><div class="amount ${cls}">${money(e.amount)}</div><div>${link}</div></div>`;
  }).join("");
}
function clearForm(){ descriptionEl.value=''; amountEl.value=''; costCodeSelect.value=''; chosenFile=null; preview.innerHTML=''; }
function money(n){ try{ return new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(n); }catch(_){ return "R"+Number(n).toFixed(2); } }
function escapeHTML(s){ return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function downscaleToJpegDataUrl(file,maxDim=1600,quality=0.85){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(Math.max(w,h)>maxDim){ const ratio=maxDim/Math.max(w,h); w=Math.round(w*ratio); h=Math.round(h*ratio); }
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        resolve(c.toDataURL("image/jpeg",quality));
      };
      img.onerror=reject; img.src=r.result;
    };
    r.onerror=reject; r.readAsDataURL(file);
  });
}

window.addEventListener("error",(e)=>logDbg("JS error:", e.message));
