
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbywqKzddWQA0-pMqlmKhAkeBHE7K7RAUFiwSCJ9VaNF-103MbBJ9XhT_AjKbj8XqQ5_/exec";
const DEFAULT_COST_CODES = ["Marketing","Travel","Office Supplies","Fuel","Meals & Entertainment","Repairs & Maintenance","Software & Subscriptions","Utilities","Professional Fees","Commissions","Rent","Salaries","Training","Miscellaneous"];

const costCodeSelect=document.getElementById("costCode");
const dateEl=document.getElementById("date");
const descriptionEl=document.getElementById("description");
const amountEl=document.getElementById("amount");
const cameraInput=document.getElementById("cameraInput");
const fileInput=document.getElementById("fileInput");
const preview=document.getElementById("preview");
const saveBtn=document.getElementById("saveBtn");
const saveMsg=document.getElementById("saveMsg");
const openSettingsBtn=document.getElementById("openSettings");
const settingsModal=document.getElementById("settingsModal");
const cfgUrl=document.getElementById("cfgUrl");
const cfgCodes=document.getElementById("cfgCodes");
const syncStatus=document.getElementById("syncStatus");
const totalExpensesEl=document.getElementById("totalExpenses");
const totalIncomeEl=document.getElementById("totalIncome");
const netBalanceEl=document.getElementById("netBalance");
const entriesList=document.getElementById("entriesList");

let entryType="expense";
let chosenFile=null;

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(console.warn));}

(async function init(){
  if(!localStorage.getItem("pr.webAppUrl")) localStorage.setItem("pr.webAppUrl", DEFAULT_WEB_APP_URL);
  const t=new Date(); const yyyy=t.getFullYear(), mm=String(t.getMonth()+1).padStart(2,"0"), dd=String(t.getDate()).padStart(2,"0");
  dateEl.value=`${yyyy}-${mm}-${dd}`;

  const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;
  const codes=JSON.parse(localStorage.getItem("pr.costCodes")||"[]");
  cfgUrl.value=url; cfgCodes.value=(codes.length?codes:DEFAULT_COST_CODES).join(", "); applyCostCodes(codes.length?codes:DEFAULT_COST_CODES);

  document.getElementById("tabExpense").addEventListener("click",()=>setType("expense"));
  document.getElementById("tabIncome").addEventListener("click",()=>setType("income"));
  document.getElementById("btnCamera").addEventListener("click",()=>cameraInput.click());
  document.getElementById("btnUpload").addEventListener("click",()=>fileInput.click());
  cameraInput.addEventListener("change",onPickFile);
  fileInput.addEventListener("change",onPickFile);
  openSettingsBtn.addEventListener("click",()=>settingsModal.showModal());
  document.getElementById("saveSettings").addEventListener("click",(e)=>{e.preventDefault();
    localStorage.setItem("pr.webAppUrl", cfgUrl.value.trim());
    const list=cfgCodes.value.split(",").map(s=>s.trim()).filter(Boolean);
    localStorage.setItem("pr.costCodes", JSON.stringify(list)); applyCostCodes(list); settingsModal.close(); healthCheck();
  });

  renderFromCache();
  await healthCheck();
})();

async function healthCheck(){
  syncStatus.textContent="Checking connection…"; syncStatus.className="status";
  const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;
  try{
    const res=await fetch(url,{method:"GET"});
    if(!res.ok){ syncStatus.textContent=`Backend error ${res.status}`; syncStatus.className="status status-bad"; return; }
    await res.text(); syncStatus.textContent="Syncing to Google Sheets"; syncStatus.className="status status-ok";
  }catch(err){
    syncStatus.textContent="Cannot reach backend (permissions). Web App must be 'Anyone', execute as 'Me'."; 
    syncStatus.className="status status-bad";
  }
}

function setType(type){entryType=type;document.getElementById("tabExpense").classList.toggle("active",type==="expense");document.getElementById("tabIncome").classList.toggle("active",type==="income");}
function applyCostCodes(list){costCodeSelect.innerHTML=`<option disabled selected value="">Select a category</option>`+list.map(c=>`<option value="${c}">${c}</option>`).join("");}
function onPickFile(ev){const f=ev.target.files[0];if(!f)return;chosenFile=f;const reader=new FileReader();reader.onload=()=>{preview.innerHTML=`<img src="${reader.result}" alt="receipt preview" />`;};reader.readAsDataURL(f);}

document.getElementById("entryForm").addEventListener("submit", async (ev)=>{
  ev.preventDefault(); saveMsg.textContent=""; saveBtn.disabled=true;
  try{
    const payload=await buildPayload();
    const url=localStorage.getItem("pr.webAppUrl")||DEFAULT_WEB_APP_URL;

    // Send as text/plain to avoid iOS preflight
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({action:"record",data:payload})});
    if(!res.ok) throw new Error("Network error: "+res.status);
    const json=await res.json();
    if(!json.ok) throw new Error(json.error||"Server error");

    const entry={...payload, receiptUrl: json.receiptUrl, id: json.rowNumber || Date.now()};
    addToCache(entry); renderFromCache(); clearForm(); saveMsg.textContent="Saved ✓"; saveMsg.style.color="#059669";
  }catch(err){
    saveMsg.textContent=(err && err.message) ? err.message : "Load failed";
    saveMsg.style.color="#b91c1c";
  }finally{ saveBtn.disabled=false; }
});

async function buildPayload(){
  const date=dateEl.value, description=(descriptionEl.value||"").trim(), costCode=costCodeSelect.value, amount=parseFloat(amountEl.value);
  if(!date||!description||!costCode||isNaN(amount)) throw new Error("Please fill in all fields.");
  let receipt=null;
  if(chosenFile){
    const dataUrl=await downscaleToJpegDataUrl(chosenFile,1600,0.85);
    const [meta,b64]=dataUrl.split(",");
    const mime=meta.split(":")[1].split(";")[0];
    receipt={name:sanitizeFileName(`${date}-${description}`)+".jpg",mimeType:mime,dataBase64:b64};
  }
  return {type:entryType,date,description,costCode,amount,receipt};
}

function sanitizeFileName(s){return s.replace(/[^a-z0-9\\-_.]+/gi,"_").slice(0,80)||"receipt";}
function addToCache(item){const list=JSON.parse(localStorage.getItem("pr.entries")||"[]");list.unshift(item);localStorage.setItem("pr.entries",JSON.stringify(list.slice(0,200)));}
function renderFromCache(){const list=JSON.parse(localStorage.getItem("pr.entries")||"[]");let income=0,expenses=0;list.forEach(e=>{if(e.type==="income")income+=Number(e.amount||0);else expenses+=Number(e.amount||0);});totalIncomeEl.textContent=formatMoney(income);totalExpensesEl.textContent=formatMoney(expenses);netBalanceEl.textContent=formatMoney(income-expenses);if(!list.length){entriesList.classList.add("empty");entriesList.innerHTML=`<div class="empty-state"><div class="icon">📄</div><div>No entries yet. Add your first transaction above.</div></div>`;return;}entriesList.classList.remove("empty");entriesList.innerHTML=list.map(e=>{const cls=e.type==="income"?"income":"expense";const link=e.receiptUrl?`<a href="${e.receiptUrl}" target="_blank" rel="noopener">Receipt</a>`:`<span class="meta">No receipt</span>`;return `<div class="entry"><div><div><strong>${escapeHTML(e.description)}</strong></div><div class="meta">${e.date} • ${escapeHTML(e.costCode)} • ${e.type}</div></div><div class="amount ${cls}">${formatMoney(e.amount)}</div><div>${link}</div></div>`;}).join("");}
function clearForm(){descriptionEl.value="";amountEl.value="";costCodeSelect.value="";chosenFile=null;preview.innerHTML="";}
function formatMoney(n){try{return new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(n);}catch(_){return "R"+(Number(n).toFixed(2));}}
function escapeHTML(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',\"'\":'&#39;','\"':'&quot;'}[c]));}

// downscale for reliable mobile uploads
function downscaleToJpegDataUrl(file, maxDim=1600, quality=0.85){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(); reader.onload=()=>{
      const img=new Image(); img.onload=()=>{
        let w=img.width,h=img.height;
        if(Math.max(w,h)>maxDim){ const ratio=maxDim/Math.max(w,h); w=Math.round(w*ratio); h=Math.round(h*ratio); }
        const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext("2d"); ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      }; img.onerror=reject; img.src=reader.result;
    }; reader.onerror=reject; reader.readAsDataURL(file);
  });
}
