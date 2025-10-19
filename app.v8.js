
// PR Expenses v8
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzzWjOyYTOEpKRvwq3i_ILkGAxz3V5dmGIUWkvQRkUVVbTiYAvCBJfqlUwNhT6MjTWp5A/exec";
const DEFAULT_COST_CODES = ["Marketing","Travel","Office Supplies","Fuel","Meals & Entertainment","Repairs & Maintenance","Software & Subscriptions","Utilities","Professional Fees","Commissions","Rent","Salaries","Training","Miscellaneous"];

const S = id => document.getElementById(id);
const costCodeSelect=S("costCode"), dateEl=S("date"), descriptionEl=S("description"), amountEl=S("amount");
const cameraInput=S("cameraInput"), fileInput=S("fileInput"), preview=S("preview");
const saveBtn=S("saveBtn"), saveMsg=S("saveMsg"), syncStatus=S("syncStatus");
const entriesList=S("entriesList"), totalIncomeEl=S("totalIncome"), totalExpensesEl=S("totalExpenses"), netBalanceEl=S("netBalance");
const cfgUrl=S("cfgUrl"), cfgCodes=S("cfgCodes"), settingsModal=S("settingsModal"), dbg=S("dbg");

let entryType="expense", chosenFile=null;

function logDbg(...args){ console.log(...args); if(!dbg)return; dbg.style.display='block'; dbg.textContent=args.map(a=>typeof a==='string'?a:JSON.stringify(a)).join(' | '); }

const skipSW = new URLSearchParams(location.search).has("nosw");
if ("serviceWorker" in navigator && !skipSW) { addEventListener("load", () => navigator.serviceWorker.register("sw.v8.js").catch(console.warn)); }

(async function init(){
  try {
    const t=new Date(); dateEl.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    if(!localStorage.getItem("pr.webAppUrl")) localStorage.setItem("pr.webAppUrl", DEFAULT_WEB_APP_URL);
    const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;
    const codes=JSON.parse(localStorage.getItem("pr.costCodes")||"[]");
    cfgUrl.value=url; cfgCodes.value=(codes.length?codes:DEFAULT_COST_CODES).join(", "); applyCostCodes(codes.length?codes:DEFAULT_COST_CODES);

    S("tabExpense").onclick=()=>setType("expense");
    S("tabIncome").onclick=()=>setType("income");
    S("btnCamera").onclick=()=>cameraInput.click();
    S("btnUpload").onclick=()=>fileInput.click();
    cameraInput.onchange=onPickFile; fileInput.onchange=onPickFile;

    S("openSettings").onclick=()=>settingsModal.showModal();
    S("saveSettings").onclick=(e)=>{ e.preventDefault();
      localStorage.setItem("pr.webAppUrl", cfgUrl.value.trim());
      const list=cfgCodes.value.split(",").map(s=>s.trim()).filter(Boolean);
      localStorage.setItem("pr.costCodes", JSON.stringify(list)); applyCostCodes(list); settingsModal.close(); healthCheck();
    };

    S("entryForm").addEventListener("submit", onSubmit);
    S("checkBtn").onclick = healthCheck;

    renderFromCache();
    await healthCheck();
  } catch (err) {
    logDbg("Boot error", err.message);
    syncStatus.textContent='Init error. Open with #reset to clear cache.';
    syncStatus.className='status status-bad';
  }
})();

async function healthCheck(){
  syncStatus.textContent="Checking connection…"; syncStatus.className="status";
  const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;
  try{
    const res=await fetch(url+"?action=summary",{method:"GET",cache:"no-store"});
    if(!res.ok){ syncStatus.textContent=`Backend error ${res.status}`; syncStatus.className="status status-bad"; return; }
    const js=await res.json();
    syncStatus.textContent="Syncing to Google Sheets"; syncStatus.className="status status-ok";
    if(js && typeof js.income==='number'){ totalIncomeEl.textContent=money(js.income||0); totalExpensesEl.textContent=money(js.expenses||0); netBalanceEl.textContent=money(js.net||0); }
  }catch(err){
    syncStatus.textContent="Cannot reach backend (permissions). Ensure 'Anyone' + 'Execute as Me'."; 
    syncStatus.className="status status-bad";
  }
}

function setType(t){ entryType=t; S("tabExpense").classList.toggle("active",t==="expense"); S("tabIncome").classList.toggle("active",t==="income"); }
function applyCostCodes(list){ costCodeSelect.innerHTML=`<option disabled selected value="">Select a category</option>`+list.map(c=>`<option value="${c}">${c}</option>`).join(""); }
function onPickFile(ev){ const f=ev.target.files[0]; if(!f)return; chosenFile=f; const r=new FileReader(); r.onload=()=>{ preview.innerHTML=`<img src="${r.result}" alt="receipt" />`; }; r.readAsDataURL(f); }

async function onSubmit(ev){
  ev.preventDefault(); saveMsg.textContent=""; saveBtn.disabled=true;
  try{
    const payload=await buildPayload();
    const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;
    const body="payload="+encodeURIComponent(JSON.stringify({action:"record",data:payload}));
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body,cache:"no-store"});
    logDbg("POST status", res.status);
    if(!res.ok) throw new Error("Network error: "+res.status);
    const json=await res.json();
    if(!json.ok) throw new Error(json.error||"Server error");
    const entry={...payload, receiptUrl: json.receiptUrl, id: json.rowNumber || Date.now()};
    addToCache(entry); renderFromCache(); clearForm(); saveMsg.textContent="Saved ✓"; saveMsg.style.color="#059669";
  }catch(err){
    saveMsg.textContent=(err && err.message) ? err.message : "Load failed"; saveMsg.style.color="#b91c1c"; logDbg("Save error", err.message || err);
  }finally{ saveBtn.disabled=false; }
}

async function buildPayload(){
  const date=dateEl.value, description=(descriptionEl.value||"").trim(), costCode=costCodeSelect.value, amount=parseFloat(amountEl.value);
  if(!date||!description||!costCode||isNaN(amount)) throw new Error("Please fill in all fields.");
  let receipt=null;
  if(chosenFile){ const dataUrl=await downscaleToJpegDataUrl(chosenFile,1600,0.85);
    const [meta,b64]=dataUrl.split(","), mime=meta.split(":")[1].split(";")[0];
    receipt={name:sanitize(`${date}-${description}`)+".jpg",mimeType:mime,dataBase64:b64}; }
  return {type:entryType,date,description,costCode,amount,receipt};
}

function sanitize(s){return s.replace(/[^a-z0-9\-_.]+/gi,"_").slice(0,80)||"receipt";}
function addToCache(item){const list=JSON.parse(localStorage.getItem("pr.entries")||"[]");list.unshift(item);localStorage.setItem("pr.entries",JSON.stringify(list.slice(0,200)));}
function renderFromCache(){const list=JSON.parse(localStorage.getItem("pr.entries")||"[]");let income=0,expenses=0;list.forEach(e=>{if(e.type==="income")income+=Number(e.amount||0);else expenses+=Number(e.amount||0);});totalIncomeEl.textContent=money(income);totalExpensesEl.textContent=money(expenses);netBalanceEl.textContent=money(income-expenses);if(!list.length){entriesList.classList.add("empty");entriesList.innerHTML=`<div class="empty-state"><div class="icon">📄</div><div>No entries yet. Add your first transaction above.</div></div>`;return;}entriesList.classList.remove("empty");entriesList.innerHTML=list.map(e=>{const cls=e.type==="income"?"income":"expense";const link=e.receiptUrl?`<a href="${e.receiptUrl}" target="_blank" rel="noopener">Receipt</a>`:`<span class="meta">No receipt</span>`;return `<div class="entry"><div><div><strong>${esc(e.description)}</strong></div><div class="meta">${e.date} • ${esc(e.costCode)} • ${e.type}</div></div><div class="amount ${cls}">${money(e.amount)}</div><div>${link}</div></div>`;}).join("");}
function clearForm(){descriptionEl.value="";amountEl.value="";costCodeSelect.value="";chosenFile=null;preview.innerHTML="";}
function money(n){try{return new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(n);}catch(_){return "R"+Number(n).toFixed(2);}}
function esc(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',\"'\":'&#39;','\"':'&quot;'}[c]));}

function downscaleToJpegDataUrl(file, maxDim=1600, quality=0.85){
  return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ let w=img.width,h=img.height; if(Math.max(w,h)>maxDim){const ratio=maxDim/Math.max(w,h); w=Math.round(w*ratio); h=Math.round(h*ratio);} const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h); resolve(c.toDataURL("image/jpeg", quality)); }; img.onerror=reject; img.src=r.result; }; r.onerror=reject; r.readAsDataURL(file); });
}

window.addEventListener("error", (e)=> logDbg("JS error:", e.message));
