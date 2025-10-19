// Property Revolution Finance App — Frontend (Payment Method: Card/EFT/Cash/Other)
// Prefilled with your backend URL. PWA-ready.

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const DEFAULT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycby0Y4LQsQXf_XmEUgrDfox6BQx5nnUXDjlP77MFCikLBQjAgV-Vi-JeGB5_u5JavAxTIw/exec";
const PAYMENT_METHODS = ['Card','EFT','Cash','Other'];

const state = {
  entries: [],
  webAppUrl: localStorage.getItem('prfa_webAppUrl') || DEFAULT_WEBAPP_URL,
  opaqueMode: localStorage.getItem('prfa_opaqueMode') === '1',
  costCodes: []
};

// UI elements
const form = $('#entryForm');
const message = $('#message');
const receiptInput = $('#receipt');
const preview = $('#preview');
const listDiv = $('#entries');
const listCount = $('#listCount');
const openSettings = $('#openSettings');
const settingsDialog = $('#settingsDialog');
const opaqueMode = $('#opaqueMode');
const webAppUrl = $('#webAppUrl');
const syncNow = $('#syncNow');
const refreshList = $('#refreshList');
const useCamera = $('#useCamera');

// Tabs
$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('#'+target).classList.add('active');
  });
});

// Header year
$('#year').textContent = new Date().getFullYear();

// Date default
$('#date').valueAsDate = new Date();

// Settings dialog
openSettings.addEventListener('click', () => settingsDialog.showModal());
webAppUrl.value = state.webAppUrl;
opaqueMode.checked = state.opaqueMode;
$('#testBackend').addEventListener('click', testBackend);

webAppUrl.addEventListener('input', () => {
  state.webAppUrl = webAppUrl.value.trim();
  localStorage.setItem('prfa_webAppUrl', state.webAppUrl);
});
opaqueMode.addEventListener('change', () => {
  state.opaqueMode = opaqueMode.checked;
  localStorage.setItem('prfa_opaqueMode', state.opaqueMode ? '1' : '0');
});

// Camera shortcut
useCamera.addEventListener('click', () => {
  receiptInput.setAttribute('capture','environment');
  receiptInput.click();
});

// Populate Payment Method select
(function initPaymentMethods(){
  const sel = $('#paymentMethod');
  sel.innerHTML = PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('');
  sel.value = 'Card';
  const otherRow = $('#otherPaymentRow');
  const otherInput = $('#otherPayment');
  const toggleOther = () => {
    const isOther = sel.value === 'Other';
    otherRow.style.display = isOther ? 'block' : 'none';
    otherInput.required = isOther;
    if (!isOther) otherInput.value = '';
  };
  sel.addEventListener('change', toggleOther);
  toggleOther();
})();

// Cost Codes
async function loadCostCodes() {
  const select = $('#costCode');
  select.innerHTML = `<option value="" disabled selected>Loading...</option>`;
  const url = state.webAppUrl ? `${state.webAppUrl}?fn=costCodes` : null;
  try {
    if (!url) throw new Error('No backend URL');
    const r = await fetch(url, { method: 'GET' });
    const data = await r.json();
    const codes = Array.isArray(data?.codes) ? data.codes : [];
    state.costCodes = codes.length ? codes : ['Marketing','Travel','Office Supplies','Fuel','Repairs','Meals','Advertising','Utilities','Rent','Salaries','Software','Misc'];
  } catch (e) {
    state.costCodes = ['Marketing','Travel','Office Supplies','Fuel','Repairs','Meals','Advertising','Utilities','Rent','Salaries','Software','Misc'];
  }
  select.innerHTML = `<option value="" disabled selected>Select cost code</option>` +
    state.costCodes.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Image preview & compression
let imageDataUrl = null;

receiptInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  const compressed = await compressImage(dataUrl, 1600, 0.85);
  imageDataUrl = compressed;
  await drawPreview(compressed);
});

async function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(dataUrl, maxW=1600, quality=0.85){
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

async function drawPreview(dataUrl){
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const ctx = preview.getContext('2d');
  preview.width = img.width;
  preview.height = img.height;
  ctx.drawImage(img, 0, 0);
  preview.hidden = false;
}

// Local storage
function loadEntries(){
  state.entries = JSON.parse(localStorage.getItem('prfa_entries') || '[]');
}
function saveEntries(){
  localStorage.setItem('prfa_entries', JSON.stringify(state.entries));
}
function addEntry(entry){
  state.entries.unshift(entry);
  saveEntries();
  renderList();
}

function renderList(){
  listDiv.innerHTML = '';
  listCount.textContent = `${state.entries.length} saved`;
  state.entries.forEach((e,i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div>
        <div class="meta">
          <span class="badge">${e.type}</span> • ${e.date} • R ${Number(e.amount).toFixed(2)}
        </div>
        <div class="kv">
          <strong>Cost Code</strong><span>${e.costCode}</span>
          <strong>Description</strong><span>${e.description}</span>
          <strong>Purpose</strong><span>${e.whatFor || ''}</span>
          <strong>Status</strong><span>${e.synced ? 'Synced' : 'Pending'}</span>
        </div>
      </div>
      <div>
        <button data-i="${i}" class="btn ghost del">Delete</button>
      </div>
    `;
    listDiv.appendChild(el);
  });
  $$('.del').forEach(btn => btn.addEventListener('click', (ev) => {
    const idx = Number(ev.currentTarget.dataset.i);
    state.entries.splice(idx,1);
    saveEntries();
    renderList();
  }));
}

refreshList.addEventListener('click', renderList);

// Submit
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const paymentSel = $('#paymentMethod');
  const otherVal = $('#otherPayment').value.trim();
  const paymentValue = paymentSel.value === 'Other' ? (otherVal || 'Other') : paymentSel.value;

  const entry = {
    id: crypto.randomUUID(),
    type: $('#type').value,
    date: $('#date').value,
    amount: $('#amount').value,
    costCode: $('#costCode').value,
    description: $('#description').value,
    whatFor: $('#whatFor').value,
    vendor: $('#vendor').value,
    paymentMethod: paymentValue,
    imageDataUrl,
    createdAt: new Date().toISOString(),
    synced: false
  };
  if (!entry.costCode) return setMessage('Please choose a cost code.');
  if (!entry.amount || Number(entry.amount) <= 0) return setMessage('Please enter a valid amount.');

  addEntry(entry);
  form.reset();
  // reset payment method default
  $('#paymentMethod').value = 'Card';
  $('#otherPayment').value = '';
  document.getElementById('otherPaymentRow').style.display = 'none';

  imageDataUrl = null;
  preview.hidden = true;
  setMessage('Saved locally. Attempting sync…');
  await syncQueue();
});

syncNow.addEventListener('click', syncQueue);

function setMessage(text){
  message.textContent = text || '';
  if (text) { setTimeout(()=> message.textContent='', 4000); }
}

// Sync logic
async function syncQueue(){
  if (!state.webAppUrl) return setMessage('Add your Web App URL in Settings first.');
  let success = 0, fail = 0;
  for (const e of state.entries) {
    if (e.synced) continue;
    const payload = {
      action: 'submit',
      entry: e
    };
    try {
      const r = await fetch(state.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: state.opaqueMode ? 'no-cors' : 'cors'
      });
      if (state.opaqueMode) {
        e.synced = true; success++;
      } else {
        if (r.ok) {
          const data = await r.json();
          if (data?.ok) { e.synced = true; success++; } else { fail++; }
        } else {
          fail++;
        }
      }
    } catch (err) {
      console.error(err);
      fail++;
    }
  }
  saveEntries();
  renderList();
  setMessage(`Sync complete. ${success} sent, ${fail} failed.`);
}

// Backend health check
async function testBackend(){
  $('#settingsMsg').textContent = 'Checking…';
  if (!state.webAppUrl) {
    $('#settingsMsg').textContent = 'Enter a Web App URL first.';
    return;
  }
  try {
    const r = await fetch(`${state.webAppUrl}?fn=health`, { method: 'GET' });
    if (!r.ok) throw new Error('HTTP '+r.status);
    const data = await r.json();
    if (data?.ok) {
      $('#settingsMsg').textContent = 'Connected.';
      await loadCostCodes();
    } else {
      $('#settingsMsg').textContent = 'No response from backend.';
    }
  } catch (e) {
    $('#settingsMsg').textContent = 'Could not reach backend.';
  }
}

// Init
function init(){
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('service-worker.js'); }
  loadEntries();
  renderList();
  loadCostCodes();
  webAppUrl.value = state.webAppUrl;
  opaqueMode.checked = state.opaqueMode;
}
init();
