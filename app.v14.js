
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz8Sg1NOd-82wkcr0cCDg46hX2QUgTKzayxL5I68ykQq5rtXwZcVT46AKRu3ghxHe2ivA/exec";
const FALLBACK_CODES = { expense: ["Marketing","Travel","Office Supplies","Fuel","Meals & Entertainment","Repairs & Maintenance","Software & Subscriptions","Utilities","Professional Fees","Commissions","Rent","Salaries","Training","Miscellaneous"], income: ["Commission","Referral Fee","Consulting Income","Rental Income","Other Income"] };
const S = id => document.getElementById(id);
const costCodeSelect=S("costCode"), dateEl=S("date"), descriptionEl=S("description"), amountEl=S("amount");
const cameraInput=S("cameraInput"), fileInput=S("fileInput"), preview=S("preview");
const saveBtn=S("saveBtn"), saveMsg=S("saveMsg"), syncStatus=S("syncStatus");
const entriesList=S("entriesList"), totalIncomeEl=S("totalIncome"), totalExpensesEl=S("totalExpenses"), netBalanceEl=S("netBalance");
const cfgUrl=S("cfgUrl"), settingsModal=S("settingsModal"), addCodeBtn=S("addCodeBtn");
let entryType="expense", chosenFile=null, codes={...FALLBACK_CODES};

if('serviceWorker' in navigator) addEventListener('load', ()=>navigator.serviceWorker.register('sw.v14.js'));

(async function init(){
  const t=new Date(); dateEl.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  if(!localStorage.getItem('pr.webAppUrl')) localStorage.setItem('pr.webAppUrl', DEFAULT_WEB_APP_URL);
  cfgUrl.value = localStorage.getItem('pr.webAppUrl') || DEFAULT_WEB_APP_URL;

  S('tabExpense').onclick=()=>{ setType('expense'); populateCodes('expense'); };
  S('tabIncome').onclick=()=>{ setType('income'); populateCodes('income'); };
  addCodeBtn.onclick=onAddCode;
  S('btnCamera').onclick=()=>cameraInput.click();
  S('btnUpload').onclick=()=>fileInput.click();
  cameraInput.onchange=onPickFile;
  fileInput.onchange=onPickFile;
  S('openSettings').onclick=()=>settingsModal.showModal();
  S('saveSettings').onclick=e=>{ e.preventDefault(); localStorage.setItem('pr.webAppUrl', cfgUrl.value.trim()); settingsModal.close(); healthCheck(true); };
  S('entryForm').addEventListener('submit', onSubmit);
  S('checkBtn').onclick=()=>healthCheck(true);

  await loadCodes();
  populateCodes(entryType);
  renderFromCache();
  await healthCheck(false);
})();

async function loadCodes(){
  const url = localStorage.getItem('pr.webAppUrl') || DEFAULT_WEB_APP_URL;
  try{ const r=await fetch(url+'?action=codes',{cache:'no-store'}); const j=await r.json(); if(j&&j.ok&&j.codes) codes=j.codes; localStorage.setItem('pr.codes',JSON.stringify(codes)); }
  catch(e){ const c=localStorage.getItem('pr.codes'); if(c) codes=JSON.parse(c); }
}
function populateCodes(type){
  const list=(codes[type]||[]).slice().sort();
  costCodeSelect.innerHTML = `<option disabled selected value="">Select a category</option>` + list.map(c=>`<option value="${c.replace(/\"/g,'&quot;')}">${c}</option>`).join('');
}
async function onAddCode(){
  const url = localStorage.getItem('pr.webAppUrl') || DEFAULT_WEB_APP_URL;
  const label = entryType==='income'?'New income code':'New expense code';
  const val = (prompt(label+':')||'').trim(); if(!val) return;
  if(!codes[entryType].some(c=>c.toLowerCase()===val.toLowerCase())) codes[entryType].push(val);
  populateCodes(entryType); costCodeSelect.value = val; localStorage.setItem('pr.codes', JSON.stringify(codes));
  const bodyJson = JSON.stringify({ action:'addCode', type:entryType, code:val });
  try{ let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:bodyJson}); const js=await r.json(); if(js&&js.ok&&js.codes){ codes=js.codes; localStorage.setItem('pr.codes',JSON.stringify(codes)); populateCodes(entryType); costCodeSelect.value=val; } }
  catch(_e){ let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'payload='+encodeURIComponent(bodyJson)}); try{ const js=await r.json(); if(js&&js.ok&&js.codes){ codes=js.codes; localStorage.setItem('pr.codes',JSON.stringify(codes)); populateCodes(entryType); costCodeSelect.value=val; } }catch(_ ){} }
}

async function healthCheck(alsoReloadCodes){
  syncStatus.textContent='Checking connection…'; syncStatus.className='status';
  const url = localStorage.getItem('pr.webAppUrl') || DEFAULT_WEB_APP_URL;
  try{ const r=await fetch(url+'?action=summary', {cache:'no-store'}); if(r.ok){ const j=await r.json(); if(j&&typeof j.income==='number'){ totalIncomeEl.textContent=money(j.income||0); totalExpensesEl.textContent=money(j.expenses||0); netBalanceEl.textContent=money(j.net||0); } } if(alsoReloadCodes) await loadCodes(); syncStatus.textContent='Syncing to Google Sheets'; syncStatus.className='status status-ok'; }
  catch(err){ syncStatus.textContent='Cannot reach backend. Check deploy & permissions.'; syncStatus.className='status status-bad'; }
}

function setType(t){ entryType=t; S('tabExpense').classList.toggle('active',t==='expense'); S('tabIncome').classList.toggle('active',t==='income'); }
function onPickFile(ev){ const f=ev.target.files[0]; if(!f)return; chosenFile=f; const r=new FileReader(); r.onload=()=>{ preview.innerHTML=`<img src="${r.result}" alt="receipt" />`; }; r.readAsDataURL(f); }

async function onSubmit(ev){
  ev.preventDefault(); saveMsg.textContent=''; saveBtn.disabled=true;
  try{ const payload=await buildPayload(); const url=localStorage.getItem('pr.webAppUrl')||DEFAULT_WEB_APP_URL;
    try{ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'record',data:payload})}); if(!r.ok) throw new Error('HTTP '+r.status); const js=await r.json(); if(!js.ok) throw new Error(js.error||'Server error'); onSaved(js,payload); }
    catch(e1){ const body='payload='+encodeURIComponent(JSON.stringify({action:'record',data:payload})); const r2=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body}); if(!r2.ok) throw new Error('HTTP '+r2.status); const js2=await r2.json(); if(!js2.ok) throw new Error(js2.error||'Server error'); onSaved(js2,payload); }
  }catch(err){ saveMsg.textContent = err.message || 'Failed to save'; saveMsg.style.color='#b91c1c'; } finally{ saveBtn.disabled=false; }
}
function onSaved(server,payload){ const entry={...payload,receiptUrl:server.receiptUrl,id:server.rowNumber||Date.now()}; addToCache(entry); renderFromCache(); clearForm(); saveMsg.textContent='Saved ✓'; saveMsg.style.color='#059669'; }

async function buildPayload(){
  const date=dateEl.value, description=(descriptionEl.value||'').trim(), costCode=costCodeSelect.value, amount=parseFloat(amountEl.value);
  if(!date||!description||!costCode||isNaN(amount)) throw new Error('Please fill in all fields.');
  let receipt=null;
  if(chosenFile){ const dataUrl=await downscaleToJpegDataUrl(chosenFile,1400,0.8); const [meta,b64]=dataUrl.split(','), mime=meta.split(':')[1].split(';')[0]; receipt={ name:(date+'-'+description).replace(/[^a-z0-9\-_.]+/gi,'_').slice(0,80)+'.jpg', mimeType:mime, dataBase64:b64 }; }
  return { type:entryType, date, description, costCode, amount, receipt };
}

function addToCache(item){ const list=JSON.parse(localStorage.getItem('pr.entries')||'[]'); list.unshift(item); localStorage.setItem('pr.entries', JSON.stringify(list.slice(0,200))); }
function renderFromCache(){
  const list=JSON.parse(localStorage.getItem('pr.entries')||'[]');
  let income=0,expenses=0; list.forEach(e=>{ if(e.type==='income') income+=Number(e.amount||0); else expenses+=Number(e.amount||0); });
  totalIncomeEl.textContent=money(income); totalExpensesEl.textContent=money(expenses); netBalanceEl.textContent=money(income-expenses);
  entriesList.innerHTML=list.length?list.map(e=>`<div class="entry"><div><div><strong>${e.description}</strong></div><div class="meta">${e.date} • ${e.costCode} • ${e.type}</div></div><div class="amount ${e.type==='income'?'income':'expense'}">${money(e.amount)}</div><div>${e.receiptUrl?`<a href="${e.receiptUrl}" target="_blank">Receipt</a>`:'No receipt'}</div></div>`).join(''):`<div class="empty-state"><div class="icon">📄</div><div>No entries yet. Add your first transaction above.</div></div>`;
}
function clearForm(){ descriptionEl.value=''; amountEl.value=''; costCodeSelect.value=''; chosenFile=null; preview.innerHTML=''; }
function money(n){ try{ return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n); }catch(_ ){ return 'R'+Number(n).toFixed(2); } }
function downscaleToJpegDataUrl(file,maxDim=1400,quality=0.8){
  return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ let w=img.width,h=img.height; if(Math.max(w,h)>maxDim){ const s=maxDim/Math.max(w,h); w=Math.round(w*s); h=Math.round(h*s); } const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); resolve(c.toDataURL('image/jpeg',quality)); }; img.onerror=reject; img.src=r.result; }; r.onerror=reject; r.readAsDataURL(file); });
}
